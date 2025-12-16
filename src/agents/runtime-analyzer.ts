/**
 * RuntimeAnalyzerAgent - LLM-based semantic analysis of runtime telemetry
 *
 * From Autonomous Agent Architecture Patterns v0.2:
 * - Subagent with fresh context window
 * - XML-structured prompt from prompts/runtime-analyzer.yaml
 * - Returns condensed summary (insights, not raw data)
 * - Uses dynamic pricing from LiteLLM API
 */

import Anthropic from '@anthropic-ai/sdk';
import { loadPrompt, type AnalysisPrompt } from '../templates.js';
import { getPricingContext, calculateTotalCost, type PricingContext } from '../costs.js';
import type { RuntimeSummary, InferenceEvent, Insight, ImpactEstimate } from '../types.js';
import { createConstrainedRegistry, type ToolRegistry } from '../tools/index.js';
import type { BaseAgent, AgentOutput } from './index.js';

// =============================================================================
// TYPES
// =============================================================================

export interface RuntimeAnalyzerInput {
  events: InferenceEvent[];
  runtimeSummary: RuntimeSummary;
  pricingContext?: PricingContext; // Dynamic pricing from LiteLLM
}

export interface RuntimeAnalyzerOutput {
  insights: Insight[];
  detectedPatterns: {
    applicationType: 'rag' | 'agent' | 'batch' | 'chat' | 'pipeline' | 'unknown';
    multiModelPipeline: boolean;
    streamingDetected: boolean;
    batchingDetected: boolean;
    cachingDetected: boolean;
  };
  summary: {
    totalCalls: number;
    totalTokens: number;
    dominantProvider: string;
    dominantModel: string;
    estimatedDailyCostUSD: number;
  };
}

// LLM response shape (matches prompt output_format)
interface LLMRuntimeAnalysisResult {
  insights: Array<{
    severity: 'critical' | 'warning' | 'info';
    category: 'cost' | 'latency' | 'reliability' | 'throughput' | 'waste';
    headline: string;
    evidence: string;
    recommendation?: string;
    impact?: {
      layer: 'application' | 'model' | 'runtime' | 'infrastructure';
      impactType: 'cost' | 'latency' | 'throughput';
      estimatedImpactPercent: number;
      effort: 'low' | 'medium' | 'high';
    };
  }>;
  detected_patterns: {
    application_type: string;
    multi_model_pipeline: boolean;
    streaming_detected: boolean;
    batching_detected: boolean;
    caching_detected: boolean;
  };
  summary: {
    total_calls: number;
    total_tokens: number;
    dominant_provider: string;
    dominant_model: string;
    estimated_daily_cost_usd: number;
  };
}

// =============================================================================
// HELPERS
// =============================================================================

function buildRuntimeContext(
  events: InferenceEvent[],
  runtimeSummary: RuntimeSummary,
  pricingContext?: PricingContext
): string {
  // Build condensed context for LLM (not raw events, but aggregated stats)
  const lines: string[] = [];

  lines.push('=== RUNTIME TELEMETRY SUMMARY ===');
  lines.push(`Total events: ${runtimeSummary.totalEvents}`);
  lines.push('');

  // By provider stats
  lines.push('--- BY PROVIDER ---');
  for (const [provider, stats] of Object.entries(runtimeSummary.byProvider)) {
    lines.push(`${provider}:`);
    lines.push(`  calls: ${stats.calls}`);
    lines.push(`  tokens_in: ${stats.tokens_in}, tokens_out: ${stats.tokens_out}`);
    lines.push(`  latency: p50=${stats.latency_p50}ms, p95=${stats.latency_p95}ms, p99=${stats.latency_p99}ms`);
  }
  lines.push('');

  // By model stats
  lines.push('--- BY MODEL ---');
  for (const [model, stats] of Object.entries(runtimeSummary.byModel)) {
    lines.push(`${model}:`);
    lines.push(`  calls: ${stats.calls}`);
    lines.push(`  tokens_in: ${stats.tokens_in}, tokens_out: ${stats.tokens_out}`);
    lines.push(`  latency: p50=${stats.latency_p50}ms, p95=${stats.latency_p95}ms, p99=${stats.latency_p99}ms`);
  }
  lines.push('');

  // Global latency
  lines.push('--- GLOBAL LATENCY ---');
  lines.push(`p50: ${runtimeSummary.global.p50}ms`);
  lines.push(`p95: ${runtimeSummary.global.p95}ms`);
  lines.push(`p99: ${runtimeSummary.global.p99}ms`);
  lines.push('');

  // Pricing context if available
  if (pricingContext && Object.keys(pricingContext.models).length > 0) {
    lines.push('--- PRICING CONTEXT ($/1M tokens) ---');
    lines.push(`Thresholds: expensive>${pricingContext.thresholds.expensive}, moderate>${pricingContext.thresholds.moderate}`);
    for (const [model, pricing] of Object.entries(pricingContext.models)) {
      lines.push(`${model}: input=$${pricing.input.toFixed(2)}, output=$${pricing.output.toFixed(2)} [${pricing.tier}]`);
    }
    lines.push('');

    // Calculate total cost
    const totalCost = calculateTotalCost(events);
    lines.push(`Estimated total cost: $${totalCost.toFixed(4)}`);
  }

  // Runtime patterns from events
  const hasStreaming = events.some(e => e.streaming === true);
  const hasBatching = events.some(e => e.batch_id !== undefined);
  const hasCaching = events.some(e => e.cached === true);
  const hasRetries = events.some(e => (e.retry_count || 0) > 0);
  const hasFallback = events.some(e => e.fallback_used === true);

  lines.push('--- DETECTED RUNTIME PATTERNS ---');
  lines.push(`streaming: ${hasStreaming}`);
  lines.push(`batching: ${hasBatching}`);
  lines.push(`caching: ${hasCaching}`);
  lines.push(`retries: ${hasRetries}`);
  lines.push(`fallback: ${hasFallback}`);

  return lines.join('\n');
}

// =============================================================================
// AGENT IMPLEMENTATION
// =============================================================================

export const RuntimeAnalyzerAgent: BaseAgent<RuntimeAnalyzerInput, RuntimeAnalyzerOutput> = {
  name: 'runtime-analyzer',
  description: 'Analyze runtime telemetry for patterns, anomalies, and optimization opportunities',
  tools: createConstrainedRegistry(),

  async execute(input: RuntimeAnalyzerInput): Promise<AgentOutput<RuntimeAnalyzerOutput>> {
    const toolsUsed: string[] = ['llm'];

    // Load prompt from YAML
    const promptConfig = loadPrompt('runtime-analyzer');
    if (!promptConfig) {
      throw new Error('[runtime-analyzer] Prompt not found: prompts/runtime-analyzer.yaml');
    }

    // Get pricing context for models in the data
    const models = Object.keys(input.runtimeSummary.byModel);
    const pricingContext = input.pricingContext || getPricingContext(models);

    // Build runtime context
    const runtimeContext = buildRuntimeContext(input.events, input.runtimeSummary, pricingContext);

    // Check for API key
    if (!process.env.ANTHROPIC_API_KEY) {
      // Return fallback result without LLM
      console.warn('[runtime-analyzer] No ANTHROPIC_API_KEY, returning basic analysis');
      return {
        result: buildFallbackResult(input.events, input.runtimeSummary),
        toolsUsed: [],
      };
    }

    try {
      const client = new Anthropic();
      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: `${promptConfig.prompt}\n\n${runtimeContext}`,
          },
        ],
      });

      // Extract JSON from response
      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        console.warn('[runtime-analyzer] No JSON in LLM response, using fallback');
        return {
          result: buildFallbackResult(input.events, input.runtimeSummary),
          toolsUsed,
        };
      }

      const parsed = JSON.parse(jsonMatch[0]) as LLMRuntimeAnalysisResult;

      // Convert to output format
      const insights: Insight[] = parsed.insights.map((i, idx) => ({
        id: `runtime_${Date.now()}_${idx}`,
        severity: i.severity,
        category: i.category as Insight['category'],
        headline: i.headline,
        evidence: i.evidence,
        recommendation: i.recommendation,
        source: 'llm' as const,
        impact: i.impact ? {
          layer: i.impact.layer,
          impactType: i.impact.impactType,
          estimatedImpactPercent: i.impact.estimatedImpactPercent,
          effort: i.impact.effort,
          confidence: 0.8,
        } as ImpactEstimate : undefined,
      }));

      return {
        result: {
          insights,
          detectedPatterns: {
            applicationType: (parsed.detected_patterns?.application_type || 'unknown') as RuntimeAnalyzerOutput['detectedPatterns']['applicationType'],
            multiModelPipeline: parsed.detected_patterns?.multi_model_pipeline || false,
            streamingDetected: parsed.detected_patterns?.streaming_detected || false,
            batchingDetected: parsed.detected_patterns?.batching_detected || false,
            cachingDetected: parsed.detected_patterns?.caching_detected || false,
          },
          summary: {
            totalCalls: parsed.summary?.total_calls || input.runtimeSummary.totalEvents,
            totalTokens: parsed.summary?.total_tokens || calculateTotalTokens(input.runtimeSummary),
            dominantProvider: parsed.summary?.dominant_provider || getDominantProvider(input.runtimeSummary),
            dominantModel: parsed.summary?.dominant_model || getDominantModel(input.runtimeSummary),
            estimatedDailyCostUSD: parsed.summary?.estimated_daily_cost_usd || 0,
          },
        },
        toolsUsed,
      };
    } catch (error) {
      console.warn('[runtime-analyzer] LLM analysis failed:', error);
      return {
        result: buildFallbackResult(input.events, input.runtimeSummary),
        toolsUsed,
      };
    }
  },
};

// =============================================================================
// FALLBACK HELPERS
// =============================================================================

function buildFallbackResult(
  events: InferenceEvent[],
  runtimeSummary: RuntimeSummary
): RuntimeAnalyzerOutput {
  return {
    insights: [],
    detectedPatterns: {
      applicationType: 'unknown',
      multiModelPipeline: Object.keys(runtimeSummary.byModel).length > 1,
      streamingDetected: events.some(e => e.streaming === true),
      batchingDetected: events.some(e => e.batch_id !== undefined),
      cachingDetected: events.some(e => e.cached === true),
    },
    summary: {
      totalCalls: runtimeSummary.totalEvents,
      totalTokens: calculateTotalTokens(runtimeSummary),
      dominantProvider: getDominantProvider(runtimeSummary),
      dominantModel: getDominantModel(runtimeSummary),
      estimatedDailyCostUSD: 0,
    },
  };
}

function calculateTotalTokens(summary: RuntimeSummary): number {
  let total = 0;
  for (const stats of Object.values(summary.byModel)) {
    total += stats.tokens_in + stats.tokens_out;
  }
  return total;
}

function getDominantProvider(summary: RuntimeSummary): string {
  let maxCalls = 0;
  let dominant = 'unknown';
  for (const [provider, stats] of Object.entries(summary.byProvider)) {
    if (stats.calls > maxCalls) {
      maxCalls = stats.calls;
      dominant = provider;
    }
  }
  return dominant;
}

function getDominantModel(summary: RuntimeSummary): string {
  let maxCalls = 0;
  let dominant = 'unknown';
  for (const [model, stats] of Object.entries(summary.byModel)) {
    if (stats.calls > maxCalls) {
      maxCalls = stats.calls;
      dominant = model;
    }
  }
  return dominant;
}

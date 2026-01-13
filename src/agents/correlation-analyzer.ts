/**
 * CorrelationAnalyzerAgent - LLM-based correlation of static code and runtime telemetry
 *
 * From Autonomous Agent Architecture Patterns v0.2:
 * - Subagent with fresh context window
 * - XML-structured prompt from prompts/correlation-analyzer.yaml
 * - Detects drift between code intent and runtime reality
 * - Returns drift signals and alignment score
 *
 * Uses Claude Agent SDK (per TDD v1.9.3)
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { loadPrompt } from '../templates.js';
import type { Callsite, InferenceEvent, RuntimeSummary, Insight, DriftSignal, ImpactEstimate } from '../types.js';
import { createConstrainedRegistry, type ToolRegistry } from '../tools/index.js';
import type { BaseAgent, AgentOutput } from './index.js';

// =============================================================================
// TYPES
// =============================================================================

export interface CorrelationAnalyzerInput {
  callsites: Callsite[];
  events: InferenceEvent[];
  runtimeSummary: RuntimeSummary;
}

export interface CorrelationAnalyzerOutput {
  insights: Insight[];
  driftSignals: DriftSignal[];
  correlationSummary: {
    totalCodeCallsites: number;
    totalRuntimeModels: number;
    matched: number;
    codeOnly: number;
    runtimeOnly: number;
    mismatched: number;
  };
  alignmentScore: number; // 0.0 - 1.0
  overallAssessment: string;
}

// LLM response shape (matches prompt output_format)
interface LLMCorrelationResult {
  drift_signals: Array<{
    type: 'codeOnly' | 'runtimeOnly' | 'modelMismatch' | 'patternMismatch' | 'providerMismatch';
    severity: 'critical' | 'warning' | 'info';
    code_location: string | null;
    code_details: {
      provider: string;
      model: string;
      patterns: Record<string, boolean>;
    } | null;
    runtime_details: {
      provider: string;
      model: string;
      call_count: number;
      patterns_observed: Record<string, boolean>;
    } | null;
    evidence: string;
    explanation: string;
    recommendation: string;
  }>;
  correlation_summary: {
    total_code_callsites: number;
    total_runtime_models: number;
    matched: number;
    code_only: number;
    runtime_only: number;
    mismatched: number;
  };
  alignment_score: number;
  overall_assessment: string;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Extract text content from Claude Agent SDK messages
 */
function extractTextFromMessages(messages: SDKMessage[]): string {
  let text = '';
  for (const msg of messages) {
    if (msg.type === 'assistant' && msg.message?.content) {
      for (const block of msg.message.content) {
        if (block.type === 'text') {
          text += block.text;
        }
      }
    }
  }
  return text;
}

function buildCorrelationContext(
  callsites: Callsite[],
  runtimeSummary: RuntimeSummary
): string {
  const lines: string[] = [];

  // Static callsites
  lines.push('=== STATIC CALLSITES (from code analysis) ===');
  if (callsites.length === 0) {
    lines.push('No callsites detected in code.');
  } else {
    for (const cs of callsites) {
      lines.push(`${cs.file}:${cs.line}`);
      lines.push(`  provider: ${cs.provider || 'unknown'}`);
      lines.push(`  model: ${cs.model || 'unknown'}`);
      lines.push(`  framework: ${cs.framework || 'none'}`);
      lines.push(`  patterns: ${JSON.stringify(cs.patterns)}`);
      lines.push(`  confidence: ${cs.confidence}`);
    }
  }
  lines.push('');

  // Runtime summary
  lines.push('=== RUNTIME SUMMARY (from telemetry) ===');
  lines.push(`Total events: ${runtimeSummary.totalEvents}`);
  lines.push('');

  lines.push('--- By Provider ---');
  for (const [provider, stats] of Object.entries(runtimeSummary.byProvider)) {
    lines.push(`${provider}: ${stats.calls} calls, ${stats.tokens_in + stats.tokens_out} tokens`);
  }
  lines.push('');

  lines.push('--- By Model ---');
  for (const [model, stats] of Object.entries(runtimeSummary.byModel)) {
    lines.push(`${model}: ${stats.calls} calls`);
    lines.push(`  tokens: in=${stats.tokens_in}, out=${stats.tokens_out}`);
    lines.push(`  latency: p50=${stats.latency_p50}ms, p95=${stats.latency_p95}ms`);
  }

  return lines.join('\n');
}

// Pre-compute basic correlations for fallback
function computeBasicCorrelation(
  callsites: Callsite[],
  runtimeSummary: RuntimeSummary
): CorrelationAnalyzerOutput {
  const codeProviderModels = new Set<string>();
  const runtimeProviderModels = new Set<string>();

  // Collect code provider:model pairs
  for (const cs of callsites) {
    if (cs.provider && cs.model) {
      codeProviderModels.add(`${cs.provider}:${cs.model}`);
    }
  }

  // Collect runtime provider:model pairs
  for (const model of Object.keys(runtimeSummary.byModel)) {
    // Try to infer provider from model name
    let provider = 'unknown';
    if (model.includes('gpt') || model.includes('text-embedding')) provider = 'openai';
    else if (model.includes('claude')) provider = 'anthropic';
    else if (model.includes('gemini')) provider = 'google';

    runtimeProviderModels.add(`${provider}:${model}`);
  }

  // Calculate overlaps
  const matched = [...codeProviderModels].filter(pm => runtimeProviderModels.has(pm)).length;
  const codeOnly = codeProviderModels.size - matched;
  const runtimeOnly = runtimeProviderModels.size - matched;
  const mismatched = 0; // Would need more sophisticated matching

  // Alignment score
  const total = codeProviderModels.size + runtimeProviderModels.size;
  const alignmentScore = total > 0 ? (matched * 2) / total : 1.0;

  // Build drift signals
  const driftSignals: DriftSignal[] = [];

  // Code-only entries
  for (const pm of codeProviderModels) {
    if (!runtimeProviderModels.has(pm)) {
      const [provider, model] = pm.split(':');
      const cs = callsites.find(c => c.provider === provider && c.model === model);
      driftSignals.push({
        type: 'codeOnly',
        provider,
        model,
        callsiteId: cs?.id,
        message: `Model ${model} found in code but not in runtime telemetry`,
      });
    }
  }

  // Runtime-only entries
  for (const pm of runtimeProviderModels) {
    if (!codeProviderModels.has(pm)) {
      const [provider, model] = pm.split(':');
      driftSignals.push({
        type: 'runtimeOnly',
        provider,
        model,
        message: `Model ${model} found in runtime but not in code analysis`,
      });
    }
  }

  // Limit to max 15 as per template constraint
  if (driftSignals.length > 15) {
    driftSignals.splice(15);
  }

  return {
    insights: [],
    driftSignals,
    correlationSummary: {
      totalCodeCallsites: callsites.length,
      totalRuntimeModels: Object.keys(runtimeSummary.byModel).length,
      matched,
      codeOnly,
      runtimeOnly,
      mismatched,
    },
    alignmentScore,
    overallAssessment: alignmentScore >= 0.8
      ? 'Good alignment between code and runtime.'
      : alignmentScore >= 0.5
        ? 'Moderate drift detected. Review unmatched entries.'
        : 'Significant drift. Code and runtime show different behavior.',
  };
}

// =============================================================================
// AGENT IMPLEMENTATION
// =============================================================================

export const CorrelationAnalyzerAgent: BaseAgent<CorrelationAnalyzerInput, CorrelationAnalyzerOutput> = {
  name: 'correlation-analyzer',
  description: 'Correlate static code analysis with runtime telemetry to detect drift',
  tools: createConstrainedRegistry(),

  async execute(input: CorrelationAnalyzerInput): Promise<AgentOutput<CorrelationAnalyzerOutput>> {
    const toolsUsed: string[] = ['llm'];

    // Load prompt from YAML
    const promptConfig = loadPrompt('correlation-analyzer');
    if (!promptConfig) {
      throw new Error('[correlation-analyzer] Prompt not found: prompts/correlation-analyzer.yaml');
    }

    // Build correlation context
    const correlationContext = buildCorrelationContext(input.callsites, input.runtimeSummary);

    // Check for API key
    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn('[correlation-analyzer] No ANTHROPIC_API_KEY, returning basic correlation');
      return {
        result: computeBasicCorrelation(input.callsites, input.runtimeSummary),
        toolsUsed: [],
      };
    }

    try {
      // Use Claude Agent SDK query() function
      const agentQuery = query({
        prompt: `${promptConfig.prompt}\n\n${correlationContext}`,
        options: {
          model: 'claude-sonnet-4-20250514',
          tools: [],
          permissionMode: 'plan',
          cwd: process.cwd(),
        },
      });

      // Collect all messages from the async generator
      const messages: SDKMessage[] = [];
      for await (const message of agentQuery) {
        messages.push(message);
      }

      // Extract JSON from response
      const text = extractTextFromMessages(messages);
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        console.warn('[correlation-analyzer] No JSON in LLM response, using fallback');
        return {
          result: computeBasicCorrelation(input.callsites, input.runtimeSummary),
          toolsUsed,
        };
      }

      const parsed = JSON.parse(jsonMatch[0]) as LLMCorrelationResult;

      // Convert drift signals to our format
      // Map LLM types to DriftSignal types
      const mapDriftType = (t: string): DriftSignal['type'] => {
        if (t === 'codeOnly') return 'codeOnly';
        if (t === 'runtimeOnly') return 'runtimeOnly';
        if (t === 'patternMismatch' || t === 'patternDrift') return 'patternDrift';
        // modelMismatch, providerMismatch -> mismatch
        return 'mismatch';
      };

      // Limit drift signals to max 15 as per template constraint
      // Sort by severity (critical > warning > info) and limit to 15
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      const allDriftSignals = (parsed.drift_signals || [])
        .map(ds => ({
          driftSignal: {
            type: mapDriftType(ds.type),
            provider: ds.code_details?.provider || ds.runtime_details?.provider,
            model: ds.code_details?.model || ds.runtime_details?.model,
            callsiteId: ds.code_location ? ds.code_location.split(':')[0] : undefined,
            message: ds.evidence,
          } as DriftSignal,
          severity: ds.severity,
        }))
        .sort((a, b) => (severityOrder[a.severity as keyof typeof severityOrder] ?? 3) - (severityOrder[b.severity as keyof typeof severityOrder] ?? 3))
        .slice(0, 15);
      
      const driftSignals: DriftSignal[] = allDriftSignals.map(item => item.driftSignal);

      // Convert to insights
      const insights: Insight[] = (parsed.drift_signals || []).map((ds, idx) => ({
        id: `correlation_${Date.now()}_${idx}`,
        severity: ds.severity,
        category: 'drift' as const,
        headline: `${ds.type}: ${ds.evidence.substring(0, 50)}...`,
        evidence: ds.evidence,
        location: ds.code_location || undefined,
        recommendation: ds.recommendation,
        source: 'llm' as const,
        impact: {
          layer: 'application' as const,
          impactType: 'cost' as const,
          estimatedImpactPercent: ds.severity === 'critical' ? 30 : ds.severity === 'warning' ? 15 : 5,
          effort: 'low' as const,
          confidence: 0.7,
        } as ImpactEstimate,
      }));

      return {
        result: {
          insights,
          driftSignals,
          correlationSummary: {
            totalCodeCallsites: parsed.correlation_summary?.total_code_callsites || input.callsites.length,
            totalRuntimeModels: parsed.correlation_summary?.total_runtime_models || Object.keys(input.runtimeSummary.byModel).length,
            matched: parsed.correlation_summary?.matched || 0,
            codeOnly: parsed.correlation_summary?.code_only || 0,
            runtimeOnly: parsed.correlation_summary?.runtime_only || 0,
            mismatched: parsed.correlation_summary?.mismatched || 0,
          },
          alignmentScore: parsed.alignment_score || 0.5,
          overallAssessment: parsed.overall_assessment || 'Analysis completed.',
        },
        toolsUsed,
      };
    } catch (error) {
      console.warn('[correlation-analyzer] LLM analysis failed:', error);
      return {
        result: computeBasicCorrelation(input.callsites, input.runtimeSummary),
        toolsUsed,
      };
    }
  },
};

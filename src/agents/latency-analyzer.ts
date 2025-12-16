/**
 * Latency Analyzer Agent
 * Analyzes latency profile for each LLM inference point
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import { join } from 'path';
import YAML from 'yaml';
import { InferencePoint } from './callsite-finder.js';

// Types
export interface LatencyOptimization {
  type: 'add_streaming' | 'parallelize' | 'add_async' | 'add_timeout' | 'reduce_chain';
  description: string;
  current_latency: string;
  optimized_latency: string;
  improvement_percent: number;
  effort: 'low' | 'medium' | 'high';
  sample_change: string | null;
}

export interface LatencyProfile {
  inference_point_id: string;
  line: number;
  blocking_analysis: {
    is_blocking: boolean;
    is_in_request_handler: boolean;
    blocks_event_loop: boolean;
    handler_type: 'http' | 'websocket' | 'grpc' | 'background' | 'cli' | 'unknown';
    user_facing: boolean;
  };
  streaming_analysis: {
    streaming_enabled: boolean;
    should_enable_streaming: boolean;
    reason: string;
    time_to_first_token_benefit: string | null;
  };
  async_analysis: {
    is_async: boolean;
    uses_await: boolean;
    could_be_async: boolean;
    async_benefit: string | null;
  };
  parallel_analysis: {
    has_parallel_potential: boolean;
    independent_calls: number;
    current_pattern: 'sequential' | 'parallel' | 'mixed';
    parallelizable_calls: { line: number; reason: string }[];
    parallel_speedup_estimate: string | null;
  };
  chain_analysis: {
    chain_depth: number;
    sequential_calls: number;
    total_latency_estimate: {
      min_ms: number;
      typical_ms: number;
      max_ms: number;
    };
    chain_pattern: 'single' | 'pipeline' | 'loop' | 'recursive' | 'agent';
  };
  timeout_analysis: {
    timeout_configured: boolean;
    timeout_value_ms: number | null;
    has_fallback_on_timeout: boolean;
    timeout_risk: 'none' | 'low' | 'medium' | 'high';
  };
  latency_risk: {
    level: 'low' | 'medium' | 'high' | 'critical';
    factors: string[];
    tail_latency_risk: boolean;
    unpredictable: boolean;
  };
  latency_estimate: {
    min_ms: number;
    typical_ms: number;
    p95_ms: number;
    max_ms: number;
    basis: string;
  };
  optimizations: LatencyOptimization[];
  confidence: number;
}

export interface LatencyAnalyzerOutput {
  latency_profiles: LatencyProfile[];
  summary: {
    total_inference_points: number;
    blocking_calls: number;
    streaming_enabled: number;
    parallelizable: number;
    estimated_p95_ms: number;
  };
}

export interface LatencyAnalyzerInput {
  inference_points: InferencePoint[];
  code_contexts: Map<string, string>;
  file_path: string;
  is_async_file: boolean;
}

// Model latency estimates (ms)
const MODEL_LATENCY: Record<string, { min: number; typical: number; p95: number; max: number }> = {
  'gpt-4o': { min: 500, typical: 1500, p95: 3000, max: 10000 },
  'gpt-4o-mini': { min: 200, typical: 500, p95: 1000, max: 3000 },
  'gpt-4-turbo': { min: 1000, typical: 3000, p95: 8000, max: 30000 },
  'gpt-4': { min: 2000, typical: 5000, p95: 15000, max: 60000 },
  'gpt-3.5-turbo': { min: 200, typical: 500, p95: 1500, max: 5000 },
  'claude-3-opus': { min: 2000, typical: 5000, p95: 15000, max: 60000 },
  'claude-3-sonnet': { min: 500, typical: 1500, p95: 4000, max: 15000 },
  'claude-3-haiku': { min: 200, typical: 500, p95: 1500, max: 5000 },
  'default': { min: 500, typical: 2000, p95: 5000, max: 15000 },
};

// Ensure model is a valid string
function normalizeModelString(model: unknown): string {
  if (typeof model === 'string') return model;
  if (model === null || model === undefined) return 'default';
  if (typeof model === 'object' && model !== null) {
    const obj = model as Record<string, unknown>;
    if (typeof obj.name === 'string') return obj.name;
    if (typeof obj.value === 'string') return obj.value;
  }
  return String(model) || 'default';
}

function getModelLatency(model: unknown): { min: number; typical: number; p95: number; max: number } {
  const normalizedModel = normalizeModelString(model).toLowerCase();
  for (const [key, latency] of Object.entries(MODEL_LATENCY)) {
    if (normalizedModel.includes(key)) {
      return latency;
    }
  }
  return MODEL_LATENCY['default'];
}

// Load prompt template
function loadPromptTemplate(): string {
  const promptPath = join(process.cwd(), 'prompts', 'latency-analyzer.yaml');
  const promptContent = readFileSync(promptPath, 'utf-8');
  const prompt = YAML.parse(promptContent);
  return prompt.system;
}

// Fallback analysis
function fallbackAnalysis(input: LatencyAnalyzerInput): LatencyAnalyzerOutput {
  const latencyProfiles: LatencyProfile[] = [];

  for (const point of input.inference_points) {
    const codeContext = input.code_contexts.get(point.id) || '';
    const model = normalizeModelString(point.model?.value);
    const baseLatency = getModelLatency(model);

    // Analyze blocking behavior
    const isInHandler = /(@app\.|@router\.|def\s+(get|post|put|delete|handler)|async\s+def\s+\w+.*request)/i.test(codeContext);
    const isAsync = point.is_async || /async\s+def|await\s/.test(codeContext);
    const isBlocking = !isAsync && isInHandler;

    // Analyze streaming
    const hasStreaming = /stream\s*[=:]\s*true|\.stream\(|streaming/i.test(codeContext);
    const shouldStream = isInHandler && !hasStreaming;

    // Analyze parallel potential
    const multipleCallsInScope = (codeContext.match(/\.(create|invoke|complete|chat)\s*\(/g) || []).length;
    const hasParallelPotential = multipleCallsInScope > 1 && !point.in_loop;

    // Analyze timeout
    const hasTimeout = /timeout\s*[=:]/i.test(codeContext);
    const timeoutMatch = codeContext.match(/timeout\s*[=:]\s*(\d+)/i);
    const timeoutValue = timeoutMatch ? parseInt(timeoutMatch[1]) * 1000 : null;

    // Determine chain depth
    let chainDepth = 1;
    if (point.in_loop) {
      chainDepth = point.loop_type === 'recursive' ? 5 : 3;
    }

    // Calculate latency estimates
    const latencyMultiplier = chainDepth;
    const latencyEstimate = {
      min_ms: baseLatency.min * latencyMultiplier,
      typical_ms: baseLatency.typical * latencyMultiplier,
      p95_ms: baseLatency.p95 * latencyMultiplier,
      max_ms: baseLatency.max * latencyMultiplier,
      basis: `${model} base latency × ${latencyMultiplier} (chain depth)`,
    };

    // Assess latency risk
    const riskFactors: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';

    if (isBlocking && isInHandler) {
      riskFactors.push('Blocking call in request handler');
      riskLevel = 'high';
    }
    if (!hasStreaming && isInHandler) {
      riskFactors.push('No streaming in user-facing context');
      riskLevel = riskLevel === 'high' ? 'critical' : 'medium';
    }
    if (!hasTimeout) {
      riskFactors.push('No timeout configured');
    }
    if (chainDepth > 1) {
      riskFactors.push(`Chain depth of ${chainDepth}`);
    }

    // Generate optimizations
    const optimizations: LatencyOptimization[] = [];

    if (!hasStreaming && isInHandler) {
      optimizations.push({
        type: 'add_streaming',
        description: 'Enable streaming to reduce time-to-first-token',
        current_latency: `${latencyEstimate.typical_ms}ms wait`,
        optimized_latency: '~200ms to first token',
        improvement_percent: 80,
        effort: 'low',
        sample_change: 'stream=True',
      });
    }

    if (hasParallelPotential) {
      optimizations.push({
        type: 'parallelize',
        description: `Parallelize ${multipleCallsInScope} independent LLM calls`,
        current_latency: `${latencyEstimate.typical_ms * multipleCallsInScope}ms sequential`,
        optimized_latency: `${latencyEstimate.typical_ms}ms parallel`,
        improvement_percent: Math.round((1 - 1 / multipleCallsInScope) * 100),
        effort: 'medium',
        sample_change: 'await asyncio.gather(*calls)',
      });
    }

    if (!hasTimeout) {
      optimizations.push({
        type: 'add_timeout',
        description: 'Add timeout to prevent hung requests',
        current_latency: 'Unbounded',
        optimized_latency: `Max ${baseLatency.p95}ms`,
        improvement_percent: 0,
        effort: 'low',
        sample_change: `timeout=${Math.round(baseLatency.p95 / 1000)}`,
      });
    }

    latencyProfiles.push({
      inference_point_id: point.id,
      line: point.line,
      blocking_analysis: {
        is_blocking: isBlocking,
        is_in_request_handler: isInHandler,
        blocks_event_loop: isBlocking,
        handler_type: isInHandler ? 'http' : 'unknown',
        user_facing: isInHandler,
      },
      streaming_analysis: {
        streaming_enabled: hasStreaming,
        should_enable_streaming: shouldStream,
        reason: shouldStream ? 'User-facing endpoint without streaming' : 'Streaming status appropriate',
        time_to_first_token_benefit: shouldStream ? '~200ms vs full wait' : null,
      },
      async_analysis: {
        is_async: isAsync,
        uses_await: /await\s/.test(codeContext),
        could_be_async: !isAsync && input.is_async_file,
        async_benefit: !isAsync && input.is_async_file ? 'Enable concurrency' : null,
      },
      parallel_analysis: {
        has_parallel_potential: hasParallelPotential,
        independent_calls: hasParallelPotential ? multipleCallsInScope : 0,
        current_pattern: hasParallelPotential ? 'sequential' : 'sequential',
        parallelizable_calls: [],
        parallel_speedup_estimate: hasParallelPotential ? `${multipleCallsInScope}x faster` : null,
      },
      chain_analysis: {
        chain_depth: chainDepth,
        sequential_calls: chainDepth,
        total_latency_estimate: {
          min_ms: latencyEstimate.min_ms,
          typical_ms: latencyEstimate.typical_ms,
          max_ms: latencyEstimate.max_ms,
        },
        chain_pattern: chainDepth > 1 ? 'pipeline' : 'single',
      },
      timeout_analysis: {
        timeout_configured: hasTimeout,
        timeout_value_ms: timeoutValue,
        has_fallback_on_timeout: /except.*timeout/i.test(codeContext),
        timeout_risk: hasTimeout ? 'low' : 'high',
      },
      latency_risk: {
        level: riskLevel,
        factors: riskFactors,
        tail_latency_risk: !hasTimeout,
        unpredictable: chainDepth > 1 || point.loop_type === 'recursive',
      },
      latency_estimate: latencyEstimate,
      optimizations,
      confidence: 0.7,
    });
  }

  const maxP95 = Math.max(...latencyProfiles.map(p => p.latency_estimate.p95_ms), 0);

  return {
    latency_profiles: latencyProfiles,
    summary: {
      total_inference_points: latencyProfiles.length,
      blocking_calls: latencyProfiles.filter(p => p.blocking_analysis.is_blocking).length,
      streaming_enabled: latencyProfiles.filter(p => p.streaming_analysis.streaming_enabled).length,
      parallelizable: latencyProfiles.filter(p => p.parallel_analysis.has_parallel_potential).length,
      estimated_p95_ms: maxP95,
    },
  };
}

// Main agent function - uses batch processing for efficiency
export async function analyzeLatency(input: LatencyAnalyzerInput): Promise<LatencyAnalyzerOutput> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey || input.inference_points.length === 0) {
    return fallbackAnalysis(input);
  }

  const client = new Anthropic({ apiKey });
  const systemPrompt = loadPromptTemplate();

  // Build batch request with all inference points
  const pointsData = input.inference_points.map((point, idx) => {
    const codeContext = input.code_contexts.get(point.id) || '';
    return `
## Inference Point ${idx + 1} (ID: ${point.id})
- File: ${input.file_path}
- Line: ${point.line}
- Provider: ${point.provider.value}
- Model: ${point.model.value || 'unknown'}
- Is Async File: ${input.is_async_file}

Code Context:
\`\`\`
${codeContext}
\`\`\``;
  }).join('\n\n');

  const userMessage = `Analyze the latency profile for these ${input.inference_points.length} LLM inference points:

${pointsData}

Return a JSON array of latency_profile objects, one for each inference point in order.
Format: { "latency_profiles": [ {...}, {...}, ... ] }`;

  let profiles: LatencyProfile[] = [];

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const content = response.content[0];
    if (content.type === 'text') {
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const profilesArray = parsed.latency_profiles || parsed.profiles || (Array.isArray(parsed) ? parsed : [parsed]);

        if (Array.isArray(profilesArray)) {
          for (let i = 0; i < input.inference_points.length; i++) {
            const profile = profilesArray[i];
            if (profile?.latency_estimate?.p95_ms !== undefined) {
              profile.inference_point_id = input.inference_points[i].id;
              profile.line = input.inference_points[i].line;
              profiles.push(profile as LatencyProfile);
            } else {
              const fallback = fallbackAnalysis({ ...input, inference_points: [input.inference_points[i]] });
              profiles.push(...fallback.latency_profiles);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error(`Latency analysis batch error:`, error);
  }

  // If batch failed or incomplete, use fallback for remaining points
  if (profiles.length < input.inference_points.length) {
    const analyzedIds = new Set(profiles.map(p => p.inference_point_id));
    const missingPoints = input.inference_points.filter(p => !analyzedIds.has(p.id));
    if (missingPoints.length > 0) {
      const fallback = fallbackAnalysis({ ...input, inference_points: missingPoints });
      profiles.push(...fallback.latency_profiles);
    }
  }

  const maxP95 = Math.max(...profiles.map(p => p.latency_estimate?.p95_ms ?? 0), 0);

  return {
    latency_profiles: profiles,
    summary: {
      total_inference_points: profiles.length,
      blocking_calls: profiles.filter(p => p.blocking_analysis?.is_blocking).length,
      streaming_enabled: profiles.filter(p => p.streaming_analysis?.streaming_enabled).length,
      parallelizable: profiles.filter(p => p.parallel_analysis?.has_parallel_potential).length,
      estimated_p95_ms: maxP95,
    },
  };
}

export class LatencyAnalyzerAgent {
  name = 'LatencyAnalyzerAgent';
  description = 'Analyzes latency profile for each LLM inference point';

  async execute(input: LatencyAnalyzerInput): Promise<LatencyAnalyzerOutput> {
    return analyzeLatency(input);
  }
}

/**
 * Throughput Analyzer Agent
 * Analyzes throughput constraints and scaling potential for LLM inference
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import { join } from 'path';
import YAML from 'yaml';
import { InferencePoint } from './callsite-finder.js';

// Types
export interface ThroughputOptimization {
  type: 'add_rate_limiter' | 'add_batching' | 'add_queue' | 'fix_bottleneck' | 'increase_concurrency';
  description: string;
  current_throughput: string;
  optimized_throughput: string;
  improvement: string;
  effort: 'low' | 'medium' | 'high';
  sample_change: string | null;
}

export interface ScalingBottleneck {
  type: 'shared_state' | 'global_client' | 'file_lock' | 'db_connection' | 'memory';
  location: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

export interface ThroughputProfile {
  inference_point_id: string;
  line: number;
  concurrency_analysis: {
    concurrency_limit: number | null;
    limit_source: 'semaphore' | 'pool' | 'rate_limiter' | 'none' | 'unknown';
    limit_location: string | null;
    is_global_limit: boolean;
    recommended_limit: number | null;
  };
  rate_limiting: {
    has_rate_limiter: boolean;
    rate_limit_type: 'token_bucket' | 'sliding_window' | 'fixed_window' | 'none';
    requests_per_minute: number | null;
    handles_429: boolean;
    backoff_strategy: 'none' | 'fixed' | 'exponential' | 'custom';
  };
  batching_analysis: {
    batching_enabled: boolean;
    batch_size: number | null;
    could_batch: boolean;
    batching_benefit: string | null;
    batch_api_available: boolean;
  };
  queue_analysis: {
    uses_queue: boolean;
    queue_type: 'celery' | 'rq' | 'bull' | 'sqs' | 'redis' | 'none';
    async_processing: boolean;
    worker_pattern: boolean;
  };
  scaling_analysis: {
    horizontally_scalable: boolean;
    bottlenecks: ScalingBottleneck[];
    stateless: boolean;
    client_reuse: boolean;
  };
  capacity_estimate: {
    max_concurrent_calls: number | null;
    estimated_rps: number | null;
    limiting_factor: string;
  };
  throughput_risk: {
    level: 'low' | 'medium' | 'high' | 'critical';
    factors: string[];
    will_hit_rate_limits: boolean;
    scaling_blocked: boolean;
  };
  optimizations: ThroughputOptimization[];
  confidence: number;
}

export interface ThroughputAnalyzerOutput {
  throughput_profiles: ThroughputProfile[];
  summary: {
    total_inference_points: number;
    has_rate_limiting: number;
    has_batching: number;
    scaling_bottlenecks: number;
    estimated_max_rps: number | null;
  };
}

export interface ThroughputAnalyzerInput {
  inference_points: InferencePoint[];
  code_contexts: Map<string, string>;
  file_imports: string;
  file_path: string;
}

// Load prompt template
function loadPromptTemplate(): string {
  const promptPath = join(process.cwd(), 'prompts', 'throughput-analyzer.yaml');
  const promptContent = readFileSync(promptPath, 'utf-8');
  const prompt = YAML.parse(promptContent);
  return prompt.system;
}

// Fallback analysis
function fallbackAnalysis(input: ThroughputAnalyzerInput): ThroughputAnalyzerOutput {
  const throughputProfiles: ThroughputProfile[] = [];

  for (const point of input.inference_points) {
    const codeContext = input.code_contexts.get(point.id) || '';

    // Analyze concurrency patterns
    const hasSemaphore = /semaphore|asyncio\.Semaphore|Semaphore\s*\(/i.test(codeContext);
    const hasPool = /pool|ThreadPool|ProcessPool/i.test(codeContext);
    const semaphoreMatch = codeContext.match(/Semaphore\s*\(\s*(\d+)/i);
    const concurrencyLimit = semaphoreMatch ? parseInt(semaphoreMatch[1]) : null;

    // Analyze rate limiting
    const hasRateLimiter = /rate.?limit|ratelimit|throttle|limiter/i.test(codeContext);
    const handles429 = /429|rate.?limit|retry|too.?many/i.test(codeContext);
    const hasBackoff = /backoff|exponential|retry/i.test(codeContext);

    // Analyze batching
    const hasBatching = /batch|bulk|\.batch\(|batch_size/i.test(codeContext);
    const batchMatch = codeContext.match(/batch_size\s*[=:]\s*(\d+)/i);
    const batchSize = batchMatch ? parseInt(batchMatch[1]) : null;
    const couldBatch = point.in_loop && !hasBatching;

    // Analyze queue usage
    const hasCelery = /celery|@task|@shared_task/i.test(codeContext) || /celery/i.test(input.file_imports);
    const hasRQ = /rq|redis.?queue/i.test(codeContext) || /rq/i.test(input.file_imports);
    const hasBull = /bull|bullmq/i.test(codeContext) || /bull/i.test(input.file_imports);
    const hasSQS = /sqs|boto.*queue/i.test(codeContext);
    const usesQueue = hasCelery || hasRQ || hasBull || hasSQS;

    let queueType: 'celery' | 'rq' | 'bull' | 'sqs' | 'redis' | 'none' = 'none';
    if (hasCelery) queueType = 'celery';
    else if (hasRQ) queueType = 'rq';
    else if (hasBull) queueType = 'bull';
    else if (hasSQS) queueType = 'sqs';

    // Analyze scaling bottlenecks
    const bottlenecks: ScalingBottleneck[] = [];

    // Check for global state
    if (/^[A-Z_]+\s*=.*client|^client\s*=/m.test(codeContext)) {
      bottlenecks.push({
        type: 'global_client',
        location: `${input.file_path}:${point.line}`,
        description: 'Global client instance may limit horizontal scaling',
        severity: 'medium',
      });
    }

    // Check for file operations
    if (/open\s*\(|write|file/i.test(codeContext)) {
      bottlenecks.push({
        type: 'file_lock',
        location: `${input.file_path}:${point.line}`,
        description: 'File operations may cause contention',
        severity: 'low',
      });
    }

    // Check for shared state
    if (/global\s|\.shared|singleton/i.test(codeContext)) {
      bottlenecks.push({
        type: 'shared_state',
        location: `${input.file_path}:${point.line}`,
        description: 'Shared state detected',
        severity: 'high',
      });
    }

    const isStateless = bottlenecks.length === 0;
    const isHorizontallyScalable = isStateless && !(/session|state|memory/i.test(codeContext));

    // Estimate capacity
    const baseRPM = hasRateLimiter ? 500 : 1000; // Conservative estimate
    const estimatedRPS = Math.round(baseRPM / 60);
    const maxConcurrent = concurrencyLimit || 10;

    // Assess throughput risk
    const riskFactors: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';

    if (!hasRateLimiter) {
      riskFactors.push('No rate limiting');
      riskLevel = 'medium';
    }
    if (!handles429) {
      riskFactors.push('No 429 handling');
      riskLevel = riskLevel === 'medium' ? 'high' : 'medium';
    }
    if (bottlenecks.length > 0) {
      riskFactors.push(`${bottlenecks.length} scaling bottleneck(s)`);
    }
    if (couldBatch) {
      riskFactors.push('Loop without batching');
    }

    // Generate optimizations
    const optimizations: ThroughputOptimization[] = [];

    if (!hasRateLimiter) {
      optimizations.push({
        type: 'add_rate_limiter',
        description: 'Add rate limiting to prevent API quota exhaustion',
        current_throughput: 'Unbounded (risk of 429s)',
        optimized_throughput: 'Controlled rate',
        improvement: 'Prevents quota exhaustion',
        effort: 'low',
        sample_change: 'from ratelimit import limits\n@limits(calls=100, period=60)',
      });
    }

    if (couldBatch) {
      optimizations.push({
        type: 'add_batching',
        description: 'Batch multiple items in a single API call',
        current_throughput: '1 item/call',
        optimized_throughput: '10-100 items/call',
        improvement: '10-100x throughput',
        effort: 'medium',
        sample_change: null,
      });
    }

    if (!usesQueue && point.in_loop) {
      optimizations.push({
        type: 'add_queue',
        description: 'Use task queue for background processing',
        current_throughput: 'Synchronous',
        optimized_throughput: 'Async with workers',
        improvement: 'Horizontal scaling',
        effort: 'high',
        sample_change: null,
      });
    }

    throughputProfiles.push({
      inference_point_id: point.id,
      line: point.line,
      concurrency_analysis: {
        concurrency_limit: concurrencyLimit,
        limit_source: hasSemaphore ? 'semaphore' : hasPool ? 'pool' : 'none',
        limit_location: null,
        is_global_limit: false,
        recommended_limit: 10,
      },
      rate_limiting: {
        has_rate_limiter: hasRateLimiter,
        rate_limit_type: hasRateLimiter ? 'token_bucket' : 'none',
        requests_per_minute: hasRateLimiter ? 500 : null,
        handles_429: handles429,
        backoff_strategy: hasBackoff ? 'exponential' : 'none',
      },
      batching_analysis: {
        batching_enabled: hasBatching,
        batch_size: batchSize,
        could_batch: couldBatch,
        batching_benefit: couldBatch ? 'Reduce API calls by 10-100x' : null,
        batch_api_available: true,
      },
      queue_analysis: {
        uses_queue: usesQueue,
        queue_type: queueType,
        async_processing: usesQueue,
        worker_pattern: usesQueue,
      },
      scaling_analysis: {
        horizontally_scalable: isHorizontallyScalable,
        bottlenecks,
        stateless: isStateless,
        client_reuse: /client\s*=/.test(codeContext),
      },
      capacity_estimate: {
        max_concurrent_calls: maxConcurrent,
        estimated_rps: estimatedRPS,
        limiting_factor: hasRateLimiter ? 'Rate limiter' : bottlenecks.length > 0 ? 'Scaling bottleneck' : 'API quota',
      },
      throughput_risk: {
        level: riskLevel,
        factors: riskFactors,
        will_hit_rate_limits: !hasRateLimiter,
        scaling_blocked: bottlenecks.some(b => b.severity === 'high'),
      },
      optimizations,
      confidence: 0.7,
    });
  }

  const maxRPS = Math.max(...throughputProfiles.map(p => p.capacity_estimate.estimated_rps || 0), 0);

  return {
    throughput_profiles: throughputProfiles,
    summary: {
      total_inference_points: throughputProfiles.length,
      has_rate_limiting: throughputProfiles.filter(p => p.rate_limiting.has_rate_limiter).length,
      has_batching: throughputProfiles.filter(p => p.batching_analysis.batching_enabled).length,
      scaling_bottlenecks: throughputProfiles.reduce((sum, p) => sum + p.scaling_analysis.bottlenecks.length, 0),
      estimated_max_rps: maxRPS > 0 ? maxRPS : null,
    },
  };
}

// Main agent function - uses batch processing for efficiency
export async function analyzeThroughput(input: ThroughputAnalyzerInput): Promise<ThroughputAnalyzerOutput> {
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

Imports:
${input.file_imports}

Code Context:
\`\`\`
${codeContext}
\`\`\``;
  }).join('\n\n');

  const userMessage = `Analyze the throughput profile for these ${input.inference_points.length} LLM inference points:

${pointsData}

Return a JSON array of throughput_profile objects, one for each inference point in order.
Format: { "throughput_profiles": [ {...}, {...}, ... ] }`;

  let profiles: ThroughputProfile[] = [];

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
        const profilesArray = parsed.throughput_profiles || parsed.profiles || (Array.isArray(parsed) ? parsed : [parsed]);

        if (Array.isArray(profilesArray)) {
          for (let i = 0; i < input.inference_points.length; i++) {
            const profile = profilesArray[i];
            if (profile?.capacity_estimate !== undefined) {
              profile.inference_point_id = input.inference_points[i].id;
              profile.line = input.inference_points[i].line;
              profiles.push(profile as ThroughputProfile);
            } else {
              const fallback = fallbackAnalysis({ ...input, inference_points: [input.inference_points[i]] });
              profiles.push(...fallback.throughput_profiles);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error(`Throughput analysis batch error:`, error);
  }

  // If batch failed or incomplete, use fallback for remaining points
  if (profiles.length < input.inference_points.length) {
    const analyzedIds = new Set(profiles.map(p => p.inference_point_id));
    const missingPoints = input.inference_points.filter(p => !analyzedIds.has(p.id));
    if (missingPoints.length > 0) {
      const fallback = fallbackAnalysis({ ...input, inference_points: missingPoints });
      profiles.push(...fallback.throughput_profiles);
    }
  }

  const maxRPS = Math.max(...profiles.map(p => p.capacity_estimate?.estimated_rps ?? 0), 0);

  return {
    throughput_profiles: profiles,
    summary: {
      total_inference_points: profiles.length,
      has_rate_limiting: profiles.filter(p => p.rate_limiting?.has_rate_limiter).length,
      has_batching: profiles.filter(p => p.batching_analysis?.batching_enabled).length,
      scaling_bottlenecks: profiles.reduce((sum, p) => sum + (p.scaling_analysis?.bottlenecks?.length ?? 0), 0),
      estimated_max_rps: maxRPS > 0 ? maxRPS : null,
    },
  };
}

export class ThroughputAnalyzerAgent {
  name = 'ThroughputAnalyzerAgent';
  description = 'Analyzes throughput constraints and scaling potential for LLM inference';

  async execute(input: ThroughputAnalyzerInput): Promise<ThroughputAnalyzerOutput> {
    return analyzeThroughput(input);
  }
}

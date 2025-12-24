/**
 * Static Analysis Orchestrator
 * Runs unified multi-dimensional analysis for comprehensive static code analysis
 *
 * Uses Claude Agent SDK (per TDD v1.9.3) with optimized single-call approach:
 * one agent query per file analyzing all 4 dimensions (cost, latency, throughput, reliability)
 *
 * Architecture: Claude Agent SDK = Engine, TypeScript = Glue (per TDD §1)
 *
 * Prompts are loaded from YAML config files (prompts/*.yaml) for consistency
 * between CLI and API surfaces.
 *
 * SYNC NOTE: This file is SYNCED FROM peakinfer-site (private repo).
 * Source: peakinfer-site/lib/agents/static-orchestrator.ts
 * DO NOT modify directly - changes must be made in peakinfer-site first.
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import type {
  StaticAnalysisInput,
  StaticAnalysisOutput,
  PerformanceProfile,
  ImportAnalyzerOutput,
  CallSiteFinderOutput,
  InferencePoint,
  CostProfile,
  LatencyProfile,
  ThroughputProfile,
  ReliabilityProfile,
  Insight,
  Issue,
} from './analysis-types.js';

// Re-export types for consumers
export type { StaticAnalysisInput, StaticAnalysisOutput, PerformanceProfile };
import { getUnifiedAnalyzerPrompt, formatUserMessage } from './prompts/loader.js';

// =============================================================================
// LOAD PROMPT FROM CONFIG
// =============================================================================

// Always load fresh from YAML config (no caching for serverless)
function getPrompt(): { system: string; userTemplate: string } {
  return getUnifiedAnalyzerPrompt();
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Generate stable inference point ID using file:line format.
 * This ensures IDs are consistent across runs for the same code location.
 * Falls back to random ID only if no location info is available.
 */
function generatePointId(filePath?: string, line?: number): string {
  if (filePath && line) {
    // Use stable file:line format (PRD requirement for consistent IDs)
    return `${filePath}:${line}`;
  }
  // Fallback for rare cases where location is unknown
  return 'pt_' + Math.random().toString(36).substring(2, 10);
}

function detectLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const languageMap: Record<string, string> = {
    'py': 'python',
    'js': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'jsx': 'javascript',
    'go': 'go',
    'rs': 'rust',
    'java': 'java',
    'rb': 'ruby',
    'php': 'php',
  };
  return languageMap[ext] || 'unknown';
}

// =============================================================================
// UNIFIED ANALYSIS RESULT TYPES
// =============================================================================

interface UnifiedIssue {
  type: string;
  severity: string;
  headline: string;
  evidence: string;
  original_code: string;
  suggested_fix: string | null;
  ai_agent_prompt: string;
}

interface UnifiedAnalysisResult {
  inference_points: Array<{
    id: string;
    line: number;
    provider: string;
    model: string | null;
    call_type: string;
    original_code?: string;
    cost_profile: {
      tier: string;
      estimated_cost_per_call: number;
      optimizations: Array<{ type: string; description: string; savings_percent: number }>;
    };
    latency_profile: {
      estimated_p95_ms: number;
      is_blocking: boolean;
      has_streaming: boolean;
      optimizations: Array<{ type: string; description: string; improvement_percent: number }>;
    };
    throughput_profile: {
      has_rate_limiting: boolean;
      has_batching: boolean;
      bottlenecks: Array<{ type: string; description: string }>;
      optimizations: Array<{ type: string; description: string; improvement: string }>;
    };
    reliability_profile: {
      has_error_handling: boolean;
      has_retry: boolean;
      has_timeout: boolean;
      has_fallback: boolean;
      anti_patterns: Array<{ type: string; description: string }>;
      optimizations: Array<{ type: string; description: string; priority: string }>;
    };
    issues?: UnifiedIssue[];
  }>;
  imports: {
    llm_providers: string[];
    frameworks: string[];
  };
  insights?: Array<{
    severity: string;
    category: string;
    headline: string;
    evidence: string;
    recommendation?: string;
  }>;
}

// =============================================================================
// UNIFIED SINGLE-CALL ANALYSIS (Claude Agent SDK)
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

async function runUnifiedAnalysis(
  filePath: string,
  content: string,
  language: string,
  _anthropicKey: string // Kept for signature compatibility, SDK uses env var
): Promise<UnifiedAnalysisResult | null> {
  // Load prompt from config file
  const configPrompt = getPrompt();

  // Format user message using template from config
  const userMessage = configPrompt.userTemplate
    ? formatUserMessage(configPrompt.userTemplate, {
        language,
        file_path: filePath,
        content,
      })
    : `Analyze this ${language} file for LLM inference points and their performance characteristics:

File: ${filePath}

\`\`\`${language}
${content}
\`\`\`

Find all LLM API calls (Anthropic Claude, Claude Agent SDK, self-hosted like TensorRT-LLM, vLLM, Triton, HTTP calls to inference endpoints, etc.) and analyze each one.`;

  try {
    // Use Claude Agent SDK query() function (per TDD v1.9.3)
    const agentQuery = query({
      prompt: userMessage,
      options: {
        systemPrompt: configPrompt.system,
        model: 'claude-sonnet-4-20250514',
        // Disable tools - we just want analysis output
        tools: [],
        // Use plan mode to avoid file operations
        permissionMode: 'plan',
        // Set working directory
        cwd: process.cwd(),
      },
    });

    // Collect all messages from the async generator
    const messages: SDKMessage[] = [];
    for await (const message of agentQuery) {
      messages.push(message);
    }

    // Extract text content from messages
    const responseText = extractTextFromMessages(messages);

    if (responseText) {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        // Ensure IDs are set using stable file:line format
        if (parsed.inference_points) {
          for (const point of parsed.inference_points) {
            if (!point.id) {
              point.id = generatePointId(filePath, point.line);
            }
          }
        }
        return parsed as UnifiedAnalysisResult;
      }
    }
  } catch (error) {
    console.error('Claude Agent SDK analysis error:', error);
  }

  return null;
}

// =============================================================================
// CONVERT UNIFIED TO LEGACY FORMAT
// =============================================================================

function convertUnifiedToLegacy(
  unified: UnifiedAnalysisResult,
  filePath: string
): {
  imports: ImportAnalyzerOutput;
  callsites: CallSiteFinderOutput;
  costProfiles: CostProfile[];
  latencyProfiles: LatencyProfile[];
  throughputProfiles: ThroughputProfile[];
  reliabilityProfiles: ReliabilityProfile[];
  insights: Insight[];
} {
  const providers = unified.imports?.llm_providers || [];
  const frameworks = unified.imports?.frameworks || [];

  const imports: ImportAnalyzerOutput = {
    sdks: providers.map((p, i) => ({
      name: p,
      provider: p,
      import_line: i + 1,
      alias: null,
      confidence: 0.9,
    })),
    frameworks: frameworks.map((f, i) => ({
      name: f,
      import_line: i + 1,
      components: [],
      confidence: 0.9,
    })),
    custom_wrappers: [],
    infrastructure: [],
    summary: {
      has_llm_usage: providers.length > 0 || frameworks.length > 0,
      primary_provider: providers[0] || null,
      framework: frameworks[0] || null,
      complexity: providers.length > 1 ? 'complex' : providers.length > 0 ? 'moderate' : 'simple',
    },
  };

  const inferencePoints: InferencePoint[] = unified.inference_points.map(p => ({
    id: p.id,
    line: p.line,
    column: 0,
    function_context: '',
    class_context: null,
    call_expression: '',
    call_type: (p.call_type || 'direct') as 'direct' | 'wrapper' | 'framework' | 'http',
    provider: { value: p.provider, source: 'hardcoded' as const, confidence: 0.9 },
    model: { value: p.model, source: 'hardcoded' as const, confidence: 0.8 },
    is_async: false,
    in_loop: false,
    loop_type: 'none' as const,
    estimated_calls: 'single' as const,
    needs_tracing: false,
    confidence: 0.85,
  }));

  const callsites: CallSiteFinderOutput = {
    inference_points: inferencePoints,
    wrapper_definitions: [],
    summary: {
      total_inference_points: inferencePoints.length,
      direct_calls: inferencePoints.filter(p => p.call_type === 'direct').length,
      wrapped_calls: inferencePoints.filter(p => p.call_type === 'wrapper').length,
      framework_calls: inferencePoints.filter(p => p.call_type === 'framework').length,
      providers_detected: [...new Set(inferencePoints.map(p => p.provider.value))],
      models_detected: [...new Set(inferencePoints.map(p => p.model.value).filter(Boolean))] as string[],
      has_dynamic_routing: false,
    },
  };

  const costProfiles: CostProfile[] = unified.inference_points.map(p => ({
    inference_point_id: p.id,
    line: p.line,
    model_analysis: {
      model: p.model || 'unknown',
      tier: (p.cost_profile?.tier || 'unknown') as 'premium' | 'standard' | 'budget' | 'unknown',
      pricing: { input_per_1m: 0, output_per_1m: 0 },
      is_overqualified: false,
      reason: null,
    },
    token_estimates: {
      input: { min: 100, typical: 500, max: 2000, basis: 'estimate' },
      output: { min: 50, typical: 200, max: 1000, basis: 'estimate' },
      has_few_shot: false,
      few_shot_tokens: 0,
      has_rag_context: false,
      rag_context_estimate: 0,
    },
    call_frequency: { pattern: 'single' as const, multiplier: 1, loop_bound: 'bounded' as const, estimated_calls_per_invocation: 1 },
    cost_estimate: {
      per_call_min: p.cost_profile?.estimated_cost_per_call || 0,
      per_call_typical: p.cost_profile?.estimated_cost_per_call || 0,
      per_call_max: p.cost_profile?.estimated_cost_per_call || 0,
      currency: 'USD',
    },
    cost_risk: { level: 'low', factors: [], unbounded_growth: false, context_accumulation: false },
    optimizations: (p.cost_profile?.optimizations || []).map(o => ({
      type: o.type as CostProfile['optimizations'][0]['type'],
      description: o.description,
      current_cost: '',
      optimized_cost: '',
      savings_percent: o.savings_percent,
      effort: 'medium' as const,
      sample_change: null,
    })),
    confidence: 0.85,
  }));

  const latencyProfiles: LatencyProfile[] = unified.inference_points.map(p => ({
    inference_point_id: p.id,
    line: p.line,
    blocking_analysis: {
      is_blocking: p.latency_profile?.is_blocking || false,
      is_in_request_handler: false,
      blocks_event_loop: p.latency_profile?.is_blocking || false,
      handler_type: 'unknown' as const,
      user_facing: false,
    },
    streaming_analysis: {
      streaming_enabled: p.latency_profile?.has_streaming || false,
      should_enable_streaming: !p.latency_profile?.has_streaming,
      reason: p.latency_profile?.has_streaming ? 'Streaming already enabled' : 'Enable streaming for better UX',
      time_to_first_token_benefit: !p.latency_profile?.has_streaming ? '~200ms vs full wait' : null,
    },
    async_analysis: {
      is_async: false,
      uses_await: false,
      could_be_async: true,
      async_benefit: 'Enable concurrency',
    },
    parallel_analysis: {
      has_parallel_potential: false,
      independent_calls: 0,
      current_pattern: 'sequential' as const,
      parallelizable_calls: [],
      parallel_speedup_estimate: null,
    },
    chain_analysis: {
      chain_depth: 1,
      sequential_calls: 1,
      total_latency_estimate: { min_ms: 500, typical_ms: 2000, max_ms: 5000 },
      chain_pattern: 'single' as const,
    },
    timeout_analysis: {
      timeout_configured: p.reliability_profile?.has_timeout || false,
      timeout_value_ms: null,
      has_fallback_on_timeout: false,
      timeout_risk: p.reliability_profile?.has_timeout ? 'low' : 'high',
    },
    latency_risk: { level: 'medium', factors: [], tail_latency_risk: true, unpredictable: false },
    latency_estimate: {
      min_ms: 500,
      typical_ms: 2000,
      p95_ms: p.latency_profile?.estimated_p95_ms || 5000,
      max_ms: 15000,
      basis: 'Model estimate',
    },
    optimizations: (p.latency_profile?.optimizations || []).map(o => ({
      type: o.type as LatencyProfile['optimizations'][0]['type'],
      description: o.description,
      current_latency: '',
      optimized_latency: '',
      improvement_percent: o.improvement_percent,
      effort: 'medium' as const,
      sample_change: null,
    })),
    confidence: 0.85,
  }));

  const throughputProfiles: ThroughputProfile[] = unified.inference_points.map(p => ({
    inference_point_id: p.id,
    line: p.line,
    concurrency_analysis: {
      concurrency_limit: null,
      limit_source: 'none' as const,
      limit_location: null,
      is_global_limit: false,
      recommended_limit: 10,
    },
    rate_limiting: {
      has_rate_limiter: p.throughput_profile?.has_rate_limiting || false,
      rate_limit_type: 'none' as const,
      requests_per_minute: null,
      handles_429: false,
      backoff_strategy: 'none' as const,
    },
    batching_analysis: {
      batching_enabled: p.throughput_profile?.has_batching || false,
      batch_size: null,
      could_batch: !p.throughput_profile?.has_batching,
      batching_benefit: 'Reduce API calls',
      batch_api_available: true,
    },
    queue_analysis: { uses_queue: false, queue_type: 'none' as const, async_processing: false, worker_pattern: false },
    scaling_analysis: {
      horizontally_scalable: true,
      bottlenecks: (p.throughput_profile?.bottlenecks || []).map(b => ({
        type: 'shared_state' as const,
        location: filePath,
        description: b.description,
        severity: 'medium' as const,
      })),
      stateless: true,
      client_reuse: false,
    },
    capacity_estimate: { max_concurrent_calls: 10, estimated_rps: 10, limiting_factor: 'API quota' },
    throughput_risk: {
      level: 'medium',
      factors: [],
      will_hit_rate_limits: !p.throughput_profile?.has_rate_limiting,
      scaling_blocked: false,
    },
    optimizations: (p.throughput_profile?.optimizations || []).map(o => ({
      type: o.type as ThroughputProfile['optimizations'][0]['type'],
      description: o.description,
      current_throughput: '',
      optimized_throughput: '',
      improvement: o.improvement,
      effort: 'medium' as const,
      sample_change: null,
    })),
    confidence: 0.85,
  }));

  const reliabilityProfiles: ReliabilityProfile[] = unified.inference_points.map(p => ({
    inference_point_id: p.id,
    line: p.line,
    error_handling: {
      has_try_catch: p.reliability_profile?.has_error_handling || false,
      caught_exceptions: [],
      specific_llm_errors: false,
      error_logged: false,
      error_propagated: false,
      silent_failure: false,
      user_friendly_error: false,
    },
    retry_strategy: {
      has_retry: p.reliability_profile?.has_retry || false,
      retry_library: 'none' as const,
      max_retries: null,
      backoff_type: 'none' as const,
      initial_delay_ms: null,
      max_delay_ms: null,
      retry_on: [],
      jitter: false,
      retry_budget_risk: 'none' as const,
    },
    fallback_strategy: {
      has_fallback: p.reliability_profile?.has_fallback || false,
      fallback_type: 'none' as const,
      fallback_model: null,
      fallback_provider: null,
      graceful_degradation: false,
      fallback_tested: 'unknown' as const,
    },
    timeout_handling: {
      timeout_configured: p.reliability_profile?.has_timeout || false,
      timeout_ms: null,
      timeout_source: 'none' as const,
      on_timeout: 'none' as const,
    },
    circuit_breaker: {
      has_circuit_breaker: false,
      library: null,
      failure_threshold: null,
      recovery_time_ms: null,
    },
    validation: {
      validates_response: false,
      validates_json: false,
      validates_schema: false,
      handles_empty_response: false,
      handles_truncated: false,
    },
    reliability_risk: {
      level: p.reliability_profile?.has_error_handling ? 'moderate' : 'fragile',
      factors: [],
      single_point_of_failure: !p.reliability_profile?.has_fallback,
      cascade_risk: false,
      data_loss_risk: false,
    },
    anti_patterns: (p.reliability_profile?.anti_patterns || []).map(a => ({
      pattern: a.type,
      description: a.description,
      location: filePath,
      severity: 'medium' as const,
    })),
    optimizations: (p.reliability_profile?.optimizations || []).map(o => ({
      type: o.type as ReliabilityProfile['optimizations'][0]['type'],
      description: o.description,
      reliability_before: 'low',
      reliability_after: 'high',
      effort: 'medium' as const,
      priority: (o.priority || 'medium') as 'high' | 'medium' | 'low' | 'critical',
      sample_change: null,
    })),
    confidence: 0.85,
  }));

  // Convert insights
  const insights: Insight[] = (unified.insights || []).map((i, idx) => ({
    id: `insight_${Date.now()}_${idx}`,
    severity: i.severity as 'critical' | 'warning' | 'info',
    category: i.category as Insight['category'],
    headline: i.headline,
    evidence: i.evidence,
    location: filePath,
    recommendation: i.recommendation,
    source: 'llm' as const,
  }));

  return { imports, callsites, costProfiles, latencyProfiles, throughputProfiles, reliabilityProfiles, insights };
}

// =============================================================================
// ORCHESTRATOR CLASS
// =============================================================================

export class StaticAnalysisOrchestrator {
  private anthropicKey: string;

  constructor(anthropicKey?: string) {
    // BYOK mode: user provides their own API key
    this.anthropicKey = anthropicKey || process.env.ANTHROPIC_API_KEY || '';
    if (!this.anthropicKey) {
      throw new Error('ANTHROPIC_API_KEY is required. Set it via environment variable or pass it to the constructor.');
    }
  }

  async analyze(input: StaticAnalysisInput): Promise<StaticAnalysisOutput> {
    const allImports: ImportAnalyzerOutput[] = [];
    const allCallsites: CallSiteFinderOutput[] = [];
    const allCostAnalysis: StaticAnalysisOutput['cost_analysis'] = [];
    const allLatencyAnalysis: StaticAnalysisOutput['latency_analysis'] = [];
    const allThroughputAnalysis: StaticAnalysisOutput['throughput_analysis'] = [];
    const allReliabilityAnalysis: StaticAnalysisOutput['reliability_analysis'] = [];
    const allPerformanceProfiles: PerformanceProfile[] = [];
    const allInsights: Insight[] = [];

    // Parallel unified analysis - one LLM call per file, all files in parallel
    const fileAnalyses = await Promise.all(
      input.files.map(async (file) => {
        const language = file.language || detectLanguage(file.path);
        const unified = await runUnifiedAnalysis(file.path, file.content, language, this.anthropicKey);

        if (unified && unified.inference_points?.length > 0) {
          return { file, unified, language };
        }
        return null;
      })
    );

    // Process results
    for (const result of fileAnalyses) {
      if (!result) continue;

      const { file, unified } = result;
      const converted = convertUnifiedToLegacy(unified, file.path);

      allImports.push(converted.imports);
      allCallsites.push(converted.callsites);
      allInsights.push(...converted.insights);

      allCostAnalysis.push({
        cost_profiles: converted.costProfiles,
        summary: {
          total_inference_points: converted.costProfiles.length,
          estimated_cost_per_1k_calls: converted.costProfiles.reduce((sum, p) => sum + (p.cost_estimate?.per_call_typical || 0) * 1000, 0),
          highest_cost_point: null,
          optimization_potential_percent: 50,
        },
      });

      allLatencyAnalysis.push({
        latency_profiles: converted.latencyProfiles,
        summary: {
          total_inference_points: converted.latencyProfiles.length,
          blocking_calls: converted.latencyProfiles.filter(p => p.blocking_analysis?.is_blocking).length,
          streaming_enabled: converted.latencyProfiles.filter(p => p.streaming_analysis?.streaming_enabled).length,
          parallelizable: 0,
          estimated_p95_ms: Math.max(...converted.latencyProfiles.map(p => p.latency_estimate?.p95_ms || 0), 5000),
        },
      });

      allThroughputAnalysis.push({
        throughput_profiles: converted.throughputProfiles,
        summary: {
          total_inference_points: converted.throughputProfiles.length,
          has_rate_limiting: converted.throughputProfiles.filter(p => p.rate_limiting?.has_rate_limiter).length,
          has_batching: converted.throughputProfiles.filter(p => p.batching_analysis?.batching_enabled).length,
          scaling_bottlenecks: converted.throughputProfiles.reduce((sum, p) => sum + (p.scaling_analysis?.bottlenecks?.length || 0), 0),
          estimated_max_rps: null,
        },
      });

      allReliabilityAnalysis.push({
        reliability_profiles: converted.reliabilityProfiles,
        summary: {
          total_inference_points: converted.reliabilityProfiles.length,
          has_error_handling: converted.reliabilityProfiles.filter(p => p.error_handling?.has_try_catch).length,
          has_retry: converted.reliabilityProfiles.filter(p => p.retry_strategy?.has_retry).length,
          has_fallback: converted.reliabilityProfiles.filter(p => p.fallback_strategy?.has_fallback).length,
          anti_patterns_found: converted.reliabilityProfiles.reduce((sum, p) => sum + (p.anti_patterns?.length || 0), 0),
          overall_reliability: 'moderate',
        },
      });

      // Build performance profiles with issues from LLM
      for (const point of converted.callsites.inference_points) {
        // Find matching unified inference point to get issues
        const unifiedPoint = unified.inference_points.find(up => up.id === point.id);

        // Convert LLM-generated issues to Issue type
        const issues: Issue[] = (unifiedPoint?.issues || []).map(issue => ({
          type: issue.type,
          severity: (issue.severity || 'warning') as 'critical' | 'warning' | 'info',
          headline: issue.headline,
          evidence: issue.evidence,
          originalCode: issue.original_code || '',
          suggestedFix: issue.suggested_fix || null,
          aiAgentPrompt: issue.ai_agent_prompt || '',
        }));

        allPerformanceProfiles.push({
          inference_point_id: point.id,
          line: point.line,
          file: file.path,
          provider: point.provider.value,
          model: point.model.value,
          originalCode: unifiedPoint?.original_code || '',
          issues,
          cost: converted.costProfiles.find(p => p.inference_point_id === point.id) || null,
          latency: converted.latencyProfiles.find(p => p.inference_point_id === point.id) || null,
          throughput: converted.throughputProfiles.find(p => p.inference_point_id === point.id) || null,
          reliability: converted.reliabilityProfiles.find(p => p.inference_point_id === point.id) || null,
        });
      }
    }

    // Aggregate optimizations
    const allOptimizations: StaticAnalysisOutput['all_optimizations'] = [];

    for (const profile of allPerformanceProfiles) {
      if (profile.cost?.optimizations) {
        for (const opt of profile.cost.optimizations) {
          allOptimizations.push({
            dimension: 'cost',
            inference_point_id: profile.inference_point_id,
            file: profile.file,
            line: profile.line,
            type: opt.type,
            description: opt.description,
            impact: `${opt.savings_percent}% savings`,
            effort: opt.effort,
            priority: opt.savings_percent > 50 ? 'high' : opt.savings_percent > 20 ? 'medium' : 'low',
          });
        }
      }

      if (profile.latency?.optimizations) {
        for (const opt of profile.latency.optimizations) {
          allOptimizations.push({
            dimension: 'latency',
            inference_point_id: profile.inference_point_id,
            file: profile.file,
            line: profile.line,
            type: opt.type,
            description: opt.description,
            impact: `${opt.improvement_percent}% improvement`,
            effort: opt.effort,
            priority: opt.improvement_percent > 50 ? 'high' : 'medium',
          });
        }
      }

      if (profile.throughput?.optimizations) {
        for (const opt of profile.throughput.optimizations) {
          allOptimizations.push({
            dimension: 'throughput',
            inference_point_id: profile.inference_point_id,
            file: profile.file,
            line: profile.line,
            type: opt.type,
            description: opt.description,
            impact: opt.improvement,
            effort: opt.effort,
            priority: opt.type === 'add_rate_limiter' ? 'high' : 'medium',
          });
        }
      }

      if (profile.reliability?.optimizations) {
        for (const opt of profile.reliability.optimizations) {
          allOptimizations.push({
            dimension: 'reliability',
            inference_point_id: profile.inference_point_id,
            file: profile.file,
            line: profile.line,
            type: opt.type,
            description: opt.description,
            impact: `${opt.reliability_before} → ${opt.reliability_after}`,
            effort: opt.effort,
            priority: opt.priority,
          });
        }
      }
    }

    // Calculate summary
    const allProviders = new Set<string>();
    const allModels = new Set<string>();

    for (const callsite of allCallsites) {
      callsite.summary.providers_detected.forEach(p => allProviders.add(p));
      callsite.summary.models_detected.forEach(m => allModels.add(m));
    }

    const totalCostPer1k = allCostAnalysis.reduce((sum, a) => sum + a.summary.estimated_cost_per_1k_calls, 0);
    const maxP95 = Math.max(...allLatencyAnalysis.map(a => a.summary.estimated_p95_ms), 0);

    // Determine overall reliability
    const reliabilityLevels = allReliabilityAnalysis.map(a => a.summary.overall_reliability);
    const reliabilityScore = reliabilityLevels.reduce((sum, level) => {
      switch (level) {
        case 'resilient': return sum + 4;
        case 'robust': return sum + 3;
        case 'moderate': return sum + 2;
        case 'fragile': return sum + 1;
        default: return sum;
      }
    }, 0);
    const avgReliability = reliabilityLevels.length > 0 ? reliabilityScore / reliabilityLevels.length : 1;
    let overallReliability = 'fragile';
    if (avgReliability >= 3.5) overallReliability = 'resilient';
    else if (avgReliability >= 2.5) overallReliability = 'robust';
    else if (avgReliability >= 1.5) overallReliability = 'moderate';

    return {
      imports: allImports,
      callsites: allCallsites,
      performance_profiles: allPerformanceProfiles,
      cost_analysis: allCostAnalysis,
      latency_analysis: allLatencyAnalysis,
      throughput_analysis: allThroughputAnalysis,
      reliability_analysis: allReliabilityAnalysis,
      summary: {
        total_files: input.files.length,
        total_inference_points: allPerformanceProfiles.length,
        providers: [...allProviders],
        models: [...allModels],

        estimated_cost_per_1k_calls: totalCostPer1k,
        cost_risk_high: allCostAnalysis.reduce((sum, a) =>
          sum + a.cost_profiles.filter(p => p.cost_risk.level === 'high' || p.cost_risk.level === 'critical').length, 0),

        blocking_calls: allLatencyAnalysis.reduce((sum, a) => sum + a.summary.blocking_calls, 0),
        streaming_enabled: allLatencyAnalysis.reduce((sum, a) => sum + a.summary.streaming_enabled, 0),
        estimated_p95_ms: maxP95,

        has_rate_limiting: allThroughputAnalysis.reduce((sum, a) => sum + a.summary.has_rate_limiting, 0),
        scaling_bottlenecks: allThroughputAnalysis.reduce((sum, a) => sum + a.summary.scaling_bottlenecks, 0),

        has_error_handling: allReliabilityAnalysis.reduce((sum, a) => sum + a.summary.has_error_handling, 0),
        has_retry: allReliabilityAnalysis.reduce((sum, a) => sum + a.summary.has_retry, 0),
        has_fallback: allReliabilityAnalysis.reduce((sum, a) => sum + a.summary.has_fallback, 0),
        anti_patterns_found: allReliabilityAnalysis.reduce((sum, a) => sum + a.summary.anti_patterns_found, 0),
        overall_reliability: overallReliability,

        total_optimizations: allOptimizations.length,
        critical_optimizations: allOptimizations.filter(o => o.priority === 'critical' || o.priority === 'high').length,
      },
      all_optimizations: allOptimizations,
      insights: allInsights,
    };
  }
}

// =============================================================================
// CONVENIENCE FUNCTION
// =============================================================================

export async function runStaticAnalysis(
  input: StaticAnalysisInput,
  anthropicKey?: string
): Promise<StaticAnalysisOutput> {
  const orchestrator = new StaticAnalysisOrchestrator(anthropicKey);
  return orchestrator.analyze(input);
}

/**
 * Reliability Analyzer Agent
 * Analyzes error handling, resilience, and reliability patterns for LLM inference
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import { join } from 'path';
import YAML from 'yaml';
import { InferencePoint } from './callsite-finder.js';

// Types
export interface ReliabilityOptimization {
  type: 'add_retry' | 'add_fallback' | 'add_timeout' | 'add_circuit_breaker' | 'add_validation' | 'fix_antipattern';
  description: string;
  reliability_before: string;
  reliability_after: string;
  effort: 'low' | 'medium' | 'high';
  priority: 'low' | 'medium' | 'high' | 'critical';
  sample_change: string | null;
}

export interface AntiPattern {
  pattern: string;
  location: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

export interface ReliabilityProfile {
  inference_point_id: string;
  line: number;
  error_handling: {
    has_try_catch: boolean;
    caught_exceptions: string[];
    specific_llm_errors: boolean;
    error_logged: boolean;
    error_propagated: boolean;
    silent_failure: boolean;
    user_friendly_error: boolean;
  };
  retry_strategy: {
    has_retry: boolean;
    retry_library: 'tenacity' | 'backoff' | 'custom' | 'none';
    max_retries: number | null;
    backoff_type: 'none' | 'fixed' | 'exponential' | 'custom';
    initial_delay_ms: number | null;
    max_delay_ms: number | null;
    retry_on: string[];
    jitter: boolean;
    retry_budget_risk: 'none' | 'low' | 'medium' | 'high';
  };
  fallback_strategy: {
    has_fallback: boolean;
    fallback_type: 'model' | 'provider' | 'cached' | 'default' | 'none';
    fallback_model: string | null;
    fallback_provider: string | null;
    graceful_degradation: boolean;
    fallback_tested: 'unknown' | 'likely' | 'unlikely';
  };
  timeout_handling: {
    timeout_configured: boolean;
    timeout_ms: number | null;
    timeout_source: 'client' | 'wrapper' | 'none';
    on_timeout: 'retry' | 'fallback' | 'error' | 'none';
  };
  circuit_breaker: {
    has_circuit_breaker: boolean;
    library: string | null;
    failure_threshold: number | null;
    recovery_time_ms: number | null;
  };
  validation: {
    validates_response: boolean;
    validates_json: boolean;
    validates_schema: boolean;
    handles_empty_response: boolean;
    handles_truncated: boolean;
  };
  reliability_risk: {
    level: 'fragile' | 'moderate' | 'robust' | 'resilient';
    factors: string[];
    single_point_of_failure: boolean;
    cascade_risk: boolean;
    data_loss_risk: boolean;
  };
  anti_patterns: AntiPattern[];
  optimizations: ReliabilityOptimization[];
  confidence: number;
}

export interface ReliabilityAnalyzerOutput {
  reliability_profiles: ReliabilityProfile[];
  summary: {
    total_inference_points: number;
    has_error_handling: number;
    has_retry: number;
    has_fallback: number;
    anti_patterns_found: number;
    overall_reliability: 'fragile' | 'moderate' | 'robust' | 'resilient';
  };
}

export interface ReliabilityAnalyzerInput {
  inference_points: InferencePoint[];
  code_contexts: Map<string, string>;
  file_path: string;
}

// Load prompt template
function loadPromptTemplate(): string {
  const promptPath = join(process.cwd(), 'prompts', 'reliability-analyzer.yaml');
  const promptContent = readFileSync(promptPath, 'utf-8');
  const prompt = YAML.parse(promptContent);
  return prompt.system;
}

// Fallback analysis
function fallbackAnalysis(input: ReliabilityAnalyzerInput): ReliabilityAnalyzerOutput {
  const reliabilityProfiles: ReliabilityProfile[] = [];

  for (const point of input.inference_points) {
    const codeContext = input.code_contexts.get(point.id) || '';

    // Analyze error handling
    const hasTryCatch = /try\s*:|try\s*\{|\.catch\s*\(/i.test(codeContext);
    const caughtExceptions: string[] = [];
    const exceptMatch = codeContext.match(/except\s+(\w+)|catch\s*\(\s*(\w+)/g);
    if (exceptMatch) {
      exceptMatch.forEach(m => {
        const exc = m.replace(/except\s+|catch\s*\(\s*/, '');
        if (exc) caughtExceptions.push(exc);
      });
    }

    const hasLogging = /log\.|logger\.|console\.|print\s*\(/i.test(codeContext);
    const silentFailure = hasTryCatch && !hasLogging && /pass|return\s+None|return\s*$/m.test(codeContext);

    // Analyze retry strategy
    const hasTenacity = /tenacity|@retry|@retrying/i.test(codeContext);
    const hasBackoff = /backoff|@backoff/i.test(codeContext);
    const hasCustomRetry = /retry|retries|max_attempts/i.test(codeContext) && !hasTenacity && !hasBackoff;

    let retryLibrary: 'tenacity' | 'backoff' | 'custom' | 'none' = 'none';
    if (hasTenacity) retryLibrary = 'tenacity';
    else if (hasBackoff) retryLibrary = 'backoff';
    else if (hasCustomRetry) retryLibrary = 'custom';

    const maxRetriesMatch = codeContext.match(/max_retries?\s*[=:]\s*(\d+)|stop_after_attempt\s*\(\s*(\d+)/i);
    const maxRetries = maxRetriesMatch ? parseInt(maxRetriesMatch[1] || maxRetriesMatch[2]) : null;

    const hasExponentialBackoff = /exponential|wait_exponential/i.test(codeContext);

    // Analyze fallback strategy
    const hasFallback = /fallback|backup|alternate|secondary/i.test(codeContext);
    const fallbackModelMatch = codeContext.match(/fallback.*model\s*[=:]\s*["']([^"']+)/i);
    const fallbackModel = fallbackModelMatch ? fallbackModelMatch[1] : null;

    const hasGracefulDegradation = /graceful|degrade|default.*response/i.test(codeContext);

    // Analyze timeout
    const hasTimeout = /timeout\s*[=:]/i.test(codeContext);
    const timeoutMatch = codeContext.match(/timeout\s*[=:]\s*(\d+)/i);
    const timeoutMs = timeoutMatch ? parseInt(timeoutMatch[1]) * 1000 : null;

    // Analyze circuit breaker
    const hasCircuitBreaker = /circuit.?breaker|pybreaker|circuitbreaker/i.test(codeContext);

    // Analyze validation
    const validatesResponse = /validate|check|verify|assert/i.test(codeContext);
    const validatesJson = /json\.loads|JSON\.parse|\.json\(\)/i.test(codeContext);
    const validatesSchema = /pydantic|schema|zod|validate/i.test(codeContext);
    const handlesEmpty = /if\s+not\s+response|if\s+response\s*[=!]=\s*(None|null|''|"")/i.test(codeContext);

    // Detect anti-patterns
    const antiPatterns: AntiPattern[] = [];

    if (!hasTryCatch) {
      antiPatterns.push({
        pattern: 'No error handling',
        location: `${input.file_path}:${point.line}`,
        severity: 'high',
        description: 'LLM call has no try/catch block',
      });
    }

    if (silentFailure) {
      antiPatterns.push({
        pattern: 'Silent failure',
        location: `${input.file_path}:${point.line}`,
        severity: 'critical',
        description: 'Errors are caught but silently ignored',
      });
    }

    if (maxRetries && maxRetries > 10) {
      antiPatterns.push({
        pattern: 'Excessive retries',
        location: `${input.file_path}:${point.line}`,
        severity: 'medium',
        description: `Max retries (${maxRetries}) is very high, risk of cost explosion`,
      });
    }

    if (!hasTimeout) {
      antiPatterns.push({
        pattern: 'No timeout',
        location: `${input.file_path}:${point.line}`,
        severity: 'medium',
        description: 'No timeout configured, requests may hang indefinitely',
      });
    }

    // Assess reliability risk
    const riskFactors: string[] = [];
    let riskLevel: 'fragile' | 'moderate' | 'robust' | 'resilient' = 'fragile';

    if (!hasTryCatch) {
      riskFactors.push('No error handling');
    } else {
      riskLevel = 'moderate';
    }

    if (retryLibrary !== 'none') {
      riskLevel = riskLevel === 'moderate' ? 'robust' : 'moderate';
    } else {
      riskFactors.push('No retry logic');
    }

    if (hasFallback) {
      riskLevel = riskLevel === 'robust' ? 'resilient' : 'robust';
    } else {
      riskFactors.push('No fallback');
    }

    if (hasCircuitBreaker) {
      riskLevel = 'resilient';
    }

    const singlePointOfFailure = !hasFallback && !hasCircuitBreaker;

    // Generate optimizations
    const optimizations: ReliabilityOptimization[] = [];

    if (!hasTryCatch) {
      optimizations.push({
        type: 'add_retry',
        description: 'Add error handling with retry logic',
        reliability_before: 'Fragile - crashes on any error',
        reliability_after: 'Robust - handles transient failures',
        effort: 'low',
        priority: 'critical',
        sample_change: '@retry(stop=stop_after_attempt(3), wait=wait_exponential())',
      });
    }

    if (!hasFallback) {
      optimizations.push({
        type: 'add_fallback',
        description: 'Add fallback model or cached response',
        reliability_before: 'Single point of failure',
        reliability_after: 'Graceful degradation',
        effort: 'medium',
        priority: 'high',
        sample_change: 'except APIError: return fallback_response()',
      });
    }

    if (!hasTimeout) {
      optimizations.push({
        type: 'add_timeout',
        description: 'Add request timeout',
        reliability_before: 'May hang indefinitely',
        reliability_after: 'Bounded failure time',
        effort: 'low',
        priority: 'medium',
        sample_change: 'timeout=30',
      });
    }

    if (!validatesResponse) {
      optimizations.push({
        type: 'add_validation',
        description: 'Validate LLM response format',
        reliability_before: 'May crash on unexpected format',
        reliability_after: 'Handles malformed responses',
        effort: 'low',
        priority: 'medium',
        sample_change: 'if not response.choices: raise ValueError()',
      });
    }

    reliabilityProfiles.push({
      inference_point_id: point.id,
      line: point.line,
      error_handling: {
        has_try_catch: hasTryCatch,
        caught_exceptions: caughtExceptions,
        specific_llm_errors: caughtExceptions.some(e => /api|openai|anthropic|rate/i.test(e)),
        error_logged: hasLogging,
        error_propagated: /raise|throw/i.test(codeContext),
        silent_failure: silentFailure,
        user_friendly_error: /message|user|friendly/i.test(codeContext),
      },
      retry_strategy: {
        has_retry: retryLibrary !== 'none',
        retry_library: retryLibrary,
        max_retries: maxRetries,
        backoff_type: hasExponentialBackoff ? 'exponential' : retryLibrary !== 'none' ? 'fixed' : 'none',
        initial_delay_ms: retryLibrary !== 'none' ? 1000 : null,
        max_delay_ms: retryLibrary !== 'none' ? 60000 : null,
        retry_on: retryLibrary !== 'none' ? ['RateLimitError', 'APIError', 'Timeout'] : [],
        jitter: hasExponentialBackoff,
        retry_budget_risk: maxRetries && maxRetries > 5 ? 'medium' : 'low',
      },
      fallback_strategy: {
        has_fallback: hasFallback,
        fallback_type: fallbackModel ? 'model' : hasFallback ? 'default' : 'none',
        fallback_model: fallbackModel,
        fallback_provider: null,
        graceful_degradation: hasGracefulDegradation,
        fallback_tested: 'unknown',
      },
      timeout_handling: {
        timeout_configured: hasTimeout,
        timeout_ms: timeoutMs,
        timeout_source: hasTimeout ? 'client' : 'none',
        on_timeout: hasTimeout && hasTryCatch ? 'error' : 'none',
      },
      circuit_breaker: {
        has_circuit_breaker: hasCircuitBreaker,
        library: hasCircuitBreaker ? 'pybreaker' : null,
        failure_threshold: hasCircuitBreaker ? 5 : null,
        recovery_time_ms: hasCircuitBreaker ? 30000 : null,
      },
      validation: {
        validates_response: validatesResponse,
        validates_json: validatesJson,
        validates_schema: validatesSchema,
        handles_empty_response: handlesEmpty,
        handles_truncated: /truncat|finish_reason|stop/i.test(codeContext),
      },
      reliability_risk: {
        level: riskLevel,
        factors: riskFactors,
        single_point_of_failure: singlePointOfFailure,
        cascade_risk: !hasCircuitBreaker && singlePointOfFailure,
        data_loss_risk: silentFailure,
      },
      anti_patterns: antiPatterns,
      optimizations,
      confidence: 0.7,
    });
  }

  // Calculate overall reliability
  const reliabilityScores = reliabilityProfiles.map(p => {
    switch (p.reliability_risk.level) {
      case 'resilient': return 4;
      case 'robust': return 3;
      case 'moderate': return 2;
      case 'fragile': return 1;
    }
  });
  const avgScore = reliabilityScores.reduce((a, b) => a + b, 0) / reliabilityScores.length;
  let overallReliability: 'fragile' | 'moderate' | 'robust' | 'resilient' = 'fragile';
  if (avgScore >= 3.5) overallReliability = 'resilient';
  else if (avgScore >= 2.5) overallReliability = 'robust';
  else if (avgScore >= 1.5) overallReliability = 'moderate';

  return {
    reliability_profiles: reliabilityProfiles,
    summary: {
      total_inference_points: reliabilityProfiles.length,
      has_error_handling: reliabilityProfiles.filter(p => p.error_handling.has_try_catch).length,
      has_retry: reliabilityProfiles.filter(p => p.retry_strategy.has_retry).length,
      has_fallback: reliabilityProfiles.filter(p => p.fallback_strategy.has_fallback).length,
      anti_patterns_found: reliabilityProfiles.reduce((sum, p) => sum + p.anti_patterns.length, 0),
      overall_reliability: overallReliability,
    },
  };
}

// Main agent function - uses batch processing for efficiency
export async function analyzeReliability(input: ReliabilityAnalyzerInput): Promise<ReliabilityAnalyzerOutput> {
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

Code Context:
\`\`\`
${codeContext}
\`\`\``;
  }).join('\n\n');

  const userMessage = `Analyze the reliability profile for these ${input.inference_points.length} LLM inference points:

${pointsData}

Return a JSON array of reliability_profile objects, one for each inference point in order.
Format: { "reliability_profiles": [ {...}, {...}, ... ] }`;

  let profiles: ReliabilityProfile[] = [];

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
        const profilesArray = parsed.reliability_profiles || parsed.profiles || (Array.isArray(parsed) ? parsed : [parsed]);

        if (Array.isArray(profilesArray)) {
          for (let i = 0; i < input.inference_points.length; i++) {
            const profile = profilesArray[i];
            if (profile?.reliability_risk !== undefined) {
              profile.inference_point_id = input.inference_points[i].id;
              profile.line = input.inference_points[i].line;
              profiles.push(profile as ReliabilityProfile);
            } else {
              const fallback = fallbackAnalysis({ ...input, inference_points: [input.inference_points[i]] });
              profiles.push(...fallback.reliability_profiles);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error(`Reliability analysis batch error:`, error);
  }

  // If batch failed or incomplete, use fallback for remaining points
  if (profiles.length < input.inference_points.length) {
    const analyzedIds = new Set(profiles.map(p => p.inference_point_id));
    const missingPoints = input.inference_points.filter(p => !analyzedIds.has(p.id));
    if (missingPoints.length > 0) {
      const fallback = fallbackAnalysis({ ...input, inference_points: missingPoints });
      profiles.push(...fallback.reliability_profiles);
    }
  }

  // Calculate overall reliability
  const reliabilityScores = profiles.map(p => {
    switch (p.reliability_risk?.level) {
      case 'resilient': return 4;
      case 'robust': return 3;
      case 'moderate': return 2;
      case 'fragile': return 1;
      default: return 1;
    }
  });
  const avgScore = reliabilityScores.length > 0
    ? reliabilityScores.reduce((a, b) => a + b, 0) / reliabilityScores.length
    : 1;
  let overallReliability: 'fragile' | 'moderate' | 'robust' | 'resilient' = 'fragile';
  if (avgScore >= 3.5) overallReliability = 'resilient';
  else if (avgScore >= 2.5) overallReliability = 'robust';
  else if (avgScore >= 1.5) overallReliability = 'moderate';

  return {
    reliability_profiles: profiles,
    summary: {
      total_inference_points: profiles.length,
      has_error_handling: profiles.filter(p => p.error_handling?.has_try_catch).length,
      has_retry: profiles.filter(p => p.retry_strategy?.has_retry).length,
      has_fallback: profiles.filter(p => p.fallback_strategy?.has_fallback).length,
      anti_patterns_found: profiles.reduce((sum, p) => sum + (p.anti_patterns?.length ?? 0), 0),
      overall_reliability: overallReliability,
    },
  };
}

export class ReliabilityAnalyzerAgent {
  name = 'ReliabilityAnalyzerAgent';
  description = 'Analyzes error handling, resilience, and reliability patterns for LLM inference';

  async execute(input: ReliabilityAnalyzerInput): Promise<ReliabilityAnalyzerOutput> {
    return analyzeReliability(input);
  }
}

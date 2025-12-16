/**
 * Drift Detection - PeakInfer TDD v1.3 Section 10.2
 * 
 * Specialized drift detection logic for identifying mismatches
 * between static code analysis and runtime behavior.
 * 
 * Drift Signals (per TDD):
 * - codeOnly: in repo, never observed in events
 * - runtimeOnly: observed in events, no matching callsite
 * - mismatch: same callsite_id but provider/model differs
 * - pattern drift: batching/streaming indicated in code but absent in runtime
 */

import type { InferenceEvent } from '../../types/events.js';
import type {
  Callsite,
  DriftSignal,
  DriftType,
  InferencePatterns,
} from '../types.js';

// =============================================================================
// TYPES
// =============================================================================

export interface DriftDetectionOptions {
  /** Minimum number of events to consider for pattern drift */
  minEventsForPatternDrift?: number;
  
  /** Threshold for considering a callsite as "dead code" (0 events) */
  deadCodeThreshold?: number;
  
  /** Whether to include info-level drift signals */
  includeInfoLevel?: boolean;
  
  /** File patterns to exclude from dead code detection */
  excludePatterns?: RegExp[];
}

export interface DriftReport {
  /** All drift signals */
  signals: DriftSignal[];
  
  /** Summary counts by type */
  summary: {
    codeOnly: number;
    runtimeOnly: number;
    modelMismatch: number;
    providerMismatch: number;
    patternMismatch: number;
    total: number;
  };
  
  /** Severity breakdown */
  bySeverity: {
    error: number;
    warning: number;
    info: number;
  };
  
  /** High-level drift score (0-100, higher is worse) */
  driftScore: number;
  
  /** Human-readable summary */
  humanSummary: string;
}

// =============================================================================
// MAIN DRIFT DETECTION
// =============================================================================

/**
 * Comprehensive drift detection between callsites and runtime events.
 */
export function detectDrift(
  callsites: Callsite[],
  events: InferenceEvent[],
  patterns?: InferencePatterns,
  options: DriftDetectionOptions = {}
): DriftReport {
  const {
    minEventsForPatternDrift = 50,
    includeInfoLevel = true,
    excludePatterns = [/test/, /mock/, /fixture/],
  } = options;
  
  const signals: DriftSignal[] = [];
  
  // Build lookup structures
  const eventsByProvider = groupBy(events, e => e.provider);
  const eventsByModel = groupBy(events, e => e.model);
  const eventsByProviderModel = groupBy(events, e => `${e.provider}:${e.model}`);
  
  // Convert Provider | null to string for comparison with runtime events
  const callsiteProviders = new Set<string>(
    callsites
      .map(c => c.provider)
      .filter((p): p is NonNullable<typeof p> => p !== null)
      .map(p => String(p))
  );
  const callsiteModels = new Set<string>(
    callsites
      .map(c => c.model)
      .filter((m): m is NonNullable<typeof m> => m !== null)
  );
  const callsiteProviderModels = new Set<string>(
    callsites
      .filter(c => c.provider && c.model)
      .map(c => `${c.provider}:${c.model}`)
  );
  
  // ==========================================================================
  // Detect code-only drift (dead code / untested paths)
  // ==========================================================================
  for (const callsite of callsites) {
    // Skip test files
    if (excludePatterns.some(p => p.test(callsite.file))) continue;
    
    const providerModelKey = `${callsite.provider}:${callsite.model}`;
    const hasExactMatch = eventsByProviderModel.has(providerModelKey);
    const hasProviderMatch = callsite.provider ? eventsByProvider.has(callsite.provider) : false;
    
    if (!hasExactMatch && !hasProviderMatch) {
      signals.push({
        type: 'code_only',
        severity: 'warning',
        description: `Inference point never exercised at runtime`,
        callsiteId: callsite.id,
        file: callsite.file,
        line: callsite.line,
        codeValue: `${callsite.provider || 'unknown'}/${callsite.model || 'unknown'}`,
        evidence: [
          'No matching runtime events found',
          'This could indicate dead code, feature flag, or testing gap',
          callsite.patterns?.fallback 
            ? 'Note: This is a fallback path - may be intentionally unused'
            : '',
        ].filter(Boolean),
      });
    }
  }
  
  // ==========================================================================
  // Detect runtime-only drift (shadow traffic / dynamic routing)
  // ==========================================================================
  for (const [providerModel, evts] of eventsByProviderModel) {
    if (!callsiteProviderModels.has(providerModel)) {
      const [provider, model] = providerModel.split(':');
      
      // Check if at least the provider exists in code
      const providerInCode = callsiteProviders.has(provider);
      
      const timestamps = evts.map(e => new Date(e.ts).getTime());
      const firstSeen = new Date(Math.min(...timestamps)).toISOString();
      const lastSeen = new Date(Math.max(...timestamps)).toISOString();
      
      signals.push({
        type: 'runtime_only',
        severity: providerInCode ? 'warning' : 'error',
        description: providerInCode
          ? `Model "${model}" observed but not found in code for provider "${provider}"`
          : `Provider "${provider}" with model "${model}" not found in codebase`,
        runtimeValue: providerModel,
        observationCount: evts.length,
        evidence: [
          `${evts.length} calls observed`,
          `First seen: ${firstSeen.split('T')[0]}`,
          `Last seen: ${lastSeen.split('T')[0]}`,
          providerInCode 
            ? 'Provider exists in code but model is different - likely dynamic model selection'
            : 'Neither provider nor model found in code - check for dynamic provider selection or missing codebase scan',
        ],
      });
    }
  }
  
  // ==========================================================================
  // Detect pattern drift (if we have enough events and patterns)
  // ==========================================================================
  if (patterns && events.length >= minEventsForPatternDrift) {
    const patternDrifts = detectPatternDrift(patterns, events, callsites, includeInfoLevel);
    signals.push(...patternDrifts);
  }
  
  // ==========================================================================
  // Build summary
  // ==========================================================================
  const summary = {
    codeOnly: signals.filter(s => s.type === 'code_only').length,
    runtimeOnly: signals.filter(s => s.type === 'runtime_only').length,
    modelMismatch: signals.filter(s => s.type === 'model_mismatch').length,
    providerMismatch: signals.filter(s => s.type === 'provider_mismatch').length,
    patternMismatch: signals.filter(s => s.type === 'pattern_mismatch').length,
    total: signals.length,
  };
  
  const bySeverity = {
    error: signals.filter(s => s.severity === 'error').length,
    warning: signals.filter(s => s.severity === 'warning').length,
    info: signals.filter(s => s.severity === 'info').length,
  };
  
  // Drift score: weighted sum of severity
  const driftScore = Math.min(100, 
    bySeverity.error * 20 + 
    bySeverity.warning * 5 + 
    bySeverity.info * 1
  );
  
  // Human summary
  const humanSummary = buildHumanSummary(summary, bySeverity, callsites.length, events.length);
  
  return {
    signals,
    summary,
    bySeverity,
    driftScore,
    humanSummary,
  };
}

// =============================================================================
// PATTERN DRIFT DETECTION
// =============================================================================

function detectPatternDrift(
  patterns: InferencePatterns,
  events: InferenceEvent[],
  callsites: Callsite[],
  includeInfoLevel: boolean
): DriftSignal[] {
  const drifts: DriftSignal[] = [];
  
  // Streaming drift: code has streaming but runtime suggests otherwise
  if (patterns.streaming?.detected) {
    const streamingDrift = detectStreamingDrift(patterns.streaming, events);
    if (streamingDrift) {
      if (streamingDrift.severity !== 'info' || includeInfoLevel) {
        drifts.push(streamingDrift);
      }
    }
  }
  
  // Batching drift: code has batching but runtime is sequential
  if (patterns.batching?.detected) {
    const batchingDrift = detectBatchingDrift(patterns.batching, events);
    if (batchingDrift) {
      if (batchingDrift.severity !== 'info' || includeInfoLevel) {
        drifts.push(batchingDrift);
      }
    }
  }
  
  // Fallback drift: code has fallback but never triggered
  if (patterns.fallback?.detected) {
    const fallbackDrift = detectFallbackDrift(patterns.fallback, events);
    if (fallbackDrift) {
      if (fallbackDrift.severity !== 'info' || includeInfoLevel) {
        drifts.push(fallbackDrift);
      }
    }
  }
  
  // Caching drift: code has caching but no cache hits
  if (patterns.caching?.detected) {
    const cachingDrift = detectCachingDrift(patterns.caching, events);
    if (cachingDrift) {
      if (cachingDrift.severity !== 'info' || includeInfoLevel) {
        drifts.push(cachingDrift);
      }
    }
  }
  
  return drifts;
}

function detectStreamingDrift(
  pattern: InferencePatterns['streaming'],
  events: InferenceEvent[]
): DriftSignal | null {
  // Heuristic: streaming responses should have lower latency per token
  // If we see high latency with high output tokens, streaming may not be working
  
  const eventsWithTokens = events.filter(e => 
    e.output_tokens && e.output_tokens > 50 && e.latency_ms
  );
  
  if (eventsWithTokens.length < 10) return null;
  
  const avgMsPerToken = eventsWithTokens.reduce((sum, e) => 
    sum + (e.latency_ms! / e.output_tokens!), 0
  ) / eventsWithTokens.length;
  
  // Streaming should give ~20-50 tokens/sec, so <50ms per token
  // Non-streaming waits for full completion
  if (avgMsPerToken > 100) {
    return {
      type: 'pattern_mismatch',
      severity: 'warning',
      description: 'Streaming pattern in code but runtime latency suggests non-streaming behavior',
      evidence: [
        `Streaming code at: ${pattern.instances.map(i => `${i.file}:${i.line}`).slice(0, 3).join(', ')}`,
        `Avg latency per token: ${avgMsPerToken.toFixed(0)}ms (streaming should be <50ms)`,
        'Possible causes: stream disabled at runtime, buffered proxy, or "fake streaming"',
      ],
    };
  }
  
  return null;
}

function detectBatchingDrift(
  pattern: InferencePatterns['batching'],
  events: InferenceEvent[]
): DriftSignal | null {
  // Look for concurrent requests (same timestamp within 10ms window)
  const sortedByTime = [...events].sort((a, b) => 
    new Date(a.ts).getTime() - new Date(b.ts).getTime()
  );
  
  let concurrentPairs = 0;
  for (let i = 1; i < sortedByTime.length; i++) {
    const delta = new Date(sortedByTime[i].ts).getTime() - 
                  new Date(sortedByTime[i-1].ts).getTime();
    if (delta < 10) concurrentPairs++;
  }
  
  const concurrencyRatio = sortedByTime.length > 1 
    ? concurrentPairs / (sortedByTime.length - 1) 
    : 0;
  
  if (concurrencyRatio < 0.05 && sortedByTime.length > 50) {
    return {
      type: 'pattern_mismatch',
      severity: 'warning',
      description: 'Batching pattern in code but runtime shows sequential requests',
      evidence: [
        `Batching code at: ${pattern.instances.map(i => `${i.file}:${i.line}`).slice(0, 3).join(', ')}`,
        `Only ${(concurrencyRatio * 100).toFixed(1)}% of requests appear batched`,
        'Batching implementation may not be effective or traffic is naturally sequential',
      ],
    };
  }
  
  return null;
}

function detectFallbackDrift(
  pattern: InferencePatterns['fallback'],
  events: InferenceEvent[]
): DriftSignal | null {
  // Fallback drift: code has fallback chains but only one provider used
  const providers = new Set(events.map(e => e.provider));
  
  if (providers.size === 1 && events.length > 100) {
    const singleProvider = [...providers][0];
    
    return {
      type: 'pattern_mismatch',
      severity: 'info',
      description: 'Fallback pattern in code but only one provider observed at runtime',
      evidence: [
        `Fallback code at: ${pattern.instances.map(i => `${i.file}:${i.line}`).slice(0, 3).join(', ')}`,
        `Only provider used: ${singleProvider} (across ${events.length} calls)`,
        'This could mean: primary provider is reliable, fallback never tested, or fallback config issue',
      ],
    };
  }
  
  return null;
}

function detectCachingDrift(
  pattern: InferencePatterns['caching'],
  events: InferenceEvent[]
): DriftSignal | null {
  // Caching drift: if caching is implemented, we'd expect some requests to be very fast
  // This is a weak heuristic without explicit cache hit/miss metadata
  
  const latencies = events.map(e => e.latency_ms || 0).filter(l => l > 0).sort((a, b) => a - b);
  
  if (latencies.length < 50) return null;
  
  const p10 = latencies[Math.floor(latencies.length * 0.1)];
  const p50 = latencies[Math.floor(latencies.length * 0.5)];
  
  // If caching works, we'd expect p10 to be significantly lower than p50
  // (cache hits are fast, cache misses are normal)
  const cacheEffectRatio = p50 / Math.max(p10, 1);
  
  if (cacheEffectRatio < 2 && p10 > 100) {
    return {
      type: 'pattern_mismatch',
      severity: 'info',
      description: 'Caching pattern in code but latency distribution suggests low cache hit rate',
      evidence: [
        `Caching code at: ${pattern.instances.map(i => `${i.file}:${i.line}`).slice(0, 3).join(', ')}`,
        `p10 latency: ${p10}ms, p50: ${p50}ms (ratio: ${cacheEffectRatio.toFixed(1)}x)`,
        'Expected: p10 << p50 if cache is effective (cache hits should be fast)',
      ],
    };
  }
  
  return null;
}

// =============================================================================
// HELPERS
// =============================================================================

function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return map;
}

function buildHumanSummary(
  summary: DriftReport['summary'],
  bySeverity: DriftReport['bySeverity'],
  callsiteCount: number,
  eventCount: number
): string {
  const parts: string[] = [];
  
  if (summary.total === 0) {
    return `No drift detected between ${callsiteCount} callsites and ${eventCount} runtime events. Code and runtime are aligned.`;
  }
  
  if (bySeverity.error > 0) {
    parts.push(`${bySeverity.error} critical drift(s) requiring attention`);
  }
  
  if (summary.codeOnly > 0) {
    parts.push(`${summary.codeOnly} callsite(s) never exercised`);
  }
  
  if (summary.runtimeOnly > 0) {
    parts.push(`${summary.runtimeOnly} provider/model(s) in runtime not found in code`);
  }
  
  if (summary.modelMismatch > 0 || summary.providerMismatch > 0) {
    parts.push(`${summary.modelMismatch + summary.providerMismatch} mismatch(es) between code and runtime`);
  }
  
  if (summary.patternMismatch > 0) {
    parts.push(`${summary.patternMismatch} pattern(s) not behaving as coded`);
  }
  
  return parts.join('. ') + '.';
}


/**
 * Join Engine - PeakInfer TDD v1.3 Section 10
 * 
 * Correlates static code analysis with runtime events to:
 * 1. Match callsites to runtime observations
 * 2. Detect drift between code intent and runtime reality
 * 3. Surface unmatched items (code-only, runtime-only)
 * 
 * Join Priority (TDD v1.3 Section 10.1):
 * 1. callsite_id exact match (if present in events)
 * 2. provider+model match (high confidence only)
 * 3. provider match + nearest-file heuristic (only if explicitly enabled)
 * 4. otherwise → unmatched buckets
 */

import type { InferenceEvent } from '../../types/events.js';
import type {
  Callsite,
  ClassifiedCallsite,
  JoinedInference,
  DriftSignal,
  DriftType,
  UsageStats,
  InferencePatterns,
} from '../types.js';

// =============================================================================
// TYPES
// =============================================================================

export interface JoinOptions {
  /** Enable fuzzy matching (provider + nearest-file heuristic) */
  enableFuzzyMatch?: boolean;
  
  /** Minimum confidence for provider+model matching */
  minMatchConfidence?: number;
  
  /** Whether to detect pattern drift */
  detectPatternDrift?: boolean;
  
  /** Patterns from static analysis (for pattern drift detection) */
  patterns?: InferencePatterns;
}

export interface JoinResult extends JoinedInference {
  /** Duration of join operation in ms */
  durationMs: number;
}

// =============================================================================
// MAIN JOIN FUNCTION
// =============================================================================

/**
 * Join static analysis callsites with runtime events.
 * Detects drift and produces enriched analysis.
 */
export function joinStaticAndRuntime(
  callsites: ClassifiedCallsite[] | Callsite[],
  events: InferenceEvent[],
  options: JoinOptions = {}
): JoinResult {
  const startTime = Date.now();
  
  const {
    enableFuzzyMatch = false,
    minMatchConfidence = 0.7,
    detectPatternDrift = true,
    patterns,
  } = options;
  
  // Normalize callsites to Callsite format
  const normalizedCallsites = normalizeCallsites(callsites);
  
  // Build runtime aggregations for matching
  const runtimeAggregations = aggregateRuntimeEvents(events);
  
  // Track matches
  const matchedCallsiteIds = new Set<string>();
  const matchedEventKeys = new Set<string>();
  
  // Result containers
  const enrichedCallsites: Array<Callsite & { usage?: UsageStats }> = [];
  const driftSignals: DriftSignal[] = [];
  
  // ==========================================================================
  // PASS 1: Exact callsite_id matches
  // ==========================================================================
  const eventsByCallsiteId = groupEventsByCallsiteId(events);
  
  for (const callsite of normalizedCallsites) {
    const matchedEvents = eventsByCallsiteId.get(callsite.id);
    
    if (matchedEvents && matchedEvents.length > 0) {
      matchedCallsiteIds.add(callsite.id);
      matchedEventKeys.add(callsite.id);
      
      const usage = computeUsageStats(matchedEvents);
      enrichedCallsites.push({ ...callsite, usage });
      
      // Check for model/provider mismatch even with callsite_id match
      const drifts = detectMismatchDrift(callsite, matchedEvents);
      driftSignals.push(...drifts);
    }
  }
  
  // ==========================================================================
  // PASS 2: Provider + Model matches (high confidence)
  // ==========================================================================
  for (const callsite of normalizedCallsites) {
    if (matchedCallsiteIds.has(callsite.id)) continue;
    if (!callsite.provider || !callsite.model) continue;
    
    const key = `${callsite.provider}:${callsite.model}`;
    const agg = runtimeAggregations.byProviderModel.get(key);
    
    if (agg && agg.confidence >= minMatchConfidence) {
      matchedCallsiteIds.add(callsite.id);
      matchedEventKeys.add(key);
      
      const usage = computeUsageStats(agg.events);
      enrichedCallsites.push({ ...callsite, usage });
    }
  }
  
  // ==========================================================================
  // PASS 3: Provider-only matches (if fuzzy enabled)
  // ==========================================================================
  if (enableFuzzyMatch) {
    for (const callsite of normalizedCallsites) {
      if (matchedCallsiteIds.has(callsite.id)) continue;
      if (!callsite.provider) continue;
      
      const providerAgg = runtimeAggregations.byProvider.get(callsite.provider);
      
      if (providerAgg && providerAgg.events.length > 0) {
        // Match to provider but note model uncertainty
        matchedCallsiteIds.add(callsite.id);
        
        const usage = computeUsageStats(providerAgg.events);
        enrichedCallsites.push({ ...callsite, usage });
        
        // Add drift signal for potential model mismatch
        if (callsite.model) {
          const runtimeModels = [...new Set(providerAgg.events.map(e => e.model))];
          if (!runtimeModels.includes(callsite.model)) {
            driftSignals.push({
              type: 'model_mismatch',
              severity: 'warning',
              description: `Code specifies ${callsite.model} but runtime shows: ${runtimeModels.join(', ')}`,
              callsiteId: callsite.id,
              file: callsite.file,
              line: callsite.line,
              codeValue: callsite.model,
              runtimeValue: runtimeModels.join(', '),
              observationCount: providerAgg.events.length,
              evidence: ['Fuzzy provider-only match', `Runtime models: ${runtimeModels.join(', ')}`],
            });
          }
        }
      }
    }
  }
  
  // ==========================================================================
  // Add unmatched callsites (no usage)
  // ==========================================================================
  for (const callsite of normalizedCallsites) {
    if (!matchedCallsiteIds.has(callsite.id)) {
      enrichedCallsites.push({ ...callsite });
    }
  }
  
  // ==========================================================================
  // Detect code-only drift (callsites never exercised)
  // ==========================================================================
  const codeOnly: Callsite[] = [];
  
  for (const callsite of normalizedCallsites) {
    if (!matchedCallsiteIds.has(callsite.id)) {
      codeOnly.push(callsite);
      
      driftSignals.push({
        type: 'code_only',
        severity: 'warning',
        description: `Callsite in code was never observed at runtime`,
        callsiteId: callsite.id,
        file: callsite.file,
        line: callsite.line,
        codeValue: `${callsite.provider || 'unknown'}/${callsite.model || 'unknown'}`,
        evidence: [
          'No matching events found',
          'Could indicate dead code or untested path',
        ],
      });
    }
  }
  
  // ==========================================================================
  // Detect runtime-only (events not mapped to code)
  // ==========================================================================
  const runtimeOnly: JoinedInference['runtimeOnly'] = [];
  
  for (const [key, agg] of runtimeAggregations.byProviderModel) {
    // Check if this provider+model combo was matched
    const wasMatched = matchedEventKeys.has(key) || 
      [...matchedCallsiteIds].some(id => {
        const cs = normalizedCallsites.find(c => c.id === id);
        return cs && `${cs.provider}:${cs.model}` === key;
      });
    
    if (!wasMatched && agg.events.length > 0) {
      const [provider, model] = key.split(':');
      
      const timestamps = agg.events.map(e => new Date(e.ts).getTime());
      const firstSeen = new Date(Math.min(...timestamps)).toISOString();
      const lastSeen = new Date(Math.max(...timestamps)).toISOString();
      
      runtimeOnly.push({
        provider,
        model,
        callCount: agg.events.length,
        totalCost: agg.events.reduce((sum, e) => sum + (e.cost_usd || 0), 0),
        avgLatency: agg.events.reduce((sum, e) => sum + (e.latency_ms || 0), 0) / agg.events.length,
        firstSeen,
        lastSeen,
      });
      
      driftSignals.push({
        type: 'runtime_only',
        severity: 'warning',
        description: `Provider/model observed at runtime but not found in code`,
        runtimeValue: `${provider}/${model}`,
        observationCount: agg.events.length,
        evidence: [
          `${agg.events.length} calls observed`,
          `First seen: ${firstSeen}`,
          `Last seen: ${lastSeen}`,
          'Could indicate dynamic provider selection or missing code scan',
        ],
      });
    }
  }
  
  // ==========================================================================
  // Detect pattern drift (if patterns provided)
  // ==========================================================================
  if (detectPatternDrift && patterns) {
    const patternDrifts = detectPatternMismatch(patterns, events, normalizedCallsites);
    driftSignals.push(...patternDrifts);
  }
  
  // ==========================================================================
  // Compute join stats
  // ==========================================================================
  const totalEvents = events.length;
  const matchedEvents = events.filter(e => {
    const callsiteId = (e as any).callsite_id;
    return callsiteId ? matchedCallsiteIds.has(callsiteId) : false;
  }).length;
  
  // For events without callsite_id, estimate based on provider+model matches
  const estimatedMatchedByProviderModel = events.filter(e => {
    const key = `${e.provider}:${e.model}`;
    return matchedEventKeys.has(key);
  }).length;
  
  const effectiveMatchedEvents = Math.max(matchedEvents, estimatedMatchedByProviderModel);
  
  const joinConfidence = normalizedCallsites.length > 0
    ? matchedCallsiteIds.size / normalizedCallsites.length
    : 0;
  
  return {
    callsites: enrichedCallsites,
    runtimeOnly,
    codeOnly,
    drift: driftSignals,
    joinStats: {
      totalCallsites: normalizedCallsites.length,
      matchedCallsites: matchedCallsiteIds.size,
      totalEvents,
      matchedEvents: effectiveMatchedEvents,
      confidence: joinConfidence,
    },
    durationMs: Date.now() - startTime,
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Normalize ClassifiedCallsite to Callsite format
 */
function normalizeCallsites(callsites: ClassifiedCallsite[] | Callsite[]): Callsite[] {
  return callsites.map(cs => {
    // Check if it's already a Callsite (has 'patterns' field)
    if ('patterns' in cs && typeof cs.patterns === 'object' && cs.patterns !== null) {
      return cs as Callsite;
    }
    
    // Convert ClassifiedCallsite to Callsite
    const classified = cs as ClassifiedCallsite;
    return {
      id: classified.id,
      file: classified.file,
      line: classified.line,
      language: 'unknown' as const,
      provider: (classified.provider as any) || null,
      model: classified.model,
      framework: classified.framework,
      runtime: classified.runtime,
      patterns: {
        streaming: classified.isStreaming ?? undefined,
      },
      confidence: classified.confidence,
      evidence: {
        whyProvider: classified.reasoning?.whyProvider,
        whyModel: classified.reasoning?.whyModel,
      },
    };
  });
}

/**
 * Group events by callsite_id for exact matching
 */
function groupEventsByCallsiteId(events: InferenceEvent[]): Map<string, InferenceEvent[]> {
  const grouped = new Map<string, InferenceEvent[]>();
  
  for (const event of events) {
    const id = (event as any).callsite_id;
    if (id) {
      if (!grouped.has(id)) {
        grouped.set(id, []);
      }
      grouped.get(id)!.push(event);
    }
  }
  
  return grouped;
}

interface RuntimeAggregation {
  events: InferenceEvent[];
  confidence: number;
}

interface RuntimeAggregations {
  byProviderModel: Map<string, RuntimeAggregation>;
  byProvider: Map<string, RuntimeAggregation>;
}

/**
 * Aggregate runtime events for matching
 */
function aggregateRuntimeEvents(events: InferenceEvent[]): RuntimeAggregations {
  const byProviderModel = new Map<string, RuntimeAggregation>();
  const byProvider = new Map<string, RuntimeAggregation>();
  
  for (const event of events) {
    // By provider+model
    const key = `${event.provider}:${event.model}`;
    if (!byProviderModel.has(key)) {
      byProviderModel.set(key, { events: [], confidence: 0.9 });
    }
    byProviderModel.get(key)!.events.push(event);
    
    // By provider only
    if (!byProvider.has(event.provider)) {
      byProvider.set(event.provider, { events: [], confidence: 0.6 });
    }
    byProvider.get(event.provider)!.events.push(event);
  }
  
  return { byProviderModel, byProvider };
}

/**
 * Compute usage statistics from a set of events
 */
function computeUsageStats(events: InferenceEvent[]): UsageStats {
  if (events.length === 0) {
    return {
      calls: 0,
      tokens_in: 0,
      tokens_out: 0,
      cost_usd: 0,
      latency: { avg: 0, p50: 0, p95: 0, p99: 0 },
      timeRange: { start: '', end: '' },
    };
  }
  
  const tokens_in = events.reduce((sum, e) => sum + (e.input_tokens || 0), 0);
  const tokens_out = events.reduce((sum, e) => sum + (e.output_tokens || 0), 0);
  const cost_usd = events.reduce((sum, e) => sum + (e.cost_usd || 0), 0);
  
  // Latency percentiles
  const latencies = events
    .map(e => e.latency_ms || 0)
    .filter(l => l > 0)
    .sort((a, b) => a - b);
  
  const avg = latencies.length > 0 
    ? latencies.reduce((a, b) => a + b, 0) / latencies.length 
    : 0;
  
  const percentile = (arr: number[], p: number) => {
    if (arr.length === 0) return 0;
    const idx = Math.ceil((p / 100) * arr.length) - 1;
    return arr[Math.max(0, idx)];
  };
  
  // Time range
  const timestamps = events.map(e => new Date(e.ts).getTime()).filter(t => !isNaN(t));
  const start = timestamps.length > 0 ? new Date(Math.min(...timestamps)).toISOString() : '';
  const end = timestamps.length > 0 ? new Date(Math.max(...timestamps)).toISOString() : '';
  
  return {
    calls: events.length,
    tokens_in,
    tokens_out,
    cost_usd,
    latency: {
      avg,
      p50: percentile(latencies, 50),
      p95: percentile(latencies, 95),
      p99: percentile(latencies, 99),
    },
    timeRange: { start, end },
  };
}

/**
 * Detect model/provider mismatch between callsite and matched events
 */
function detectMismatchDrift(callsite: Callsite, events: InferenceEvent[]): DriftSignal[] {
  const drifts: DriftSignal[] = [];
  
  // Check model mismatch
  if (callsite.model) {
    const runtimeModels = [...new Set(events.map(e => e.model))];
    const modelMismatch = !runtimeModels.includes(callsite.model);
    
    if (modelMismatch) {
      drifts.push({
        type: 'model_mismatch',
        severity: 'warning',
        description: `Code specifies "${callsite.model}" but runtime shows: ${runtimeModels.join(', ')}`,
        callsiteId: callsite.id,
        file: callsite.file,
        line: callsite.line,
        codeValue: callsite.model,
        runtimeValue: runtimeModels.join(', '),
        observationCount: events.length,
        evidence: [
          `Callsite matched by ID`,
          `${events.length} runtime observations`,
          `Runtime models: ${runtimeModels.join(', ')}`,
        ],
      });
    }
  }
  
  // Check provider mismatch
  if (callsite.provider) {
    const runtimeProviders = [...new Set(events.map(e => e.provider))];
    const providerMismatch = !runtimeProviders.includes(callsite.provider);
    
    if (providerMismatch) {
      drifts.push({
        type: 'provider_mismatch',
        severity: 'error',
        description: `Code specifies "${callsite.provider}" but runtime shows: ${runtimeProviders.join(', ')}`,
        callsiteId: callsite.id,
        file: callsite.file,
        line: callsite.line,
        codeValue: callsite.provider,
        runtimeValue: runtimeProviders.join(', '),
        observationCount: events.length,
        evidence: [
          `Callsite matched by ID`,
          `${events.length} runtime observations`,
          `Runtime providers: ${runtimeProviders.join(', ')}`,
        ],
      });
    }
  }
  
  return drifts;
}

/**
 * Detect pattern drift (patterns in code vs runtime behavior)
 */
function detectPatternMismatch(
  patterns: InferencePatterns,
  events: InferenceEvent[],
  callsites: Callsite[]
): DriftSignal[] {
  const drifts: DriftSignal[] = [];
  
  // Check streaming pattern
  if (patterns.streaming?.detected) {
    // Look for evidence of streaming in runtime (low TTFT, chunked responses)
    // This is a heuristic - true streaming detection would need more event metadata
    const avgLatency = events.reduce((sum, e) => sum + (e.latency_ms || 0), 0) / events.length;
    const avgOutputTokens = events.reduce((sum, e) => sum + (e.output_tokens || 0), 0) / events.length;
    
    // High latency per output token might indicate non-streaming
    const tokensPerSecond = avgOutputTokens / (avgLatency / 1000);
    
    if (tokensPerSecond < 10 && avgOutputTokens > 100) {
      // Suspiciously slow for streaming
      drifts.push({
        type: 'pattern_mismatch',
        severity: 'info',
        description: 'Streaming pattern detected in code but runtime latency suggests non-streaming responses',
        evidence: [
          `Streaming detected at: ${patterns.streaming.instances.map(i => `${i.file}:${i.line}`).join(', ')}`,
          `Avg tokens/sec: ${tokensPerSecond.toFixed(1)} (expected >50 for streaming)`,
          `This could indicate fake streaming or high latency`,
        ],
      });
    }
  }
  
  // Check batching pattern
  if (patterns.batching?.detected) {
    // Look for evidence of batching in runtime (multiple calls in short windows)
    const sortedEvents = [...events].sort((a, b) => 
      new Date(a.ts).getTime() - new Date(b.ts).getTime()
    );
    
    let batchedCalls = 0;
    for (let i = 1; i < sortedEvents.length; i++) {
      const delta = new Date(sortedEvents[i].ts).getTime() - new Date(sortedEvents[i-1].ts).getTime();
      if (delta < 100) { // < 100ms apart suggests batching
        batchedCalls++;
      }
    }
    
    const batchingRatio = sortedEvents.length > 1 ? batchedCalls / (sortedEvents.length - 1) : 0;
    
    if (batchingRatio < 0.1) {
      drifts.push({
        type: 'pattern_mismatch',
        severity: 'warning',
        description: 'Batching pattern detected in code but runtime shows sequential (non-batched) calls',
        evidence: [
          `Batching detected at: ${patterns.batching.instances.map(i => `${i.file}:${i.line}`).join(', ')}`,
          `Only ${(batchingRatio * 100).toFixed(1)}% of calls appear batched`,
          'Batching code may not be exercised or is ineffective',
        ],
      });
    }
  }
  
  // Check retry pattern
  if (patterns.retry?.detected) {
    // Look for evidence of retries (same intent repeated in short window)
    // This would require intent field - placeholder for now
  }
  
  // Check fallback pattern
  if (patterns.fallback?.detected) {
    // Look for multiple providers for same intent - suggests fallback was triggered
    const providersByIntent = new Map<string, Set<string>>();
    
    for (const event of events) {
      const intent = event.intent || 'unknown';
      if (!providersByIntent.has(intent)) {
        providersByIntent.set(intent, new Set());
      }
      providersByIntent.get(intent)!.add(event.provider);
    }
    
    const intentsWithMultipleProviders = [...providersByIntent.entries()]
      .filter(([_, providers]) => providers.size > 1);
    
    if (intentsWithMultipleProviders.length === 0 && events.length > 100) {
      drifts.push({
        type: 'pattern_mismatch',
        severity: 'info',
        description: 'Fallback pattern detected in code but runtime shows single provider per intent',
        evidence: [
          `Fallback detected at: ${patterns.fallback.instances.map(i => `${i.file}:${i.line}`).join(', ')}`,
          'No fallback triggers observed in runtime',
          'Fallback may be working correctly (no failures) or never tested',
        ],
      });
    }
  }
  
  return drifts;
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  computeUsageStats,
  detectMismatchDrift,
  detectPatternMismatch,
};


import { percentile } from './runtime.js';
import type { Callsite, InferenceEvent, JoinedOutput, DriftSignal, EnrichedCallsite, UsageStats } from './types.js';

// =============================================================================
// HELPERS
// =============================================================================

function computeUsageStats(events: InferenceEvent[]): UsageStats {
  const latencies = events.map(e => e.latency_ms);
  return {
    calls: events.length,
    tokens_in: events.reduce((sum, e) => sum + e.input_tokens, 0),
    tokens_out: events.reduce((sum, e) => sum + e.output_tokens, 0),
    latency_p50: percentile(latencies, 50),
    latency_p95: percentile(latencies, 95),
    latency_p99: percentile(latencies, 99),
  };
}

function makeKey(provider: string | null, model: string | null): string {
  return `${provider || 'unknown'}:${model || 'unknown'}`;
}

/**
 * Detect pattern drift between code-declared patterns and runtime behavior.
 *
 * Pattern types:
 * - streaming: Code says stream=true but runtime shows non-streaming (or vice versa)
 * - batching: Code declares batching but runtime shows no batch_id/batch_size
 * - fallback: Code declares fallback but no fallback_used events seen
 * - caching: Code declares caching but no cached events seen
 * - retries: Code declares retries but no retry_count > 0 events seen
 */
function detectPatternDrift(
  callsite: Callsite,
  events: InferenceEvent[]
): DriftSignal[] {
  const driftSignals: DriftSignal[] = [];
  const patterns = callsite.patterns;

  if (events.length === 0) {
    return driftSignals;
  }

  // Count events with each pattern
  const streamingEvents = events.filter(e => e.streaming === true).length;
  const nonStreamingEvents = events.filter(e => e.streaming === false).length;
  const batchedEvents = events.filter(e => e.batch_id || (e.batch_size && e.batch_size > 1)).length;
  const cachedEvents = events.filter(e => e.cached === true).length;
  const retriedEvents = events.filter(e => e.retry_count && e.retry_count > 0).length;
  const fallbackEvents = events.filter(e => e.fallback_used === true).length;

  // Calculate percentages
  const streamingPercent = (streamingEvents / events.length) * 100;
  const nonStreamingPercent = (nonStreamingEvents / events.length) * 100;

  // 1. Streaming drift detection
  if (patterns.streaming === true) {
    // Code declares streaming, check if runtime confirms
    if (nonStreamingPercent > 50) {
      driftSignals.push({
        type: 'patternDrift',
        callsiteId: callsite.id,
        provider: callsite.provider || undefined,
        model: callsite.model || undefined,
        message: `Streaming declared in code but ${nonStreamingPercent.toFixed(0)}% of runtime calls are non-streaming`,
      });
    } else if (streamingEvents === 0 && nonStreamingEvents === 0) {
      // No streaming info available - soft warning
      driftSignals.push({
        type: 'patternDrift',
        callsiteId: callsite.id,
        provider: callsite.provider || undefined,
        model: callsite.model || undefined,
        message: `Streaming declared in code but cannot verify from runtime data (no TTFT metrics)`,
      });
    }
  } else if (patterns.streaming === false) {
    // Code explicitly non-streaming, but runtime shows streaming
    if (streamingPercent > 50) {
      driftSignals.push({
        type: 'patternDrift',
        callsiteId: callsite.id,
        provider: callsite.provider || undefined,
        model: callsite.model || undefined,
        message: `Non-streaming declared in code but ${streamingPercent.toFixed(0)}% of runtime calls appear to stream`,
      });
    }
  }

  // 2. Batching drift detection
  if (patterns.batching === true && batchedEvents === 0) {
    driftSignals.push({
      type: 'patternDrift',
      callsiteId: callsite.id,
      provider: callsite.provider || undefined,
      model: callsite.model || undefined,
      message: `Batching declared in code but no batched requests observed at runtime`,
    });
  }

  // 3. Caching drift detection
  if (patterns.caching === true && cachedEvents === 0) {
    driftSignals.push({
      type: 'patternDrift',
      callsiteId: callsite.id,
      provider: callsite.provider || undefined,
      model: callsite.model || undefined,
      message: `Caching declared in code but no cache hits observed at runtime`,
    });
  }

  // 4. Retry drift detection
  if (patterns.retries === true && retriedEvents === 0) {
    // This could be good (no failures) or indicate retries aren't working
    // Only flag if there are a significant number of events
    if (events.length >= 10) {
      driftSignals.push({
        type: 'patternDrift',
        callsiteId: callsite.id,
        provider: callsite.provider || undefined,
        model: callsite.model || undefined,
        message: `Retries declared in code but no retry events observed (${events.length} calls, 0 retries)`,
      });
    }
  }

  // 5. Fallback drift detection
  if (patterns.fallback === true && fallbackEvents === 0) {
    // This could be good (primary always works) or indicate fallback isn't working
    // Only flag if there are a significant number of events
    if (events.length >= 10) {
      driftSignals.push({
        type: 'patternDrift',
        callsiteId: callsite.id,
        provider: callsite.provider || undefined,
        model: callsite.model || undefined,
        message: `Fallback declared in code but never triggered at runtime (${events.length} calls)`,
      });
    }
  }

  return driftSignals;
}

// =============================================================================
// PUBLIC API
// =============================================================================

export function join(callsites: Callsite[], events: InferenceEvent[]): JoinedOutput {
  const codeOnly: Callsite[] = [];
  const runtimeOnly: InferenceEvent[] = [];
  const drift: DriftSignal[] = [];
  const enrichedCallsites: EnrichedCallsite[] = [];

  // Separate events: those with callsite_id vs those without
  const eventsByCallsiteId = new Map<string, InferenceEvent[]>();
  const eventsWithoutCallsiteId: InferenceEvent[] = [];

  for (const event of events) {
    if (event.callsite_id) {
      // Events with callsite_id ONLY match by callsite_id, not by provider+model
      if (!eventsByCallsiteId.has(event.callsite_id)) {
        eventsByCallsiteId.set(event.callsite_id, []);
      }
      eventsByCallsiteId.get(event.callsite_id)!.push(event);
    } else {
      // Events without callsite_id will be matched by provider+model
      eventsWithoutCallsiteId.push(event);
    }
  }

  // Group events without callsite_id by provider+model
  const eventsByKey = new Map<string, InferenceEvent[]>();
  for (const event of eventsWithoutCallsiteId) {
    const key = makeKey(event.provider, event.model);
    if (!eventsByKey.has(key)) {
      eventsByKey.set(key, []);
    }
    eventsByKey.get(key)!.push(event);
  }

  // Track which keys have been matched
  const matchedKeys = new Set<string>();
  const matchedCallsiteIds = new Set<string>();

  // Match callsites to events
  for (const callsite of callsites) {
    let matchedEvents: InferenceEvent[] = [];

    // Priority 1: Match by callsite_id (events that explicitly reference this callsite)
    if (eventsByCallsiteId.has(callsite.id)) {
      matchedEvents = eventsByCallsiteId.get(callsite.id)!;
      matchedCallsiteIds.add(callsite.id);
    }

    // Priority 2: Match by provider+model (only for events without callsite_id)
    if (matchedEvents.length === 0) {
      const key = makeKey(callsite.provider, callsite.model);
      const keyEvents = eventsByKey.get(key);
      if (keyEvents && keyEvents.length > 0) {
        matchedEvents = keyEvents;
        matchedKeys.add(key);
      }
    }

    // Build enriched callsite
    if (matchedEvents.length > 0) {
      const usage = computeUsageStats(matchedEvents);
      enrichedCallsites.push({ ...callsite, usage });

      // Detect pattern drift for matched callsites
      const patternDrift = detectPatternDrift(callsite, matchedEvents);
      drift.push(...patternDrift);
    } else {
      // No matching events - this is code-only
      enrichedCallsites.push(callsite);
      codeOnly.push(callsite);

      drift.push({
        type: 'codeOnly',
        provider: callsite.provider || undefined,
        model: callsite.model || undefined,
        callsiteId: callsite.id,
        message: `Callsite ${callsite.file}:${callsite.line} has no runtime events`,
      });
    }
  }

  // Find runtime-only events
  // 1. Events with callsite_id that don't match any callsite
  for (const [callsiteId, evts] of eventsByCallsiteId) {
    if (!matchedCallsiteIds.has(callsiteId)) {
      runtimeOnly.push(...evts);
    }
  }

  // 2. Events without callsite_id whose key wasn't matched
  for (const [key, evts] of eventsByKey) {
    if (!matchedKeys.has(key)) {
      runtimeOnly.push(...evts);
    }
  }

  // Generate drift signals for runtime-only events (grouped by provider+model)
  const runtimeOnlyByKey = new Map<string, InferenceEvent[]>();
  for (const event of runtimeOnly) {
    const key = makeKey(event.provider, event.model);
    if (!runtimeOnlyByKey.has(key)) {
      runtimeOnlyByKey.set(key, []);
    }
    runtimeOnlyByKey.get(key)!.push(event);
  }

  for (const [key, evts] of runtimeOnlyByKey) {
    const [provider, model] = key.split(':');
    drift.push({
      type: 'runtimeOnly',
      provider: provider || undefined,
      model: model || undefined,
      message: `${evts.length} events for ${key} with no matching code`,
    });
  }

  return {
    callsites: enrichedCallsites,
    codeOnly,
    runtimeOnly,
    drift,
  };
}

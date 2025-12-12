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

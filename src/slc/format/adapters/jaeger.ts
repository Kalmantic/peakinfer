/**
 * Jaeger Adapter - PeakInfer TDD v1.3
 * 
 * Transforms Jaeger trace exports into InferenceEvents.
 */

import type { InferenceEvent } from '../../../types/events.js';

// =============================================================================
// JAEGER TYPES
// =============================================================================

interface JaegerTag {
  key: string;
  type: string;
  value: string | number | boolean;
}

interface JaegerLog {
  timestamp: number;
  fields: JaegerTag[];
}

interface JaegerSpan {
  traceID: string;
  spanID: string;
  operationName: string;
  references?: Array<{ refType: string; traceID: string; spanID: string }>;
  startTime: number; // microseconds
  duration: number; // microseconds
  tags?: JaegerTag[];
  logs?: JaegerLog[];
  processID: string;
}

interface JaegerProcess {
  serviceName: string;
  tags?: JaegerTag[];
}

interface JaegerTrace {
  traceID: string;
  spans: JaegerSpan[];
  processes: Record<string, JaegerProcess>;
}

interface JaegerExport {
  data: JaegerTrace[];
}

// =============================================================================
// LLM ATTRIBUTE KEYS
// =============================================================================

const LLM_PROVIDER_TAGS = [
  'llm.provider', 'ai.provider', 'service.name', 'component',
];

const LLM_MODEL_TAGS = [
  'llm.model', 'ai.model', 'model.name', 'llm.request.model',
];

const LLM_INPUT_TOKENS_TAGS = [
  'llm.usage.prompt_tokens', 'ai.input_tokens', 'prompt_tokens',
];

const LLM_OUTPUT_TOKENS_TAGS = [
  'llm.usage.completion_tokens', 'ai.output_tokens', 'completion_tokens',
];

// =============================================================================
// MAIN ADAPTER
// =============================================================================

/**
 * Parse a Jaeger export into InferenceEvents
 */
export function parseJaegerExport(data: unknown): InferenceEvent[] {
  const events: InferenceEvent[] = [];
  
  if (!data || typeof data !== 'object') {
    return events;
  }
  
  const jaegerData = data as JaegerExport;
  
  if (!jaegerData.data || !Array.isArray(jaegerData.data)) {
    return events;
  }
  
  for (const trace of jaegerData.data) {
    const processes = trace.processes || {};
    
    for (const span of trace.spans) {
      const process = processes[span.processID];
      const event = jaegerSpanToEvent(span, process);
      
      if (event) {
        events.push(event);
      }
    }
  }
  
  return events;
}

/**
 * Check if data looks like a Jaeger export
 */
export function isJaegerFormat(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  
  const obj = data as Record<string, unknown>;
  
  if (!('data' in obj) || !Array.isArray(obj.data)) return false;
  
  // Check first trace has expected structure
  const firstTrace = obj.data[0];
  if (!firstTrace || typeof firstTrace !== 'object') return false;
  
  const trace = firstTrace as Record<string, unknown>;
  return 'traceID' in trace && 'spans' in trace;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Convert a Jaeger span to an InferenceEvent
 */
function jaegerSpanToEvent(span: JaegerSpan, process?: JaegerProcess): InferenceEvent | null {
  const tags = tagsToMap(span.tags);
  const processTags = tagsToMap(process?.tags);
  const allTags = { ...processTags, ...tags };
  
  // Check if this is an LLM span
  if (!isLlmSpan(span.operationName, allTags)) {
    return null;
  }
  
  const provider = findTag(allTags, LLM_PROVIDER_TAGS) || 
                   (process?.serviceName || 'unknown');
  const model = findTag(allTags, LLM_MODEL_TAGS) || 'unknown';
  const inputTokens = parseInt(String(findTag(allTags, LLM_INPUT_TOKENS_TAGS) || '0'), 10);
  const outputTokens = parseInt(String(findTag(allTags, LLM_OUTPUT_TOKENS_TAGS) || '0'), 10);
  
  // Jaeger times are in microseconds
  const timestamp = new Date(span.startTime / 1000).toISOString();
  const durationMs = span.duration / 1000;
  
  return {
    id: span.spanID,
    ts: timestamp,
    intent: span.operationName,
    provider: String(provider),
    model: String(model),
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    latency_ms: durationMs,
    cost_usd: 0,
    endpoint: String(allTags['http.url'] || allTags['peer.address'] || ''),
    region: String(allTags['region'] || ''),
    tenant: process?.serviceName || '',
  };
}

/**
 * Check if a span is LLM-related
 */
function isLlmSpan(operationName: string, tags: Record<string, unknown>): boolean {
  const llmKeywords = ['llm', 'openai', 'anthropic', 'completion', 'chat', 'embedding', 'gpt', 'claude'];
  const opNameLower = operationName.toLowerCase();
  
  if (llmKeywords.some(kw => opNameLower.includes(kw))) {
    return true;
  }
  
  // Check for LLM tags
  return LLM_PROVIDER_TAGS.some(k => k in tags) ||
         LLM_MODEL_TAGS.some(k => k in tags);
}

/**
 * Convert Jaeger tags array to a map
 */
function tagsToMap(tags?: JaegerTag[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  
  if (!tags) return result;
  
  for (const tag of tags) {
    result[tag.key] = tag.value;
  }
  
  return result;
}

/**
 * Find a tag value from possible keys
 */
function findTag(tags: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (key in tags && tags[key] !== undefined && tags[key] !== null) {
      return tags[key];
    }
  }
  return null;
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  jaegerSpanToEvent,
  isLlmSpan,
  tagsToMap,
  findTag,
};

/**
 * Zipkin Adapter - PeakInfer TDD v1.3
 * 
 * Transforms Zipkin trace exports into InferenceEvents.
 * https://zipkin.io/pages/data_model.html
 */

import type { InferenceEvent } from '../../../types/events.js';

// =============================================================================
// ZIPKIN TYPES
// =============================================================================

interface ZipkinAnnotation {
  timestamp: number; // microseconds
  value: string;
}

interface ZipkinSpan {
  traceId: string;
  id: string;
  parentId?: string;
  name: string;
  kind?: 'CLIENT' | 'SERVER' | 'PRODUCER' | 'CONSUMER';
  timestamp?: number; // microseconds
  duration?: number; // microseconds
  localEndpoint?: {
    serviceName?: string;
    ipv4?: string;
    port?: number;
  };
  remoteEndpoint?: {
    serviceName?: string;
    ipv4?: string;
    port?: number;
  };
  annotations?: ZipkinAnnotation[];
  tags?: Record<string, string>;
  debug?: boolean;
  shared?: boolean;
}

// =============================================================================
// LLM TAG KEYS
// =============================================================================

const LLM_PROVIDER_TAGS = [
  'llm.provider', 'ai.provider', 'peer.service', 'service.name',
];

const LLM_MODEL_TAGS = [
  'llm.model', 'ai.model', 'llm.request.model', 'model.name',
];

const LLM_INPUT_TOKENS_TAGS = [
  'llm.usage.prompt_tokens', 'ai.input_tokens', 'llm.tokens.input',
];

const LLM_OUTPUT_TOKENS_TAGS = [
  'llm.usage.completion_tokens', 'ai.output_tokens', 'llm.tokens.output',
];

// =============================================================================
// MAIN ADAPTER
// =============================================================================

/**
 * Parse Zipkin export into InferenceEvents
 */
export function parseZipkinExport(data: unknown): InferenceEvent[] {
  const events: InferenceEvent[] = [];
  
  if (!data) return events;
  
  // Zipkin exports are arrays of spans
  if (!Array.isArray(data)) {
    return events;
  }
  
  for (const span of data) {
    if (!isZipkinSpan(span)) continue;
    
    const event = zipkinSpanToEvent(span);
    if (event) {
      events.push(event);
    }
  }
  
  return events;
}

/**
 * Check if data looks like a Zipkin export
 */
export function isZipkinFormat(data: unknown): boolean {
  if (!Array.isArray(data) || data.length === 0) return false;
  
  const first = data[0];
  if (typeof first !== 'object' || first === null) return false;
  
  // Zipkin spans have traceId, id, and optionally kind
  return 'traceId' in first && 'id' in first && 
         (('kind' in first) || ('name' in first));
}

// =============================================================================
// HELPERS
// =============================================================================

function isZipkinSpan(span: unknown): span is ZipkinSpan {
  if (typeof span !== 'object' || span === null) return false;
  const s = span as Record<string, unknown>;
  return typeof s.traceId === 'string' && typeof s.id === 'string';
}

function zipkinSpanToEvent(span: ZipkinSpan): InferenceEvent | null {
  const tags = span.tags || {};
  
  // Check if this is an LLM span
  if (!isLlmSpan(span.name, tags)) {
    return null;
  }
  
  const provider = findTag(tags, LLM_PROVIDER_TAGS) || 
                   span.remoteEndpoint?.serviceName ||
                   span.localEndpoint?.serviceName ||
                   'unknown';
  
  const model = findTag(tags, LLM_MODEL_TAGS) || 'unknown';
  const inputTokens = parseInt(findTag(tags, LLM_INPUT_TOKENS_TAGS) || '0', 10);
  const outputTokens = parseInt(findTag(tags, LLM_OUTPUT_TOKENS_TAGS) || '0', 10);
  
  // Zipkin times are in microseconds
  const timestamp = span.timestamp 
    ? new Date(span.timestamp / 1000).toISOString()
    : new Date().toISOString();
  
  const durationMs = span.duration ? span.duration / 1000 : 0;
  
  return {
    id: span.id,
    ts: timestamp,
    intent: span.name,
    provider: String(provider),
    model: String(model),
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    latency_ms: durationMs,
    cost_usd: 0,
    endpoint: span.remoteEndpoint?.ipv4 
      ? `${span.remoteEndpoint.ipv4}:${span.remoteEndpoint.port || 80}`
      : '',
    region: tags['cloud.region'] || tags['region'] || '',
    tenant: span.localEndpoint?.serviceName || '',
    metadata: {
      traceId: span.traceId,
      parentId: span.parentId,
      kind: span.kind,
      tags,
    },
  };
}

function isLlmSpan(name: string, tags: Record<string, string>): boolean {
  const llmKeywords = ['llm', 'openai', 'anthropic', 'completion', 'chat', 'embedding', 'gpt', 'claude'];
  const nameLower = name.toLowerCase();
  
  if (llmKeywords.some(kw => nameLower.includes(kw))) {
    return true;
  }
  
  return LLM_PROVIDER_TAGS.some(k => k in tags) ||
         LLM_MODEL_TAGS.some(k => k in tags);
}

function findTag(tags: Record<string, string>, keys: string[]): string | null {
  for (const key of keys) {
    if (key in tags && tags[key]) {
      return tags[key];
    }
  }
  return null;
}

// =============================================================================
// EXPORTS
// =============================================================================

export { zipkinSpanToEvent, isLlmSpan, findTag };

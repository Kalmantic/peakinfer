/**
 * OpenTelemetry Adapter - PeakInfer TDD v1.3
 * 
 * Transforms OpenTelemetry OTLP spans into InferenceEvents.
 * Supports both JSON export formats (resourceSpans, scopeSpans).
 */

import type { InferenceEvent } from '../../../types/events.js';
import type { FieldMapping } from '../schemas.js';

// =============================================================================
// OTEL TYPES (subset for our needs)
// =============================================================================

interface OtelResource {
  attributes?: OtelAttribute[];
}

interface OtelAttribute {
  key: string;
  value: {
    stringValue?: string;
    intValue?: number | string;
    doubleValue?: number;
    boolValue?: boolean;
    arrayValue?: { values: OtelAttribute['value'][] };
  };
}

interface OtelSpan {
  traceId: string;
  spanId: string;
  name: string;
  kind: number;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes?: OtelAttribute[];
  status?: { code: number; message?: string };
}

interface OtelScopeSpans {
  scope?: { name: string; version?: string };
  spans: OtelSpan[];
}

interface OtelResourceSpans {
  resource?: OtelResource;
  scopeSpans?: OtelScopeSpans[];
  instrumentationLibrarySpans?: OtelScopeSpans[]; // Legacy field
}

interface OtelExport {
  resourceSpans?: OtelResourceSpans[];
}

// =============================================================================
// FIELD MAPPINGS FOR OTEL
// =============================================================================

export const OTEL_FIELD_MAPPINGS: FieldMapping[] = [
  {
    targetField: 'id',
    sourceExpression: 'spanId',
    extractionType: 'jsonpath',
    confidence: 1.0,
    evidence: 'OTLP span ID',
  },
  {
    targetField: 'ts',
    sourceExpression: 'startTimeUnixNano',
    extractionType: 'computed',
    transform: 'nano_to_iso',
    confidence: 1.0,
    evidence: 'OTLP start time',
  },
  {
    targetField: 'latency_ms',
    sourceExpression: 'duration_ns',
    extractionType: 'computed',
    transform: 'nano_to_ms',
    confidence: 1.0,
    evidence: 'Computed from start/end time',
  },
];

// LLM-related attribute keys to look for
const LLM_PROVIDER_ATTRS = [
  'llm.provider', 'gen_ai.system', 'llm.system', 'ai.provider',
  'service.name', 'db.system',
];

const LLM_MODEL_ATTRS = [
  'llm.model', 'gen_ai.request.model', 'llm.request.model', 'ai.model',
  'gen_ai.response.model', 'llm.response.model',
];

const LLM_INPUT_TOKENS_ATTRS = [
  'llm.usage.prompt_tokens', 'gen_ai.usage.input_tokens',
  'llm.usage.input_tokens', 'ai.input_tokens',
];

const LLM_OUTPUT_TOKENS_ATTRS = [
  'llm.usage.completion_tokens', 'gen_ai.usage.output_tokens',
  'llm.usage.output_tokens', 'ai.output_tokens',
];

const LLM_INTENT_ATTRS = [
  'llm.request.type', 'gen_ai.operation.name', 'ai.operation',
  'span.name', 'operation.name',
];

// =============================================================================
// MAIN ADAPTER
// =============================================================================

/**
 * Parse an OpenTelemetry export into InferenceEvents
 */
export function parseOtelExport(data: unknown): InferenceEvent[] {
  const events: InferenceEvent[] = [];
  
  if (!data || typeof data !== 'object') {
    return events;
  }
  
  const otelData = data as OtelExport;
  
  // Handle resourceSpans format
  if (otelData.resourceSpans) {
    for (const resourceSpan of otelData.resourceSpans) {
      const resourceAttrs = extractAttributes(resourceSpan.resource?.attributes);
      
      // Get spans from scopeSpans or legacy instrumentationLibrarySpans
      const scopeSpans = resourceSpan.scopeSpans || resourceSpan.instrumentationLibrarySpans || [];
      
      for (const scopeSpan of scopeSpans) {
        for (const span of scopeSpan.spans) {
          const event = spanToEvent(span, resourceAttrs);
          if (event) {
            events.push(event);
          }
        }
      }
    }
  }
  
  return events;
}

/**
 * Check if data looks like an OTEL export
 */
export function isOtelFormat(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  
  const obj = data as Record<string, unknown>;
  return 'resourceSpans' in obj || 'scopeSpans' in obj;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Convert an OTEL span to an InferenceEvent
 */
function spanToEvent(span: OtelSpan, resourceAttrs: Record<string, unknown>): InferenceEvent | null {
  const spanAttrs = extractAttributes(span.attributes);
  const allAttrs = { ...resourceAttrs, ...spanAttrs };
  
  // Check if this span is LLM-related
  if (!isLlmSpan(span, allAttrs)) {
    return null;
  }
  
  // Extract fields
  const provider = findAttribute(allAttrs, LLM_PROVIDER_ATTRS) || 'unknown';
  const model = findAttribute(allAttrs, LLM_MODEL_ATTRS) || 'unknown';
  const inputTokens = parseInt(String(findAttribute(allAttrs, LLM_INPUT_TOKENS_ATTRS) || '0'), 10);
  const outputTokens = parseInt(String(findAttribute(allAttrs, LLM_OUTPUT_TOKENS_ATTRS) || '0'), 10);
  const intent = findAttribute(allAttrs, LLM_INTENT_ATTRS) || span.name || 'unknown';
  
  // Calculate duration
  const startNano = BigInt(span.startTimeUnixNano);
  const endNano = BigInt(span.endTimeUnixNano);
  const durationMs = Number((endNano - startNano) / BigInt(1000000));
  
  // Convert timestamp
  const timestamp = new Date(Number(startNano / BigInt(1000000))).toISOString();
  
  return {
    id: span.spanId,
    ts: timestamp,
    intent: String(intent),
    provider: String(provider),
    model: String(model),
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    latency_ms: durationMs,
    cost_usd: 0, // Would need pricing lookup
    endpoint: String(allAttrs['http.url'] || allAttrs['server.address'] || ''),
    region: String(allAttrs['cloud.region'] || allAttrs['deployment.environment'] || ''),
    tenant: String(allAttrs['service.name'] || ''),
  };
}

/**
 * Check if a span is LLM-related
 */
function isLlmSpan(span: OtelSpan, attrs: Record<string, unknown>): boolean {
  // Check span name
  const llmKeywords = ['llm', 'openai', 'anthropic', 'completion', 'chat', 'embedding', 'gpt', 'claude'];
  const spanNameLower = span.name.toLowerCase();
  
  if (llmKeywords.some(kw => spanNameLower.includes(kw))) {
    return true;
  }
  
  // Check for LLM-specific attributes
  const hasLlmAttrs = LLM_PROVIDER_ATTRS.some(k => k in attrs) ||
                      LLM_MODEL_ATTRS.some(k => k in attrs);
  
  return hasLlmAttrs;
}

/**
 * Extract attributes from OTEL attribute array to a plain object
 */
function extractAttributes(attrs?: OtelAttribute[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  
  if (!attrs) return result;
  
  for (const attr of attrs) {
    const value = attr.value;
    if (value.stringValue !== undefined) {
      result[attr.key] = value.stringValue;
    } else if (value.intValue !== undefined) {
      result[attr.key] = typeof value.intValue === 'string' 
        ? parseInt(value.intValue, 10) 
        : value.intValue;
    } else if (value.doubleValue !== undefined) {
      result[attr.key] = value.doubleValue;
    } else if (value.boolValue !== undefined) {
      result[attr.key] = value.boolValue;
    }
  }
  
  return result;
}

/**
 * Find an attribute value from a list of possible keys
 */
function findAttribute(attrs: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (key in attrs && attrs[key] !== undefined && attrs[key] !== null && attrs[key] !== '') {
      return attrs[key];
    }
  }
  return null;
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  spanToEvent,
  isLlmSpan,
  extractAttributes,
  findAttribute,
};

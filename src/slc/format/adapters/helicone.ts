/**
 * Helicone Adapter - PeakInfer TDD v1.3
 * 
 * Transforms Helicone proxy logs into InferenceEvents.
 */

import type { InferenceEvent } from '../../../types/events.js';

// =============================================================================
// HELICONE TYPES
// =============================================================================

interface HeliconeRequest {
  id: string;
  created_at: string;
  request: {
    model?: string;
    messages?: unknown[];
    prompt?: string;
    max_tokens?: number;
  };
  response: {
    model?: string;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
    choices?: unknown[];
  };
  properties?: Record<string, string>;
  latency?: number;
  user_id?: string;
  model?: string;
  provider?: string;
  request_id?: string;
  cost?: number;
  // Additional fields that might be present
  status?: number;
  target_url?: string;
}

// =============================================================================
// MAIN ADAPTER
// =============================================================================

/**
 * Parse Helicone export into InferenceEvents
 */
export function parseHeliconeExport(data: unknown): InferenceEvent[] {
  const events: InferenceEvent[] = [];
  
  if (!data) return events;
  
  // Handle array of requests
  if (Array.isArray(data)) {
    for (const request of data) {
      const event = heliconeToEvent(request);
      if (event) {
        events.push(event);
      }
    }
    return events;
  }
  
  // Handle single request
  if (typeof data === 'object') {
    const request = data as HeliconeRequest;
    if (request.request && request.response) {
      const event = heliconeToEvent(request);
      if (event) {
        events.push(event);
      }
    }
  }
  
  return events;
}

/**
 * Check if data looks like a Helicone export
 */
export function isHeliconeFormat(data: unknown): boolean {
  if (!data) return false;
  
  // Check single object
  if (typeof data === 'object' && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    return 'request' in obj && 'response' in obj && 'properties' in obj;
  }
  
  // Check array
  if (Array.isArray(data) && data.length > 0) {
    const first = data[0];
    if (typeof first === 'object' && first !== null) {
      return 'request' in first && 'response' in first;
    }
  }
  
  return false;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Convert a Helicone request to an InferenceEvent
 */
function heliconeToEvent(data: unknown): InferenceEvent | null {
  if (!data || typeof data !== 'object') return null;
  
  const h = data as HeliconeRequest;
  
  if (!h.request || !h.response) return null;
  
  // Extract model (check multiple places)
  const model = h.model || 
                h.response.model || 
                h.request.model || 
                'unknown';
  
  // Extract provider from model or explicit field
  const provider = h.provider || extractProviderFromModel(model);
  
  // Extract token usage
  const inputTokens = h.response.usage?.prompt_tokens || 0;
  const outputTokens = h.response.usage?.completion_tokens || 0;
  
  // Extract latency
  const latencyMs = h.latency || 0;
  
  // Extract intent from properties or infer from request
  const intent = h.properties?.intent || 
                 h.properties?.operation ||
                 inferIntent(h.request);
  
  return {
    id: h.id || h.request_id || `helicone_${Date.now()}`,
    ts: h.created_at,
    intent,
    provider,
    model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    latency_ms: latencyMs,
    cost_usd: h.cost || 0,
    endpoint: h.target_url || '',
    region: h.properties?.region || '',
    tenant: h.user_id || h.properties?.tenant || '',
    metadata: {
      properties: h.properties,
      status: h.status,
    },
  };
}

/**
 * Extract provider from model name
 */
function extractProviderFromModel(model: string): string {
  const modelLower = model.toLowerCase();
  
  if (modelLower.includes('gpt') || modelLower.startsWith('text-')) return 'openai';
  if (modelLower.includes('claude')) return 'anthropic';
  if (modelLower.includes('gemini') || modelLower.includes('palm')) return 'google';
  if (modelLower.includes('llama')) return 'meta';
  if (modelLower.includes('mistral')) return 'mistral';
  if (modelLower.includes('command')) return 'cohere';
  
  return 'unknown';
}

/**
 * Infer intent from request structure
 */
function inferIntent(request: HeliconeRequest['request']): string {
  if (request.messages && Array.isArray(request.messages)) {
    // Check if it's a chat completion
    return 'chat';
  }
  
  if (request.prompt) {
    return 'completion';
  }
  
  return 'unknown';
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  heliconeToEvent,
  extractProviderFromModel,
  inferIntent,
};

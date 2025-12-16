/**
 * Portkey Adapter - PeakInfer TDD v1.3
 * 
 * Transforms Portkey gateway logs into InferenceEvents.
 * Portkey is an AI gateway that provides observability and control.
 */

import type { InferenceEvent } from '../../../types/events.js';

// =============================================================================
// PORTKEY TYPES
// =============================================================================

interface PortkeyLogEntry {
  // Request identifiers
  request_id?: string;
  trace_id?: string;
  span_id?: string;
  
  // Request info
  request?: {
    model?: string;
    messages?: unknown[];
    max_tokens?: number;
    temperature?: number;
    provider?: string;
  };
  
  // Response info
  response?: {
    id?: string;
    model?: string;
    choices?: unknown[];
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  };
  
  // Portkey-specific
  virtual_key?: string;
  config?: {
    provider?: string;
    api_key?: string;
    override_params?: Record<string, unknown>;
    retry?: {
      attempts?: number;
      on_status_codes?: number[];
    };
    cache?: {
      mode?: string;
      max_age?: number;
    };
  };
  
  // Metadata
  metadata?: Record<string, string>;
  custom_metadata?: Record<string, string>;
  
  // Timing
  created_at?: string;
  request_start_time?: number;
  request_end_time?: number;
  latency_ms?: number;
  
  // Cost
  cost?: number;
  
  // Status
  status?: 'success' | 'failure' | 'cached';
  error?: {
    message?: string;
    type?: string;
  };
  
  // Cache info
  cache_status?: 'HIT' | 'MISS' | 'DISABLED';
}

// =============================================================================
// MAIN ADAPTER
// =============================================================================

/**
 * Parse Portkey logs into InferenceEvents
 */
export function parsePortkeyExport(data: unknown): InferenceEvent[] {
  const events: InferenceEvent[] = [];
  
  if (!data) return events;
  
  // Handle array of log entries
  if (Array.isArray(data)) {
    for (const entry of data) {
      const event = portkeyEntryToEvent(entry);
      if (event) {
        events.push(event);
      }
    }
    return events;
  }
  
  // Handle single entry
  if (typeof data === 'object') {
    const event = portkeyEntryToEvent(data as PortkeyLogEntry);
    if (event) {
      events.push(event);
    }
  }
  
  return events;
}

/**
 * Check if data looks like Portkey logs
 */
export function isPortkeyFormat(data: unknown): boolean {
  if (!data) return false;
  
  const checkEntry = (entry: unknown): boolean => {
    if (typeof entry !== 'object' || entry === null) return false;
    const e = entry as Record<string, unknown>;
    
    // Check for Portkey-specific fields
    return 'virtual_key' in e || 
           ('config' in e && typeof e.config === 'object') ||
           ('request' in e && 'response' in e && 'cache_status' in e);
  };
  
  if (Array.isArray(data) && data.length > 0) {
    return checkEntry(data[0]);
  }
  
  return checkEntry(data);
}

// =============================================================================
// HELPERS
// =============================================================================

function portkeyEntryToEvent(entry: unknown): InferenceEvent | null {
  if (typeof entry !== 'object' || entry === null) return null;
  
  const e = entry as PortkeyLogEntry;
  
  // Skip failed requests (unless you want to track them)
  if (e.status === 'failure') {
    return null;
  }
  
  // Extract model
  const model = e.response?.model || 
                e.request?.model || 
                'unknown';
  
  // Extract provider
  const provider = e.request?.provider || 
                   e.config?.provider ||
                   inferProvider(model);
  
  // Extract tokens
  const usage = e.response?.usage;
  const inputTokens = usage?.prompt_tokens || 0;
  const outputTokens = usage?.completion_tokens || 0;
  
  // Extract timestamp
  let timestamp: string;
  if (e.created_at) {
    timestamp = e.created_at;
  } else if (e.request_start_time) {
    timestamp = new Date(e.request_start_time).toISOString();
  } else {
    timestamp = new Date().toISOString();
  }
  
  // Calculate latency
  let latencyMs = e.latency_ms || 0;
  if (!latencyMs && e.request_start_time && e.request_end_time) {
    latencyMs = e.request_end_time - e.request_start_time;
  }
  
  // Determine intent from metadata or request type
  const intent = e.metadata?.intent || 
                 e.custom_metadata?.operation ||
                 (e.request?.messages ? 'chat' : 'completion');
  
  return {
    id: e.request_id || e.response?.id || `portkey_${Date.now()}`,
    ts: timestamp,
    intent,
    provider: String(provider),
    model: String(model),
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    latency_ms: latencyMs,
    cost_usd: e.cost || 0,
    endpoint: '',
    region: e.metadata?.region || '',
    tenant: e.metadata?.tenant || e.custom_metadata?.user_id || '',
    metadata: {
      trace_id: e.trace_id,
      span_id: e.span_id,
      virtual_key: e.virtual_key ? '***' : undefined, // Redact
      cache_status: e.cache_status,
      status: e.status,
    },
  };
}

function inferProvider(model: string): string {
  const modelLower = model.toLowerCase();
  
  if (modelLower.includes('gpt') || modelLower.startsWith('text-')) return 'openai';
  if (modelLower.includes('claude')) return 'anthropic';
  if (modelLower.includes('gemini') || modelLower.includes('palm')) return 'google';
  if (modelLower.includes('llama')) return 'meta';
  if (modelLower.includes('mistral')) return 'mistral';
  if (modelLower.includes('command')) return 'cohere';
  
  return 'unknown';
}

// =============================================================================
// EXPORTS
// =============================================================================

export { portkeyEntryToEvent, inferProvider };

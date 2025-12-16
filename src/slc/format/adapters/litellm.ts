/**
 * LiteLLM Adapter - PeakInfer TDD v1.3
 * 
 * Transforms LiteLLM proxy logs into InferenceEvents.
 * LiteLLM is a popular proxy for unifying LLM APIs.
 */

import type { InferenceEvent } from '../../../types/events.js';

// =============================================================================
// LITELLM TYPES
// =============================================================================

interface LiteLLMLogEntry {
  // Request info
  id?: string;
  call_type?: string;
  model?: string;
  messages?: unknown[];
  
  // LiteLLM specific
  litellm_params?: {
    model?: string;
    api_key?: string;
    api_base?: string;
    custom_llm_provider?: string;
  };
  
  // Usage
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  
  // Response
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
  
  // Metadata
  startTime?: number | string;
  endTime?: number | string;
  response_time?: number;
  api_key?: string;
  api_base?: string;
  custom_llm_provider?: string;
  
  // Cost tracking
  response_cost?: number;
  
  // Error info
  exception?: string;
  status?: string;
}

// =============================================================================
// MAIN ADAPTER
// =============================================================================

/**
 * Parse LiteLLM logs into InferenceEvents
 */
export function parseLiteLLMExport(data: unknown): InferenceEvent[] {
  const events: InferenceEvent[] = [];
  
  if (!data) return events;
  
  // Handle array of log entries
  if (Array.isArray(data)) {
    for (const entry of data) {
      const event = litellmEntryToEvent(entry);
      if (event) {
        events.push(event);
      }
    }
    return events;
  }
  
  // Handle single entry
  if (typeof data === 'object') {
    const event = litellmEntryToEvent(data as LiteLLMLogEntry);
    if (event) {
      events.push(event);
    }
  }
  
  return events;
}

/**
 * Check if data looks like LiteLLM logs
 */
export function isLiteLLMFormat(data: unknown): boolean {
  if (!data) return false;
  
  const checkEntry = (entry: unknown): boolean => {
    if (typeof entry !== 'object' || entry === null) return false;
    const e = entry as Record<string, unknown>;
    
    // Check for LiteLLM-specific fields
    return 'litellm_params' in e || 
           'custom_llm_provider' in e ||
           ('call_type' in e && 'model' in e);
  };
  
  if (Array.isArray(data) && data.length > 0) {
    return checkEntry(data[0]);
  }
  
  return checkEntry(data);
}

// =============================================================================
// HELPERS
// =============================================================================

function litellmEntryToEvent(entry: unknown): InferenceEvent | null {
  if (typeof entry !== 'object' || entry === null) return null;
  
  const e = entry as LiteLLMLogEntry;
  
  // Skip failed requests
  if (e.exception || e.status === 'failed') {
    return null;
  }
  
  // Extract model
  const model = e.response?.model || 
                e.model || 
                e.litellm_params?.model || 
                'unknown';
  
  // Extract provider
  const provider = e.custom_llm_provider || 
                   e.litellm_params?.custom_llm_provider ||
                   inferProviderFromModel(model) ||
                   inferProviderFromApiBase(e.api_base || e.litellm_params?.api_base);
  
  // Extract tokens
  const usage = e.response?.usage || e.usage;
  const inputTokens = usage?.prompt_tokens || 0;
  const outputTokens = usage?.completion_tokens || 0;
  
  // Extract timestamp
  let timestamp: string;
  if (e.startTime) {
    timestamp = typeof e.startTime === 'number' 
      ? new Date(e.startTime * 1000).toISOString()
      : new Date(e.startTime).toISOString();
  } else {
    timestamp = new Date().toISOString();
  }
  
  // Calculate latency
  let latencyMs = 0;
  if (e.response_time) {
    latencyMs = e.response_time;
  } else if (e.startTime && e.endTime) {
    const start = typeof e.startTime === 'number' ? e.startTime : new Date(e.startTime).getTime() / 1000;
    const end = typeof e.endTime === 'number' ? e.endTime : new Date(e.endTime).getTime() / 1000;
    latencyMs = (end - start) * 1000;
  }
  
  return {
    id: e.id || e.response?.id || `litellm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    ts: timestamp,
    intent: e.call_type || 'completion',
    provider: String(provider),
    model: String(model),
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    latency_ms: latencyMs,
    cost_usd: e.response_cost || 0,
    endpoint: e.api_base || e.litellm_params?.api_base || '',
    region: '',
    tenant: '',
    metadata: {
      call_type: e.call_type,
      litellm_params: e.litellm_params,
    },
  };
}

function inferProviderFromModel(model: string): string {
  const modelLower = model.toLowerCase();
  
  if (modelLower.includes('gpt') || modelLower.startsWith('text-')) return 'openai';
  if (modelLower.includes('claude')) return 'anthropic';
  if (modelLower.includes('gemini') || modelLower.includes('palm')) return 'google';
  if (modelLower.includes('llama') || modelLower.includes('togethercomputer')) return 'together';
  if (modelLower.includes('mistral')) return 'mistral';
  if (modelLower.includes('command')) return 'cohere';
  
  return 'unknown';
}

function inferProviderFromApiBase(apiBase?: string): string {
  if (!apiBase) return 'unknown';
  
  const baseLower = apiBase.toLowerCase();
  
  if (baseLower.includes('openai')) return 'openai';
  if (baseLower.includes('anthropic')) return 'anthropic';
  if (baseLower.includes('googleapis') || baseLower.includes('aiplatform')) return 'google';
  if (baseLower.includes('together')) return 'together';
  if (baseLower.includes('fireworks')) return 'fireworks';
  if (baseLower.includes('groq')) return 'groq';
  if (baseLower.includes('bedrock')) return 'bedrock';
  if (baseLower.includes('azure')) return 'azure_openai';
  
  return 'unknown';
}

// =============================================================================
// EXPORTS
// =============================================================================

export { litellmEntryToEvent, inferProviderFromModel, inferProviderFromApiBase };

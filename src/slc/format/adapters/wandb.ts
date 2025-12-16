/**
 * Weights & Biases Adapter - PeakInfer TDD v1.3
 * 
 * Transforms W&B experiment logs into InferenceEvents.
 * Handles both direct API logs and exported run data.
 */

import type { InferenceEvent } from '../../../types/events.js';

// =============================================================================
// W&B TYPES
// =============================================================================

interface WandbLogEntry {
  _wandb?: {
    runtime?: number;
    desc?: string;
  };
  _runtime?: number;
  _timestamp?: number;
  _step?: number;
  
  // LLM-specific fields that might be logged
  model?: string;
  provider?: string;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  latency?: number;
  latency_ms?: number;
  cost?: number;
  
  // Custom fields
  [key: string]: unknown;
}

interface WandbRunExport {
  id: string;
  name?: string;
  state?: string;
  config?: Record<string, unknown>;
  summary?: Record<string, unknown>;
  history?: WandbLogEntry[];
  systemMetrics?: Record<string, unknown>;
}

// =============================================================================
// MAIN ADAPTER
// =============================================================================

/**
 * Parse W&B export into InferenceEvents
 */
export function parseWandbExport(data: unknown): InferenceEvent[] {
  const events: InferenceEvent[] = [];
  
  if (!data) return events;
  
  // Handle array of log entries
  if (Array.isArray(data)) {
    for (const entry of data) {
      const event = wandbEntryToEvent(entry);
      if (event) {
        events.push(event);
      }
    }
    return events;
  }
  
  // Handle run export format
  if (typeof data === 'object') {
    const run = data as WandbRunExport;
    
    // Process history if available
    if (run.history && Array.isArray(run.history)) {
      for (const entry of run.history) {
        const event = wandbEntryToEvent(entry, run);
        if (event) {
          events.push(event);
        }
      }
    }
    
    // Process summary as a single event if it looks like LLM data
    if (run.summary && isLlmEntry(run.summary)) {
      const event = wandbEntryToEvent(run.summary as WandbLogEntry, run);
      if (event) {
        events.push(event);
      }
    }
  }
  
  return events;
}

/**
 * Check if data looks like a W&B export
 */
export function isWandbFormat(data: unknown): boolean {
  if (!data) return false;
  
  // Check single object
  if (typeof data === 'object' && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    return '_wandb' in obj || '_runtime' in obj || 
           ('history' in obj && 'config' in obj);
  }
  
  // Check array
  if (Array.isArray(data) && data.length > 0) {
    const first = data[0];
    if (typeof first === 'object' && first !== null) {
      return '_wandb' in first || '_runtime' in first || '_step' in first;
    }
  }
  
  return false;
}

// =============================================================================
// HELPERS
// =============================================================================

function wandbEntryToEvent(
  entry: WandbLogEntry | Record<string, unknown>,
  run?: WandbRunExport
): InferenceEvent | null {
  if (!isLlmEntry(entry)) {
    return null;
  }
  
  const e = entry as WandbLogEntry;
  
  // Extract timestamp
  let timestamp: string;
  if (e._timestamp) {
    timestamp = new Date(e._timestamp * 1000).toISOString();
  } else if (e._runtime !== undefined && run) {
    // Runtime is seconds since start, we'd need run start time
    timestamp = new Date().toISOString();
  } else {
    timestamp = new Date().toISOString();
  }
  
  // Extract model and provider
  const model = String(e.model || e['llm.model'] || e['ai.model'] || 'unknown');
  const provider = String(e.provider || e['llm.provider'] || inferProvider(model));
  
  // Extract tokens
  const inputTokens = Number(e.prompt_tokens || e['input_tokens'] || e['tokens.input'] || 0);
  const outputTokens = Number(e.completion_tokens || e['output_tokens'] || e['tokens.output'] || 0);
  
  // Extract latency
  const latencyMs = Number(e.latency_ms || e.latency || e['response_time_ms'] || 0);
  
  return {
    id: `wandb_${run?.id || 'unknown'}_${e._step || Date.now()}`,
    ts: timestamp,
    intent: String(e['task'] || e['operation'] || e._wandb?.desc || 'inference'),
    provider,
    model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    latency_ms: latencyMs,
    cost_usd: Number(e.cost || e['cost_usd'] || 0),
    endpoint: '',
    region: '',
    tenant: run?.name || '',
    metadata: {
      step: e._step,
      runtime: e._runtime,
      runId: run?.id,
    },
  };
}

function isLlmEntry(entry: unknown): boolean {
  if (typeof entry !== 'object' || entry === null) return false;
  
  const e = entry as Record<string, unknown>;
  
  // Check for LLM-related fields
  const llmFields = [
    'model', 'provider', 'prompt_tokens', 'completion_tokens',
    'total_tokens', 'llm.model', 'ai.model', 'llm.provider',
  ];
  
  return llmFields.some(f => f in e && e[f] !== undefined);
}

function inferProvider(model: string): string {
  const modelLower = model.toLowerCase();
  
  if (modelLower.includes('gpt') || modelLower.includes('openai')) return 'openai';
  if (modelLower.includes('claude') || modelLower.includes('anthropic')) return 'anthropic';
  if (modelLower.includes('gemini') || modelLower.includes('palm')) return 'google';
  if (modelLower.includes('llama')) return 'meta';
  if (modelLower.includes('mistral')) return 'mistral';
  
  return 'unknown';
}

// =============================================================================
// EXPORTS
// =============================================================================

export { wandbEntryToEvent, isLlmEntry, inferProvider };

/**
 * LangSmith Adapter - PeakInfer TDD v1.3
 * 
 * Transforms LangSmith (LangChain) trace exports into InferenceEvents.
 */

import type { InferenceEvent } from '../../../types/events.js';

// =============================================================================
// LANGSMITH TYPES
// =============================================================================

interface LangSmithRun {
  id: string;
  name: string;
  run_type: 'llm' | 'chain' | 'tool' | 'retriever' | 'embedding' | 'prompt' | 'parser';
  start_time: string;
  end_time?: string;
  status: 'pending' | 'running' | 'success' | 'error';
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  extra?: {
    invocation_params?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  };
  parent_run_id?: string;
  dotted_order?: string;
  trace_id?: string;
  session_id?: string;
  tags?: string[];
  error?: string;
  // Token usage (may be in various places)
  total_tokens?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  token_usage?: {
    total_tokens?: number;
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}

// =============================================================================
// MAIN ADAPTER
// =============================================================================

/**
 * Parse LangSmith export into InferenceEvents
 */
export function parseLangSmithExport(data: unknown): InferenceEvent[] {
  const events: InferenceEvent[] = [];
  
  if (!data) return events;
  
  // Handle array of runs
  if (Array.isArray(data)) {
    for (const run of data) {
      const event = runToEvent(run);
      if (event) {
        events.push(event);
      }
    }
    return events;
  }
  
  // Handle single run
  if (typeof data === 'object') {
    const run = data as LangSmithRun;
    if (run.run_type) {
      const event = runToEvent(run);
      if (event) {
        events.push(event);
      }
    }
  }
  
  return events;
}

/**
 * Check if data looks like a LangSmith export
 */
export function isLangSmithFormat(data: unknown): boolean {
  if (!data) return false;
  
  // Check single object
  if (typeof data === 'object' && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    return 'run_type' in obj && 'dotted_order' in obj;
  }
  
  // Check array
  if (Array.isArray(data) && data.length > 0) {
    const first = data[0];
    if (typeof first === 'object' && first !== null) {
      return 'run_type' in first;
    }
  }
  
  return false;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Convert a LangSmith run to an InferenceEvent
 */
function runToEvent(run: unknown): InferenceEvent | null {
  if (!run || typeof run !== 'object') return null;
  
  const r = run as LangSmithRun;
  
  // Only process LLM runs (or chains that might have LLM calls)
  if (r.run_type !== 'llm' && r.run_type !== 'embedding') {
    return null;
  }
  
  // Extract model and provider
  const invocationParams = r.extra?.invocation_params || {};
  const model = extractModel(r, invocationParams);
  const provider = extractProvider(model, invocationParams);
  
  // Extract token usage
  const tokenUsage = extractTokenUsage(r);
  
  // Calculate latency
  let latencyMs = 0;
  if (r.start_time && r.end_time) {
    const start = new Date(r.start_time).getTime();
    const end = new Date(r.end_time).getTime();
    latencyMs = end - start;
  }
  
  return {
    id: r.id,
    ts: r.start_time,
    intent: r.name || r.run_type,
    provider,
    model,
    input_tokens: tokenUsage.input,
    output_tokens: tokenUsage.output,
    latency_ms: latencyMs,
    cost_usd: 0, // Would need pricing lookup
    endpoint: '',
    region: '',
    tenant: r.session_id || '',
    metadata: {
      run_type: r.run_type,
      status: r.status,
      tags: r.tags,
      trace_id: r.trace_id,
    },
  };
}

/**
 * Extract model name from run
 */
function extractModel(run: LangSmithRun, params: Record<string, unknown>): string {
  // Check various places where model might be stored
  if (params.model) return String(params.model);
  if (params.model_name) return String(params.model_name);
  if (params._type && String(params._type).includes('openai')) {
    return String(params.model || params.model_name || 'gpt-3.5-turbo');
  }
  
  // Check run name for model hints
  const name = run.name.toLowerCase();
  if (name.includes('gpt-4')) return 'gpt-4';
  if (name.includes('gpt-3.5')) return 'gpt-3.5-turbo';
  if (name.includes('claude')) return 'claude';
  
  return 'unknown';
}

/**
 * Extract provider from model name and params
 */
function extractProvider(model: string, params: Record<string, unknown>): string {
  const modelLower = model.toLowerCase();
  
  if (modelLower.includes('gpt') || modelLower.includes('openai')) return 'openai';
  if (modelLower.includes('claude') || modelLower.includes('anthropic')) return 'anthropic';
  if (modelLower.includes('gemini') || modelLower.includes('palm')) return 'google';
  if (modelLower.includes('llama')) return 'meta';
  if (modelLower.includes('mistral')) return 'mistral';
  
  // Check _type param
  const typeStr = String(params._type || '').toLowerCase();
  if (typeStr.includes('openai')) return 'openai';
  if (typeStr.includes('anthropic')) return 'anthropic';
  if (typeStr.includes('google')) return 'google';
  
  return 'unknown';
}

/**
 * Extract token usage from run
 */
function extractTokenUsage(run: LangSmithRun): { input: number; output: number } {
  // Check token_usage field
  if (run.token_usage) {
    return {
      input: run.token_usage.prompt_tokens || 0,
      output: run.token_usage.completion_tokens || 0,
    };
  }
  
  // Check direct fields
  if (run.prompt_tokens !== undefined || run.completion_tokens !== undefined) {
    return {
      input: run.prompt_tokens || 0,
      output: run.completion_tokens || 0,
    };
  }
  
  // Check outputs for usage
  if (run.outputs && typeof run.outputs === 'object') {
    const outputs = run.outputs as Record<string, unknown>;
    if (outputs.llm_output && typeof outputs.llm_output === 'object') {
      const llmOutput = outputs.llm_output as Record<string, unknown>;
      if (llmOutput.token_usage && typeof llmOutput.token_usage === 'object') {
        const usage = llmOutput.token_usage as Record<string, number>;
        return {
          input: usage.prompt_tokens || 0,
          output: usage.completion_tokens || 0,
        };
      }
    }
  }
  
  return { input: 0, output: 0 };
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  runToEvent,
  extractModel,
  extractProvider,
  extractTokenUsage,
};

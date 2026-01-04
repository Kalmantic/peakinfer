/**
 * LangSmith API Connector
 *
 * Fetches LLM traces from LangSmith's API.
 * Docs: https://docs.smith.langchain.com/reference/api
 */

import {
  ConnectorConfig,
  ConnectorResult,
  ConnectorError,
  NormalizedEvent,
  calculateSummary,
} from './types.js';

const LANGSMITH_API_URL = 'https://api.smith.langchain.com';

interface LangSmithRun {
  id: string;
  name: string;
  run_type: string;
  start_time: string;
  end_time?: string;
  status: string;
  error?: string;
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  extra?: {
    invocation_params?: {
      model?: string;
      model_name?: string;
      stream?: boolean;
    };
    metadata?: Record<string, unknown>;
  };
  total_tokens?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_cost?: number;
  trace_id?: string;
  parent_run_id?: string;
  session_id?: string;
}

interface LangSmithResponse {
  runs?: LangSmithRun[];
  cursors?: {
    next?: string;
  };
}

function normalizeProvider(runName: string, invocationParams?: Record<string, unknown>): string {
  const nameLower = runName.toLowerCase();

  if (nameLower.includes('openai') || nameLower.includes('gpt')) return 'openai';
  if (nameLower.includes('anthropic') || nameLower.includes('claude')) return 'anthropic';
  if (nameLower.includes('azure')) return 'azure-openai';
  if (nameLower.includes('bedrock')) return 'aws-bedrock';
  if (nameLower.includes('vertex') || nameLower.includes('palm') || nameLower.includes('gemini')) return 'google';
  if (nameLower.includes('together')) return 'together';
  if (nameLower.includes('fireworks')) return 'fireworks';
  if (nameLower.includes('groq')) return 'groq';

  // Check invocation params
  const modelName = invocationParams?.model_name || invocationParams?.model;
  if (typeof modelName === 'string') {
    if (modelName.includes('gpt')) return 'openai';
    if (modelName.includes('claude')) return 'anthropic';
    if (modelName.includes('gemini')) return 'google';
  }

  return 'unknown';
}

function normalizeLangSmithRun(run: LangSmithRun): NormalizedEvent | null {
  // Only include LLM runs
  if (run.run_type !== 'llm') {
    return null;
  }

  const startTime = new Date(run.start_time).getTime();
  const endTime = run.end_time ? new Date(run.end_time).getTime() : startTime;
  const latencyMs = endTime - startTime;

  const invocationParams = run.extra?.invocation_params;
  const model = invocationParams?.model || invocationParams?.model_name || 'unknown';
  const isStreaming = invocationParams?.stream === true;
  const isSuccess = run.status === 'success' || run.status === 'completed';

  return {
    id: run.id,
    timestamp: run.start_time,
    model: typeof model === 'string' ? model : 'unknown',
    provider: normalizeProvider(run.name, invocationParams),
    latency_ms: Math.max(0, latencyMs),
    prompt_tokens: run.prompt_tokens,
    completion_tokens: run.completion_tokens,
    total_tokens: run.total_tokens,
    cost_usd: run.total_cost,
    success: isSuccess,
    error: run.error,
    streaming: isStreaming,
    trace_id: run.trace_id,
    parent_span_id: run.parent_run_id,
    session_id: run.session_id,
    raw: run as unknown as Record<string, unknown>,
  };
}

export async function fetchLangSmithTraces(
  config: ConnectorConfig
): Promise<ConnectorResult> {
  const limit = config.limit || 1000;

  // Build query params
  const params = new URLSearchParams();
  params.set('limit', limit.toString());
  params.set('run_type', 'llm'); // Only fetch LLM runs
  params.set('is_root', 'false'); // Include nested runs

  if (config.startDate) {
    params.set('start_time', config.startDate);
  }

  if (config.endDate) {
    params.set('end_time', config.endDate);
  }

  if (config.filter?.success !== undefined) {
    params.set('error', config.filter.success ? 'false' : 'true');
  }

  try {
    const response = await fetch(`${LANGSMITH_API_URL}/runs?${params.toString()}`, {
      method: 'GET',
      headers: {
        'X-API-Key': config.apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new ConnectorError(
        `LangSmith API error: ${response.status} ${errorText}`,
        'langsmith',
        response.status
      );
    }

    const data = await response.json() as LangSmithResponse;

    const events = (data.runs || [])
      .map(normalizeLangSmithRun)
      .filter((e): e is NormalizedEvent => e !== null);

    const summary = calculateSummary(events);

    return {
      events,
      summary,
      metadata: {
        source: 'langsmith',
        fetched_at: new Date().toISOString(),
        total_fetched: events.length,
        truncated: data.cursors?.next !== undefined,
        api_version: 'v1',
      },
    };
  } catch (error) {
    if (error instanceof ConnectorError) {
      throw error;
    }
    throw new ConnectorError(
      `Failed to fetch from LangSmith: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'langsmith'
    );
  }
}

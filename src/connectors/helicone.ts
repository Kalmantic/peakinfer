/**
 * Helicone API Connector
 *
 * Fetches LLM request logs from Helicone's API.
 * Docs: https://docs.helicone.ai/rest/request/post-v1requestquery
 */

import {
  ConnectorConfig,
  ConnectorResult,
  ConnectorError,
  NormalizedEvent,
  calculateSummary,
} from './types.js';

const HELICONE_API_URL = 'https://api.helicone.ai/v1/request/query';

interface HeliconeRequest {
  request_id: string;
  created_at: string;
  model: string;
  provider: string;
  request_path: string;
  response_status: number;
  latency_ms: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  cost_usd?: number;
  user_id?: string;
  properties?: Record<string, string>;
  request_body?: {
    stream?: boolean;
    model?: string;
  };
  response_body?: {
    error?: { message?: string };
  };
}

interface HeliconeResponse {
  data: HeliconeRequest[];
  error?: string;
}

function normalizeHeliconeEvent(req: HeliconeRequest): NormalizedEvent {
  const isSuccess = req.response_status >= 200 && req.response_status < 400;
  const isStreaming = req.request_body?.stream === true;

  return {
    id: req.request_id,
    timestamp: req.created_at,
    model: req.model || req.request_body?.model || 'unknown',
    provider: normalizeProvider(req.provider),
    latency_ms: req.latency_ms,
    prompt_tokens: req.prompt_tokens,
    completion_tokens: req.completion_tokens,
    total_tokens: req.total_tokens,
    cost_usd: req.cost_usd,
    success: isSuccess,
    error: !isSuccess ? req.response_body?.error?.message : undefined,
    streaming: isStreaming,
    request_path: req.request_path,
    user_id: req.user_id,
    raw: req as unknown as Record<string, unknown>,
  };
}

function normalizeProvider(provider: string): string {
  const providerMap: Record<string, string> = {
    'openai': 'openai',
    'openai-azure': 'azure-openai',
    'azure': 'azure-openai',
    'anthropic': 'anthropic',
    'google': 'google',
    'vertex': 'google-vertex',
    'aws': 'aws-bedrock',
    'bedrock': 'aws-bedrock',
    'together': 'together',
    'fireworks': 'fireworks',
    'groq': 'groq',
    'deepseek': 'deepseek',
  };

  return providerMap[provider.toLowerCase()] || provider.toLowerCase();
}

export async function fetchHeliconeEvents(
  config: ConnectorConfig
): Promise<ConnectorResult> {
  const limit = config.limit || 1000;

  // Build filter
  const filter: Record<string, unknown> = {};

  if (config.startDate) {
    filter.created_at = { gte: config.startDate };
  }

  if (config.filter?.model) {
    filter.model = { equals: config.filter.model };
  }

  if (config.filter?.success !== undefined) {
    filter.response_status = config.filter.success
      ? { gte: 200, lt: 400 }
      : { gte: 400 };
  }

  try {
    const response = await fetch(HELICONE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filter: Object.keys(filter).length > 0 ? filter : undefined,
        limit,
        sort: {
          created_at: 'desc',
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new ConnectorError(
        `Helicone API error: ${response.status} ${errorText}`,
        'helicone',
        response.status
      );
    }

    const data: HeliconeResponse = await response.json();

    if (data.error) {
      throw new ConnectorError(data.error, 'helicone');
    }

    const events = (data.data || []).map(normalizeHeliconeEvent);
    const summary = calculateSummary(events);

    return {
      events,
      summary,
      metadata: {
        source: 'helicone',
        fetched_at: new Date().toISOString(),
        total_fetched: events.length,
        truncated: events.length >= limit,
        api_version: 'v1',
      },
    };
  } catch (error) {
    if (error instanceof ConnectorError) {
      throw error;
    }
    throw new ConnectorError(
      `Failed to fetch from Helicone: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'helicone'
    );
  }
}

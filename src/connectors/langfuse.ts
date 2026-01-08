/**
 * Langfuse API Connector
 *
 * Fetches LLM traces from Langfuse's API.
 * Docs: https://langfuse.com/docs/api-reference
 */

import {
  ConnectorConfig,
  ConnectorResult,
  ConnectorError,
  NormalizedEvent,
  calculateSummary,
} from './types.js';

// Default to Langfuse Cloud, can be overridden for self-hosted
const LANGFUSE_API_URL = process.env.LANGFUSE_HOST || 'https://cloud.langfuse.com';

interface LangfuseObservation {
  id: string;
  name: string;
  type: string; // 'GENERATION' | 'SPAN' | 'EVENT'
  startTime: string;
  endTime?: string;
  completionStartTime?: string;
  model?: string;
  modelParameters?: Record<string, unknown>;
  input?: unknown;
  output?: unknown;
  metadata?: Record<string, unknown>;
  usage?: {
    input?: number;
    output?: number;
    total?: number;
    unit?: string;
    inputCost?: number;
    outputCost?: number;
    totalCost?: number;
  };
  level?: string; // 'DEBUG' | 'DEFAULT' | 'WARNING' | 'ERROR'
  statusMessage?: string;
  parentObservationId?: string;
  traceId?: string;
}

interface LangfuseTrace {
  id: string;
  name?: string;
  timestamp: string;
  observations?: LangfuseObservation[];
  metadata?: Record<string, unknown>;
  sessionId?: string;
  userId?: string;
}

interface LangfuseResponse {
  data?: LangfuseObservation[] | LangfuseTrace[];
  meta?: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
}

function normalizeProvider(model?: string, name?: string): string {
  const modelLower = (model || '').toLowerCase();
  const nameLower = (name || '').toLowerCase();

  if (modelLower.includes('gpt') || nameLower.includes('openai')) return 'openai';
  if (modelLower.includes('claude') || nameLower.includes('anthropic')) return 'anthropic';
  if (modelLower.includes('gemini') || nameLower.includes('google') || modelLower.includes('palm')) return 'google';
  if (modelLower.includes('azure')) return 'azure-openai';
  if (modelLower.includes('bedrock')) return 'aws-bedrock';
  if (modelLower.includes('together')) return 'together';
  if (modelLower.includes('fireworks')) return 'fireworks';
  if (modelLower.includes('groq')) return 'groq';
  if (modelLower.includes('mistral')) return 'mistral';
  if (modelLower.includes('llama')) return 'meta';
  if (modelLower.includes('cohere') || nameLower.includes('cohere')) return 'cohere';

  return 'unknown';
}

function normalizeLangfuseObservation(obs: LangfuseObservation): NormalizedEvent | null {
  // Only include GENERATION type (LLM calls)
  if (obs.type !== 'GENERATION') {
    return null;
  }

  const startTime = new Date(obs.startTime).getTime();
  const endTime = obs.endTime ? new Date(obs.endTime).getTime() : startTime;
  const latencyMs = endTime - startTime;

  const model = obs.model || 'unknown';
  const isStreaming = obs.completionStartTime !== undefined;
  const isSuccess = obs.level !== 'ERROR';

  // Calculate cost from usage if available
  const costUsd = obs.usage?.totalCost;

  return {
    id: obs.id,
    timestamp: obs.startTime,
    model: model,
    provider: normalizeProvider(model, obs.name),
    latency_ms: Math.max(0, latencyMs),
    prompt_tokens: obs.usage?.input,
    completion_tokens: obs.usage?.output,
    total_tokens: obs.usage?.total,
    cost_usd: costUsd,
    success: isSuccess,
    error: obs.level === 'ERROR' ? obs.statusMessage : undefined,
    streaming: isStreaming,
    trace_id: obs.traceId,
    parent_span_id: obs.parentObservationId,
    raw: obs as unknown as Record<string, unknown>,
  };
}

export async function fetchLangfuseTraces(
  config: ConnectorConfig
): Promise<ConnectorResult> {
  const limit = config.limit || 1000;

  // Langfuse uses Basic auth with publicKey:secretKey
  // The apiKey should be in format "publicKey:secretKey" or just use LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY
  let authHeader: string;

  if (config.apiKey.includes(':')) {
    // Format: publicKey:secretKey
    authHeader = `Basic ${Buffer.from(config.apiKey).toString('base64')}`;
  } else {
    // Try to get secret key from env
    const secretKey = process.env.LANGFUSE_SECRET_KEY;
    if (secretKey) {
      authHeader = `Basic ${Buffer.from(`${config.apiKey}:${secretKey}`).toString('base64')}`;
    } else {
      throw new ConnectorError(
        'Langfuse requires both public key and secret key. Provide as "publicKey:secretKey" or set LANGFUSE_SECRET_KEY env var.',
        'langfuse'
      );
    }
  }

  // Build query params for observations endpoint (to get GENERATION types directly)
  const params = new URLSearchParams();
  params.set('limit', Math.min(limit, 100).toString()); // Langfuse limits to 100 per page
  params.set('type', 'GENERATION'); // Only fetch LLM generations

  if (config.startDate) {
    params.set('fromTimestamp', config.startDate);
  }

  if (config.endDate) {
    params.set('toTimestamp', config.endDate);
  }

  try {
    const allEvents: NormalizedEvent[] = [];
    let page = 1;
    let hasMore = true;

    // Paginate through results
    while (hasMore && allEvents.length < limit) {
      params.set('page', page.toString());

      const response = await fetch(`${LANGFUSE_API_URL}/api/public/observations?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new ConnectorError(
          `Langfuse API error: ${response.status} ${errorText}`,
          'langfuse',
          response.status
        );
      }

      const data = await response.json() as LangfuseResponse;
      const observations = (data.data || []) as LangfuseObservation[];

      const events = observations
        .map(normalizeLangfuseObservation)
        .filter((e): e is NormalizedEvent => e !== null);

      allEvents.push(...events);

      // Check if there are more pages
      if (data.meta) {
        hasMore = page < data.meta.totalPages;
        page++;
      } else {
        hasMore = false;
      }
    }

    const summary = calculateSummary(allEvents.slice(0, limit));

    return {
      events: allEvents.slice(0, limit),
      summary,
      metadata: {
        source: 'langfuse',
        fetched_at: new Date().toISOString(),
        total_fetched: Math.min(allEvents.length, limit),
        truncated: allEvents.length > limit,
        api_version: 'v1',
      },
    };
  } catch (error) {
    if (error instanceof ConnectorError) {
      throw error;
    }
    throw new ConnectorError(
      `Failed to fetch from Langfuse: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'langfuse'
    );
  }
}

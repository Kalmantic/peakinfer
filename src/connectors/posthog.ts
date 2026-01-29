/**
 * PostHog API Connector
 *
 * Fetches LLM-related events from PostHog's API.
 * Docs: https://posthog.com/docs/api
 *
 * PostHog can capture LLM events via:
 * 1. Direct event tracking (llm_generation, llm_request, etc.)
 * 2. Custom properties on events
 * 3. Integration with LLM monitoring tools
 *
 * This connector normalizes PostHog events to the PeakInfer format.
 */

import {
  ConnectorConfig,
  ConnectorResult,
  ConnectorError,
  NormalizedEvent,
  calculateSummary,
} from './types.js';

// PostHog Cloud API URL (can be overridden for self-hosted)
const POSTHOG_API_URL = process.env.POSTHOG_HOST || 'https://app.posthog.com';

// Event names that indicate LLM activity
const LLM_EVENT_NAMES = [
  'llm_generation',
  'llm_request',
  'llm_completion',
  'llm_call',
  'ai_generation',
  'ai_request',
  'ai_completion',
  'model_inference',
  'inference_request',
  'chat_completion',
  'embedding_request',
  // OpenAI-specific
  'openai_request',
  'openai_completion',
  // Anthropic-specific
  'anthropic_request',
  'claude_request',
  // LangChain/LlamaIndex
  'langchain_llm_call',
  'llamaindex_llm_call',
];

// Properties that indicate LLM usage (expanded for better detection)
const LLM_PROPERTY_INDICATORS = [
  // Model identifiers
  'model',
  'llm_model',
  'ai_model',
  'model_name',
  'model_id',
  'openai_model',
  'anthropic_model',
  '$model',
  // Token counts
  'prompt_tokens',
  'completion_tokens',
  'total_tokens',
  'input_tokens',
  'output_tokens',
  'tokens',
  'token_count',
  // Latency
  'latency_ms',
  'duration_ms',
  'response_time_ms',
  'latency',
  'duration',
  '$duration',
  // Provider
  'provider',
  'llm_provider',
  'ai_provider',
  // Cost
  'cost',
  'cost_usd',
  'total_cost',
  // Streaming
  'streaming',
  'stream',
];

interface PostHogEvent {
  uuid?: string;              // May be missing in some API responses
  id?: string;                // Alternative ID field
  event: string;
  timestamp: string;
  distinct_id?: string;       // PostHog event distinct_id
  properties: Record<string, unknown>;
  person?: {
    distinct_ids?: string[];
    properties?: Record<string, unknown>;
  };
  elements?: unknown[];
}

interface PostHogEventsResponse {
  results?: PostHogEvent[];   // May be missing or null
  next?: string | null;
  // Handle alternative API response formats
  data?: PostHogEvent[];      // Some endpoints use 'data' instead of 'results'
}

interface PostHogConfig extends ConnectorConfig {
  projectId?: string;
  eventNames?: string[];
}

/**
 * Normalize provider name to standard format
 */
function normalizeProvider(provider?: string, model?: string): string {
  const providerLower = (provider || '').toLowerCase();
  const modelLower = (model || '').toLowerCase();

  // Check provider first
  const providerMap: Record<string, string> = {
    'openai': 'openai',
    'open_ai': 'openai',
    'anthropic': 'anthropic',
    'google': 'google',
    'vertex': 'google-vertex',
    'vertexai': 'google-vertex',
    'azure': 'azure-openai',
    'azure_openai': 'azure-openai',
    'azureopenai': 'azure-openai',
    'bedrock': 'aws-bedrock',
    'aws_bedrock': 'aws-bedrock',
    'together': 'together',
    'togetherai': 'together',
    'fireworks': 'fireworks',
    'groq': 'groq',
    'deepseek': 'deepseek',
    'mistral': 'mistral',
    'cohere': 'cohere',
    'replicate': 'replicate',
    'huggingface': 'huggingface',
    'ollama': 'ollama',
  };

  if (providerLower && providerMap[providerLower]) {
    return providerMap[providerLower];
  }

  // Infer from model name
  if (modelLower.includes('gpt') || modelLower.includes('o1')) return 'openai';
  if (modelLower.includes('claude')) return 'anthropic';
  if (modelLower.includes('gemini') || modelLower.includes('palm')) return 'google';
  if (modelLower.includes('llama')) return 'meta';
  if (modelLower.includes('mistral') || modelLower.includes('mixtral')) return 'mistral';
  if (modelLower.includes('command')) return 'cohere';

  return providerLower || 'unknown';
}

/**
 * Extract model name from various property formats
 */
function extractModel(props: Record<string, unknown>): string {
  const candidates = [
    props.model,
    props.llm_model,
    props.ai_model,
    props.model_name,
    props.model_id,
    props.$model,
    props.openai_model,
    props.anthropic_model,
    props.gpt_model,
    props.claude_model,
    // Nested object patterns (common in some LLM logging libraries)
    (props.llm as Record<string, unknown>)?.model,
    (props.request as Record<string, unknown>)?.model,
    (props.response as Record<string, unknown>)?.model,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.length > 0) {
      return candidate;
    }
  }

  return 'unknown';
}

/**
 * Extract latency from various property formats
 */
function extractLatency(props: Record<string, unknown>): number {
  const candidates = [
    props.latency_ms,
    props.duration_ms,
    props.response_time_ms,
    props.$duration,
    props.llm_latency_ms,
    props.ai_latency_ms,
    props.time_ms,
    // Convert from seconds if needed
    typeof props.latency === 'number' ? props.latency * 1000 : null,
    typeof props.duration === 'number' ? props.duration * 1000 : null,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'number' && candidate > 0) {
      return Math.round(candidate);
    }
  }

  return 0;
}

/**
 * Extract token counts from various property formats
 */
function extractTokens(props: Record<string, unknown>): {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
} {
  const result: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  } = {};

  // Prompt tokens
  const promptCandidates = [
    props.prompt_tokens,
    props.input_tokens,
    props.request_tokens,
    props.llm_prompt_tokens,
  ];
  for (const candidate of promptCandidates) {
    if (typeof candidate === 'number' && candidate >= 0) {
      result.prompt_tokens = candidate;
      break;
    }
  }

  // Completion tokens
  const completionCandidates = [
    props.completion_tokens,
    props.output_tokens,
    props.response_tokens,
    props.llm_completion_tokens,
  ];
  for (const candidate of completionCandidates) {
    if (typeof candidate === 'number' && candidate >= 0) {
      result.completion_tokens = candidate;
      break;
    }
  }

  // Total tokens
  const totalCandidates = [
    props.total_tokens,
    props.tokens,
    props.llm_total_tokens,
  ];
  for (const candidate of totalCandidates) {
    if (typeof candidate === 'number' && candidate >= 0) {
      result.total_tokens = candidate;
      break;
    }
  }

  // Calculate total if not present
  if (!result.total_tokens && (result.prompt_tokens || result.completion_tokens)) {
    result.total_tokens = (result.prompt_tokens || 0) + (result.completion_tokens || 0);
  }

  return result;
}

/**
 * Extract cost from various property formats
 */
function extractCost(props: Record<string, unknown>): number | undefined {
  const candidates = [
    props.cost_usd,
    props.cost,
    props.llm_cost,
    props.total_cost,
    props.price,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'number' && candidate >= 0) {
      return candidate;
    }
  }

  return undefined;
}

/**
 * Check if event represents a successful LLM call
 */
function isSuccess(props: Record<string, unknown>): boolean {
  // Check explicit success/error flags
  if (typeof props.success === 'boolean') return props.success;
  if (typeof props.error === 'boolean') return !props.error;
  if (typeof props.is_error === 'boolean') return !props.is_error;
  if (typeof props.status === 'string') {
    const status = props.status.toLowerCase();
    if (status === 'success' || status === 'completed' || status === 'ok') return true;
    if (status === 'error' || status === 'failed' || status === 'failure') return false;
  }
  if (typeof props.status_code === 'number') {
    return props.status_code >= 200 && props.status_code < 400;
  }

  // Assume success if no error indicators
  return !props.error_message && !props.error_type && !props.exception;
}

/**
 * Check if event indicates streaming was used
 */
function isStreaming(props: Record<string, unknown>): boolean {
  const candidates = [
    props.streaming,
    props.stream,
    props.is_streaming,
    props.use_streaming,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'boolean') return candidate;
    if (candidate === 'true' || candidate === '1') return true;
  }

  return false;
}

/**
 * Check if a PostHog event is LLM-related
 */
function isLLMEvent(event: PostHogEvent): boolean {
  // Check event name
  const eventLower = event.event.toLowerCase();
  for (const llmEvent of LLM_EVENT_NAMES) {
    if (eventLower === llmEvent || eventLower.includes(llmEvent.replace('_', ''))) {
      return true;
    }
  }

  // Check properties for LLM indicators
  const props = event.properties || {};
  let indicatorCount = 0;
  for (const indicator of LLM_PROPERTY_INDICATORS) {
    if (props[indicator] !== undefined) {
      indicatorCount++;
    }
  }

  // If 2+ LLM indicators present, likely an LLM event
  return indicatorCount >= 2;
}

/**
 * Generate a stable ID from event data when uuid is missing
 */
function generateEventId(event: PostHogEvent, index: number): string {
  // Try various ID fields in order of preference
  if (event.uuid && typeof event.uuid === 'string') {
    return event.uuid;
  }
  if (event.id && typeof event.id === 'string') {
    return event.id;
  }

  // Check properties for ID fields
  const props = event.properties || {};
  const propId = props.id ?? props.event_id ?? props.request_id ?? props.trace_id;
  if (propId && typeof propId === 'string') {
    return propId;
  }

  // Generate a deterministic ID from timestamp + index + event name
  const timestamp = event.timestamp || new Date().toISOString();
  const eventName = event.event || 'unknown';
  const distinctId = event.distinct_id || '';
  return `ph_${timestamp.replace(/[^0-9]/g, '').slice(0, 14)}_${eventName}_${distinctId.slice(0, 8)}_${index}`;
}

/**
 * Normalize a PostHog event to PeakInfer format (with LLM event check)
 */
function normalizePostHogEvent(event: PostHogEvent, index: number = 0): NormalizedEvent | null {
  if (!isLLMEvent(event)) {
    return null;
  }
  return forceNormalizeEvent(event, index);
}

/**
 * Force normalize a PostHog event without LLM check
 * Used when user explicitly specifies event names to include
 */
function forceNormalizeEvent(event: PostHogEvent, index: number = 0): NormalizedEvent {
  const props = event.properties || {};
  const model = extractModel(props);
  const tokens = extractTokens(props);

  // Generate a valid ID (uuid may be missing in some API responses)
  const eventId = generateEventId(event, index);

  return {
    id: eventId,
    timestamp: event.timestamp,
    model: model,
    provider: normalizeProvider(props.provider as string, model),
    latency_ms: extractLatency(props),
    prompt_tokens: tokens.prompt_tokens,
    completion_tokens: tokens.completion_tokens,
    total_tokens: tokens.total_tokens,
    cost_usd: extractCost(props),
    success: isSuccess(props),
    error: props.error_message as string | undefined,
    streaming: isStreaming(props),
    trace_id: props.trace_id as string | undefined,
    span_id: props.span_id as string | undefined,
    session_id: props.$session_id as string || props.session_id as string,
    user_id: props.$user_id as string || event.distinct_id as string,
    raw: props,
  };
}

/**
 * Fetch LLM events from PostHog
 *
 * @param config - Connector configuration
 * @returns Normalized events with summary statistics
 */
export async function fetchPostHogEvents(
  config: PostHogConfig
): Promise<ConnectorResult> {
  const limit = config.limit || 1000;
  const projectId = config.projectId || process.env.POSTHOG_PROJECT_ID;
  // User-specified event names to include (enables matching even without LLM indicators)
  const eventNames = config.eventNames;

  if (!projectId) {
    throw new ConnectorError(
      'PostHog project ID required. Provide via projectId argument or POSTHOG_PROJECT_ID env var.',
      'posthog'
    );
  }

  // Build date filter
  const endDate = config.endDate || new Date().toISOString();
  const startDate = config.startDate || (() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString();
  })();

  try {
    const allEvents: NormalizedEvent[] = [];
    let url: string | null = `${POSTHOG_API_URL}/api/projects/${projectId}/events/?` +
      new URLSearchParams({
        after: startDate,
        before: endDate,
        limit: Math.min(limit, 100).toString(), // PostHog max per page
      }).toString();

    // PostHog event filtering - fetch all events and filter locally
    // (PostHog API doesn't support OR filtering on event names)
    let pageCount = 0;
    const maxPages = Math.ceil(limit / 100) + 5; // Extra pages for filtering

    while (url && allEvents.length < limit && pageCount < maxPages) {
      pageCount++;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();

        // Handle specific error cases
        if (response.status === 401) {
          throw new ConnectorError(
            'PostHog authentication failed. Check your API key.',
            'posthog',
            401
          );
        }

        if (response.status === 404) {
          throw new ConnectorError(
            `PostHog project not found: ${projectId}. Check your project ID.`,
            'posthog',
            404
          );
        }

        throw new ConnectorError(
          `PostHog API error: ${response.status} ${errorText}`,
          'posthog',
          response.status
        );
      }

      const responseData = await response.json() as PostHogEventsResponse;

      // Handle both 'results' and 'data' response formats
      const events = responseData.results || responseData.data || [];

      // Validate we got an array
      if (!Array.isArray(events)) {
        throw new ConnectorError(
          'PostHog API returned unexpected format (expected array of events)',
          'posthog'
        );
      }

      // Normalize and filter LLM events
      for (let i = 0; i < events.length; i++) {
        const event = events[i];
        const globalIndex = allEvents.length + i;

        // If user specified event names, include events matching those names
        // even if they don't have all LLM property indicators
        let shouldInclude = false;
        if (eventNames && eventNames.length > 0) {
          const eventNameLower = (event.event || '').toLowerCase();
          shouldInclude = eventNames.some(name =>
            eventNameLower === name.toLowerCase() ||
            eventNameLower.includes(name.toLowerCase().replace('_', ''))
          );
        }

        // Use custom normalization for user-specified events
        const normalized = shouldInclude
          ? forceNormalizeEvent(event, globalIndex)
          : normalizePostHogEvent(event, globalIndex);

        if (normalized) {
          allEvents.push(normalized);
          if (allEvents.length >= limit) break;
        }
      }

      // Get next page
      url = responseData.next || null;

      // If we got no LLM events from this page, try a few more pages
      if (events.length > 0 && allEvents.length === 0 && pageCount < 3) {
        continue;
      }
    }

    const summary = calculateSummary(allEvents.slice(0, limit));

    return {
      events: allEvents.slice(0, limit),
      summary,
      metadata: {
        source: 'posthog',
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
      `Failed to fetch from PostHog: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'posthog'
    );
  }
}

/**
 * Get available LLM event names for documentation
 */
export function getSupportedEventNames(): string[] {
  return [...LLM_EVENT_NAMES];
}

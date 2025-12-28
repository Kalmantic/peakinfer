/**
 * Shared types for runtime data connectors
 *
 * These types define the normalized format for runtime events
 * from various sources (Helicone, LangSmith, etc.)
 */

export interface NormalizedEvent {
  id: string;
  timestamp: string;
  model: string;
  provider: string;
  latency_ms: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  cost_usd?: number;
  success: boolean;
  error?: string;
  streaming?: boolean;
  // Trace metadata
  trace_id?: string;
  span_id?: string;
  parent_span_id?: string;
  // Request metadata
  request_path?: string;
  user_id?: string;
  session_id?: string;
  // Raw data for debugging
  raw?: Record<string, unknown>;
}

export interface ConnectorSummary {
  total_requests: number;
  total_cost_usd: number;
  avg_latency_ms: number;
  p50_latency_ms: number;
  p95_latency_ms: number;
  p99_latency_ms: number;
  error_rate: number;
  streaming_rate: number;
  by_model: Record<string, {
    count: number;
    cost: number;
    avg_latency_ms: number;
    p95_latency_ms: number;
    error_rate: number;
  }>;
  by_provider: Record<string, {
    count: number;
    cost: number;
  }>;
  time_range: {
    start: string;
    end: string;
  };
}

export interface ConnectorResult {
  events: NormalizedEvent[];
  summary: ConnectorSummary;
  metadata: {
    source: 'helicone' | 'langsmith';
    fetched_at: string;
    total_fetched: number;
    truncated: boolean;
    api_version?: string;
  };
}

export interface ConnectorConfig {
  apiKey: string;
  limit?: number;
  startDate?: string;
  endDate?: string;
  filter?: {
    model?: string;
    provider?: string;
    success?: boolean;
  };
}

export class ConnectorError extends Error {
  constructor(
    message: string,
    public readonly source: 'helicone' | 'langsmith',
    public readonly statusCode?: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'ConnectorError';
  }
}

// Helper functions for calculating summary statistics
export function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

export function calculateSummary(events: NormalizedEvent[]): ConnectorSummary {
  if (events.length === 0) {
    return {
      total_requests: 0,
      total_cost_usd: 0,
      avg_latency_ms: 0,
      p50_latency_ms: 0,
      p95_latency_ms: 0,
      p99_latency_ms: 0,
      error_rate: 0,
      streaming_rate: 0,
      by_model: {},
      by_provider: {},
      time_range: { start: '', end: '' },
    };
  }

  const latencies = events.map(e => e.latency_ms).filter(l => l > 0);
  const costs = events.map(e => e.cost_usd || 0);
  const errors = events.filter(e => !e.success).length;
  const streaming = events.filter(e => e.streaming).length;

  // Group by model
  const byModel: ConnectorSummary['by_model'] = {};
  for (const event of events) {
    const model = event.model || 'unknown';
    if (!byModel[model]) {
      byModel[model] = { count: 0, cost: 0, avg_latency_ms: 0, p95_latency_ms: 0, error_rate: 0 };
    }
    byModel[model].count++;
    byModel[model].cost += event.cost_usd || 0;
  }

  // Calculate per-model stats
  for (const model of Object.keys(byModel)) {
    const modelEvents = events.filter(e => (e.model || 'unknown') === model);
    const modelLatencies = modelEvents.map(e => e.latency_ms).filter(l => l > 0);
    const modelErrors = modelEvents.filter(e => !e.success).length;

    byModel[model].avg_latency_ms = modelLatencies.length > 0
      ? Math.round(modelLatencies.reduce((a, b) => a + b, 0) / modelLatencies.length)
      : 0;
    byModel[model].p95_latency_ms = calculatePercentile(modelLatencies, 95);
    byModel[model].error_rate = modelEvents.length > 0 ? modelErrors / modelEvents.length : 0;
  }

  // Group by provider
  const byProvider: ConnectorSummary['by_provider'] = {};
  for (const event of events) {
    const provider = event.provider || 'unknown';
    if (!byProvider[provider]) {
      byProvider[provider] = { count: 0, cost: 0 };
    }
    byProvider[provider].count++;
    byProvider[provider].cost += event.cost_usd || 0;
  }

  // Time range
  const timestamps = events.map(e => new Date(e.timestamp).getTime()).filter(t => !isNaN(t));
  const timeRange = {
    start: timestamps.length > 0 ? new Date(Math.min(...timestamps)).toISOString() : '',
    end: timestamps.length > 0 ? new Date(Math.max(...timestamps)).toISOString() : '',
  };

  return {
    total_requests: events.length,
    total_cost_usd: costs.reduce((a, b) => a + b, 0),
    avg_latency_ms: latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0,
    p50_latency_ms: calculatePercentile(latencies, 50),
    p95_latency_ms: calculatePercentile(latencies, 95),
    p99_latency_ms: calculatePercentile(latencies, 99),
    error_rate: events.length > 0 ? errors / events.length : 0,
    streaming_rate: events.length > 0 ? streaming / events.length : 0,
    by_model: byModel,
    by_provider: byProvider,
    time_range: timeRange,
  };
}

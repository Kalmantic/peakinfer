/**
 * Canonical Event Schema for PeakInfer
 * Provider-neutral schema for LLM inference events across heterogeneous stacks
 * 
 * Per TDD v1.3 Section 7.2: Runtime Event (Offline)
 * Per PRD v1.3 Section 6.2: Supported Formats
 */

/**
 * Canonical InferenceEvent - events.jsonl schema
 * Unified format across Snowflake, Databricks, Terraform, hosted inference platforms
 */
export interface InferenceEvent {
  /** UUID for event tracking */
  id: string;
  
  /** ISO timestamp "2025-08-31T10:01:00Z" */
  ts: string;
  
  /** Intent/purpose: "extract_email", "summarize_doc", etc. */
  intent: string;
  
  /** Provider: "openai", "anthropic", "together", "baseten", etc. */
  provider: string;
  
  /** Model: "gpt-4o", "claude-3-sonnet", etc. */
  model: string;
  
  /** Input token count */
  input_tokens: number;
  
  /** Output token count */
  output_tokens: number;
  
  /** Response latency in milliseconds */
  latency_ms: number;
  
  /** Actual cost in USD */
  cost_usd: number;
  
  /** Endpoint: "api.openai.com", "api.together.xyz", etc. */
  endpoint: string;
  
  /** Region: "us-west-2", etc. */
  region: string;
  
  /** Tenant/team identifier: "team_analytics", etc. */
  tenant: string;
  
  /** Optional quality metric (0-1) */
  quality_score?: number;
  
  /** Optional context window usage */
  context_length?: number;
  
  /** Optional callsite ID for explicit join key (TDD v1.3 Section 10.1) */
  callsite_id?: string;
  
  /** Optional metadata for extensibility */
  metadata?: Record<string, any>;
}

/**
 * Provider-specific event types for normalization
 */

export interface OpenAIEvent {
  id: string;
  created: number;
  model: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  choices: Array<{
    message: any;
    finish_reason: string;
  }>;
}

export interface AnthropicEvent {
  id: string;
  type: string;
  model: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
  content: any[];
}

export interface TogetherEvent {
  id: string;
  model: string;
  prompt: string;
  output: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
  };
  inference_time_ms: number;
}

export interface BasetenEvent {
  request_id: string;
  model_id: string;
  timestamp: string;
  tokens_in: number;
  tokens_out: number;
  latency_ms: number;
  cost: number;
}

/**
 * Snowflake-specific event format
 */
export interface SnowflakeInferenceRow {
  request_id: string;
  timestamp: string;
  application_context: string;
  model_provider: string;
  model_name: string;
  input_token_count: number;
  output_token_count: number;
  response_time_ms: number;
  cost_usd: number;
  endpoint_url: string;
  region: string;
  workspace: string;
}

/**
 * Databricks-specific event format
 */
export interface DatabricksEndpointUsage {
  request_id: string;
  timestamp: number;
  endpoint_name: string;
  model_name: string;
  input_tokens: number;
  output_tokens: number;
  latency_ms: number;
  cost: number;
  workspace_id: string;
  tags: Record<string, string>;
}

/**
 * Event normalization result
 */
export interface NormalizedEventResult {
  event: InferenceEvent;
  source: 'snowflake' | 'databricks' | 'terraform' | 'manual' | 'api';
  raw: any;
}

/**
 * Event aggregation for analytics
 */
export interface EventAggregation {
  total_events: number;
  total_cost: number;
  total_input_tokens: number;
  total_output_tokens: number;
  avg_latency_ms: number;
  by_provider: Record<string, ProviderStats>;
  by_model: Record<string, ModelStats>;
  by_intent: Record<string, IntentStats>;
  time_range: {
    start: string;
    end: string;
  };
}

export interface ProviderStats {
  count: number;
  cost: number;
  avg_latency: number;
  models: string[];
}

export interface ModelStats {
  count: number;
  cost: number;
  avg_input_tokens: number;
  avg_output_tokens: number;
  avg_latency: number;
}

export interface IntentStats {
  count: number;
  cost: number;
  avg_tokens: number;
  providers_used: string[];
  optimization_opportunities: string[];
}


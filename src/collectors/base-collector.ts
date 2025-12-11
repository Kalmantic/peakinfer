/**
 * Base Collector Class
 * Abstract base for all OSS collectors with trust boundary enforcement
 * Based on PRD v0.7 Section 3: OSS Collectors Architecture
 */

import { InferenceEvent } from '../types/events.js';
import { CollectorConfig, CollectorResult, CollectorValidationResult } from '../types/collectors.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Abstract base collector enforcing trust boundaries
 */
export abstract class BaseCollector {
  protected config: CollectorConfig;
  protected collectorName: string;

  constructor(collectorName: string, config?: Partial<CollectorConfig>) {
    this.collectorName = collectorName;
    this.config = {
      trustBoundaries: {
        noNetworkEgress: true,
        leastPrivilege: true,
        auditableCode: true,
        noPIIExfiltration: true,
      },
      outputFormat: 'events.jsonl',
      normalization: 'canonical_schema',
      ...config,
    };
  }

  /**
   * Main collection method - must be implemented by subclasses
   */
  abstract collect(): Promise<InferenceEvent[]>;

  /**
   * Validate collector configuration and permissions
   */
  abstract validate(): Promise<CollectorValidationResult>;

  /**
   * Normalize raw event to canonical schema
   * Provider-neutral transformation
   */
  protected normalizeEvent(rawEvent: any, provider: string): InferenceEvent {
    // Provider-specific normalization
    switch (provider.toLowerCase()) {
      case 'openai':
        return this.normalizeOpenAIEvent(rawEvent);
      case 'anthropic':
        return this.normalizeAnthropicEvent(rawEvent);
      case 'together':
        return this.normalizeTogetherEvent(rawEvent);
      case 'baseten':
        return this.normalizeBasetenEvent(rawEvent);
      default:
        return this.normalizeGenericEvent(rawEvent);
    }
  }

  /**
   * Normalize OpenAI event
   */
  private normalizeOpenAIEvent(raw: any): InferenceEvent {
    return {
      id: raw.id || uuidv4(),
      ts: raw.created ? new Date(raw.created * 1000).toISOString() : new Date().toISOString(),
      intent: raw.intent || raw.purpose || 'general',
      provider: 'openai',
      model: raw.model || 'unknown',
      input_tokens: raw.usage?.prompt_tokens || 0,
      output_tokens: raw.usage?.completion_tokens || 0,
      latency_ms: raw.latency_ms || raw.response_time || 0,
      throughput_tps: this.calculateThroughput(raw.usage?.prompt_tokens || 0, raw.usage?.completion_tokens || 0, raw.latency_ms || raw.response_time || 0),
      endpoint: 'api.openai.com',
      region: raw.region || 'us-east-1',
      tenant: raw.tenant || raw.user || 'default',
      quality_score: raw.quality_score,
      context_length: raw.usage?.total_tokens,
    };
  }

  /**
   * Normalize Anthropic event
   */
  private normalizeAnthropicEvent(raw: any): InferenceEvent {
    return {
      id: raw.id || uuidv4(),
      ts: raw.timestamp || new Date().toISOString(),
      intent: raw.intent || 'general',
      provider: 'anthropic',
      model: raw.model || 'unknown',
      input_tokens: raw.usage?.input_tokens || 0,
      output_tokens: raw.usage?.output_tokens || 0,
      latency_ms: raw.latency_ms || 0,
      throughput_tps: this.calculateThroughput(raw.usage?.input_tokens || 0, raw.usage?.output_tokens || 0, raw.latency_ms || 0),
      endpoint: 'api.anthropic.com',
      region: raw.region || 'us-east-1',
      tenant: raw.tenant || 'default',
      quality_score: raw.quality_score,
      context_length: (raw.usage?.input_tokens || 0) + (raw.usage?.output_tokens || 0),
    };
  }

  /**
   * Normalize Together.ai event
   */
  private normalizeTogetherEvent(raw: any): InferenceEvent {
    return {
      id: raw.id || uuidv4(),
      ts: raw.timestamp || new Date().toISOString(),
      intent: raw.intent || 'general',
      provider: 'together',
      model: raw.model || 'unknown',
      input_tokens: raw.usage?.prompt_tokens || 0,
      output_tokens: raw.usage?.completion_tokens || 0,
      latency_ms: raw.inference_time_ms || 0,
      throughput_tps: this.calculateThroughput(raw.usage?.prompt_tokens || 0, raw.usage?.completion_tokens || 0, raw.inference_time_ms || 0),
      endpoint: 'api.together.xyz',
      region: raw.region || 'us-west-1',
      tenant: raw.tenant || 'default',
    };
  }

  /**
   * Normalize Baseten event
   */
  private normalizeBasetenEvent(raw: any): InferenceEvent {
    return {
      id: raw.request_id || uuidv4(),
      ts: raw.timestamp || new Date().toISOString(),
      intent: raw.intent || 'general',
      provider: 'baseten',
      model: raw.model_id || 'unknown',
      input_tokens: raw.tokens_in || 0,
      output_tokens: raw.tokens_out || 0,
      latency_ms: raw.latency_ms || 0,
      throughput_tps: this.calculateThroughput(raw.tokens_in || 0, raw.tokens_out || 0, raw.latency_ms || 0),
      endpoint: 'api.baseten.co',
      region: raw.region || 'us-east-1',
      tenant: raw.tenant || 'default',
    };
  }

  /**
   * Normalize generic event
   */
  private normalizeGenericEvent(raw: any): InferenceEvent {
    return {
      id: raw.id || raw.request_id || uuidv4(),
      ts: raw.ts || raw.timestamp || new Date().toISOString(),
      intent: raw.intent || raw.purpose || 'general',
      provider: raw.provider || 'unknown',
      model: raw.model || raw.model_name || 'unknown',
      input_tokens: raw.input_tokens || raw.prompt_tokens || 0,
      output_tokens: raw.output_tokens || raw.completion_tokens || 0,
      latency_ms: raw.latency_ms || raw.response_time || 0,
      throughput_tps: raw.throughput_tps || this.calculateThroughput(raw.input_tokens || raw.prompt_tokens || 0, raw.output_tokens || raw.completion_tokens || 0, raw.latency_ms || raw.response_time || 0),
      endpoint: raw.endpoint || 'unknown',
      region: raw.region || 'unknown',
      tenant: raw.tenant || raw.workspace || 'default',
      quality_score: raw.quality_score,
      context_length: raw.context_length,
    };
  }

  /**
   * Calculate throughput in tokens per second
   */
  private calculateThroughput(inputTokens: number, outputTokens: number, latencyMs: number): number {
    if (latencyMs <= 0) return 0;
    const totalTokens = inputTokens + outputTokens;
    return (totalTokens / latencyMs) * 1000; // tokens per second
  }

  /**
   * Enforce trust boundaries
   * - No network egress
   * - No PII exfiltration
   * - Least privilege access
   */
  protected respectTrustBoundaries(): void {
    // Validate trust boundaries are enabled
    if (!this.config.trustBoundaries.noNetworkEgress) {
      console.warn('⚠️  Warning: Network egress not restricted for', this.collectorName);
    }
    
    if (!this.config.trustBoundaries.noPIIExfiltration) {
      console.warn('⚠️  Warning: PII exfiltration not prevented for', this.collectorName);
    }
  }

  /**
   * Filter PII from events
   */
  protected filterPII(event: InferenceEvent): InferenceEvent {
    // Remove any potentially sensitive metadata
    if (event.metadata) {
      const filtered = { ...event.metadata };
      // Remove common PII fields
      delete filtered.user_email;
      delete filtered.user_name;
      delete filtered.ip_address;
      delete filtered.session_id;
      event.metadata = filtered;
    }
    
    return event;
  }

  /**
   * Create collector result with metadata
   */
  protected createResult(events: InferenceEvent[]): CollectorResult {
    const stats = this.calculateStats(events);
    
    return {
      events,
      metadata: {
        collector: this.collectorName,
        timestamp: new Date().toISOString(),
        source: this.collectorName,
        event_count: events.length,
        time_range: stats.time_range,
      },
      stats: {
        total_throughput: stats.total_throughput,
        total_tokens: stats.total_tokens,
        unique_providers: stats.unique_providers,
        unique_models: stats.unique_models,
        date_range_days: stats.date_range_days,
      },
    };
  }

  /**
   * Calculate statistics from events
   */
  private calculateStats(events: InferenceEvent[]) {
    const providers = new Set<string>();
    const models = new Set<string>();
    let totalThroughput = 0;
    let totalTokens = 0;
    let minDate = new Date();
    let maxDate = new Date(0);

    for (const event of events) {
      providers.add(event.provider);
      models.add(event.model);
      totalThroughput += event.throughput_tps;
      totalTokens += event.input_tokens + event.output_tokens;

      const eventDate = new Date(event.ts);
      if (eventDate < minDate) minDate = eventDate;
      if (eventDate > maxDate) maxDate = eventDate;
    }

    const daysDiff = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));

    return {
      total_throughput: totalThroughput,
      total_tokens: totalTokens,
      unique_providers: Array.from(providers),
      unique_models: Array.from(models),
      date_range_days: daysDiff || 1,
      time_range: {
        start: minDate.toISOString(),
        end: maxDate.toISOString(),
      },
    };
  }
}


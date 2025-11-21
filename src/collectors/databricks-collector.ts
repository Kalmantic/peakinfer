/**
 * Databricks Collector - Mock Implementation
 * Generates realistic Databricks serving endpoint and jobs data
 * Based on PRD v0.7: REST APIs for jobs/runs/serving endpoints
 */

import { BaseCollector } from './base-collector.js';
import { InferenceEvent } from '../types/events.js';
import { CollectorValidationResult, DatabricksCollectorConfig } from '../types/collectors.js';
import { v4 as uuidv4 } from 'uuid';

export class DatabricksCollector extends BaseCollector {
  private mockConfig: DatabricksCollectorConfig;

  constructor(config?: Partial<DatabricksCollectorConfig>) {
    super('databricks', config);
    this.mockConfig = {
      ...this.config,
      resources: {
        endpoints: [],
        jobs: [],
        runs: [],
        ...config?.resources,
      },
    } as DatabricksCollectorConfig;
  }

  /**
   * Collect mock Databricks inference usage data
   */
  async collect(): Promise<InferenceEvent[]> {
    console.log('  🧱 Collecting Databricks inference usage...');
    
    this.respectTrustBoundaries();
    
    const events: InferenceEvent[] = [];
    
    // Simulate collecting from multiple Databricks endpoints
    const endpoints = this.getMockEndpoints();
    
    for (const endpoint of endpoints) {
      const endpointEvents = await this.collectEndpointUsage(endpoint);
      events.push(...endpointEvents);
    }
    
    console.log(`  ✅ Collected ${events.length} Databricks inference events`);
    return events;
  }

  /**
   * Validate Databricks collector configuration
   */
  async validate(): Promise<CollectorValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // In real implementation, would validate Databricks credentials
    // For mock, just validate configuration structure
    if (!this.mockConfig.connection?.host && !this.mockConfig.connection?.workspace_id) {
      warnings.push('No Databricks workspace specified, using mock data');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      trustBoundariesRespected: true,
    };
  }

  /**
   * Get mock Databricks serving endpoints
   */
  private getMockEndpoints() {
    return [
      {
        id: 'endpoint-llama2-70b',
        name: 'llama-2-70b-chat',
        model: 'meta-llama/Llama-2-70b-chat-hf',
        state: 'READY',
        creator: 'mlops-team',
      },
      {
        id: 'endpoint-mixtral-8x7b',
        name: 'mixtral-instruct',
        model: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
        state: 'READY',
        creator: 'ai-team',
      },
      {
        id: 'endpoint-custom-bert',
        name: 'custom-classification',
        model: 'bert-base-uncased-finetuned',
        state: 'READY',
        creator: 'data-science',
      },
    ];
  }

  /**
   * Collect usage from a specific endpoint
   */
  private async collectEndpointUsage(endpoint: any): Promise<InferenceEvent[]> {
    const events: InferenceEvent[] = [];
    const now = new Date();
    
    // Generate 100-200 events per endpoint over last 7 days
    const eventCount = Math.floor(Math.random() * 100) + 100;
    
    for (let i = 0; i < eventCount; i++) {
      const daysAgo = Math.floor(Math.random() * 7);
      const hoursAgo = Math.floor(Math.random() * 24);
      const timestamp = new Date(now);
      timestamp.setDate(timestamp.getDate() - daysAgo);
      timestamp.setHours(timestamp.getHours() - hoursAgo);

      // Realistic token distributions based on model size
      const isLargeModel = endpoint.model.includes('70b') || endpoint.model.includes('8x7B');
      const inputTokens = Math.floor(Math.random() * (isLargeModel ? 4000 : 2000)) + 200;
      const outputTokens = Math.floor(Math.random() * (isLargeModel ? 2000 : 1000)) + 100;
      const latency = Math.floor(Math.random() * (isLargeModel ? 5000 : 2000)) + 300;

      const rawEvent = {
        request_id: uuidv4(),
        timestamp: timestamp.getTime(),
        endpoint_name: endpoint.name,
        model_name: endpoint.model,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        latency_ms: latency,
        cost: 0, // Will be calculated
        workspace_id: 'workspace-prod',
        tags: {
          team: endpoint.creator,
          environment: 'production',
          endpoint_id: endpoint.id,
        },
      };

      const event = this.normalizeDatabricksEvent(rawEvent);
      events.push(this.filterPII(event));
    }

    return events;
  }

  /**
   * Normalize Databricks event to canonical schema
   */
  private normalizeDatabricksEvent(raw: any): InferenceEvent {
    // Determine provider based on model name
    let provider = 'databricks';
    if (raw.model_name.includes('llama')) provider = 'together';
    if (raw.model_name.includes('mixtral')) provider = 'together';
    if (raw.model_name.includes('gpt')) provider = 'openai';
    if (raw.model_name.includes('claude')) provider = 'anthropic';

    return {
      id: raw.request_id,
      ts: new Date(raw.timestamp).toISOString(),
      intent: this.inferIntentFromTags(raw.tags),
      provider: provider,
      model: raw.model_name,
      input_tokens: raw.input_tokens,
      output_tokens: raw.output_tokens,
      latency_ms: raw.latency_ms,
      cost_usd: this.calculateDatabricksCost(raw),
      endpoint: `${raw.workspace_id}.databricks.com`,
      region: 'us-west-2',
      tenant: raw.tags?.team || 'default',
      metadata: {
        endpoint_name: raw.endpoint_name,
        workspace_id: raw.workspace_id,
        tags: raw.tags,
      },
    };
  }

  /**
   * Infer intent from Databricks tags
   */
  private inferIntentFromTags(tags: any): string {
    if (tags?.use_case) return tags.use_case;
    if (tags?.team === 'mlops-team') return 'ml_operations';
    if (tags?.team === 'ai-team') return 'ai_assistant';
    if (tags?.team === 'data-science') return 'data_classification';
    return 'databricks_inference';
  }

  /**
   * Calculate Databricks-specific costs
   * Based on DBU consumption and model serving costs
   */
  private calculateDatabricksCost(raw: any): number {
    const totalTokens = raw.input_tokens + raw.output_tokens;
    
    // Databricks charges per DBU + inference costs
    // Approximate: $0.0002 per 1000 tokens for serving
    const baseCost = (totalTokens / 1000) * 0.0002;
    
    // Add DBU costs (varies by instance type)
    const dbuCost = (raw.latency_ms / 1000) * 0.0005; // $0.0005 per second
    
    return baseCost + dbuCost;
  }

  /**
   * Mock REST API endpoint for Databricks
   */
  private getMockAPIEndpoint(): string {
    return '/api/2.0/serving-endpoints/{endpoint_name}/invocations';
  }
}


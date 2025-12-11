/**
 * Databricks Collector - Real Implementation
 * Connects to Databricks REST API for jobs/runs/serving endpoints
 * Based on PRD v0.7: REST APIs for jobs/runs/serving endpoints
 */

import { BaseCollector } from './base-collector.js';
import { InferenceEvent } from '../types/events.js';
import { CollectorValidationResult, DatabricksCollectorConfig } from '../types/collectors.js';
import { v4 as uuidv4 } from 'uuid';

// Databricks API response interfaces
interface DatabricksServingEndpoint {
  name: string;
  creator: string;
  creation_timestamp: number;
  last_updated_timestamp: number;
  state: {
    ready: string;
    config_update: string;
  };
  config: {
    served_entities?: {
      entity_name: string;
      entity_version: string;
      workload_size?: string;
      scale_to_zero_enabled?: boolean;
    }[];
    served_models?: {
      model_name: string;
      model_version: string;
    }[];
  };
  tags?: { key: string; value: string }[];
}

interface DatabricksServingEndpointLog {
  request_id: string;
  timestamp_ms: number;
  request_metadata?: {
    model_name?: string;
    input_tokens?: number;
    output_tokens?: number;
    request_latency_ms?: number;
  };
  response?: {
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  };
}

interface DatabricksJob {
  job_id: number;
  settings: {
    name: string;
    tags?: Record<string, string>;
    tasks?: any[];
  };
  created_time: number;
  creator_user_name: string;
}

interface DatabricksJobRun {
  job_id: number;
  run_id: number;
  start_time: number;
  end_time?: number;
  state: {
    life_cycle_state: string;
    result_state?: string;
  };
  run_duration?: number;
}

export class DatabricksCollector extends BaseCollector {
  private databricksConfig: DatabricksCollectorConfig;
  private baseUrl: string = '';
  private token: string = '';

  constructor(config?: Partial<DatabricksCollectorConfig>) {
    super('databricks', config);
    this.databricksConfig = {
      ...this.config,
      connection: {
        host: process.env.DATABRICKS_HOST || config?.connection?.host || '',
        token: process.env.DATABRICKS_TOKEN || config?.connection?.token || '',
        workspace_id: process.env.DATABRICKS_WORKSPACE_ID || config?.connection?.workspace_id || '',
        ...config?.connection,
      },
      resources: {
        endpoints: config?.resources?.endpoints || [],
        jobs: config?.resources?.jobs || [],
        runs: config?.resources?.runs || [],
        ...config?.resources,
      },
    } as DatabricksCollectorConfig;

    // Set up base URL
    const host = this.databricksConfig.connection?.host || '';
    this.baseUrl = host.startsWith('http') ? host : `https://${host}`;
    this.token = this.databricksConfig.connection?.token || '';
  }

  /**
   * Collect Databricks inference usage data
   */
  async collect(): Promise<InferenceEvent[]> {
    console.log('  🧱 Collecting Databricks inference usage...');

    this.respectTrustBoundaries();

    const events: InferenceEvent[] = [];

    try {
      // Collect from serving endpoints
      const endpoints = await this.listServingEndpoints();
      console.log(`  📍 Found ${endpoints.length} serving endpoints`);

      for (const endpoint of endpoints) {
        const endpointEvents = await this.collectEndpointUsage(endpoint);
        events.push(...endpointEvents);
      }

      // Collect from ML jobs that may involve inference
      const jobs = await this.listJobs();
      console.log(`  📋 Found ${jobs.length} ML jobs`);

      for (const job of jobs) {
        const jobEvents = await this.collectJobInference(job);
        events.push(...jobEvents);
      }

      console.log(`  ✅ Collected ${events.length} Databricks inference events`);
      return events;
    } catch (error) {
      console.error('  ❌ Databricks collection failed:', error);
      throw error;
    }
  }

  /**
   * Validate Databricks collector configuration
   */
  async validate(): Promise<CollectorValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    const conn = this.databricksConfig.connection;

    // Required fields
    if (!conn?.host) {
      errors.push('Missing DATABRICKS_HOST or connection.host');
    }
    if (!conn?.token) {
      errors.push('Missing DATABRICKS_TOKEN or connection.token');
    }

    // Test connection if credentials provided
    if (errors.length === 0) {
      try {
        const endpoints = await this.listServingEndpoints();
        if (endpoints.length === 0) {
          warnings.push('No serving endpoints found in workspace');
        }
      } catch (error) {
        errors.push(`API connection failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      trustBoundariesRespected: true,
    };
  }

  /**
   * Make authenticated request to Databricks API
   */
  private async apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Databricks API error (${response.status}): ${errorText}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * List serving endpoints
   */
  private async listServingEndpoints(): Promise<DatabricksServingEndpoint[]> {
    try {
      const response = await this.apiRequest<{ endpoints?: DatabricksServingEndpoint[] }>(
        '/api/2.0/serving-endpoints'
      );
      return response.endpoints || [];
    } catch (error) {
      console.warn('  ⚠️  Could not list serving endpoints:', error);
      return [];
    }
  }

  /**
   * Get serving endpoint logs/metrics
   */
  private async getEndpointLogs(
    endpointName: string,
    startTime: number,
    endTime: number
  ): Promise<DatabricksServingEndpointLog[]> {
    try {
      // Try the query endpoint for inference logs
      const response = await this.apiRequest<{ logs?: DatabricksServingEndpointLog[] }>(
        `/api/2.0/serving-endpoints/${endpointName}/logs?start_time_ms=${startTime}&end_time_ms=${endTime}`
      );
      return response.logs || [];
    } catch (error) {
      // Logs endpoint may not exist or have different schema
      // Try alternative metrics endpoint
      try {
        const metricsResponse = await this.apiRequest<{ data?: any[] }>(
          `/api/2.0/serving-endpoints/${endpointName}/metrics?start_time_ms=${startTime}&end_time_ms=${endTime}`
        );
        return this.convertMetricsToLogs(metricsResponse.data || [], endpointName);
      } catch (metricsError) {
        console.warn(`  ⚠️  Could not get logs for ${endpointName}`);
        return [];
      }
    }
  }

  /**
   * Convert metrics data to log format
   */
  private convertMetricsToLogs(metrics: any[], endpointName: string): DatabricksServingEndpointLog[] {
    return metrics.map(m => ({
      request_id: m.request_id || uuidv4(),
      timestamp_ms: m.timestamp || Date.now(),
      request_metadata: {
        model_name: endpointName,
        input_tokens: m.input_tokens || m.prompt_tokens || 0,
        output_tokens: m.output_tokens || m.completion_tokens || 0,
        request_latency_ms: m.latency_ms || m.duration_ms || 0,
      },
    }));
  }

  /**
   * Collect usage from a serving endpoint
   */
  private async collectEndpointUsage(endpoint: DatabricksServingEndpoint): Promise<InferenceEvent[]> {
    const events: InferenceEvent[] = [];

    // Get logs from the last 7 days
    const endTime = Date.now();
    const startTime = endTime - (7 * 24 * 60 * 60 * 1000);

    const logs = await this.getEndpointLogs(endpoint.name, startTime, endTime);

    for (const log of logs) {
      const event = this.normalizeEndpointLog(log, endpoint);
      events.push(this.filterPII(event));
    }

    return events;
  }

  /**
   * Normalize endpoint log to canonical event
   */
  private normalizeEndpointLog(log: DatabricksServingEndpointLog, endpoint: DatabricksServingEndpoint): InferenceEvent {
    const modelName = this.getModelFromEndpoint(endpoint);
    const provider = this.inferProvider(modelName);

    const inputTokens = log.request_metadata?.input_tokens ||
                        log.response?.usage?.prompt_tokens || 0;
    const outputTokens = log.request_metadata?.output_tokens ||
                         log.response?.usage?.completion_tokens || 0;
    const latencyMs = log.request_metadata?.request_latency_ms || 0;

    // Extract tenant/team from endpoint tags
    const teamTag = endpoint.tags?.find(t => t.key === 'team' || t.key === 'owner');
    const tenant = teamTag?.value || endpoint.creator || 'default';

    return {
      id: log.request_id || uuidv4(),
      ts: new Date(log.timestamp_ms).toISOString(),
      intent: this.inferIntent(endpoint),
      provider: provider,
      model: modelName,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      latency_ms: latencyMs,
      throughput_tps: this.computeThroughput(inputTokens, outputTokens, latencyMs),
      endpoint: `${this.databricksConfig.connection?.workspace_id || 'workspace'}.databricks.com`,
      region: this.extractRegion(),
      tenant: tenant,
      metadata: {
        endpoint_name: endpoint.name,
        workspace_id: this.databricksConfig.connection?.workspace_id,
        endpoint_state: endpoint.state?.ready,
      },
    };
  }

  /**
   * Get model name from endpoint configuration
   */
  private getModelFromEndpoint(endpoint: DatabricksServingEndpoint): string {
    // Check served_entities first (newer API)
    if (endpoint.config?.served_entities?.[0]) {
      return endpoint.config.served_entities[0].entity_name;
    }

    // Fall back to served_models (older API)
    if (endpoint.config?.served_models?.[0]) {
      return endpoint.config.served_models[0].model_name;
    }

    return endpoint.name;
  }

  /**
   * Infer provider from model name
   */
  private inferProvider(modelName: string): string {
    const lower = modelName.toLowerCase();
    if (lower.includes('llama') || lower.includes('mistral') || lower.includes('mixtral')) {
      return 'meta';
    }
    if (lower.includes('gpt')) return 'openai';
    if (lower.includes('claude')) return 'anthropic';
    if (lower.includes('gemini') || lower.includes('palm')) return 'google';
    if (lower.includes('cohere')) return 'cohere';
    return 'databricks';
  }

  /**
   * Infer intent from endpoint configuration
   */
  private inferIntent(endpoint: DatabricksServingEndpoint): string {
    const intentTag = endpoint.tags?.find(t => t.key === 'intent' || t.key === 'use_case');
    if (intentTag) return intentTag.value;

    const name = endpoint.name.toLowerCase();
    if (name.includes('chat')) return 'chat';
    if (name.includes('embed')) return 'embedding';
    if (name.includes('classify')) return 'classification';
    if (name.includes('extract')) return 'extraction';
    if (name.includes('summarize') || name.includes('summary')) return 'summarization';

    return 'inference';
  }

  /**
   * Extract region from workspace URL
   */
  private extractRegion(): string {
    const host = this.databricksConfig.connection?.host || '';
    // Databricks hosts are like: adb-1234567890123456.19.azuredatabricks.net
    // or: dbc-abc12345-1234.cloud.databricks.com
    if (host.includes('azuredatabricks')) {
      return 'azure';
    }
    if (host.includes('gcp.databricks')) {
      return 'gcp';
    }
    // AWS is default for cloud.databricks.com
    return 'aws';
  }

  /**
   * List ML jobs
   */
  private async listJobs(): Promise<DatabricksJob[]> {
    try {
      const response = await this.apiRequest<{ jobs?: DatabricksJob[] }>(
        '/api/2.1/jobs/list?limit=100'
      );
      return response.jobs || [];
    } catch (error) {
      console.warn('  ⚠️  Could not list jobs:', error);
      return [];
    }
  }

  /**
   * Get recent job runs
   */
  private async getJobRuns(jobId: number, limit: number = 100): Promise<DatabricksJobRun[]> {
    try {
      const response = await this.apiRequest<{ runs?: DatabricksJobRun[] }>(
        `/api/2.1/jobs/runs/list?job_id=${jobId}&limit=${limit}`
      );
      return response.runs || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Collect inference events from job runs
   */
  private async collectJobInference(job: DatabricksJob): Promise<InferenceEvent[]> {
    const events: InferenceEvent[] = [];

    // Only process jobs that appear to be ML inference related
    if (!this.isInferenceJob(job)) {
      return events;
    }

    const runs = await this.getJobRuns(job.job_id, 50);

    for (const run of runs) {
      if (run.state.life_cycle_state === 'TERMINATED' && run.state.result_state === 'SUCCESS') {
        const event = this.normalizeJobRun(job, run);
        if (event) {
          events.push(this.filterPII(event));
        }
      }
    }

    return events;
  }

  /**
   * Check if job is related to inference
   */
  private isInferenceJob(job: DatabricksJob): boolean {
    const name = job.settings.name.toLowerCase();
    const tags = job.settings.tags || {};

    // Check name patterns
    if (name.includes('inference') || name.includes('predict') ||
        name.includes('llm') || name.includes('embedding') ||
        name.includes('score') || name.includes('classify')) {
      return true;
    }

    // Check tags
    if (tags['type'] === 'inference' || tags['ml_type'] === 'inference') {
      return true;
    }

    return false;
  }

  /**
   * Normalize job run to inference event
   */
  private normalizeJobRun(job: DatabricksJob, run: DatabricksJobRun): InferenceEvent | null {
    // Job runs don't have token counts directly, but we can estimate from duration
    const durationMs = run.run_duration || (run.end_time ? run.end_time - run.start_time : 0);

    if (durationMs === 0) return null;

    const tags = job.settings.tags || {};

    return {
      id: `job-${run.run_id}`,
      ts: new Date(run.start_time).toISOString(),
      intent: tags['intent'] || 'batch_inference',
      provider: 'databricks',
      model: tags['model'] || job.settings.name,
      input_tokens: 0, // Unknown for batch jobs
      output_tokens: 0,
      latency_ms: durationMs,
      throughput_tps: 0, // Unknown for batch jobs
      endpoint: `${this.databricksConfig.connection?.workspace_id || 'workspace'}.databricks.com`,
      region: this.extractRegion(),
      tenant: job.creator_user_name || 'default',
      metadata: {
        job_id: job.job_id,
        job_name: job.settings.name,
        run_id: run.run_id,
        source: 'databricks_job',
      },
    };
  }

  /**
   * Calculate throughput in tokens per second
   */
  private computeThroughput(inputTokens: number, outputTokens: number, latencyMs: number): number {
    if (latencyMs <= 0) return 0;
    const totalTokens = inputTokens + outputTokens;
    return (totalTokens / latencyMs) * 1000; // tokens per second
  }

  /**
   * Get environment variable requirements
   */
  static getRequiredEnvVars(): string[] {
    return [
      'DATABRICKS_HOST - Databricks workspace URL (e.g., adb-1234567890123456.19.azuredatabricks.net)',
      'DATABRICKS_TOKEN - Personal access token with serving endpoint and jobs permissions',
      'DATABRICKS_WORKSPACE_ID - (Optional) Workspace ID for tagging',
    ];
  }
}

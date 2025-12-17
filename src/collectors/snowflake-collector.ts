/**
 * Snowflake Collector - Real Implementation
 * Connects to Snowflake and queries inference usage data
 * Based on PRD v0.7: SQL modules for cost & usage views
 */

import { BaseCollector } from './base-collector.js';
import { InferenceEvent } from '../types/events.js';
import { CollectorValidationResult, SnowflakeCollectorConfig } from '../types/collectors.js';
import { createRequire } from 'module';

// snowflake-sdk is CommonJS, need to use createRequire for ESM
const require = createRequire(import.meta.url);
const snowflake = require('snowflake-sdk');

// Connection interface for Snowflake
interface SnowflakeConnection {
  execute: (options: { sqlText: string; complete: (err: any, stmt: any, rows: any[]) => void }) => void;
  destroy: (callback: (err: any) => void) => void;
}

export class SnowflakeCollector extends BaseCollector {
  private snowflakeConfig: SnowflakeCollectorConfig;
  private connection: SnowflakeConnection | null = null;

  constructor(config?: Partial<SnowflakeCollectorConfig>) {
    super('snowflake', config);
    this.snowflakeConfig = {
      ...this.config,
      connection: {
        account: process.env.SNOWFLAKE_ACCOUNT || config?.connection?.account || '',
        username: process.env.SNOWFLAKE_USER || config?.connection?.username || '',
        password: process.env.SNOWFLAKE_PASSWORD || config?.connection?.password || '',
        database: process.env.SNOWFLAKE_DATABASE || config?.connection?.database || '',
        schema: process.env.SNOWFLAKE_SCHEMA || config?.connection?.schema || 'PUBLIC',
        warehouse: process.env.SNOWFLAKE_WAREHOUSE || config?.connection?.warehouse || '',
        role: process.env.SNOWFLAKE_ROLE || config?.connection?.role,
        ...config?.connection,
      },
      query: {
        table: config?.query?.table || 'inference_usage',
        timeRange: config?.query?.timeRange || '7_days',
        customQuery: config?.query?.customQuery,
        ...config?.query,
      },
    } as SnowflakeCollectorConfig;
  }

  /**
   * Collect Snowflake inference usage data
   */
  async collect(): Promise<InferenceEvent[]> {
    console.log('  📊 Collecting Snowflake inference usage...');

    this.respectTrustBoundaries();

    try {
      // Connect to Snowflake
      await this.connect();

      // Execute query
      const query = this.buildQuery();
      const rows = await this.executeQuery(query);

      // Normalize and filter events
      const events: InferenceEvent[] = [];
      for (const row of rows) {
        const event = this.normalizeSnowflakeRow(row);
        events.push(this.filterPII(event));
      }

      console.log(`  ✅ Collected ${events.length} Snowflake inference events`);
      return events;
    } catch (error) {
      console.error('  ❌ Snowflake collection failed:', error);
      throw error;
    } finally {
      await this.disconnect();
    }
  }

  /**
   * Validate Snowflake collector configuration
   */
  async validate(): Promise<CollectorValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    const conn = this.snowflakeConfig.connection;

    // Required fields
    if (!conn?.account) {
      errors.push('Missing SNOWFLAKE_ACCOUNT or connection.account');
    }
    if (!conn?.username) {
      errors.push('Missing SNOWFLAKE_USER or connection.username');
    }
    if (!conn?.password) {
      errors.push('Missing SNOWFLAKE_PASSWORD or connection.password');
    }
    if (!conn?.database) {
      errors.push('Missing SNOWFLAKE_DATABASE or connection.database');
    }
    if (!conn?.warehouse) {
      errors.push('Missing SNOWFLAKE_WAREHOUSE or connection.warehouse');
    }

    // Try to connect if no config errors
    if (errors.length === 0) {
      try {
        await this.connect();
        await this.disconnect();
      } catch (error) {
        errors.push(`Connection failed: ${error instanceof Error ? error.message : String(error)}`);
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
   * Connect to Snowflake
   */
  private async connect(): Promise<void> {
    const conn = this.snowflakeConfig.connection;

    if (!conn) {
      throw new Error('Snowflake connection configuration is missing');
    }

    return new Promise((resolve, reject) => {
      const connectionConfig: any = {
        account: conn.account,
        username: conn.username,
        password: conn.password,
        database: conn.database,
        schema: conn.schema || 'PUBLIC',
        warehouse: conn.warehouse,
      };

      if (conn.role) {
        connectionConfig.role = conn.role;
      }

      const connection = snowflake.createConnection(connectionConfig);

      connection.connect(async (err: any, conn: any) => {
        if (err) {
          reject(new Error(`Snowflake connection failed: ${err.message}`));
        } else {
          this.connection = conn;
          // Explicitly set the warehouse context
          const warehouse = connectionConfig.warehouse;
          if (warehouse) {
            // Try to resume the warehouse first (in case it's suspended)
            conn.execute({
              sqlText: `ALTER WAREHOUSE ${warehouse} RESUME IF SUSPENDED`,
              complete: (resumeErr: any) => {
                // Ignore resume errors (may not have permission, or already running)
                conn.execute({
                  sqlText: `USE WAREHOUSE ${warehouse}`,
                  complete: (useErr: any) => {
                    if (useErr) {
                      reject(new Error(`Failed to set warehouse '${warehouse}': ${useErr.message}`));
                    } else {
                      resolve();
                    }
                  },
                });
              },
            });
          } else {
            resolve();
          }
        }
      });
    });
  }

  /**
   * Disconnect from Snowflake
   */
  private async disconnect(): Promise<void> {
    if (this.connection) {
      return new Promise((resolve) => {
        this.connection!.destroy((err: any) => {
          this.connection = null;
          resolve();
        });
      });
    }
  }

  /**
   * Execute SQL query
   */
  private async executeQuery(query: string): Promise<any[]> {
    if (!this.connection) {
      throw new Error('Not connected to Snowflake');
    }

    return new Promise((resolve, reject) => {
      this.connection!.execute({
        sqlText: query,
        complete: (err: any, stmt: any, rows: any[]) => {
          if (err) {
            reject(new Error(`Query execution failed: ${err.message}`));
          } else {
            resolve(rows || []);
          }
        },
      });
    });
  }

  /**
   * Build SQL query for inference usage
   */
  private buildQuery(): string {
    const qc = this.snowflakeConfig.query;

    // Use custom query if provided
    if (qc?.customQuery) {
      return qc.customQuery;
    }

    const timeRangeMap: Record<string, string> = {
      '1_day': "DATEADD(day, -1, CURRENT_TIMESTAMP())",
      '7_days': "DATEADD(day, -7, CURRENT_TIMESTAMP())",
      '30_days': "DATEADD(day, -30, CURRENT_TIMESTAMP())",
      '90_days': "DATEADD(day, -90, CURRENT_TIMESTAMP())",
    };

    const timeFilter = timeRangeMap[qc?.timeRange || '7_days'] || timeRangeMap['7_days'];

    // Standard query for inference_usage table
    return `
      SELECT
        request_id,
        timestamp,
        intent,
        provider,
        model,
        input_tokens,
        output_tokens,
        latency_ms,
        cost_usd,
        endpoint,
        region,
        tenant
      FROM ${qc?.table || 'inference_usage'}
      WHERE timestamp >= ${timeFilter}
      ORDER BY timestamp DESC
      LIMIT 10000
    `;
  }

  /**
   * Normalize Snowflake row to canonical event
   */
  private normalizeSnowflakeRow(row: any): InferenceEvent {
    // Handle various column naming conventions (uppercase Snowflake vs lowercase)
    const getValue = (keys: string[], defaultValue: any = null) => {
      for (const key of keys) {
        if (row[key] !== undefined) return row[key];
        if (row[key.toUpperCase()] !== undefined) return row[key.toUpperCase()];
        if (row[key.toLowerCase()] !== undefined) return row[key.toLowerCase()];
      }
      return defaultValue;
    };

    const inputTokens = getValue(['input_tokens', 'INPUT_TOKENS', 'prompt_tokens', 'PROMPT_TOKENS'], 0);
    const outputTokens = getValue(['output_tokens', 'OUTPUT_TOKENS', 'completion_tokens', 'COMPLETION_TOKENS'], 0);
    const provider = getValue(['provider', 'PROVIDER', 'model_provider', 'MODEL_PROVIDER'], 'unknown');
    const model = getValue(['model', 'MODEL', 'model_name', 'MODEL_NAME'], 'unknown');

    const event = this.normalizeEvent(
      {
        id: getValue(['request_id', 'REQUEST_ID', 'id', 'ID'], crypto.randomUUID()),
        timestamp: getValue(['timestamp', 'TIMESTAMP', 'ts', 'TS'], new Date().toISOString()),
        intent: getValue(['intent', 'INTENT', 'application_context', 'APPLICATION_CONTEXT'], 'inference'),
        model: model,
        usage: {
          prompt_tokens: inputTokens,
          completion_tokens: outputTokens,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
        },
        latency_ms: getValue(['latency_ms', 'LATENCY_MS', 'response_time_ms', 'RESPONSE_TIME_MS'], 0),
        region: getValue(['region', 'REGION'], 'unknown'),
        tenant: getValue(['tenant', 'TENANT', 'workspace', 'WORKSPACE', 'team', 'TEAM'], 'default'),
      },
      provider
    );

    // Override endpoint
    event.endpoint = getValue(['endpoint', 'ENDPOINT', 'endpoint_url', 'ENDPOINT_URL'], `${provider}.api`);

    // Override cost if provided
    const costUsd = getValue(['cost_usd', 'COST_USD', 'cost', 'COST'], null);
    if (costUsd !== null && costUsd > 0) {
      event.cost_usd = costUsd;
    }

    return event;
  }

  /**
   * Get sample SQL query for creating the inference_usage view
   * This is for documentation purposes
   */
  getSampleViewSQL(): string {
    return `
-- Sample Snowflake view for PeakInfer inference usage tracking
CREATE OR REPLACE VIEW inference_usage AS
SELECT
    request_id,
    timestamp,
    intent AS application_context,
    provider AS model_provider,
    model AS model_name,
    input_tokens AS input_token_count,
    output_tokens AS output_token_count,
    latency_ms AS response_time_ms,
    cost_usd,
    endpoint AS endpoint_url,
    region,
    tenant AS workspace
FROM your_inference_logs_table
WHERE timestamp >= DATEADD(day, -30, CURRENT_TIMESTAMP());

-- Or create a table directly
CREATE TABLE IF NOT EXISTS inference_usage (
    request_id VARCHAR(36) PRIMARY KEY,
    timestamp TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    intent VARCHAR(255),
    provider VARCHAR(50),
    model VARCHAR(100),
    input_tokens NUMBER,
    output_tokens NUMBER,
    latency_ms NUMBER,
    cost_usd FLOAT,
    endpoint VARCHAR(255),
    region VARCHAR(50),
    tenant VARCHAR(100)
);
    `;
  }
}

/**
 * Collector Type Definitions
 * Defines interfaces for OSS collectors with trust boundaries
 * Based on PRD v0.7 Section 3: OSS Collectors Architecture
 */

import { InferenceEvent } from './events.js';

/**
 * Collector configuration with trust boundaries
 */
export interface CollectorConfig {
  /** Trust boundary enforcement */
  trustBoundaries: {
    /** No network egress - data stays local */
    noNetworkEgress: boolean;
    
    /** Least privilege access */
    leastPrivilege: boolean;
    
    /** Auditable code only */
    auditableCode: boolean;
    
    /** No PII exfiltration */
    noPIIExfiltration: boolean;
  };
  
  /** Output format - always events.jsonl */
  outputFormat: 'events.jsonl';
  
  /** Normalization to canonical schema */
  normalization: 'canonical_schema';
  
  /** Optional collector-specific settings */
  settings?: Record<string, any>;
}

/**
 * Collector result with metadata
 */
export interface CollectorResult {
  /** Collected events */
  events: InferenceEvent[];
  
  /** Collection metadata */
  metadata: {
    collector: string;
    timestamp: string;
    source: string;
    event_count: number;
    time_range?: {
      start: string;
      end: string;
    };
  };
  
  /** Collection statistics */
  stats: {
    total_cost: number;
    total_tokens: number;
    unique_providers: string[];
    unique_models: string[];
    date_range_days: number;
  };
  
  /** Any warnings or issues during collection */
  warnings?: string[];
}

/**
 * Snowflake collector configuration
 */
export interface SnowflakeCollectorConfig extends CollectorConfig {
  connection?: {
    account?: string;
    username?: string;
    password?: string;
    database?: string;
    warehouse?: string;
  };
  query?: {
    table: string;
    timeRange: string;
    filters?: Record<string, any>;
  };
}

/**
 * Databricks collector configuration
 */
export interface DatabricksCollectorConfig extends CollectorConfig {
  connection?: {
    host?: string;
    token?: string;
    workspace_id?: string;
  };
  resources?: {
    endpoints?: string[];
    jobs?: string[];
    runs?: string[];
  };
}

/**
 * Terraform collector configuration
 */
export interface TerraformCollectorConfig extends CollectorConfig {
  paths?: {
    stateFile?: string;
    configDir?: string;
  };
  resources?: {
    types?: string[];
    names?: string[];
  };
}

/**
 * Manual collector configuration
 */
export interface ManualCollectorConfig extends CollectorConfig {
  input: {
    files: string[];
    format: 'jsonl' | 'csv' | 'parquet' | 'json';
  };
}

/**
 * Infrastructure configuration extracted from Terraform
 */
export interface InfrastructureConfig {
  resources: InfrastructureResource[];
  cost_estimates: CostEstimate[];
  gpu_inventory: GPUInventory[];
  network_topology: NetworkTopology;
}

export interface InfrastructureResource {
  type: string;
  name: string;
  provider: string;
  attributes: Record<string, any>;
  tags?: Record<string, string>;
}

export interface CostEstimate {
  resource_id: string;
  resource_type: string;
  hourly_cost: number;
  monthly_cost: number;
  optimization_potential: number;
}

export interface GPUInventory {
  instance_type: string;
  gpu_type: string;
  gpu_count: number;
  memory_gb: number;
  hourly_cost: number;
  region: string;
  availability: 'on-demand' | 'spot' | 'reserved';
}

export interface NetworkTopology {
  regions: string[];
  vpc_config?: any;
  multi_region: boolean;
  bandwidth_gbps: number;
}

/**
 * Validation result for collectors
 */
export interface CollectorValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  trustBoundariesRespected: boolean;
}


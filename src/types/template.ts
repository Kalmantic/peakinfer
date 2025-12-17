/**
 * Template Types - Based on TokenSqueeze insights and 27 existing templates
 * Templates encode optimization knowledge that Claude Code SDK agents can execute
 */

export interface OptimizationTemplate {
  // Template Metadata
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  confidence: number; // 0-1 success rate
  success_count: number;
  verified_environments: number;
  contributors: string[];
  last_updated: string;

  // Environment Matching - Claude agents use this to find applicable templates
  environment_match: EnvironmentMatch;

  // Optimization Strategy
  optimization: OptimizationStrategy;

  // Economics Engine - TokenSqueeze-derived formulas
  economics: EconomicsModel;

  // Executable Implementation
  implementation: Implementation;

  // Monitoring & Rollback
  monitoring: Monitoring;

  // Community Validation
  results?: CommunityResults;
}

export type TemplateCategory =
  | "runtime_optimization"
  | "quantization"
  | "model_routing"
  | "context_optimization"
  | "hardware_optimization"
  | "edge_deployment"
  | "framework_resilience"
  | "concurrency_optimization"
  | "cost_monitoring"
  | "quality_preservation";

export interface EnvironmentMatch {
  // Application Layer Matching
  runtime?: string | string[];
  model_size?: string | string[];
  batch_size?: string | string[];
  context_length?: string | string[];

  // Serving Layer Matching
  gpu_utilization?: string | string[];
  memory_bound?: boolean;
  deployment_stage?: string | string[];

  // Infrastructure Layer Matching
  deployment?: string | string[];
  gpu_memory_bandwidth?: string | string[];
  criticality?: string;

  // Business Context
  team_size?: string;
  engineering_capacity?: string;
  downtime_cost?: string;

  // Custom matching criteria
  [key: string]: any;
}

export interface OptimizationStrategy {
  technique: string;
  source?: string;
  target?: string;

  // Expected Improvements (TokenSqueeze-informed)
  expected_cost_reduction?: string;
  expected_throughput_improvement?: string;
  expected_latency_improvement?: string;
  expected_memory_efficiency?: string;
  expected_batch_improvement?: string;

  // Numeric values for calculations
  cost_reduction?: number;
  performance_improvement?: number;

  // Implementation Effort
  effort_estimate: string;
  risk_level: "low" | "medium" | "high";
}

export interface EconomicsModel {
  // Baseline Cost Calculation
  baseline_calculation: {
    [key: string]: string; // Formula strings that agents can evaluate
  };

  // Projected Improvements
  projected_improvement?: {
    [key: string]: string;
  };

  projected_savings?: {
    [key: string]: string;
  };

  // Implementation Investment
  implementation_cost: {
    engineering_hours?: number;
    hourly_rate?: number;
    total_cost: number;
    [key: string]: any;
  };

  // ROI Calculation
  roi_calculation?: {
    [key: string]: string;
  };
}

export interface Implementation {
  // Prerequisites that agents must validate
  prerequisites: Prerequisite[];

  // Executable steps that agents can run
  automated_steps: AutomatedStep[];
}

export interface Prerequisite {
  requirement: string;
  validation_command: string;
  optional?: boolean;
}

export interface AutomatedStep {
  step_id: string;
  name: string;
  executable: boolean;
  commands: string[];
  validation: StepValidation;
  dependencies?: string[]; // Other step_ids this depends on
}

export interface StepValidation {
  command: string;
  success_criteria: string;
  rollback_command: string;
  timeout_seconds?: number;
}

export interface Monitoring {
  key_metrics: MonitoringMetric[];
  rollback_triggers: RollbackTrigger[];
  dashboard_config?: DashboardConfig;
}

export interface MonitoringMetric {
  metric: string;
  target: string;
  alert_threshold: string;
  collection_method?: string;
}

export interface RollbackTrigger {
  condition: string;
  action: "automatic_rollback" | "alert_and_investigation" | "escalate";
  delay_minutes?: number;
}

export interface DashboardConfig {
  charts: ChartConfig[];
  refresh_interval_seconds: number;
}

export interface ChartConfig {
  title: string;
  metrics: string[];
  chart_type: "line" | "bar" | "gauge" | "table";
}

export interface CommunityResults {
  recent_implementations: Implementation[];
  success_rate: number;
  average_roi: number;
  common_issues: string[];
}

// Environment Detection Results
export interface EnvironmentProfile {
  // Application Layer
  application: {
    runtime_detected: string[];
    model_usage_patterns: ModelUsagePattern[];
    api_call_patterns: APICallPattern[];
    context_analysis: ContextAnalysis;
  };

  // Serving Layer
  serving: {
    frameworks_detected: string[];
    model_formats: string[];
    serving_configs: ServingConfig[];
    performance_metrics: PerformanceMetrics;
  };

  // Infrastructure Layer
  infrastructure: {
    gpu_inventory: GPUResource[];
    memory_analysis: MemoryAnalysis;
    network_topology: NetworkTopology;
    cost_breakdown: CostBreakdown;
  };
}

export interface ModelUsagePattern {
  model_name: string;
  usage_frequency: number;
  context_patterns: string[];
  cost_contribution: number;
}

export interface APICallPattern {
  endpoint: string;
  call_volume: number;
  cost_per_call: number;
  optimization_opportunities: string[];
}

export interface ContextAnalysis {
  average_length: number;
  distribution: number[];
  memory_impact: number;
  batching_opportunities: string[];
}

export interface ServingConfig {
  framework: string;
  model_path: string;
  configuration: Record<string, any>;
  performance_profile: PerformanceMetrics;
}

export interface PerformanceMetrics {
  throughput: number;
  latency_p95: number;
  gpu_utilization: number;
  memory_utilization: number;
  batch_efficiency: number;
}

export interface GPUResource {
  model: string;
  memory_gb: number;
  bandwidth_gbps: number;
  utilization: number;
  cost_per_hour: number;
}

export interface MemoryAnalysis {
  total_capacity: number;
  utilization: number;
  bandwidth_efficiency: number;
  bottlenecks: string[];
}

export interface NetworkTopology {
  bandwidth: number;
  latency: number;
  multi_gpu_setup: boolean;
  communication_overhead: number;
}

export interface CostBreakdown {
  compute_cost: number;
  storage_cost: number;
  network_cost: number;
  total_monthly: number;
  optimization_potential: number;
}

// Template Execution Results
export interface TemplateExecutionResult {
  template_id: string;
  execution_id: string;
  status: "success" | "failed" | "in_progress" | "rolled_back";
  start_time: Date;
  end_time?: Date;

  // Economic Impact
  baseline_metrics: Record<string, number>;
  optimized_metrics?: Record<string, number>;
  cost_savings?: number;
  roi_achieved?: number;
  economics?: any;

  // Execution Details
  steps_completed: string[];
  steps_failed: string[];
  rollback_reason?: string;

  // Quality Validation
  quality_preserved: boolean;
  quality_metrics: Record<string, number>;

  // Community Contribution
  implementation_report?: string;
  lessons_learned?: string[];
}
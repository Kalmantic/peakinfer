/**
 * Multi-Agent Type Definitions
 * Defines interfaces for the 4-agent orchestration system
 * Based on PRD v0.7 Section 3: Multi-Agent Claude Integration
 */

import { OptimizationTemplate, EnvironmentProfile } from './template.js';
import { InferenceEvent } from './events.js';
import { InfrastructureConfig } from './collectors.js';
import { CodebaseAnalysis } from './codebase.js';

/**
 * Discovery Agent Result
 * Output from the Discovery Agent after analyzing infrastructure
 */
export interface DiscoveryResult {
  /** Comprehensive configuration summary */
  configSummary: {
    application: ApplicationSummary;
    serving: ServingSummary;
    infrastructure: InfrastructureSummary;
  };
  
  /** Workload profiling analysis */
  workloadProfile: WorkloadProfile;
  
  /** Identified optimization opportunities across all layers */
  optimizationOpportunities: OptimizationOpportunity[];
  
  /** Codebase analysis insights (if codebase was scanned) */
  codebaseInsights?: CodebaseAnalysis;
  
  /** Discovery metadata */
  metadata: {
    timestamp: string;
    sources: string[];
    total_events_analyzed: number;
    time_range: {
      start: string;
      end: string;
    };
    codebase_scanned?: boolean;
    codebase_path?: string;
  };
}

/**
 * Profiling Agent Result
 * Output from workload profiler (peakinfer profile)
 */
export interface ProfileResult {
  metadata: {
    timestamp: string;
    events_analyzed: number;
    cluster_method: string;
    total_clusters: number;
    top_intents: string[];
  };
  workloadStats: ProfileWorkloadStats;
  clusters: WorkloadCluster[];
  samplePrompts: SamplePromptSummary[];
  recommendations: ProfileRecommendation[];
}

export interface ProfileWorkloadStats {
  total_events: number;
  total_cost: number;
  avg_latency_ms: number;
  p95_latency_ms?: number;
  avg_input_tokens: number;
  avg_output_tokens: number;
  peak_hours?: number[];
  top_providers?: string[];
  top_models?: string[];
}

export interface WorkloadCluster {
  cluster_id: string;
  size: number;
  intent: string;
  description: string;
  representative_prompt: string;
  representative_completion?: string;
  avg_input_tokens: number;
  avg_output_tokens: number;
  cost_per_request: number;
  monthly_cost: number;
  dominant_provider: string;
  dominant_model: string;
  latency_p95_ms?: number;
  recommended_action: string;
}

export interface SamplePromptSummary {
  id: string;
  cluster_id: string;
  provider: string;
  model: string;
  prompt: string;
  completion?: string;
  tokens: {
    input: number;
    output: number;
  };
  cost_usd: number;
  timestamp?: string;
}

export interface ProfileRecommendation {
  recommendation_id: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  estimated_savings: number;
  action_items: string[];
  related_clusters: string[];
  suggested_templates: string[];
}

export interface ApplicationSummary {
  runtimes: string[];
  model_usage: ModelUsageSummary[];
  api_patterns: APIPatternSummary[];
  cost_drivers: CostDriver[];
  total_monthly_cost: number;
}

export interface ServingSummary {
  frameworks: string[];
  model_formats: string[];
  performance_baseline: PerformanceBaseline;
  bottlenecks: string[];
  optimization_readiness: number; // 0-1 score
}

export interface InfrastructureSummary {
  total_resources: number;
  gpu_inventory: GPUSummary[];
  total_monthly_cost: number;
  utilization_metrics: UtilizationMetrics;
  optimization_potential: number;
}

export interface ModelUsageSummary {
  model: string;
  provider: string;
  request_count: number;
  total_cost: number;
  avg_latency: number;
  optimization_candidates: string[];
}

export interface APIPatternSummary {
  endpoint: string;
  call_volume: number;
  cost_contribution: number;
  cacheable_percentage: number;
  routing_opportunities: string[];
}

export interface CostDriver {
  category: 'model' | 'tokens' | 'latency' | 'infrastructure';
  description: string;
  monthly_cost: number;
  percentage_of_total: number;
  optimization_potential: number;
}

export interface PerformanceBaseline {
  throughput_rps: number;
  latency_p50: number;
  latency_p95: number;
  latency_p99: number;
  gpu_utilization: number;
  memory_utilization: number;
  batch_size_avg: number;
}

export interface GPUSummary {
  type: string;
  count: number;
  utilization: number;
  monthly_cost: number;
  optimization_opportunities: string[];
}

export interface UtilizationMetrics {
  cpu_avg: number;
  gpu_avg: number;
  memory_avg: number;
  network_avg: number;
  efficiency_score: number; // 0-1
}

export interface WorkloadProfile {
  request_patterns: RequestPattern[];
  traffic_distribution: TrafficDistribution;
  quality_requirements: QualityRequirement[];
  cost_sensitivity: number; // 0-1
  latency_tolerance: number; // milliseconds
}

export interface RequestPattern {
  pattern_id: string;
  description: string;
  frequency: number;
  avg_tokens: number;
  intent_category: string;
  optimization_suitability: string[];
}

export interface TrafficDistribution {
  by_hour: number[];
  by_day_of_week: number[];
  peak_hours: number[];
  off_peak_hours: number[];
  burst_patterns: boolean;
}

export interface QualityRequirement {
  metric: string;
  threshold: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export interface OptimizationOpportunity {
  layer: 'application' | 'serving' | 'infrastructure' | 'cross-layer';
  category: string;
  description: string;
  estimated_savings_monthly: number;
  estimated_savings_percentage: number;
  implementation_complexity: 'low' | 'medium' | 'high';
  risk_level: 'low' | 'medium' | 'high';
  applicable_templates: string[];
  priority_score: number; // 0-100
}

/**
 * Optimization Plan
 * Output from the Planner Agent with comprehensive optimization strategy
 */
export interface OptimizationPlan {
  /** Application layer optimizations */
  applicationLayer: LayerOptimization[];
  
  /** Serving layer optimizations */
  servingLayer: LayerOptimization[];
  
  /** Infrastructure layer optimizations */
  infrastructureLayer: LayerOptimization[];
  
  /** Cross-layer coordination strategies */
  crossLayerStrategies: CrossLayerStrategy[];
  
  /** Total estimated savings */
  estimatedSavings: number;
  
  /** Implementation complexity assessment */
  implementationComplexity: 'simple' | 'moderate' | 'complex' | 'very_complex';
  
  /** Implementation sequence */
  implementationSequence: ImplementationPhase[];
  
  /** Risk assessment */
  riskAssessment: RiskAssessment;
  
  /** Economic projections */
  economicProjections: EconomicProjection;
  
  /** Plan metadata */
  metadata: {
    created_at: string;
    discovery_id: string;
    templates_used: string[];
    confidence_score: number;
  };
}

export interface LayerOptimization {
  optimization_id: string;
  template_id: string;
  template_name: string;
  description: string;
  technique: string;
  expected_savings: number;
  expected_savings_percentage: number;
  implementation_cost: number;
  implementation_time_days: number;
  risk_level: 'low' | 'medium' | 'high';
  dependencies: string[];
  prerequisites: string[];
  rollback_plan: string;
  monitoring_metrics: string[];
}

export interface CrossLayerStrategy {
  strategy_id: string;
  name: string;
  description: string;
  layers_involved: ('application' | 'serving' | 'infrastructure')[];
  optimizations: string[]; // References to optimization_ids
  synergy_benefit: number;
  coordination_complexity: 'low' | 'medium' | 'high';
  implementation_order: string[];
}

export interface ImplementationPhase {
  phase_number: number;
  name: string;
  optimizations: string[]; // optimization_ids
  estimated_duration_days: number;
  prerequisites_completed: boolean;
  parallel_execution_possible: boolean;
  success_criteria: string[];
}

export interface RiskAssessment {
  overall_risk: 'low' | 'medium' | 'high';
  risks: Risk[];
  mitigation_strategies: MitigationStrategy[];
  rollback_procedures: RollbackProcedure[];
}

export interface Risk {
  risk_id: string;
  category: string;
  description: string;
  probability: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  affected_optimizations: string[];
}

export interface MitigationStrategy {
  risk_id: string;
  strategy: string;
  effectiveness: number; // 0-1
}

export interface RollbackProcedure {
  optimization_id: string;
  procedure: string;
  estimated_time_minutes: number;
  data_loss_risk: boolean;
}

export interface EconomicProjection {
  baseline_monthly_cost: number;
  optimized_monthly_cost: number;
  monthly_savings: number;
  annual_savings: number;
  implementation_cost: number;
  payback_period_months: number;
  roi_percentage: number;
  confidence_interval: {
    lower_bound: number;
    upper_bound: number;
    confidence_level: number;
  };
}

/**
 * Evaluation Result
 * Output from the Runner/Evaluator Agent after executing optimizations
 */
export interface EvaluationResult {
  /** Evaluation ID */
  evaluation_id: string;
  
  /** Plan that was evaluated */
  plan_id: string;
  
  /** Baseline measurements */
  baseline: PerformanceMeasurement;
  
  /** Optimized measurements */
  optimized: PerformanceMeasurement;
  
  /** Individual optimization results */
  optimizationResults: OptimizationResult[];
  
  /** Quality evaluation */
  qualityEvaluation: QualityEvaluation;
  
  /** Statistical significance */
  statisticalSignificance: StatisticalAnalysis;
  
  /** Recommendations */
  recommendations: Recommendation[];
  
  /** Evaluation metadata */
  metadata: {
    timestamp: string;
    sample_size: number;
    evaluation_duration_seconds: number;
    early_stopping_triggered: boolean;
  };
}

export interface PerformanceMeasurement {
  cost_per_request: number;
  latency_p50: number;
  latency_p95: number;
  latency_p99: number;
  throughput_rps: number;
  error_rate: number;
  quality_score: number;
  total_cost: number;
  sample_count: number;
}

export interface OptimizationResult {
  optimization_id: string;
  status: 'success' | 'failed' | 'partial' | 'skipped';
  actual_savings: number;
  expected_savings: number;
  variance_percentage: number;
  quality_preserved: boolean;
  quality_delta: number;
  execution_time_seconds: number;
  error_messages: string[];
  warnings: string[];
}

export interface QualityEvaluation {
  overall_quality_preserved: boolean;
  quality_metrics: QualityMetric[];
  llm_judge_scores: LLMJudgeScore[];
  rule_based_scores: RuleBasedScore[];
  human_eval_recommended: boolean;
}

export interface QualityMetric {
  metric_name: string;
  baseline_value: number;
  optimized_value: number;
  delta: number;
  threshold: number;
  passed: boolean;
}

export interface LLMJudgeScore {
  judge_model: string;
  prompt_pair_id: string;
  baseline_response: string;
  optimized_response: string;
  score: number; // 0-1
  reasoning: string;
}

export interface RuleBasedScore {
  rule_name: string;
  passed: boolean;
  details: string;
}

export interface StatisticalAnalysis {
  sample_size: number;
  statistical_power: number;
  confidence_level: number;
  p_value: number;
  effect_size: number;
  significant: boolean;
}

export interface Recommendation {
  recommendation_id: string;
  type: 'proceed' | 'caution' | 'rollback' | 'investigate';
  description: string;
  rationale: string;
  priority: 'high' | 'medium' | 'low';
  action_items: string[];
}

/**
 * Audit Report
 * Final output from the Auditor Agent
 */
export interface AuditReport {
  /** Report ID */
  report_id: string;
  
  /** Executive summary */
  executiveSummary: ExecutiveSummary;
  
  /** Detailed results */
  detailedResults: DetailedResults;
  
  /** Implementation artifacts */
  implementationArtifacts: ImplementationArtifacts;
  
  /** Monitoring recommendations */
  monitoringRecommendations: MonitoringRecommendation[];
  
  /** Community contribution */
  communityContribution: CommunityContribution;
  
  /** Report metadata */
  metadata: {
    generated_at: string;
    evaluation_id: string;
    plan_id: string;
    discovery_id: string;
  };
}

export interface ExecutiveSummary {
  total_cost_savings: number;
  cost_reduction_percentage: number;
  payback_period_months: number;
  roi_percentage: number;
  quality_preserved: boolean;
  optimizations_applied: number;
  optimizations_successful: number;
  key_achievements: string[];
  risks_mitigated: string[];
  next_steps: string[];
}

export interface DetailedResults {
  by_layer: {
    application: LayerResults;
    serving: LayerResults;
    infrastructure: LayerResults;
  };
  cross_layer_benefits: CrossLayerBenefits;
  performance_improvements: PerformanceImprovements;
  cost_breakdown: CostBreakdown;
}

export interface LayerResults {
  optimizations_applied: number;
  cost_savings: number;
  savings_percentage: number;
  quality_impact: number;
  key_improvements: string[];
}

export interface CrossLayerBenefits {
  synergy_savings: number;
  coordination_effectiveness: number;
  compound_benefits: string[];
}

export interface PerformanceImprovements {
  latency_improvement_percentage: number;
  throughput_improvement_percentage: number;
  utilization_improvement_percentage: number;
  efficiency_gains: string[];
}

export interface CostBreakdown {
  baseline_monthly: number;
  optimized_monthly: number;
  savings_by_category: Record<string, number>;
  savings_by_optimization: Record<string, number>;
}

export interface ImplementationArtifacts {
  router_configs: RouterConfig[];
  cache_configs: CacheConfig[];
  terraform_diffs: TerraformDiff[];
  serving_configs: ServingConfig[];
  deployment_scripts: DeploymentScript[];
}

export interface RouterConfig {
  config_file: string;
  content: string;
  description: string;
}

export interface CacheConfig {
  config_file: string;
  content: string;
  cache_strategy: string;
  ttl_seconds: number;
}

export interface TerraformDiff {
  resource: string;
  changes: string;
  estimated_savings: number;
}

export interface ServingConfig {
  framework: string;
  config_file: string;
  changes: Record<string, any>;
  expected_improvement: string;
}

export interface DeploymentScript {
  script_name: string;
  content: string;
  purpose: string;
  execution_order: number;
}

export interface MonitoringRecommendation {
  metric: string;
  collection_method: string;
  alert_threshold: string;
  dashboard_config: string;
  rollback_trigger: string;
}

export interface CommunityContribution {
  templates_used: string[];
  implementation_reports: ImplementationReport[];
  lessons_learned: string[];
  suggested_template_improvements: string[];
}

export interface ImplementationReport {
  template_id: string;
  success: boolean;
  actual_savings: number;
  implementation_time_days: number;
  challenges_faced: string[];
  recommendations: string[];
}


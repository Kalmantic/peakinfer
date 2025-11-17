# Claude Discovery Agent - Usage Examples

## Example 1: Basic Discovery from events.jsonl

```typescript
import { ClaudeDiscoveryAgent } from './orchestration/agents/claude-discovery-agent';

async function discoverInfrastructure() {
  const agent = new ClaudeDiscoveryAgent();

  // Automatically discovers:
  // - events.jsonl in current directory
  // - Infrastructure configs (Terraform, K8s, Docker)
  // - Runtime files (requirements.txt, package.json)
  // - Collectors (Snowflake, Databricks)
  const environment = await agent.discover();

  // View cost analysis
  console.log('Monthly Cost:', `$${environment.infrastructure.cost_breakdown.total_monthly}`);
  console.log('Optimization Potential:',
    `$${environment.infrastructure.cost_breakdown.optimization_potential}/month`);

  // View model usage patterns
  environment.application.model_usage_patterns.forEach(pattern => {
    console.log(`Model: ${pattern.model_name}`);
    console.log(`  Usage: ${pattern.usage_frequency} calls`);
    console.log(`  Cost Contribution: ${(pattern.cost_contribution * 100).toFixed(1)}%`);
  });
}
```

## Example 2: E-commerce Platform Analysis

**Setup: E-commerce platform with product recommendations using OpenAI + Anthropic**

```typescript
// events.jsonl content (1700 events)
// - 500 product recommendation calls (GPT-4o) @ $0.015/call
// - 200 customer support calls (Claude-3) @ $0.008/call
// - 1000 search optimization calls (GPT-3.5) @ $0.001/call

async function analyzeEcommercePlatform() {
  const agent = new ClaudeDiscoveryAgent();
  const environment = await agent.discover();

  // Cost Breakdown Analysis
  const costs = environment.infrastructure.cost_breakdown;
  console.log('=== COST ANALYSIS ===');
  console.log(`Total Monthly: $${costs.total_monthly}`);
  console.log(`Compute (90%): $${costs.compute_cost}`);
  console.log(`Storage (7%): $${costs.storage_cost}`);
  console.log(`Network (3%): $${costs.network_cost}`);

  // Optimization Opportunities
  console.log('\n=== OPTIMIZATION OPPORTUNITIES ===');
  console.log(`Potential Savings: $${costs.optimization_potential}/month`);
  console.log(`ROI Potential: ${((costs.optimization_potential / costs.total_monthly) * 100).toFixed(1)}%`);

  // Model Usage Breakdown
  console.log('\n=== MODEL USAGE BREAKDOWN ===');
  environment.application.model_usage_patterns.forEach(pattern => {
    console.log(`\n${pattern.model_name}:`);
    console.log(`  Frequency: ${pattern.usage_frequency} calls`);
    console.log(`  Cost Impact: ${(pattern.cost_contribution * 100).toFixed(1)}%`);
    console.log(`  Context Patterns: ${pattern.context_patterns.join(', ')}`);
  });

  // Performance Metrics
  console.log('\n=== PERFORMANCE METRICS ===');
  const perf = environment.serving.performance_metrics;
  console.log(`Throughput: ${perf.throughput / 10} req/sec`);
  console.log(`P95 Latency: ${perf.latency_p95}ms`);
  console.log(`GPU Utilization: ${perf.gpu_utilization}%`);

  // API Pattern Analysis
  console.log('\n=== API ENDPOINT ANALYSIS ===');
  environment.application.api_call_patterns.forEach(pattern => {
    console.log(`\n${pattern.endpoint}:`);
    console.log(`  Call Volume: ${pattern.call_volume}`);
    console.log(`  Cost per Call: $${pattern.cost_per_call.toFixed(4)}`);
    console.log(`  Optimization Opportunities:`);
    pattern.optimization_opportunities.forEach(opp => {
      console.log(`    - ${opp}`);
    });
  });
}
```

**Output:**
```
=== COST ANALYSIS ===
Total Monthly: $2,150
Compute (90%): $1,935
Storage (7%): $150.50
Network (3%): $64.50

=== OPTIMIZATION OPPORTUNITIES ===
Potential Savings: $1,290/month
ROI Potential: 60.0%

=== MODEL USAGE BREAKDOWN ===

gpt-4o:
  Frequency: 500 calls
  Cost Impact: 70.0%
  Context Patterns: conversational, document_analysis

claude-3-sonnet:
  Frequency: 200 calls
  Cost Impact: 15.0%
  Context Patterns: support_qa, reasoning

gpt-3.5-turbo:
  Frequency: 1000 calls
  Cost Impact: 15.0%
  Context Patterns: search, categorization

=== PERFORMANCE METRICS ===
Throughput: 25 req/sec
P95 Latency: 245ms
GPU Utilization: 35%

=== API ENDPOINT ANALYSIS ===

api.openai.com:
  Call Volume: 1500
  Cost per Call: $0.0088
  Optimization Opportunities:
    - model_routing
    - semantic_caching
    - request_batching

api.anthropic.com:
  Call Volume: 200
  Cost per Call: $0.0080
  Optimization Opportunities:
    - model_routing
    - semantic_caching
    - request_batching
```

## Example 3: Data Pipeline with Databricks + Snowflake

```typescript
// Directory structure:
// project/
// ├── events.jsonl (1000 data enrichment events)
// ├── snowflake.config.json
// ├── databricks.config.json
// └── terraform/
//     └── mlflow-jobs.tf

async function analyzeDataPipeline() {
  const agent = new ClaudeDiscoveryAgent();
  const environment = await agent.discover();

  // Collector Detection
  console.log('=== DETECTED COLLECTORS ===');
  if (environment.application.runtime_detected.includes('databricks')) {
    console.log('✓ Databricks API detected');
  }
  if (environment.application.runtime_detected.includes('snowflake')) {
    console.log('✓ Snowflake SQL detected');
  }
  if (environment.infrastructure.gpu_inventory.length > 0) {
    console.log('✓ GPU infrastructure detected');
  }

  // Cost Analysis for Data Operations
  console.log('\n=== DATA PIPELINE COST ANALYSIS ===');
  const costs = environment.infrastructure.cost_breakdown;
  const monthlyPercentage = (costs.total_monthly / 100);
  console.log(`Total Monthly Cost: $${costs.total_monthly}`);
  console.log(`Cost per Day: $${(costs.total_monthly / 30).toFixed(2)}`);

  // Context Analysis for Large Documents
  console.log('\n=== CONTEXT LENGTH ANALYSIS ===');
  const context = environment.application.context_analysis;
  console.log(`Average Context: ${context.average_length} tokens`);
  console.log(`Distribution (tokens):`);
  console.log(`  P10: ${context.distribution[0]}`);
  console.log(`  P25: ${context.distribution[1]}`);
  console.log(`  P50: ${context.distribution[2]}`);
  console.log(`  P75: ${context.distribution[3]}`);
  console.log(`  P90: ${context.distribution[4]}`);

  // Cross-layer Opportunities for Data + Serving + Infra
  console.log('\n=== CROSS-LAYER OPTIMIZATION ===');
  console.log('Application Layer:');
  console.log('  - Batch enrichment requests (reduce API calls)');
  console.log('  - Cache enriched data in Snowflake');
  console.log('');
  console.log('Serving Layer:');
  console.log('  - Deploy vLLM for faster inference');
  console.log('  - Continuous batching for Databricks jobs');
  console.log('');
  console.log('Infrastructure Layer:');
  console.log('  - Use spot instances for batch jobs');
  console.log('  - Auto-scale based on pipeline load');
}
```

## Example 4: Kubernetes-based Serving Cluster

```typescript
// Directory structure:
// project/
// ├── events.jsonl (2000 Together API calls)
// ├── k8s/
// │   ├── deployment.yaml (vLLM pod)
// │   └── service.yaml (LoadBalancer)
// └── terraform/
//     └── eks.tf (AWS EKS cluster config)

async function analyzeServingCluster() {
  const agent = new ClaudeDiscoveryAgent();
  const environment = await agent.discover();

  console.log('=== KUBERNETES SERVING ANALYSIS ===\n');

  // Performance Metrics
  const perf = environment.serving.performance_metrics;
  console.log('Performance:');
  console.log(`  Throughput: ${perf.throughput / 10} requests/sec`);
  console.log(`  P95 Latency: ${perf.latency_p95}ms`);
  console.log(`  GPU Utilization: ${perf.gpu_utilization}%`);
  console.log(`  Memory Utilization: ${perf.memory_utilization}%`);
  console.log(`  Batch Efficiency: ${perf.batch_efficiency}x`);

  // GPU Inventory
  console.log('\nGPU Inventory:');
  environment.infrastructure.gpu_inventory.forEach(gpu => {
    console.log(`  ${gpu.model}:`);
    console.log(`    Memory: ${gpu.memory_gb}GB`);
    console.log(`    Bandwidth: ${gpu.bandwidth_gbps} Gbps`);
    console.log(`    Utilization: ${gpu.utilization}%`);
    console.log(`    Cost: $${gpu.cost_per_hour}/hour`);
  });

  // Cost Analysis
  const costs = environment.infrastructure.cost_breakdown;
  console.log('\nMonthly Cost Breakdown:');
  console.log(`  Compute: $${costs.compute_cost.toFixed(2)} (90%)`);
  console.log(`  Storage: $${costs.storage_cost.toFixed(2)} (7%)`);
  console.log(`  Network: $${costs.network_cost.toFixed(2)} (3%)`);
  console.log(`  Total: $${costs.total_monthly.toFixed(2)}`);

  // Optimization Recommendations
  console.log('\nOptimization Opportunities:');
  console.log(`  Total Potential Savings: $${costs.optimization_potential.toFixed(2)}/month`);

  if (perf.gpu_utilization < 50) {
    console.log(`\n⚠️  GPU Utilization is low (${perf.gpu_utilization}%)`);
    console.log('  Recommendations:');
    console.log('  - Increase batch size');
    console.log('  - Enable continuous batching in vLLM');
    console.log('  - Implement KV cache optimization');
    console.log('  - Estimated savings: 15-20%');
  }

  if (perf.latency_p95 > 200) {
    console.log(`\n⚠️  P95 Latency is high (${perf.latency_p95}ms)`);
    console.log('  Recommendations:');
    console.log('  - Profile code hotspots');
    console.log('  - Consider GPU upgrade or horizontal scaling');
    console.log('  - Estimated improvement: 30-40%');
  }
}
```

## Example 5: Multi-tenant SaaS with Quality Metrics

```typescript
// events.jsonl contains:
// - High-quality medical requests (quality_score: 0.95)
// - Medium-quality QA requests (quality_score: 0.85)
// - Low-quality categorization (quality_score: 0.70)

async function analyzeMultitenantPlatform() {
  const agent = new ClaudeDiscoveryAgent();
  const environment = await agent.discover();

  console.log('=== MULTI-TENANT SAAS ANALYSIS ===\n');

  // Cost per Tenant Analysis
  console.log('Cost by Use Case:');
  environment.application.model_usage_patterns.forEach(pattern => {
    console.log(`\n${pattern.model_name}:`);
    console.log(`  Usage: ${pattern.usage_frequency} calls`);
    console.log(`  Cost Impact: ${(pattern.cost_contribution * 100).toFixed(1)}%`);
    console.log(`  Context Patterns: ${pattern.context_patterns.join(', ')}`);
  });

  // Quality-Aware Optimization
  console.log('\n=== QUALITY-AWARE OPTIMIZATION ===');
  console.log('Different optimization strategies for different quality tiers:');
  console.log('\nHigh-Quality Tier (0.95+ quality_score):');
  console.log('  - Use GPT-4 or Claude-3 Opus');
  console.log('  - Minimal caching to ensure quality');
  console.log('  - Estimated cost: $50-100/month per tenant');
  console.log('\nMedium-Quality Tier (0.80-0.94 quality_score):');
  console.log('  - Use GPT-3.5 or Claude-3 Sonnet');
  console.log('  - Aggressive semantic caching');
  console.log('  - Model routing with fallbacks');
  console.log('  - Estimated cost: $10-20/month per tenant');
  console.log('\nLow-Quality Tier (0.70-0.79 quality_score):');
  console.log('  - Use Claude-3 Haiku or GPT-3.5');
  console.log('  - Maximum batching and caching');
  console.log('  - Fine-tuned models if available');
  console.log('  - Estimated cost: $1-5/month per tenant');

  // ROI Analysis
  const costs = environment.infrastructure.cost_breakdown;
  console.log('\n=== ROI ANALYSIS ===');
  console.log(`Total Monthly Cost: $${costs.total_monthly}`);
  console.log(`Optimization Potential: $${costs.optimization_potential}`);

  const savingsPercentage = (costs.optimization_potential / costs.total_monthly) * 100;
  console.log(`Potential Savings: ${savingsPercentage.toFixed(1)}%`);

  if (savingsPercentage > 50) {
    console.log('✓ High optimization potential - 50%+ savings possible');
    console.log('  Priority actions:');
    console.log('  1. Implement semantic caching (15-20% savings)');
    console.log('  2. Deploy model routing (20-30% savings)');
    console.log('  3. Optimize serving infrastructure (10-15% savings)');
  }
}
```

## Example 6: Integration with Multi-Agent Orchestrator

```typescript
import { MultiAgentOrchestrator } from './orchestration/multi-agent-orchestrator';
import { ClaudeDiscoveryAgent } from './orchestration/agents/claude-discovery-agent';

async function orchestrateFullOptimization() {
  console.log('🚀 Starting Peakinfer Multi-Agent Orchestration\n');

  const orchestrator = new MultiAgentOrchestrator();
  const discoveryAgent = new ClaudeDiscoveryAgent();

  // Step 1: Discovery
  console.log('Step 1: 🔍 Running Discovery Agent...');
  const discoveryResult = await discoveryAgent.discover();
  console.log(`✓ Discovered infrastructure with $${discoveryResult.infrastructure.cost_breakdown.total_monthly}/month cost\n`);

  // Step 2: Workload Profiling
  console.log('Step 2: 📊 Running Workload Profiler...');
  const workloadProfile = await orchestrator.runWorkloadProfiler(discoveryResult);
  console.log(`✓ Identified ${workloadProfile.representative_samples?.length || 10} representative samples\n`);

  // Step 3: Planning
  console.log('Step 3: 📋 Running Planner Agent...');
  const optimizationPlan = await orchestrator.runPlannerAgent(discoveryResult, workloadProfile);
  console.log(`✓ Generated optimization plan with $${optimizationPlan.estimatedSavings}/month savings\n`);

  // Step 4: Execution
  console.log('Step 4: ⚙️  Running Runner/Evaluator...');
  const evaluation = await orchestrator.runRunnerEvaluator(optimizationPlan, workloadProfile.representative_samples);
  console.log(`✓ Completed optimization execution and evaluation\n`);

  // Step 5: Audit & Reporting
  console.log('Step 5: 📈 Running Auditor Agent...');
  const auditReport = await orchestrator.runAuditorAgent(evaluation);
  console.log(`✓ Generated audit report`);
  console.log(`  - Total Savings: $${auditReport.total_cost_savings_annual}/year`);
  console.log(`  - ROI: ${auditReport.roi_annual.toFixed(1)}%`);
  console.log(`  - Payback Period: ${auditReport.payback_period_months.toFixed(1)} months\n`);

  console.log('✅ Orchestration Complete!');
  console.log(`Results saved to:`);
  console.log(`  - discovered.yaml (infrastructure profile)`);
  console.log(`  - optimization-plan.yaml (proposed changes)`);
  console.log(`  - evaluation-report.yaml (detailed results)`);
  console.log(`  - peakinfer-patches/ (implementation patches)`);
}
```

## Example 7: CLI Command Integration

```bash
# Run discovery with all available collectors
$ peakinfer discover --collectors snowflake,databricks,terraform

  🔍 Analyzing your infrastructure with Claude...

  💭 Claude: Collecting inference events and infrastructure data...
  💭 Claude: Running multi-layer optimization analysis with Claude...

  ✓ Runtimes: nodejs, openai, anthropic
  ✓ Frameworks: langchain, vllm
  ✓ GPUs: 4
  ✓ Monthly Cost: $2,150
  ✓ Optimization Potential: $1,290/month

  🎯 Cross-Layer Optimization Opportunities:
     1. Semantic caching + continuous batching = 25% savings
     2. Model routing + spot instances = 35% savings
     3. Combined multi-layer optimization = 60% savings

  ============================================================
    🤖 Claude Analysis: Multi-Layer Infrastructure Discovery
  ============================================================

  🔴 Problems Identified:

    1. No serving frameworks detected - missing 2-3x inference speedup potential
    2. Low GPU utilization (35%) - inefficient resource usage

  🔍 Key Findings:

    1. OpenAI GPT-4o is primary cost driver (70% of spend)
    2. High context length requests (avg 2048 tokens)
    3. Opportunity for semantic caching with 15% cost reduction

  ✅ Suggested Solutions:

    1. Implement Serving Framework
       Deploy vLLM or SGLang for 2-3x inference speedup and better batching
       💰 Potential Savings: $1,500/month
       🔧 Effort: 3-5 days

    2. Optimize GPU Utilization
       Implement continuous batching and KV cache optimization to increase GPU efficiency
       💰 Potential Savings: $800/month
       🔧 Effort: 2-3 days

    3. Implement Multi-Layer Optimization
       Apply semantic caching, model routing, and serving optimizations for 20-40% cost reduction
       💰 Potential Savings: $645/month
       🔧 Effort: 1-2 weeks

  ============================================================

  Discovery complete. Results saved to discovered.yaml
  Next steps:
  1. peakinfer profile --events events.jsonl
  2. peakinfer plan --constraints policy.yaml
  3. peakinfer run --plan optimization-plan.yaml
```

---

These examples demonstrate the Claude Discovery Agent's capabilities for analyzing real-world inference cost optimization scenarios across different platform types and use cases.

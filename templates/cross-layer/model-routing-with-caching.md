# Cross-Layer: Model Routing + Semantic Caching

---
id: cross-layer-routing-caching
name: Intelligent Model Routing with Semantic Caching
description: Combine smart model routing with semantic caching for compound 60-75% savings
category: cross_layer
confidence: 0.90
success_count: 29
verified_environments: 18
contributors:
  - peakinfer-community
last_updated: "2024-12-01"

environment_match:
  runtime:
    - openai
    - anthropic
    - together
  model_usage: "multiple_models"
  request_volume: ">5000/day"
  workload_type: "mixed_complexity"

optimization:
  technique: cross_layer_coordination
  layers:
    - application
    - serving
  expected_cost_reduction: "60-75%"
  expected_latency_improvement: "40-60%"
  effort_estimate: "5-8 engineering days"
  risk_level: medium

economics:
  baseline_calculation:
    monthly_requests: "total_api_calls"
    gpt4_percentage: "0.30"
    gpt4_cost_per_request: "0.10"
    gpt35_percentage: "0.70"
    gpt35_cost_per_request: "0.02"
    monthly_cost: "(monthly_requests * gpt4_percentage * gpt4_cost_per_request) + (monthly_requests * gpt35_percentage * gpt35_cost_per_request)"
  
  projected_savings:
    # Layer 1: Smart routing (route simple queries to cheaper models)
    routing_savings_rate: "0.40"
    routing_savings: "monthly_cost * gpt4_percentage * routing_savings_rate"
    
    # Layer 2: Semantic caching (cache repeated patterns)
    cache_hit_rate: "0.45"
    cache_savings: "(monthly_cost - routing_savings) * cache_hit_rate * 0.98"
    
    # Total compound savings
    total_savings: "routing_savings + cache_savings"
    savings_percentage: "(total_savings / monthly_cost) * 100"
  
  implementation_cost:
    engineering_hours: 48
    hourly_rate: 200
    cache_infrastructure: 500
    total_cost: 10100
  
  roi_calculation:
    payback_months: "implementation_cost / total_savings"
    annual_roi: "(total_savings * 12 - implementation_cost) / implementation_cost"

implementation:
  prerequisites:
    - requirement: "Redis for caching"
      validation_command: "redis-cli ping"
      optional: false
    - requirement: "Vector embedding model"
      validation_command: "python -c 'import sentence_transformers'"
      optional: false
    - requirement: "LLM judge for quality validation"
      validation_command: "# Manual verification required"
      optional: true
  
  automated_steps:
    - step_id: "implement_routing"
      name: "Implement intelligent model router"
      executable: false
      commands:
        - "# Classify queries by complexity"
        - "# Route simple queries to GPT-3.5-turbo"
        - "# Route complex queries to GPT-4"
      dependencies: []
      validation:
        command: "python -m pytest tests/test_router.py"
        success_criteria: "All tests passed"
        rollback_command: "git checkout -- router.py"
    
    - step_id: "implement_caching"
      name: "Implement semantic caching layer"
      executable: false
      commands:
        - "# Add semantic cache before routing"
        - "# Cache responses with embeddings"
        - "# Set appropriate TTLs by query type"
      dependencies: ["implement_routing"]
      validation:
        command: "python -m pytest tests/test_cache.py"
        success_criteria: "All tests passed"
        rollback_command: "git checkout -- cache.py"
    
    - step_id: "integrate_layers"
      name: "Integrate routing + caching pipeline"
      executable: false
      commands:
        - "# Request flow: Cache check → Router → LLM → Cache update"
        - "# Monitor quality at each layer"
        - "# Log decisions for optimization"
      dependencies: ["implement_routing", "implement_caching"]
      validation:
        command: "python -m pytest tests/test_integration.py"
        success_criteria: "All tests passed"
        rollback_command: "git checkout -- pipeline.py"

monitoring:
  key_metrics:
    - metric: "cache_hit_rate"
      target: ">40%"
      alert_threshold: "<30%"
    - metric: "routing_accuracy"
      target: ">90%"
      alert_threshold: "<85%"
    - metric: "quality_score"
      target: ">0.95 baseline"
      alert_threshold: "<0.90 baseline"
    - metric: "cost_per_request"
      target: "<40% baseline"
      alert_threshold: ">50% baseline"
    - metric: "latency_p95"
      target: "<60% baseline"
      alert_threshold: ">80% baseline"
  
  rollback_triggers:
    - condition: "quality_score < 0.85 baseline for 1 hour"
      action: "automatic_rollback"
      delay_minutes: 30
    - condition: "routing_accuracy < 80%"
      action: "alert_and_investigation"

cross_layer_coordination:
  layer_1_application:
    - "Semantic cache check (50ms)"
    - "If cache miss, route to appropriate model"
    - "Cache response with TTL"
  
  layer_2_serving:
    - "Receive routed requests"
    - "Batch similar complexity queries"
    - "Return responses"
  
  synergies:
    - "Cache reduces load on routing classifier"
    - "Routing improves cache hit rate (similar complexity queries)"
    - "Compound cost savings: 30% (routing) + 35% (caching) = 65% total"

results:
  implementations:
    - organization: "Customer Support Platform"
      baseline_cost: 24000
      optimized_cost: 6000
      savings_percentage: 75
      implementation_time_days: 7
      cache_hit_rate: 48
      routing_accuracy: 92
    - organization: "Content Generation Service"
      baseline_cost: 18000
      optimized_cost: 7200
      savings_percentage: 60
      implementation_time_days: 6
      cache_hit_rate: 42
      routing_accuracy: 89
---

## Overview

This cross-layer optimization combines intelligent model routing (application layer) with semantic caching (application layer) to achieve compound savings of 60-75%. The two techniques synergize: caching reduces the load on the router, and routing creates more coherent cache clusters.

## Architecture

```
┌─────────────────┐
│ User Request    │
└────────┬────────┘
         │
    ┌────▼─────────────┐
    │ Semantic Cache   │
    │ Check            │
    └────┬─────────────┘
         │
    Cache Hit? ──Yes──> Return Cached
         │ No
    ┌────▼─────────────┐
    │ Complexity       │
    │ Classifier       │
    └────┬─────────────┘
         │
    ┌────▼─────┐
    │ Simple?   │
    └─┬─────┬───┘
   Yes│     │No
┌─────▼──┐ ┌▼──────┐
│GPT-3.5 │ │ GPT-4 │
│$0.002  │ │ $0.03 │
└─────┬──┘ └┬──────┘
      │     │
    ┌─▼─────▼───┐
    │ Cache     │
    │ Update    │
    └───────────┘
```

## Layer 1: Intelligent Routing

### Classification Logic
```python
from transformers import pipeline

classifier = pipeline("text-classification", model="complexity-classifier")

def route_request(prompt):
    # Classify complexity
    result = classifier(prompt)[0]
    
    if result['label'] == 'simple' and result['score'] > 0.85:
        return "gpt-3.5-turbo"  # $0.002/request
    else:
        return "gpt-4o-mini"     # $0.015/request (conservative)
```

### Routing Criteria
- **Simple → GPT-3.5-turbo**: Factual queries, simple transformations, formatting
- **Complex → GPT-4**: Reasoning, analysis, creative writing, ambiguous queries

## Layer 2: Semantic Caching

### Cache Integration
```python
class CachedRouter:
    def __init__(self):
        self.cache = SemanticCache(similarity_threshold=0.85)
        self.router = ModelRouter()
    
    def generate(self, prompt):
        # Check cache first
        cached_response = self.cache.get(prompt)
        if cached_response:
            return {
                'response': cached_response,
                'source': 'cache',
                'cost': 0.0001  # Cache operation cost
            }
        
        # Route to appropriate model
        model = self.router.route(prompt)
        response = self.llm_call(model, prompt)
        
        # Cache the response
        self.cache.set(prompt, response)
        
        return {
            'response': response,
            'source': model,
            'cost': self.get_model_cost(model)
        }
```

## Cross-Layer Synergies

### 1. Cache + Routing Synergy
- **Before**: Random cache clusters across all model types
- **After**: Coherent cache clusters per complexity level
- **Benefit**: +10-15% cache hit rate improvement

### 2. Routing + Cache Synergy
- **Before**: Router evaluates every request
- **After**: Cache reduces routing overhead by 40-50%
- **Benefit**: Lower latency, reduced classifier costs

### 3. Compound Savings
```
Baseline: $20,000/month
After Routing: $14,000/month (30% savings)
After Caching: $6,000/month (additional 57% savings on remaining)
Total Savings: $14,000/month (70% total)
```

## Economics

### Cost Breakdown
| Layer | Optimization | Monthly Savings | Cumulative |
|-------|-------------|-----------------|------------|
| Baseline | None | $0 | $20,000 |
| Layer 1 | Routing | $6,000 (30%) | $14,000 |
| Layer 2 | Caching | $8,000 (57% of remaining) | $6,000 |
| **Total** | **Both** | **$14,000 (70%)** | **$6,000** |

### Implementation Timeline
- **Week 1**: Implement and test router (2-3 days)
- **Week 2**: Implement semantic cache (2-3 days)
- **Week 3**: Integration and quality validation (2-3 days)
- **Total**: 6-8 engineering days

## Quality Validation

### Multi-Layer Quality Checks
1. **Router Quality**: Measure misclassification rate
2. **Cache Quality**: Compare cached vs fresh responses
3. **End-to-End Quality**: LLM judge on random samples

### Quality Metrics
```python
def validate_quality(baseline_responses, optimized_responses):
    scores = []
    for baseline, optimized in zip(baseline_responses, optimized_responses):
        # Use GPT-4 as judge
        score = llm_judge.compare(baseline, optimized)
        scores.append(score)
    
    avg_quality = np.mean(scores)
    return avg_quality > 0.95  # Must maintain 95%+ quality
```

## Monitoring Dashboard

```yaml
Key Metrics:
  - cache_hit_rate: 45%
  - routing_to_cheap_model: 65%
  - overall_cost_reduction: 68%
  - quality_score: 0.96
  - latency_p95: 450ms (vs 800ms baseline)

Alerts:
  - quality < 0.90: Automatic rollback
  - cache_hit_rate < 30%: Investigation needed
  - routing_accuracy < 85%: Retrain classifier
```

## Best Practices

1. **Start with Routing**: Implement routing first, validate quality
2. **Add Caching**: Layer in caching once routing is stable
3. **Monitor Continuously**: Track quality metrics at each layer
4. **Tune Thresholds**: Adjust similarity threshold and routing confidence
5. **A/B Testing**: Gradual rollout with control group

## Common Pitfalls

1. **Over-aggressive Routing**: Don't route complex queries to simple models
2. **Cache Staleness**: Set appropriate TTLs for different query types
3. **Quality Drift**: Continuously monitor and retrain router
4. **Ignoring Latency**: Ensure cache + routing doesn't add >100ms


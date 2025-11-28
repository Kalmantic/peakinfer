# Semantic Caching Optimization Template

---
id: semantic-caching-optimization
name: Semantic Caching for LLM Requests
description: Implement semantic caching to reduce redundant LLM calls by caching similar requests
category: application_layer
confidence: 0.92
success_count: 47
verified_environments: 28
contributors:
  - peakinfer-community
  - mlops-team
last_updated: "2024-12-01"

environment_match:
  runtime:
    - openai
    - anthropic
    - together
  request_volume: ">1000/day"
  cache_hit_potential: ">30%"

optimization:
  technique: semantic_caching
  expected_cost_reduction: "40-60%"
  expected_latency_improvement: "80-95% for cache hits"
  effort_estimate: "2-3 engineering days"
  risk_level: low

economics:
  baseline_calculation:
    monthly_requests: "total_api_calls"
    avg_cost_per_request: "0.05"
    monthly_cost: "monthly_requests * avg_cost_per_request"
  
  projected_savings:
    cache_hit_rate: "0.45"
    cache_cost_per_hit: "0.001"
    monthly_savings: "monthly_cost * cache_hit_rate * 0.98"
  
  implementation_cost:
    engineering_hours: 20
    hourly_rate: 200
    total_cost: 4000
  
  roi_calculation:
    payback_months: "implementation_cost / monthly_savings"
    annual_roi: "(monthly_savings * 12 - implementation_cost) / implementation_cost"

implementation:
  prerequisites:
    - requirement: "Redis or similar cache backend"
      validation_command: "redis-cli ping"
      optional: false
    - requirement: "Vector embedding model for semantic similarity"
      validation_command: "python -c 'import sentence_transformers'"
      optional: false
  
  automated_steps:
    - step_id: "install_cache"
      name: "Install caching infrastructure"
      executable: true
      commands:
        - "pip install redis sentence-transformers"
        - "docker run -d -p 6379:6379 redis:latest"
      validation:
        command: "redis-cli ping"
        success_criteria: "PONG"
        rollback_command: "docker stop redis && docker rm redis"
    
    - step_id: "implement_cache_layer"
      name: "Implement semantic cache layer"
      executable: false
      commands:
        - "# Implement SemanticCache class"
        - "# Add cache.get() before LLM calls"
        - "# Add cache.set() after LLM responses"
      validation:
        command: "python -m pytest tests/test_semantic_cache.py"
        success_criteria: "All tests passed"
        rollback_command: "git checkout -- semantic_cache.py"

monitoring:
  key_metrics:
    - metric: "cache_hit_rate"
      target: ">40%"
      alert_threshold: "<30%"
    - metric: "cache_latency_p95"
      target: "<50ms"
      alert_threshold: ">100ms"
    - metric: "quality_degradation"
      target: "<2%"
      alert_threshold: ">5%"
  
  rollback_triggers:
    - condition: "cache_hit_rate < 20% for 24 hours"
      action: "alert_and_investigation"
    - condition: "quality_score drops > 5%"
      action: "automatic_rollback"
      delay_minutes: 30

results:
  implementations:
    - organization: "E-commerce Company"
      baseline_cost: 15000
      optimized_cost: 6500
      savings_percentage: 57
      implementation_time_days: 3
    - organization: "SaaS Platform"
      baseline_cost: 8000
      optimized_cost: 3500
      savings_percentage: 56
      implementation_time_days: 2
---

## Overview

Semantic caching reduces LLM inference costs by identifying and serving cached responses for semantically similar requests. Unlike exact-match caching, semantic caching uses vector embeddings to detect similar queries even when phrasing differs.

## How It Works

1. **Request Encoding**: Incoming prompts are encoded using a lightweight embedding model (e.g., sentence-transformers)
2. **Similarity Search**: The embedding is compared against cached embeddings using cosine similarity
3. **Cache Hit**: If similarity > threshold (typically 0.85), return cached response
4. **Cache Miss**: Call LLM, cache the response with its embedding

## Implementation Example

```python
from sentence_transformers import SentenceTransformer
import redis
import numpy as np

class SemanticCache:
    def __init__(self, similarity_threshold=0.85):
        self.model = SentenceTransformer('all-MiniLM-L6-v2')
        self.redis = redis.Redis(host='localhost', port=6379)
        self.threshold = similarity_threshold
    
    def get(self, prompt):
        embedding = self.model.encode(prompt)
        # Search for similar cached embeddings
        cached_keys = self.redis.keys('cache:*')
        
        for key in cached_keys:
            cached_data = self.redis.get(key)
            cached_embedding, cached_response = pickle.loads(cached_data)
            
            similarity = np.dot(embedding, cached_embedding) / (
                np.linalg.norm(embedding) * np.linalg.norm(cached_embedding)
            )
            
            if similarity >= self.threshold:
                return cached_response
        
        return None
    
    def set(self, prompt, response):
        embedding = self.model.encode(prompt)
        cache_key = f"cache:{hash(prompt)}"
        self.redis.set(cache_key, pickle.dumps((embedding, response)))
        self.redis.expire(cache_key, 86400)  # 24 hour TTL
```

## Economics

**Typical Savings**: 40-60% cost reduction
**Cache Hit Rate**: 35-50% in production
**Latency Improvement**: 80-95% for cache hits (5-50ms vs 500-3000ms)

## Monitoring

Key metrics to track:
- Cache hit rate
- Average similarity scores for hits
- Quality score comparison (cached vs fresh)
- Cost savings vs cache infrastructure cost

## Best Practices

1. Set appropriate similarity threshold (0.80-0.90)
2. Implement TTL based on content freshness requirements
3. Monitor quality degradation regularly
4. Use lightweight embedding models for speed
5. Consider domain-specific fine-tuned embedding models


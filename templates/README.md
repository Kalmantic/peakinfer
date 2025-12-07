# PeakInfer Community Optimization Templates

This repository contains community-validated optimization templates for LLM inference cost optimization.

## Structure

```
templates/
├── application-layer/     # Application-level optimizations (caching, routing, context)
├── serving-layer/         # Serving framework optimizations (vLLM, quantization, batching)
├── infrastructure-layer/  # Infrastructure optimizations (spot instances, GPU allocation)
└── cross-layer/          # Cross-layer coordination strategies
```

## Template Format

Each template is a YAML file with the following structure:

```yaml
id: "template-id"
name: "Human Readable Name"
description: "What this template does"
category: "category_type"
confidence: 0.85  # Success rate (0-1)
success_count: 1000
verified_environments: 50
contributors: ["contributor1", "contributor2"]
last_updated: "2025-01-15"

environment_match:
  # Criteria for when this template applies

optimization:
  technique: "technique_name"
  expected_cost_reduction: "20-40%"
  risk_level: "low|medium|high"
  effort_estimate: "1-2 weeks"

economics:
  baseline_calculation: {}
  implementation_cost:
    total_cost: 10000

implementation:
  prerequisites: []
  automated_steps: []

monitoring:
  key_metrics: []
  rollback_triggers: []
```

## Using Templates

```bash
# List all available templates
peakinfer templates list

# Get info on a specific template
peakinfer templates info semantic-caching

# Apply a template during planning
peakinfer plan --templates-dir ./templates
```

## Contributing

1. Fork this repository
2. Create your template in the appropriate category folder
3. Validate with `peakinfer template-validate <template.yaml>`
4. Submit a pull request

## Categories

### Application Layer
- Semantic caching
- Model routing
- Context window optimization
- Prompt optimization

### Serving Layer
- vLLM migration
- Quantization (4-bit, 8-bit)
- Continuous batching
- KV cache optimization

### Infrastructure Layer
- Spot instance optimization
- GPU allocation
- Multi-region deployment
- Reserved instance planning

### Cross-Layer
- Full stack optimization
- Caching + routing synergy
- vLLM + spot instances

## License

Apache 2.0

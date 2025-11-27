# PeakInfer Pricing Data

This directory contains pricing data for LLM inference providers.

## Files

| File | Description | Update Frequency |
|------|-------------|------------------|
| `gpu-providers.json` | GPU/neocloud hourly pricing with per-token equivalents | Weekly |
| `api-models.json` | API model pricing (planned migration from LiteLLM) | Daily |

## Current Sources

### GPU Providers (`gpu-providers.json`)
Manual curation from provider pricing pages:
- Modal: https://modal.com/pricing
- RunPod: https://www.runpod.io/gpu-instance/pricing
- Lambda Labs: https://lambdalabs.com/service/gpu-cloud
- Vast.ai: https://vast.ai/pricing
- Together AI: https://www.together.ai/pricing
- Fireworks AI: https://fireworks.ai/pricing

### API Models (`api-models.json`)
Currently fetched from LiteLLM:
- Source: https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json
- Future: Will be migrated to this repo for full control

## Schema

### GPU Providers Schema
```json
{
  "provider": "string",       // Provider name (modal, runpod, lambda, etc.)
  "gpu": "string",            // GPU model (H100 (80GB), A100 (80GB), etc.)
  "hourlyRate": "number",     // $ per hour (0 for serverless)
  "tokensPerSecond": "number",// Expected throughput
  "model": "string",          // Reference model (llama-3.1-70b, etc.)
  "servingStack": "string",   // Serving framework (vLLM, TensorRT-LLM, etc.)
  "inputPer1M": "number",     // Equivalent $ per 1M input tokens
  "outputPer1M": "number",    // Equivalent $ per 1M output tokens
  "note": "string"            // Additional context
}
```

### API Models Schema (Future)
```json
{
  "provider": "string",       // Provider name (openai, anthropic, etc.)
  "model": "string",          // Model identifier
  "inputPer1M": "number",     // $ per 1M input tokens
  "outputPer1M": "number",    // $ per 1M output tokens
  "maxInputTokens": "number", // Context window
  "maxOutputTokens": "number" // Max output length
}
```

## Per-Token Equivalent Calculation

GPU hourly pricing is converted to per-token equivalent for comparison:

```
tokens_per_hour = tokens_per_second * 3600
cost_per_1M = (hourly_rate / tokens_per_hour) * 1_000_000 / utilization
```

Assumptions:
- **50% GPU utilization** (realistic for most production workloads)
- Output tokens slightly more expensive (autoregressive generation)

## Contributing

To update pricing data:
1. Verify prices on provider websites
2. Update the relevant JSON file
3. Update the `lastUpdated` field
4. Submit a PR with source links

## Additional Sources

- **LiteLLM**: https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json
- **Simon Willison**: https://github.com/simonw/llm-prices / https://www.llm-prices.com/
- **Semianalysis ClusterMax**: https://newsletter.semianalysis.com/p/clustermax-20-the-industry-standard

When conflicts occur between sources, prefer LiteLLM for API pricing, verify against provider websites.

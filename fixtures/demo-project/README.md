# PeakInfer v2.0 Demo Project

This is a sample project for demonstrating PeakInfer v2.0 features.

## Files

- `src/llm-client.ts` - Sample LLM client with various inference patterns
- `sample-events.jsonl` - Sample runtime events for combined analysis

## Quick Demo

### 1. Basic Analysis
```bash
peakinfer analyze .
```

### 2. With Comparison
```bash
# Run again to see comparison
peakinfer analyze . --compare
```

### 3. With Prediction
```bash
peakinfer analyze . --predict --target-p95 3000
```

### 4. Combined Analysis (Static + Runtime)
```bash
peakinfer analyze . --events sample-events.jsonl --compare --predict --html --open
```

## Expected Results

### Predictions
- `chatWithGPT4`: HIGH risk (p95 ~5000ms)
- `analyzeWithOpus`: HIGH risk (p95 ~8000ms)
- `summarize`: MEDIUM risk (p95 ~4000ms)
- `quickChat`: LOW risk (p95 ~1500ms)
- `fastResponse`: LOW risk (p95 ~1500ms)

### Counterfactuals
- Model swap: gpt-4 → gpt-4o-mini (-75% latency, -90% cost)
- Model swap: claude-3-opus → claude-3.5-sonnet (-60% latency)
- Enable streaming for non-streaming calls
- Add batching for embedding calls
- Add caching layer

### Drift (Combined Mode)
Shows mismatches between code and runtime:
- Inference points in code but not in runtime (dead code?)
- Runtime events not mapped to code (dynamic calls?)

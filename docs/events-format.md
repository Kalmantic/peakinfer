# Runtime Events Format

PeakInfer correlates your code with runtime behavior. This document describes how to format runtime event data for drift detection.

## Quick Start

Export your LLM inference events as JSONL (newline-delimited JSON):

```jsonl
{"id":"evt_1","ts":"2024-12-21T10:00:00Z","provider":"openai","model":"gpt-4","input_tokens":150,"output_tokens":50,"latency_ms":1200}
{"id":"evt_2","ts":"2024-12-21T10:00:01Z","provider":"anthropic","model":"claude-3-opus","input_tokens":200,"output_tokens":100,"latency_ms":2500}
```

Save to a file (e.g., `events.jsonl`) and pass to PeakInfer:

```bash
# CLI
peakinfer analyze ./src --events events.jsonl

# GitHub Action
- uses: kalmantic/peakinfer@v1
  with:
    path: ./src
    runtime: ./events.jsonl
```

---

## InferenceEvent Schema

Each event represents one LLM inference call:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique event identifier |
| `ts` | string | Yes | ISO 8601 timestamp |
| `provider` | string | Yes | Provider name (see below) |
| `model` | string | Yes | Model name |
| `input_tokens` | number | Yes | Input token count |
| `output_tokens` | number | Yes | Output token count |
| `latency_ms` | number | Yes | Total latency in milliseconds |
| `intent` | string | No | Business intent (e.g., "summarize", "translate") |
| `callsite_id` | string | No | Link to code location (improves correlation) |
| `streaming` | boolean | No | Was this a streaming request? |
| `ttft_ms` | number | No | Time to first token (streaming only) |
| `batch_size` | number | No | Batch size if batched |
| `batch_id` | string | No | Batch group identifier |
| `cached` | boolean | No | Was response cached? |
| `retry_count` | number | No | Number of retries |
| `fallback_used` | boolean | No | Was fallback triggered? |
| `original_model` | string | No | Original model if fallback used |

---

## Provider Names

Use lowercase provider names:

| Provider | Value |
|----------|-------|
| OpenAI | `openai` |
| Anthropic | `anthropic` |
| Google | `google` |
| Azure OpenAI | `azure_openai` |
| AWS Bedrock | `bedrock` |
| Cohere | `cohere` |
| Mistral | `mistral` |
| Together AI | `together` |
| Fireworks | `fireworks` |
| Groq | `groq` |
| Replicate | `replicate` |
| Perplexity | `perplexity` |
| vLLM | `vllm` |
| SGLang | `sglang` |
| TGI | `tgi` |
| Ollama | `ollama` |
| llama.cpp | `llamacpp` |

---

## Supported Formats

PeakInfer auto-detects the following formats:

### Direct Parse (No LLM Needed)

| Format | Extension | Description |
|--------|-----------|-------------|
| JSONL | `.jsonl` | Newline-delimited JSON (preferred) |
| JSON Array | `.json` | Array of event objects |
| CSV | `.csv` | Comma-separated values |
| TSV | `.tsv` | Tab-separated values |

### Agent-Normalized (Requires API Key)

PeakInfer can parse exports from observability platforms:

| Platform | Notes |
|----------|-------|
| OpenTelemetry | OTLP traces/spans |
| Jaeger | Distributed tracing format |
| Zipkin | Tracing format |
| LangSmith | Trace exports |
| Helicone | Proxy logs |
| LiteLLM | Proxy event logs |
| Portkey | Gateway logs |

For these formats, provide your Anthropic API key:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
peakinfer analyze ./src --events otel-traces.json
```

---

## CSV/TSV Column Names

For CSV/TSV files, use these column names:

```csv
id,ts,provider,model,input_tokens,output_tokens,latency_ms,streaming
evt_1,2024-12-21T10:00:00Z,openai,gpt-4,150,50,1200,false
evt_2,2024-12-21T10:00:01Z,anthropic,claude-3-opus,200,100,2500,true
```

Alternative column names are supported:
- `timestamp` → `ts`
- `provider_name` → `provider`
- `model_name` → `model`
- `tokens_in` → `input_tokens`
- `tokens_out` → `output_tokens`
- `latency`, `duration_ms` → `latency_ms`

---

## Linking Events to Code

For better correlation, add `callsite_id` to events matching your code locations:

```jsonl
{"id":"evt_1","ts":"2024-12-21T10:00:00Z","provider":"openai","model":"gpt-4","input_tokens":150,"output_tokens":50,"latency_ms":1200,"callsite_id":"src/services/chat.ts:42"}
```

PeakInfer will match this to the inference point at `src/services/chat.ts:42`.

---

## Drift Detection

When runtime data is provided, PeakInfer detects drift between code and runtime:

| Drift Type | Description |
|------------|-------------|
| `codeOnly` | Inference point in code but never called |
| `runtimeOnly` | Runtime calls with no matching code location |
| `mismatch` | Model/provider differs between code and runtime |
| `patternDrift` | Pattern mismatch (e.g., streaming in code, blocking in runtime) |

Example PR comment:

```
🔒 RUNTIME CORRELATION

| Location | Code | Runtime | Drift |
|----------|------|---------|-------|
| chat.ts:42 | streaming: true | streaming: 0% | patternDrift |
| api.ts:15 | gpt-4 | gpt-4-turbo | mismatch |
```

---

## GitHub Action Integration

### From File in Repository

```yaml
- uses: kalmantic/peakinfer@v1
  with:
    path: ./src
    runtime: ./traces/events.jsonl
```

### From URL

Fetch events from your observability platform:

```yaml
- uses: kalmantic/peakinfer@v1
  with:
    path: ./src
    runtime-source: url
    runtime: ${{ secrets.OBSERVABILITY_URL }}
```

### From GitHub Artifact

If events are produced by a previous job:

```yaml
- uses: actions/download-artifact@v4
  with:
    name: inference-events

- uses: kalmantic/peakinfer@v1
  with:
    path: ./src
    runtime: ./inference-events/events.jsonl
```

---

## Generating Events

### OpenAI SDK (Python)

```python
import json
import time
from openai import OpenAI

client = OpenAI()
events = []

start = time.time()
response = client.chat.completions.create(
    model="gpt-4",
    messages=[{"role": "user", "content": "Hello"}]
)
latency = (time.time() - start) * 1000

events.append({
    "id": response.id,
    "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    "provider": "openai",
    "model": response.model,
    "input_tokens": response.usage.prompt_tokens,
    "output_tokens": response.usage.completion_tokens,
    "latency_ms": int(latency),
    "streaming": False,
})

# Write to JSONL
with open("events.jsonl", "a") as f:
    f.write(json.dumps(events[-1]) + "\n")
```

### Anthropic SDK (Python)

```python
import json
import time
import anthropic

client = anthropic.Anthropic()
events = []

start = time.time()
response = client.messages.create(
    model="claude-3-opus-20240229",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello"}]
)
latency = (time.time() - start) * 1000

events.append({
    "id": response.id,
    "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    "provider": "anthropic",
    "model": response.model,
    "input_tokens": response.usage.input_tokens,
    "output_tokens": response.usage.output_tokens,
    "latency_ms": int(latency),
    "streaming": False,
})

with open("events.jsonl", "a") as f:
    f.write(json.dumps(events[-1]) + "\n")
```

---

## Best Practices

1. **Export regularly**: Run event exports as part of your CI/CD pipeline
2. **Include callsite_id**: Improves code-to-runtime correlation accuracy
3. **Keep events recent**: Use last 24-48 hours of data for meaningful drift detection
4. **Use streaming field**: Critical for detecting streaming drift
5. **Track retries**: Helps identify reliability issues

---

## Related

- [InferenceMap Spec](inferencemap-spec.md) — Output schema for analysis results
- [README](../README.md) — Quick start guide

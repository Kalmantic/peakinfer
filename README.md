# PeakInfer

> CLI tool to discover and analyze LLM inference patterns in your codebase and runtime telemetry

[![npm version](https://img.shields.io/npm/v/@kalmantic/peakinfer.svg)](https://www.npmjs.com/package/@kalmantic/peakinfer)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)

PeakInfer analyzes your LLM usage from two sources:
- **Static Analysis** — Scan codebase to find LLM API calls
- **Runtime Telemetry** — Analyze production inference logs (JSONL)

## Installation

```bash
npm install -g @kalmantic/peakinfer
export ANTHROPIC_API_KEY=your-key  # required for static analysis
```

## Quick Start

```bash
# Static: Analyze your codebase
peakinfer analyze .

# Runtime: Analyze inference telemetry (no API key needed)
peakinfer analyze events.jsonl

# Combined: Static + runtime analysis
peakinfer analyze ./src --events production.jsonl

# Generate HTML report
peakinfer analyze . --html --open

# View cached results (offline)
peakinfer analyze . --cached
```

## Commands

| Command | Description |
|---------|-------------|
| `peakinfer analyze <path>` | Analyze codebase or runtime events |
| `peakinfer prices [provider]` | Show model pricing data (API + GPU) |

## Analysis Modes

PeakInfer auto-detects the analysis mode based on the target path:

| Target | Mode | API Key |
|--------|------|---------|
| Directory (`./src`) | Static analysis | Required |
| `.jsonl` / `.csv` file | Runtime telemetry | Not needed |
| With `--events` flag | Combined | Required |

### Analyze Options

```bash
peakinfer analyze <path> [options]

Options:
  --events <file>    Add runtime telemetry to static analysis
  --mode <type>      Force analysis mode: static | runtime
  --html             Generate HTML report
  --open             Open HTML report in browser
  --output json      Machine-readable JSON output
  --cached           View previous analysis (offline)
```

## What It Detects

**Static Analysis:**
- **SDK Calls**: OpenAI, Anthropic, Cohere, Google, Mistral, Groq, Together
- **Frameworks**: LangChain, LlamaIndex, Haystack, DSPy
- **Self-Hosted**: vLLM, TGI, SGLang, Ollama
- **Hyperscalers**: AWS Bedrock, Azure OpenAI, GCP Vertex AI
- **Gateways**: LiteLLM, Portkey, OpenRouter

**Runtime Analysis:**
- Provider distribution and latency patterns
- Model usage breakdown
- Intent/task classification
- Cost estimation from actual token counts

## Runtime Telemetry

### Event Schema

Export your inference logs as JSONL (one JSON object per line):

```json
{"id":"evt_001","ts":"2025-12-09T08:15:23Z","provider":"openai","model":"gpt-4o","input_tokens":4250,"output_tokens":380,"latency_ms":2340,"intent":"summarize_doc"}
{"id":"evt_002","ts":"2025-12-09T08:16:45Z","provider":"anthropic","model":"claude-3-5-sonnet","input_tokens":1820,"output_tokens":245,"latency_ms":1890,"intent":"extract_entities"}
```

### Supported Fields

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Unique event identifier |
| `ts` | Yes | ISO timestamp |
| `provider` | Yes | Provider name (openai, anthropic, etc.) |
| `model` | Yes | Model identifier |
| `input_tokens` | Yes | Input token count |
| `output_tokens` | Yes | Output token count |
| `latency_ms` | Yes | Response latency in milliseconds |
| `intent` | No | Task type (summarize, extract, chat, etc.) |
| `tenant` | No | Team/workspace identifier |
| `region` | No | Geographic region |
| `cost_usd` | No | Actual cost if known |

### Supported Formats

| Format | Status |
|--------|--------|
| JSONL (.jsonl) | ✓ Supported |
| NDJSON (.ndjson) | ✓ Supported |
| JSON (.json) | ✓ Supported |
| CSV (.csv) | ✓ Supported |
| Parquet (.parquet) | Planned |

### Collecting Events

Export from your infrastructure:

```bash
# From Snowflake
snowsql -q "SELECT * FROM inference_logs" -o output_format=json > events.jsonl

# From application logs
cat app.log | jq -c 'select(.type=="inference")' > events.jsonl

# From LiteLLM logs
cat litellm.log | jq -c '{id: .request_id, ts: .timestamp, provider: .model_info.provider, model: .model, input_tokens: .usage.prompt_tokens, output_tokens: .usage.completion_tokens, latency_ms: .response_time_ms}' > events.jsonl

# Then analyze
peakinfer analyze events.jsonl
```

## Example Output

### Static Analysis
```
PeakInfer v1.0

Scanned: 847 files (12,340 LOC)
Languages: python, typescript

Found 12 inference callsites across 8 files.

STACKMAP
--------
CALLSITES (12)
   src/services/chat.py:45       gpt-4o, streaming
   src/agents/analyzer.py:23     claude-3-5-sonnet

PRICING SUMMARY
---------------
Estimated monthly cost: $1,240 - $1,870
```

### Runtime Analysis
```
RUNTIME TELEMETRY ANALYSIS
═══════════════════════════════════════════════════════════════

Source: production-events.jsonl
Events: 25,432
Time Range: 2025-12-01T00:00:00Z → 2025-12-09T23:59:59Z

PROVIDERS
─────────────────────────────────────────────────────────────────
openai            15,234 events (59.9%)  avg 2340ms
anthropic          8,456 events (33.2%)  avg 1890ms
together           1,742 events (6.8%)   avg 1240ms

MODELS
─────────────────────────────────────────────────────────────────
gpt-4o                          8,234 (32.4%)  2340ms
claude-3-5-sonnet               6,123 (24.1%)  1890ms
gpt-4o-mini                     5,678 (22.3%)  890ms
```

### Combined Analysis

When you use `--events` with a codebase path, PeakInfer performs intelligent correlation between your static codebase and runtime telemetry:

```bash
peakinfer analyze ./src --events production.jsonl
```

The correlation analysis detects:
- **Match quality**: high, partial, low, or none
- **Provider alignment**: Do events match providers found in code?
- **Missing coverage**: Providers in code without runtime events
- **Extra providers**: Runtime events from providers not in codebase

Example output with correlation warnings:
```
peakinfer
  ./src

correlation:
  match quality: partial
  codebase providers: openai, anthropic
  events providers: openai, anthropic, together

  warning: events contain providers not in codebase: together
    • events may be from a different codebase or deployment
    • or codebase uses dynamic provider selection

callsites:
  3 found (2 with usage data)
  providers: openai, anthropic
```

This helps identify:
- Events from wrong environment (staging vs production)
- Drift between code and deployed systems
- Dynamic routing or A/B testing in production

## License

Apache 2.0

## Links

- [GitHub Issues](https://github.com/kalmantic/peakinfer/issues)
- [npm Package](https://www.npmjs.com/package/@kalmantic/peakinfer)

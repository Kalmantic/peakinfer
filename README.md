# PeakInfer

**Run AI inference at peak performance.**

PeakInfer scans your code. Finds every LLM call. Shows you exactly what's holding back your latency, throughput, and reliability.

30 seconds. Zero config. Real numbers.

```bash
npm install -g @kalmantic/peakinfer
peakinfer analyze .
```

---

## The Problem

Your code says `streaming: true`. Your runtime shows 0% streams.

That's **drift**—and it's killing your latency.

| What You Think | What's Actually Happening |
|----------------|---------------------------|
| Streaming enabled | Blocking calls |
| Fast responses | p95 latency 5x slower than benchmarks |
| Retry logic works | Never triggered |
| Fallbacks ready | Never tested |

Static analysis sees code. Monitoring sees requests. **Neither sees the gap.**

PeakInfer sees both.

---

## What Is Peak Inference Performance?

**Peak Inference Performance means:** Improving latency, throughput, reliability, and cost *without changing evaluated behavior*.

No one else correlates what PeakInfer sees together:

```
CODE                 RUNTIME              BENCHMARKS           EVALS
────                 ───────              ──────────           ─────

What you             What actually        The upper bound      Your quality
declared             happened             of possible          gate

streaming: true      0% streaming         InferenceMAX:        "extraction" 94%
model: gpt-4o        p95: 2400ms          gpt-4o p95: 1200ms   accuracy

        └───────────────────┴────────────────────┴───────────────────┘
                                     │
                                     ▼
                                PEAKINFER
                               (correlation)
```

---

## The Four Dimensions

PeakInfer analyzes every inference point across four dimensions:

| Dimension | What We Find | Typical Improvement |
|-----------|--------------|---------------------|
| **Latency** | Missing streaming, blocking calls, p95 gaps | 50-80% faster |
| **Throughput** | Sequential loops, no batching | 10-50x improvement |
| **Reliability** | No retry, no fallback, no timeout | 99%+ uptime |
| **Cost** | Wrong model for the job | 60-90% reduction |

---

## How It Works

### 1. Scan Your Code

```bash
peakinfer analyze ./src
```

Finds every inference point. OpenAI, Anthropic, Azure, Bedrock, self-hosted. All of them.

### 2. See What's Holding You Back

```
7 inference points found
39 issues detected

LATENCY:
- Streaming configured but not consumed (p95: 2400ms, should be 400ms)
- Blocking calls in hot path (6x latency penalty)

THROUGHPUT:
- Sequential batch processing (50x throughput opportunity)

RELIABILITY:
- Zero error handling across all LLM calls
- No fallback on critical inference path

QUICK WINS:
- Enable streaming consumption: -80% latency
- Add retry logic: +99% reliability
- Parallelize batch: 50x throughput
```

### 3. Catch Drift Before Production

Add to every PR:

```yaml
- uses: kalmantic/peakinfer-action@v1
  with:
    path: ./src
    token: ${{ secrets.PEAKINFER_TOKEN }}
```

---

## Installation

```bash
npm install -g @kalmantic/peakinfer
```

Requires Node.js 18+.

---

## First-Time Setup

PeakInfer uses Claude for semantic analysis. You provide your own Anthropic API key (BYOK mode).

### Step 1: Get an Anthropic API Key

1. Go to [console.anthropic.com](https://console.anthropic.com/)
2. Create an account or sign in
3. Navigate to API Keys and create a new key
4. Copy the key (starts with `sk-ant-`)

### Step 2: Configure Your API Key

**Option A: Environment File (Recommended)**

```bash
# .env
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

**Option B: Shell Export**

```bash
export ANTHROPIC_API_KEY=sk-ant-your-key-here
```

### Step 3: Verify Setup

```bash
peakinfer analyze . --verbose
```

**BYOK Mode**: Your API key, your costs, full transparency. Analysis runs locally. No data sent to PeakInfer servers.

---

## Commands

```bash
# Basic scan
peakinfer analyze .

# With code fix suggestions
peakinfer analyze . --fixes

# With HTML report
peakinfer analyze . --html --open

# Compare to InferenceMAX benchmarks
peakinfer analyze . --benchmark

# With runtime correlation (drift detection)
peakinfer analyze . --events production.jsonl

# Fetch runtime from observability platforms
peakinfer analyze . --runtime helicone --runtime-key $HELICONE_KEY

# Full analysis
peakinfer analyze . --fixes --benchmark --html --open
```

### CLI Options

| Flag | Description |
|------|-------------|
| **Output** | |
| `--fixes` | Show code fix suggestions for each issue |
| `--html` | Generate HTML report |
| `--pdf` | Generate PDF report |
| `--open` | Auto-open report in browser/viewer |
| `--output <format>` | Output format: `text`, `json`, or `inference-map` |
| `--verbose` | Show detailed analysis logs |
| **Runtime Data** | |
| `--events <file>` | Path to runtime events file (JSONL) |
| `--events-url <url>` | URL to fetch runtime events |
| `--runtime <source>` | Fetch from: `helicone`, `langfuse` |
| `--runtime-key <key>` | API key for runtime source |
| `--runtime-days <n>` | Days of runtime data (default: 7) |
| **Comparison** | |
| `--compare [runId]` | Compare with previous analysis run |
| `--benchmark` | Compare to InferenceMAX benchmarks |
| `--predict` | Generate deploy-time latency predictions |
| `--target-p95 <ms>` | Target p95 latency for budget calculation |
| **Cost Control** | |
| `--estimate` | Show cost estimate before analysis |
| `--yes` | Auto-proceed without confirmation |
| `--max-cost <dollars>` | Skip if estimated cost exceeds threshold |
| `--cached` | View previous analysis (offline) |

---

## GitHub Action

Every PR. Every merge. Automatic.

```yaml
name: PeakInfer
on: [pull_request]

permissions:
  contents: read
  pull-requests: write

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: kalmantic/peakinfer-action@v1
        with:
          token: ${{ secrets.PEAKINFER_TOKEN }}
          github-token: ${{ github.token }}
```

See [peakinfer-action](https://github.com/Kalmantic/peakinfer-action) for full documentation.

---

## Runtime Drift Detection

PeakInfer's real power: correlating code with runtime behavior.

```bash
# From file
peakinfer analyze ./src --events events.jsonl

# From Helicone
peakinfer analyze ./src --runtime helicone --runtime-key $HELICONE_KEY

# From Langfuse
peakinfer analyze ./src --runtime langfuse --runtime-key $LANGFUSE_PUBLIC_KEY
```

Supported formats: JSONL, JSON, CSV, OpenTelemetry, Jaeger, Zipkin, Langfuse, LiteLLM, Helicone.

---

## Supported Providers

| Provider | Status |
|----------|--------|
| OpenAI | Full support |
| Anthropic | Full support |
| Azure OpenAI | Full support |
| AWS Bedrock | Full support |
| Google Vertex | Full support |
| vLLM / TensorRT-LLM | HTTP detection |
| LangChain / LlamaIndex | Framework support |

---

## Community Templates

**43 templates** across two categories:

### Insight Templates (12)

Detect issues: streaming drift, overpowered model, context accumulation, token underutilization, retry explosion, untested fallback, dead code, and more.

### Optimization Templates (31)

Actionable fixes: model routing, batch utilization, prompt caching, vLLM high-throughput, GPTQ quantization, TensorRT-LLM, multi-provider fallback, auto-scaling, and more.

---

## Pricing

**CLI**: Free forever. BYOK — you provide your Anthropic API key.

**GitHub Action**:
- **Free**: 50 credits one-time (6-month expiry)
- **Starter**: $19 for 200 credits
- **Growth**: $49 for 600 credits
- **Scale**: $149 for 2,000 credits
- **Mega**: $499 for 10,000 credits

No subscriptions. No per-seat pricing. Team pooling.

[View pricing →](https://peakinfer.com/pricing)

---

## What's Included

| Feature | Status |
|---------|--------|
| Unified Prompt-Based Analysis | ✅ |
| GitHub Action with PR Comments | ✅ |
| Code Fix Suggestions | ✅ |
| Runtime Drift Detection | ✅ |
| InferenceMAX Benchmark Comparison | ✅ |
| 43 Optimization Templates | ✅ |
| Run History & Comparison | ✅ |
| BYOK Mode (CLI) | ✅ |

---

## Links

- [VS Code Extension](https://github.com/Kalmantic/peakinfer-vscode)
- [MCP Server (Claude Desktop)](https://github.com/Kalmantic/peakinfer-mcp)
- [GitHub Action](https://github.com/Kalmantic/peakinfer-action)
- [Report Issues](https://github.com/Kalmantic/peakinfer/issues)

---

Built by [Kalmantic](https://kalmantic.com). Apache-2.0 license.

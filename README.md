# PeakInfer

**Your LLM costs 10x more than it should. Your latency is 5x slower than it could be. You just don't know it yet.**

PeakInfer scans your code. Finds every LLM call. Shows you exactly what's wrong.

30 seconds. Zero config. Real numbers.

```bash
npm install -g @kalmantic/peakinfer
peakinfer analyze .
```

---

## What You'll Find

Teams using PeakInfer discover:

- **90% cost waste** - GPT-4 running tasks that GPT-3.5 handles fine
- **5x latency bloat** - Streaming configured in code, disabled in production
- **Zero error handling** - API calls with no retry, no timeout, no fallback
- **Sequential bottlenecks** - Loops that should be parallel

You can't fix what you can't see.

---

## The Problem

Your code says `streaming: true`. Your runtime shows 0% streams.

That's drift. And it's everywhere.

| What You Think | What's Actually Happening |
|----------------|---------------------------|
| Streaming enabled | Blocking calls |
| GPT-4 for quality | GPT-4 for everything |
| Retry logic works | Never triggered |
| Fallbacks ready | Never tested |

Static analysis sees code. Monitoring sees requests. Neither sees the gap.

**PeakInfer sees both.**

---

## How It Works

### 1. Scan Your Code

```bash
peakinfer analyze ./src
```

Finds every inference point. OpenAI, Anthropic, Azure, Bedrock, self-hosted. All of them.

### 2. See What's Wrong

```
7 inference points found
39 issues detected

CRITICAL:
- Zero error handling across all LLM calls
- GPT-4 used for simple classification (90% cost waste)
- Sequential batch processing (50x throughput loss)

QUICK WINS:
- Switch GPT-4 to GPT-4o-mini: -90% cost
- Enable streaming: -80% latency
- Add retry logic: +99% reliability
```

### 3. Fix Before You Ship

Add to every PR:

```yaml
- uses: kalmantic/peakinfer@v1
  with:
    path: ./src
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

Catch drift before it reaches production.

---

## Four Numbers That Matter

PeakInfer analyzes every inference point across four dimensions:

| Dimension | What We Find | Typical Savings |
|-----------|--------------|-----------------|
| **Cost** | Wrong model for the job | 60-90% reduction |
| **Latency** | Missing streaming, blocking calls | 50-80% faster |
| **Throughput** | Sequential loops, no batching | 10-50x improvement |
| **Reliability** | No retry, no fallback, no timeout | 99%+ uptime |

---

## Installation

```bash
npm install -g @kalmantic/peakinfer
```

Requires Node.js 18+. That's it.

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

Create a `.env` file in your project root:

```bash
# .env
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

PeakInfer automatically loads `.env` files.

**Option B: Shell Export**

```bash
export ANTHROPIC_API_KEY=sk-ant-your-key-here
```

Add to your `.bashrc`, `.zshrc`, or shell profile for persistence.

### Step 3: Verify Setup

```bash
peakinfer analyze . --verbose
```

If configured correctly, you'll see `[agent] Starting Claude Agent SDK analysis...`

### What If I Don't Have an API Key?

PeakInfer requires an Anthropic API key for all analysis. There is no regex-based fallback mode. The CLI will show an error if no key is configured.

**BYOK Mode**: Your API key, your costs, full transparency. Analysis runs locally. No data sent to PeakInfer servers.

---

## Try It Out

Create a sample file with LLM calls to see PeakInfer in action:

```bash
# Create a test file
mkdir -p /tmp/peakinfer-demo && cat > /tmp/peakinfer-demo/app.ts << 'EOF'
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

export async function chat(prompt: string): Promise<string> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });
  return response.content[0].type === 'text' ? response.content[0].text : '';
}
EOF

# Analyze it
peakinfer analyze /tmp/peakinfer-demo --fixes
```

PeakInfer will find the inference point and suggest improvements like error handling, retry logic, and streaming.

---

## Commands

```bash
# Basic scan
peakinfer analyze .

# With code fix suggestions
peakinfer analyze . --fixes

# With HTML report
peakinfer analyze . --html --open

# Compare to last run
peakinfer analyze . --compare

# Predict latency before deploy
peakinfer analyze . --predict --target-p95 2000

# Full analysis
peakinfer analyze . --fixes --compare --predict --html --open
```

### CLI Options

| Flag | Description |
|------|-------------|
| `--fixes` | Show code fix suggestions for each issue |
| `--html` | Generate HTML report |
| `--open` | Auto-open report in browser |
| `--compare` | Compare with previous analysis run |
| `--predict` | Run deploy-time prediction analysis |
| `--target-p95 <ms>` | Set target p95 latency for prediction |
| `--json` | Output JSON format |
| `--verbose` | Show detailed analysis logs |

---

## GitHub Action

Every PR. Every merge. Automatic.

### Basic Usage (Static Analysis)

```yaml
name: PeakInfer
on: [pull_request]

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: kalmantic/peakinfer@v1
        with:
          path: ./src
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

### With Runtime Events (Drift Detection)

PeakInfer's real power is correlating code with runtime behavior. Add runtime data for drift detection:

```yaml
name: PeakInfer
on: [pull_request]

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # Option 1: From file in repo
      - uses: kalmantic/peakinfer@v1
        with:
          path: ./src
          events: ./traces/events.jsonl
          github-token: ${{ secrets.GITHUB_TOKEN }}

      # Option 2: From URL (your observability platform)
      - uses: kalmantic/peakinfer@v1
        with:
          path: ./src
          events-url: ${{ secrets.TRACES_URL }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

### Action Inputs

| Input | Required | Description |
|-------|----------|-------------|
| `path` | No | Path to analyze (default: `./src`) |
| `github-token` | No | Token for PR comments |
| `events` | No | Path to runtime events file (JSONL) |
| `events-url` | No | URL to fetch runtime events |
| `events-map` | No | Field mapping for non-standard formats |
| `baseline` | No | Path to baseline for comparison |
| `target-p95` | No | Target p95 latency in ms |
| `inline-comments` | No | Add inline PR comments (default: `true`) |
| `fail-on-regression` | No | Fail if metrics regress (default: `false`) |

### What happens:
- Scans changed files
- Posts summary comment with code fixes
- Flags critical issues
- Tracks regressions
- Detects drift between code and runtime (if events provided)

Uses managed service. 50 free credits (one-time, 6-month expiry). Purchase additional credits at [peakinfer.com/pricing](https://peakinfer.com/pricing).

See [Runtime Events Format](docs/events-format.md) for event schema details.

---

## Supported Runtime Formats

PeakInfer auto-detects and normalizes runtime event data from 10 common formats:

| Format | Auto-Detect | Notes |
|--------|-------------|-------|
| **JSONL** | ✅ | Native InferenceEvent schema |
| **JSON Array** | ✅ | Native InferenceEvent schema |
| **CSV** | ✅ | Header-based field detection |
| **OpenTelemetry (OTLP)** | ✅ | Full trace/span extraction |
| **Jaeger** | ✅ | Trace format with tags |
| **Zipkin** | ✅ | Span-based traces |
| **LangSmith** | ✅ | LangChain observability |
| **LiteLLM** | ✅ | LiteLLM proxy logs |
| **Helicone** | ✅ | Helicone logging format |
| **Custom JSON** | ⚠️ | Agent-assisted field mapping |

### Usage with Runtime Events

```bash
# From file
peakinfer analyze ./src --events events.jsonl

# From URL (observability platform export)
peakinfer analyze ./src --events-url https://api.example.com/events

# With format hint
peakinfer analyze ./src --events data.json --format otel

# With field mappings (for custom formats)
peakinfer analyze ./src --events custom.json --map latency_ms=duration model=model_name
```

For unsupported or ambiguous formats, PeakInfer uses LLM-assisted field mapping (requires API key).

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

PeakInfer ships with **43 battle-tested templates** across two categories:

### Insight Templates (12)

Detect issues in your LLM code:

| Category | Templates |
|----------|-----------|
| **Cost** | Overpowered model, prompt bloat, cost concentration, overpowered extraction |
| **Drift** | Streaming drift, untested fallback, dead code |
| **Performance** | Context accumulation, latency explainer, throughput gap |
| **Waste** | Token underutilization, retry explosion |

### Optimization Templates (31)

Actionable fixes with implementation guides:

| Category | Examples |
|----------|----------|
| **API Optimization** | Model routing, batch utilization, prompt caching, streaming vs batch |
| **Application** | Smart model routing, context window optimization, max tokens |
| **Infrastructure** | vLLM high-throughput, GPTQ quantization, TensorRT-LLM, sglang |
| **Reliability** | Error handling, multi-provider fallback, auto-scaling |
| **Operations** | APM, quality monitoring, A/B testing, multi-tenant |

Templates provide:
- **Detection**: Pattern-matched insights with evidence
- **Impact estimates**: Cost/latency/throughput projections
- **Code fixes**: One-click suggestions (CLI `--fixes`, PR comments)
- **Economics**: ROI calculations and implementation costs

---

## Technical Docs

| Document | Description |
|----------|-------------|
| [Runtime Events Format](docs/events-format.md) | How to format runtime event data |
| [InferenceMap Spec](docs/inferencemap-spec.md) | Output schema for analysis results |

---

## What Teams Say

> "Found $4,200/month in wasted GPT-4 calls in the first scan."

> "Streaming was broken for 6 months. We had no idea."

> "Added to CI. Caught 3 regressions in the first week."

---

## Pricing

**CLI**: Free forever. BYOK (Bring Your Own Key) — you provide your Anthropic API key.

**GitHub Action**:
- **Free**: 50 credits one-time (6-month expiry)
- **Starter**: $19 for 200 credits
- **Growth**: $49 for 600 credits
- **Scale**: $149 for 2,000 credits
- **Mega**: $499 for 10,000 credits

No subscriptions. No per-seat pricing. Team pooling. FIFO credit consumption.

[View pricing →](https://peakinfer.com/pricing)

---

## What's Included (v2.0)

| Feature | Status |
|---------|--------|
| Unified Prompt-Based Analysis | ✅ |
| GitHub Action with PR Comments | ✅ |
| Code Fix Suggestions (`--fixes`) | ✅ |
| LiteLLM Dynamic Pricing (600+ models) | ✅ |
| Optimization Templates | ✅ |
| GitHub OAuth | ✅ |
| Credits API & Billing | ✅ |
| Run History | ✅ |
| InferenceMap v0.1 Spec | ✅ |
| Runtime Events Schema | ✅ |
| BYOK Mode (CLI) | ✅ |
| Demo Mode | ✅ |

---

## Links

- [Documentation](https://github.com/Kalmantic/peakinfer)
- [GitHub Action Demo](https://github.com/Kalmantic/peakinfer-demo/pull/2)
- [Report Issues](https://github.com/Kalmantic/peakinfer/issues)

---

Built by [Kalmantic](https://kalmantic.com). Apache-2.0 license.

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

### Add Your API Key (Optional)

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

With a key: AI-powered semantic analysis.
Without: Fast regex-based detection.

Both work. AI finds more.

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
          runtime: ./traces/events.jsonl
          github-token: ${{ secrets.GITHUB_TOKEN }}

      # Option 2: From URL (your observability platform)
      - uses: kalmantic/peakinfer@v1
        with:
          path: ./src
          runtime-source: url
          runtime: ${{ secrets.TRACES_URL }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

### Action Inputs

| Input | Required | Description |
|-------|----------|-------------|
| `path` | No | Path to analyze (default: `./src`) |
| `github-token` | No | Token for PR comments |
| `runtime` | No | Path to runtime events file (JSONL) |
| `runtime-source` | No | Source type: `file` or `url` |
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

No API key needed. Uses managed service with 300 free analyses/month.

See [Runtime Events Format](docs/events-format.md) for event schema details.

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

PeakInfer ships with 27 battle-tested optimization templates across 6 stack layers:

| Layer | Examples |
|-------|----------|
| **Application** | Streaming drift, overpowered model selection |
| **API** | Retry explosion, untested fallbacks |
| **Gateway** | Missing caching, rate limit gaps |
| **Runtime** | vLLM/sglang optimization opportunities |
| **Model** | Context accumulation, token waste |
| **Hardware** | GPU memory, quantization opportunities |

Templates provide:
- **Detection**: Pattern-matched insights with evidence
- **Impact estimates**: Cost/latency/throughput projections
- **Code fixes**: One-click suggestions (CLI `--fixes`, PR comments)

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

**CLI**: Free forever. Bring your own API key.

**GitHub Action**:
- **Free**: $0 — 300 credits/10 days (hard cap, resets automatically)
- **Pro**: $20 for 500 credits (one-time purchase), $0.05/credit overage

[View pricing →](https://peakinfer.com/pricing)

---

## What's Included (v1.8)

| Feature | Status |
|---------|--------|
| Static Analysis Engine | ✅ |
| GitHub Action with PR Comments | ✅ |
| Code Fix Suggestions (`--fixes`) | ✅ |
| LiteLLM Dynamic Pricing (600+ models) | ✅ |
| 27 Optimization Templates | ✅ |
| GitHub OAuth | ✅ |
| Credits API & Billing | ✅ |
| Run History | ✅ |
| InferenceMap v0.1 Spec | ✅ |
| Runtime Events Schema | ✅ |

---

## Links

- [Documentation](https://github.com/Kalmantic/peakinfer)
- [GitHub Action Demo](https://github.com/Kalmantic/peakinfer-demo/pull/2)
- [Report Issues](https://github.com/Kalmantic/peakinfer/issues)

---

Built by [Kalmantic](https://kalmantic.com). Apache-2.0 license.

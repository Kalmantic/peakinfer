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

# With HTML report
peakinfer analyze . --html --open

# Compare to last run
peakinfer analyze . --compare

# Predict latency before deploy
peakinfer analyze . --predict --target-p95 2000

# Full analysis
peakinfer analyze . --compare --predict --html --open
```

---

## GitHub Action

Every PR. Every merge. Automatic.

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

**What happens:**
- Scans changed files
- Posts summary comment
- Flags critical issues
- Tracks regressions

No API key needed. Uses managed service with 300 free analyses/month.

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

## What Teams Say

> "Found $4,200/month in wasted GPT-4 calls in the first scan."

> "Streaming was broken for 6 months. We had no idea."

> "Added to CI. Caught 3 regressions in the first week."

---

## Pricing

**CLI**: Free forever. Your API key.

**GitHub Action**: 300 analyses/month free. Then $29/month.

---

## Links

- [Documentation](https://github.com/Kalmantic/peakinfer)
- [GitHub Action Demo](https://github.com/Kalmantic/peakinfer-demo/pull/2)
- [Report Issues](https://github.com/Kalmantic/peakinfer/issues)

---

Built by [Kalmantic](https://kalmantic.com). Apache-2.0 license.

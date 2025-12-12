# PeakInfer PRD v1.0

**The honest document about what this thing actually does.**

---

## The Problem (Why This Exists)

Every team building with LLMs has the same problem: **they have no idea what's actually happening.**

- How many OpenAI calls are we making?
- Which models are we using and where?
- What's this costing us?
- Are we using vLLM or hitting the API directly?
- Is anyone using streaming? Batching? Retries?

Today, the answers come from:
1. Grepping through code (misses dynamic stuff)
2. Asking the team (incomplete, outdated)
3. Looking at dashboards (only shows what you instrumented)
4. Guessing

**PeakInfer answers these questions in one command.**

---

## The Job To Be Done

**"When I inherit/audit/optimize a codebase that uses LLMs, I need to know exactly what inference is happening—where, how often, through which providers, and at what cost—so I can make informed engineering decisions."**

That's it. That's the job.

Not "help me optimize." Not "suggest alternatives." Not "auto-fix my code."

Just: **show me the truth about LLM usage in this codebase.**

---

## What PeakInfer Actually Does

### Command 1: Static Analysis

```bash
peakinfer analyze .
```

Scans your codebase. Uses Claude to understand the code (not regex). Outputs:

- Every LLM callsite (file, line, provider, model)
- Detected patterns (streaming, batching, retries, caching)
- Pricing estimates based on static analysis
- Runtime detection (vLLM, SGLang, TensorRT, Ollama)

**Requires:** Anthropic API key, internet connection

### Command 2: Runtime Telemetry

```bash
peakinfer analyze events.jsonl
```

Analyzes your production logs. No API key needed. Outputs:

- Provider distribution
- Model usage breakdown
- Actual latency stats (avg, P50, P95)
- Cost from real token counts

**Requires:** Nothing. Fully offline.

### Command 3: Combined Analysis

```bash
peakinfer analyze ./src --events production.jsonl
```

Correlates static analysis with runtime data. Tells you:

- Do your events match your code? (drift detection)
- Which callsites have actual usage data?
- Providers in code but not in events (dead code?)
- Providers in events but not in code (where's that coming from?)

### Command 4: Pricing Data

```bash
peakinfer prices openai
```

Shows current pricing for API providers and GPU hosting. Cached locally.

### Command 5: Benchmarks

```bash
peakinfer benchmark llama-3-70b
```

Shows throughput/latency benchmarks from InferenceMAX data. Real numbers, not marketing.

### Command 6: Templates

```bash
peakinfer templates list
```

Community-curated optimization strategies. Read-only reference material.

---

## What PeakInfer Does NOT Do

Let me be direct about what's not in scope:

1. **No auto-optimization** — We don't rewrite your code
2. **No runtime profiling** — We don't instrument your app
3. **No telemetry to us** — Your code stays on your machine (sent to Anthropic for analysis, that's it)
4. **No model hosting** — We don't run inference
5. **No real-time monitoring** — This is a point-in-time analysis tool

We're not building an observability platform. We're building a **codebase intelligence tool**.

---

## The Output

### StackMap

A JSON file showing your inference topology:

```json
{
  "root": "/path/to/project",
  "summary": {
    "totalCallsites": 23,
    "providers": ["openai", "anthropic", "together"],
    "models": ["gpt-4o", "claude-3-5-sonnet", "llama-3-70b"]
  },
  "tree": [...]
}
```

### Pricing Summary

Estimated monthly cost range based on:
- Static token estimates (from code analysis)
- Or actual token counts (from runtime events)

### HTML Report

```bash
peakinfer analyze . --html --open
```

Opens a nice report in your browser. Good for sharing with the team.

---

## Technical Architecture

### How Static Analysis Works

1. **Scan** — Find all source files (Python, TypeScript, JavaScript, Go, Java)
2. **Analyze** — Send code to Claude with specialized prompts
3. **Classify** — Extract provider, model, patterns from Claude's response
4. **Build StackMap** — Organize callsites into a tree structure
5. **Calculate Pricing** — Apply current pricing data to estimates

### Agent Architecture

```
┌─────────────────────────────────────────┐
│            Agent (agent.ts)             │
├─────────────────────────────────────────┤
│  ExecutionPlan (Zod-validated)          │
│    ├── scan                             │
│    ├── analyze (Claude Code SDK)        │
│    ├── stackmap                         │
│    ├── pricing                          │
│    └── render                           │
├─────────────────────────────────────────┤
│  AgentCallbacks (UI decoupling)         │
│    onTaskStart, onTaskComplete, etc.    │
├─────────────────────────────────────────┤
│  ContextManager (filesystem persistence)│
│    .peakinfer/ directory                │
└─────────────────────────────────────────┘
```

Two-pass execution:
1. **Plan** — Generate task list
2. **Execute** — Run tasks, save results to disk

Use `--verbose` to see this in action.

### How Runtime Analysis Works

1. **Parse** — Read JSONL/JSON/CSV file
2. **Validate** — Check required fields (id, ts, provider, model, tokens, latency)
3. **Aggregate** — Group by provider, model, intent
4. **Calculate** — Stats, costs, distributions

No API calls. No network. Just local file processing.

---

## Data Formats

### Runtime Event Schema

```json
{
  "id": "evt_001",
  "ts": "2025-12-09T08:15:23Z",
  "provider": "openai",
  "model": "gpt-4o",
  "input_tokens": 4250,
  "output_tokens": 380,
  "latency_ms": 2340,
  "intent": "summarize"
}
```

Required: `id`, `ts`, `provider`, `model`, `input_tokens`, `output_tokens`, `latency_ms`

Optional: `intent`, `tenant`, `region`, `cost_usd`

Supported formats: JSONL, JSON (array), CSV

### Output Files

| File | Contents |
|------|----------|
| `peakinfer-stackmap.json` | Callsite tree and summary |
| `peakinfer-pricing.json` | Cost analysis |
| `peakinfer-report.html` | Interactive report (with --html) |

---

## What You Need

| Feature | API Key | Internet |
|---------|---------|----------|
| Static analysis | Yes (Anthropic) | Yes |
| Runtime telemetry | No | No |
| Cached results (`--cached`) | No | No |
| Pricing (`prices`) | No | For refresh only |
| Benchmarks (`benchmark`) | No | No |

---

## Detection Coverage

### Providers
OpenAI, Anthropic, Cohere, Google (Gemini/Vertex), Mistral, Groq, Together, Fireworks, Replicate, Perplexity, AWS Bedrock, Azure OpenAI

### Frameworks
LangChain, LlamaIndex, Haystack, DSPy, Semantic Kernel, AutoGen, CrewAI

### Self-Hosted
vLLM, SGLang, TensorRT-LLM, Ollama, llama.cpp, LocalAI, Text Generation Inference

### Patterns Detected
- Retry logic
- Batching
- Streaming
- Caching
- Router/model switching
- Fallback chains

---

## Benchmarks Data

From InferenceMAX (95% confidence) and vLLM benchmarks (85% confidence).

| Model | GPU | Throughput | Latency | TTFT |
|-------|-----|------------|---------|------|
| Llama 3 70B | H200 | 190 tok/s | 55 tok/s | 120ms |
| Llama 3 70B | H100-SXM | 155 tok/s | 48 tok/s | 120ms |
| Llama 3 70B | MI300X | 145 tok/s | 42 tok/s | 120ms |
| Llama 3 70B | A100-80GB | 82 tok/s | 36 tok/s | 120ms |

Models covered: Llama 3 (8B, 70B, 405B), Mistral (7B, 8x7B, 8x22B), Qwen 2.5 (7B, 32B, 72B), DeepSeek (V3, R1), Gemma 2 (9B, 27B)

---

## Design Principles

Following Julie Zhou:

1. **Content over chrome** — Show data, not decorations
2. **Hide empty states** — No "$0 - $0" when there's nothing
3. **Only show detected patterns** — Don't list what wasn't found
4. **Progressive disclosure** — Basic output by default, `--verbose` for details

---

## Success Criteria

1. Detects 90%+ of LLM callsites in supported languages
2. Runs in < 60 seconds for 10k LOC repos
3. Pricing estimates within 30% of actual (with runtime data)
4. Zero false positives in provider/model detection (we'd rather miss than misidentify)

---

## What's Next (Not In This Version)

- GitHub Action for PR comments
- Historical tracking
- Team dashboards
- Auto-remediation
- Custom model training

These are real possibilities, but they're not in v1. v1 is about getting the core analysis right.

---

## Installation

```bash
npm install -g @kalmantic/peakinfer
export ANTHROPIC_API_KEY=your-key
peakinfer analyze .
```

That's it.

---

## The Honest Take

PeakInfer does one thing: **tells you what LLM inference is happening in your code.**

It's not an observability platform. It's not an optimization engine. It's not going to auto-fix your architecture.

It's a flashlight. You point it at your codebase, and it shows you what's there.

If that's useful to you, great. If you need something else, this isn't it.

---

*"Simple, Lovable, Complete. Not Minimum Viable."*



# **PeakInfer Product Requirements Document (PRD) v0.96**

**A Strategic, Defensible, Integrated SLC Product Specification**

**Product:** PeakInfer
 **Organization:** Kalmantic AI Labs
 **Version:** 0.96
 **Date:** Dec 2025
 **Author:** Thiyagarajan Maruthavanan (Claire Vo framework)  
 **Revision Theme:** *SLC Analyzer \+ Integrated Defensibility (StackMap KG \+ Pricing Delta Engine)*

# **1\. Vision & North Star**

## **1.1 The Core Vision**

PeakInfer is the **Inference Intelligence Layer** that every AI engineering team will rely on to understand, map, evaluate, and optimize how large language model inference happens inside their codebases.

Where observability tools look at logs, and model-hosting vendors expose dashboards, PeakInfer does something **fundamentally different**:

**PeakInfer reconstructs the complete inference topology directly from code — producing a canonical StackMap of models, runtimes, dataflows, vendors, hardware, costs, and performance characteristics.**

This gives engineers:

* full visibility

* actionable diagnostics

* multi-provider comparisons

* pricing and latency deltas

* model/router alternatives

* hardware/runtime performance insights

* optimization suggestions

…all without requiring any telemetry, cloud accounts, or vendor lock-in.

---

## **1.2 Why This Matters**

Teams today are making *blind* decisions about:

* which models to call

* how often

* with what prompts

* on which infrastructure

* using which runtimes

* at what cost

* with what bottlenecks

* under what constraints

PeakInfer restores **strategic decision quality** to an increasingly chaotic ecosystem.

---

## **1.3 What PeakInfer Becomes**

Over time, PeakInfer becomes:

* the **Rosetta Stone** of inference

* the **definitive StackMap** for AI applications

* the **pricing & performance intelligence layer** over the entire industry

* the **optimization and route-planning engine**

* and, eventually, the team's **trusted local model for inference performance optimization**

---

# **2\. Jobs To Be Done (JTBD Framework)**

*(Claire Vo \+ Jason Cohen \+ Brian Balfour \+ Simon Wardley combined)*

## **2.1 Canonical Functional Job**

**“When I'm working with a codebase that uses LLMs, I need to understand exactly how inference happens (where, how often, through what vendor, and at what performance level) so I can make correct engineering and architectural decisions.”**

This is the job no one solves.

---

## **2.2 Claire Vo JTBD (Behavior, Friction, Outcome)**

### **Functional JTBD**

“Help me see all LLM usage in this codebase quickly, clearly, and accurately.”

### **Emotional JTBD**

“I want to feel confident I'm not missing anything slow, inefficient, or risky.”

### **Consumption JTBD**

“I want this to work with a single command.”

### **Success**

* zero ambiguity

* complete StackMap

* pricing and performance summarized cleanly

* actionable recommendations

* output I can paste into Slack/PRs

---

## **2.3 Jason Cohen JTBD (SLC, Founder-Product Fit)**

### **SLC Job**

“Give me something I cannot do today: instantly reconstruct inference usage from raw code.”

Today’s alternatives:

* grep

* reading files manually

* partial team knowledge

* guesswork

* dashboards that miss code paths

PeakInfer \= 10× improvement by:

* static \+ semantic analysis

* full inference topology reconstruction

* vendor/runtime/hardware comparison

* pricing deltas built-in

### **SLC Rules for v1**

* no cloud login

* no config

* no telemetry

* no dashboards

* no “platform”

Just:

`peakinfer analyze .`

---

## **2.4 Brian Balfour JTBD (Growth Loops)**

### **Growth JTBD**

“Help me communicate inference insights across the team so behaviors change.”

PeakInfer creates **viral loops**:

* StackMap shared in Slack → more installs

* GitHub Action comments → org adoption

* Pricing Delta diffs → planning discussions

* Template PRs → ecosystem growth

### **Acquisition JTBD**

“Help me evaluate new models/vendors instantly.”

Pricing Delta Engine \= continuous value.

---

## **2.5 Simon Wardley JTBD (Strategy, Evolution, Inertia)**

### **Wardley Strategic Job**

“I need situational awareness over the entire inference ecosystem.”

PeakInfer maps:

* codebase

* vendors

* runtimes

* hardware

* pricing

* evolution (custom → product → commodity)

This becomes the team’s **inference strategy compass**.

---

# **3\. Market Landscape & Competitive Mapping**

## **3.1 Competitors by Layer**

### **Model Vendors**

* OpenAI

* Anthropic

* Google

* Meta

* Mistral

* Cohere

### **Inference Hosts / APIs**

* Together

* Fireworks

* Baseten

* Modal

* Beam

* HuggingFace TGI

### **Serving Runtimes**

* vLLM

* SGLang

* TensorRT-LLM

* FasterTransformer

* Text Generation Inference

* Llama.cpp

* MLX (Apple)

### **Hardware Providers**

* NVIDIA

* Cerebras

* TPU (Google)

* Groq

* AMD ROCm

* AWS Inferentia

### **Code Search / Analysis Tools**

* Sourcegraph Cody

* CodeRabbit

* Cursor (partial)

### **Observability Tools**

* Arize

* Honeycomb

* LangSmith

* PromptLayer

* WhyLabs

**None** provide a full inference map reconstructed from code.

---

## **3.2 Strategic Positioning (Wardley Map Logic)**

### **What’s industrialising**

* model APIs

* inference hosts

* runtimes

* hardware

### **Where value is shifting**

To the **intelligence layer** that:

* compares models

* understands pricing

* predicts cost/performance

* guides routing

* analyses codebases

### **PeakInfer sits here →**

**Inference Intelligence Layer (not a runtime, not a vendor).**

This gives PeakInfer:

* no direct competition

* a monopoly on inference strategy

* durable defensibility

---

# **4\. Defensibility Model**

PeakInfer has three compounding moats:

## **4.1 StackMap Knowledge Graph (Code → KG)**

Extracted from:

* code  
* configs  
* requirements  
* SDK usage  
* decorators  
* routers  
* model calls  
* cloud clients  
* runtime parameters  
* environment variables

This KG becomes:

* canonical  
* vendor-agnostic  
* source of truth for all optimization  
* updated with every `analyze` run

**Data Compounding Model**

In SLC v1, StackMaps are stored locally only. Starting with v1 SaaS, users may opt-in to contribute anonymized StackMap topology data (provider/runtime/model patterns, no source code or prompts) to the shared KG. Enterprise customers with multiple repos automatically compound their internal KG. Over time, the aggregate KG becomes the industry's largest inference topology dataset — this is the primary defensibility flywheel.

---

## **4.2 Pricing Delta Engine**

Tracks:

* model pricing

* token pricing

* bandwidth pricing

* batch pricing

* hosting pricing

* GPU hourly pricing (NVIDIA, TPUs, Cerebras)

* spot vs on-demand

* vLLM \+ TensorRT efficiency deltas

* quantization impacts

* latency vs throughput tradeoffs

It becomes the **Bloomberg Terminal of inference**.

---

## **4.3 Community Template Graph (Future Phase)**

* validated optimization paths

* peer-reviewed templates

* vendor-agnostic patterns

* cross-layer migration playbooks

This is the “Stack Overflow of inference optimization.”

---

# **5\. Product Scope — SLC Roadmap**

## **5.1 SLC v1 (CLI-only)**

### **Deliverables:**

* codebase analyzer

* StackMap

* Pricing Delta Engine

* ASCII diagrams

* vendor/runtime/hardware comparisons

* offline, local-only

### **Must Ship:**

`peakinfer analyze .`

Output:

* inference inventory

* model usage

* runtimes

* vendor calls

* token counts (static estimates)

* prompt shapes

* latency estimates

* cost deltas

* alternatives

* hotspots

---

## **5.2 SLC v2 (GitHub Action)**

* PR comments with StackMap changes

* Pricing delta changes

* model change detection

* router regression detection

* suggestion diffs

---

## **5.3 v1 (Enterprise SaaS)**

* multi-repo history

* trend dashboards

* team view

* CI/CD integrations

* SOC2

* RBAC

* billing

* API endpoints

---

## **5.4 v2 (Runtime-aware optimization)**

* dynamic profiling

* execution traces

* traffic sampling

* runtime diffs

---

## **5.5 v3 (Local Model for Inference Intelligence)**

PeakInfer trains:

* a specialized model

* domain: inference economics \+ code analysis

* purpose: instant optimization suggestions

This is not needed early.  
 It becomes the **crown jewel** after adoption.

---

# **6\. Detailed Requirements**

## **6.1 Functional Requirements (SLC v1)**

### **Analyzer**

* parse code in TS/Python/Go/Java

* detect LLM calls

* detect routing logic

* detect retry patterns

* detect chunking/pagination

* detect embeddings usage

* identify model names

* infer token shapes

* analyze prompt templates

### **StackMap Generator**

ASCII diagram showing:

`Codebase`  
     `|`  
     `+--> Model Calls ----------+`  
     `|                          |`  
     `|                      Vendors`  
     `|                (OpenAI, Anthropic, etc.)`  
     `|`  
     `+--> Runtimes (vLLM, TensorRT, Llama.cpp)`  
     `|`  
     `+--> Hardware (A100, H100, L40S, TPUs, Cerebras)`

### **Pricing Delta Engine**

* fetch latest public pricing

* map to StackMap nodes

* calculate:

  * cost per call

  * cost per user

  * cost per endpoint

  * capital vs operational cost

  * GPU hourly deltas

  * hosting vs self-hosted tradeoffs

---

## **6.2 Non-Functional Requirements**

**Runtime Dependencies**

* Requires Claude Code SDK for semantic code analysis  
* Anthropic API key required  
* Internet connection required for analysis \+ pricing updates

**Privacy Model**

* Code is sent to Anthropic API as context for analysis  
* No telemetry to Kalmantic servers  
* No data retained beyond API session (subject to Anthropic's data policy)  
* StackMap outputs stored locally only

**Performance**

* Parse 10k LOC repo in \< 60 seconds  
* Memory \< 500MB

**Offline Capability**

* Previously generated StackMaps viewable offline  
* Pricing data cached locally (updated weekly when online)  
* No analysis capability without API access


---

# **7\. Architecture (ASCII)**

## **7.1 High-Level**

`+------------------------+`  
`|     PeakInfer CLI      |`  
`+----------+-------------+`  
           `|`  
           `v`  
`+------------------------+`  
`|   Static Code Parser   |`  
`+----------+-------------+`  
           `|`  
           `v`  
`+------------------------+`  
`|   Inference Extractor  |`  
`+----------+-------------+`  
           `|`  
           `v`  
`+------------------------+`  
`| StackMap Builder (KG)  |`  
`+----------+-------------+`  
           `|`  
           `v`  
`+------------------------+`  
`| Pricing Delta Engine   |`  
`+------------------------+`

---

# **8\. Data Models**

## **8.1 StackMap Node**

`node_id`  
`type (model | runtime | vendor | hardware | prompt | callsite)`  
`name`  
`location`  
`connections[]`  
`metrics{}`

## **8.2 Performance & Pricing Schema**

### **Performance Metrics (Primary)**
`throughput_tokens_per_sec`   — System capacity (tok/s/GPU)
`latency_ttft_ms`             — Time to first token
`latency_tps_per_user`        — Per-user generation speed (tok/s/user)
`max_concurrent_requests`     — Batch capacity

### **Cost Metrics (Secondary)**
`vendor`
`model`
`input_token_price`
`output_token_price`
`gpu_hourly_cost`

### **Deployment Comparison**
`deployment_type`             — hosted_api | platform | self_hosted | local
`implementation_effort`       — none | low | medium | high

---

# **9\. CLI Specification (Julie Zhuo Design Principles)**

### **Principles**

* invisible UI

* content-first

* fast, clear, minimal

* all states: empty, loading, success, error

* high contrast

* logical keyboard flow

### **Commands**

`peakinfer analyze .`
`peakinfer stackmap`
`peakinfer benchmark [provider]`    — Show throughput/latency benchmarks
`peakinfer recommend`              — Performance optimization recommendations
`peakinfer diff old.json new.json`

## **9.1 First-Run Experience & State Handling**

### **Empty State (No LLM calls detected)**

```
$ peakinfer analyze .

PeakInfer v0.96

Scanned: 847 files (12,340 LOC)
Languages: Python, TypeScript

No LLM inference calls detected.

Checked for:
  • OpenAI SDK         not found
  • Anthropic SDK      not found
  • LangChain          not found
  • LlamaIndex         not found
  • vLLM               not found
  • Direct HTTP to inference APIs   not found

If you expected LLM usage, check:
  → Dynamic imports or runtime-loaded modules
  → Environment-gated code paths
  → Vendored or renamed SDKs

Nothing to map. Exiting.
```

### **Loading State (Analysis in progress)**

```
$ peakinfer analyze .

PeakInfer v0.96

Connecting to Claude Code SDK...    ✓
Scanning codebase...                ████████░░  82%
  └─ src/agents/                    analyzing
```

### **Success State (LLM calls found)**

```
$ peakinfer analyze .

PeakInfer v0.96

Scanned: 847 files (12,340 LOC)
Languages: Python, TypeScript

Found 23 inference callsites across 8 files.

┌─────────────────────────────────────────────────┐
│                   STACKMAP                      │
├─────────────────────────────────────────────────┤
│  Codebase                                       │
│     │                                           │
│     ├──► OpenAI (14 calls)                      │
│     │       └─ gpt-4o (9), gpt-4o-mini (5)      │
│     │                                           │
│     ├──► Anthropic (7 calls)                    │
│     │       └─ claude-sonnet-4-20250514 (7)            │
│     │                                           │
│     └──► Together (2 calls)                     │
│             └─ llama-3-70b (2)                  │
└─────────────────────────────────────────────────┘

Performance Summary:
  ├─ OpenAI gpt-4o:     ~70 tok/s, 5.5s latency
  ├─ Anthropic claude:  ~30 tok/s, 7.0s latency
  └─ Together llama:    ~150 tok/s, 2.0s latency

Optimization Opportunities:
  • src/agents/summarizer.py:47    gpt-4o → Groq llama-70b = 3x faster
  • src/pipelines/extract.py:112  unbatched → batch = 40% throughput gain

Output saved:
  → stackmap.json
  → peakinfer-benchmark.json

Run `peakinfer benchmark` for detailed throughput/latency comparison.
Run `peakinfer recommend` for optimization recommendations.
```

### **Error State (API failure)**

```
$ peakinfer analyze .

PeakInfer v0.96

Connecting to Claude Code SDK...    ✗

Error: Unable to reach Anthropic API.

Possible causes:
  → No internet connection
  → ANTHROPIC_API_KEY not set or invalid
  → API rate limit exceeded

Set your API key:
  export ANTHROPIC_API_KEY=sk-ant-...

Cached StackMaps remain available:
  → peakinfer stackmap --cached
```

### **Partial State (Some files unparseable)**

```
$ peakinfer analyze .

PeakInfer v0.96

Scanned: 847 files (12,340 LOC)
Skipped: 3 files (parse errors)
  └─ src/legacy/old_api.py        syntax error line 204
  └─ src/experiments/test.go      unsupported Go generics
  └─ vendor/external.java         binary/obfuscated

Found 23 inference callsites across 8 files.

[... success output continues ...]

Warning: Skipped files may contain undetected LLM calls.
```

### **Success State (Full StackMap)**

```
$ peakinfer analyze .

PeakInfer v0.96

Scanned: 847 files (12,340 LOC)
Languages: Python, TypeScript

Found 23 inference callsites across 8 files.

┌─────────────────────────────────────────────────────────────────────┐
│                            STACKMAP                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  CALLSITES (23)                                                     │
│     │                                                               │
│     ├──► src/agents/summarizer.py:47         gpt-4o, streaming      │
│     ├──► src/agents/summarizer.py:89         gpt-4o, batched        │
│     ├──► src/pipelines/extract.py:112        claude-sonnet-4-20250514        │
│     ├──► src/pipelines/extract.py:156        claude-sonnet-4-20250514        │
│     ├──► src/routing/classifier.py:34        llama-3-70b            │
│     └──► ... 18 more (see stackmap.json)                            │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  MODELS (4)                                                         │
│     │                                                               │
│     ├──► gpt-4o                    14 calls   ~2.4M tok/mo          │
│     ├──► gpt-4o-mini                5 calls   ~180K tok/mo          │
│     ├──► claude-sonnet-4-20250514              7 calls   ~890K tok/mo          │
│     └──► llama-3-70b                2 calls   ~45K tok/mo           │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  VENDORS / PROVIDERS (3)                                            │
│     │                                                               │
│     ├──► OpenAI API                19 calls   direct SDK            │
│     ├──► Anthropic API              7 calls   direct SDK            │
│     └──► Together API               2 calls   via LangChain         │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  RUNTIMES (2 detected, 1 inferred)                                  │
│     │                                                               │
│     ├──► vLLM 0.4.1               Together endpoint (llama-3-70b)   │
│     ├──► TensorRT-LLM             inferred: Anthropic backend       │
│     └──► unknown                  OpenAI (proprietary)              │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  HARDWARE (inferred from providers + runtime config)                │
│     │                                                               │
│     ├──► NVIDIA H100              Together (llama-3-70b)            │
│     ├──► NVIDIA H100 / A100       Anthropic (claude-sonnet-4-20250514)        │
│     ├──► unknown                  OpenAI (proprietary)              │
│     │                                                               │
│     ├──► Self-hosted detection:                                     │
│     │      └─ None found (no local vLLM/SGLang/llama.cpp configs)   │
│     │                                                               │
│     └──► GPU env vars:                                              │
│            └─ CUDA_VISIBLE_DEVICES not set                          │
│            └─ No terraform GPU resources detected                   │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  PATTERNS DETECTED                                                  │
│     │                                                               │
│     ├──► Retry logic              ✓  src/utils/llm_client.py:23     │
│     ├──► Batching                 ✓  src/agents/summarizer.py:89    │
│     ├──► Streaming                ✓  src/agents/summarizer.py:47    │
│     ├──► Caching                  ✗  not detected                   │
│     ├──► Router / model switching ✗  not detected                   │
│     └──► Fallback chain           ✗  not detected                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                      PERFORMANCE SUMMARY                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Current Performance Baseline:                                      │
│                                                                     │
│  By vendor (throughput / latency):                                  │
│     ├──► OpenAI          ~70 tok/s,   5.5s latency    (14 calls)    │
│     ├──► Anthropic       ~30 tok/s,   7.0s latency    (7 calls)     │
│     └──► Together        ~150 tok/s,  2.0s latency    (2 calls)     │
│                                                                     │
│  By model:                                                          │
│     ├──► gpt-4o          ~70 tok/s,   TTFT: 350ms                   │
│     ├──► claude-sonnet-4 ~30 tok/s,   TTFT: 500ms                   │
│     ├──► gpt-4o-mini     ~45 tok/s,   TTFT: 280ms                   │
│     └──► llama-3-70b     ~150 tok/s,  TTFT: 180ms                   │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  FASTER ALTERNATIVES (same capability, better performance)          │
│     │                                                               │
│     ├──► Groq llama-3.3-70b         ~300 tok/s   (4x faster)        │
│     ├──► Cerebras llama-3.3-70b     ~400 tok/s   (5x faster)        │
│     ├──► Fireworks llama-3.1-70b    ~150 tok/s   (2x faster)        │
│     │                                                               │
│     └──► Self-hosted (H100 + vLLM)  ~125 tok/s   (best TCO)         │
│             └─ *Requires infrastructure setup                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                     PERFORMANCE HOTSPOTS                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ⚠  src/agents/summarizer.py:47                                     │
│     └─ gpt-4o streaming, ~70 tok/s, 5.5s avg latency                │
│     └─ Suggestion: Groq llama-70b = 300 tok/s (4x faster)           │
│                                                                     │
│  ⚠  src/pipelines/extract.py:112                                    │
│     └─ claude-sonnet-4, unbatched, sequential calls                 │
│     └─ Suggestion: enable batching = 40% throughput improvement     │
│                                                                     │
│  ⚠  No caching detected                                             │
│     └─ Suggestion: add semantic cache to reduce redundant calls     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

Output saved:
  → stackmap.json           (full graph, machine-readable)
  → peakinfer-benchmark.json (performance data + alternatives)

Run `peakinfer benchmark` for detailed throughput/latency comparison.
Run `peakinfer recommend` for optimization recommendations.
Run `peakinfer diff old.json new.json` to compare changes.
```

---

# **10\. GitHub Action Specification**

* runs on PR

* comments a diff of inference usage

* warns on latency-increasing model changes

* shows throughput/latency impact

* warns on performance regressions (optional flag)

---

# **11\. Enterprise SaaS Specification**

(Phased; out of SLC)

* team dashboards

* performance monitoring (throughput, latency trends)

* versioned StackMaps

* anomaly detection

* routing suggestions

* admin \+ RBAC

---

# **12\. Integrations (vLLM, SGLang, TensorRT, Llama.cpp, NVIDIA, TPUs, Cerebras)**

PeakInfer must track:

* runtime capabilities

* quantization support

* memory usage

* throughput

* hardware requirements

### **Hardware Comparison Table**

* NVIDIA A100 / H100 / L40S

* TPU v3 / v4

* Cerebras WSE

* Groq LPU

* AMD MI300

PeakInfer produces:

* cost per token

* throughput per dollar

* latency characteristics

* suitability for workloads

---

# **13\. Performance Benchmarking Engine**

### **The Three Pillars of Inference Intelligence**

PeakInfer measures and compares three fundamental metrics:

**Pillar 1: Throughput (tok/s/GPU)** — System capacity
- Aggregate tokens generated per second per GPU
- Optimal batch size for maximum throughput
- GPU utilization efficiency

**Pillar 2: Latency (tok/s/user)** — User experience
- Time to first token (TTFT)
- Tokens per second per user
- P50/P95/P99 latency

**Pillar 3: Cost ($/M tokens)** — Economics (secondary)
- Normalized cost across deployment types
- TCO for self-hosted options

### **Data Sources**

Benchmark data is assembled from three tiers:

1. **Public benchmarks** — InferenceMAX, vLLM benchmarks, TGI benchmarks, and vendor-published throughput data. Updated weekly.
2. **Community contributions** — Users may submit benchmark results, regional variations, or newly supported models via GitHub PR to the `peakinfer-benchmarks` repository.
3. **Estimation engine** — Model size + GPU specs → throughput estimates (labeled with confidence).

### **Must track:**

* throughput (tok/s/GPU)
* latency (TTFT, tok/s/user)
* optimal batch sizes
* GPU memory requirements
* runtime efficiency (vLLM, TGI, TensorRT-LLM)
* hardware accelerators (Groq LPU, Cerebras WSE)
* cost per token (secondary)

### **Output:**

* throughput comparisons across providers
* latency benchmarks
* deployment recommendations (fastest, most efficient)
* "peak performance for your workload"

---

# **14\. Acceptance Criteria**

* 90%+ LLM callsite detection
* StackMap accuracy > 95%
* Benchmark data updated weekly
* Throughput estimates within 20% of actual benchmarks
* Latency estimates within 25% of actual measurements
* CLI runs in < 60 seconds
* No runtime errors across supported languages (TS, Python, Go, Java)
* Outputs must be self-explanatory


---

# **15\. Risks & Mitigations**

### **Risk: Ecosystem fragmentation**

Mitigation: vendor-agnostic KG.

### **Risk: Benchmark data staleness**

Mitigation: weekly benchmark sync from InferenceMAX, vLLM, and public sources.

### **Risk: Throughput estimate accuracy**

Mitigation: Label confidence levels; use conservative estimates; validate against real benchmarks.

### **Risk: Code complexity**

Mitigation: multi-pass static + semantic analysis.

### **Risk: Vendor lock-in attempts**

Mitigation: peak inference intelligence sits above them.

---

# **16\. Roadmap**

## **SLC v1 — Analyzer & StackMap (NO model, NO optimization engine)**

* Local-only CLI

* Codebase Analyzer

* StackMap (KG)

* Pricing Delta Engine

* ASCII Diagrams

* No runtime profiling

* No telemetry

* Uses **Claude Code SDK exclusively**

* Zero ML training, zero model hosting

This is the core of PeakInfer’s SLC .

---

## **SLC v2 — GitHub Action (Still NO model)**

* PR Comments (StackMap change, cost deltas)

* Routing regression alerts

* Team workflow integrations

* Zero inference from our side

* Still purely **Claude Code SDK-based**

Still no proprietary model.

---

## **v1 – SaaS Read-Only View (Post-SLC, Still NO model)**

* Historical StackMaps

* Multi-repo comparisons

* Weekly Pricing Deltas

* Team dashboards

* Policy checks

* No auto-optimization

* No model training

Still purely stateless, intelligence-over-code, powered by Claude Code.

---

## **v2 – Optimization Intelligence Layer (Still NO proprietary model)**

* Instrumentation-aware suggestions

* Runtime diffs (vLLM, SGLang, TensorRT)

* Vendor-level diffs (Fireworks, Baseten, Together, etc.)

* Hardware-level diffs (NVIDIA, TPUs, Cerebras)

* Hybrid: static KG \+ optional profiling

Still powered by Claude for reasoning, no model training.

---

## **❗ v3 – Proprietary Model (Deferred Until Massive Data Accumulation)**

### **When does PeakInfer build its own model?**

**Only AFTER:**

1. Thousands of StackMaps collected (KG maturity)

2. Pricing Delta Engine has multi-year data

3. Template ecosystem has factual optimization results

4. Teams rely on PeakInfer as the inference intelligence layer

5. PeakInfer has PMF, top-down and bottom-up adoption

6. Kalmantic has resources to fund a multi-million-dollar training run

7. Ecosystem has commoditized to the point that a specialized model creates an edge

### **What will the model do?**

A small, domain-specialized model:

* inference economics

* model selection

* vendor/runtime/hardware diff prediction

* code → inference usage reasoning

* optimization explanation

But crucially:

### **Not needed for SLC. Not needed for v1. Not needed for v2.**

This is a **post-adoption** and **post-defensibility flywheel** phase.

---

# **17\. Appendices**

## **Appendix A** 

## **17.1 Julie Zhuo Design Rules**

* clarity over cleverness

* breathing room

* hierarchy through typography

* invisible UI

* focus on progress, not the interface

## **17.2 Jason Cohen SLC Principles**

* ship smallest lovably-complete version

* single command

* no platform dependencies

## **17.3 Claire Vo Product Rules**

* JTBD-first

* remove friction

* optimize user behavior paths

## **17.4 Brian Balfour Growth Loops**

* sharing → adoption

* pricing deltas → repeat engagement

* StackMap diffs → team adoption

## **17.5 Simon Wardley Strategy**

* position at intelligence layer

* avoid competing with vendors

* ride industrialisation of inference

Here's the complete, updated taxonomy section for the PRD:

---

# **Appendix B: PeakInfer Detection Taxonomy (Complete)**

This appendix defines all players, patterns, and components PeakInfer must detect and map into the StackMap. It serves as the canonical reference for the Codebase Analyzer and Pricing Delta Engine.

---

## **1\. MODEL PROVIDERS (First-Party APIs)**

| Provider | Models to Detect |
| ----- | ----- |
| **OpenAI** | gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-4, gpt-3.5-turbo, o1, o1-mini, o1-pro, o3, o3-mini, o4-mini, dall-e-3, whisper, tts-1, text-embedding-3-large, text-embedding-3-small |
| **Anthropic** | claude-sonnet-4-20250514, claude-opus-4-20250514, claude-3.5-sonnet, claude-3.5-haiku, claude-3-opus, claude-3-sonnet, claude-3-haiku |
| **Google** | gemini-2.0-flash, gemini-2.5-pro, gemini-1.5-pro, gemini-1.5-flash, gemma-2, gemma-3, palm-2, imagen-3 |
| **Meta** | llama-4-scout, llama-4-maverick, llama-3.3-70b, llama-3.2-90b-vision, llama-3.2-11b-vision, llama-3.2-3b, llama-3.2-1b, llama-3.1-405b, llama-3.1-70b, llama-3.1-8b, code-llama-70b |
| **Mistral** | mistral-large-2, mistral-medium, mistral-small, mistral-nemo, codestral, mixtral-8x22b, mixtral-8x7b, mistral-7b |
| **Cohere** | command-r-plus, command-r, command, embed-v3, rerank-v3 |
| **AI21** | jamba-1.5-large, jamba-1.5-mini, jurassic-2-ultra, jurassic-2-mid |
| **Amazon** | titan-text-express, titan-text-lite, titan-embed, titan-image, nova-pro, nova-lite, nova-micro |
| **Alibaba** | qwen-2.5-72b, qwen-2.5-32b, qwen-2.5-coder, qwen-3-235b, qwen-vl-max |
| **DeepSeek** | deepseek-v3, deepseek-r1, deepseek-coder-v2 |
| **xAI** | grok-2, grok-2-mini, grok-3 |
| **Inflection** | inflection-3 |
| **Reka** | reka-core, reka-flash, reka-edge |
| **Zhipu** | glm-4, glm-4v |
| **Baidu** | ernie-4.0, ernie-bot |
| **01.AI** | yi-large, yi-medium, yi-vision |

---

## **2\. INFERENCE HOSTS / NEOCLOUDS**

| Provider | Type | Detection Signals |
| ----- | ----- | ----- |
| **Together AI** | Neocloud | `together` SDK, `api.together.xyz` |
| **Fireworks AI** | Neocloud | `fireworks` SDK, `api.fireworks.ai` |
| **Baseten** | Neocloud | `baseten` SDK, Truss configs, `app.baseten.co` |
| **Modal** | Serverless | `modal` decorator, `@stub.function`, `.modal.toml` |
| **Replicate** | Serverless | `replicate` SDK, `api.replicate.com` |
| **Anyscale** | Neocloud | `anyscale` SDK, Ray Serve configs |
| **Beam** | Serverless | `beam` SDK, `.beam.yaml` |
| **Banana** | Serverless | `banana_dev` SDK |
| **Lepton AI** | Neocloud | `leptonai` SDK |
| **OctoAI** | Neocloud | `octoai` SDK, `octoai.cloud` |
| **Perplexity** | API | `perplexity` SDK, `api.perplexity.ai` |
| **Groq Cloud** | API | `groq` SDK, `api.groq.com` |
| **Cerebras Cloud** | API | `cerebras` SDK |
| **SambaNova Cloud** | API | `sambanova` SDK |
| **DeepInfra** | Neocloud | `deepinfra` SDK, `api.deepinfra.com` |
| **Novita AI** | Neocloud | `novita` SDK |
| **Fal.ai** | Serverless | `fal` SDK, `fal.ai` |

---

## **3\. GPU CLOUD / NEOCLOUD PROVIDERS**

| Provider | Type | Detection Signals |
| ----- | ----- | ----- |
| **CoreWeave** | Neocloud | Kubernetes configs, CoreWeave API, `coreweave.com` |
| **Lambda Labs** | Neocloud | Lambda cloud configs, `lambdalabs.com` |
| **RunPod** | Neocloud/Serverless | `runpod` SDK, RunPod endpoints |
| **Vast.ai** | Marketplace | `vastai` CLI, spot GPU configs |
| **Paperspace** | Neocloud | Paperspace/Gradient configs |
| **Nebius** | Neocloud | Nebius configs, EU data centers |
| **Crusoe** | Neocloud | Crusoe cloud configs |
| **Hyperstack** | Neocloud | Hyperstack configs |
| **Genesis Cloud** | Neocloud | Genesis configs |
| **Vultr Cloud GPU** | Neocloud | Vultr GPU configs |
| **DigitalOcean GPU** | Neocloud | DO GPU Droplets, Gradient |
| **Akash Network** | Decentralized | `akash` deployment manifests |
| **io.net** | Decentralized | io.net configs |
| **NVIDIA DGX Cloud** | Managed | DGX Cloud configs |
| **Northflank** | Platform | Northflank GPU configs |
| **Fluidstack** | Neocloud | Fluidstack configs |
| **Jarvis Labs** | Neocloud | Jarvis configs |
| **Shadeform** | Aggregator | Shadeform configs |

---

## **4\. HYPERSCALER ML PLATFORMS**

| Provider | Service | Detection Signals |
| ----- | ----- | ----- |
| **AWS** | Bedrock | `boto3.client('bedrock-runtime')`, `bedrock` imports |
| **AWS** | SageMaker | `sagemaker` SDK, endpoint configs |
| **AWS** | Inferentia | `neuron` SDK, `.neuron` configs, `inf2` instances |
| **AWS** | Trainium | `trn1` instance types |
| **GCP** | Vertex AI | `google.cloud.aiplatform`, `vertexai` SDK |
| **GCP** | Cloud TPU | `tpu` configs, `TPU_NAME` env vars |
| **Azure** | Azure OpenAI | `azure.identity`, `openai.api_type = "azure"` |
| **Azure** | Azure ML | `azureml` SDK, endpoint configs |
| **Databricks** | Foundation Models | `databricks` SDK, `/serving-endpoints/` |
| **Databricks** | Mosaic ML | `mosaicml` SDK |
| **Snowflake** | Cortex | `snowflake.cortex`, Snowpark ML |
| **Oracle** | OCI AI | OCI GenAI configs |
| **IBM** | watsonx | `ibm_watson` SDK |

---

## **5\. SERVING RUNTIMES**

| Runtime | Detection Signals |
| ----- | ----- |
| **vLLM** | `vllm` imports, `LLM()` class, `SamplingParams`, `--served-model-name` |
| **SGLang** | `sglang` imports, `@function` decorator, `RuntimeEndpoint` |
| **TensorRT-LLM** | `tensorrt_llm` imports, `.engine` files, `trtllm-build` |
| **Text Generation Inference (TGI)** | `text_generation` SDK, HF TGI endpoints |
| **llama.cpp** | `llama_cpp` imports, `Llama()` class, `.gguf` files |
| **Ollama** | `ollama` SDK, `localhost:11434`, `ollama run` |
| **LMStudio** | `localhost:1234`, LMStudio API patterns |
| **MLX** | `mlx` imports, `mlx_lm`, Apple Silicon configs |
| **ExLlamaV2** | `exllamav2` imports, `.exl2` files |
| **GGML** | `.ggml` files, `ggml` imports |
| **CTranslate2** | `ctranslate2` imports, CT2 model dirs |
| **FasterTransformer** | `fastertransformer` configs, FT model dirs |
| **MLC LLM** | `mlc_llm` imports, `mlc_chat_config.json` |
| **OpenLLM** | `openllm` CLI, BentoML configs |
| **RayLLM** | `ray.serve`, `RayLLMDeployment` |
| **Triton Inference Server** | `tritonclient`, `model_repository/` |
| **LocalAI** | `localhost:8080`, LocalAI patterns |
| **LMDeploy** | `lmdeploy` imports |
| **PowerInfer** | `powerinfer` imports |
| **llm-d** | Kubernetes-native vLLM orchestration |

---

## **6\. HARDWARE**

### **6.1 NVIDIA GPUs**

| GPU | Memory | Generation | Use Case |
| ----- | ----- | ----- | ----- |
| B200 | 192GB HBM3e | Blackwell | Frontier training/inference |
| GB200 NVL72 | 72x chips | Blackwell | Supercomputing |
| H200 | 141GB HBM3e | Hopper | Training/inference |
| H100 SXM | 80GB HBM3 | Hopper | Training, high-throughput inference |
| H100 PCIe | 80GB HBM3 | Hopper | Inference |
| GH200 | 96GB HBM3 \+ 480GB | Grace Hopper | Unified memory superchip |
| A100 SXM | 80GB HBM2e | Ampere | Training, inference |
| A100 PCIe | 40GB/80GB | Ampere | Inference |
| L40S | 48GB GDDR6 | Ada | Inference, video |
| L40 | 48GB GDDR6 | Ada | Inference |
| L4 | 24GB GDDR6 | Ada | Light inference |
| A10G | 24GB GDDR6 | Ampere | AWS inference |
| T4 | 16GB GDDR6 | Turing | Budget inference |
| RTX 4090 | 24GB GDDR6X | Ada | Consumer/prosumer |
| RTX 6000 Ada | 48GB GDDR6 | Ada | Workstation |
| RTX PRO 6000 | 96GB GDDR7 | Blackwell | Workstation |

### **6.2 AMD GPUs**

| GPU | Memory | Use Case |
| ----- | ----- | ----- |
| MI300X | 192GB HBM3 | Training, inference |
| MI300A | 128GB unified | APU training |
| MI325X | 256GB HBM3e | Next-gen training |
| MI250X | 128GB HBM2e | Training |
| MI210 | 64GB HBM2e | Inference |

### **6.3 Accelerators / ASICs**

| Hardware | Provider | Detection Signals |
| ----- | ----- | ----- |
| TPU v5p | Google | `TPU_NAME`, `jax.devices('tpu')` |
| TPU v5e | Google | Vertex AI configs |
| TPU v4 | Google | GCP TPU configs |
| TPU v6 | Google | Latest generation |
| Inferentia2 | AWS | `neuronx`, `inf2` instance types |
| Trainium | AWS | `trn1` instance types |
| Trainium2 | AWS | `trn2` instance types |
| Gaudi2 | Intel | `habana`, `dl1` instance types |
| Gaudi3 | Intel | `habana` SDK |
| LPU | Groq | `groq` SDK, Groq API |
| WSE-3 | Cerebras | `cerebras` SDK |
| SN40L | SambaNova | `sambanova` SDK |
| IPU | Graphcore | `poptorch`, IPU configs |
| Sohu | Etched | Transformer-specific ASIC |
| Corsair/Pavehawk | d-Matrix | Memory-centric chip |
| RNGD | FuriosaAI | Korean inference chip |
| Slim 240 | Untether AI | RISC-V inference |
| MTIA | Meta | Internal only |

### **6.4 Detection Signals for Hardware**

```
Environment variables:
  CUDA_VISIBLE_DEVICES
  NVIDIA_VISIBLE_DEVICES
  TPU_NAME
  NEURON_RT_NUM_CORES
  HABANA_VISIBLE_DEVICES
  ROCR_VISIBLE_DEVICES

Config files:
  terraform (.tf with gpu_type, accelerator_type)
  docker-compose (deploy.resources.reservations.devices)
  kubernetes (nvidia.com/gpu, cloud.google.com/tpu)
  ray (num_gpus, accelerator_type)
  modal (gpu="H100", gpu="A100")

Cloud instance types:
  AWS: p5.48xlarge (H100), p4d.24xlarge (A100), inf2.xlarge, trn1.32xlarge
  GCP: a3-highgpu-8g (H100), a2-highgpu-8g (A100), ct5lp-hightpu-8t
  Azure: ND96isr_H100_v5, NC96ads_A100_v4
```

---

## **7\. ORCHESTRATION FRAMEWORKS**

| Framework | Detection Signals |
| ----- | ----- |
| **LangChain** | `langchain` imports, `ChatOpenAI`, `LLMChain`, `LCEL` |
| **LlamaIndex** | `llama_index` imports, `VectorStoreIndex`, `ServiceContext` |
| **Haystack** | `haystack` imports, `Pipeline`, `PromptNode` |
| **Semantic Kernel** | `semantic_kernel` imports, `Kernel`, `SKFunction` |
| **AutoGen** | `autogen` imports, `AssistantAgent`, `UserProxyAgent` |
| **CrewAI** | `crewai` imports, `Agent`, `Crew`, `Task` |
| **DSPy** | `dspy` imports, `dspy.Predict`, `dspy.ChainOfThought` |
| **Guidance** | `guidance` imports, `@guidance` decorator |
| **LMQL** | `lmql` imports, `@lmql.query` |
| **Outlines** | `outlines` imports, structured generation |
| **Instructor** | `instructor` imports, Pydantic extraction |
| **Marvin** | `marvin` imports, `@ai_fn` |
| **Mirascope** | `mirascope` imports |
| **LiteLLM** | `litellm` imports, unified API proxy |
| **AI SDK (Vercel)** | `ai` imports, `useChat`, `streamText` |
| **Pydantic AI** | `pydantic_ai` imports |
| **ControlFlow** | `controlflow` imports |
| **Phidata** | `phidata` imports |

---

## **8\. AGENTIC AI / TOOL USE**

| Framework | Detection Signals |
| ----- | ----- |
| **MCP (Model Context Protocol)** | `mcp` imports, MCP server configs |
| **OpenAI Function Calling** | `tools` parameter, `function_call` |
| **Anthropic Tool Use** | `tools` in messages API |
| **LangGraph** | `langgraph` imports, graph workflows |
| **AutoGPT** | `autogpt` configs |
| **BabyAGI** | `babyagi` imports |
| **AgentGPT** | AgentGPT configs |
| **SuperAGI** | `superagi` imports |
| **OpenDevin** | OpenDevin configs |
| **SWE-agent** | SWE-agent configs |
| **Composio** | `composio` SDK (tool integrations) |
| **Toolhouse** | `toolhouse` SDK |
| **E2B** | `e2b` SDK (code execution) |
| **Browserbase** | `browserbase` SDK (browser automation) |
| **Firecrawl** | `firecrawl` SDK (web scraping) |
| **Exa** | `exa` SDK (neural search) |

---

## **9\. INFERENCE PATTERNS**

### **9.1 Batching**

| Pattern | Detection Signals |
| ----- | ----- |
| No batching | Single `completion()` calls in loops |
| Client-side batching | `asyncio.gather()`, `batch` parameter |
| Server-side batching | vLLM `--max-batch-size`, TGI batching config |
| Continuous batching | vLLM default, iteration-level scheduling |
| Dynamic batching | Triton `dynamic_batching` config |
| Offline batch API | OpenAI `/v1/batches`, Anthropic Message Batches |

### **9.2 Streaming**

| Pattern | Detection Signals |
| ----- | ----- |
| No streaming | `stream=False`, no async iteration |
| SSE streaming | `stream=True`, `for chunk in response` |
| WebSocket streaming | `websockets`, persistent connection |
| Chunked transfer | `Transfer-Encoding: chunked` |

### **9.3 Caching**

| Pattern | Detection Signals |
| ----- | ----- |
| No caching | Direct API calls |
| Exact match cache | Redis/Memcached with prompt hash |
| Semantic cache | `gptcache`, embedding similarity |
| KV cache reuse | vLLM prefix caching, `--enable-prefix-caching` |
| Prompt caching | Anthropic `cache_control`, OpenAI cached prompts |
| Disk cache | `diskcache`, local file caching |
| LMCache | `lmcache` for distributed KV sharing |

### **9.4 Routing / Model Selection**

| Pattern | Detection Signals |
| ----- | ----- |
| Static routing | Hardcoded model per endpoint |
| Cost-based routing | Model selection by `max_tokens` or complexity |
| Latency-based routing | Fallback chains, timeout handling |
| Quality-based routing | Router models, classifier-based dispatch |
| A/B routing | Feature flags, percentage splits |
| Cascade routing | Try cheap → fallback to expensive |
| Martian | `martian` imports |
| RouteLLM | `routellm` imports |
| Unify router | `unify` SDK |
| OpenRouter | `openrouter.ai` endpoint |

### **9.5 Retry / Fallback**

| Pattern | Detection Signals |
| ----- | ----- |
| No retry | Single call, exception bubbles |
| Exponential backoff | `tenacity`, `backoff`, `retry` decorators |
| Fallback chain | Try provider A → catch → provider B |
| Circuit breaker | `circuitbreaker`, failure threshold logic |
| Hedged requests | Parallel calls, first-response wins |

### **9.6 Context Management**

| Pattern | Detection Signals |
| ----- | ----- |
| Fixed context | Static `max_tokens` |
| Sliding window | Truncation logic, token counting |
| Summarization | Recursive summarization for long context |
| RAG | Vector store retrieval, `similarity_search` |
| Map-reduce | Chunk processing, aggregation |
| Hierarchical | Tree-structured context compression |

---

## **10\. MODEL ARCHITECTURES**

| Architecture | Models | Detection Signals |
| ----- | ----- | ----- |
| **Dense Transformer** | GPT-4, Claude, Llama | Standard configs |
| **MoE (Mixture of Experts)** | Mixtral, DBRX, Grok, DeepSeek-V3, Llama 4 | `num_experts`, `top_k_experts` in config |
| **SSM (State Space)** | Mamba, Jamba | `mamba`, `state-spaces` imports |
| **Hybrid MoE+SSM** | Jamba-1.5 | Combined architecture |
| **Hybrid MoE+Dense** | Llama 4 | Alternating layers |
| **Multi-modal** | GPT-4V, Claude 3, Gemini, LLaVA | Image inputs, vision configs |
| **Encoder-only** | BERT, RoBERTa | Embeddings, classification |
| **Encoder-decoder** | T5, BART, Flan | Seq2seq tasks |
| **Diffusion** | Stable Diffusion, DALL-E, Flux | Image generation |

### **MoE-Specific Detection**

```
Detection signals:
  config.json: num_local_experts, num_experts_per_tok, num_experts
  Model names: mixtral, dbrx, grok, deepseek-moe, llama-4

Pricing implications:
  MoE models activate subset of parameters
  Lower compute per token vs dense equivalent
  Memory footprint remains full model size
  DeepSeek-V3: 671B total, 37B active per token
  Llama 4 Maverick: MoE with 2 active experts
```

---

## **11\. QUANTIZATION**

| Method | Bits | Detection Signals |
| ----- | ----- | ----- |
| FP32 | 32 | Default, no quantization |
| FP16 | 16 | `torch.float16`, `--dtype float16` |
| BF16 | 16 | `torch.bfloat16`, `--dtype bfloat16` |
| FP8 | 8 | H100 native, `--dtype fp8`, Transformer Engine |
| INT8 | 8 | `bitsandbytes`, `LLM.int8()` |
| INT4 | 4 | `bitsandbytes` 4-bit, QLoRA |
| GPTQ | 4 | `.gptq` suffix, `auto-gptq` |
| AWQ | 4 | `.awq` suffix, `autoawq` |
| GGUF | 2-8 | `.gguf` files, llama.cpp |
| EXL2 | 2-8 | `.exl2` files, ExLlamaV2 |
| SmoothQuant | 8 | W8A8, `smoothquant` |
| AQLM | 2 | Additive quantization |
| QuIP\# | 2 | `quip-sharp` |
| NF4 | 4 | QLoRA, `bitsandbytes` |
| FP4 | 4 | Blackwell native (emerging) |

---

## **12\. OPTIMIZATION TECHNIQUES**

| Technique | Detection Signals | Impact |
| ----- | ----- | ----- |
| **Speculative decoding** | `--speculative-model`, draft model config | 2-3x throughput |
| **Continuous batching** | vLLM default, iteration scheduling | Higher throughput |
| **PagedAttention** | vLLM, `--gpu-memory-utilization` | Memory efficiency |
| **FlashAttention** | `flash_attn`, `--enable-flash-attn` | Faster attention |
| **FlashAttention-2** | `flash_attn_2` | Faster \+ longer context |
| **FlashAttention-3** | H100 optimized, FA-3 flags | FP8 support |
| **Tensor parallelism** | `--tensor-parallel-size`, multi-GPU | Scale to larger models |
| **Pipeline parallelism** | `--pipeline-parallel-size` | Cross-node scaling |
| **Expert parallelism** | MoE distribution across GPUs | MoE efficiency |
| **Data parallelism** | FSDP, DeepSpeed ZeRO | Training scale |
| **KV cache quantization** | `--kv-cache-dtype fp8` | Memory reduction |
| **Prefix caching** | `--enable-prefix-caching` | Repeated prompt speedup |
| **Chunked prefill** | SGLang default | Better scheduling |
| **RadixAttention** | SGLang | Automatic prefix caching |
| **Torch.compile** | `torch.compile()` | Graph optimization |

---

## **13\. EMBEDDING MODELS**

| Provider | Models |
| ----- | ----- |
| **OpenAI** | text-embedding-3-large, text-embedding-3-small, text-embedding-ada-002 |
| **Cohere** | embed-english-v3.0, embed-multilingual-v3.0 |
| **Voyage AI** | voyage-large-2, voyage-code-2, voyage-3 |
| **Jina AI** | jina-embeddings-v2-base-en, jina-embeddings-v3, jina-clip-v1 |
| **Mixedbread** | mxbai-embed-large-v1 |
| **HuggingFace** | sentence-transformers/\*, bge-large-en-v1.5, e5-large-v2, gte-large |
| **Google** | text-embedding-004, textembedding-gecko |
| **AWS** | titan-embed-text-v1, titan-embed-text-v2, titan-embed-image-v1 |
| **Nomic** | nomic-embed-text-v1.5 |

---

## **14\. VECTOR STORES (RAG Detection)**

| Store | Detection Signals |
| ----- | ----- |
| **Pinecone** | `pinecone` SDK |
| **Weaviate** | `weaviate` SDK |
| **Milvus** | `pymilvus` SDK |
| **Qdrant** | `qdrant_client` SDK |
| **Chroma** | `chromadb` SDK |
| **FAISS** | `faiss` imports |
| **pgvector** | `pgvector` extension, `VECTOR` type |
| **Elasticsearch** | `dense_vector` field type |
| **MongoDB Atlas** | `$vectorSearch` |
| **Redis** | `redis` with vector search |
| **LanceDB** | `lancedb` SDK |
| **Vespa** | `pyvespa` SDK |
| **Supabase** | `supabase` with pgvector |
| **Neon** | Neon with pgvector |
| **Turbopuffer** | `turbopuffer` SDK |
| **Zilliz** | Managed Milvus |

---

## **15\. GUARDRAILS / SAFETY LAYER**

| Tool | Detection Signals |
| ----- | ----- |
| **NVIDIA NeMo Guardrails** | `nemoguardrails` imports, Colang configs, `config.yml` with rails |
| **Guardrails AI** | `guardrails` imports, RAIL specs, `Guard()` class |
| **Llama Guard** | `llama_guard` imports, safety classification models |
| **LLM Guard** | `llm_guard` imports |
| **Lakera Guard** | `lakera` SDK, Lakera API |
| **Rebuff** | `rebuff` imports, prompt injection detection |
| **Vigil** | `vigil` imports |
| **Presidio** | `presidio_analyzer`, `presidio_anonymizer`, PII detection |
| **Azure Content Safety** | `azure.ai.contentsafety` |
| **OpenAI Moderation** | `openai.moderations.create()` |
| **ShieldGemma** | Google safety model |
| **Granite Guardian** | IBM safety model |
| **WildGuard** | WildGuard safety model |
| **Aegis Guard** | Aegis safety model |

### **Guardrail Types to Detect**

| Type | Detection Signals |
| ----- | ----- |
| Input guardrails | Pre-processing filters, input validation |
| Output guardrails | Post-processing filters, response validation |
| Content moderation | Toxicity detection, hate speech filters |
| PII detection/redaction | `presidio`, regex patterns, entity detection |
| Prompt injection detection | Injection classifiers, pattern matching |
| Jailbreak detection | Jailbreak classifiers |
| Topic control | Topic steering, off-topic rejection |
| Fact-checking rails | RAG grounding checks |
| Hallucination detection | Self-consistency checks, citation verification |
| Compliance filters | Industry-specific content rules |

---

## **16\. LLM GATEWAYS / API MANAGEMENT**

| Gateway | Detection Signals |
| ----- | ----- |
| **LiteLLM** | `litellm` imports, proxy config, `completion()` unified API |
| **Portkey** | `portkey` SDK, `portkey-ai` headers, `x-portkey` |
| **Helicone** | `helicone` headers, `oai.hconeai.com` proxy |
| **OpenRouter** | `openrouter.ai` endpoint, `OPENROUTER_API_KEY` |
| **Kong AI Gateway** | Kong config with AI plugins |
| **TensorZero** | `tensorzero` config |
| **BricksLLM** | `bricksllm` config |
| **Martian** | `martian` imports, router config |
| **Unify AI** | `unify` SDK |
| **TrueFoundry Gateway** | `truefoundry` config |
| **Bifrost AI** | `bifrost` config |
| **Gloo Gateway** | Solo.io AI gateway config |
| **IBM API Connect AI** | IBM AI gateway config |
| **Cloudflare AI Gateway** | Cloudflare AI gateway |
| **Azure API Management** | Azure APIM with AI policies |

### **Gateway Features to Detect**

| Feature | Detection Signals |
| ----- | ----- |
| Load balancing | `loadbalance`, weight configs |
| Fallback/retry logic | `fallback`, `retry`, `on_fail` configs |
| Semantic caching | `cache`, embedding-based cache configs |
| Rate limiting | `rate_limit`, token quotas |
| Cost tracking/budgets | `budget`, `cost_limit` configs |
| Virtual key management | `virtual_key`, key rotation |
| Request routing rules | `router`, conditional routing |

---

## **17\. FINE-TUNING / PEFT LAYER**

### **17.1 PEFT Methods**

| Method | Detection Signals |
| ----- | ----- |
| **LoRA** | `peft` imports, `LoraConfig`, `.lora` adapters |
| **QLoRA** | `bitsandbytes` \+ LoRA, 4-bit quantization |
| **QA-LoRA** | Quantization-aware LoRA |
| **LongLoRA** | Extended context LoRA, shift short attention |
| **DoRA** | Weight-decomposed LoRA |
| **AdaLoRA** | Adaptive rank LoRA |
| **LoRA+** | Improved LoRA |
| **Prefix Tuning** | `PrefixTuningConfig` |
| **P-Tuning** | `PromptEncoderConfig` |
| **P-Tuning v2** | Deep prompt tuning |
| **Prompt Tuning** | `PromptTuningConfig` |
| **IA3** | `IA3Config` |
| **Adapters** | `adapter-transformers`, bottleneck adapters |
| **LLaMA-Adapter** | LLaMA-specific adapters |

### **17.2 Fine-Tuning Platforms**

| Platform | Detection Signals |
| ----- | ----- |
| **Hugging Face PEFT** | `peft` library |
| **Axolotl** | `axolotl` configs, YAML recipes |
| **LLaMA-Factory** | `llamafactory` imports |
| **Ludwig** | `ludwig` configs |
| **Unsloth** | `unsloth` imports (2x faster LoRA) |
| **NVIDIA NeMo** | `nemo` framework |
| **MosaicML Composer** | `composer` imports |
| **OpenAI Fine-tuning** | `openai.fine_tuning.jobs.create()` |
| **Anthropic Fine-tuning** | Fine-tuning API |
| **Together Fine-tuning** | Together fine-tuning API |
| **Fireworks Fine-tuning** | Fireworks fine-tuning |
| **Anyscale Fine-tuning** | Anyscale fine-tuning |
| **Predibase** | `predibase` SDK, LoRAX |
| **Lamini** | `lamini` SDK |
| **MonsterAPI** | MonsterAPI fine-tuning |

---

## **18\. PROMPT MANAGEMENT / LLMOps**

| Tool | Detection Signals |
| ----- | ----- |
| **Langfuse** | `langfuse` imports, `@observe` decorator |
| **LangSmith** | `langsmith`, `LANGCHAIN_TRACING_V2` |
| **Weights & Biases** | `wandb` with LLM tracking, Weave |
| **PromptLayer** | `promptlayer` imports |
| **Braintrust** | `braintrust` SDK |
| **Keywords AI** | `keywordsai` imports |
| **Agenta** | `agenta` imports |
| **Orq.ai** | `orq` SDK |
| **LangWatch** | `langwatch` imports |
| **Lilypad** | `lilypad` imports |
| **HoneyHive** | `honeyhive` SDK |
| **Log10** | `log10` SDK |
| **Parea AI** | `parea` imports |
| **Arize Phoenix** | `arize.phoenix` |
| **Traceloop** | `traceloop` SDK, OpenLLMetry |
| **Galileo** | `galileo` SDK |
| **Patronus AI** | `patronus` SDK |
| **Deepchecks** | `deepchecks` LLM evaluation |
| **Opik (Comet)** | `opik` SDK |

---

## **19\. OBSERVABILITY / LOGGING**

| Tool | Detection Signals |
| ----- | ----- |
| **Langfuse** | `langfuse` imports |
| **LangSmith** | `LANGCHAIN_TRACING_V2` |
| **Arize Phoenix** | `arize.phoenix` |
| **Weights & Biases** | `wandb`, W\&B Prompts |
| **MLflow** | `mlflow`, LLM tracking |
| **PromptLayer** | `promptlayer` |
| **Helicone** | `helicone` headers |
| **Log10** | `log10` SDK |
| **Braintrust** | `braintrust` SDK |
| **HoneyHive** | `honeyhive` SDK |
| **Galileo** | `galileo` SDK |
| **Portkey** | `portkey` observability |
| **Keywords AI** | `keywords_ai` |
| **OpenLLMetry** | `openllmetry`, OpenTelemetry for LLMs |
| **Datadog LLM** | Datadog LLM Observability |
| **New Relic AI** | New Relic AI Monitoring |
| **Dynatrace** | Dynatrace AI observability |

---

## **20\. CONTEXT MANAGEMENT / MEMORY**

| Tool | Detection Signals |
| ----- | ----- |
| **Mem0** | `mem0` imports, memory SDK |
| **LangChain Memory** | `ConversationBufferMemory`, `ConversationSummaryMemory` |
| **Zep** | `zep_python` SDK, long-term memory |
| **Motorhead** | `motorhead` memory server |
| **MemGPT / Letta** | `letta` imports, `memgpt` |
| **LlamaIndex Memory** | `ChatMemoryBuffer` |
| **Redis Memory** | Redis-based conversation storage |
| **PostgreSQL Memory** | pg-based conversation history |

---

## **21\. DISTRIBUTED TRAINING / INFERENCE ORCHESTRATION**

| Tool | Detection Signals |
| ----- | ----- |
| **DeepSpeed** | `deepspeed` imports, DS configs, ZeRO stages |
| **FSDP** | `torch.distributed.fsdp` |
| **Megatron-LM** | Megatron configs |
| **Ray** | `ray.serve`, Ray configs |
| **Horovod** | `horovod` imports |
| **Alpa** | `alpa` imports |
| **Colossal-AI** | `colossalai` imports |
| **llm-d** | Kubernetes LLM orchestration |
| **LMCache** | `lmcache` for KV cache sharing |
| **Inference Gateway (IGW)** | K8s AI-aware routing |
| **KubeRay** | Ray on Kubernetes |
| **Determined AI** | `determined` SDK |
| **SkyPilot** | `sky` CLI, multi-cloud orchestration |

---

## **22\. EVALUATION / BENCHMARKING**

| Tool | Detection Signals |
| ----- | ----- |
| **lm-eval-harness** | `lm_eval` imports, EleutherAI harness |
| **HELM** | Stanford HELM benchmark |
| **OpenAI Evals** | `evals` framework |
| **Ragas** | `ragas` imports, RAG evaluation |
| **TruLens** | `trulens` imports |
| **DeepEval** | `deepeval` imports |
| **Promptfoo** | `promptfoo` CLI |
| **Giskard** | `giskard` imports |
| **Phoenix Evals** | Arize Phoenix evaluation |
| **Langfuse Evals** | Langfuse evaluation datasets |
| **Patronus Lynx** | Hallucination detection |
| **Quotient AI** | `quotient` evaluation |
| **Vellum** | `vellum` evaluation |

---

## **23\. DATA PREPARATION / SYNTHETIC DATA**

| Tool | Detection Signals |
| ----- | ----- |
| **Argilla** | `argilla` SDK, data labeling |
| **Lilac** | `lilac` imports, data curation |
| **Distilabel** | `distilabel` imports, synthetic data |
| **Gretel** | `gretel` SDK, synthetic data |
| **Mostly AI** | Mostly AI synthetic data |
| **Scale AI** | Scale data labeling |
| **Snorkel** | `snorkel` weak supervision |
| **Cleanlab** | `cleanlab` data quality |

---

## **Detection Signal Summary by File Type**

| File Type | What to Look For |
| ----- | ----- |
| `requirements.txt` / `pyproject.toml` | SDK dependencies |
| `package.json` | JS/TS SDK dependencies |
| `.env` / environment files | API keys, endpoints, model names |
| `config.yaml` / `config.json` | Runtime configs, model parameters |
| `docker-compose.yaml` | GPU reservations, service configs |
| `terraform/*.tf` | Infrastructure, GPU types, regions |
| `kubernetes/*.yaml` | GPU requests, node selectors |
| `*.py` / `*.ts` / `*.go` / `*.java` | Import statements, API calls |
| `Dockerfile` | Base images, runtime installations |
| `.github/workflows/*.yaml` | CI/CD with model deployments |

---

This taxonomy covers **23 categories** with **500+ detection targets**. PeakInfer's Codebase Analyzer should use this as the canonical reference for building StackMaps.


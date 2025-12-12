

# **PeakInfer Technical Design Document (TDD) v1.0**

**Version:** 1.0  
**Date:** December 2025  
**Product:** PeakInfer (CLI)  
**Status:** Canonical technical spec aligned to PRD v1.0 \+ DD v1.0 \+ agent architecture patterns  
**Scope:** v1 shipping behavior (no “platform” promises)

---

## **1\. Purpose**

This document specifies **how PeakInfer is implemented**: architecture, modules, schemas, execution model, and operational constraints.

PeakInfer is a **deterministic, artifact-producing CLI** that builds a **system-of-record** for LLM inference usage and performance headroom by joining:

1. **Static code truth** (semantic callsite discovery \+ pattern detection)  
2. **Runtime truth** (offline event logs you supply)  
3. **Reference envelopes** (benchmark/perf baselines)  
4. **Normalized pricing inputs** (only to explain tradeoffs)

---

## **2\. Product Constraints**

### **2.1 Hard Constraints**

* **CLI is the product**  
* **No telemetry to PeakInfer/Kalmantic**  
* **Runtime analysis is fully offline** (when analyzing events files)  
* **Static analysis may use an LLM provider** (code is sent only to the configured provider)  
* Outputs are **repeatable** and **auditable artifacts** saved to disk

### **2.2 Non-Goals (v1)**

* No runtime instrumentation SDK  
* No continuous monitoring  
* No auto-remediation / code rewriting  
* No hosted dashboards  
* No “guaranteed performance improvements”

---

## **3\. Execution Model (Agent Pattern)**

PeakInfer uses a **two-pass execution model**:

1. **Planning pass:** generate an execution plan (task list, no tools named in the plan)  
2. **Execution pass:** resolve each planned subtask into a tool call, execute, persist outputs, resume safely

This is the key design choice that makes the CLI:

* resumable  
* debuggable  
* UI-agnostic (Ink CLI now, web later if needed)  
* stable under tool changes

---

## **4\. High-Level Architecture**

### **4.1 Components**

* **CLI Router**: argument parsing, command dispatch, UX states  
* **Agent Orchestrator**: plan/execute, callbacks, persistence  
* **Scanner**: file discovery \+ language detection \+ ignore handling  
* **Static Analyzer**: semantic callsite extraction \+ pattern detection  
* **Runtime Events Analyzer**: parse/validate/aggregate events (offline)  
* **Join Engine**: correlate callsites ↔ runtime events, drift detection  
* **Tradeoff Engine**: performance-per-dollar reasoning (diagnostic)  
* **Reference Data Layer**:  
  * **InferenceMax** as benchmark envelope input  
  * **LiteLLM** as normalized pricing substrate (internal)  
* **Renderers**: terminal summary, JSON artifacts, optional HTML report  
* **Context Manager**: `.peakinfer/` run directory, caching, resume

### **4.2 Dataflow (Static Only)**

```
Repo Path
  → Scanner
  → Static Analyzer (semantic)
  → Callsites + Patterns + TechStack
  → StackMap Builder
  → Tradeoff Engine (optional, uses reference inputs)
  → Renderers + Artifacts
```

### **4.3 Dataflow (Runtime Only)**

```
Events File (JSONL/JSON/CSV)
  → Parser + Schema Validator
  → Aggregator (provider/model/intent/percentiles)
  → Renderers + Artifacts
```

### **4.4 Dataflow (Combined)**

```
Repo Path + Events File
  → Static pipeline
  → Runtime pipeline
  → Join Engine (correlate + drift)
  → Tradeoff Engine (uses joined truth)
  → Renderers + Artifacts
```

---

## **5\. Command Surface (v1)**

### **5.1 `peakinfer analyze <path|events>`**

Single entrypoint that detects whether the input is:

* a repo directory, or  
* an events file

Flags:

* `--events <file>`: combined mode  
* `--html`: generate report  
* `--open`: open HTML  
* `--output <dir>`: output directory  
* `--cached`: reuse `.peakinfer/` artifacts if compatible  
* `--verbose`: show plan \+ task progress \+ reasoning  
* `--strict`: fail on partial schema / low-confidence provider/model  
* `--redact`: redact code snippets in artifacts (callsite metadata remains)

### **5.2 `peakinfer tradeoffs`**

Runs the tradeoff engine over the current analysis artifacts (static or combined).

### **5.3 `peakinfer refs`**

Manages reference inputs:

* `refs refresh` (optional network)  
* `refs status`  
* `refs pin <version>` (for reproducible builds)

No user-facing “pricing lookup” command is required for the product narrative. If it exists, it must be framed as **diagnostic input** only.

---

## **6\. Filesystem Context & Resumability**

### **6.1 Directory Layout**

```
.peakinfer/
  runs/
    <runId>/
      plan.json
      scan.json
      static.json
      runtime.json
      joined.json
      tradeoffs.json
      stackmap.json
      report.html
      meta.json
  cache/
    llm/
    refs/
  logs/
    <runId>.log
```

### **6.2 Persistence Rules**

* Every task produces an artifact file.  
* Tasks are **idempotent** whenever possible.  
* Resume behavior:  
  * if artifact exists and inputs unchanged → reuse  
  * if artifact exists but inputs changed → invalidate downstream

### **6.3 Run Identity**

`runId = hash(repoRoot, eventsHash?, toolVersions, config, refsVersion)`

This ensures reproducibility and avoids mixing incompatible cached outputs.

---

## **7\. Core Schemas**

### **7.1 Static Callsite**

```ts
type Provider =
  | 'openai' | 'anthropic' | 'google' | 'cohere' | 'mistral'
  | 'bedrock' | 'azure_openai' | 'together' | 'fireworks'
  | 'groq' | 'replicate' | 'perplexity' | 'unknown';

interface Callsite {
  id: string;                 // stable hash of file+line+signature
  file: string;               // relative path
  line: number;
  language: 'python'|'ts'|'js'|'go'|'java'|'unknown';

  provider: Provider | null;
  model: string | null;

  framework: string | null;   // langchain, llamaindex, etc.
  runtime: string | null;     // vllm, sglang, ollama, etc.

  patterns: {
    streaming?: boolean;
    batching?: boolean;
    retries?: boolean;
    caching?: boolean;
    routing?: boolean;
    fallback?: boolean;
  };

  confidence: number;         // 0..1
  evidence: {
    whyProvider?: string;
    whyModel?: string;
    snippetsRedacted?: boolean;
  };
}
```

### **7.2 Runtime Event (Offline)**

```ts
interface InferenceEvent {
  id: string;
  ts: string;                 // ISO
  provider: Provider;
  model: string;

  input_tokens: number;
  output_tokens: number;
  latency_ms: number;

  intent?: string;
  region?: string;
  tenant?: string;
  callsite_id?: string;       // optional explicit join key
  cost_usd?: number;          // optional (if supplied)
}
```

### **7.3 StackMap (InferenceMap)**

```ts
interface StackMap {
  root: string;
  summary: {
    totalCallsites: number;
    providers: Provider[];
    models: string[];
  };
  tree: StackNode[];
}

interface StackNode {
  type: 'directory'|'file';
  name: string;
  path: string;
  children?: StackNode[];
  callsites?: Callsite[];
}
```

### **7.4 Joined Output**

```ts
interface JoinedInference {
  callsites: Array<Callsite & { usage?: UsageStats }>;
  runtimeOnly: InferenceEvent[];     // observed but not mapped to code
  codeOnly: Callsite[];             // in code but never observed
  drift: DriftSignal[];
}

interface UsageStats {
  calls: number;
  tokens_in: number;
  tokens_out: number;
  latency: {
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  };
}
```

---

## **8\. Static Analysis Implementation**

### **8.1 Scanner**

Responsibilities:

* recursively walk repo root  
* respect `.gitignore` \+ built-in ignores (`node_modules`, `dist`, etc.)  
* detect language per file extension  
* compute summary stats

Output: `scan.json`

### **8.2 Semantic Static Analyzer**

Two implementation modes (same contract):

**Mode A: Agent-driven semantic analysis (preferred)**

* tool-limited (Glob → Grep → Read)  
* returns structured JSON (validated)  
* gives confidence \+ evidence

**Mode B: Heuristic fallback (optional safety net)**

* regex \+ AST helpers for known SDK call patterns  
* used only when LLM provider unavailable or `--offline-static` is implemented later

Output: `static.json` containing:

* callsites\[\]  
* patterns summary  
* detected runtimes/frameworks  
* tech stack layers (serving/infra/hardware inferences are always labeled as “inferred”)

---

## **9\. Runtime Events Analysis (Offline)**

### **9.1 Parsers**

Supported input formats:

* JSONL  
* JSON array  
* CSV

Rules:

* strict schema validation by default  
* `--lenient` may allow missing optional fields, never missing required fields

### **9.2 Aggregation**

Compute:

* byProvider: calls, tokens, cost (if possible), latency percentiles  
* byModel: same  
* byIntent: optional  
* global percentiles

Output: `runtime.json`

---

## **10\. Join Engine (Static \+ Runtime)**

### **10.1 Join Priority**

1. `callsite_id` exact match (if present in events)  
2. provider+model match (high confidence only)  
3. provider match \+ nearest-file heuristic (only if explicitly enabled)  
4. otherwise → unmatched buckets

### **10.2 Drift Signals**

* **codeOnly:** in repo, never observed in events  
* **runtimeOnly:** observed in events, no matching callsite  
* **mismatch:** same callsite\_id but provider/model differs  
* **pattern drift:** batching/streaming indicated in code but absent in runtime distribution signals

Output: `joined.json`

---

## **11\. Tradeoff Engine (Performance-First)**

### **11.1 Purpose**

Tradeoff reasoning exists to answer:

* “Are we near achievable peak?”  
* “Where is headroom being wasted?”  
* “Which configurations are dominated under our constraints?”

It must never present itself as “pricing lookup”.

### **11.2 Inputs**

* Joined truth (or static-only if runtime missing)  
* **InferenceMax** reference envelopes (throughput/latency by model/hardware/runtimes)  
* **LiteLLM** normalized pricing (per-token or per-unit abstractions)

### **11.3 Output**

* dominated configurations  
* constraint classification (latency-bound / throughput-bound / cost-constrained / misconfigured)  
* explainers tied to evidence (callsite \+ runtime stats \+ envelope delta)

Output: `tradeoffs.json`

---

## **12\. Reference Data Layer**

### **12.1 InferenceMax Integration (Benchmark Envelopes)**

* treated as an **input dataset**  
* versioned and cached  
* never copied verbatim into marketing output  
* used to build “envelopes” and to label comparisons as “reference, not guarantee”

### **12.2 LiteLLM Integration (Pricing Substrate)**

* internal normalization only  
* versioned and cached  
* offline fallback:  
  * a pinned snapshot of common model pricing  
  * used only when tradeoff engine runs offline

---

## **13\. Renderers & UX State Completeness**

### **13.1 Outputs**

* Terminal summary (default)  
* JSON artifacts (always)  
* Optional HTML report

### **13.2 Required UX States (CLI \+ HTML)**

* **Zero/Empty:** no callsites / no events / no matches  
* **Loading:** phase-by-phase progress with meaningful step names  
* **Success:** concise summary \+ where artifacts are saved  
* **Partial Success:** what succeeded, what failed, next steps  
* **Error:** actionable message \+ remediation \+ preserved artifacts

### **13.3 Progressive Disclosure**

Default output: minimal, decision-ready summary  
Verbose output: plan, per-task logs, confidence/evidence, join reasoning

---

## **14\. Configuration**

```ts
interface Config {
  // LLM
  provider: 'anthropic'|'openai'|'google';
  model: string;
  temperature: number;          // default 0
  maxTurns: number;             // bounded

  // Execution
  parallelism: number;
  toolTimeoutMs: number;
  retryAttempts: number;

  // Persistence
  contextDir: string;           // default .peakinfer/
  cacheEnabled: boolean;

  // Strictness
  strict: boolean;
  redact: boolean;

  // Reference Data
  refsVersion?: string;         // pinned
}
```

---

## **15\. Security & Privacy**

* Static analysis may transmit code to the configured LLM provider  
* No other outbound transmission  
* Redaction mode must ensure:  
  * callsite coordinates remain  
  * code snippets (if any) are removed from artifacts  
* Secrets hygiene:  
  * never print env vars  
  * never store API keys in `.peakinfer/`

---

## **16\. Performance Targets (Engineering)**

* 10k LOC repo: \< 60 seconds (static analysis depends on LLM latency; local work must be fast)  
* Memory: \< 500MB baseline  
* HTML report generation must be deterministic and bounded

---

## **17\. Fixtures & Test Harness (TDD-Level Requirements)**

PeakInfer must ship with a **fixture suite** used by CI:

### **17.1 Repo Fixtures (Realistic)**

* SaaS API-only inference (OpenAI/Anthropic)  
* Hosted inference (Together/Fireworks/Replicate)  
* Self-hosted runtime repos:  
  * vLLM serving repo  
  * SGLang serving repo  
  * Ollama/llama.cpp style repo  
* Hybrid repo (router \+ fallback \+ caching \+ batching)  
* Multi-language repo (py \+ ts \+ go)

### **17.2 Events Fixtures**

* JSONL with clean schema (golden)  
* CSV equivalent  
* JSON array equivalent  
* Missing-field fixtures (expected failures)  
* “runtimeOnly” fixture (events contain providers not present in code)  
* “codeOnly” fixture (dead code)  
* callsite\_id join fixture (explicit mapping)  
* skewed latency fixture (p95/p99 correctness)

### **17.3 Generator**

Include a small tool:  
`peakinfer fixtures generate`

* emits synthetic but realistic JSONL events from a given StackMap  
* used for reproducible tests and demos  
* never claimed as “production telemetry”

---

## **18\. Module Breakdown (Implementation Map)**

```
src/
  cli/
    index.ts            // command router
    ui/                 // Ink components (optional)
  core/
    agent/
      agent.ts          // plan/execute, callbacks, persistence
      plan.ts           // plan schema + validation
      callbacks.ts      // callback types
    scan/
      scanner.ts
      ignore.ts
    static/
      analyzer.ts       // orchestrates agent mode
      prompts.ts
      heuristics.ts     // optional fallback
      extractors/
    runtime/
      parser.ts
      validators.ts
      aggregators.ts
    join/
      joiner.ts
      drift.ts
    tradeoffs/
      engine.ts
      envelopes.ts      // inference reference layer
      pricing.ts        // normalized pricing adapter
    refs/
      inferencemax.ts
      litellm.ts
      cache.ts
    render/
      terminal.ts
      json.ts
      html.ts
    artifacts/
      paths.ts
      writer.ts
      hashes.ts
```

---

## **19\. Failure Modes (Explicit)**

* LLM provider unavailable → static analysis fails fast with remediation  
* Partial classification → downgrade confidence, avoid false positives  
* Bad events schema → fail with line-level error \+ sample fix  
* Reference inputs missing → tradeoff engine degrades gracefully (still produces truth artifacts)

---

## **20\. Versioning & Compatibility**

Artifacts include:

* PeakInfer version  
* refs versions  
* schema version  
* runId inputs hash

Breaking schema changes must bump:

* `schemaVersion`  
* output filenames or directories if needed

---

## **21\. Appendix: Why This Isn’t “Just use an IDE Agent”**

An IDE agent helps an individual explore code interactively.

PeakInfer produces:

* a **repeatable** run  
* a **shared artifact** (system of record)  
* a **join** of code truth \+ runtime truth \+ reference envelopes  
* strict schemas, drift detection, and stable outputs you can diff over time

That’s a product boundary, not a prompting trick.

---

* 


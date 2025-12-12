# **PeakInfer TEST CASE DOCUMENT v1.0**

**Product:** PeakInfer  
**Version:** 1.0  
**Date:** December 2025  
**Purpose:** Ensure PeakInfer is *truthful, auditable, repeatable* and covers real-world inference scenarios across SaaS APIs, hosted inference, and bare metal/self-hosted runtimes.

This revision explicitly expands fixture coverage for:

* **SaaS API inference** (OpenAI/Anthropic/etc)  
* **Hosted inference endpoints** (Together/Fireworks/Replicate/Baseten-like patterns)  
* **Self-hosted \+ bare metal** (vLLM/SGLang/TensorRT/ollama/llama.cpp)  
* **Mixed environments** (hybrid providers, fallbacks, routers, caching)  
* **Static \+ runtime correlation** (repo \+ jsonl combinations)

All tests map back to:

* PRD’s *core capabilities \+ acceptance criteria*  
* DD’s *behavior-first UX \+ state completeness \+ artifact-first design*  
* TDD’s *two-pass \+ filesystem persistence \+ validator \+ StackMap builder \+ CLI states \+ testing strategy*

---

## **0\. Testing North Star**

PeakInfer succeeds when a user can:

1. **Trust what was analyzed** (scope is explicit)  
2. **See where inference happens** (InferenceMap/StackMap is correct)  
3. **Compare code intent vs runtime reality** (drift is surfaced)  
4. **Understand performance trade-offs without “pricing lookup vibes”**  
5. **Share artifacts** (JSON \+ HTML) and they hold up in review

---

## **1\. Scope of Testing**

### **1.1 In scope (v1)**

* Static analysis: `peakinfer analyze .`  
* Runtime events analysis (offline): `peakinfer analyze events.jsonl`  
* Combined analysis: `peakinfer analyze ./src --events production.jsonl` (drift detection)  
* Artifact outputs: StackMap JSON, report HTML (and any pricing/tradeoff outputs that exist in v1)  
* CLI states: zero/loading/partial/error/success

### **1.2 Out of scope (do not test as “promised”)**

* Real-time monitoring / continuous telemetry (explicitly not the model)  
* Auto-remediation, auto-optimization, rewriting code (not v1 promises)

---

## **2\. Fixtures: the missing piece that makes tests real**

Your old test doc had good philosophy, but fixture coverage was under-specified relative to the real-world environments you explicitly care about (SaaS vs hosted endpoints vs bare metal, plus repo+jsonl combinations). This revision makes fixtures first-class.

### **2.1 Fixture taxonomy (what we must cover)**

#### **A) Code repos (static fixtures)**

Each repo is small but “real-pattern-dense.”

**A1. SaaS API repos**

1. **Direct OpenAI SDK** (sync \+ async, streaming on/off, retries, batching)  
2. **Direct Anthropic SDK** (messages API patterns, streaming, tool calls)  
3. **Azure OpenAI style wrappers** (base URL/env indirection)  
4. **Bedrock style wrappers** (client abstractions, model IDs not obvious)  
5. **“HTTP calls” repo** (requests/fetch hitting `/v1/chat/completions` or similar)  
6. **LiteLLM usage repo** (calls go through litellm as a router/adapter)

**A2. Hosted inference repos**

1. Together/Fireworks style SDK wrappers (or REST endpoints)  
2. “Generic OpenAI-compatible endpoint” repo (base\_url points to a hosted provider)  
3. Replicate style “prediction create \+ poll” pattern  
4. Baseten-like “deployment endpoint \+ auth header \+ model name” pattern

**A3. Self-hosted / bare metal repos**

1. **vLLM** (OpenAI-compatible server \+ client usage)  
2. **SGLang** (runtime invocation, server endpoints, client wrappers)  
3. **TensorRT-LLM** (bindings / service calls / config-based model selection)  
4. **ollama** (CLI calls or HTTP API)  
5. **llama.cpp / LocalAI** (HTTP calls, CLI, or library)

**A4. Framework repos**

1. LangChain (LLM \+ Chains \+ streaming \+ callbacks)  
2. LlamaIndex (query engine, agent usage)  
3. DSPy (program definitions, compiled pipelines)  
4. Semantic Kernel / AutoGen / CrewAI style orchestrations (at least one)

**A5. “Nasty reality” repos**

1. Dynamic imports \+ provider selected at runtime  
2. Wrapper functions (providers hidden behind `llmClient.complete()`)  
3. Monorepo multi-language (TS \+ Python \+ Go)  
4. “Dead code” (provider present but unused)  
5. “Generated code” / vendor SDK checked in

These align with the PRD’s promise to detect providers/models/patterns and runtime signals .

---

#### **B) Runtime event files (runtime fixtures)**

Events must cover schema correctness, skew, and joining behavior.

**B1. Valid baseline events**

* JSONL with required fields: `id, ts, provider, model, input_tokens, output_tokens, latency_ms`  
* Variety: multiple providers, multiple models, multiple intents

**B2. Format variants**

* JSON array file  
* CSV file  
  (Still same logical schema.)

**B3. Dirty events (real-world mess)**

* Missing fields (each required field missing in isolation)  
* Wrong types (latency string, tokens float, ts invalid)  
* Duplicated IDs  
* Out-of-order timestamps  
* Negative tokens / impossible values  
* Extremely large tokens (overflow / perf)  
* Unknown provider/model strings (normalization behavior)  
* Region/tenant present (optional fields)

**B4. Drift join stress**

* Providers in code but not events (dead code)  
* Providers in events but not code (hidden source)  
* Model mismatch (code says `gpt-4o`, events show `gpt-4o-mini`)  
* Pattern mismatch proxies (code has batching, events show single requests only)

---

#### **C) Combined fixtures (repo \+ events combos)**

For each major repo class (SaaS / hosted / bare metal), create **at least one paired runtime file** that represents:

* “Clean match”  
* “Partial match”  
* “Mismatch/drift”

This is the heart of PRD §4.3 combined analysis / drift signals .

---

### **2.2 Fixture generation (you asked “how to generate jsonl as well”)**

Add a small `fixtures/generate/` folder with scripts that can:

1. **Replay synthetic inference sessions** (local script that emits events)  
2. **Perturb events** (drop fields, scramble ts order, duplicate IDs, skew latency)  
3. **Scale volume** (10, 1k, 100k events to test performance/memory)

This supports the TDD’s emphasis on profiling tests and reproducible fixtures .

---

## **3\. Test Structure (how the suite is organized)**

### **3.1 Test levels**

1. **Unit tests** (pure deterministic logic)  
2. **Component integration tests** (scanner → chunker → validator → builder)  
3. **CLI E2E tests** (golden output snapshots)  
4. **LLM-dependent golden tests** (pinned prompt versions, strict snapshots)  
5. **Performance & resource tests** (time, memory, file counts)

This mirrors the TDD testing strategy (unit, integration, golden fixtures, profiling) .

### **3.2 Required “state completeness” tests**

Every command path must have:

* Zero state  
* Loading state  
* Partial state  
* Error state  
* Success state  
  as a first-class test requirement .

---

## **4\. Unit Test Suites**

### **4.1 Validators & Normalizers (must be bulletproof)**

**Goal:** Claude outputs are validated, not trusted .

Test cases:

* JSON schema validation success/failure  
* Enum checking, range checking  
* Confidence threshold filtering  
* Provider/model normalization (aliases, casing, punctuation)  
* Framework canonicalization (LangChain variants, etc.)

### **4.2 Runtime events parser**

Test cases:

* JSONL/JSON/CSV parsing  
* Required field enforcement  
* Percentile calculations correctness (p50/p95/p99)  
* Aggregations by provider/model/intent  
* Handling invalid rows (fail-fast vs partial; must match TDD/UX decisions)

### **4.3 StackMap builder**

Test cases:

* Deterministic ordering  
* Stable IDs across runs (where intended)  
* Correct file → callsites mapping  
* Multi-language repo path grouping  
* Redaction behavior (if any exists)

---

## **5\. Integration Tests (static analysis pipeline)**

The static pipeline described in the TDD/TDD-old must be testable end-to-end with fixtures: repo scanning \+ chunk extraction \+ P1/P2 (+ optional P3) \+ validation \+ StackMap build .

### **5.1 Repo scanner \+ chunker**

* Correct file discovery (respect ignore rules)  
* Handles large files, binary files, generated dirs  
* Language-aware chunk boundaries  
* Syntax-error files drive **partial state**, not silent skip

### **5.2 Classifier correctness (fixture snapshots)**

For each repo fixture (A1–A5):

* Detect callsites with file+line  
* Identify provider/model when inferable  
* Detect patterns: streaming/batching/retries/caching/router/fallback  
* Detect runtime signals (vLLM/SGLang/TensorRT/Ollama)  
* Ensure **near-zero false positives**: better to miss than misidentify (PRD acceptance criterion)

### **5.3 Caching / resumability (filesystem persistence)**

* `.peakinfer/` artifacts exist and are re-used where appropriate (per TDD design decisions)  
* Re-run is faster / does not re-call LLM if cached mode exists  
* Cache invalidation rules are explicit and tested

---

## **6\. Integration Tests (runtime analysis pipeline)**

Using runtime fixture set B1–B4:

* Schema validation strictness  
* Aggregation correctness  
* Partial failure behavior (bad rows) is consistent with UX (“helpful, not empty”)

---

## **7\. Combined Analysis Tests (static \+ runtime)**

For each combined fixture (C):

### **7.1 Join correctness**

* Primary join: provider+model; secondary: intent; explicit callsite IDs override heuristics (if implemented)  
* Unmatched items are surfaced (no silent drops)  
* Drift output is deterministic and stable

### **7.2 Drift scenarios (must-have)**

1. Code-only provider/model (dead code)  
2. Events-only provider/model (hidden source)  
3. Model mismatch  
4. Pattern mismatch proxies  
5. Partial runtime coverage (some callsites have events, others don’t)

This is the PRD’s “gap where performance leaks” claim made operational .

---

## **8\. CLI UX Contract Tests (design doc enforced)**

The DD makes UX constraints enforceable (“fixed order”, “calm errors”, “no hype”, “agents must not leak”). These are testable.

### **8.1 Output ordering (snapshot)**

Validate the CLI sections appear in the required order (Scope → Detection → Structure → Meaning → Action) .

### **8.2 State tests**

* **Zero state**: “No inference usage detected” with helpful next steps  
* **Partial state**: explicit count \+ actionable retry  
* **Error state**: calm, specific, actionable (no stack traces by default)  
* **Success state**: shows where artifacts saved \+ next action

### **8.3 “Agent invisibility” tests**

The DD is explicit: internal agents must not be visible to users . Add snapshot tests ensuring CLI output never includes:

* “planning”, “thinking”, “agent”, chain-of-thought style status  
* internal tool names, prompt IDs (unless explicitly in `--verbose`)

---

## **9\. HTML Report Tests**

Validate:

* Required report section order  
* Scope section includes repo root, scanned files, languages, timestamp (trust builder)  
* InferenceMap is default-collapsed, expandable (no raw JSON as primary view)  
* “Trade-offs” section does not devolve into “pricing lookup” language

---

## **10\. Performance & Resource Tests (PRD acceptance)**

### **10.1 Runtime targets**

* 10k LOC in \< 60 seconds (or whatever the repo target is in your PRD acceptance section)  
* Memory \< 500 MB (if kept as target)

### **10.2 Scale tests**

* Repo with 100k LOC (scanner \+ chunker stress, caching behavior)  
* Events file with 1M rows (streaming parser, aggregation perf)

### **10.3 Profiling**

Track:

* latency per prompt (P1/P2/P3)  
* tokens in/out  
* cost per repo scan  
  (as called out in the TDD profiling tests)

---

## **11\. Privacy & Safety Tests**

Given PRD privacy stance (no telemetry to Kalmantic; code sent only to Anthropic for analysis) :

* Verify no network calls in offline mode (`events.jsonl` analysis)  
* Verify no upload/logging of source files beyond configured LLM call path  
* Ensure secrets redaction rules (if any) are covered by fixtures (repos containing `.env`, keys in code comments)

---

## **12\. Coverage Matrix (fixture → test suite)**

Create and maintain a single table in the repo:

* Rows: every fixture (A1–A5, B1–B4, C1–Cn)  
* Columns: static detection, pattern detection, runtime parsing, combined join, CLI states, HTML report, performance  
* Each cell links to the test file(s)

This prevents “we think we covered it” drift.

---

## **13\. What was missing in the old test doc (why this revision exists)**

Your v0.96 test doc had the right instincts (truth/trust/stability), but it didn’t fully operationalize your real-world fixture concerns:

* explicit SaaS vs hosted vs bare metal coverage  
* systematic repo+events combinations for drift testing  
* event generation \+ dirty-event perturbation  
* enforceable UX contract tests from the DD  
* explicit “agent invisibility” guardrail tests

This v1.0 test plan makes those gaps unmissable.

---

## **14\. Deliverables to add to the repo (concrete)**

1. `fixtures/repos/` with A1–A5 repos  
2. `fixtures/events/` with B1–B4 files  
3. `fixtures/combos/` mapping repo ↔ events  
4. `fixtures/generate/` scripts for JSONL synthesis \+ perturbation  
5. `tests/golden/` snapshots pinned to prompt versions (LLM-dependent)  
6. `tests/ux/` snapshot tests enforcing DD output ordering \+ state language

---

If you want, I can take your existing `fixtures/` directory (whatever you already have in code) and produce a **fixture inventory \+ coverage matrix** that points to exactly which scenario is still missing—and which test should own it.


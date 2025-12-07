# **PeakInfer — Technical Design Document v1.1**

**Claude-First Detection Architecture \+ Modular Prompt Suite**  
 *(Mapped to PRD v0.95 and Design Doc SLC v1)*

---

# **0\. Purpose**

PeakInfer’s v1 goal is to deliver:

* **Deterministic-feeling, magical callsite detection**

* **Cross-codebase inference mapping (StackMap)**

* **Pricing overlay \+ optimization insights**

* **Minimal codebase (SLC) with maximum strategic leverage**

Traditional static detection (AST \+ regex \+ hundreds of patterns) is powerful but heavy.  
 To ship faster, with less LOC, and higher breadth of coverage, we adopt:

### **👉 Claude-First Semantic Detection \+ Deterministic-Lite Validation**

Meaning:

* Claude does **semantic detection \+ classification**

* PeakInfer core does **scanning, chunking, validation, aggregation, pricing, rendering**

* All results must be **structured JSON**, deterministic through schema validators

* All LLM calls are **idempotent**, versioned, testable, and benchmarked

This preserves:

* **PRD Guardrail:** CLI-first, indispensable workflow

* **PRD Guardrail:** Avoiding dashboardware

* **PRD Guardrail:** Maintain StackMap as canonical primitive

* **Design Doc Principle:** Clarity over cleverness

* **Design Doc Principle:** Invisible UI with graceful states

* **Engineering Principle:** SLC — minimal LOC, complete functionality

---

# **1\. High-Level Architecture**

`+------------------------------+`  
`|        Repo Scanner          |`  
`+------------------------------+`  
            `|`  
            `v`  
`+------------------------------+`  
`|       Chunk Extractor        |`  
`| (language-aware chunking)    |`  
`+------------------------------+`  
            `|`  
            `v`  
`+------------------------------+`  
`|  P1: DETECT_CALLSITES        | <-- Claude Code SDK`  
`+------------------------------+`  
            `|`  
     `callsites[]`  
            `|`  
            `v`  
`+------------------------------+`  
`|  P2: CLASSIFY_CALLSITE       | <-- Claude Code SDK`  
`+------------------------------+`  
            `|`  
`classified_callsites[]`  
            `|`  
            `v`  
`+------------------------------+`  
`| P3: ESTIMATE_USAGE (opt)     | <-- Claude Code SDK`  
`+------------------------------+`  
            `|`  
            `v`  
`+------------------------------+`  
`|   Normalizer + Validator     |`  
`+------------------------------+`  
            `|`  
            `v`  
`+------------------------------+`  
`|       StackMap Builder       |`  
`+------------------------------+`  
            `|`  
            `v`  
`+------------------------------+`  
`|     Pricing Engine           |`  
`+------------------------------+`  
            `|`  
            `v`  
`+------------------------------+`  
`|        CLI Renderer          |`  
`+------------------------------+`

Core responsibilities:

* **Claude**: semantic detection, classification, structured reasoning

* **PeakInfer**: deterministic validation \+ mapping \+ pricing

---

# **2\. Claude Code SDK Integration Layer**

### **The SDK is used only in 3 places:**

1. **P1: Detect callsites in code chunks**

2. **P2: Classify each callsite precisely**

3. **P3: Estimate approximate usage characteristics**

Everything else is standard local code.

---

# **3\. The Prompt Suite (LLM Intelligence Layer)**

*(Modular, testable, versioned)*

## **3.1 Prompt Architectural Principles**

* **One task per prompt**

* **Strict JSON schema**

* **Version-tagged outputs**

* **Easy to unit-test with golden fixtures**

* **Confidence scoring mandatory**

* **No pricing in LLM** (pricing is deterministic)

* **All prompts are short, modular, and composable**

These prompts behave like callable “AI functions” in the SDK.

---

# **3.2 Prompt: P1\_DETECT\_CALLSITES**

*(Chunk-level, semantic scanning)*

### **Responsibility**

* Identify *possible* LLM/inference callsites

* Return coarse classification \+ line numbers

* High recall, permissible noise

### **Schema**

`{`  
  `"task": "detect_callsites",`  
  `"version": "1.0",`  
  `"analysis_id": "<string>",`  
  `"language": "<string>",`  
  `"file_path": "<string>",`  
  `"callsites": [`  
    `{`  
      `"id": "<string>",`  
      `"start_line": <int>,`  
      `"end_line": <int>,`  
      `"invocation_code": "<string>",`  
      `"coarse_call_kind": "...",`  
      `"coarse_task_kind": "...",`  
      `"confidence": <float>`  
    `}`  
  `]`  
`}`

### **Usage**

Used on every chunk produced by the scanner.

---

# **3.3 Prompt: P2\_CLASSIFY\_CALLSITE**

*(Deep classification, provider/model/runtime detection)*

### **Responsibility**

* Determine provider, model, framework, runtime

* Detect streaming, usage type, wrapper

* Provide short reasoning for traceability

### **Schema**

`{`  
  `"task": "classify_callsite",`  
  `"version": "1.0",`  
  `"callsite_id": "<string>",`  
  `"provider": "<string|null>",`  
  `"model": "<string|null>",`  
  `"framework": "<string|null>",`  
  `"runtime_or_gateway": "<string|null>",`  
  `"task_kind": "<string>",`  
  `"is_streaming": true | false | null,`  
  `"confidence": <float>,`  
  `"reasoning": {`  
    `"why_provider": "<string>",`  
    `"why_model": "<string>"`  
  `}`  
`}`

### **Usage**

Only called for callsites with confidence \> 0.3 from P1.

---

# **3.4 Prompt: P3\_ESTIMATE\_USAGE (optional)**

*(Token scale \+ frequency inference)*

### **Responsibility**

* Give coarse estimates for:

  * input token scale

  * output token scale

  * frequency patterns

### **Schema**

`{`  
  `"task": "estimate_usage",`  
  `"version": "1.0",`  
  `"callsite_id": "<string>",`  
  `"frequency_kind": "<enum>",`  
  `"input_token_scale": "<enum>",`  
  `"output_token_scale": "<enum>",`  
  `"confidence": <float>`  
`}`

Used only when user adds:  
 `--estimate-usage` or `--perf`.

---

# **4\. SDK Wrapper Layer**

All LLM operations are centralized in:

`/src/llm/claudeClient.ts`

Responsibilities:

* initialize SDK

* handle retries

* enforce timeouts

* enforce max tokens

* enforce JSON extraction & validation

* unify logs

* implement prompt templates

### **Example wrapper interface:**

`export interface ClaudeDetector {`  
  `detectCallsites(chunk: CodeChunk): Promise<P1DetectResponse>;`  
  `classifyCallsite(call: CallsiteCandidate): Promise<P2ClassifyResponse>;`  
  `estimateUsage(call: ClassifiedCallsite): Promise<P3EstimateResponse>;`  
`}`

### **Benefits**

* Perfect isolation

* Easy mocking for tests

* Pluggable (can replace with offline detectors later)

---

# **5\. Deterministic Validation Layer**

Claude outputs are **validated, not trusted**.

Validation steps:

* JSON schema validation

* Enum checking

* Range checking

* Remove low-confidence entries (\< 0.4 by default)

* Normalize provider/model names

* Map frameworks to canonical forms

This produces **clean, deterministic, reproducible results**.

---

# **6\. StackMap Builder**

Input:

* validated list of classified callsites

* file path

* language

* task kind

* provider/model/framework/runtime

Output:

`{`  
  `"files": [...],`  
  `"callsites": [...],`  
  `"models": [...],`  
  `"runtimes": [...]`  
`}`

This is the canonical product object per PRD.

This matches the Design Doc’s principles:

* Clear hierarchical structure

* Human-readable \+ machine-readable

* Invisible UX → users just see “PeakInfer magically found everything.”

---

# **7\. Pricing Engine**

Static `pricing.json`:

`{`  
  `"openai": {`  
    `"gpt-4o-mini": { "input": 0.00015, "output": 0.0006 },`  
    `"gpt-4o": ...`  
  `},`  
  `"anthropic": {`  
    `"claude-3.5-sonnet": ...`  
  `}`  
`}`

### **Responsibilities:**

* Look up pricing by provider/model

* Apply token scales from P3 (optional)

* Compute cost deltas

* Highlight hotspots

This aligns with PRD requirement:

“PeakInfer must provide pricing deltas and trustworthy cost insights.”

---

# **8\. CLI Renderer**

States (from Design Doc):

* **Zero State**: “No callsites detected”

* **Loading State**: spinner per file

* **Error State**: actionable errors

* **Success State**: StackMap \+ pricing table

Renderer outputs:

* summary (callsites, providers, models)

* file → callsites mapping

* model usage summary

* pricing table

* suggestions (optional)

Matches Julie Zhuo’s UX principles:

* clarity

* content-first layout

* thoughtful defaults

* invisible UI (focus on work, not interface)

---

# **9\. Mapping PRD → TDD → UX**

| PRD Requirement | TDD Component | UX Behavior |
| ----- | ----- | ----- |
| CLI-first, indispensable | Single-command CLI (`peakinfer analyze`) | Simple 1-command behavior |
| StackMap is canonical | StackMap builder | Clear summary & hierarchy |
| Pricing accuracy | Pricing engine | Pricing table, hotspot highlights |
| Avoid taxonomy rot | Prompt versions \+ schema validation | UI always shows model/version |
| High detection accuracy | P1/P2 prompts \+ validators | Feels “magical” & complete |
| SLC scope | Claude-first detection, minimal LOC | Clean UX, no overload |
| Error clarity | SDK wrapper \+ validator | Crisp actionable errors |

Everything cleanly maps across layers.

---

# **10\. Testing Strategy**

## **Unit Tests**

* JSON validator

* StackMap builder

* Pricing engine

* CLI renderer

## **Integration Tests**

* P1 → P2 pipeline

* Pricing overlay

* File scanning \+ chunking

## **Golden Fixtures (LLM-dependent tests)**

* small curated repos (OpenAI, Anthropic, LangChain)

* expected callsite outputs snapshot-tested

* prompt versioning preserved

## **Profiling Tests**

* latency per prompt

* tokens in/out

* cost per repo scan

---

# **11\. SLC v1 Scope (final)**

This design produces an SLC that is:

### **Simple**

* only 3 LLM prompts

* 1 wrapper

* 1 validator

* 1 StackMap builder

* 1 pricing engine

### **Lovable**

* magical detection

* clean output

* low cognitive load

### **Complete**

* covers all major providers

* all common patterns

* pricing

* StackMap

* CI-friendly

---

# **12\. Final Summary**

This design:

* Reduces deterministic code by \~80%

* Centralizes intelligence in Claude

* Maintains deterministic correctness through strict validation

* Fully aligns PRD → TDD → UX

* Is testable, profileable, and SLC-perfect

* Supports fast v1 shipping

* Leaves room for future deterministic accuracy improvements

* Avoids scope drift (PRD Guardrails)


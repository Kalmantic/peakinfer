# **PeakInfer — Design Document v1.0**

**Behavior-First, Invisible-UI Specification (Updated to match PRD v1.0 \+ Agent Architecture Patterns)**

**Product:** PeakInfer  
**Organization:** Kalmantic AI Labs  
**Version:** 1.0  
**Date:** December 2025  
**Design Owner:** Julie Zhou (design guidance persona)

---

## **0\. Purpose of This Design Document**

The PRD defines **what** PeakInfer does.  
This design document defines **how it should feel to use it** — and constrains implementation so we don’t accidentally ship “busy UI” instead of **truth \+ trust**.

PeakInfer succeeds when a user can run one command and quickly say:

“Oh. That explains it.”

Design is “done” when:

* The output is understandable **without narration**  
* The output is **forwardable** (to a teammate, to a PR, to a doc)  
* The UI disappears and the insight remains

PeakInfer is not trying to feel smart. It’s trying to feel **reliable**.

---

## **1\. Core User Behavior**

**The user’s goal is not to run PeakInfer.**  
**The user’s goal is to stop guessing.**

So every design decision must answer one question:

**“What behavior does this enable?”**

PeakInfer’s primary behavior outcomes:

1. **Orient** quickly (what did you scan? what did you analyze?)  
2. **Trust** quickly (why should I believe this output?)  
3. **Locate** quickly (where is inference happening?)  
4. **Compare** quickly (code intent vs runtime reality)  
5. **Decide** confidently (what matters next — if anything)

If a feature does not move one of these behaviors, it’s out of scope.

---

## **2\. Mental Model (The Order Users Understand Things)**

Users form understanding in a stable sequence. PeakInfer must follow it everywhere:

1. **Scope** — What did you look at?  
2. **Structure** — Where is inference happening?  
3. **Reality** — What happened at runtime?  
4. **Meaning** — What does this imply for performance headroom?  
5. **Next step** — What should I do next?

Violating this order increases cognitive load and reduces trust.

---

## **3\. Design Principles (Operational Rules)**

### **3.1 Behavior First**

* Progress messages exist to reduce anxiety, not to show off internals  
* Reports exist to enable sharing, not exploration  
* Defaults exist to remove decisions, not to hide power

### **3.2 Clarity Over Cleverness**

* No playful language  
* No anthropomorphic phrasing (“I found…”, “I think…”)  
* No jargon without a short, concrete label

### **3.3 Content-Driven Layout**

* Hierarchy is created by **order \+ spacing \+ grouping**  
* Not decoration, not ASCII art, not “visual noise”

### **3.4 Thoughtful Defaults**

* `peakinfer analyze .` should “just work” for the common case  
* Advanced options must exist, but should not be the first thing users see

### **3.5 State Completeness**

Zero, loading, partial failure, error, and success are first-class experiences.

### **3.6 Transition Excellence (Even in CLI)**

The sequence of outputs is the “motion design” of the terminal.

### **3.7 Accessible by Design**

* Don’t rely on color alone for meaning  
* Keep lines readable (target: 80–100 chars max)  
* Provide text labels for severity and status

### **3.8 Invisible UI**

Users should remember **what they learned**, not the interface.

---

## **4\. Product Surfaces (Where UX Exists)**

PeakInfer is CLI-first, but outputs must be designed to travel:

1. **CLI output** (primary)  
2. **Artifacts** (JSON: InferenceMap/StackMap; plus summaries)  
3. **HTML report** (shareable; optional)  
4. **Future surfaces** (GitHub Action, SaaS) must inherit the same mental model

---

## **5\. Primary User Journeys**

### **5.1 Journey A — Static Analysis (Code Truth)**

**User intent:** “Show me where inference exists in this codebase.”

Command:

```shell
peakinfer analyze .
```

Success moment:

* User sees a **structured map** of inference points with file+line anchors  
* User understands “what exists” without spelunking the repo

### **5.2 Journey B — Runtime Events (Runtime Truth, Offline)**

**User intent:** “Show me what actually happened in production.”

Command:

```shell
peakinfer analyze events.jsonl
```

Success moment:

* User sees distributions (providers/models), latency percentiles, token realities  
* User can trust this because it’s from their supplied events file

### **5.3 Journey C — Combined Analysis (Drift / Mismatch)**

**User intent:** “Do my code and runtime reality match?”

Command:

```shell
peakinfer analyze ./src --events production.jsonl
```

Success moment:

* Drift is explicitly surfaced as a list of mismatches  
* Unmatched items are not buried (mystery is the enemy of trust)

### **5.4 Journey D — Trade-Offs (Performance Meaning)**

**User intent:** “Are we near achievable peak? Where is headroom wasted?”

Command:

```shell
peakinfer tradeoffs
```

Success moment:

* User sees “dominated configurations” and constraint framing  
* No moralizing about cost; cost exists only to explain trade-offs

---

## **6\. CLI Interaction Design (The Core Spec)**

### **6.1 Output Order (Fixed)**

Every run should follow this order:

1. **Header**  
2. **Scope summary**  
3. **Processing progress**  
4. **Results summary**  
5. **Structure (InferenceMap preview)**  
6. **Reality (runtime summary if present)**  
7. **Meaning (trade-offs/drift)**  
8. **Artifacts saved \+ next steps**

This order is not negotiable. It is the product’s cognitive ramp.

---

### **6.2 Header**

Purpose: immediate orientation, predictable entry.

Example:

```
PeakInfer v1.0  •  Inference Analysis
Repo: ./  •  Mode: static
```

Rules:

* No ASCII banners  
* Keep it calm and factual

---

### **6.3 Scope Summary**

Purpose: “What did you look at?” (trust begins here)

Example:

```
Scope
  Files scanned: 847
  LOC (approx): 12,340
  Languages: Python, TypeScript
  Excludes: node_modules/, dist/, .git/
```

If exclusions are user-defined, state them explicitly.

---

### **6.4 Progress (Transition Excellence in Text)**

Purpose: reduce anxiety; communicate where time is going.

Progress should be phase-based (not noisy per-file spam):

```
Progress
  1/4 Scanning files…
  2/4 Detecting inference points…
  3/4 Classifying providers/models/patterns…
  4/4 Building InferenceMap + summaries…
```

Rules:

* Use stable phase names across runs  
* If a phase is slow, show a calm “still working” heartbeat, not a flood

---

### **6.5 Results Summary (Fast “Did you find anything?”)**

Example:

```
Summary
  Inference Points: 23
  Providers: openai (12), anthropic (7), together (4)
  Models: gpt-4o (9), claude-3.5-sonnet (7), llama-3-70b (4)
  Patterns detected: streaming (6), retries (11), batching (2)
```

Rules:

* Only show detected patterns (don’t list absent capabilities)  
* Prefer counts over prose

---

### **6.6 Structure Preview (InferenceMap / StackMap)**

Purpose: show “where” and “how it’s shaped” before any deeper meaning.

Example:

```
InferenceMap (preview)
  src/services/openai_client.py
    L42  openai.chat.completions.create  model=gpt-4o  streaming=yes
  src/agents/summarize.ts
    L88  anthropic.messages.create       model=claude-3.5-sonnet
  src/routing/router.py
    L17  provider=router  fallback_chain=yes
```

Rules:

* Always include file \+ line  
* Keep preview short; point to artifact for full map

---

### **6.7 Runtime Summary (Only When Events Provided)**

Purpose: “what happened” with percentiles (humans trust percentiles).

Example:

```
Runtime (from events.jsonl)
  Requests: 18,204
  Latency (ms): p50=420  p95=2,340  p99=4,980
  Tokens: in=78.2M  out=6.4M
  Top intents: summarize (42%), chat (31%), extract (12%)
```

Rules:

* Clearly label the source file  
* If schema fields are missing, fail with an actionable error (see states)

---

### **6.8 Drift \+ Meaning (Combined Mode)**

Purpose: surface mismatches without hiding uncertainty.

Example:

```
Drift
  In code, not in events:
    - anthropic / claude-3.5-sonnet (2 inference points)
  In events, not in code:
    - openai / gpt-4.1-mini (observed 1,204 calls)
  Pattern mismatch:
    - batching present in code, absent in runtime (router.py)
```

Rules:

* Drift must be explicit lists (not buried in paragraphs)  
* “Unknown” is acceptable; hidden is not

---

### **6.9 Trade-Offs Output (Performance Meaning)**

Trade-offs must always be framed by constraint:

Example:

```
Trade-offs
  System appears latency-bound (p95 high, low batching incidence)

  Dominated configurations:
    - gpt-4o used for summarize where output_tokens are small (high TTFT cost sensitivity)
      Constraint: latency-bound → provider swap alone unlikely to help without batching/streaming discipline

  Headroom candidates:
    - 6 inference points with streaming enabled but high p95: likely upstream queueing or retry storms
```

Rules:

* No “do X” without “because Y” and “under constraint Z”  
* Never promise savings; provide clarity

---

### **6.10 Artifacts \+ Next Steps (Always End with Closure)**

Example:

```
Saved
  .peakinfer/peakinfer-stackmap.json
  .peakinfer/peakinfer-summary.json
  .peakinfer/peakinfer-report.html

Next
  → peakinfer analyze . --events production.jsonl   (compare code vs runtime)
  → peakinfer tradeoffs                             (performance meaning)
```

Rules:

* Always tell the user where outputs went  
* End with 1–2 relevant next actions, not a menu

---

## **7\. State Completeness (Zero / Loading / Partial / Error / Success)**

### **7.1 Zero State (Nothing Found)**

Must feel helpful, not empty.

```
No inference usage detected.

Checked for:
  • common providers (openai, anthropic, …)
  • known frameworks (langchain, llamaindex, …)
  • common self-hosted runtimes (vllm, sglang, …)

If you expected results:
  → check wrapper modules (custom clients)
  → check dynamic imports / reflection
  → try: peakinfer analyze . --deep
```

### **7.2 Partial State (Some Failures)**

Partial is common in real repos. Treat it as normal.

```
Partial results
  Files scanned: 843 / 847
  Skipped: 4 (syntax errors)

Your output is still valid.
To retry skipped files:
  → peakinfer analyze . --retry-skipped
```

### **7.3 Error State (Actionable, Calm)**

Bad:

* “Invalid schema”  
  Good:  
* what’s wrong, where, and what to do

```
Error: events file missing required field "latency_ms"
File: production.jsonl
Example required schema:
  id, ts, provider, model, input_tokens, output_tokens, latency_ms
```

### **7.4 Success State**

Success is not “big celebration.” Success is **closure \+ trust**.

---

## **8\. The Agent Design Pattern (How Implementation Must Support UX)**

PeakInfer’s agent architecture is not a technical flex. It’s a UX dependency.

### **8.1 Two-Pass Execution (Plan → Execute)**

**Why it matters for UX:**

* Predictable progress phases  
* Clear failure isolation (“Task 3 failed, rest succeeded”)  
* Resumability and caching become trustworthy, not magical

User-visible mapping:

* “Planning…” appears briefly only in `--verbose`  
* Default mode shows stable phase progress (Scanning → Detecting → Classifying → Building)

### **8.2 Filesystem-Based Context (Artifacts as Product)**

**Why it matters for UX:**

* Trust: outputs are inspectable  
* Shareability: artifacts are portable  
* Repeatability: reruns can reuse cached steps without confusing the user

Design rule:

* `.peakinfer/` is the user’s “case file”  
* Never hide where it lives  
* Never silently overwrite without telling the user

### **8.3 Callback-Driven UI (Decoupled Surfaces)**

**Why it matters for UX:**

* Same behavioral experience across CLI, HTML report, future GitHub Action  
* State completeness can be enforced consistently (callbacks \= consistent state hooks)

Design rule:

* Every meaningful phase transition must have a callback  
* Every callback must map to an intentional user-visible behavior (or remain hidden)

### **8.4 Streaming (Perceived Speed \+ Control)**

**Why it matters for UX:**

* Users feel progress earlier  
* Long explanations don’t block the “summary truth”

Design rule:

* Stream only where it improves comprehension (e.g., report rendering, verbose explanations)  
* Never stream raw noise (partial JSON spew)

### **8.5 History Management (Only if/when PeakInfer becomes interactive)**

If a future mode introduces conversational review (e.g., “explain this drift”), history must be summarized \+ selected, not dumped. Otherwise trust collapses under verbosity.

---

## **9\. Accessibility Rules (CLI \+ Report)**

* Do not rely on red/green alone for success/failure  
* Use labels: `OK`, `WARN`, `ERROR`  
* Keep line lengths readable  
* Ensure HTML report meets keyboard navigation basics (headings, skip links, focus states)

---

## **10\. What PeakInfer Must Never Become**

To protect the product’s clarity:

* A dashboard of charts with no decisions  
* A stream of “recommendations” with no constraints  
* A prompt wrapper that can’t be rerun deterministically  
* A tool that forces users to interpret uncertainty without labeling it

---

## **11\. Design QA Checklist (Ship Gate)**

Before shipping any UX change:

1. Does this enable a specific user behavior?  
2. Does the output follow: Scope → Structure → Reality → Meaning → Next step?  
3. Are all states complete (zero/loading/partial/error/success)?  
4. Can a user trust this without reading docs?  
5. Is the result forwardable without narration?  
6. Is there any cleverness that should be deleted?  
7. Does this preserve “invisible UI”?

If any answer is “no,” it doesn’t ship.

---

## **12\. Summary**

PeakInfer’s design is not about polish. It’s about **psychological safety and truth**:

* Users feel oriented  
* Users feel confident  
* Users stop guessing

The agent architecture exists to support these behaviors — not to impress.

PeakInfer is a flashlight.  
Our job is to keep the glass clean.


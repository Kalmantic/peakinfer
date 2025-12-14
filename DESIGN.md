# PeakInfer Design Document

**Version:** 2.0
**Status:** Implementation Ready
**Philosophy:** Simple, Lovable, Complete

---

## 1. Product Vision

PeakInfer is a CLI that reveals LLM inference performance truth.

**One sentence:** "It tells you whether your inference is near peak — and why it isn't."

### What Makes It Magical
- Insights that reveal what you couldn't see before
- "Your streaming is fake" / "Your fallback has never fired" / "You're at 34% of achievable throughput"
- Remote templates that evolve independently
- InferenceMax reference envelopes that contextualize performance
- HTML/PDF reports you can share with your team

### PeakInfer Is
- A flashlight, not a lever
- Deterministic and auditable
- Artifact-producing
- Usable offline (for runtime analysis)

### PeakInfer Is Not
- An IDE assistant
- An observability platform
- A real-time monitoring system
- An auto-optimization engine

**Humans decide. PeakInfer clarifies.**

---

## 2. Architecture

### 2.1 Multi-Agent Orchestration

PeakInfer uses a multi-agent architecture for analysis:

| Agent | Purpose |
|-------|---------|
| **DiscoveryAgent** | Scan repository and discover inference points |
| **AnalyzerAgent** | Semantic classification with LLM analysis |
| **JoinerAgent** | Correlate static + runtime truth |
| **InsightAgent** | Generate findings from templates |

### 2.2 Two-Pass Execution Model

```
Pass 1: PLAN (WHAT to do)
  Input -> Generate task descriptions -> Execution Plan

Pass 2: EXECUTE (HOW to do it)
  For each task:
    Description -> Resolve to tool call -> Execute -> Save result
```

**Benefits:**
- Predictable progress phases
- Clear failure isolation
- Resumability and caching
- Debuggable (know exactly where failure occurred)

### 2.3 System Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                              USER                                │
│  peakinfer analyze .                                             │
│  peakinfer analyze . --events prod.jsonl --html --pdf            │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                         CLI (cli.ts)                             │
│  - Argument parsing (Commander)                                  │
│  - Mode detection (static | runtime | combined)                  │
│  - Invokes Agent                                                 │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                       AGENT (agent.ts)                           │
│                                                                  │
│  Pass 1: PLAN                                                    │
│    Determine tasks: scan → analyze → join → insights → save      │
│                                                                  │
│  Pass 2: EXECUTE                                                 │
│    Run each task, report progress, handle errors                 │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        CORE PIPELINE                             │
│                                                                  │
│   Scanner ──▶ Analyzer ──▶ Joiner ──▶ Insights                  │
│                  │           ▲                                   │
│                  │      Runtime Parser                           │
│                  │           ▲                                   │
│                  │      events.jsonl                             │
│                  ▼                                               │
│             Templates + Envelopes                                │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        OUTPUT LAYER                              │
│                                                                  │
│   Renderer ────▶ stdout                                          │
│   HTML Gen ────▶ report.html                                     │
│   PDF Gen  ────▶ report.pdf                                      │
│   Artifacts ───▶ .peakinfer/                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Mental Model Order

Users form understanding in this sequence. Never violate it:

```
1. Scope     — What did you look at?
2. Structure — Where is inference happening?
3. Reality   — What happened at runtime?
4. Meaning   — What does this imply?
5. Next step — What should I do next?
```

---

## 4. Fixed Output Order

```
1. Header
2. Progress (as it happens)
3. Findings (insights - the value)
4. Scope (what was analyzed)
5. Runtime (if events provided)
6. Drift (if combined analysis)
7. Saved (artifacts + next steps)
```

**This order is not negotiable. It is the product's cognitive ramp.**

---

## 5. State Completeness

Every state is a first-class experience:

| State | Behavior |
|-------|----------|
| **Zero** | Explains what was checked, suggests alternatives |
| **Loading** | Phase-based progress with spinner animation |
| **Partial** | Shows what worked, what didn't, continues |
| **Error** | Actionable: what, where, how to fix |
| **Success** | Insights first, scope second, artifacts last |

### Zero State
```
no inference usage detected.

checked for:
  common providers (openai, anthropic, google, together, fireworks...)
  frameworks (langchain, llamaindex, dspy...)
  self-hosted runtimes (vllm, sglang, ollama, tgi...)

if you expected results:
  check wrapper modules or custom client abstractions
  check dynamic imports or runtime configuration
```

### Loading State (with progress bar)
```
scanning files... ░░░░░░░░░░   0%
scanning files... 31 files ✓
analyzing codebase... ██████░░░░  60% src/agent.ts
analyzing codebase... 11 inference points ✓
generating insights... 4 findings ✓
```

### Error State
```
error: events file missing required field

  file: production.jsonl
  line: 847
  missing: latency_ms
```

---

## 6. Copy Rules

### Do
- Keep it calm and factual
- Use concrete labels
- Be actionable in errors
- End with closure + next steps

### Don't
- No playful language
- No anthropomorphic phrasing ("I found...", "I think...")
- No jargon without explanation
- No ASCII banners or decoration

### Insight Copy Formula

**Good:**
```
Your streaming is fake
Your fallback has never fired
You're at 34% of achievable throughput
6 inference points with high p95 latency
```

**Bad:**
```
I found some issues with your code
There might be a problem here
Consider optimizing this
```

---

## 7. File Structure

```
2peakinfer/
├── package.json
├── tsconfig.json
├── DESIGN.md
├── CLAUDE.md
│
├── src/
│   ├── types.ts          # Zod schemas
│   ├── costs.ts          # LiteLLM pricing (24hr cache)
│   ├── envelopes.ts      # InferenceMax reference data
│   │
│   ├── scanner.ts        # File discovery
│   ├── analyzer.ts       # LLM semantic analysis
│   ├── runtime.ts        # Events parser + aggregator
│   ├── joiner.ts         # Static + runtime correlation
│   │
│   ├── templates.ts      # Template loader
│   ├── insights.ts       # Template evaluator
│   ├── impact.ts         # Impact analysis
│   │
│   ├── agents/
│   │   └── index.ts      # DiscoveryAgent, AnalyzerAgent, etc.
│   │
│   ├── tools/
│   │   └── index.ts      # Constrained tool registry
│   │
│   ├── agent.ts          # Two-pass orchestration
│   ├── renderer.ts       # Terminal output with ora spinner
│   ├── html.ts           # HTML report generator
│   ├── pdf.ts            # PDF report generator
│   ├── artifacts.ts      # .peakinfer/ persistence
│   │
│   └── cli.ts            # Entry point
│
└── prompts/              # Analysis prompt templates
```

---

## 8. Artifacts

```
.peakinfer/
├── inferencemap.json     # Inference topology
├── insights.json         # Findings
├── joined.json           # Static + runtime correlation
├── runtime.json          # Event summary
├── <project>_peakinfer_report.html
├── <project>_peakinfer_report.pdf
└── cache/
    ├── templates/        # Cached remote templates
    └── pricing.json      # LiteLLM pricing (24hr TTL)
```

**Why JSON:**
- Zero dependencies
- Easy to inspect
- Git-diffable
- Portable

---

## 9. Design Rationale

### Why LiteLLM for Pricing?
Model pricing changes frequently. LiteLLM provides:
- Most comprehensive model pricing database (500+ models)
- Community-updated within days of new releases
- MIT licensed, hosted on GitHub
- Single JSON file, no API key needed
- 24-hour cache survives restarts, works offline with stale data

### Why InferenceMax Envelopes?
Raw performance numbers lack context. Envelopes define "what good looks like":
- Transforms data into insight: "You're at 34% of achievable throughput"
- Enables apples-to-apples comparison across providers
- Reveals whether infrastructure or model is limiting

### Why Two-Pass Execution?
Complex analysis has multiple steps with dependencies. Without planning:
- User sees random progress
- Errors appear mid-execution with no context
- Can't estimate completion

Two-pass provides:
- **Predictability:** User knows what's coming
- **Trust:** Transparent about process
- **Debuggability:** Know exactly where failure occurred

### Why Remote Templates?
Insight patterns evolve. New antipatterns emerge. Remote templates enable:
- New insights deployed without CLI changes
- Community can contribute via PR
- No CLI update needed for users

---

## 10. Success Criteria

### Functional
- Static analysis detects callsites with >90% accuracy
- Runtime analysis parses JSONL/JSON/CSV correctly
- Combined analysis correlates and detects drift
- Insights generate "aha" moments

### Performance
- 10k LOC repo analyzed in <60 seconds
- Memory usage <500MB

### UX (Julie Zhou)
- All 5 states are complete
- Output order is fixed and logical
- No agent internals visible
- Errors are actionable

### Magic
- Streaming drift detection works
- Cost concentration insight works
- Dead code detection works
- Throughput gap (vs InferenceMax) works
- User says "I didn't know that was possible"

---

## 11. Sample Output

```
PeakInfer v1.0.45

scanning files... 31 files ✓
analyzing codebase... 11 inference points ✓
generating insights... 4 findings ✓

Potential Performance Improvement across 11 inference points
  -99% cost

By Layer
  1. Model          ~99% avg  (4 items)

Quick Wins
  [!] GPT-4 → GPT-4o-mini (150x cheaper) (99% cost reduction)

Scope
  Inference Points: 11
  Providers: openai, anthropic
  Models: gpt-4o, claude-sonnet-4-20250514

Findings
  [-] GPT-4 → GPT-4o-mini (150x cheaper) [model] 99% cost reduction
      4 inference points

Saved
  .peakinfer/inferencemap.json
  .peakinfer/insights.json
  .peakinfer/project_peakinfer_report.pdf

Next
  open .peakinfer/project_peakinfer_report.pdf
  peakinfer . --events <logs.jsonl>   (compare code vs runtime)
```

---

## 12. Design QA Checklist

Before shipping any change:

1. Does this enable a specific user behavior?
2. Does output follow: Scope → Structure → Reality → Meaning → Next step?
3. Are all states complete (zero/loading/partial/error/success)?
4. Can a user trust this without reading docs?
5. Is the result forwardable without narration?
6. Is there any cleverness that should be deleted?
7. Does this preserve "invisible UI"?

**If any answer is "no," it doesn't ship.**

---

## 13. Summary

```
Simple:
  - Focused on one problem
  - Clear module boundaries
  - Multi-agent orchestration

Lovable:
  - Insights that reveal hidden truth
  - State completeness at every edge
  - Calm, factual, forwardable output
  - Progress bar with ora spinner

Complete:
  - Two-pass execution with resumability
  - Artifacts for context engineering
  - HTML and PDF reports
  - All five states handled
```

**PeakInfer is a flashlight. Our job is to keep the glass clean.**

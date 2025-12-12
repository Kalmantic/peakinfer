# PeakInfer — Complete Design Document

**Version:** 1.0
**Status:** Implementation Ready
**Approach:** SLC (Simple, Lovable, Complete) + Magical Experience

---

## 0. Product Trifecta

Great AI products nail three things:

| Pillar | PeakInfer Implementation |
|--------|-------------------------|
| **Magical Interface** | Insights that reveal hidden truth, Julie Zhou state-completeness, invisible agent internals |
| **Enterprise Integration** | File-based events, HTML reports, `.peakinfer/` artifacts, MCP server (v1.1) |
| **Living Intelligence** | Remote templates, LiteLLM pricing (24hr cache), updatable InferenceMax envelopes |

---

## 1. Product Summary

PeakInfer is a CLI that reveals LLM inference performance truth.

**One sentence:** "It tells you whether your inference is near peak — and why it isn't."

**What makes it magical:**
- Insights that reveal what you couldn't see before
- "Your streaming is fake" / "Your fallback has never fired" / "You're at 34% of achievable throughput"
- Remote templates from `peakinfer_templates` that evolve independently
- InferenceMax reference envelopes that contextualize your performance
- HTML report you can share with your team

---

## 1.1 Design Rationale

### Why LiteLLM for Pricing?

**Problem:** Model pricing changes frequently. OpenAI, Anthropic, and others update prices, add new models, and deprecate old ones. Hardcoding prices means:
- Stale data within weeks
- Manual updates for every new model
- User frustration when costs are wrong

**Solution:** Fetch from LiteLLM's community-maintained pricing JSON.

**Why LiteLLM specifically:**
- Most comprehensive model pricing database (500+ models)
- Community-updated within days of new releases
- MIT licensed, hosted on GitHub
- Single JSON file, no API key needed

**24-hour cache reasoning:**
- Prices rarely change more than daily
- Reduces network calls
- Works offline with stale data (better than nothing)
- Disk persistence survives process restarts

---

### Why InferenceMax Envelopes?

**Problem:** Raw performance numbers lack context.

```
Your latency: 420ms
```

Is that good? Bad? Depends on the model, provider, and what's achievable.

**Solution:** Reference envelopes that define "what good looks like."

**Why it matters:**
- Transforms data into insight: "You're at 34% of achievable throughput"
- Enables apples-to-apples comparison across providers
- Reveals whether infrastructure is limiting or model is limiting
- Answers the most important question: "Am I getting what I'm paying for?"

**Why hardcoded (v1.0):**
- Ships fast (Boris principle)
- Reference data changes slowly (quarterly at most)
- Can be made remote in v1.1 without architecture change

---

### Why MCP for Runtime Events (v1.1)?

**Problem (v1.0):** Users must export events to file, then run CLI.

```
# Today's workflow
1. Add logging to app
2. Export logs to JSONL file
3. Run `peakinfer analyze ./repo --events prod.jsonl`
4. Repeat when you want fresh data
```

**Solution (v1.1):** MCP server that accepts real-time event streaming.

**Why MCP:**
- Native Claude Code integration
- Standard protocol (no custom clients)
- Resources + Tools paradigm fits perfectly
- User can ask "How's my inference doing?" mid-conversation

**MCP Resources:**
- `peakinfer://events/summary` - Current event stats
- `peakinfer://insights/current` - Live insights

**MCP Tools:**
- `push_event(event)` - SDK pushes events here
- `analyze_now()` - Trigger analysis on demand
- `get_insights()` - Return current findings

**Why v1.1 not v1.0:**
- File-based works and ships faster
- MCP adds complexity (server process, SDK)
- SLC: get core value first, enhance later

---

### Why File Artifacts (.peakinfer/)?

**Problem:** Context engineering. Future runs, CI/CD, and team sharing need persistent state.

**Why .peakinfer/ directory:**
- Git-friendly (can be .gitignored or committed)
- Predictable location
- Machine-readable JSON for CI/CD integration
- Human-readable HTML for team sharing

**Artifact strategy:**

| File | Purpose | Context Engineering Value |
|------|---------|--------------------------|
| `inferencemap.json` | Code analysis | Compare across commits |
| `insights.json` | Findings | Track improvement over time |
| `joined.json` | Correlation | Debug drift signals |
| `runtime.json` | Event summary | Compare across deployments |
| `report.html` | Human view | Share with team/stakeholders |
| `cache/templates/` | Template cache | Offline mode support |
| `cache/pricing.json` | LiteLLM cache | 24hr TTL, survives restarts |

**Why JSON not database:**
- Zero dependencies
- Easy to inspect and debug
- Git-diffable
- Portable across machines

---

### Why Two-Pass Agent Execution?

**Problem:** Complex analysis has multiple steps with dependencies. Without planning:
- User sees random progress
- Errors appear mid-execution with no context
- Can't estimate completion

**Solution:** Separate Plan from Execute.

**Pass 1: Plan**
```
[1/7] Scan repository
[2/7] Analyze callsites
[3/7] Parse runtime events
[4/7] Correlate static + runtime
[5/7] Load insight templates
[6/7] Generate findings
[7/7] Save artifacts
```

User knows exactly what will happen before it happens.

**Pass 2: Execute**
- Run each task in order
- Report progress
- Handle failures gracefully
- Continue or abort based on severity

**Why this matters (Julie Zhou):**
- **Predictability:** User knows what's coming
- **Trust:** Transparent about process
- **Debuggability:** Know exactly where failure occurred
- **UX:** Progress indicator with meaningful steps (not "thinking...")

**Why not single-pass:**
- Single-pass hides complexity
- User sees spinning cursor, doesn't know if stuck
- Can't parallelize without planning first
- Can't estimate time without knowing work

---

### Why Remote Templates?

**Problem:** Insight patterns evolve. New antipatterns emerge. Thresholds need tuning.

**With hardcoded insights:**
- Every improvement requires CLI update
- User must upgrade to get new insights
- Can't A/B test different thresholds
- Community can't contribute patterns

**With remote templates:**
- New insights deployed without CLI changes
- Backward compatible (templates are versioned)
- Community can contribute via PR
- A/B testing possible via manifest

**Template lifecycle:**
1. Community identifies new antipattern
2. PR adds template to `peakinfer_templates`
3. All users get it on next analysis (within 24hr cache TTL)
4. No CLI update needed

**Why YAML:**
- Human readable and writable
- Supports comments for documentation
- Standard format (no learning curve)
- Easy to validate with schema

---

### Why Julie Zhou State Completeness?

**Problem:** Most CLIs handle happy path well, fail at edges.

**The five states:**

| State | Traditional CLI | PeakInfer |
|-------|-----------------|-----------|
| **Zero** | Silent or cryptic | Explains what was checked, suggests alternatives |
| **Loading** | Spinner | Numbered task list with progress |
| **Partial** | Crashes or ignores | Shows what worked, what didn't, continues with partial data |
| **Error** | Stack trace | Actionable message: what, where, how to fix |
| **Success** | Data dump | Insights first, scope second, artifacts last |

**Why this matters:**
- Zero state prevents "is it working?" confusion
- Loading state builds trust through transparency
- Partial state respects user's time (some data > no data)
- Error state enables self-service debugging
- Success state delivers value, not just data

**Fixed output order:**
1. Header
2. Planning (what will happen)
3. Progress (as it happens)
4. Findings (insights - the value)
5. Scope (what was analyzed)
6. Runtime (if events provided)
7. Drift (if combined analysis)
8. Saved (artifacts for follow-up)

User learns the pattern once, knows exactly where to look.

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                   USER                                       │
│                                                                              │
│   peakinfer analyze ./repo                                                   │
│   peakinfer analyze ./repo --events prod.jsonl                               │
│   peakinfer analyze events.jsonl                                             │
│   peakinfer analyze ./repo --events prod.jsonl --html --open                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                               CLI (cli.ts)                                   │
│                                                                              │
│   - Argument parsing (Commander)                                             │
│   - Mode detection (static | runtime | combined)                             │
│   - Invokes Agent                                                            │
│   - Exit codes                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            AGENT (agent.ts)                                  │
│                                                                              │
│   TWO-PASS EXECUTION                                                         │
│                                                                              │
│   Pass 1: PLAN                                                               │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  Determine tasks based on inputs:                                    │   │
│   │    - Scan repository (if path is directory)                          │   │
│   │    - Analyze callsites (if directory)                                │   │
│   │    - Parse runtime events (if events file)                           │   │
│   │    - Correlate static + runtime (if both)                            │   │
│   │    - Load templates                                                  │   │
│   │    - Generate insights                                               │   │
│   │    - Render output                                                   │   │
│   │    - Generate HTML (if --html)                                       │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   Pass 2: EXECUTE                                                            │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  For each task in plan:                                              │   │
│   │    - Report progress to renderer                                     │   │
│   │    - Execute task                                                    │   │
│   │    - Handle errors gracefully                                        │   │
│   │    - Continue or abort based on severity                             │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            CORE PIPELINE                                     │
│                                                                              │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│   │ Scanner  │───▶│ Analyzer │───▶│  Joiner  │───▶│ Insights │              │
│   │          │    │  (LLM)   │    │          │    │  Engine  │              │
│   └──────────┘    └──────────┘    └──────────┘    └──────────┘              │
│        │                               ▲               │                     │
│        │          ┌──────────┐         │               │                     │
│        │          │ Runtime  │─────────┘               │                     │
│        │          │ Parser   │                         │                     │
│        │          └──────────┘                         │                     │
│        │               ▲                               │                     │
│        │               │                               ▼                     │
│        │          events.jsonl              ┌──────────────────┐             │
│        │                                    │    Templates     │             │
│        ▼                                    │ (remote + local) │             │
│   .gitignore                                └──────────────────┘             │
│                                                      │                       │
│                                                      ▼                       │
│                                             ┌──────────────────┐             │
│                                             │   Envelopes      │             │
│                                             │  (InferenceMax)  │             │
│                                             └──────────────────┘             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              OUTPUT LAYER                                    │
│                                                                              │
│   ┌──────────────┐         ┌──────────────┐         ┌──────────────┐        │
│   │   Renderer   │         │     HTML     │         │   Artifacts  │        │
│   │  (terminal)  │         │   Generator  │         │  (.peakinfer)│        │
│   └──────────────┘         └──────────────┘         └──────────────┘        │
│          │                        │                        │                 │
│          ▼                        ▼                        ▼                 │
│       stdout                 report.html            inferencemap.json        │
│                                                     insights.json            │
│                                                     runtime.json             │
│                                                     joined.json              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. File Structure

```
2peakinfer/
├── package.json
├── tsconfig.json
├── DESIGN.md                    # This document
├── CLAUDE.md                    # Claude Code guidance
│
├── src/
│   ├── types.ts                 # All Zod schemas (90 lines)
│   ├── costs.ts                 # LiteLLM pricing with 24hr cache (60 lines)
│   ├── envelopes.ts             # InferenceMax reference data (60 lines)
│   │
│   ├── scanner.ts               # File discovery (50 lines)
│   ├── analyzer.ts              # LLM semantic analysis (80 lines)
│   ├── runtime.ts               # Events parser + aggregator (80 lines)
│   ├── joiner.ts                # Static + runtime correlation (70 lines)
│   │
│   ├── templates.ts             # Remote template loader (90 lines)
│   ├── insights.ts              # Template evaluator (120 lines)
│   │
│   ├── agent.ts                 # Two-pass execution (80 lines)
│   ├── renderer.ts              # Terminal output (100 lines)
│   ├── html.ts                  # HTML report generator (120 lines)
│   ├── artifacts.ts             # .peakinfer/ persistence (50 lines)
│   │
│   └── cli.ts                   # Entry point (70 lines)
│
├── templates/                   # Bundled fallback templates
│   ├── streaming-drift.yaml
│   ├── cost-concentration.yaml
│   ├── dead-code.yaml
│   ├── overpowered-model.yaml
│   ├── untested-fallback.yaml
│   ├── latency-explainer.yaml
│   └── throughput-gap.yaml      # Uses InferenceMax envelopes
│
└── tests/
    ├── scanner.test.ts
    ├── analyzer.test.ts
    ├── runtime.test.ts
    ├── joiner.test.ts
    ├── templates.test.ts
    ├── insights.test.ts
    ├── agent.test.ts
    ├── renderer.test.ts
    ├── html.test.ts
    │
    └── fixtures/
        ├── repos/
        │   ├── saas-openai/
        │   ├── saas-anthropic/
        │   ├── self-hosted-vllm/
        │   ├── hybrid-router/
        │   └── empty/
        ├── events/
        │   ├── valid.jsonl
        │   ├── valid.json
        │   ├── valid.csv
        │   ├── missing-field.jsonl
        │   ├── wrong-types.jsonl
        │   └── skewed-latency.jsonl
        └── templates/
            ├── valid.yaml
            └── invalid.yaml

Total: ~1,090 lines of source code
```

---

## 4. Data Flows

### 4.1 Static Only: `peakinfer analyze ./repo`

```
./repo
   │
   ▼
┌──────────┐
│ Scanner  │─────────────────────────────────────────┐
│          │                                          │
└────┬─────┘                                          │
     │ ScanResult                                     │
     │   files: [{path, language, loc}]               │
     │   summary: {totalFiles, totalLoc, languages}   │
     ▼                                                │
┌──────────┐                                          │
│ Analyzer │                                          │
│  (LLM)   │                                          │
└────┬─────┘                                          │
     │ Callsite[]                                     │
     │   id, file, line, provider, model,             │
     │   patterns, confidence                         │
     ▼                                                │
┌──────────┐     ┌───────────┐                        │
│Templates │────▶│ Insights  │                        │
│ (remote) │     │  Engine   │                        │
└──────────┘     └─────┬─────┘                        │
                       │ Insight[]                    │
     ┌─────────────────┤   severity, category,        │
     │                 │   headline, evidence         │
     ▼                 ▼                              │
┌──────────┐     ┌──────────┐     ┌──────────┐        │
│ Renderer │     │   HTML   │     │Artifacts │        │
│          │     │          │     │          │        │
└────┬─────┘     └────┬─────┘     └────┬─────┘        │
     │                │                │              │
     ▼                ▼                ▼              │
  stdout         report.html    .peakinfer/          │
                                  inferencemap.json   │
                                  insights.json ──────┘
```

### 4.2 Runtime Only: `peakinfer analyze events.jsonl`

```
events.jsonl
     │
     ▼
┌──────────┐
│ Runtime  │
│ Parser   │
└────┬─────┘
     │ RuntimeSummary
     │   totalEvents
     │   byProvider: Map<string, Stats>
     │   byModel: Map<string, Stats>
     │   global: {p50, p95, p99}
     ▼
┌──────────┐
│ Renderer │
└────┬─────┘
     │
     ▼
  stdout
     │
     ▼
.peakinfer/runtime.json
```

### 4.3 Combined: `peakinfer analyze ./repo --events prod.jsonl`

```
./repo                              prod.jsonl
   │                                     │
   ▼                                     ▼
┌──────────┐                       ┌──────────┐
│ Scanner  │                       │ Runtime  │
└────┬─────┘                       │ Parser   │
     │                             └────┬─────┘
     ▼                                  │
┌──────────┐                            │
│ Analyzer │                            │
└────┬─────┘                            │
     │                                  │
     │ Callsite[]                       │ InferenceEvent[]
     │                                  │
     └──────────────┬───────────────────┘
                    │
                    ▼
               ┌─────────┐
               │ Joiner  │
               └────┬────┘
                    │
                    │ JoinedOutput
                    │   callsites (with usage stats)
                    │   codeOnly[]
                    │   runtimeOnly[]
                    │   drift[]
                    │
                    ▼
┌──────────┐   ┌──────────┐
│Templates │──▶│ Insights │
│          │   │  Engine  │
└──────────┘   └────┬─────┘
                    │
     ┌──────────────┼──────────────┐
     │              │              │
     ▼              ▼              ▼
┌──────────┐  ┌──────────┐  ┌──────────┐
│ Renderer │  │   HTML   │  │Artifacts │
└──────────┘  └──────────┘  └──────────┘
     │              │              │
     ▼              ▼              ▼
  stdout      report.html   .peakinfer/
                              joined.json
                              insights.json
```

---

## 5. Core Types (types.ts)

```typescript
import { z } from 'zod';

// =============================================================================
// ENUMS
// =============================================================================

export const Provider = z.enum([
  'openai', 'anthropic', 'google', 'cohere', 'mistral',
  'bedrock', 'azure_openai', 'together', 'fireworks',
  'groq', 'replicate', 'perplexity',
  'vllm', 'sglang', 'tgi', 'ollama', 'llamacpp',
  'unknown'
]);

export const Severity = z.enum(['critical', 'warning', 'info']);

export const Category = z.enum([
  'cost', 'latency', 'drift', 'reliability', 'waste', 'throughput'
]);

// =============================================================================
// STATIC ANALYSIS
// =============================================================================

export const Patterns = z.object({
  streaming: z.boolean().optional(),
  batching: z.boolean().optional(),
  retries: z.boolean().optional(),
  caching: z.boolean().optional(),
  fallback: z.boolean().optional(),
});

export const Callsite = z.object({
  id: z.string(),
  file: z.string(),
  line: z.number(),
  provider: Provider.nullable(),
  model: z.string().nullable(),
  framework: z.string().nullable(),
  runtime: z.string().nullable(),
  patterns: Patterns,
  confidence: z.number().min(0).max(1),
});

export const ScanResult = z.object({
  root: z.string(),
  files: z.array(z.object({
    path: z.string(),
    language: z.string(),
    loc: z.number(),
  })),
  summary: z.object({
    totalFiles: z.number(),
    totalLoc: z.number(),
    languages: z.array(z.string()),
  }),
});

export const InferenceMap = z.object({
  version: z.string(),
  root: z.string(),
  generatedAt: z.string(),
  summary: z.object({
    totalCallsites: z.number(),
    providers: z.array(z.string()),
    models: z.array(z.string()),
    patterns: z.record(z.number()),
  }),
  callsites: z.array(Callsite),
});

// =============================================================================
// RUNTIME ANALYSIS
// =============================================================================

export const InferenceEvent = z.object({
  id: z.string(),
  ts: z.string(),
  provider: Provider,
  model: z.string(),
  input_tokens: z.number(),
  output_tokens: z.number(),
  latency_ms: z.number(),
  intent: z.string().optional(),
  callsite_id: z.string().optional(),
});

export const ProviderStats = z.object({
  calls: z.number(),
  tokens_in: z.number(),
  tokens_out: z.number(),
  latency_p50: z.number(),
  latency_p95: z.number(),
  latency_p99: z.number(),
});

export const RuntimeSummary = z.object({
  totalEvents: z.number(),
  byProvider: z.record(ProviderStats),
  byModel: z.record(ProviderStats),
  global: z.object({
    p50: z.number(),
    p95: z.number(),
    p99: z.number(),
  }),
});

// =============================================================================
// JOINED OUTPUT
// =============================================================================

export const UsageStats = z.object({
  calls: z.number(),
  tokens_in: z.number(),
  tokens_out: z.number(),
  latency_p50: z.number(),
  latency_p95: z.number(),
  latency_p99: z.number(),
});

export const DriftSignal = z.object({
  type: z.enum(['codeOnly', 'runtimeOnly', 'mismatch', 'patternDrift']),
  provider: z.string().optional(),
  model: z.string().optional(),
  callsiteId: z.string().optional(),
  message: z.string(),
});

export const EnrichedCallsite = Callsite.extend({
  usage: UsageStats.optional(),
});

export const JoinedOutput = z.object({
  callsites: z.array(EnrichedCallsite),
  codeOnly: z.array(Callsite),
  runtimeOnly: z.array(InferenceEvent),
  drift: z.array(DriftSignal),
});

// =============================================================================
// TEMPLATES & INSIGHTS
// =============================================================================

export const TemplateCondition = z.object({
  field: z.string(),
  op: z.enum(['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'exists', 'in', 'ratio_gt']),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]).optional(),
  compare_to: z.string().optional(),
});

export const InsightTemplate = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  category: Category,
  severity: Severity,
  match: z.object({
    scope: z.enum(['callsite', 'joined', 'global', 'envelope']),
    conditions: z.array(TemplateCondition),
  }),
  output: z.object({
    headline: z.string(),
    evidence: z.string(),
  }),
  defaults: z.record(z.number()).optional(),
});

export const Insight = z.object({
  severity: Severity,
  category: Category,
  templateId: z.string(),
  headline: z.string(),
  evidence: z.string(),
  location: z.string().optional(),
});

// =============================================================================
// INFERENCE MAX ENVELOPES
// =============================================================================

export const PerformanceEnvelope = z.object({
  ttft_p50_ms: z.number(),
  ttft_p95_ms: z.number(),
  tps_median: z.number(),
  tps_peak: z.number(),
});

// =============================================================================
// AGENT PLANNING
// =============================================================================

export const TaskType = z.enum([
  'scan', 'analyze', 'parse_events', 'join',
  'load_templates', 'generate_insights', 'render', 'generate_html', 'save_artifacts'
]);

export const PlannedTask = z.object({
  id: z.number(),
  type: TaskType,
  description: z.string(),
  depends_on: z.array(z.number()).optional(),
});

export const ExecutionPlan = z.object({
  mode: z.enum(['static', 'runtime', 'combined']),
  tasks: z.array(PlannedTask),
});

export const TaskResult = z.object({
  taskId: z.number(),
  status: z.enum(['success', 'failed', 'skipped']),
  error: z.string().optional(),
  durationMs: z.number(),
});

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type Provider = z.infer<typeof Provider>;
export type Callsite = z.infer<typeof Callsite>;
export type ScanResult = z.infer<typeof ScanResult>;
export type InferenceMap = z.infer<typeof InferenceMap>;
export type InferenceEvent = z.infer<typeof InferenceEvent>;
export type RuntimeSummary = z.infer<typeof RuntimeSummary>;
export type UsageStats = z.infer<typeof UsageStats>;
export type DriftSignal = z.infer<typeof DriftSignal>;
export type JoinedOutput = z.infer<typeof JoinedOutput>;
export type InsightTemplate = z.infer<typeof InsightTemplate>;
export type Insight = z.infer<typeof Insight>;
export type PerformanceEnvelope = z.infer<typeof PerformanceEnvelope>;
export type ExecutionPlan = z.infer<typeof ExecutionPlan>;
export type PlannedTask = z.infer<typeof PlannedTask>;
export type TaskResult = z.infer<typeof TaskResult>;
```

---

## 6. Module Specifications

### 6.1 scanner.ts

**Purpose:** Discover code files in a repository.

**Input:** Directory path
**Output:** ScanResult

**Behavior:**
- Recursively walk directory
- Respect .gitignore
- Ignore node_modules/, dist/, .git/, __pycache__/ by default
- Detect language from extension (.py, .ts, .js, .go, .java)
- Count lines of code per file
- Return summary with totals

**Dependencies:** glob, ignore

```typescript
export async function scan(root: string): Promise<ScanResult>
```

---

### 6.2 analyzer.ts

**Purpose:** Detect LLM inference callsites using semantic analysis.

**Input:** ScanResult
**Output:** Callsite[]

**Behavior:**
- Prioritize files likely to contain inference (llm, ai, agent, chat, completion in path)
- Send code to LLM (Anthropic Claude)
- Request structured JSON output
- Validate response against Callsite schema
- Return only validated callsites

**Dependencies:** @anthropic-ai/sdk

```typescript
export async function analyze(scan: ScanResult): Promise<Callsite[]>
```

---

### 6.3 runtime.ts

**Purpose:** Parse and aggregate runtime events.

**Input:** Events file path (JSONL, JSON, CSV)
**Output:** RuntimeSummary, InferenceEvent[]

**Behavior:**
- Auto-detect format from extension
- Parse each event
- Validate against InferenceEvent schema
- Reject files with missing required fields
- Aggregate by provider, by model
- Calculate percentiles (p50, p95, p99)

```typescript
export async function parseEvents(path: string): Promise<InferenceEvent[]>
export function aggregate(events: InferenceEvent[]): RuntimeSummary
export function percentile(values: number[], p: number): number
```

---

### 6.4 joiner.ts

**Purpose:** Correlate static callsites with runtime events.

**Input:** Callsite[], InferenceEvent[]
**Output:** JoinedOutput

**Behavior:**
- Match by callsite_id if present in events
- Otherwise match by provider+model
- Calculate usage stats for matched callsites
- Identify code-only callsites (no events)
- Identify runtime-only events (no callsite)
- Generate drift signals

```typescript
export function join(callsites: Callsite[], events: InferenceEvent[]): JoinedOutput
```

---

### 6.5 costs.ts

**Purpose:** Provide model pricing for cost calculations via LiteLLM.

**Input:** Model name
**Output:** { input: number, output: number } (per 1M tokens)

**Data:** Fetched from LiteLLM's pricing endpoint, cached for 24 hours.

```typescript
// Cache structure
interface PricingCache {
  data: Record<string, { input: number; output: number }>;
  fetchedAt: number; // Unix timestamp
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const LITELLM_PRICING_URL = 'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';

// Cached pricing data
let pricingCache: PricingCache | null = null;

export async function loadPricing(): Promise<void>
export function getModelCost(model: string): { input: number; output: number }
export function isCacheValid(): boolean
```

**Behavior:**
1. On first call (or cache expired): fetch from LiteLLM GitHub
2. Parse and normalize pricing (convert to per-1M-tokens format)
3. Cache in memory + persist to `.peakinfer/cache/pricing.json`
4. Return cached data for subsequent calls
5. If fetch fails and cache exists (even expired): use stale cache
6. If fetch fails and no cache: return zeros with warning

---

### 6.6 envelopes.ts

**Purpose:** Provide InferenceMax reference performance envelopes.

**Input:** Model name (optionally with runtime suffix)
**Output:** PerformanceEnvelope

**Data:** Hardcoded reference data from InferenceMax benchmarks.

```typescript
export const ENVELOPES: Record<string, PerformanceEnvelope>
export function getEnvelope(model: string, runtime?: string): PerformanceEnvelope | null
```

**Sample data:**
```typescript
{
  'gpt-4o': { ttft_p50_ms: 200, ttft_p95_ms: 500, tps_median: 80, tps_peak: 120 },
  'claude-3-opus': { ttft_p50_ms: 400, ttft_p95_ms: 1200, tps_median: 40, tps_peak: 60 },
  'llama-3-70b:vllm': { ttft_p50_ms: 150, ttft_p95_ms: 400, tps_median: 45, tps_peak: 90 },
  'llama-3-70b:sglang': { ttft_p50_ms: 120, ttft_p95_ms: 350, tps_median: 55, tps_peak: 100 },
}
```

---

### 6.7 templates.ts

**Purpose:** Load insight templates from peakinfer_templates.

**Input:** Options (offline mode)
**Output:** InsightTemplate[]

**Behavior:**
1. Fetch manifest.json from github.com/Kalmantic/peakinfer_templates
2. Fetch each template YAML
3. Cache in .peakinfer/cache/templates/
4. Fall back to bundled templates/ if offline or fetch fails
5. Validate each template against schema

```typescript
export async function loadTemplates(opts?: { offline?: boolean }): Promise<InsightTemplate[]>
```

**Remote structure (peakinfer_templates):**
```
github.com/Kalmantic/peakinfer_templates/
├── manifest.json
└── insights/
    ├── streaming-drift.yaml
    ├── cost-concentration.yaml
    ├── dead-code.yaml
    ├── overpowered-model.yaml
    ├── untested-fallback.yaml
    ├── latency-explainer.yaml
    └── throughput-gap.yaml
```

---

### 6.8 insights.ts

**Purpose:** Evaluate templates against data to generate insights.

**Input:** JoinedOutput (or Callsite[] for static-only), InsightTemplate[], Envelopes
**Output:** Insight[]

**Behavior:**
- For each template:
  - Check scope (callsite, joined, global, envelope)
  - Evaluate all conditions
  - If match, interpolate variables into headline/evidence
  - Emit Insight
- Sort by severity (critical > warning > info)

```typescript
export function evaluate(
  data: JoinedOutput | { callsites: Callsite[] },
  templates: InsightTemplate[],
  envelopes: Record<string, PerformanceEnvelope>
): Insight[]
```

**Condition operators:**
- `eq`, `neq`: equality
- `gt`, `lt`, `gte`, `lte`: comparison
- `exists`: field is not null/undefined
- `in`: value in array
- `ratio_gt`: field / compare_to > value

**Variable interpolation:**
- `{{field}}` replaced with computed value
- `{{percent}}`, `{{ratio}}`, `{{model}}`, `{{location}}`

---

### 6.9 agent.ts

**Purpose:** Two-pass execution orchestration.

**Input:** CLI options (path, events, html, etc.)
**Output:** Final artifacts

**Behavior:**

**Pass 1: Plan**
```typescript
function plan(opts: CLIOptions): ExecutionPlan {
  const tasks: PlannedTask[] = [];
  let id = 1;

  if (isDirectory(opts.path)) {
    tasks.push({ id: id++, type: 'scan', description: 'Scan repository' });
    tasks.push({ id: id++, type: 'analyze', description: 'Analyze callsites', depends_on: [1] });
  }

  if (opts.events) {
    tasks.push({ id: id++, type: 'parse_events', description: 'Parse runtime events' });
  }

  if (isDirectory(opts.path) && opts.events) {
    tasks.push({ id: id++, type: 'join', description: 'Correlate static + runtime' });
  }

  tasks.push({ id: id++, type: 'load_templates', description: 'Load insight templates' });
  tasks.push({ id: id++, type: 'generate_insights', description: 'Generate findings' });
  tasks.push({ id: id++, type: 'render', description: 'Render output' });

  if (opts.html) {
    tasks.push({ id: id++, type: 'generate_html', description: 'Generate HTML report' });
  }

  tasks.push({ id: id++, type: 'save_artifacts', description: 'Save artifacts' });

  return { mode: detectMode(opts), tasks };
}
```

**Pass 2: Execute**
```typescript
async function execute(plan: ExecutionPlan, callbacks: AgentCallbacks): Promise<void> {
  for (const task of plan.tasks) {
    callbacks.onTaskStart?.(task);
    try {
      await executeTask(task, context);
      callbacks.onTaskComplete?.(task, 'success');
    } catch (error) {
      callbacks.onTaskComplete?.(task, 'failed', error);
      if (isCritical(task)) throw error;
    }
  }
}
```

**Callbacks:**
```typescript
interface AgentCallbacks {
  onPlanReady?: (plan: ExecutionPlan) => void;
  onTaskStart?: (task: PlannedTask) => void;
  onTaskComplete?: (task: PlannedTask, status: string, error?: Error) => void;
  onComplete?: () => void;
}
```

---

### 6.10 renderer.ts

**Purpose:** Terminal output with state completeness.

**Input:** Various (plan, insights, joined output, errors)
**Output:** stdout

**Fixed Output Order:**
1. Header
2. Planning (task list)
3. Progress (as tasks execute)
4. Findings (insights)
5. Scope summary
6. Runtime summary (if events)
7. Drift summary (if combined)
8. Saved artifacts

**States:**

**Zero State:**
```
PeakInfer v1.0

No inference usage detected.

Checked for:
  Common providers (openai, anthropic, google, together, fireworks...)
  Frameworks (langchain, llamaindex, dspy...)
  Self-hosted runtimes (vllm, sglang, ollama, tgi...)

If you expected results:
  Check wrapper modules or custom client abstractions
  Check dynamic imports or runtime configuration
```

**Loading State:**
```
PeakInfer v1.0

Planning
  [1/7] Scan repository
  [2/7] Analyze callsites
  [3/7] Parse runtime events
  [4/7] Correlate static + runtime
  [5/7] Load insight templates
  [6/7] Generate findings
  [7/7] Save artifacts

Executing
  [1/7] Scanning...
```

**Partial State:**
```
PeakInfer v1.0

Partial results

  Scanned: 843 / 847 files
  Skipped: 4 (syntax errors)
    src/legacy/broken.py:42 — unexpected indent
    ...

Results are valid for analyzed files.
```

**Error State:**
```
PeakInfer v1.0

Error: Events file missing required field

  File: production.jsonl
  Line: 847
  Missing: latency_ms

Required schema:
  id, ts, provider, model, input_tokens, output_tokens, latency_ms
```

**Success State:**
```
PeakInfer v1.0

Planning
  [1/7] Scan repository
  ...

Findings

  [!] Running at 34% of achievable throughput
      Your llama-3-70b: 15 tok/s, reference: 45 tok/s median
      src/inference/generate.py:42

  [!] Fallback code has never executed
      2 fallback paths with 0 runtime events
      src/fallback/anthropic.py:42

  [*] Streaming enabled but responses arrive in bursts
      p99/p50 ratio is 6.2x — true streaming would be under 2x
      src/chat/handler.py:88

Scope
  Callsites: 23
  Matched: 19
  Drift signals: 4

Runtime
  Events: 18,204
  Latency: p50=420ms  p95=2,340ms  p99=4,980ms

Saved
  .peakinfer/inferencemap.json
  .peakinfer/insights.json
  .peakinfer/joined.json
```

**Severity markers:**
- `[!]` critical
- `[*]` warning
- `[-]` info

**No emojis. No "planning...", "thinking...". Agent internals invisible.**

---

### 6.11 html.ts

**Purpose:** Generate shareable HTML report.

**Input:** InferenceMap, Insights, JoinedOutput (optional), RuntimeSummary (optional)
**Output:** HTML string

**Structure:**
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>PeakInfer Report</title>
  <style>
    /* Inline CSS - no external dependencies */
    :root { --critical: #dc2626; --warning: #d97706; --info: #2563eb; }
    body { font-family: system-ui, sans-serif; max-width: 1200px; margin: 0 auto; padding: 2rem; }
    .finding { border-left: 4px solid; padding: 1rem; margin: 1rem 0; }
    .finding.critical { border-color: var(--critical); }
    .finding.warning { border-color: var(--warning); }
    .finding.info { border-color: var(--info); }
    /* ... */
  </style>
</head>
<body>
  <header>
    <h1>PeakInfer Report</h1>
    <p class="meta">Generated: {{timestamp}} | Root: {{root}}</p>
  </header>

  <section id="findings">
    <h2>Findings</h2>
    {{#each insights}}
    <div class="finding {{severity}}">
      <h3>{{headline}}</h3>
      <p>{{evidence}}</p>
      {{#if location}}<code>{{location}}</code>{{/if}}
    </div>
    {{/each}}
  </section>

  <section id="inferencemap">
    <h2>InferenceMap</h2>
    <details>
      <summary>{{summary.totalCallsites}} callsites</summary>
      <table>
        <thead><tr><th>File</th><th>Line</th><th>Provider</th><th>Model</th><th>Patterns</th></tr></thead>
        <tbody>
          {{#each callsites}}
          <tr>
            <td>{{file}}</td>
            <td>{{line}}</td>
            <td>{{provider}}</td>
            <td>{{model}}</td>
            <td>{{patterns}}</td>
          </tr>
          {{/each}}
        </tbody>
      </table>
    </details>
  </section>

  {{#if runtime}}
  <section id="runtime">
    <h2>Runtime</h2>
    <table>
      <tr><th>Total Events</th><td>{{runtime.totalEvents}}</td></tr>
      <tr><th>Latency p50</th><td>{{runtime.global.p50}}ms</td></tr>
      <tr><th>Latency p95</th><td>{{runtime.global.p95}}ms</td></tr>
      <tr><th>Latency p99</th><td>{{runtime.global.p99}}ms</td></tr>
    </table>
  </section>
  {{/if}}

  {{#if drift}}
  <section id="drift">
    <h2>Drift</h2>
    <h3>Code-only ({{codeOnly.length}})</h3>
    <ul>{{#each codeOnly}}<li>{{file}}:{{line}} — {{provider}}/{{model}}</li>{{/each}}</ul>
    <h3>Runtime-only ({{runtimeOnly.length}})</h3>
    <ul>{{#each runtimeOnly}}<li>{{provider}}/{{model}} — {{count}} events</li>{{/each}}</ul>
  </section>
  {{/if}}

  <footer>
    <p>Generated by PeakInfer v1.0 | <a href="https://github.com/Kalmantic/peakinfer">GitHub</a></p>
  </footer>
</body>
</html>
```

```typescript
export function generateHTML(data: {
  inferenceMap: InferenceMap;
  insights: Insight[];
  joined?: JoinedOutput;
  runtime?: RuntimeSummary;
}): string
```

---

### 6.12 artifacts.ts

**Purpose:** Persist outputs to .peakinfer/ directory.

**Input:** Various data objects
**Output:** Files written

**Structure:**
```
.peakinfer/
├── inferencemap.json
├── insights.json
├── joined.json          (if combined)
├── runtime.json         (if events provided)
├── report.html          (if --html)
└── cache/
    ├── templates/       (cached remote templates)
    └── pricing.json     (LiteLLM pricing, 24hr TTL)
```

```typescript
export function saveArtifacts(data: {
  inferenceMap?: InferenceMap;
  insights?: Insight[];
  joined?: JoinedOutput;
  runtime?: RuntimeSummary;
  html?: string;
}): void
```

---

### 6.13 cli.ts

**Purpose:** Entry point and argument parsing.

**Commands:**
```
peakinfer analyze <path> [options]

Arguments:
  path                    Repository directory or events file

Options:
  --events <file>         Runtime events file (JSONL/JSON/CSV)
  --html                  Generate HTML report
  --open                  Open HTML report in browser
  --offline               Skip remote template fetch
  -v, --verbose           Show detailed progress
  -h, --help              Show help
```

**Implementation:**
```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import { Agent } from './agent.js';
import { createRenderer } from './renderer.js';

const program = new Command()
  .name('peakinfer')
  .description('LLM inference performance analysis')
  .version('1.0.0');

program
  .command('analyze <path>')
  .description('Analyze inference usage')
  .option('--events <file>', 'Runtime events file')
  .option('--html', 'Generate HTML report')
  .option('--open', 'Open HTML in browser')
  .option('--offline', 'Skip remote template fetch')
  .option('-v, --verbose', 'Verbose output')
  .action(async (path, opts) => {
    const renderer = createRenderer({ verbose: opts.verbose });
    const agent = new Agent({ renderer });

    try {
      await agent.run({ path, ...opts });
      process.exit(0);
    } catch (error) {
      renderer.renderError(error);
      process.exit(1);
    }
  });

program.parse();
```

---

## 7. Template Specification

### 7.1 Template Schema (YAML)

```yaml
id: string                    # Unique identifier
name: string                  # Human-readable name
version: string               # Semantic version
category: enum                # cost | latency | drift | reliability | waste | throughput
severity: enum                # critical | warning | info

match:
  scope: enum                 # callsite | joined | global | envelope
  conditions:
    - field: string           # Dot-notation path (e.g., "usage.latency_p99")
      op: enum                # eq | neq | gt | lt | gte | lte | exists | in | ratio_gt
      value: any              # Comparison value
      compare_to: string      # For ratio_gt: denominator field

output:
  headline: string            # Template with {{variables}}
  evidence: string            # Template with {{variables}}

defaults:                     # Optional threshold overrides
  threshold: number
```

### 7.2 Bundled Templates

#### streaming-drift.yaml
```yaml
id: streaming-drift
name: Streaming Drift Detection
version: "1.0"
category: latency
severity: critical

match:
  scope: callsite
  conditions:
    - field: patterns.streaming
      op: eq
      value: true
    - field: usage
      op: exists
    - field: usage.latency_p99
      op: ratio_gt
      compare_to: usage.latency_p50
      value: 5

output:
  headline: "Streaming enabled but responses arrive in bursts"
  evidence: "p99/p50 ratio is {{ratio}}x — true streaming would be under 2x"

defaults:
  threshold: 2
```

#### cost-concentration.yaml
```yaml
id: cost-concentration
name: Cost Concentration
version: "1.0"
category: cost
severity: warning

match:
  scope: global
  conditions:
    - field: top_callsite_cost_percent
      op: gt
      value: 50

output:
  headline: "{{percent}}% of inference cost from one callsite"
  evidence: "{{model}} at {{location}}"

defaults:
  threshold_percent: 50
```

#### dead-code.yaml
```yaml
id: dead-code
name: Dead Code Detection
version: "1.0"
category: drift
severity: warning

match:
  scope: joined
  conditions:
    - field: codeOnly.length
      op: gt
      value: 0

output:
  headline: "{{count}} callsites in code with no runtime events"
  evidence: "{{locations}}"
```

#### overpowered-model.yaml
```yaml
id: overpowered-model
name: Overpowered Model Detection
version: "1.0"
category: waste
severity: info

match:
  scope: callsite
  conditions:
    - field: model
      op: in
      value: ["gpt-4o", "gpt-4", "claude-3-opus", "claude-3-sonnet"]
    - field: usage.avg_output_tokens
      op: lt
      value: 100
    - field: usage.calls
      op: gt
      value: 100

output:
  headline: "{{model}} used for short outputs (avg {{avg_tokens}} tokens)"
  evidence: "Premium models have minimum cost overhead regardless of output length"

defaults:
  output_threshold: 100
  calls_threshold: 100
```

#### untested-fallback.yaml
```yaml
id: untested-fallback
name: Untested Fallback Detection
version: "1.0"
category: reliability
severity: critical

match:
  scope: joined
  conditions:
    - field: codeOnly
      op: has_pattern
      pattern: fallback
      count_gt: 0

output:
  headline: "Fallback code has never executed in production"
  evidence: "{{count}} fallback paths with 0 runtime events"
```

#### latency-explainer.yaml
```yaml
id: latency-explainer
name: Latency Explainer
version: "1.0"
category: latency
severity: warning

match:
  scope: callsite
  conditions:
    - field: usage.latency_p95
      op: gt
      value: 3000
    - field: patterns.streaming
      op: neq
      value: true

output:
  headline: "High tail latency: {{p95}}ms at p95"
  evidence: "No streaming enabled; full response wait contributes to latency"
```

#### throughput-gap.yaml
```yaml
id: throughput-gap
name: Throughput Gap Detection
version: "1.0"
category: throughput
severity: warning

match:
  scope: envelope
  conditions:
    - field: actual_tps
      op: ratio_lt
      compare_to: envelope.tps_median
      value: 0.5

output:
  headline: "Running at {{percent}}% of achievable throughput"
  evidence: "Your {{model}}: {{actual}} tok/s, reference: {{reference}} tok/s median"
```

---

## 8. Test Specifications

### 8.1 Test Structure

```
tests/
├── unit/
│   ├── scanner.test.ts
│   ├── runtime.test.ts
│   ├── joiner.test.ts
│   ├── templates.test.ts
│   ├── insights.test.ts
│   ├── costs.test.ts
│   └── envelopes.test.ts
│
├── integration/
│   ├── agent.test.ts
│   ├── renderer.test.ts
│   └── html.test.ts
│
└── fixtures/
    ├── repos/
    ├── events/
    └── templates/
```

### 8.2 Test Cases

#### scanner.test.ts
```
[x] finds Python files
[x] finds TypeScript files
[x] finds JavaScript files
[x] respects .gitignore
[x] ignores node_modules by default
[x] ignores dist by default
[x] ignores .git by default
[x] counts lines of code
[x] detects language from extension
[x] returns empty result for empty directory
[x] handles non-existent directory with error
```

#### runtime.test.ts
```
[x] parses valid JSONL
[x] parses valid JSON array
[x] parses valid CSV
[x] rejects missing id field
[x] rejects missing ts field
[x] rejects missing provider field
[x] rejects missing model field
[x] rejects missing input_tokens field
[x] rejects missing output_tokens field
[x] rejects missing latency_ms field
[x] rejects wrong type for latency_ms
[x] accepts optional intent field
[x] accepts optional callsite_id field
[x] calculates p50 correctly
[x] calculates p95 correctly
[x] calculates p99 correctly
[x] aggregates by provider
[x] aggregates by model
[x] handles single event
[x] handles empty array
```

#### joiner.test.ts
```
[x] matches callsite to events by provider+model
[x] matches by callsite_id when present
[x] prefers callsite_id over provider+model
[x] calculates usage stats for matched callsites
[x] identifies codeOnly callsites
[x] identifies runtimeOnly events
[x] generates drift signal for codeOnly
[x] generates drift signal for runtimeOnly
[x] handles empty callsites
[x] handles empty events
[x] handles multiple callsites with same provider+model
```

#### templates.test.ts
```
[x] loads bundled templates when offline
[x] fetches manifest from remote
[x] fetches individual templates
[x] caches fetched templates
[x] uses cache when remote unavailable
[x] validates template schema
[x] rejects invalid template
[x] parses YAML correctly
```

#### insights.test.ts
```
[x] evaluates eq condition
[x] evaluates neq condition
[x] evaluates gt condition
[x] evaluates lt condition
[x] evaluates gte condition
[x] evaluates lte condition
[x] evaluates exists condition
[x] evaluates in condition
[x] evaluates ratio_gt condition
[x] accesses nested fields
[x] interpolates variables in headline
[x] interpolates variables in evidence
[x] uses defaults for missing variables
[x] filters by callsite scope
[x] filters by joined scope
[x] filters by global scope
[x] filters by envelope scope
[x] sorts by severity (critical first)
[x] streaming-drift: detects high p99/p50 ratio
[x] cost-concentration: detects >50% cost concentration
[x] dead-code: detects codeOnly callsites
[x] overpowered-model: detects premium model with low output
[x] untested-fallback: detects fallback with 0 events
[x] latency-explainer: explains high p95 without streaming
[x] throughput-gap: detects low throughput vs envelope
```

#### agent.test.ts
```
[x] creates plan for static-only mode
[x] creates plan for runtime-only mode
[x] creates plan for combined mode
[x] includes html task when --html
[x] executes tasks in order
[x] reports progress via callbacks
[x] continues on non-critical failure
[x] aborts on critical failure
```

#### renderer.test.ts
```
[x] renders header first
[x] renders planning section
[x] renders findings before scope
[x] renders scope summary
[x] renders runtime summary when present
[x] renders saved artifacts last
[x] uses [!] for critical
[x] uses [*] for warning
[x] uses [-] for info
[x] renders zero state message
[x] renders partial state with skipped count
[x] renders error state with actionable message
[x] no emojis in output
[x] no "planning" or "thinking" exposed
```

#### html.test.ts
```
[x] generates valid HTML
[x] includes all findings
[x] includes InferenceMap table
[x] includes runtime section when present
[x] includes drift section when present
[x] CSS is inline (no external deps)
[x] severity colors are correct
```

---

## 9. Implementation Order

```
Phase 1: Foundation (Day 1)
├── 1. types.ts
├── 2. costs.ts
└── 3. envelopes.ts

Phase 2: Core Pipeline (Day 2)
├── 4. scanner.test.ts → scanner.ts
├── 5. runtime.test.ts → runtime.ts
└── 6. joiner.test.ts → joiner.ts

Phase 3: Magic (Day 3)
├── 7. templates.test.ts → templates.ts
└── 8. insights.test.ts → insights.ts

Phase 4: Experience (Day 4)
├── 9. agent.test.ts → agent.ts
├── 10. renderer.test.ts → renderer.ts
└── 11. html.test.ts → html.ts

Phase 5: Integration (Day 5)
├── 12. artifacts.ts
├── 13. analyzer.test.ts → analyzer.ts (LLM)
├── 14. cli.ts
└── 15. bundled templates/

Phase 6: Polish
├── 16. End-to-end testing
├── 17. Error message review
└── 18. Documentation
```

---

## 10. External Dependencies

```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "^0.27.0",
    "commander": "^12.0.0",
    "glob": "^10.3.10",
    "ignore": "^5.3.0",
    "yaml": "^2.3.4",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "tsx": "^4.7.0",
    "typescript": "^5.3.0",
    "vitest": "^1.2.0"
  }
}
```

**LiteLLM pricing:** Fetched from LiteLLM GitHub, cached 24 hours in `.peakinfer/cache/pricing.json`.
**InferenceMax envelopes:** Hardcoded reference data in envelopes.ts (v1.0), could be remote in future.

---

## 11. Success Criteria

### Functional
- [ ] Static analysis detects callsites with >90% accuracy
- [ ] Runtime analysis parses JSONL/JSON/CSV correctly
- [ ] Combined analysis correlates and detects drift
- [ ] Insights generate "aha" moments
- [ ] HTML report is shareable and useful

### Performance
- [ ] 10k LOC repo analyzed in <60 seconds
- [ ] Memory usage <500MB

### UX (Julie Zhou)
- [ ] All 5 states are complete (zero/loading/partial/error/success)
- [ ] Output order is fixed and logical
- [ ] No agent internals visible
- [ ] No emojis
- [ ] Errors are actionable

### Magic
- [ ] Streaming drift detection works
- [ ] Cost concentration insight works
- [ ] Dead code detection works
- [ ] Throughput gap (vs InferenceMax) works
- [ ] User says "I didn't know that was possible"

---

## 12. Appendix: Sample Output

### Terminal (Combined Analysis)
```
PeakInfer v1.0

Planning
  [1/8] Scan repository
  [2/8] Analyze callsites
  [3/8] Parse runtime events
  [4/8] Correlate static + runtime
  [5/8] Load insight templates
  [6/8] Generate findings
  [7/8] Render output
  [8/8] Save artifacts

Findings

  [!] Running at 34% of achievable throughput
      Your llama-3-70b: 15 tok/s, reference: 45 tok/s median
      src/inference/generate.py:42

  [!] Fallback code has never executed in production
      2 fallback paths with 0 runtime events
      src/fallback/anthropic.py:42, src/routing/backup.py:91

  [*] Streaming enabled but responses arrive in bursts
      p99/p50 ratio is 6.2x — true streaming would be under 2x
      src/chat/handler.py:88

  [*] 73% of inference cost from one callsite
      claude-3-opus at src/agents/research.py:156

  [-] gpt-4o used for short outputs (avg 42 tokens)
      Premium models have minimum cost overhead regardless of output length
      src/classify/intent.py:12

Scope
  Callsites: 23
  Providers: openai (12), anthropic (8), together (3)
  Models: gpt-4o (9), claude-3-opus (2), claude-3-sonnet (6), llama-3-70b (3)

Runtime
  Events: 18,204
  Latency: p50=420ms  p95=2,340ms  p99=4,980ms
  Tokens: 78.2M in, 6.4M out

Drift
  Code-only: 4 callsites
  Runtime-only: 1 (openai/gpt-4o-mini)

Saved
  .peakinfer/inferencemap.json
  .peakinfer/insights.json
  .peakinfer/joined.json
  .peakinfer/report.html

View report: open .peakinfer/report.html
```

---

This is the complete design. Ready to implement.

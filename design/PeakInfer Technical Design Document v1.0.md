# PeakInfer Technical Design Document v1.0

**Version:** 1.0
**Date:** December 2024
**Author:** PeakInfer Engineering

---

## 1. Executive Summary

PeakInfer is a CLI tool that analyzes codebases to discover LLM inference patterns, map the complete AI/ML tech stack, and provide performance optimization recommendations. The system uses AI-powered static analysis via the Claude Code SDK combined with optional runtime telemetry analysis.

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Claude Code SDK for analysis | Agent-based exploration is faster and more accurate than regex-based scanning |
| Filesystem-based persistence | Simple, no database dependencies, enables offline cached analysis |
| Real-time + static pricing fallback | LiteLLM provides 1000+ models, static data ensures offline functionality |
| Hierarchical StackMap structure | Mirrors codebase structure for intuitive navigation |
| Two-pass execution model | Plan first, then execute enables resumability and progress tracking |

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PeakInfer CLI                                  │
│                                                                             │
│  ┌─────────────┐    ┌──────────────────┐    ┌─────────────────────────┐    │
│  │   Scanner   │───▶│  Agent Analyzer  │───▶│     Output Renderer     │    │
│  │ (Discovery) │    │  (Claude SDK)    │    │   (Terminal/HTML/JSON)  │    │
│  └─────────────┘    └──────────────────┘    └─────────────────────────┘    │
│         │                   │                           │                  │
│         ▼                   ▼                           ▼                  │
│  ┌─────────────┐    ┌──────────────────┐    ┌─────────────────────────┐    │
│  │  ScanResult │    │ ClassifiedCallsite│    │  peakinfer-report.html  │    │
│  │   (files)   │    │   TechStack       │    │  peakinfer-stackmap.json│    │
│  └─────────────┘    │   Patterns        │    │  peakinfer-pricing.json │    │
│                     └──────────────────┘    └─────────────────────────┘    │
│                              │                                              │
│                              ▼                                              │
│                     ┌──────────────────┐    ┌─────────────────────────┐    │
│                     │   StackMap       │───▶│    Pricing Engine       │    │
│                     │   (Tree Build)   │    │   (LiteLLM + Static)    │    │
│                     └──────────────────┘    └─────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌─────────────────────────────────────┐
                    │         Runtime Telemetry           │
                    │   (events.jsonl / events.json)      │
                    │                                     │
                    │  ┌─────────────┐  ┌─────────────┐   │
                    │  │  Collector  │─▶│  Aggregator │   │
                    │  │  (Manual)   │  │  (Stats)    │   │
                    │  └─────────────┘  └─────────────┘   │
                    └─────────────────────────────────────┘
```

### 2.1 Component Overview

| Component | File | Responsibility |
|-----------|------|----------------|
| Scanner | `scanner.ts` | File discovery, language detection, .gitignore respect |
| Agent Analyzer | `agent-analyzer.ts` | AI-powered codebase analysis using Claude SDK |
| StackMap Builder | `stackmap.ts` | Hierarchical tree construction from callsites |
| Pricing Engine | `pricing.ts`, `pricing-fetcher.ts` | Cost estimation with LiteLLM integration |
| Agent | `agent.ts` | Two-pass execution orchestration with callbacks |
| CLI | `cli.ts` | Command parsing, runtime telemetry analysis |
| PRD Renderer | `prd-renderer.ts` | Terminal UI output with chalk |
| HTML Renderer | `html-renderer.ts` | Interactive HTML report generation |

---

## 3. Data Flow

### 3.1 Static Analysis Flow

```
User Input (path)
       │
       ▼
┌─────────────────┐
│  1. Validate    │  Check path exists
│     Path        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  2. Scan Files  │  Walk directory tree
│     scanner.ts  │  Detect languages
│                 │  Respect .gitignore
└────────┬────────┘
         │
         ▼ ScanResult { files[], languages, totalLines }
┌─────────────────┐
│  3. Agent       │  Send file tree to Claude
│     Analysis    │  Agent uses Read/Grep/Glob tools
│                 │  Returns callsites + techStack + patterns
└────────┬────────┘
         │
         ▼ ClassifiedCallsite[], TechStack, InferencePatterns
┌─────────────────┐
│  4. Build       │  Group callsites by file
│     StackMap    │  Build hierarchical tree
│                 │  Generate summary
└────────┬────────┘
         │
         ▼ StackMap { root, tree[], summary }
┌─────────────────┐
│  5. Calculate   │  Lookup model pricing
│     Pricing     │  Estimate monthly costs
│                 │  Identify hotspots
└────────┬────────┘
         │
         ▼ PricingSummary { estimatedRange, byProvider, hotspots }
┌─────────────────┐
│  6. Render      │  Format for terminal/HTML/JSON
│     Output      │  Apply Julie Zhou principles
│                 │  Hide empty sections
└────────┴────────┘
```

### 3.2 Runtime Telemetry Flow

```
Events File (JSONL/JSON/CSV)
       │
       ▼
┌─────────────────┐
│  1. Load Events │  Parse file format
│     collector   │  Validate schema
└────────┬────────┘
         │
         ▼ InferenceEvent[]
┌─────────────────┐
│  2. Aggregate   │  Group by provider/model/intent
│     Statistics  │  Calculate totals
│                 │  Compute percentages
└────────┬────────┘
         │
         ▼ { byProvider, byModel, byIntent, summary }
┌─────────────────┐
│  3. Render      │  Display aggregated stats
│     Output      │  Show performance metrics
└────────┴────────┘
```

---

## 4. Module Specifications

### 4.1 Scanner (`scanner.ts`)

**Purpose:** Discover source files in a directory tree.

**Design Principles:**
- Pure functions, no side effects
- Single responsibility: find files
- Agent handles semantic analysis

**API:**
```typescript
async function scan(root: string, options?: ScanOptions): Promise<ScanResult>

interface ScanResult {
  root: string;
  files: ScannedFile[];
  totalFiles: number;
  totalLines: number;
  languages: Partial<Record<Language, number>>;
  durationMs: number;
}

interface ScannedFile {
  path: string;      // Relative to root
  language: Language;
  lines: number;
}

type Language = 'python' | 'typescript' | 'javascript' | 'go' | 'java' | 'unknown';
```

**Ignore Patterns:**
- Built-in: `node_modules`, `.git`, `dist`, `__pycache__`, etc.
- User-defined: Respects `.gitignore` patterns
- File patterns: `*.min.js`, `*.d.ts`, lock files, configs

**Implementation Details:**
- Uses `ignore` package for .gitignore parsing
- Two-pass for progress reporting (count then walk)
- Efficient in-place array modification

### 4.2 Agent Analyzer (`agent-analyzer.ts`)

**Purpose:** AI-powered codebase analysis using Claude Code SDK.

**Design Principles:**
- Let the agent decide what to analyze
- Use grep/glob to narrow before reading
- Single coherent analysis vs per-file

**API:**
```typescript
async function analyzeWithAgent(
  targetPath: string,
  options?: AgentAnalysisOptions
): Promise<AgentAnalysisResult>

interface AgentAnalysisResult {
  callsites: ClassifiedCallsite[];
  stackMap: StackMap;
  pricing: PricingSummary;
  techStack: TechStack;
  patterns: InferencePatterns;
  totalCostUsd: number;
  durationMs: number;
}
```

**Claude SDK Integration:**
```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

for await (const message of query({
  prompt: ANALYSIS_PROMPT,
  options: {
    cwd: root,
    allowedTools: ['Read', 'Grep', 'Glob'],
    permissionMode: 'bypassPermissions',
    maxTurns: 10,
    model: 'claude-sonnet-4-5-20250929',
  },
})) {
  // Handle message types: assistant, result
}
```

**Analysis Prompt Structure:**
1. Task definition: Find LLM callsites, map tech stack, detect patterns
2. What to look for: Application/Serving/Infrastructure/Hardware layers
3. Inference patterns: Retry, batching, streaming, caching, routing, fallback, guardrails
4. Approach: Glob → Grep → Read (narrow down before reading)
5. Output format: JSON with callsites[], techStack{}, patterns{}

### 4.3 StackMap Builder (`stackmap.ts`)

**Purpose:** Build hierarchical tree structure from classified callsites.

**Design Principles:**
- Pure function, no side effects
- Group by directory → file → callsites
- Generate summary statistics

**API:**
```typescript
function buildStackMap(callsites: ClassifiedCallsite[], root: string): StackMap

interface StackMap {
  root: string;
  tree: StackMapNode[];
  summary: {
    totalCallsites: number;
    providers: string[];
    models: string[];
  };
}

interface StackMapNode {
  name: string;
  path: string;
  type: 'directory' | 'file';
  children?: StackMapNode[];
  callsites?: StackMapCallsite[];
}
```

**Algorithm:**
1. Group callsites by file path
2. Split paths into directory segments
3. Insert into tree, creating directory nodes as needed
4. Sort children alphabetically
5. Sort callsites by line number
6. Aggregate providers and models for summary

### 4.4 Pricing Engine (`pricing.ts`, `pricing-fetcher.ts`)

**Purpose:** Estimate inference costs based on detected models.

**Design Principles:**
- Async initialization for real-time data
- Static fallback ensures offline functionality
- Provider-agnostic optimization suggestions

**API:**
```typescript
async function initPricingEngine(): Promise<{ source: 'realtime' | 'static'; modelCount: number }>

function getModelPrice(provider: string | null, model: string | null): ModelPricing | null

function calculatePricing(callsites: ClassifiedCallsite[]): PricingSummary

interface PricingSummary {
  estimatedRange: { low: number; high: number };
  highestLatencyModel?: string | null;
  byProvider: Array<{ provider: string; throughput: number; percentage: number }>;
  byModel: Array<{ model: string; throughput: number }>;
  hotspots: CallsitePerformance[];
}
```

**Data Sources:**
1. **Real-time:** LiteLLM pricing endpoint (~1000 models)
2. **Static fallback:** Embedded data for common models

**Pricing Calculation:**
```typescript
const DEFAULT_USAGE = {
  low: { inputTokens: 1000, outputTokens: 500, callsPerMonth: 100 },
  high: { inputTokens: 5000, outputTokens: 2000, callsPerMonth: 1000 },
};

// Monthly cost = (tokens / 1M) × price_per_1M × calls_per_month
```

### 4.5 Agent (`agent.ts`)

**Purpose:** Orchestrate two-pass execution with callbacks.

**Design Principles:**
- Callback-driven architecture (UI decoupling)
- Filesystem-based context (persistence, resumability)
- Plan then execute

**API:**
```typescript
interface AgentCallbacks {
  onStart?: (queryId: string, targetPath: string) => void;
  onComplete?: (queryId: string, success: boolean, durationMs: number) => void;
  onPlanCreated?: (plan: ExecutionPlan) => void;
  onTaskStart?: (task: Task) => void;
  onTaskProgress?: (task: Task, message: string) => void;
  onTaskComplete?: (task: Task) => void;
  onError?: (error: Error, phase: string) => void;
}

class Agent {
  createPlan(): ExecutionPlan;
  async run(): Promise<AnalysisOutput>;
}

async function runAgent(
  targetPath: string,
  callbacks?: AgentCallbacks
): Promise<AnalysisOutput>
```

**Execution Plan:**
```typescript
interface ExecutionPlan {
  queryId: string;
  targetPath: string;
  createdAt: string;
  tasks: Task[];  // scan, analyze, stackmap, pricing, render
}
```

**Context Management:**
- Plans saved to `.peakinfer/plan-{queryId}.json`
- Task results saved to `.peakinfer/result-{queryId}-{taskId}.json`
- Enables resume from failure

---

## 5. Type System

### 5.1 Core Types (`types.ts`)

```typescript
// Callsite Classification
interface ClassifiedCallsite {
  id: string;
  file: string;
  line: number;
  provider: string | null;     // openai, anthropic, google, etc.
  model: string | null;        // gpt-4o, claude-3-5-sonnet, etc.
  framework: string | null;    // langchain, llamaindex, etc.
  runtime: string | null;      // vllm, sglang, ollama, etc.
  taskKind: string;            // chat, completion, embedding, etc.
  isStreaming: boolean | null;
  confidence: number;          // 0.0 - 1.0
  reasoning: {
    whyProvider: string;
    whyModel: string;
  };
  optimizationSuggestion?: string;
  hasUsageData?: boolean;      // True if from events.jsonl
}

// Tech Stack Layers
interface TechStack {
  application: AppLayer;    // frameworks, sdks, patterns
  serving: ServingLayer;    // runtimes, gateways, platforms
  infrastructure: InfraLayer;  // cloud, compute, orchestration
  hardware: HardwareLayer;  // gpus, accelerators, estimated flag
}

// Inference Patterns
interface InferencePatterns {
  retry: PatternInfo;
  batching: PatternInfo;
  streaming: PatternInfo;
  caching: PatternInfo;
  routing: PatternInfo;
  fallback: PatternInfo;
  guardrails: PatternInfo;
}

interface PatternInfo {
  detected: boolean;
  instances: PatternInstance[];
  type?: string;  // exponential_backoff, sse, semantic, etc.
}
```

### 5.2 Runtime Event Schema

```typescript
interface InferenceEvent {
  id: string;              // UUID
  ts: string;              // ISO timestamp
  intent: string;          // "extract_email", "summarize_doc"
  provider: string;        // "openai", "anthropic"
  model: string;           // "gpt-4o", "claude-3-sonnet"
  input_tokens: number;
  output_tokens: number;
  latency_ms: number;
  throughput_tps: number;  // Tokens per second
  endpoint: string;
  region: string;
  tenant: string;
}
```

---

## 6. CLI Architecture

### 6.1 Command Structure

```
peakinfer <command> [options]

Commands:
  analyze <path>      Analyze codebase for LLM usage
  prices [provider]   Show model pricing
  templates           Browse optimization templates

Analyze Options:
  --html              Generate HTML report
  --open              Generate and open report
  --cached            View previous analysis
  --output json       Machine-readable output
```

### 6.2 Analysis Modes

| Mode | Input | Description |
|------|-------|-------------|
| Static Analysis | Directory path | Scan codebase, AI analysis of callsites |
| Runtime Telemetry | events.jsonl | Aggregate actual usage data |
| Cached Analysis | --cached flag | View previous results (offline) |

### 6.3 Runtime Telemetry Detection

```typescript
function detectEventsFile(targetPath: string): string | null {
  const candidates = [
    'events.jsonl',
    'events.json',
    'telemetry/events.jsonl',
    'data/events.jsonl',
    'inference_events.jsonl',
    'llm_events.jsonl',
  ];
  // Return first existing file
}
```

---

## 7. Error Handling

### 7.1 Error Codes

```typescript
type ErrorCode =
  | 'NO_FILES'           // No source files found
  | 'PERMISSION_DENIED'  // Can't read directory
  | 'INVALID_PATH'       // Path doesn't exist
  | 'API_KEY_MISSING'    // ANTHROPIC_API_KEY not set
  | 'API_ERROR'          // Claude API failure
  | 'INVALID_FORMAT'     // Can't parse events file
  | 'ANALYSIS_ERROR';    // Agent analysis failed

interface AnalysisError {
  code: ErrorCode;
  message: string;
  suggestion: string;  // Actionable recovery guidance
}
```

### 7.2 Graceful Degradation

| Scenario | Behavior |
|----------|----------|
| LiteLLM unavailable | Fall back to static pricing data |
| Claude API error | Show error with suggestion to check API key |
| Max turns reached | Use partial results if available |
| Events file invalid | Show format error with example schema |
| Empty codebase | Show "no LLM callsites found" message |

---

## 8. Output Formats

### 8.1 Terminal Output (Default)

Uses chalk for colored output with sections:
- Scan summary (files, lines, languages)
- Detected callsites with providers/models
- Tech stack by layer
- Detected patterns
- Pricing estimates (if meaningful data)
- Hotspots and optimization suggestions

**Julie Zhou Principles Applied:**
- Hide empty sections (no "$0 - $0" noise)
- Only show detected patterns
- Content determines structure

### 8.2 JSON Output (`--output json`)

```json
{
  "scan": { "root": "...", "files": [...], "totalFiles": 42 },
  "callsites": [...],
  "stackMap": { "root": "...", "tree": [...], "summary": {...} },
  "pricing": { "estimatedRange": {...}, "hotspots": [...] },
  "techStack": { "application": {...}, "serving": {...} },
  "patterns": { "retry": {...}, "caching": {...} }
}
```

### 8.3 HTML Report (`--html`)

Interactive report with:
- Collapsible sections
- Syntax highlighting for code snippets
- Visual tech stack diagram
- Sortable tables
- Dark mode support

---

## 9. Performance Considerations

### 9.1 Analysis Efficiency

| Approach | Files Analyzed | API Calls | Time |
|----------|----------------|-----------|------|
| File-by-file | All files | N calls | O(n) |
| Agent-based | Relevant only | 2-3 calls | O(1)* |

*Agent uses grep/glob to narrow before reading, typically analyzing only 5-20 relevant files.

### 9.2 Caching Strategy

- **Analysis cache:** `.peakinfer/` directory with JSON artifacts
- **Pricing cache:** LiteLLM data cached for 24 hours
- **Offline mode:** `--cached` flag uses stored results

### 9.3 Memory Management

- Scanner: Streams file reading, doesn't load all content
- StackMap: Builds tree incrementally with Map structures
- Results: Written to disk immediately after each task

---

## 10. Security Considerations

### 10.1 Data Handling

| Data Type | Handling |
|-----------|----------|
| Source code | Never leaves local machine (agent runs locally) |
| API keys | Read from environment, never logged |
| Events data | Processed locally, no external transmission |
| Cached results | Stored in `.peakinfer/` (gitignored) |

### 10.2 Tool Permissions

Agent is restricted to:
- `Read`: Read files in target directory only
- `Grep`: Search file contents
- `Glob`: Pattern match file names

No write, execute, or network access beyond Claude API.

---

## 11. Extension Points

### 11.1 Custom Collectors

```typescript
interface Collector {
  name: string;
  loadEvents(path: string): Promise<InferenceEvent[]>;
}

// Built-in: ManualCollector (JSONL/JSON/CSV)
// Future: SnowflakeCollector, DatabricksCollector
```

### 11.2 Output Renderers

```typescript
interface Renderer {
  render(result: AnalysisResult): void | string;
}

// Built-in: TerminalRenderer, HTMLRenderer, JSONRenderer
```

### 11.3 Analysis Plugins

Future support for custom analysis passes:
- Security vulnerability detection
- Compliance checking
- Custom pattern matching

---

## 12. Dependencies

### 12.1 Runtime Dependencies

| Package | Purpose |
|---------|---------|
| `@anthropic-ai/claude-agent-sdk` | AI-powered analysis |
| `chalk` | Terminal colors |
| `commander` | CLI parsing |
| `ignore` | .gitignore parsing |
| `zod` | Schema validation |

### 12.2 Build Dependencies

| Package | Purpose |
|---------|---------|
| TypeScript | Type safety |
| tsx | TypeScript execution |
| Vitest | Testing |

---

## 13. Appendix

### A. Directory Structure

```
src/
├── slc/
│   ├── agent.ts           # Two-pass execution orchestration
│   ├── agent-analyzer.ts  # Claude SDK integration
│   ├── cli.ts             # CLI entry point
│   ├── html-renderer.ts   # HTML report generation
│   ├── prd-renderer.ts    # Terminal output
│   ├── pricing.ts         # Cost estimation
│   ├── pricing-fetcher.ts # LiteLLM integration
│   ├── scanner.ts         # File discovery
│   ├── stackmap.ts        # Tree builder
│   └── types.ts           # Type definitions
├── collectors/
│   └── manual-collector.ts # Events file loading
└── types/
    └── index.ts           # Shared types
```

### B. Configuration Files

| File | Purpose |
|------|---------|
| `.peakinfer/` | Analysis cache directory |
| `.gitignore` | Respected during scanning |
| `package.json` | Dependency and script definitions |
| `tsconfig.json` | TypeScript configuration |

### C. Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes* | Claude API access |
| `HOME` | No | Used for default paths |
| `PATH` | No | Passed to agent subprocess |

*Not required for `--cached` mode or runtime telemetry analysis.

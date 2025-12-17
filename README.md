# PeakInfer

LLM inference performance analysis CLI.

Reveals the truth about your LLM inference patterns - what models you're calling, how they perform, and where code intent diverges from runtime reality. **v1.5 adds pre-deploy validation** with historical comparison, latency predictions, and optimization insights.

## Features

- **Static Analysis**: Scan codebases to detect LLM inference points (OpenAI, Anthropic, Azure, Bedrock, etc.)
- **Runtime Analysis**: Analyze telemetry logs to understand actual inference behavior
- **Combined Analysis**: Detect drift between code intent and runtime reality
- **Historical Comparison** (v1.5): Track changes over time with `--compare`
- **Deploy-Time Prediction** (v1.5): Assess latency risk before deployment with `--predict`
- **Counterfactual Insights** (v1.5): See optimization opportunities you're missing
- **LLM-Powered Insights**: Semantic analysis using Claude for deeper pattern detection
- **Multi-Format Support**: JSONL, JSON, CSV, OpenTelemetry, Jaeger, Zipkin, LiteLLM, Langsmith

## Installation

```bash
npm install @kalmantic/peakinfer

# Or install globally
npm install -g @kalmantic/peakinfer
```

**Requirements**: Node.js >= 18.0.0

## Quick Start

```bash
# Basic analysis
peakinfer analyze .

# With historical comparison (v1.5)
peakinfer analyze . --compare

# With latency predictions (v1.5)
peakinfer analyze . --predict --target-p95 2000

# Full analysis with HTML report
peakinfer analyze . --compare --predict --html --open
```

## Configuration

Create a `.env` file in your project root:

```bash
# Copy the example
cp .env.example .env
```

Add your Anthropic API key:

```env
# Required for LLM-based semantic analysis
# Without this, PeakInfer falls back to regex-based detection only
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
```

## Usage

### Analysis Modes

PeakInfer supports three analysis modes:

#### 1. Static Analysis (Code Only)

Scan a codebase to detect LLM inference points:

```bash
# Analyze current directory
peakinfer analyze .

# Analyze a specific path
peakinfer analyze ./src
```

**Output**: Detected inference points with provider, model, file location, and patterns.

#### 2. Runtime Analysis (Events Only)

Analyze inference telemetry/logs:

```bash
# Analyze a JSONL events file
peakinfer analyze events.jsonl

# With format hint
peakinfer analyze traces.json --format otel
```

**Output**: Performance metrics (latency percentiles, token usage, costs) and optimization insights.

#### 3. Combined Analysis (Static + Runtime)

Detect drift between code intent and runtime behavior:

```bash
peakinfer analyze . --events production.jsonl
```

**Output**: Everything from static + runtime, plus drift signals (model mismatches, dead code, orphan events).

### v1.5 Features

#### Historical Comparison (`--compare`)

Track changes between analysis runs:

```bash
# Compare with most recent previous run
peakinfer analyze . --compare

# Compare with specific run ID
peakinfer analyze . --compare abc123def
```

**Output**:
```
Changes since last run (12/15/2024)

  Inference points: 4 → 6 (+2)

  + 2 new inference points
      src/api/chat.ts:45
      src/api/embed.ts:23

  ~ 1 modified inference point
      src/llm/client.ts:89 (model changed)

Issue changes
  [!] 1 new critical issue
  [✓] 2 warnings resolved
```

#### Deploy-Time Prediction (`--predict`)

Assess latency risk before deployment:

```bash
# Generate predictions
peakinfer analyze . --predict

# With latency budget
peakinfer analyze . --predict --target-p95 2000
```

**Output**:
```
Deploy-time Prediction

  [!] 2 high-risk inference points (p95 > 5000ms)
  [*] 1 medium-risk inference point (p95 > 2000ms)
  [-] 3 low-risk inference points

Top latency risks
  [!] src/api/analyze.ts:78 (claude-3-opus)
      p95: 8000ms | p99: 15000ms

  [!] Budget exceeded: worst p95 8000ms > target 2000ms
```

#### Counterfactual Insights (Always On)

See optimization opportunities automatically:

```
Optimization Opportunities

  8 opportunities: up to 80% latency reduction, up to 90% cost savings

  Switch from gpt-4 to gpt-4o-mini [easy]
      Impact: -75% latency, -90% cost
      Tradeoff: Good for simpler tasks

  Enable response streaming [easy]
      Impact: -80% perceived latency
```

### CLI Options

```bash
peakinfer analyze [path] [options]

Options:
  --events <file>      Add runtime telemetry to static analysis
  --html               Generate HTML report
  --pdf                Generate PDF report
  --open               Open report in browser/viewer
  --output <format>    Output format: text (default) or json
  --cached             View previous analysis (offline, no API key needed)
  --verbose            Show detailed task progress

History Options (v1.5):
  --no-history         Skip saving run to history
  --compare [runId]    Compare with previous run (default: latest)
  --predict            Generate deploy-time latency predictions
  --target-p95 <ms>    Target p95 latency for budget calculation

Format Detection:
  --format <type>      Specify runtime format: jsonl, json, csv, otel, jaeger, zipkin, langsmith, litellm
  --map <mappings...>  Field mappings: --map latency_ms=duration model=model_name
  --lenient            Accept low-confidence field mappings
  --strict             Fail on missing required fields or unknown formats
  --redact             Redact code snippets from artifacts
```

### Examples

```bash
# Quick scan of current project
peakinfer analyze .

# Analyze with verbose output
peakinfer analyze . --verbose

# Generate and open HTML report
peakinfer analyze . --html --open

# Combined analysis with PDF report
peakinfer analyze . --events prod-logs.jsonl --pdf --open

# Full v1.5 analysis
peakinfer analyze . --events prod.jsonl --compare --predict --target-p95 3000 --html --open

# Skip history for quick check
peakinfer analyze . --no-history

# Custom format with field mapping
peakinfer analyze logs.csv --format csv --map latency_ms=response_time model=llm_model

# View cached results (no API call)
peakinfer analyze . --cached
```

## Output Artifacts

PeakInfer generates artifacts in `.peakinfer/`:

| File | Description |
|------|-------------|
| `inferencemap.json` | Detected inference points from code |
| `runtime.json` | Aggregated runtime metrics |
| `joined.json` | Combined static + runtime with drift signals |
| `insights.json` | Optimization recommendations |
| `report.html` | Interactive HTML report |
| `report.pdf` | PDF report (if `--pdf` specified) |

History is stored in `.peakinfer/runs/`:

| File | Description |
|------|-------------|
| `runs/<runId>/manifest.json` | Run metadata |
| `runs/<runId>/analysis.json` | Full analysis results |
| `runs/index.json` | Index of all runs |

## Supported Providers

| Provider | SDK |
|----------|-----|
| OpenAI | `openai` |
| Anthropic | `@anthropic-ai/sdk` |
| Azure OpenAI | `@azure/openai` |
| AWS Bedrock | `@aws-sdk/client-bedrock-runtime` |
| Google Vertex AI | `@google-cloud/aiplatform` |
| Ollama | `ollama` |
| vLLM | HTTP calls |
| TensorRT-LLM | HTTP calls |

### Frameworks

- LangChain
- LlamaIndex
- DSPy

## Testing

### Run All Tests

```bash
# Run tests (uses fallback mode if no API key)
npm test

# Run tests with coverage
npm test -- --coverage

# Run in watch mode
npm run test:watch
```

### Test Categories

| Test File | Description |
|-----------|-------------|
| `tests/scanner.test.ts` | Static code scanning |
| `tests/runtime.test.ts` | Runtime event parsing |
| `tests/joiner.test.ts` | Static + runtime joining |
| `tests/insights.test.ts` | Insight generation |
| `tests/runtime-analyzer.test.ts` | LLM runtime analysis agent |
| `tests/correlation-analyzer.test.ts` | LLM drift detection agent |
| `tests/template-conformance.test.ts` | LLM output schema validation |

### Testing with Real LLM Calls

To test with actual LLM API calls:

```bash
# Set your API key and run tests
source .env && npm test
```

The agents have two modes:
- **Fallback Mode** (no API key): Uses deterministic regex-based analysis
- **LLM Mode** (with API key): Uses Claude for semantic analysis

### Demo Project (v1.5)

Test v1.5 features with the included demo project:

```bash
# Interactive demo
./scripts/demo-v1.5.sh

# Or run directly
cd fixtures/demo-project
peakinfer analyze .
peakinfer analyze . --compare
peakinfer analyze . --predict --target-p95 2000
```

### Eval Framework

Evaluation fixtures are in `evals/fixtures/`:

```bash
# Run precision/recall tests against ground truth
npm test -- evals/precision-recall.test.ts

# Run drift detection evals
npm test -- evals/drift-detection.test.ts

# Run format detection evals
npm test -- evals/format-detection.test.ts
```

**Fixture Categories**:
- `r1-r15`: Static analysis scenarios (SaaS, self-hosted, frameworks)
- `d1-d5`: Drift detection scenarios (code-only, runtime-only, mismatches)
- `f1-f5`: Format detection scenarios (OTEL, Jaeger, Zipkin, LiteLLM)

## Development

### Setup

```bash
# Install dependencies
npm install

# Build
npm run build

# Run in development mode
npm run dev -- analyze .

# Type checking
npm run typecheck
```

### Project Structure

```
src/
├── cli.ts              # CLI entry point
├── agent.ts            # Two-pass execution orchestrator
├── scanner.ts          # Static code analysis
├── runtime.ts          # Runtime event parsing
├── joiner.ts           # Static + runtime joining
├── insights.ts         # Insight generation
├── history.ts          # v1.5: History storage
├── comparison.ts       # v1.5: Historical comparison
├── prediction.ts       # v1.5: Deploy-time predictions
├── counterfactuals.ts  # v1.5: Optimization scenarios
├── format-normalizer.ts # Multi-format detection
├── costs.ts            # Model pricing data
├── renderer.ts         # Terminal output
├── html.ts             # HTML report generation
├── pdf.ts              # PDF report generation
├── artifacts.ts        # File output management
├── types.ts            # TypeScript types
└── agents/
    ├── index.ts                 # Agent orchestration
    ├── runtime-analyzer.ts      # LLM runtime analysis
    └── correlation-analyzer.ts  # LLM drift detection

prompts/
├── peak-performance.yaml    # Main analysis prompt
├── static-analyzer.yaml     # Static analysis prompt
├── runtime-analyzer.yaml    # Runtime analysis prompt
└── correlation-analyzer.yaml # Drift detection prompt

tests/                  # Unit tests
evals/                  # Evaluation framework
  ├── fixtures/         # Test fixtures
  ├── ground-truth/     # Expected results
  └── metrics/          # Metrics computation

fixtures/demo-project/  # v1.5 demo project
scripts/demo-v1.5.sh    # v1.5 demo script
docs/v1.5-demo-guide.md # v1.5 demo guide
```

### Architecture

PeakInfer uses a **two-pass execution model**:

1. **Planning Pass**: Analyze inputs, determine what analysis is needed
2. **Execution Pass**: Run analysis tasks with progress tracking

**v1.5 Task Flow**:
```
scan → analyze → [parse_events] → [join] →
compare → predict → counterfactuals →
generate_insights → render → save_artifacts → save_history
```

**LLM Agents** (when API key is available):
- `RuntimeAnalyzerAgent`: Semantic analysis of runtime patterns
- `CorrelationAnalyzerAgent`: Drift detection between code and runtime

Both agents follow prompt templates in `prompts/*.yaml` and have fallback modes for offline operation.

## Quality Bars

- ≥90% inference point detection in supported languages
- Near-zero false positives for providers/models
- <60s analysis for 10k LOC
- Deterministic outputs
- Explainable failures

## Terminology

| Internal (Code) | User-Facing |
|-----------------|-------------|
| `Callsite` type | "inference point" |
| `callsites` array | "inference points" |

## License

Apache-2.0

## About

Built by [Kalmantic](https://github.com/Kalmantic) - inference research, optimization and support.

For questions, issues, or contributions, visit the [GitHub repository](https://github.com/Kalmantic/peakinfer).

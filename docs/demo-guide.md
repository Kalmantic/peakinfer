# PeakInfer Demo Guide

This guide demonstrates all PeakInfer features for analyzing LLM inference in your codebase.

> **v2.0 Update**: PeakInfer now uses a unified prompt-based analysis approach for faster, more accurate results.

## Quick Start

```bash
# Install/update peakinfer
npm install -g @kalmantic/peakinfer

# Verify version
peakinfer --version

# Set your Anthropic API key (BYOK mode)
export ANTHROPIC_API_KEY=sk-ant-...
```

---

## Try PeakInfer with Sample Code

Create a sample project to see PeakInfer in action:

```bash
# Create a test project with LLM calls
mkdir -p /tmp/peakinfer-demo/src
cat > /tmp/peakinfer-demo/src/chat.ts << 'EOF'
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

// No error handling - PeakInfer will flag this
export async function chat(prompt: string): Promise<string> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });
  return response.content[0].type === 'text' ? response.content[0].text : '';
}

// Using expensive model for simple task - PeakInfer will suggest downgrade
export async function classify(text: string): Promise<string> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 100,
    messages: [{ role: 'user', content: `Classify: ${text}` }],
  });
  return response.content[0].type === 'text' ? response.content[0].text : '';
}
EOF

# Analyze it with fix suggestions
peakinfer analyze /tmp/peakinfer-demo --fixes
```

PeakInfer will find:
- **2 inference points** (chat and classify functions)
- **Missing error handling** (critical issue)
- **Model downgrade opportunity** for the classify function

---

## Feature 1: History Storage

History is automatically saved after each analysis run (unless `--no-history` is used).

### Basic Analysis (saves to history)
```bash
# Analyze a codebase - this saves to history automatically
peakinfer analyze /path/to/your/project

# Check history directory
ls -la /path/to/your/project/.peakinfer/history/
```

### Skip History Storage
```bash
# Run analysis without saving to history (useful for quick checks)
peakinfer analyze /path/to/your/project --no-history
```

---

## Feature 2: Historical Comparison (`--compare`)

Compare current analysis with a previous run to see what changed.

### Compare with Latest Run
```bash
# Run analysis and compare with the most recent previous run
peakinfer analyze /path/to/your/project --compare
```

### Compare with Specific Run
```bash
# First, list available runs (check .peakinfer/history/)
ls /path/to/your/project/.peakinfer/history/

# Then compare with a specific run ID
peakinfer analyze /path/to/your/project --compare abc123def
```

### Expected Output
```
Changes since last run (12/15/2024)

  Inference points: 4 → 6 (+2)

  + 2 new inference points
      src/api/chat.ts:45
      src/api/embed.ts:23

  ~ 1 modified inference point
      src/llm/client.ts:89 (model)

Issue changes
  [!] 1 new critical issue
  [✓] 2 warnings resolved
```

---

## Feature 3: Deploy-Time Prediction (`--predict`)

Generate latency predictions before deployment to surface performance risks.

### Basic Prediction
```bash
# Analyze with latency predictions
peakinfer analyze /path/to/your/project --predict
```

### Prediction with Latency Budget
```bash
# Set a target p95 latency budget (in milliseconds)
peakinfer analyze /path/to/your/project --predict --target-p95 2000
```

### Expected Output
```
Deploy-time Prediction

  [!] 2 high-risk inference points (p95 > 5000ms)
  [*] 1 medium-risk inference point (p95 > 2000ms)
  [-] 3 low-risk inference points

Top latency risks
  [!] src/api/summarize.ts:34 (gpt-4)
      p95: 5000ms | p99: 8000ms

  [!] src/api/analyze.ts:78 (claude-3-opus)
      p95: 8000ms | p99: 15000ms

  [*] src/api/chat.ts:45 (gpt-4-turbo)
      p95: 4000ms | p99: 6000ms

  [!] Budget exceeded: worst p95 8000ms > target 2000ms

Latency estimates
  Average p95: 4500ms
  Worst p95: 8000ms
```

---

## Feature 4: Counterfactual Insights (Always On)

Counterfactual "what-if" scenarios are always generated to show optimization opportunities.

### Expected Output
```
Optimization Opportunities

  8 opportunities: up to 80% latency reduction, up to 90% cost savings

  Switch from gpt-4 to gpt-4o-mini [easy]
      Impact: -75% latency, -90% cost
      Tradeoff: Good for simpler tasks, May reduce quality on complex reasoning

  Switch from claude-3-opus to claude-3.5-sonnet [easy]
      Impact: -60% latency, -67% cost
      Tradeoff: Often matches Opus quality at lower cost

  Enable response streaming [easy]
      Impact: -80% latency
      Tradeoff: Total response time unchanged, but first token arrives faster

  Add semantic caching layer [complex]
      Impact: -50% latency, -50% cost
      Tradeoff: Assumes ~50% cache hit rate (varies by use case)

  Enable batching for gpt-4 [moderate]
      Impact: -20% latency, -10% cost
      Tradeoff: Requires collecting requests before processing
```

---

## Feature 5: Updated Output Order

The output now prioritizes decision-relevant information first:

1. **Historical Comparison** - What changed since last run
2. **Deploy-Time Prediction** - Latency risks before deploy
3. **Counterfactual Insights** - Optimization opportunities
4. **Code-Runtime Drift** - Code/runtime mismatches
5. **BLUF Summary** - Bottom line up front
6. **Details** - Scope, Performance Profile, Runtime, Findings
7. **Next Steps** - What to do next

---

## Combined Examples

### Full Analysis with All Features
```bash
# Complete analysis with comparison and prediction
peakinfer analyze /path/to/your/project \
  --compare \
  --predict \
  --target-p95 3000 \
  --html \
  --open
```

### Combined Static + Runtime Analysis
```bash
# Analyze code and runtime events together
peakinfer analyze /path/to/your/project \
  --events /path/to/runtime-logs.jsonl \
  --compare \
  --predict \
  --html
```

### Expected Combined Output
```
peakinfer v1.5.x

Changes since last run (12/15/2024)

  Inference points: 4 → 6 (+2)

  + 2 new inference points
      src/api/chat.ts:45
      src/api/embed.ts:23

Deploy-time Prediction

  [!] 2 high-risk inference points (p95 > 5000ms)
  [*] 1 medium-risk inference point (p95 > 2000ms)
  [✓] 3 within acceptable latency

  [!] Budget exceeded: worst p95 8000ms > target 3000ms

Latency estimates
  Average p95: 3200ms
  Worst p95: 8000ms

Optimization Opportunities

  5 opportunities: up to 75% latency reduction, up to 90% cost savings

  Switch from gpt-4 to gpt-4o-mini [easy]
      Impact: -75% latency, -90% cost
      Tradeoff: Good for simpler tasks

  Enable response streaming [easy]
      Impact: -80% latency

Code-Runtime Drift

  [*] 2 inference points in code but not in runtime
      (dead code? not yet deployed?)
  [!] 1 runtime event not mapped to code
      (dynamic calls? wrapper functions?)

Potential Performance Improvement across 6 inference points
  -45% cost  |  -30% latency  |  +20% throughput

...
```

---

## Demo Script (Copy-Paste Ready)

```bash
#!/bin/bash
# PeakInfer v1.5 Feature Demo Script

PROJECT_PATH="."  # Change to your project path

echo "=== PeakInfer v1.5 Demo ==="
echo ""

# Step 1: Basic analysis (creates history)
echo "Step 1: Running basic analysis..."
peakinfer analyze $PROJECT_PATH
echo ""

# Step 2: Make a code change, then compare
echo "Step 2: Running with comparison..."
peakinfer analyze $PROJECT_PATH --compare
echo ""

# Step 3: Check predictions before deploy
echo "Step 3: Running with predictions..."
peakinfer analyze $PROJECT_PATH --predict --target-p95 2000
echo ""

# Step 4: Full analysis with all features
echo "Step 4: Full analysis with HTML report..."
peakinfer analyze $PROJECT_PATH \
  --compare \
  --predict \
  --target-p95 3000 \
  --html \
  --open

echo ""
echo "=== Demo Complete ==="
```

---

## Testing with Sample Projects

### Create a Test Project
```bash
# Create a minimal test project
mkdir -p /tmp/peakinfer-test/src
cd /tmp/peakinfer-test

# Create a simple file with LLM calls
cat > src/app.ts << 'EOF'
import OpenAI from 'openai';

const client = new OpenAI();

async function chat(prompt: string) {
  const response = await client.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
  });
  return response.choices[0].message.content;
}

async function embed(text: string) {
  const response = await client.embeddings.create({
    model: 'text-embedding-ada-002',
    input: text,
  });
  return response.data[0].embedding;
}
EOF

# Run first analysis
peakinfer analyze .

# Add another LLM call
cat >> src/app.ts << 'EOF'

async function summarize(text: string) {
  const response = await client.chat.completions.create({
    model: 'gpt-4-turbo',
    messages: [{ role: 'user', content: `Summarize: ${text}` }],
    stream: true,
  });
  return response;
}
EOF

# Run comparison
peakinfer analyze . --compare --predict --target-p95 2000
```

---

## CLI Reference

```
peakinfer analyze [path] [options]

History Options (v1.5):
  --no-history         Skip saving run to history
  --compare [runId]    Compare with previous run (default: latest)
  --predict            Generate deploy-time latency predictions
  --target-p95 <ms>    Target p95 latency for budget calculation

Other Options:
  --events <file>      Add runtime telemetry to static analysis
  --html               Generate HTML report
  --pdf                Generate PDF report
  --open               Open report in browser/viewer
  --verbose            Show detailed task progress
```

---

## Troubleshooting

### No History Found for Comparison
```
Comparison skipped: no previous runs found
```
**Solution**: Run analysis at least once without `--no-history` before using `--compare`.

### Prediction Shows All Low Risk
This means your models and patterns are well-optimized. The prediction uses heuristic estimates based on model characteristics.

### Counterfactuals Not Showing
Counterfactuals require at least one inference point to be detected. Ensure your code contains LLM API calls.

---

## Questions?

- GitHub Issues: https://github.com/Kalmantic/peakinfer/issues
- Documentation: See `design/` folder for PRD, TDD, and DD documents

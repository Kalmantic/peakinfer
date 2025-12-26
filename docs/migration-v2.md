# Migration Guide: PeakInfer v1.8 → v2.0

This guide helps you migrate from PeakInfer v1.8 to v2.0.

## Overview of Changes

PeakInfer v2.0 is a major architectural upgrade that improves accuracy, speed, and maintainability.

| Aspect | v1.8 | v2.0 |
|--------|------|------|
| **Analysis Engine** | TypeScript + Regex | Claude Code Agent SDK |
| **Callsite Discovery** | Regex patterns | Semantic code understanding |
| **Architecture** | Multi-phase agents | Unified single-call |
| **Templates** | 27 templates | 43 templates (12 insight + 31 optimization) |
| **Speed** | ~70s per file | ~30s per file (60% faster) |
| **Cost** | ~$0.05 per file | ~$0.02 per file (60% cheaper) |
| **Pricing** | 300 credits/10 days free | 50 credits one-time (6-month expiry) |

## Breaking Changes

### 1. CLI Command Changes

```bash
# v1.8: Separate commands for different analyses
peakinfer scan ./src                    # Discovery only
peakinfer profile ./src                 # Cost/latency profiling
peakinfer drift ./src --events file.jsonl

# v2.0: Unified analyze command
peakinfer analyze ./src                           # Full analysis
peakinfer analyze ./src --events production.jsonl # With runtime correlation
```

### 2. Output Format Changes

The InferenceMap schema has been updated to v0.1:

```diff
{
-  "version": "0.0.1",
+  "version": "0.1",
   "root": "./src",
   "generatedAt": "2024-12-21T10:00:00Z",
+  "metadata": {
+    "promptId": "unified-analyzer",
+    "promptVersion": "1.6.0",
+    "llmProvider": "anthropic",
+    "llmModel": "claude-sonnet-4-20250514"
+  },
   "summary": { ... },
   "callsites": [
     {
       "id": "src/chat.ts:42",
       "file": "src/chat.ts",
       "line": 42,
       "provider": "openai",
       "model": "gpt-4o",
+      "framework": "langchain",  // NEW: Framework detection
+      "runtime": null,           // NEW: Runtime detection (vllm, tgi, etc.)
       "patterns": {
         "streaming": true,
-        "retry": true,           // Renamed
+        "retries": true,         // Renamed for consistency
         "caching": false,
-        "error_handling": true   // Removed
+        "fallback": true         // NEW: Fallback pattern detection
       },
       "confidence": 0.95
     }
   ]
}
```

### 3. Configuration File Changes

```yaml
# v1.8: .peakinferrc.yaml
scan:
  extensions: [.ts, .js, .py]
  ignore: [node_modules, dist]
profile:
  include_cost: true
  include_latency: true

# v2.0: .peakinfer.yaml (new name)
analyze:
  extensions: [.ts, .tsx, .js, .jsx, .py]  # More extensions supported
  ignore: [node_modules, dist, .git, __pycache__]
  prompt: unified-analyzer  # Configurable prompt pack
output:
  format: text  # text, json
  save: true    # Auto-save to .peakinfer/
```

### 4. API Key Changes

```bash
# v1.8: Used PEAKINFER_API_KEY for managed mode
export PEAKINFER_API_KEY=pk_xxx

# v2.0: BYOK mode uses your Anthropic key directly
export ANTHROPIC_API_KEY=sk-ant-xxx

# For managed mode (GitHub Action), use PEAKINFER_TOKEN
export PEAKINFER_TOKEN=pt_xxx
```

### 5. Credit System Changes

| v1.8 | v2.0 |
|------|------|
| 300 credits free (10-day refresh) | 50 credits free (one-time, 6-month expiry) |
| Pro: $20/500 credits | Starter: $19/200, Growth: $49/600, Scale: $149/2000 |
| Monthly subscription | Credit packs (no subscription) |

## Migration Steps

### Step 1: Update CLI

```bash
# Uninstall v1.8
npm uninstall -g @kalmantic/peakinfer

# Install v2.0
npm install -g @kalmantic/peakinfer
```

### Step 2: Update Configuration

```bash
# Rename config file
mv .peakinferrc.yaml .peakinfer.yaml

# Update config format (see example above)
```

### Step 3: Update API Key

```bash
# Add to your shell profile (.bashrc, .zshrc, etc.)
export ANTHROPIC_API_KEY="your-key-here"

# Or create .env file
echo "ANTHROPIC_API_KEY=your-key-here" > .env
```

### Step 4: Update Scripts

```diff
# package.json scripts
{
  "scripts": {
-   "peakinfer": "peakinfer scan ./src && peakinfer profile ./src"
+   "peakinfer": "peakinfer analyze ./src"
  }
}
```

### Step 5: Update GitHub Action

```diff
# .github/workflows/peakinfer.yml
- uses: kalmantic/peakinfer-action@v1
+ uses: kalmantic/peakinfer-action@v2
  with:
    path: ./src
-   mode: scan-and-profile
+   # mode is now automatic - unified analysis
    events: ./events.jsonl
+   events-map: timestamp=time,model=model_name  # NEW: Field mapping
```

### Step 6: Update CI/CD Integration

```diff
# Check output format changes in your CI scripts
- if jq -e '.callsites[] | select(.patterns.retry == false)' output.json; then
+ if jq -e '.callsites[] | select(.patterns.retries == false)' output.json; then
    echo "Missing retry handling detected"
    exit 1
  fi
```

## New Features in v2.0

### 1. Framework Detection

v2.0 automatically detects LLM frameworks:

```json
{
  "id": "src/rag.ts:25",
  "framework": "langchain",  // langchain, llamaindex, haystack, etc.
  "runtime": null
}
```

### 2. Self-Hosted Runtime Detection

```json
{
  "id": "src/inference.py:42",
  "provider": null,
  "runtime": "vllm"  // vllm, tgi, ollama, sglang, etc.
}
```

### 3. Field Mapping for Runtime Events

Handle non-standard event formats:

```bash
# v2.0: Map custom field names
peakinfer analyze ./src \
  --events logs.jsonl \
  --events-map latency_ms=duration,model=model_name,input_tokens=prompt_tokens
```

### 4. What-If Analysis

```bash
# Predict impact of model changes
peakinfer whatif --model gpt-4o-mini

# Output: "Switching 5 inference points from gpt-4o to gpt-4o-mini
#          would reduce monthly cost by $2,340 (67% reduction)"
```

### 5. Historical Comparison

```bash
# Compare current run with baseline
peakinfer analyze ./src --compare-baseline

# Compare two specific runs
peakinfer history compare run_abc123 run_def456
```

### 6. Latency Prediction

```bash
# Predict p95 latency based on InferenceMAX envelope data
peakinfer analyze ./src --predict --target-p95 2000
```

## Template Migration

If you have custom templates, update them to v2.0 schema:

```diff
# Template changes
{
  "id": "my-custom-template",
- "type": "insight",
+ "category": "cost",        # cost, drift, performance, waste
+ "severity": "warning",     # critical, warning, info
  "match": {
    "scope": "callsite",
    "conditions": [
-     { "field": "retry", "equals": false }
+     { "field": "patterns.retries", "op": "eq", "value": false }
    ]
  }
}
```

## FAQ

### Q: Will my v1.8 InferenceMap files still work?

A: v2.0 can read v1.8 files but will convert them on save. Consider regenerating for full v2.0 benefits.

### Q: Do I need to change my Anthropic API key?

A: No, the same key works. Just update the environment variable name if using the old `PEAKINFER_API_KEY`.

### Q: Are v1.8 templates compatible?

A: Mostly yes. Check the template schema changes above and update `match.conditions` syntax.

### Q: What happened to the `scan` command?

A: It's now integrated into `analyze`. Use `peakinfer analyze ./src` for all analysis types.

### Q: How do I get my free credits?

A: Sign in at peakinfer.com with GitHub. First-time users get 50 credits automatically.

## Getting Help

- **Documentation:** https://peakinfer.com/docs
- **GitHub Issues:** https://github.com/Kalmantic/peakinfer/issues
- **Discord:** https://discord.gg/kalmantic

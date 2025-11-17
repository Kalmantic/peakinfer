# How to Run Claude Discovery Agent

## Quick Start (2 Minutes)

```bash
# Navigate to project
cd /Users/badhraajazahmad/Ajaz/Kalmantic/peakinfer

# Set API key
export ANTHROPIC_API_KEY="sk-ant-your-key-here"

# Run discovery
npm run dev -- discover

# DONE! ✅
```

---

## Three Ways to Run It

### Method 1: Development Mode (Fastest)
```bash
npm run dev -- discover
```
**Best for:** Quick testing and development

### Method 2: Production Mode (Compiled)
```bash
npm run build
npm run start -- discover
```
**Best for:** Performance and distribution

### Method 3: Global CLI (Like Claude Code)
```bash
npm link
peakinfer discover    # Works from anywhere!
```
**Best for:** Using as system command

---

## Link as Global Command

### Using npm link

```bash
# From project directory
npm link

# Now use globally
peakinfer discover
peakinfer orchestrate --workload events.jsonl
peakinfer templates

# Stop using it
npm unlink
```

### Add to PATH

```bash
# Build first
npm run build

# Add to ~/.bashrc or ~/.zshrc
export PATH="/Users/badhraajazahmad/Ajaz/Kalmantic/peakinfer/dist:$PATH"

# Reload shell
source ~/.bashrc

# Use it
peakinfer discover
```

---

## All Available Commands

```bash
# Discovery
npm run dev -- discover --output env.yaml

# Workload profiling
npm run dev -- profile --events events.jsonl

# Optimization planning
npm run dev -- plan --constraints policy.yaml

# Execute optimizations
npm run dev -- run --plan optimization-plan.yaml

# Generate report
npm run dev -- report --output-dir reports/

# Full orchestration (all-in-one)
npm run dev -- orchestrate --workload events.jsonl --policy policy.yaml

# Template commands
npm run dev -- templates
npm run dev -- execute semantic-caching --dry-run
npm run dev -- template-apply semantic-caching
```

---

## Step-by-Step Example

### Create Sample Files

```bash
# Create events
cat > events.jsonl << 'ENDFILE'
{"id":"evt-001","ts":"2025-08-31T10:01:00Z","intent":"test","provider":"openai","model":"gpt-4","input_tokens":100,"output_tokens":50,"latency_ms":100,"cost_usd":0.01,"endpoint":"api.openai.com","region":"us-east-1","tenant":"test"}
ENDFILE

# Create package.json
cat > package.json << 'ENDFILE'
{"dependencies":{"openai":"^4.0.0"}}
ENDFILE
```

### Run Discovery

```bash
npm run dev -- discover
```

### Full Workflow

```bash
npm run dev -- discover --output env.yaml
npm run dev -- profile --events events.jsonl
npm run dev -- plan --constraints policy.yaml
npm run dev -- run --plan optimization-plan.yaml
npm run dev -- report --output-dir reports/
```

---

## Testing

```bash
# Run all tests
npm test

# Specific test file
npm test -- claude-discovery-agent.test.ts

# Watch mode
npm test -- --watch

# With coverage
npm test -- --coverage
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Command not found | `npm link` or use `npm run dev --` |
| API key error | `export ANTHROPIC_API_KEY="sk-ant-..."` |
| Module not found | `npm install` |
| Type errors | `npm run typecheck` |
| Build errors | `npm run build -- --listFiles` |

---

## Documentation

- **Full Guide:** CLAUDE_DISCOVERY_AGENT.md
- **Runbook:** CLAUDE_DISCOVERY_RUNBOOK.md
- **Examples:** DISCOVERY_AGENT_EXAMPLES.md
- **Summary:** IMPLEMENTATION_SUMMARY.md
- **Execution:** EXECUTION_GUIDE.md

---

## Key Features

✅ Claude Code SDK integration
✅ Multi-layer infrastructure analysis
✅ Canonical events.jsonl support
✅ Cross-layer optimization detection
✅ 88.9% test coverage
✅ Production-ready

---

**You're ready to go! Run `npm run dev -- discover` now.** 🚀

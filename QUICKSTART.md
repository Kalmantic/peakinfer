# TokenOp Quick Start Guide

## 📚 Based on PRD v0.7

This guide shows you how to run TokenOp's multi-agent orchestration system to optimize your LLM infrastructure.

---

## 🚀 Quick Start (30 seconds)

### Option 1: Full Multi-Agent Orchestration (Recommended)

Run the complete 6-stage pipeline:

```bash
# With dry-run (safe, no changes)
node dist/cli.js orchestrate --dry-run

# With example workload data
node dist/cli.js orchestrate \
  --workload examples/events.jsonl \
  --policy examples/policy.yaml \
  --output optimization-report.json
```

**This runs all 6 stages:**
1. 🔍 Discovery - Analyze infrastructure
2. 📊 Profiling - Cluster workload patterns
3. 📋 Policy - Load constraints
4. 🎯 Planning - Create optimization strategy
5. 🚀 Execution - Run optimizations with early stopping
6. 📝 Auditing - Generate ROI report & patches

---

## 📋 Full Workflow (Per PRD)

### Step 1: Prepare Your Data

#### A. Workload Events (Optional but Recommended)

Create `events.jsonl` with your inference logs:

```jsonl
{"id":"evt_001","intent":"summarize","model":"gpt-4","input_tokens":500,"output_tokens":200,"cost_usd":0.015}
{"id":"evt_002","intent":"code_gen","model":"gpt-4","input_tokens":300,"output_tokens":400,"cost_usd":0.021}
```

**Sources:**
- OpenAI API logs
- Anthropic API logs
- LangSmith traces
- PostHog events
- Custom application logs

#### B. Policy File (Optional but Recommended)

Create `policy.yaml` with your constraints:

```yaml
quality_threshold: 0.95
latency_sla_ms: 1000
budget_monthly: 50000
allowed_risk_levels:
  - low
  - medium
```

---

### Step 2: Run Orchestration

```bash
# Full orchestration with all options
node dist/cli.js orchestrate \
  --workload examples/events.jsonl \
  --policy examples/policy.yaml \
  --templates-dir design/templates \
  --output optimization-report.json \
  --dry-run
```

**Options:**
- `--workload <file>` - Path to events.jsonl (optional, uses synthetic if not provided)
- `--policy <file>` - Path to policy.yaml (optional, uses defaults if not provided)
- `--templates-dir <dir>` - Custom templates directory (optional)
- `--output <file>` - Save full JSON report (optional)
- `--dry-run` - Simulate without making changes (recommended first time)

---

### Step 3: Review Results

#### A. Console Output

You'll see a beautiful formatted summary:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🎯 TokenOp Optimization Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Environment Discovered:
  • Runtime: python, openai
  • Serving: transformers
  • GPUs: 2 x A100
  • Monthly Cost: $12,000

💰 Economic Impact:
  • Monthly Savings: $3,600
  • Annual Savings: $43,200
  • ROI: 720%
  • Payback Period: 1.7 months
```

#### B. JSON Report

Full details in `optimization-report.json`:

```json
{
  "environment": { ... },
  "workload_profile": { ... },
  "policy": { ... },
  "plan": { ... },
  "execution_results": [ ... ],
  "audit": {
    "total_cost_savings_monthly": 3600,
    "roi_annual": 720,
    "patches_generated": [...]
  }
}
```

#### C. Implementation Patches

Check `./tokenop-patches/` for generated configuration changes:

```bash
ls -la tokenop-patches/
# vllm-config.yaml
# semantic-cache-config.yaml
# batch-optimization.yaml
```

---

## 🎯 Usage Scenarios

### Scenario 1: First Time Discovery

```bash
# Safe dry-run to see what TokenOp finds
node dist/cli.js orchestrate --dry-run --output discovery-report.json
```

**Use when:**
- First time using TokenOp
- Want to understand your infrastructure
- Need to present findings to team before making changes

### Scenario 2: With Real Workload Data

```bash
# Use your actual inference logs
node dist/cli.js orchestrate \
  --workload production-events.jsonl \
  --policy company-policy.yaml \
  --output prod-optimization.json
```

**Use when:**
- Have collected workload data
- Ready for production optimization
- Want accurate ROI calculations

### Scenario 3: Policy-Constrained Optimization

```bash
# Strict policy for production environment
cat > strict-policy.yaml << EOF
quality_threshold: 0.98
latency_sla_ms: 500
allowed_risk_levels:
  - low
EOF

node dist/cli.js orchestrate --policy strict-policy.yaml
```

**Use when:**
- Production environment with strict SLAs
- Need compliance guarantees
- Want conservative optimizations

### Scenario 4: Continuous Optimization

```bash
# Run weekly to find new opportunities
node dist/cli.js orchestrate \
  --workload last-7-days-events.jsonl \
  --output weekly-report-$(date +%Y-%m-%d).json
```

**Use when:**
- Ongoing optimization program
- Tracking savings over time
- Infrastructure changes frequently

---

## 🔧 Advanced Usage

### Custom Templates

```bash
# Use your own template directory
node dist/cli.js orchestrate --templates-dir ./my-templates/
```

### Template Development

```bash
# List available templates
node dist/cli.js templates

# Get template details
node dist/cli.js templates --detailed

# Filter by category
node dist/cli.js templates --category runtime_optimization
```

### Execute Specific Template

```bash
# Run just one optimization
node dist/cli.js execute semantic-caching-demo --dry-run
```

---

## 📊 Understanding the Output

### 1. Environment Discovery

**What it shows:**
- Detected runtimes (Python, Node.js, etc.)
- LLM libraries (OpenAI, Anthropic, LangChain)
- Serving frameworks (vLLM, TensorRT, Transformers)
- Infrastructure (GPUs, Kubernetes, cloud provider)

**Example:**
```
✓ Runtimes: python, openai, langchain
✓ Frameworks: transformers
✓ GPUs: 2 x A100 (80GB)
✓ Monthly Cost: $12,000
```

### 2. Workload Profile

**What it shows:**
- Total inference requests
- Intent clusters (semantic grouping)
- Representative samples for testing
- Cost breakdown by use case

**Example:**
```
✓ Total Requests: 50,000
✓ Intent Clusters: 4
  • document_analysis (45%) - $5,400/mo
  • conversational (30%) - $3,600/mo
  • code_generation (25%) - $3,000/mo
```

### 3. Optimization Results

**What it shows:**
- Templates applied
- Success/failure status
- Cost savings per template
- Quality impact

**Example:**
```
[1/5] vLLM Migration
  ✅ Success! Savings: $1,800/month
  📊 Quality: 96.5% preserved

[2/5] Semantic Caching
  ✅ Success! Savings: $1,200/month
  📊 Quality: 98.2% preserved

Total Savings: $3,000/month (25% reduction)
```

### 4. Economic Analysis

**What it shows:**
- Monthly and annual savings
- Implementation cost
- ROI and payback period
- Total economic impact

**Example:**
```
💰 Monthly Savings: $3,000
💰 Annual Savings: $36,000
💸 Implementation Cost: $5,000
📈 ROI: 620%
⏱️  Payback Period: 1.7 months
```

---

## 🎓 PRD-Aligned Commands

According to the PRD, TokenOp provides these commands:

### Current Implementation

```bash
# ✅ Implemented - Multi-agent orchestration (replaces discover/profile/plan/run)
tokenop orchestrate [options]

# ✅ Implemented - Legacy discovery
tokenop discover [options]

# ✅ Implemented - Execute specific template
tokenop execute <template-id> [options]

# ✅ Implemented - List templates
tokenop templates [options]
```

### PRD Future Commands (Not Yet Implemented)

```bash
# 🔜 Coming soon
tokenop profile [--events events.jsonl] [--cluster-method semantic]
tokenop plan [--constraints policy.yaml] [--templates-dir templates/]
tokenop run [--plan plan.yaml] [--sample-size 100] [--early-stopping]
tokenop report [--output-dir reports/] [--format html,csv]

# 🔜 Template management
tokenop template-apply <template_id> [--dry-run] [--interactive]
tokenop submit-implementation <template_id> [--baseline-cost] [--optimized-cost]
tokenop contribute [--template <template_id>] [--results <file>]
```

**Note:** `tokenop orchestrate` currently provides all the functionality of discover + profile + plan + run + report in a single command.

---

## 💡 Tips & Best Practices

### 1. Start with Dry-Run

Always run with `--dry-run` first:
```bash
node dist/cli.js orchestrate --dry-run
```

### 2. Use Real Workload Data

Collect at least 1 week of inference logs for accurate analysis:
```bash
# Export from your LLM provider
# OpenAI logs, Anthropic logs, LangSmith traces, etc.
```

### 3. Define Clear Policies

Create a policy file that matches your org's risk tolerance:
```yaml
quality_threshold: 0.95  # Never drop below 95% quality
latency_sla_ms: 1000     # Must stay under 1 second
```

### 4. Review Patches Before Applying

Always review generated patches in `./tokenop-patches/` before applying to production.

### 5. Monitor After Implementation

Track quality and cost metrics for 1-2 weeks after applying optimizations.

### 6. Run Regularly

Run TokenOp weekly or monthly to find new optimization opportunities as your infrastructure evolves.

---

## 🐛 Troubleshooting

### "Could not parse Claude response as JSON"

This happens when Claude Discovery Agent doesn't return JSON. It's non-fatal - the system falls back to heuristic discovery.

**Solution:**
```bash
# The system works fine with fallback discovery
# Or skip discovery and provide workload data directly
node dist/cli.js orchestrate --workload events.jsonl
```

### "No templates match your environment"

Your infrastructure might not match any template criteria.

**Solution:**
```bash
# 1. Check what was detected
node dist/cli.js orchestrate --dry-run --output report.json
cat report.json | jq '.environment'

# 2. Create custom templates for your stack
# See design/templates/ for examples
```

### "Template loading failed"

Template YAML might have syntax errors.

**Solution:**
```bash
# Validate your YAML
npm install -g yaml-lint
yaml-lint design/templates/*.yaml
```

---

## 📚 Additional Resources

- **`MULTI_AGENT_SYSTEM.md`** - Complete technical guide
- **`IMPLEMENTATION_SUMMARY.md`** - What was built and how
- **`RUN_SUCCESS.md`** - Execution proof and examples
- **`design/TokenOp Product Requirements Document (PRD) v0.7.md`** - Full product spec

---

## 🎯 Next Steps

1. **Run discovery**: `node dist/cli.js orchestrate --dry-run`
2. **Review report**: Check `orchestration-report.json`
3. **Add workload data**: Create `events.jsonl` with real logs
4. **Define policy**: Create `policy.yaml` with constraints
5. **Run for real**: Remove `--dry-run` flag
6. **Apply patches**: Review and apply changes from `tokenop-patches/`
7. **Monitor**: Track quality and cost metrics
8. **Repeat**: Run regularly to find new opportunities

---

**Ready to optimize your LLM infrastructure! 🚀**

# TokenOp Multi-Agent Orchestration System

## Overview

The TokenOp Multi-Agent Orchestration System is a sophisticated AI-powered platform that uses **Claude Code SDK** to intelligently discover, analyze, plan, and execute LLM infrastructure optimizations across all three layers of your stack.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                  Multi-Agent Orchestrator                       │
│                  (Claude Code SDK Powered)                      │
└────┬────────────────────────────────────────────────────────┬───┘
     │                                                         │
     ├─── Stage 1: Discovery Agent ────────────────────────────┤
     │    • Claude-powered codebase analysis                   │
     │    • Intelligent framework detection                    │
     │    • GPU & infrastructure discovery                     │
     │                                                          │
     ├─── Stage 2: Workload Profiler Agent ───────────────────┤
     │    • Semantic prompt clustering                         │
     │    • Intent pattern recognition                         │
     │    • Cost breakdown analysis                            │
     │                                                          │
     ├─── Stage 3: Policy Agent ──────────────────────────────┤
     │    • Load organizational constraints                    │
     │    • Validate risk levels                               │
     │    • Enforce quality thresholds                         │
     │                                                          │
     ├─── Stage 4: Planner Agent ─────────────────────────────┤
     │    • Template matching & filtering                      │
     │    • Search strategy selection                          │
     │    • Execution prioritization                           │
     │                                                          │
     ├─── Stage 5: Runner/Evaluator Agent ────────────────────┤
     │    • Execute optimizations                              │
     │    • Multi-arm bandit early stopping                    │
     │    • Quality monitoring                                 │
     │                                                          │
     └─── Stage 6: Auditor Agent ─────────────────────────────┤
          • Economic impact calculation                        │
          • Patch generation                                   │
          • Recommendation synthesis                           │
          └──────────────────────────────────────────────────┘
```

## Agent Descriptions

### 1. Discovery Agent (`claude-discovery-agent.ts`)

**Purpose**: Intelligently discover your entire LLM infrastructure stack using Claude's reasoning capabilities.

**Key Features**:
- Uses Claude Code SDK to analyze codebase with file reading tools
- Detects application runtimes (Python, Node.js, OpenAI, HuggingFace, LangChain)
- Identifies serving frameworks (vLLM, TensorRT, SGLang, Transformers)
- Discovers infrastructure (GPUs, Kubernetes, Terraform)
- Estimates current monthly costs

**Example Output**:
```
Stage 1️⃣: Environment Discovery
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✓ Runtimes: python, openai, langchain
  ✓ Frameworks: transformers
  ✓ GPUs: 2
  ✓ Monthly Cost: $4,320

  💡 Key Findings:
     • Using basic Transformers - vLLM migration could save 60%
     • GPU utilization at 35% - batch optimization recommended
     • No semantic caching detected
```

### 2. Workload Profiler Agent (`workload-profiler-agent.ts`)

**Purpose**: Cluster prompts semantically and create representative test samples.

**Key Features**:
- Loads workload data from JSONL files (events.jsonl)
- Uses Claude to semantically cluster prompts by intent
- Generates representative samples for testing
- Calculates cost breakdown by intent
- Supports synthetic profile generation for demos

**Input Format** (events.jsonl):
```jsonl
{"id":"evt_001","intent":"document_summarization","prompt":"Summarize this...","input_tokens":500,"output_tokens":200,"cost_usd":0.015}
{"id":"evt_002","intent":"code_generation","prompt":"Write a function...","input_tokens":300,"output_tokens":400,"cost_usd":0.021}
```

**Example Output**:
```
Stage 2️⃣: Workload Profiling
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✓ Loaded 15,000 inference events
  ✓ Identified 4 intent clusters
  ✓ Generated 12 representative samples

  Intent Clusters:
  • document_analysis (45%) - $450/month
  • conversational (30%) - $300/month
  • code_generation (25%) - $250/month
```

### 3. Policy Agent (`policy-agent.ts`)

**Purpose**: Load and enforce organizational constraints and quality requirements.

**Key Features**:
- Loads policy from YAML files
- Validates template risk levels
- Enforces quality thresholds
- Checks latency SLAs and budget constraints

**Policy File Format** (policy.yaml):
```yaml
quality_threshold: 0.95        # 95% minimum quality
latency_sla_ms: 1000          # 1 second max latency
budget_monthly: 50000         # $50k monthly budget
allowed_risk_levels:
  - low
  - medium
required_approvals: []         # Empty for auto-approve low/medium
excluded_techniques: []        # Techniques to avoid
```

### 4. Planner Agent (`planner-agent.ts`)

**Purpose**: Create intelligent optimization search plans.

**Key Features**:
- Matches templates to environment
- Filters by policy constraints
- Selects search strategy (greedy/bandit/exhaustive)
- Prioritizes by expected ROI
- Defines early stopping criteria

**Search Strategies**:
- **Greedy**: Stop after first success (fastest)
- **Bandit**: Multi-arm bandit sampling (balanced)
- **Exhaustive**: Test all candidates (thorough)

### 5. Runner/Evaluator Agent (`runner-evaluator-agent.ts`)

**Purpose**: Execute optimizations with intelligent early stopping.

**Key Features**:
- Executes templates in priority order
- Bandit-style exploration/exploitation
- Real-time quality monitoring
- Early stopping on diminishing returns
- Automatic rollback on failure

**Early Stopping Criteria**:
```typescript
{
  min_improvement_threshold: 0.05,      // 5% minimum gain
  max_candidates_to_test: 10,           // Test max 10
  quality_degradation_threshold: 0.05,  // 5% max quality drop
  max_execution_time_minutes: 60        // 1 hour max
}
```

### 6. Auditor Agent (`auditor-agent.ts`)

**Purpose**: Summarize results, calculate ROI, and generate implementation patches.

**Key Features**:
- Calculates total savings and ROI
- Generates implementation patches using Claude
- Saves patches to `./tokenop-patches/`
- Provides actionable recommendations
- Quality impact analysis

**Example Output**:
```
Stage 6️⃣: Auditing & Reporting
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✓ 3/5 optimizations succeeded
  ✓ Monthly savings: $1,290
  ✓ Annual savings: $15,480
  ✓ Implementation cost: $3,000
  ✓ ROI: 416%
  ✓ Payback period: 2.3 months
  ✓ Quality impact: -0.5%

  🔧 Generated 3 patches
```

## Usage

### Basic Orchestration

```bash
# Full multi-agent orchestration
tokenop orchestrate

# With workload data
tokenop orchestrate --workload events.jsonl

# With policy constraints
tokenop orchestrate --policy policy.yaml

# Dry run (no changes)
tokenop orchestrate --dry-run

# Save full report
tokenop orchestrate --output report.json
```

### Example Workflow

1. **Prepare workload data** (optional):
```bash
# Create events.jsonl with your inference logs
cat > events.jsonl << EOF
{"id":"1","intent":"chat","input_tokens":100,"output_tokens":200,"cost_usd":0.015}
{"id":"2","intent":"summarize","input_tokens":500,"output_tokens":100,"cost_usd":0.018}
EOF
```

2. **Create policy file** (optional):
```bash
cat > policy.yaml << EOF
quality_threshold: 0.95
latency_sla_ms: 1000
budget_monthly: 50000
allowed_risk_levels:
  - low
  - medium
EOF
```

3. **Run orchestration**:
```bash
tokenop orchestrate --workload events.jsonl --policy policy.yaml --output report.json
```

4. **Review results**:
```bash
# Check generated patches
ls -la tokenop-patches/

# Read full report
cat report.json | jq '.audit'
```

## Multi-Agent Orchestrator API

You can also use the orchestrator programmatically:

```typescript
import { MultiAgentOrchestrator } from './orchestration/multi-agent-orchestrator.js';

const orchestrator = new MultiAgentOrchestrator();

const result = await orchestrator.orchestrateOptimization({
  workloadDataPath: 'events.jsonl',
  policyPath: 'policy.yaml',
  dryRun: false,
  templatesDir: './templates'
});

console.log('Total Savings:', result.total_savings);
console.log('ROI:', result.roi);
console.log('Patches:', result.audit.patches_generated);
```

## Claude Code SDK Integration

### How It Works

The multi-agent system leverages Claude Code SDK's `query()` function to enable Claude to:

1. **Read and analyze your codebase** using tools like `Read`, `Glob`, `Grep`
2. **Reason about optimization opportunities** based on detected infrastructure
3. **Cluster prompts semantically** using natural language understanding
4. **Generate implementation patches** with context-aware code generation
5. **Provide intelligent recommendations** based on industry best practices

### Example: Discovery Agent with Claude

```typescript
import { query } from '@anthropic-ai/claude-code';

const claudeQuery = query({
  prompt: 'Analyze this codebase for LLM infrastructure...',
  options: {
    model: 'claude-sonnet-4-5-20250929',
    maxTurns: 5,
    cwd: process.cwd(),
    allowedTools: ['Read', 'Glob', 'Bash', 'Grep'],
  }
});

for await (const message of claudeQuery) {
  if (message.type === 'assistant') {
    // Process Claude's analysis
  }
}
```

## Benefits of Multi-Agent System

### 1. **Intelligence**
- Claude's reasoning for pattern detection
- Semantic clustering beyond simple heuristics
- Context-aware patch generation

### 2. **Automation**
- End-to-end optimization pipeline
- Automatic early stopping
- Rollback on failure

### 3. **Safety**
- Policy enforcement
- Quality monitoring
- Risk level validation
- Requires approval for high-risk changes

### 4. **Transparency**
- Stage-by-stage progress
- Detailed audit reports
- Generated patches for review

### 5. **Economics**
- ROI calculations at every step
- Cost-benefit analysis
- Payback period estimation

## Comparison: Legacy vs Multi-Agent

| Feature | Legacy `discover` | New `orchestrate` |
|---------|------------------|-------------------|
| Environment Discovery | ✅ Heuristic-based | ✅ Claude-powered |
| Workload Profiling | ❌ None | ✅ Semantic clustering |
| Policy Enforcement | ❌ None | ✅ YAML-based policies |
| Search Strategy | ❌ Linear | ✅ Greedy/Bandit/Exhaustive |
| Early Stopping | ❌ None | ✅ Multi-criteria |
| Quality Monitoring | ⚠️ Basic | ✅ Continuous |
| Patch Generation | ❌ Manual | ✅ Automated with Claude |
| Audit Reports | ⚠️ Basic | ✅ Comprehensive |

## Next Steps

1. **Try the orchestrator**: `tokenop orchestrate --dry-run`
2. **Add workload data**: Create `events.jsonl` with real inference logs
3. **Define policies**: Create `policy.yaml` with your constraints
4. **Review patches**: Check `./tokenop-patches/` for generated changes
5. **Monitor results**: Track savings and quality impact post-implementation

## Technical Details

### Project Structure

```
src/
├── orchestration/
│   ├── multi-agent-orchestrator.ts     # Main orchestrator
│   └── agents/
│       ├── claude-discovery-agent.ts   # Stage 1: Discovery
│       ├── workload-profiler-agent.ts  # Stage 2: Profiling
│       ├── policy-agent.ts             # Stage 3: Policy
│       ├── planner-agent.ts            # Stage 4: Planning
│       ├── runner-evaluator-agent.ts   # Stage 5: Execution
│       └── auditor-agent.ts            # Stage 6: Auditing
├── agents/                             # Legacy agents
├── core/                               # Core utilities
└── cli.ts                              # CLI with new orchestrate command
```

### Dependencies

- `@anthropic-ai/claude-code`: Claude Code SDK for AI reasoning
- `commander`: CLI framework
- `chalk`: Terminal colors
- `ora`: Loading spinners
- `yaml`: YAML parsing
- `glob`: File pattern matching
- `fs-extra`: File system utilities

## Contributing

To add new agents or extend the orchestration:

1. Create agent in `src/orchestration/agents/`
2. Implement stage logic using Claude SDK
3. Add to `MultiAgentOrchestrator`
4. Update CLI command options
5. Document in this README

## License

Apache 2.0 - See LICENSE file for details

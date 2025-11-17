# Claude Discovery Agent - Complete Runbook

## Quick Start (2 Minutes)

### 1. Setup Environment

```bash
# Navigate to project directory
cd /Users/badhraajazahmad/Ajaz/Kalmantic/peakinfer

# Set Claude API Key
export ANTHROPIC_API_KEY="sk-ant-your-api-key-here"

# Install dependencies (if needed)
npm install
```

### 2. Create Sample Events File

```bash
# Create events.jsonl with sample inference data
cat > events.jsonl << 'EOF'
{"id":"evt-001","ts":"2025-08-31T10:01:00Z","intent":"extract_email","provider":"openai","model":"gpt-4o","input_tokens":500,"output_tokens":100,"latency_ms":150,"cost_usd":0.015,"endpoint":"api.openai.com","region":"us-east-1","tenant":"team_analytics"}
{"id":"evt-002","ts":"2025-08-31T10:02:00Z","intent":"summarize_doc","provider":"anthropic","model":"claude-3-sonnet","input_tokens":2000,"output_tokens":200,"latency_ms":300,"cost_usd":0.008,"endpoint":"api.anthropic.com","region":"us-west-2","tenant":"team_analytics"}
{"id":"evt-003","ts":"2025-08-31T10:03:00Z","intent":"categorization","provider":"openai","model":"gpt-3.5-turbo","input_tokens":300,"output_tokens":50,"latency_ms":100,"cost_usd":0.001,"endpoint":"api.openai.com","region":"us-east-1","tenant":"team_analytics"}
EOF
```

### 3. Run Discovery Agent

```bash
# Method 1: Using npm dev command
npm run dev -- discover

# Method 2: Using global CLI (after building)
npm run build
npm run start -- discover
```

---

## Running Options

### Option A: Direct TypeScript Execution (Development)

```bash
# Run discovery agent directly
npm run dev -- discover

# Expected Output:
# 🔍 Analyzing your infrastructure with Claude...
#
# 💭 Claude: Collecting inference events and infrastructure data...
# 💭 Claude: Running multi-layer optimization analysis with Claude...
#
# ✓ Runtimes: nodejs, openai
# ✓ Frameworks: langchain
# ✓ GPUs: 0
# ✓ Monthly Cost: $2,150
# ✓ Optimization Potential: $1,290/month
```

### Option B: Compiled JavaScript (Production)

```bash
# Build TypeScript to JavaScript
npm run build

# Run compiled version
npm run start -- discover

# Or use directly
node dist/cli.js discover
```

### Option C: Global CLI Installation (Like Claude Code)

```bash
# Link locally for development
npm link

# Now you can run from anywhere
peakinfer discover

# Unlink when done
npm unlink
```

---

## Integration with Multi-Agent Orchestration

### Step 1: Import Discovery Agent

```typescript
import { ClaudeDiscoveryAgent } from './orchestration/agents/claude-discovery-agent.js';
import { ClaudeHelper } from './utils/claude-helper.js';

async function runDiscovery() {
  // Ensure Claude API key is available
  await ClaudeHelper.ensureApiKey();

  // Create discovery agent instance
  const agent = new ClaudeDiscoveryAgent();

  // Run discovery
  const environment = await agent.discover();

  return environment;
}
```

### Step 2: Use Discovery Results in Other Agents

```typescript
// discovery-orchestration.ts
import { MultiAgentOrchestrator } from './orchestration/multi-agent-orchestrator.js';

async function orchestrateFullWorkflow() {
  const orchestrator = new MultiAgentOrchestrator();

  // Step 1: Discovery
  console.log('🔍 Step 1: Running Discovery Agent...');
  const environment = await orchestrator.discoveryAgent.discover();
  console.log(`✓ Monthly Cost: $${environment.infrastructure.cost_breakdown.total_monthly}`);

  // Step 2: Workload Profiling
  console.log('📊 Step 2: Running Workload Profiler...');
  const profile = await orchestrator.profilerAgent.profileWorkload('events.jsonl', environment);
  console.log(`✓ Found ${profile.clustered_intents.length} intent clusters`);

  // Step 3: Planning
  console.log('🎯 Step 3: Running Planner Agent...');
  const plan = await orchestrator.plannerAgent.createPlan(environment, profile, {}, 'templates');
  console.log(`✓ Generated plan with ${plan.candidate_templates.length} candidate templates`);

  // Step 4: Execution
  console.log('⚙️  Step 4: Running Runner/Evaluator...');
  const results = await orchestrator.runnerAgent.executeWithEarlyStopping(plan, environment, profile, false);
  console.log(`✓ ${results.filter((r: any) => r.success).length} templates succeeded`);

  // Step 5: Audit
  console.log('📈 Step 5: Running Auditor Agent...');
  const audit = await orchestrator.auditorAgent.auditResults(results, environment, profile, {});
  console.log(`✓ Total Savings: $${audit.total_cost_savings_annual}/year`);
}

// Run it
orchestrateFullWorkflow().catch(console.error);
```

### Step 3: Full CLI Command

```bash
# Run complete multi-agent orchestration
peakinfer orchestrate \
  --workload events.jsonl \
  --policy policy.yaml \
  --templates-dir templates/ \
  --output results.json

# Output includes all stages:
# 🤖 TokenOp: Multi-Agent Orchestration
#
# ✓ Discovery: Found infrastructure
# ✓ Profiling: Clustered workload
# ✓ Planning: Generated optimization plan
# ✓ Execution: Applied templates
# ✓ Audit: Generated report
#
# 💰 Economic Impact:
#   Monthly Savings: $1,290
#   Annual Savings: $15,480
#   ROI: 245%
#   Payback Period: 2.4 months
```

---

## Running Individual Components

### 1. Discovery Agent Only

```bash
# CLI approach
npm run dev -- discover --output discovered.yaml

# Programmatic approach
import { ClaudeDiscoveryAgent } from './orchestration/agents/claude-discovery-agent.js';

const agent = new ClaudeDiscoveryAgent();
const env = await agent.discover();
console.log(JSON.stringify(env, null, 2));
```

### 2. Workload Profiler (requires discovery output)

```bash
npm run dev -- profile --events events.jsonl --output profile.json
```

### 3. Planner Agent (requires discovery + profile)

```bash
npm run dev -- plan \
  --constraints policy.yaml \
  --templates-dir templates/ \
  --output plan.yaml
```

### 4. Runner/Evaluator (requires plan)

```bash
npm run dev -- run \
  --plan optimization-plan.yaml \
  --sample-size 100 \
  --early-stopping \
  --output results.json
```

### 5. Audit & Report (requires execution results)

```bash
npm run dev -- report \
  --output-dir reports/ \
  --format html,json \
  --dashboard
```

---

## Testing the Implementation

### Run Unit Tests

```bash
# All unit tests
npm test -- claude-discovery-agent.test.ts

# With coverage
npm test -- claude-discovery-agent.test.ts --coverage

# Watch mode (auto-rerun on changes)
npm test -- claude-discovery-agent.test.ts --watch

# Output:
# PASS  src/orchestration/agents/__tests__/claude-discovery-agent.test.ts
#   ClaudeDiscoveryAgent
#     Unit Tests - Canonical Event Schema
#       ✓ should parse valid events.jsonl with canonical schema (45ms)
#       ✓ should handle invalid JSON lines gracefully (12ms)
#       ✓ should calculate cost metrics from events (8ms)
#     Unit Tests - Context Analysis
#       ✓ should calculate average context length (7ms)
#       ✓ should identify context distribution percentiles (9ms)
#     ... (47 tests total)
#
# Tests:       47 passed, 47 total
# Coverage:    88.9% lines, 85.6% branches
```

### Run Integration Tests

```bash
# Integration tests only
npm test -- claude-discovery-integration.test.ts

# Integration tests with detailed output
npm test -- claude-discovery-integration.test.ts --verbose

# Output:
# PASS  src/orchestration/agents/__tests__/claude-discovery-integration.test.ts
#   ClaudeDiscoveryAgent Integration Tests
#     Scenario 1: E-commerce Platform with High Token Cost
#       ✓ should identify cost optimization opportunities across layers (256ms)
#     Scenario 2: Data Pipeline with Databricks + Snowflake
#       ✓ should detect cross-layer optimization... (189ms)
#     Scenario 3: Kubernetes-based Serving Cluster
#       ✓ should identify infrastructure optimization... (145ms)
#     ... (14 tests total)
#
# Tests:       14 passed, 14 total
```

### Run All Tests with Coverage

```bash
npm run test:coverage

# Opens coverage report in your browser
open coverage/index.html
```

---

## Troubleshooting

### Problem: "ANTHROPIC_API_KEY not found"

```bash
# Solution 1: Set environment variable
export ANTHROPIC_API_KEY="sk-ant-your-key-here"
npm run dev -- discover

# Solution 2: Create .env file
echo 'ANTHROPIC_API_KEY=sk-ant-your-key-here' > .env
npm run dev -- discover

# Solution 3: The CLI will prompt you interactively
npm run dev -- discover
# Enter your API key when prompted
```

### Problem: "Cannot find module @anthropic-ai/claude-code"

```bash
# Solution: Install dependencies
npm install

# Or update specific package
npm install @anthropic-ai/claude-code@latest
```

### Problem: "events.jsonl not found"

```bash
# Create sample events file
cat > events.jsonl << 'EOF'
{"id":"evt-001","ts":"2025-08-31T10:01:00Z","intent":"test","provider":"openai","model":"gpt-4","input_tokens":100,"output_tokens":50,"latency_ms":100,"cost_usd":0.01,"endpoint":"api.openai.com","region":"us-east-1","tenant":"test"}
EOF

npm run dev -- discover
```

### Problem: TypeScript compilation errors

```bash
# Typecheck
npm run typecheck

# Build with verbose output
npm run build -- --listFiles

# Clear cache and rebuild
rm -rf dist
npm run build
```

---

## Real-World Example: E-Commerce Platform

### Setup

```bash
# 1. Create project directory
mkdir peakinfer-ecommerce && cd peakinfer-ecommerce

# 2. Initialize from peakinfer
cd /Users/badhraajazahmad/Ajaz/Kalmantic/peakinfer

# 3. Create events file with e-commerce data
cat > events.jsonl << 'EOF'
{"id":"evt-rec-0001","ts":"2025-08-31T10:00:00Z","intent":"product_recommendation","provider":"openai","model":"gpt-4o","input_tokens":800,"output_tokens":200,"latency_ms":300,"cost_usd":0.015,"endpoint":"api.openai.com","region":"us-east-1","tenant":"ecommerce_prod"}
{"id":"evt-rec-0002","ts":"2025-08-31T10:01:00Z","intent":"product_recommendation","provider":"openai","model":"gpt-4o","input_tokens":800,"output_tokens":200,"latency_ms":290,"cost_usd":0.015,"endpoint":"api.openai.com","region":"us-east-1","tenant":"ecommerce_prod"}
{"id":"evt-support-0001","ts":"2025-08-31T10:00:30Z","intent":"customer_support","provider":"anthropic","model":"claude-3-sonnet","input_tokens":1200,"output_tokens":400,"latency_ms":250,"cost_usd":0.008,"endpoint":"api.anthropic.com","region":"us-west-2","tenant":"ecommerce_prod"}
{"id":"evt-search-0001","ts":"2025-08-31T10:00:15Z","intent":"search_optimization","provider":"openai","model":"gpt-3.5-turbo","input_tokens":300,"output_tokens":100,"latency_ms":100,"cost_usd":0.001,"endpoint":"api.openai.com","region":"us-east-1","tenant":"ecommerce_prod"}
EOF

# 4. Create package.json for app
cat > package.json << 'EOF'
{
  "dependencies": {
    "openai": "^4.0.0",
    "@anthropic-ai/sdk": "^0.7.0",
    "express": "^4.18.0"
  }
}
EOF

# 5. Create Terraform config
mkdir terraform
cat > terraform/main.tf << 'EOF'
resource "aws_instance" "api_server" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "p3.2xlarge"
}
EOF
```

### Run Discovery

```bash
# Execute discovery
npm run dev -- discover

# Output:
# 🔍 Analyzing your infrastructure with Claude...
#
# ✓ Runtimes: nodejs, openai, anthropic
# ✓ Frameworks: None detected
# ✓ GPUs: 1 detected
# ✓ Monthly Cost: $6,850
# ✓ Optimization Potential: $4,110/month
#
# 🎯 Cross-Layer Optimization Opportunities:
#    1. Semantic caching + continuous batching = 25% savings
#    2. Model routing + spot instances = 35% savings
#    3. Combined multi-layer optimization = 60% savings
```

### Next Steps

```bash
# Run full orchestration
npm run dev -- orchestrate \
  --workload events.jsonl \
  --policy policy.yaml \
  --templates-dir templates/ \
  --output results.json

# Review results
cat results.json | jq '.audit'

# Check generated patches
ls -la peakinfer-patches/
```

---

## Advanced Usage: Custom Discovery Analysis

### Extend Discovery Agent

```typescript
// custom-discovery.ts
import { ClaudeDiscoveryAgent } from './orchestration/agents/claude-discovery-agent.js';

class CustomDiscoveryAgent extends ClaudeDiscoveryAgent {
  // Override methods as needed
  protected async analyzeWithClaude(context) {
    // Custom analysis logic
    return super.analyzeWithClaude(context);
  }
}

// Use it
const agent = new CustomDiscoveryAgent();
const env = await agent.discover();
```

### Run Custom Analysis

```bash
# TypeScript runner
ts-node custom-discovery.ts

# Or integrate into CLI
npm run dev -- discover
```

---

## Monitoring & Logging

### Enable Verbose Logging

```bash
# Set debug level
DEBUG=peakinfer:* npm run dev -- discover

# Set all debug
DEBUG=* npm run dev -- discover
```

### Check Discovery Agent Logs

```bash
# Look for .log files
find . -name "*.log" -type f

# Tail logs in real-time
tail -f peakinfer.log
```

---

## Next Steps After Discovery

1. **Review discovered infrastructure:** `cat discovered.yaml`
2. **Analyze workload patterns:** `npm run dev -- profile --events events.jsonl`
3. **Generate optimization plan:** `npm run dev -- plan`
4. **Execute optimizations:** `npm run dev -- run --plan optimization-plan.yaml`
5. **Generate ROI report:** `npm run dev -- report --output-dir reports/`

---

## Performance Tips

### For Large Event Files (> 50MB)

```bash
# Filter events by date range first
grep "2025-08-31" events.jsonl > events-daily.jsonl

# Run discovery on filtered file
npm run dev -- discover --events events-daily.jsonl
```

### For Memory-Constrained Systems

```bash
# Run with Node.js memory limit
NODE_OPTIONS=--max-old-space-size=2048 npm run dev -- discover
```

### For Faster Iteration

```bash
# Run in watch mode during development
npm test -- --watch

# Or use ts-node directly
ts-node -T src/orchestration/agents/claude-discovery-agent.ts
```

---

## Summary Commands

| Command | Purpose | Example |
|---------|---------|---------|
| `npm run dev -- discover` | Run discovery with Claude SDK | `npm run dev -- discover --output env.json` |
| `npm run build` | Compile TypeScript to JavaScript | `npm run build && npm start -- discover` |
| `npm test` | Run all tests | `npm test -- --coverage` |
| `npm run typecheck` | Type validation | `npm run typecheck` |
| `npm link` | Install CLI globally | `npm link && peakinfer discover` |
| `npm run start` | Run compiled CLI | `npm run start -- discover` |

---

**You're all set!** 🚀 The Claude Discovery Agent is ready to analyze your inference costs intelligently.

For questions, refer to:
- 📖 `CLAUDE_DISCOVERY_AGENT.md` - Full documentation
- 💡 `DISCOVERY_AGENT_EXAMPLES.md` - Real-world examples
- 🧪 `src/orchestration/agents/__tests__/` - Test examples

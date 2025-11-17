# Peakinfer Quick Start Guide

## Installation & Setup

### 1. Build the Project

```bash
yarn install
yarn build
```

The build compiles TypeScript to JavaScript in the `dist/` directory. Test files are automatically excluded from the build.

### 2. Set Your Claude API Key

```bash
export ANTHROPIC_API_KEY="sk-ant-..."  # Get from https://console.anthropic.com/
```

## Running Peakinfer Commands

### Option 1: Using Built CLI (Recommended)

```bash
# Show all available commands
node dist/cli.js --help

# Show specific command help
node dist/cli.js discover --help
```

### Option 2: Using Dev Mode

```bash
yarn dev discover --help
```

### Option 3: Global Installation (for development)

```bash
# Link the package locally
npm link

# Then use globally
peakinfer discover --help
peakinfer profile --help
```

## Core Workflow

### 1. **Discover** - Analyze your infrastructure

```bash
# Discover without external collectors (local analysis)
node dist/cli.js discover --output discovered.yaml

# Discover with input files
node dist/cli.js discover --input-dir ./data --output discovered.yaml

# Discover with collectors (requires credentials)
node dist/cli.js discover --collectors snowflake,databricks --output discovered.yaml
```

**Output:** `discovered.yaml` - Your infrastructure configuration and workloads

### 2. **Profile** - Group similar requests

```bash
node dist/cli.js profile \
  --events events.jsonl \
  --output profiles.yaml \
  --cluster-method semantic
```

**Input:** `events.jsonl` - Canonical inference events (see schema below)

**Output:** `profiles.yaml` - Representative workload clusters

### 3. **Plan** - Generate optimization strategies

```bash
node dist/cli.js plan \
  --discovered discovered.yaml \
  --constraints policy.yaml \
  --templates-dir design/templates/ \
  --output plan.yaml
```

**Inputs:**
- `discovered.yaml` - From discover step
- `policy.yaml` - Your constraints (cost, latency, quality)
- Templates in `design/templates/` - Optimization templates

**Output:** `plan.yaml` - Recommended optimizations with estimated savings

### 4. **Run** - Execute optimization plan

```bash
node dist/cli.js run \
  --plan plan.yaml \
  --sample-size 100 \
  --early-stopping \
  --output results.yaml
```

**Output:** `results.yaml` - Actual cost/latency improvements

### 5. **Report** - Summarize results

```bash
node dist/cli.js report \
  --results results.yaml \
  --output-dir reports/ \
  --format html,csv
```

**Output:** Comprehensive ROI analysis in HTML and CSV

## Example Workflow

### Create Sample Data

```bash
# Create sample events
cat > events.jsonl << 'EOF'
{"id":"evt-001","ts":"2025-11-14T10:00:00Z","intent":"extract_email","provider":"openai","model":"gpt-4o","input_tokens":500,"output_tokens":100,"latency_ms":150,"cost_usd":0.015,"endpoint":"api.openai.com","region":"us-east-1","tenant":"team_analytics"}
{"id":"evt-002","ts":"2025-11-14T10:01:00Z","intent":"summarize_doc","provider":"anthropic","model":"claude-3-sonnet","input_tokens":2000,"output_tokens":200,"latency_ms":300,"cost_usd":0.008,"endpoint":"api.anthropic.com","region":"us-west-2","tenant":"team_analytics"}
EOF

# Run discovery
node dist/cli.js discover --input-dir . --output discovered.yaml

# Profile workloads
node dist/cli.js profile --events events.jsonl --output profiles.yaml

# Generate plan
node dist/cli.js plan --discovered discovered.yaml --output plan.yaml

# Execute plan
node dist/cli.js run --plan plan.yaml --output results.yaml

# Generate report
node dist/cli.js report --results results.yaml --output-dir ./reports
```

## Canonical Event Schema

Each event in `events.jsonl` should follow this schema:

```typescript
interface InferenceEvent {
  id: string;              // Unique event ID (e.g., "evt-001")
  ts: string;              // ISO 8601 timestamp
  intent: string;          // Use case (e.g., "extract_email", "summarize_doc")
  provider: string;        // LLM provider ("openai", "anthropic", "together", "baseten")
  model: string;           // Model name (e.g., "gpt-4o", "claude-3-sonnet")
  input_tokens: number;    // Input token count
  output_tokens: number;   // Output token count
  latency_ms: number;      // Response time in milliseconds
  cost_usd: number;        // Actual cost in USD
  endpoint: string;        // API endpoint
  region: string;          // Deployment region
  tenant: string;          // Customer/team identifier
}
```

## All Available Commands

```
orchestrate     🤖 Full multi-agent orchestration
discover        🔍 Multi-agent discovery across layers
profile         📊 Profile workload and cluster prompts
plan            🎯 Generate optimization plan
run             🚀 Execute optimization plan
report          📝 Generate comprehensive report
execute         🚀 Execute specific template
templates       📋 List all templates
template-apply  🔧 Apply a template
review-template 👀 Review a template
contribute      🤝 Contribute results
submit-implementation 📤 Submit implementation
```

## Troubleshooting

### Build Error: Test file syntax issues

**Solution:** Already fixed in `tsconfig.json` - test files are excluded from build

### CLI not found after build

```bash
# Verify dist/cli.js exists
ls -la dist/cli.js

# Test directly
node dist/cli.js --version
```

### Missing API Key

```bash
# Set Anthropic API key
export ANTHROPIC_API_KEY="sk-ant-..."
```

### File not found errors

Ensure you're running commands from the project root or use absolute paths:

```bash
# From project root
node dist/cli.js discover --output discovered.yaml

# Or with absolute path
node /path/to/peakinfer/dist/cli.js discover --output discovered.yaml
```

## Development Commands

```bash
# Build TypeScript → JavaScript
yarn build

# Run in development mode (ts-node)
yarn dev discover --help

# Type check without building
yarn typecheck

# Lint TypeScript
yarn lint

# Fix linting issues
yarn lint:fix

# Run tests
yarn test

# Watch tests during development
yarn test:watch

# Test coverage
yarn test:coverage
```

## Project Structure

```
peakinfer/
├── src/
│   ├── cli.ts                          # CLI entry point
│   ├── core/
│   │   ├── template-engine.ts          # Template processing
│   │   └── event-processor.ts          # Event schema handling
│   ├── orchestration/
│   │   └── agents/
│   │       ├── claude-discovery-agent.ts
│   │       ├── profile-agent.ts
│   │       ├── policy-agent.ts
│   │       ├── planner-agent.ts
│   │       └── auditor-agent.ts
│   └── utils/
│       └── claude-helper.ts            # Claude SDK helpers
├── design/
│   ├── Peakinfer Product Requirements Document (PRD) v0.7.md
│   ├── Peakinfer Template v0.2.md
│   └── templates/
│       ├── demo-semantic-caching.yaml
│       └── demo-batch-optimization.yaml
├── dist/                               # Compiled output
├── package.json
├── tsconfig.json
└── QUICKSTART.md                       # This file
```

## Next Steps

1. **Create sample events** - Add your inference data to `events.jsonl`
2. **Run discovery** - Analyze your infrastructure
3. **Review templates** - Check `design/templates/` for optimization strategies
4. **Generate plan** - Let Peakinfer recommend optimizations
5. **Execute & measure** - Apply optimizations and track savings

For detailed architecture and design decisions, see:
- `design/Peakinfer Product Requirements Document (PRD) v0.7.md`
- `design/Peakinfer Template v0.2.md`

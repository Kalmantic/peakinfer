# PeakInfer

> **Multi-agent LLM inference performance optimization using Claude SDK** - Maximize throughput, minimize latency, and achieve peak efficiency across Application, Serving, and Infrastructure layers

[![npm version](https://img.shields.io/npm/v/@kalmantic/peakinfer.svg)](https://www.npmjs.com/package/@kalmantic/peakinfer)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.95.0-green.svg)](https://github.com/kalmantic/peakinfer)

PeakInfer is a **Simple, Lovable, Complete** CLI tool that uses Claude-powered multi-agent orchestration to discover and optimize LLM inference performance across your entire stack - from application-level caching to infrastructure GPU utilization.

## What's New in v0.95.0

- **New Commands**: Streamlined commands (`scan`, `recommend`, `benchmark`) for quick analysis
- **StackMap Generation**: Visual inference topology mapping with provider/model breakdown
- **Real-time Benchmarks**: Live performance data from 15+ providers with freshness tracking
- **Interactive Mode**: Guided workflows with progress indicators
- **Enhanced Detection**: Claude-powered semantic detection across Python, TypeScript, Go, and more
- **PRD v0.96 Compliance**: Full test suite with 90%+ recall, 97%+ precision gates

## Why PeakInfer?

### The Problem
- LLM inference workloads suffer from suboptimal throughput and high latency
- Performance optimizations are fragmented across Application, Serving, and Infrastructure layers
- No orchestration across layers means missing compound 2-5x performance improvement opportunities
- Teams lack proven implementation paths for complex optimizations

### The Solution
PeakInfer provides:
- **Multi-Agent Orchestration**: 4 specialized Claude agents analyze, plan, execute, and audit
- **Cross-Layer Optimization**: Coordinate optimizations across all 3 infrastructure layers
- **Community Templates**: 27+ validated templates with real implementation results
- **Performance Analysis**: Throughput/latency calculations grounded in community data
- **Trust Architecture**: Open-source collectors, least-privilege, run in your environment

## Quick Start

### Installation

```bash
npm install -g @kalmantic/peakinfer
```

### Quick Analysis (New!)

The fastest way to analyze your codebase:

```bash
# Scan codebase for LLM inference patterns
peakinfer scan ./your-project

# Get performance analysis and efficiency breakdown
peakinfer benchmark ./your-project

# Get AI-powered recommendations
peakinfer recommend ./your-project

# Interactive mode with guided workflow
peakinfer scan ./your-project --interactive
```

**Output Example:**
```
StackMap Summary
-----------------------------------
Total Callsites: 12
Providers: openai (8), anthropic (3), together (1)
Models: gpt-4o (5), claude-3-5-sonnet (3), gpt-4o-mini (3), llama-3.1-70b (1)

Performance Profile:
  Avg Latency: 1,850ms | Target: <500ms
  Throughput: 12 req/s | Potential: 45 req/s

Optimization Hotspots:
   1. src/services/chat.py:45 - gpt-4o (high latency, cacheable)
   2. src/agents/analyzer.py:23 - claude-3-5-sonnet (batch opportunity)
```

### Full Optimization Workflow

```bash
# 1. Discover optimization opportunities
peakinfer discover --input-dir ./inference-logs

# 2. Generate optimization plan
peakinfer plan

# 3. Execute with quality evaluation
peakinfer run

# 4. Get audit report and implementation artifacts
peakinfer report
```

PeakInfer will:
- Analyze your LLM inference patterns
- Identify performance optimization opportunities across all layers
- Generate comprehensive plans with efficiency projections
- Execute optimizations while preserving quality
- Produce implementation artifacts (configs, terraform diffs, monitoring)

## What You Get

### Optimization Layers

**Application Layer** (2-3x throughput improvement)
- Semantic caching for duplicate request elimination
- Intelligent model routing (GPT-4 to GPT-3.5 for simple queries)
- Prompt optimization and context window management

**Serving Layer** (3-5x throughput improvement)
- Runtime migration (PyTorch to vLLM for 3-5x throughput)
- Quantization strategies (FP16, INT8, 4-bit)
- Batching and concurrency optimization

**Infrastructure Layer** (2-4x efficiency improvement)
- GPU utilization optimization for inference workloads
- Right-sizing and auto-scaling policies
- Multi-region latency optimization

**Cross-Layer Synergies** (compound 5-10x total improvement)
- Coordinated optimizations for multiplicative benefits
- Example: Routing + Caching + vLLM = 8x total throughput (vs 2x + 2x + 3x independent)

### Real Results

```
Performance Improvement Summary
-------------------------------
Throughput: 45 req/s (from 12 req/s baseline) - 3.75x improvement
P95 Latency: 320ms (from 1,850ms baseline) - 5.8x improvement
GPU Utilization: 78% (from 23% baseline) - 3.4x improvement
Quality Preserved: 96.5% (baseline: 95.8%)
```

## Architecture

PeakInfer uses **4 specialized Claude agents** orchestrated through the Anthropic SDK:

```
+---------------------------------------------+
|  Discovery Agent                            |
|  Analyzes infrastructure & workload patterns|
+----------------------+----------------------+
                       |
                       v
+---------------------------------------------+
|  Planner Agent                              |
|  Creates optimization plan with perf targets|
+----------------------+----------------------+
                       |
                       v
+---------------------------------------------+
|  Runner/Evaluator Agent                     |
|  Executes & validates with quality testing  |
+----------------------+----------------------+
                       |
                       v
+---------------------------------------------+
|  Auditor Agent                              |
|  Generates reports & implementation artifacts|
+---------------------------------------------+
```

## Commands

### Quick Analysis Commands

| Command | Description |
|---------|-------------|
| `peakinfer scan <path>` | Scan codebase for LLM inference callsites, generate StackMap |
| `peakinfer benchmark <path>` | Analyze performance with real-time data from 15+ providers |
| `peakinfer recommend <path>` | Get AI-powered optimization recommendations |
| `peakinfer config` | Manage API keys and configuration |
| `peakinfer --interactive` | Launch interactive guided workflow |

### Full Workflow Commands

| Command | Description |
|---------|-------------|
| `peakinfer discover` | Analyze infrastructure/codebase to discover optimization opportunities |
| `peakinfer profile` | Cluster inference events into representative workloads & prompts |
| `peakinfer suggest` | Generate code-level optimization suggestions + HTML/MD/JSON reports |
| `peakinfer analyze` | All-in-one workflow (discover + profile + suggest) |
| `peakinfer plan` | Generate comprehensive optimization plan with performance projections |
| `peakinfer run` | Execute optimization plan with quality evaluation & early stopping |
| `peakinfer report` | Generate audit reports and implementation artifacts |
| `peakinfer templates` | Browse 27+ community-validated optimization templates |
| `peakinfer sync-templates` | Pull latest optimization templates from GitHub |
| `peakinfer config` | Manage API keys and configuration |
| `peakinfer validate` | Validate input data format |

## Input Data

PeakInfer works with inference event logs in JSONL format:

```jsonl
{"id":"req-001","ts":"2024-12-01T10:15:00Z","provider":"openai","model":"gpt-4o","input_tokens":2500,"output_tokens":350,"latency_ms":1850,"throughput_tps":189,"endpoint":"api.openai.com","region":"us-east-1","tenant":"team_analytics"}
```

**Supported Sources:**
- Manual JSONL/CSV/JSON files
- Snowflake inference usage views (mock collector)
- Databricks serving endpoints (mock collector)
- Terraform infrastructure configs (mock collector)

## Template Library

PeakInfer includes 27+ community-validated optimization templates:

### Application Layer Templates
- **Semantic Caching** - 2-3x throughput improvement, 92% confidence
- **Model Routing** - 30-40% latency reduction by routing to faster models
- **Prompt Optimization** - Reduce token usage while maintaining quality

### Serving Layer Templates
- **vLLM Migration** - 3-5x throughput improvement
- **Quantization** - 40-60% memory reduction, 2-3x throughput
- **Batching Optimization** - Maximize GPU utilization

### Infrastructure Layer Templates
- **GPU Optimization** - 2-4x efficiency improvement for inference workloads
- **Reserved Capacity** - Consistent performance for stable workloads
- **Auto-Scaling** - Right-size dynamically based on demand

### Cross-Layer Templates
- **Routing + Caching** - 4-6x compound improvement
- **vLLM + GPU Optimization** - 6-10x total throughput gain

View all templates:

```bash
peakinfer templates
peakinfer templates --layer application
peakinfer templates --detailed
```

## How It Works

1. **Discovery**: Multi-agent analysis of your infrastructure
   - Collects inference events and infrastructure configs
   - Profiles workload patterns and performance bottlenecks
   - Identifies optimization opportunities across all layers

2. **Planning**: Performance-driven optimization strategy
   - Matches environment to community templates
   - Calculates expected throughput/latency improvements with confidence intervals
   - Prioritizes by impact, complexity, and risk
   - Plans implementation sequence with dependencies

3. **Execution**: Quality-preserving optimization
   - Executes plan with baseline comparison
   - LLM judge quality evaluation on sample prompts
   - Statistical significance testing
   - Early stopping if quality degrades

4. **Reporting**: Implementation artifacts
   - Executive summary with performance improvements
   - Technical implementation configs (router, cache, terraform)
   - Monitoring dashboards and alert configs
   - Rollback procedures

## Usage Examples

### Basic Workflow

```bash
# Start with discovery
peakinfer discover --input-dir ./inference-logs

# Review and generate plan
peakinfer plan

# Test with dry run
peakinfer run --dry-run

# Execute for real
peakinfer run

# Generate final report
peakinfer report --format html,yaml
```

### Workload Profiling

```bash
# Cluster prompts + build workload profile
peakinfer profile --events ./logs/events.jsonl --cluster-method semantic

# Output: profile-report.yaml + terminal summary
```

- Identifies top intents, performance bottlenecks, representative prompts
- Generates sample prompts per cluster for evaluation
- Suggests next actions (e.g., caching, routing, model optimization)

### With Policy Constraints

Create `policy.yaml`:

```yaml
quality:
  min_quality_score: 0.95

performance:
  target_latency_p95_ms: 500
  target_throughput_rps: 100

risk:
  max_risk_level: "medium"
```

Then run:

```bash
peakinfer plan --constraints policy.yaml
```

### Exploring Templates

```bash
# View all templates
peakinfer templates

# Filter by layer
peakinfer templates --layer serving --detailed

# See specific category
peakinfer templates --category quantization
```

## Security & Trust

PeakInfer is built with trust and security as core principles:

- **Open Source**: All collectors and core logic are auditable
- **Local Execution**: Runs in your environment, not ours
- **Least Privilege**: Collectors use read-only access
- **No PII Exfiltration**: Data stays in your environment
- **API Key Control**: You control your Anthropic API key

Your data never leaves your infrastructure except for Claude API calls, which are necessary for the multi-agent analysis.

## Expected Results

Based on community validation and real-world benchmarks:

- **2-10x throughput improvement** depending on optimization depth
- **3-5x latency reduction** with serving layer optimizations
- **Sub-30 second analysis** for typical environments
- **95%+ quality preservation** with automatic rollback
- **Efficiency gains of 300-600%** annually for most optimizations
- **Performance targets achieved in 1-3 iterations**

## Roadmap

**Phase 1: Core Platform** (Current)
- Multi-agent orchestration
- 27+ community templates
- OSS collectors
- Claude SDK integration

**Phase 2: Community Growth** (Q1 2025)
- Cross-layer template development
- Community dashboard
- Advanced performance modeling
- PostHog and LangSmith collectors

**Phase 3: Enterprise Features** (Q2 2025)
- Multi-tenant SaaS deployment
- Auto-remediation capabilities
- Learned routers with bandit optimization
- SOC2/ISO compliance

**Phase 4: Platform Ecosystem** (Q3 2025)
- API platform for integrations
- Cross-org benchmarking
- Advanced analytics
- Research publications

## Contributing

We welcome contributions! Ways to contribute:

1. **Share Results**: Submit implementation reports for template validation
2. **Create Templates**: Add new optimization strategies
3. **Improve Collectors**: Enhance environment discovery
4. **Validate Performance**: Help verify benchmark models

See [CONTRIBUTING.md](./docs/CONTRIBUTING.md) for details.

## Documentation

- **[Installation Guide](./docs/INSTALLATION.md)** - Setup and configuration
- **[Usage Guide](./docs/USAGE.md)** - Complete command reference
- **[Architecture](./docs/ARCHITECTURE.md)** - Technical architecture
- **[Templates](./docs/TEMPLATES.md)** - Template system details
- **[PRD](./design/PeakInfer%20(prev%20TokenOp)%20Product%20Requirements%20Document%20(PRD)%20v0.95.md)** - Product requirements

## Research

PeakInfer is based on research from:
- **Performance Optimization**: Best practices for LLM inference efficiency
- **vLLM**: PagedAttention for efficient serving
- **Claude Code SDK**: Multi-agent reasoning for complex optimization decisions

## License

Apache 2.0 - Open source core with community templates

## Support

- **GitHub Issues**: [Report bugs](https://github.com/kalmantic/peakinfer/issues)
- **Discussions**: [Ask questions](https://github.com/kalmantic/peakinfer/discussions)
- **Twitter**: [@kalmantic](https://twitter.com/kalmantic)

---

**Built by Kalmantic AI Labs**

*PeakInfer: Achieve peak performance for your LLM inference workloads.*

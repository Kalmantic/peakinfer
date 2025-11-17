# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Peakinfer is an LLM inference cost optimization platform that orchestrates optimizations across Application, Serving, and Infrastructure layers. This repository is currently in the **design phase** and contains comprehensive product requirements and technical specifications.

## Repository Structure

This is a **design-only repository** with no implementation code yet. The repository contains:

```
.
├── design/
│   ├── Peakinfer Product Requirements Document (PRD) v0.7.md  # Comprehensive technical PRD
│   └── Peakinfer Template v0.2.md                           # Community optimization templates
└── CLAUDE.md                                               # This file
```

## Development Commands

**Note: No build, lint, or test commands exist yet** - this is a design-phase repository with no code implementation.

When implementation begins, the planned technology stack will include:
- **CLI Tool**: TypeScript with Commander.js, distributed via `npm install -g @kalmantic/peakinfer`
- **Multi-Agent System**: Claude Code SDK integration for optimization orchestration
- **Collectors**: Open-source data collectors for Snowflake, Databricks, Terraform
- **Templates**: File-based community optimization templates in GitHub repository

Expected future commands (when implemented):
```bash
# Installation
npm install -g @kalmantic/peakinfer

# Core optimization workflow
peakinfer discover [--collectors snowflake,databricks,terraform]
peakinfer profile [--events events.jsonl] [--cluster-method semantic]
peakinfer plan [--constraints policy.yaml] [--templates-dir templates/]
peakinfer run [--plan plan.yaml] [--sample-size 100] [--early-stopping]
peakinfer report [--output-dir reports/] [--format html,csv]

# Template management
peakinfer templates [list|search|info] [--category <category>]
peakinfer template-apply <template_id> [--dry-run] [--interactive]

# Community interaction
peakinfer submit-implementation <template_id> [--baseline-cost] [--optimized-cost]
peakinfer contribute [--template <template_id>] [--results <file>]
```

## Architecture Overview

Peakinfer is designed as a multi-layer optimization orchestration platform:

### Core System Components

1. **Multi-Agent Orchestration** (Claude Code SDK)
   - DiscoveryAgent: Merge configs/logs → discovered.yaml
   - WorkloadProfiler: Cluster prompts → representative samples
   - PolicyAgent: Load org constraints (quality, latency, budget)
   - PlannerAgent: Build search plan (router swaps, cache thresholds, serving options)
   - RunnerEvaluator: Execute baseline & candidates; bandit-style early stopping
   - AuditorAgent: Summarize savings → emit patches

2. **OSS Collectors** (Trust Architecture)
   - Snowflake: SQL modules for cost & usage views
   - Databricks: REST APIs for jobs/runs/serving endpoints
   - Terraform: Parse state or terraform show -json
   - Manual Input: JSONL/CSV/Parquet for demos/OSS users

3. **Canonical Event Schema** (events.jsonl)
   ```typescript
   interface InferenceEvent {
     id: string;              // UUID
     ts: string;              // ISO timestamp
     intent: string;          // "extract_email", "summarize_doc", etc.
     provider: string;        // "openai", "anthropic", "together", "baseten"
     model: string;           // "gpt-4o", "claude-3-sonnet", etc.
     input_tokens: number;    // Token count
     output_tokens: number;   // Token count
     latency_ms: number;      // Response time
     cost_usd: number;        // Actual cost
     endpoint: string;        // "api.openai.com", "api.together.xyz"
     region: string;          // "us-west-2"
     tenant: string;          // "team_analytics"
   }
   ```

4. **File-Based Template Repository**
   - Storage: GitHub repository flat files (github.com/kalmantic/peakinfer-templates)
   - Format: Markdown with YAML frontmatter
   - Categories: cross-layer/, application-layer/, serving-layer/, infrastructure-layer/
   - Validation: File-based peer review + Claude analysis

## Optimization Layers

Peakinfer coordinates optimizations across three infrastructure layers:

1. **Application Layer**: Semantic caching, prompt optimization, model routing
2. **Serving Layer**: vLLM migration, TensorRT optimization, SGLang deployment
3. **Infrastructure Layer**: Spot instance optimization, reserved instance planning, multi-region deployment

The platform's key innovation is **cross-layer coordination** - optimizations that span multiple layers show additive benefits beyond individual layer optimizations.

## Design Philosophy

### Technical Pillars
1. **Claude Code SDK Foundation**: Multi-agent orchestration for complex optimization decisions
2. **File-Based Template Repository**: Version-controlled optimization knowledge with community validation
3. **Canonical Event Schema**: Unified format across heterogeneous stacks
4. **OSS Trust Architecture**: Open-source collectors, least-privilege, run-in-customer-env, no PII exfiltration

### Economic Model
- **Open Source Core**: Apache 2.0 CLI, collectors, and template format
- **Community Templates**: Free, peer-reviewed optimization strategies stored as files
- **Enterprise Platform**: Multi-tenant SaaS deployment + SOC2/ISO compliance (future)
- **Professional Services**: Custom optimization consulting and auto-remediation

## Implementation Phases

### Phase 1: Core Platform Discovery (0-3 months)
- OSS collectors for Snowflake, Databricks, Terraform with canonical schema
- Multi-agent CLI with discover/profile/plan/run commands
- File-based community templates with 20 initial templates across all layers
- Claude Code SDK integration for natural language optimization guidance

### Phase 2: Community Growth & Orchestration (3-6 months)
- Cross-layer template development with coordination strategies
- Advanced economic modeling with multi-layer ROI calculations
- Community dashboard and contributor recognition system
- PostHog and LangSmith collectors for broader ecosystem coverage

### Phase 3: Enterprise Features & Scale (6-12 months)
- Multi-tenant SaaS deployment option with enterprise features
- Auto-remediation capabilities (apply Terraform diffs, update configurations)
- Advanced learned routers with bandit/policy optimization
- SOC2/ISO compliance for enterprise security requirements

### Phase 4: Platform Ecosystem & Acquisition (12-18 months)
- API platform for third-party integrations
- Cross-org benchmarking and industry insights
- Technical authority establishment through research and OSS contributions
- Acquisition readiness with $100M target valuation

## Success Metrics

**Target Goals:**
- **Cost Reduction**: ≥20% vs baseline across any infrastructure layer
- **Quality Loss**: ≤1% absolute drop or within defined tolerance
- **Community Validation**: ≥3 peer reviews per template with >0.85 confidence score
- **Cross-Layer Benefits**: Templates spanning 2+ layers show additive benefits

**Platform Metrics:**
- Monthly Active Users: 1K+ by Phase 2
- Enterprise Customers: 50+ by Phase 3
- Total Cost Savings: $100M+ documented by Phase 4
- Technical Authority: OSS contributions to vLLM, SGLang, TensorRT-LLM

## Development Guidelines

Since this is a design-phase repository:

1. **Design Documents**: Focus on refining PRD and template specifications based on market research and technical validation
2. **Architecture Review**: Validate multi-agent orchestration approach and OSS collector design
3. **Template Development**: Create initial community optimization templates for cross-layer coordination
4. **Economic Modeling**: Refine ROI calculations and cost-benefit analysis frameworks

When implementation begins:
1. **Start with CLI scaffolding** using TypeScript + Commander.js
2. **Implement OSS collectors** with canonical schema first
3. **Integrate Claude Code SDK** for multi-agent orchestration
4. **Build file-based template system** with GitHub integration
5. **Focus on cross-layer coordination** as key differentiator

## Key Files for Future Development

Reference the design documents for implementation:
- `design/Peakinfer Product Requirements Document (PRD) v0.7.md`: Complete technical architecture and implementation details
- `design/Peakinfer Template v0.2.md`: Community optimization template specifications and examples

The PRD contains detailed TypeScript examples, API specifications, and implementation timelines that should guide the actual development work.
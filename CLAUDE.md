# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PeakInfer is an LLM inference cost optimization CLI tool that analyzes codebases for LLM API usage patterns, estimates costs, and suggests optimizations across Application, Serving, and Infrastructure layers.

**Version:** 0.95.0
**License:** Apache-2.0
**Status:** Production CLI (Phase 1 SLC implementation)

## Quick Start

```bash
npm install -g @kalmantic/peakinfer
export ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
peakinfer analyze .
```

## Repository Structure

```
src/
├── slc/                    # Main CLI implementation (Simple, Lovable, Complete)
│   ├── cli.ts             # CLI entry point - PRD Section 9 commands
│   ├── agent-analyzer.ts  # Claude agent-based analysis
│   ├── scanner.ts         # Codebase file scanning
│   ├── detector.ts        # LLM pattern detection
│   ├── recommender.ts     # Optimization recommendations
│   ├── pricing.ts         # Pricing calculations
│   ├── pricing-fetcher.ts # Live pricing data from LiteLLM
│   ├── renderer.ts        # Console output rendering
│   ├── prd-renderer.ts    # PRD-compliant box table output
│   ├── html-renderer.ts   # HTML report generation
│   ├── stackmap.ts        # Stack topology mapping
│   ├── progress.ts        # Progress indicators
│   ├── types.ts           # Type definitions
│   └── __tests__/         # Unit tests
│
├── core/                   # Multi-agent orchestration (Phase 2+)
│   ├── multi-agent-orchestrator.ts
│   ├── template-engine.ts
│   ├── economics-calculator.ts
│   └── report-generator.ts
│
├── collectors/             # Data collectors
│   ├── codebase-collector.ts
│   ├── hardware-detector.ts
│   ├── terraform-collector.ts
│   ├── snowflake-collector.ts
│   └── databricks-collector.ts
│
├── agents/                 # Claude-powered analysis agents
│   ├── environment-discovery-agent.ts
│   └── template-execution-agent.ts
│
├── types/                  # TypeScript interfaces
│   ├── multi-agent.ts
│   ├── template.ts
│   ├── events.ts
│   └── collectors.ts
│
└── utils/                  # Utilities
    └── api-key-manager.ts

templates/                  # Community optimization templates (10 YAML files)
├── application-layer/      # Caching, routing, context optimization
├── serving-layer/          # vLLM, quantization, batching
├── infrastructure-layer/   # Spot instances, GPU right-sizing
└── cross-layer/            # Full-stack optimization strategies

design/                     # PRD and design documents
test-codebase/              # Test infrastructure and sample code
```

## Development Commands

```bash
npm run build        # Compile TypeScript to dist/
npm run dev          # Run with ts-node (development)
npm test             # Run vitest test suite
npm run test:watch   # Watch mode testing
npm run test:coverage # Generate coverage report
npm run lint         # ESLint check
npm run lint:fix     # Auto-fix lint errors
npm run typecheck    # TypeScript type checking only
npm run validate     # Run full validation suite
npm start            # Run compiled CLI
```

## CLI Commands (PRD Section 9)

```bash
peakinfer analyze <path>              # Analyze codebase for LLM usage
peakinfer analyze . --html            # With HTML report
peakinfer analyze . --html --open     # Open in browser

peakinfer stackmap [path]             # View cached stackmap from analysis
peakinfer pricing [path]              # View pricing breakdown
peakinfer pricing . --detailed        # Include live model pricing

peakinfer diff <old.json> <new.json>  # Compare two analyses
```

## Environment Variables

```bash
ANTHROPIC_API_KEY     # Required - Claude API key for analysis
```

## Output Files

After running `peakinfer analyze`, these files are generated:

- `peakinfer-stackmap.json` - Inference topology map (callsites, models, vendors)
- `peakinfer-pricing.json` - Cost breakdown and estimates
- `peakinfer-report.html` - Visual HTML report (with --html flag)

## Architecture

### Analysis Pipeline

1. **Scan** - Find source files (.py, .ts, .js, .go, .java)
2. **Detect** - Pattern match for LLM SDK usage (OpenAI, Anthropic, LangChain, etc.)
3. **Analyze** - Claude agent semantically analyzes code for callsites
4. **Estimate** - Calculate costs using live pricing data
5. **Report** - Generate stackmap, pricing breakdown, and recommendations

### Key Components

- **Agent Analyzer**: Uses Claude Code SDK for intelligent code analysis
- **Detector**: Pattern-based LLM SDK detection with taxonomy
- **Pricing Fetcher**: Live pricing from LiteLLM with caching
- **PRD Renderer**: Box-table output format per PRD spec

## Design Documents

- `design/PeakInfer Product Requirements Document (PRD) v0.95.md` - Full specification
- `design/PeakInfer SLC v1 Design Doc.md` - Simple, Lovable, Complete design
- `design/PeakInfer Template v0.2.md` - Community template specification

## Testing

Unit tests are in `src/slc/__tests__/`:
- detector.test.ts - Pattern detection
- scanner.test.ts - File scanning
- renderer.test.ts - Output rendering
- pricing.test.ts - Cost calculations
- validator.test.ts - Input validation
- stackmap.test.ts - Topology mapping

Run tests:
```bash
npm test                    # All tests
npm test -- detector        # Specific test file
npm run test:coverage       # With coverage
```

## Code Style

- TypeScript strict mode
- ESM modules (type: "module")
- Node.js >= 18.0.0
- ESLint with @typescript-eslint

## Contributing

1. Read the PRD in `design/` to understand specifications
2. Follow existing patterns in `src/slc/`
3. Add tests for new functionality
4. Run `npm run lint && npm test` before commits

## Optimization Templates

10 community-validated templates in `templates/`:

| Category | Templates | Typical Savings |
|----------|-----------|-----------------|
| Application | Semantic caching, Model routing, Context optimization | 30-50% |
| Serving | vLLM migration, Quantization, Batching | 40-60% |
| Infrastructure | Spot instances, GPU right-sizing | 60-70% |
| Cross-layer | Full-stack optimization | 65-85% |

Templates use YAML format with validation schema per PRD.

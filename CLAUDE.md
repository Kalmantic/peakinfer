# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PeakInfer is an LLM inference **performance optimization platform** that orchestrates optimizations across Application, Serving, and Infrastructure layers. The platform maximizes throughput, minimizes latency, and achieves peak efficiency across your AI stack.

## Repository Structure

```
.
├── design/
│   ├── PeakInfer Product Requirements Document (PRD) v0.96.md  # Comprehensive technical PRD
│   └── PeakInfer Template v0.2.md                              # Community optimization templates
├── src/
│   ├── slc/                                                    # Core CLI implementation
│   ├── collectors/                                             # OSS data collectors
│   ├── core/                                                   # Multi-agent orchestration
│   └── types/                                                  # TypeScript type definitions
├── templates/                                                  # Community optimization templates
└── CLAUDE.md                                                   # This file
```

## CLI Commands

```bash
# Installation
npm install -g @kalmantic/peakinfer

# Main analysis command (SLC: Simple, Lovable, Complete)
peakinfer analyze <path>           # Analyze codebase for LLM usage + performance
peakinfer analyze <path> --html    # Generate HTML report
peakinfer analyze <path> --open    # Generate and open HTML report in browser
peakinfer analyze <path> --cached  # View previous analysis (offline, no API key needed)
peakinfer analyze <path> --output json  # Machine-readable JSON output

# Pricing information
peakinfer prices                   # Show all model pricing (API + GPU)
peakinfer prices <provider>        # Filter by provider (openai, anthropic, modal, etc.)
peakinfer prices --refresh         # Refresh pricing cache from sources

# Template browsing
peakinfer templates list           # List all optimization templates
peakinfer templates info <id>      # View template details

# Help
peakinfer --help                   # Show help
peakinfer --version                # Show version
```

## Environment Setup

```bash
# Required for fresh analysis
export ANTHROPIC_API_KEY=sk-ant-api03-xxxxx

# Add to ~/.zshrc or ~/.bashrc to persist
```

## Architecture Overview

PeakInfer is designed as a multi-layer performance optimization orchestration platform:

### Core System Components

1. **Multi-Agent Orchestration** (Claude Code SDK)
   - DiscoveryAgent: Merge configs/logs -> discovered.yaml
   - WorkloadProfiler: Cluster prompts -> representative samples
   - PolicyAgent: Load org constraints (quality, latency, throughput targets)
   - PlannerAgent: Build search plan (router swaps, cache thresholds, serving options)
   - RunnerEvaluator: Execute baseline & candidates; bandit-style early stopping
   - AuditorAgent: Summarize performance gains -> emit patches

2. **OSS Collectors** (Trust Architecture)
   - Snowflake: SQL modules for usage & performance views
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
     throughput_tps: number;  // Tokens per second
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

PeakInfer coordinates optimizations across three infrastructure layers:

1. **Application Layer**: Semantic caching, prompt optimization, model routing
2. **Serving Layer**: vLLM migration, TensorRT optimization, SGLang deployment
3. **Infrastructure Layer**: Spot instance optimization, reserved capacity planning, multi-region deployment

The platform's key innovation is **cross-layer coordination** - optimizations that span multiple layers show additive performance benefits beyond individual layer optimizations.

## Design Philosophy (Julie Zhou Principles)

1. **Behavior First:** Design to enable specific user behaviors, not for visual flourish. Every implementation decision should ask: "How does this help users accomplish their goals?"
2. **Clarity Over Cleverness:** Every element must answer "why" and serve a clear purpose. If you can't explain why something exists in one sentence, it probably shouldn't.
3. **Content-Driven Layout:** Content determines structure; typography and spacing earn user trust. Let content breathe and establish hierarchy through purposeful spacing.
4. **Thoughtful Defaults:** Cut decision fatigue with smart defaults. Users should only make decisions that matter—everything else should "just work."
5. **State Completeness:** Zero, loading, error, and success states are all first-class citizens. Never neglect any state.
6. **Transition Excellence:** Transitions matter as much as final screens. How users move between states tells a story.
7. **Accessible By Design:** Always meet WCAG AA standards for contrast and keyboard navigation. Accessibility is fundamental.
8. **Invisible UI:** Users should notice their progress, not the interface. The best design feels invisible.

### Technical Pillars
1. **Claude Code SDK Foundation**: Multi-agent orchestration for complex optimization decisions
2. **File-Based Template Repository**: Version-controlled optimization knowledge with community validation
3. **Canonical Event Schema**: Unified format across heterogeneous stacks
4. **OSS Trust Architecture**: Open-source collectors, least-privilege, run-in-customer-env, no PII exfiltration

### Business Model
- **Open Source Core**: Apache 2.0 CLI, collectors, and template format
- **Community Templates**: Free, peer-reviewed optimization strategies stored as files
- **Enterprise Platform**: Multi-tenant SaaS deployment + SOC2/ISO compliance (future)
- **Professional Services**: Custom optimization consulting and auto-remediation

## Output Files

When running `peakinfer analyze`, the following files are generated:

| File | Description |
|------|-------------|
| `peakinfer-stackmap.json` | Detected LLM callsites and stack topology |
| `peakinfer-pricing.json` | Cost analysis and pricing breakdown |
| `peakinfer-report.html` | Interactive HTML report (with --html flag) |

## Development

```bash
# Run locally during development
npm run build && node dist/slc/cli.js analyze .

# Run tests
npm test

# Type checking
npm run typecheck
```

## Implementation Guidelines

### Component Structure
- Organize around behaviors, not just visual layout
- Document behavioral purpose in code comments
- Create reusable patterns that encapsulate design principles

### State Completeness
Treat all states with equal care:
- `loading` - Show progress, set expectations
- `error` - Clear message, actionable recovery
- `empty` - Guide users to next action
- `success` - Celebrate progress, show next steps

### Thoughtful Defaults
- Simple by default, powerful when needed
- Hide advanced options until requested
- Primary action always visible and clear

### Design Quality Checks
When implementing or modifying, validate:
1. Code prioritizes enabling specific user behaviors
2. Components reduce cognitive load at decision points
3. Visual hierarchy directs attention appropriately
4. Typography establishes clear information hierarchy
5. Spacing is applied systematically for rhythm and order
6. All states (zero, loading, error, success) are fully implemented
7. Accessibility standards are maintained
8. Transitions feel natural and purposeful
9. The interface feels invisible - users focus on their task

### Technical Implementation
1. **Start with CLI scaffolding** using TypeScript
2. **Implement OSS collectors** with canonical schema first
3. **Integrate Claude Code SDK** for multi-agent orchestration
4. **Build file-based template system** with GitHub integration
5. **Focus on cross-layer coordination** as key differentiator

## Development Philosophy (SLC - Simple, Lovable, Complete)

### Core Principles
- **Magic UX**: Create code that makes powerful capabilities feel effortless and invisible
- **SLC**: Deliver solutions that may be limited in scope but are fully functional, delightful to use, and solve real problems

### Implementation Excellence

**Progressive Magic:**
- Start with core functionality that works perfectly
- Add intelligent features that anticipate user needs
- Surface advanced capabilities contextually when needed

**Invisible Intelligence:**
- Build resilient error handling that prevents issues before they occur
- Implement smart defaults that work correctly most of the time
- Create real-time feedback loops that guide users naturally

**Graceful Power:**
- Handle edge cases and failures elegantly
- Provide clear, actionable guidance when issues arise
- Include fallback options that maintain functionality

**Contextual Simplicity:**
- Remove unnecessary complexity and options
- Present the right capabilities at the right moment
- Make the primary use case effortless

### Code Quality Checklist

**Simple:**
- Focused on solving one problem well
- Clear, consistent naming conventions
- Intuitive structure with minimal complexity

**Lovable:**
- Thoughtful UX with helpful feedback
- Intelligent defaults that "just work"
- Small touches that surprise and delight

**Complete:**
- Fully implements the defined scope
- Handles all reasonable edge cases
- Provides clear usage guidance

**Resilient:**
- Validates all inputs thoroughly
- Implements appropriate retry mechanisms
- Degrades gracefully when dependencies fail

**Testable:**
- Architected for testability with clear separation of concerns
- Includes comprehensive unit tests for core functions
- End-to-end tests that verify user acceptance criteria

## Success Metrics

**Target Goals:**
- **Performance Improvement**: >=20% throughput increase or latency reduction vs baseline
- **Quality Preservation**: <=1% absolute drop or within defined tolerance
- **Cross-Layer Benefits**: Templates spanning 2+ layers show additive performance gains

## Key Files for Development

Reference the design documents for implementation:
- `design/PeakInfer (prev TokenOp) Product Requirements Document (PRD) v0.96.md`: Complete technical architecture and implementation details
- `design/PeakInfer Template v0.2.md`: Community optimization template specifications and examples

The PRD contains detailed TypeScript examples, API specifications, and implementation timelines that should guide the actual development work.
- save
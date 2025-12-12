# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Purpose

This is the **design documentation repository** for PeakInfer v1.0, an LLM inference performance analysis CLI tool by Kalmantic AI Labs. This repository contains specifications only—no source code.

The actual implementation is located at: `../peakinfer/`

## Document Structure

```
design/
├── PeakInfer PRD v1.0.md              # Product Requirements (WHAT it does)
├── PeakInfer DD v1.0.md               # Design Document (HOW it should feel)
├── PeakInfer TDD v1.0.md              # Technical Design (HOW it's built)
├── PeakInfer Test Case Document v1.0.md  # Testing strategy
└── Autonomous Agent Architecture Patterns v0.1.md  # Agent patterns reference
```

## Document Hierarchy

When working with these documents, understand the specification hierarchy:

1. **PRD** defines behavioral contracts and product boundaries (source of truth for "what")
2. **DD** defines UX principles, mental model, and state completeness requirements
3. **TDD** defines architecture, schemas, modules, and implementation constraints
4. **Test Cases** defines fixture strategy, test levels, and coverage requirements
5. **Agent Patterns** is a reference document for architectural patterns used

## Key Product Concepts

### PeakInfer Is
- A CLI tool that reveals LLM inference performance truth
- Artifact-producing (deterministic, auditable outputs)
- A flashlight, not a lever—clarifies rather than decides

### PeakInfer Is Not
- An auto-optimization engine
- A real-time monitoring system
- An IDE assistant

### Core Capabilities
1. **Static analysis** (`peakinfer analyze .`) - semantic callsite detection
2. **Runtime analysis** (`peakinfer analyze events.jsonl`) - fully offline
3. **Combined analysis** - drift detection between code intent and runtime behavior
4. **Tradeoff analysis** - performance headroom reasoning

## Design Principles (Julie Zhou Mindset)

The Design Document follows Julie Zhou's behavior-first philosophy. When editing or extending:

- **Behavior First**: Every feature must answer "What behavior does this enable?" Progress messages reduce anxiety, not show off internals. Reports enable sharing, not exploration.
- **Clarity Over Cleverness**: No playful language, no anthropomorphic phrasing ("I found...", "I think..."), no jargon without concrete labels.
- **State Completeness**: Zero, loading, partial, error, success are first-class experiences—each must feel helpful.
- **Mental Model Order**: Never violate Scope → Structure → Reality → Meaning → Next step.
- **Invisible UI**: Users should remember what they learned, not the interface. Design is "done" when output is understandable without narration and forwardable to a teammate.
- **Two-Pass Execution**: Planning pass (what) → Execution pass (how) — enables predictable progress, failure isolation, and resumability.
- **Content-Driven Layout**: Hierarchy from order + spacing + grouping, not decoration or ASCII art.

## Quality Bars (from PRD)

- ≥90% callsite detection in supported languages
- Near-zero false positives for providers/models
- <60s analysis for 10k LOC
- Deterministic outputs
- Explainable failures

## Schema References

Key schemas defined in TDD:
- `Callsite` - static inference callsite with provider, model, patterns, confidence
- `InferenceEvent` - runtime event schema (id, ts, provider, model, tokens, latency_ms)
- `InferenceMap` - canonical inference topology (tree structure with file+line anchors)
- `JoinedInference` - combined static + runtime with drift signals

## When Editing Documents

- PRD changes require DD and TDD review for consistency
- Schema changes in TDD require Test Case document updates
- All documents are versioned (v1.0)—create new versions for breaking changes
- Maintain the "honest, performance-first" tone throughout

## Implementation Guide

See `IMPLEMENTATION_GUIDE.md` for minimal code implementation based on these design documents:
- ~520 lines total for complete v1
- 8 files: cli.ts, types.ts, scanner.ts, analyzer.ts, runtime.ts, joiner.ts, renderer.ts, artifacts.ts
- Single LLM call for semantic analysis
- Fixed output order matching DD mental model

# Changelog

All notable changes to PeakInfer will be documented in this file.

## [1.0.129] - 2025-12-26

### Changed
- Moved GitHub Action to separate repository (`peakinfer-action`)
- CLI is now fully BYOK (Bring Your Own Key) focused

## [1.0.0] - 2025-12-24

### Added
- Initial public release
- Claude Agent SDK integration for semantic code analysis
- 4-dimension analysis: cost, latency, throughput, reliability
- Drift detection between code and runtime behavior
- 12 insight templates
- 31 optimization templates
- Runtime event correlation (JSONL, OTEL, Jaeger, Zipkin, LangSmith, LiteLLM)
- Historical comparison and baseline tracking
- HTML/PDF report generation

### Architecture
- Unified single-call analyzer (60% faster than multi-phase)
- BYOK mode (user provides Anthropic API key)
- Fully auditable - all analysis code visible in public repo

---

For earlier changes, see [releases](https://github.com/Kalmantic/peakinfer/releases).

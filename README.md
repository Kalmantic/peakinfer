# PeakInfer

> CLI tool to discover and analyze LLM inference patterns in your codebase

[![npm version](https://img.shields.io/npm/v/@kalmantic/peakinfer.svg)](https://www.npmjs.com/package/@kalmantic/peakinfer)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)

PeakInfer scans your codebase to find LLM API calls, maps your inference stack, and provides optimization recommendations.

## Installation

```bash
npm install -g @kalmantic/peakinfer
export ANTHROPIC_API_KEY=your-key  # required for analysis
```

## Quick Start

```bash
# Analyze your codebase
peakinfer analyze .

# Generate HTML report
peakinfer analyze . --html --open

# View cached results (no API key needed)
peakinfer analyze . --cached
```

## Commands

| Command | Description |
|---------|-------------|
| `peakinfer analyze <path>` | Analyze codebase for LLM usage and performance |
| `peakinfer recommend <path>` | Show optimization recommendations |
| `peakinfer prices [provider]` | Show model pricing data |
| `peakinfer benchmark [provider]` | Show model performance benchmarks |
| `peakinfer templates list` | Browse optimization templates |

### Analyze Options

```bash
peakinfer analyze <path> [options]

Options:
  --html           Generate HTML report
  --open           Open HTML report in browser
  --output json    Machine-readable JSON output
  --cached         View previous analysis (offline)
```

## What It Detects

- **SDK Calls**: OpenAI, Anthropic, Cohere, Google, Mistral, Groq, Together
- **Frameworks**: LangChain, LlamaIndex, Haystack, DSPy
- **Self-Hosted**: vLLM, TGI, SGLang, Ollama
- **Hyperscalers**: AWS Bedrock, Azure OpenAI, GCP Vertex AI
- **Gateways**: LiteLLM, Portkey, OpenRouter

## Example Output

```
PeakInfer v0.95

Scanned: 847 files (12,340 LOC)
Languages: python, typescript

Found 12 inference callsites across 8 files.

STACKMAP
--------
CALLSITES (12)
   src/services/chat.py:45       gpt-4o, streaming
   src/agents/analyzer.py:23     claude-3-5-sonnet
   ...

MODELS (4)
   gpt-4o              5 calls
   claude-3-5-sonnet   3 calls
   gpt-4o-mini         3 calls
   llama-3.1-70b       1 call

PRICING SUMMARY
---------------
Estimated monthly cost: $1,240 - $1,870

HOTSPOTS
--------
  src/services/chat.py:45 - gpt-4o
    consider gpt-4o-mini for 4x faster throughput
```

## Templates

Browse optimization strategies:

```bash
peakinfer templates list
peakinfer templates info semantic-caching
```

## License

Apache 2.0

## Links

- [GitHub Issues](https://github.com/kalmantic/peakinfer/issues)
- [npm Package](https://www.npmjs.com/package/@kalmantic/peakinfer)

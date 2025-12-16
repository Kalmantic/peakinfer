# Format Normalization Module

PeakInfer v1.3 Format Normalization Pipeline

## Overview

This module handles the detection and normalization of runtime telemetry data from various sources into PeakInfer's canonical `InferenceEvent` schema. It supports:

1. **Direct Parse Formats** - Formats that can be parsed heuristically
   - JSONL (newline-delimited JSON)
   - JSON Array
   - CSV
   - TSV

2. **Agent-Normalized Formats** - Observability platforms requiring specialized adapters
   - OpenTelemetry (OTLP)
   - Jaeger
   - Zipkin
   - LangSmith
   - Helicone
   - Weights & Biases
   - LiteLLM
   - Portkey

3. **Custom/Unknown Formats** - Uses Claude AI to intelligently detect and map fields

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    normalizeEventsFile()                     │
│                    (main entry point)                        │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      detectFormat()                          │
│          (heuristic format detection)                        │
└───────────────────────────┬─────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
     ┌──────────┐    ┌──────────┐    ┌──────────────┐
     │  Direct  │    │ Observ.  │    │    Agent     │
     │ Parsers  │    │ Adapters │    │ Normalizer   │
     └────┬─────┘    └────┬─────┘    └──────┬───────┘
          │               │                 │
          └───────────────┼─────────────────┘
                          ▼
                 ┌──────────────────┐
                 │ InferenceEvent[] │
                 └──────────────────┘
```

## Files

### Core
- `schemas.ts` - Type definitions, constants, and field aliases
- `detector.ts` - Heuristic format detection
- `normalizer.ts` - Main orchestration logic
- `agent-normalizer.ts` - Claude AI-powered format detection and field mapping

### Direct Parsers
- `parsers/jsonl.ts` - JSONL parser
- `parsers/json-array.ts` - JSON array parser
- `parsers/csv.ts` - CSV/TSV parser

### Observability Adapters
- `adapters/otel.ts` - OpenTelemetry OTLP
- `adapters/jaeger.ts` - Jaeger traces
- `adapters/zipkin.ts` - Zipkin traces
- `adapters/langsmith.ts` - LangSmith runs
- `adapters/helicone.ts` - Helicone proxy logs
- `adapters/wandb.ts` - Weights & Biases logs
- `adapters/litellm.ts` - LiteLLM proxy logs
- `adapters/portkey.ts` - Portkey gateway logs

## Usage

### Basic Usage

```typescript
import { normalizeEventsFile } from './format';

const result = await normalizeEventsFile('events.jsonl');
console.log(`Parsed ${result.events.length} events`);
console.log(`Format: ${result.format.detected} (confidence: ${result.format.confidence})`);
```

### Manual Format Override

```typescript
const result = await normalizeEventsFile('data.json', {
  format: 'langsmith',  // Skip detection, use specific format
});
```

### With Custom Field Mappings

```typescript
const result = await normalizeEventsFile('custom.csv', {
  fieldMappings: [
    { targetField: 'model', sourceExpression: 'llm_model', extractionType: 'column' },
    { targetField: 'latency_ms', sourceExpression: 'response_time', extractionType: 'column' },
  ],
});
```

### Lenient Mode

```typescript
const result = await normalizeEventsFile('incomplete.jsonl', {
  lenient: true,  // Continue on parse errors
});
```

### With Codebase Context (Combined Mode)

```typescript
import { normalizeWithCodebaseContext } from './format';

const result = await normalizeWithCodebaseContext('events.jsonl', {
  loggingPatterns: ['logger.info("model: " + model)'],
  variableNames: ['input_tokens', 'output_tokens'],
});
```

## Agent-Based Normalization

When heuristic detection fails or confidence is low, the module can use Claude AI to:

1. **Detect Format** - Analyze sample lines to identify the format type
2. **Map Fields** - Determine how source fields map to `InferenceEvent` schema
3. **Validate Mappings** - Verify extracted values are sensible

### Requirements

- Set `ANTHROPIC_API_KEY` environment variable
- Agent normalization uses Claude claude-sonnet-4-20250514 by default

### API Costs

Agent normalization makes ~3 API calls per file:
- FormatDetector: ~500 tokens
- FieldMapper: ~2000 tokens
- MappingValidator: ~1000 tokens

Estimated cost: ~$0.003/file

## Canonical InferenceEvent Schema

```typescript
interface InferenceEvent {
  id: string;           // Unique identifier
  ts: string;           // ISO timestamp
  intent: string;       // Task type (chat, summarize, etc.)
  provider: string;     // LLM provider (openai, anthropic, etc.)
  model: string;        // Model name (gpt-4o, claude-3-sonnet, etc.)
  input_tokens: number; // Prompt tokens
  output_tokens: number;// Completion tokens
  latency_ms: number;   // Response time
  cost_usd?: number;    // Cost in USD
  endpoint?: string;    // API endpoint
  region?: string;      // Datacenter region
  tenant?: string;      // Customer/org identifier
  metadata?: Record<string, unknown>;
}
```

## Adding New Formats

### Direct Parser

1. Create `parsers/myformat.ts`
2. Export parse function: `export function parseMyFormat(content: string): InferenceEvent[]`
3. Add to `parsers/index.ts`
4. Add detection logic to `detector.ts`
5. Add case to `normalizer.ts`

### Observability Adapter

1. Create `adapters/myplatform.ts`
2. Export:
   - `parseMyPlatformExport(data: unknown): InferenceEvent[]`
   - `isMyPlatformFormat(data: unknown): boolean`
3. Add to `adapters/index.ts`
4. Add signature to `FORMAT_SIGNATURES` in `schemas.ts`
5. Add case to `normalizer.ts`

## Testing

Test fixtures are in `test-codebase/fixtures/formats/`:

```bash
npm run test -- format-normalizer
```

## Design Decisions

1. **Heuristic First**: Always try heuristic detection before agent normalization to minimize API costs
2. **Progressive Enhancement**: Use codebase context when available to boost confidence
3. **Graceful Degradation**: Fall back to lenient mode or manual mapping when detection fails
4. **Streaming Support**: All parsers support progress callbacks for large files
5. **Canonical Schema**: All adapters normalize to the same InferenceEvent schema for consistent downstream processing

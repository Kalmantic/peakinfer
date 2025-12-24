# InferenceMap v0.1 Specification

The InferenceMap is PeakInfer's structured output format for static analysis results. It provides a machine-readable representation of all LLM inference points in a codebase.

## Overview

```json
{
  "version": "0.1",
  "root": "./src",
  "generatedAt": "2024-12-21T10:00:00Z",
  "metadata": { ... },
  "summary": { ... },
  "callsites": [ ... ]
}
```

---

## Top-Level Fields

| Field | Type | Description |
|-------|------|-------------|
| `version` | string | Schema version (currently `"0.1"`) |
| `root` | string | Analyzed path (relative or absolute) |
| `generatedAt` | string | ISO 8601 timestamp |
| `metadata` | object | Analysis context (optional) |
| `summary` | object | Aggregate statistics |
| `callsites` | array | List of inference points |

---

## Metadata Object

Optional context about how the analysis was performed:

```json
{
  "metadata": {
    "absolutePath": "/Users/dev/project/src",
    "promptId": "unified-analyzer",
    "promptVersion": "1.6.0",
    "templatesVersion": "1.0.0",
    "llmProvider": "anthropic",
    "llmModel": "claude-sonnet-4-20250514"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `absolutePath` | string | Full absolute path analyzed |
| `promptId` | string | Analysis prompt identifier |
| `promptVersion` | string | Analysis prompt version |
| `templatesVersion` | string | peakinfer-templates version |
| `llmProvider` | string | LLM provider used (`anthropic`, `none`) |
| `llmModel` | string | LLM model used for analysis |

---

## Summary Object

Aggregate statistics for quick overview:

```json
{
  "summary": {
    "totalCallsites": 7,
    "providers": ["openai", "anthropic"],
    "models": ["gpt-4", "claude-3-opus"],
    "patterns": {
      "streaming": 3,
      "batching": 0,
      "retries": 5,
      "caching": 1,
      "fallback": 2
    }
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `totalCallsites` | number | Total inference points detected |
| `providers` | string[] | Unique providers found |
| `models` | string[] | Unique models found |
| `patterns` | object | Count of each pattern detected |

---

## Callsite Object

Each inference point (callsite) has this structure:

```json
{
  "id": "src/services/chat.ts:42",
  "file": "src/services/chat.ts",
  "line": 42,
  "provider": "openai",
  "model": "gpt-4",
  "framework": "langchain",
  "runtime": null,
  "patterns": {
    "streaming": true,
    "batching": false,
    "retries": true,
    "caching": false,
    "fallback": true
  },
  "confidence": 0.95
}
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (typically `file:line`) |
| `file` | string | File path (relative to root) |
| `line` | number | Line number |
| `provider` | string \| null | Provider name |
| `model` | string \| null | Model name |
| `framework` | string \| null | Framework (langchain, llamaindex, etc.) |
| `runtime` | string \| null | Runtime (vllm, tgi, etc.) |
| `patterns` | object | Detected code patterns |
| `confidence` | number | Detection confidence (0-1) |

### Patterns Object

| Pattern | Type | Description |
|---------|------|-------------|
| `streaming` | boolean | Streaming enabled in code |
| `batching` | boolean | Batch processing detected |
| `retries` | boolean | Retry logic present |
| `caching` | boolean | Caching implemented |
| `fallback` | boolean | Fallback logic present |

---

## Provider Values

Valid provider values:

```typescript
type Provider =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'cohere'
  | 'mistral'
  | 'bedrock'
  | 'azure_openai'
  | 'together'
  | 'fireworks'
  | 'groq'
  | 'replicate'
  | 'perplexity'
  | 'vllm'
  | 'sglang'
  | 'tgi'
  | 'ollama'
  | 'llamacpp'
  | 'unknown';
```

---

## Complete Example

```json
{
  "version": "0.1",
  "root": "./src",
  "generatedAt": "2024-12-21T10:00:00.000Z",
  "metadata": {
    "absolutePath": "/Users/dev/project/src",
    "llmProvider": "anthropic",
    "llmModel": "claude-sonnet-4-20250514"
  },
  "summary": {
    "totalCallsites": 3,
    "providers": ["openai", "anthropic"],
    "models": ["gpt-4", "gpt-4-turbo", "claude-3-opus"],
    "patterns": {
      "streaming": 2,
      "batching": 0,
      "retries": 2,
      "caching": 1,
      "fallback": 1
    }
  },
  "callsites": [
    {
      "id": "src/services/chat.ts:42",
      "file": "src/services/chat.ts",
      "line": 42,
      "provider": "openai",
      "model": "gpt-4",
      "framework": null,
      "runtime": null,
      "patterns": {
        "streaming": true,
        "batching": false,
        "retries": true,
        "caching": false,
        "fallback": false
      },
      "confidence": 0.95
    },
    {
      "id": "src/services/summarize.ts:15",
      "file": "src/services/summarize.ts",
      "line": 15,
      "provider": "openai",
      "model": "gpt-4-turbo",
      "framework": "langchain",
      "runtime": null,
      "patterns": {
        "streaming": false,
        "batching": false,
        "retries": true,
        "caching": true,
        "fallback": true
      },
      "confidence": 0.88
    },
    {
      "id": "src/api/translate.ts:78",
      "file": "src/api/translate.ts",
      "line": 78,
      "provider": "anthropic",
      "model": "claude-3-opus",
      "framework": null,
      "runtime": null,
      "patterns": {
        "streaming": true,
        "batching": false,
        "retries": false,
        "caching": false,
        "fallback": false
      },
      "confidence": 0.92
    }
  ]
}
```

---

## Usage

### CLI Output

Generate InferenceMap with the CLI:

```bash
# Save to file
peakinfer analyze ./src --json > inference-map.json

# Or use built-in artifact saving
peakinfer analyze ./src --save
# Creates .peakinfer/inference-map.json
```

### Programmatic Access (TypeScript)

```typescript
import { InferenceMap } from '@kalmantic/peakinfer';
import fs from 'fs';

const map: InferenceMap = JSON.parse(
  fs.readFileSync('.peakinfer/inference-map.json', 'utf-8')
);

console.log(`Found ${map.summary.totalCallsites} inference points`);

for (const callsite of map.callsites) {
  if (!callsite.patterns.retries) {
    console.log(`Missing retries: ${callsite.id}`);
  }
}
```

### Zod Schema Validation

```typescript
import { InferenceMap as InferenceMapSchema } from '@kalmantic/peakinfer';

// Validate JSON against schema
const result = InferenceMapSchema.safeParse(jsonData);

if (!result.success) {
  console.error('Invalid InferenceMap:', result.error);
}
```

---

## Versioning

The `version` field indicates the schema version:

| Version | Description |
|---------|-------------|
| `0.1` | Initial specification (current) |

Future versions will maintain backward compatibility where possible.

---

## TypeScript Definition

The full Zod schema is available in `src/types.ts`:

```typescript
export const InferenceMap = z.object({
  version: z.string(),
  root: z.string(),
  generatedAt: z.string(),
  metadata: z.object({
    absolutePath: z.string(),
    promptId: z.string().optional(),
    promptVersion: z.string().optional(),
    templatesVersion: z.string().optional(),
    llmProvider: z.string().optional(),
    llmModel: z.string().optional(),
  }).optional(),
  summary: z.object({
    totalCallsites: z.number(),
    providers: z.array(z.string()),
    models: z.array(z.string()),
    patterns: z.record(z.number()),
  }),
  callsites: z.array(Callsite),
});
```

---

## Related

- [Runtime Events Format](events-format.md) — Input schema for runtime correlation
- [README](../README.md) — Quick start guide

import { readFileSync, existsSync } from 'fs';
import { extname } from 'path';
import { InferenceEvent, RuntimeSummary, ProviderStats, NormalizationOptions, NormalizationResult } from './types.js';
import { detectFormat, normalizeRuntimeEvents, requiresAgentNormalization } from './format-normalizer.js';

// =============================================================================
// TYPES
// =============================================================================

interface ParseError {
  line: number;
  field: string;
  message: string;
}

// =============================================================================
// HELPERS
// =============================================================================

function validateEvent(data: unknown, lineNum: number): InferenceEvent {
  if (typeof data !== 'object' || data === null) {
    throw new Error(`Line ${lineNum}: Expected object, got ${typeof data}`);
  }

  const obj = data as Record<string, unknown>;
  const errors: string[] = [];

  // Required fields
  if (typeof obj.id !== 'string') {
    errors.push(`Missing or invalid 'id' field`);
  }
  if (typeof obj.ts !== 'string') {
    errors.push(`Missing or invalid 'ts' field`);
  }
  if (typeof obj.provider !== 'string') {
    errors.push(`Missing or invalid 'provider' field`);
  }
  if (typeof obj.model !== 'string') {
    errors.push(`Missing or invalid 'model' field`);
  }
  if (typeof obj.input_tokens !== 'number') {
    errors.push(`Missing or invalid 'input_tokens' field`);
  }
  if (typeof obj.output_tokens !== 'number') {
    errors.push(`Missing or invalid 'output_tokens' field`);
  }
  if (typeof obj.latency_ms !== 'number') {
    errors.push(`Missing or invalid 'latency_ms' field`);
  }

  if (errors.length > 0) {
    throw new Error(`Line ${lineNum}: ${errors.join(', ')}`);
  }

  // Build event with optional fields
  const event: InferenceEvent = {
    id: obj.id as string,
    ts: obj.ts as string,
    provider: obj.provider as InferenceEvent['provider'],
    model: obj.model as string,
    input_tokens: obj.input_tokens as number,
    output_tokens: obj.output_tokens as number,
    latency_ms: obj.latency_ms as number,
    intent: obj.intent as string | undefined,
    callsite_id: obj.callsite_id as string | undefined,
    // Runtime pattern fields
    streaming: typeof obj.streaming === 'boolean' ? obj.streaming : undefined,
    ttft_ms: typeof obj.ttft_ms === 'number' ? obj.ttft_ms : undefined,
    batch_size: typeof obj.batch_size === 'number' ? obj.batch_size : undefined,
    batch_id: typeof obj.batch_id === 'string' ? obj.batch_id : undefined,
    cached: typeof obj.cached === 'boolean' ? obj.cached : undefined,
    retry_count: typeof obj.retry_count === 'number' ? obj.retry_count : undefined,
    fallback_used: typeof obj.fallback_used === 'boolean' ? obj.fallback_used : undefined,
    original_model: typeof obj.original_model === 'string' ? obj.original_model : undefined,
  };

  // Infer streaming if not explicitly provided but ttft_ms is present
  if (event.streaming === undefined && event.ttft_ms !== undefined) {
    event.streaming = true;
  }

  return event;
}

/**
 * Detect streaming based on heuristics when not explicitly provided.
 *
 * Heuristics:
 * 1. If ttft_ms is present and much smaller than total latency → streaming
 * 2. If output_tokens/latency_ms ratio suggests real-time generation → likely streaming
 * 3. If latency pattern shows consistent per-token timing → streaming
 */
function inferStreamingFromHeuristics(events: InferenceEvent[]): InferenceEvent[] {
  return events.map(event => {
    // If streaming is already known, skip
    if (event.streaming !== undefined) {
      return event;
    }

    // Heuristic 1: If ttft_ms present and < 50% of total latency, likely streaming
    if (event.ttft_ms !== undefined) {
      event.streaming = event.ttft_ms < event.latency_ms * 0.5;
      return event;
    }

    // Heuristic 2: Calculate tokens per second
    // Streaming typically shows 20-150 TPS, non-streaming shows all tokens at once
    const outputTokens = event.output_tokens;
    const latencySeconds = event.latency_ms / 1000;
    const tps = outputTokens / latencySeconds;

    // Very high TPS (>200) with significant output suggests non-streaming (batch return)
    // Very low TPS (<5) with significant output suggests non-streaming (slow model, one response)
    // TPS in 20-150 range with reasonable output suggests streaming
    if (outputTokens > 50) {
      if (tps >= 20 && tps <= 150) {
        // Likely streaming - consistent token generation rate
        event.streaming = true;
      } else if (tps > 200) {
        // Likely non-streaming - tokens returned all at once (cached or fast response)
        event.streaming = false;
      }
      // If TPS < 20, could be either - leave as undefined
    }

    return event;
  });
}

function parseJSONL(content: string): InferenceEvent[] {
  const lines = content.trim().split('\n').filter(l => l.trim());
  const events: InferenceEvent[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    try {
      const data = JSON.parse(line);
      events.push(validateEvent(data, i + 1));
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Line ${i + 1}: Invalid JSON`);
      }
      throw error;
    }
  }

  return events;
}

function parseJSONArray(content: string): InferenceEvent[] {
  let data: unknown[];
  try {
    data = JSON.parse(content);
  } catch {
    throw new Error('Invalid JSON');
  }

  if (!Array.isArray(data)) {
    throw new Error('Expected JSON array');
  }

  return data.map((item, i) => validateEvent(item, i + 1));
}

function parseCSV(content: string): InferenceEvent[] {
  const lines = content.trim().split('\n');
  if (lines.length < 2) {
    return [];
  }

  const headers = lines[0].split(',').map(h => h.trim());
  const events: InferenceEvent[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const obj: Record<string, unknown> = {};

    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      const value = values[j];

      // Convert numeric fields
      if (['input_tokens', 'output_tokens', 'latency_ms'].includes(header)) {
        obj[header] = parseFloat(value);
      } else {
        obj[header] = value;
      }
    }

    events.push(validateEvent(obj, i + 1));
  }

  return events;
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Extended parse result with normalization metadata.
 */
export interface ParseResult {
  events: InferenceEvent[];
  normalization?: NormalizationResult;
  warnings: string[];
}

/**
 * Parse runtime events from a file.
 *
 * This function implements the format detection pipeline (PRD §6.4):
 * 1. Try direct parsing for known formats (JSONL, JSON, CSV)
 * 2. Fall back to agent-based normalization for unknown formats
 * 3. Apply streaming inference heuristics
 *
 * @param path - Path to the events file
 * @param options - Normalization options (format hints, mappings, etc.)
 */
export async function parseEvents(
  path: string,
  options: NormalizationOptions = {},
): Promise<InferenceEvent[]> {
  const result = await parseEventsWithMetadata(path, options);
  return result.events;
}

/**
 * Parse runtime events with full normalization metadata.
 * Use this for detailed reporting on format detection and field mappings.
 */
export async function parseEventsWithMetadata(
  path: string,
  options: NormalizationOptions = {},
): Promise<ParseResult> {
  if (!existsSync(path)) {
    throw new Error(`File not found: ${path}`);
  }

  const content = readFileSync(path, 'utf-8');
  const ext = extname(path).toLowerCase();
  const warnings: string[] = [];

  // Step 1: Try direct parsing for standard formats
  if (!options.format_hint) {
    try {
      let events: InferenceEvent[] | null = null;

      switch (ext) {
        case '.jsonl':
        case '.ndjson':
          events = parseJSONL(content);
          break;
        case '.json':
          // Could be JSON array or complex format (OTEL, Jaeger, etc.)
          if (content.trim().startsWith('[')) {
            try {
              events = parseJSONArray(content);
            } catch {
              // JSON array but not InferenceEvent schema - needs normalization
            }
          }
          break;
        case '.csv':
          events = parseCSV(content);
          break;
        case '.tsv':
          events = parseTSV(content);
          break;
      }

      if (events && events.length > 0) {
        // Direct parse succeeded
        return {
          events: inferStreamingFromHeuristics(events),
          warnings,
        };
      }
    } catch (error) {
      // If it's a validation error (missing required fields) for standard formats,
      // check if format detection suggests this is a known complex format that needs normalization
      if (error instanceof Error && (
        error.message.includes('Missing or invalid') ||
        error.message.includes('Expected object')
      )) {
        // For .jsonl files, check if this is a known complex format (Langfuse, Helicone, etc.)
        // Standard JSONL files with missing fields should throw validation errors
        if (ext === '.jsonl' || ext === '.ndjson') {
          const detection = detectFormat(content, path);
          // Only allow normalization for known complex formats, not for "custom_json" or "unknown"
          const knownComplexFormats = ['langfuse', 'helicone', 'otel', 'jaeger', 'zipkin', 'wandb', 'litellm', 'portkey'];
          if (detection.requires_agent && knownComplexFormats.includes(detection.format_type)) {
            // Known complex format detected - let normalization handle it
            warnings.push(`Direct parse failed: ${error instanceof Error ? error.message : String(error)}`);
          } else {
            // Standard JSONL format with validation error - throw it
            throw error;
          }
        } else if (ext === '.json' || ext === '.csv' || ext === '.tsv') {
          // For other standard formats, throw validation errors
          throw error;
        } else {
          // Unknown extension - let normalization try
          warnings.push(`Direct parse failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      } else {
        // Direct parse failed - will try format normalization
        warnings.push(`Direct parse failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  // Step 2: Detect format and check if agent normalization is needed
  const detection = detectFormat(content, path);

  // Step 3: Use format normalizer for complex formats or when direct parse failed

  // If user provided strict mode and we need agent, fail early
  if (options.strict && detection.requires_agent) {
    throw new Error(
      `Format "${detection.format_type}" requires agent normalization. ` +
      `Use --format to specify the format, or remove --strict flag.`
    );
  }

  // If direct-parse format detected with low confidence, warn but try
  if (!detection.requires_agent && detection.confidence < 0.9) {
    warnings.push(
      `Format detection confidence is ${(detection.confidence * 100).toFixed(0)}%. ` +
      `Results may be incomplete.`
    );
  }

  // Step 4: Use format normalizer for complex formats
  if (detection.requires_agent || options.format_hint) {
    const { events, normalization, errors } = await normalizeRuntimeEvents(content, options);

    if (errors.length > 0 && options.strict) {
      throw new Error(`Normalization errors: ${errors.slice(0, 3).join('; ')}`);
    }

    warnings.push(...normalization.warnings);

    return {
      events: inferStreamingFromHeuristics(events),
      normalization,
      warnings,
    };
  }

  // Step 5: Final fallback - try auto-detection
  let events: InferenceEvent[];

  if (content.trim().startsWith('[')) {
    events = parseJSONArray(content);
  } else if (content.trim().startsWith('{')) {
    events = parseJSONL(content);
  } else {
    throw new Error(
      `Unknown file format: ${ext}. ` +
      `Supported formats: .jsonl, .json, .csv, .tsv, or observability exports (OTEL, Jaeger, Zipkin). ` +
      `Use --format to specify the format type.`
    );
  }

  return {
    events: inferStreamingFromHeuristics(events),
    warnings,
  };
}

/**
 * Parse TSV (tab-separated values) format.
 */
function parseTSV(content: string): InferenceEvent[] {
  const lines = content.trim().split('\n');
  if (lines.length < 2) {
    return [];
  }

  const headers = lines[0].split('\t').map(h => h.trim());
  const events: InferenceEvent[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split('\t').map(v => v.trim());
    const obj: Record<string, unknown> = {};

    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      const value = values[j];

      // Convert numeric fields
      if (['input_tokens', 'output_tokens', 'latency_ms', 'ttft_ms', 'batch_size', 'retry_count'].includes(header)) {
        obj[header] = parseFloat(value);
      } else if (['streaming', 'cached', 'fallback_used'].includes(header)) {
        obj[header] = value.toLowerCase() === 'true';
      } else {
        obj[header] = value;
      }
    }

    events.push(validateEvent(obj, i + 1));
  }

  return events;
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

export function aggregate(events: InferenceEvent[]): RuntimeSummary {
  if (events.length === 0) {
    return {
      totalEvents: 0,
      byProvider: {},
      byModel: {},
      global: { p50: 0, p95: 0, p99: 0 },
    };
  }

  const byProvider: Record<string, InferenceEvent[]> = {};
  const byModel: Record<string, InferenceEvent[]> = {};
  const allLatencies: number[] = [];

  for (const event of events) {
    // Group by provider
    if (!byProvider[event.provider]) {
      byProvider[event.provider] = [];
    }
    byProvider[event.provider].push(event);

    // Group by model
    if (!byModel[event.model]) {
      byModel[event.model] = [];
    }
    byModel[event.model].push(event);

    allLatencies.push(event.latency_ms);
  }

  const computeStats = (group: InferenceEvent[]): ProviderStats => {
    const latencies = group.map(e => e.latency_ms);
    return {
      calls: group.length,
      tokens_in: group.reduce((sum, e) => sum + e.input_tokens, 0),
      tokens_out: group.reduce((sum, e) => sum + e.output_tokens, 0),
      latency_p50: percentile(latencies, 50),
      latency_p95: percentile(latencies, 95),
      latency_p99: percentile(latencies, 99),
    };
  };

  const providerStats: Record<string, ProviderStats> = {};
  for (const [provider, group] of Object.entries(byProvider)) {
    providerStats[provider] = computeStats(group);
  }

  const modelStats: Record<string, ProviderStats> = {};
  for (const [model, group] of Object.entries(byModel)) {
    modelStats[model] = computeStats(group);
  }

  return {
    totalEvents: events.length,
    byProvider: providerStats,
    byModel: modelStats,
    global: {
      p50: percentile(allLatencies, 50),
      p95: percentile(allLatencies, 95),
      p99: percentile(allLatencies, 99),
    },
  };
}

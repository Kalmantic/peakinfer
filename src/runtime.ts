import { readFileSync, existsSync } from 'fs';
import { extname } from 'path';
import { InferenceEvent, RuntimeSummary, ProviderStats } from './types.js';

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

  return {
    id: obj.id as string,
    ts: obj.ts as string,
    provider: obj.provider as InferenceEvent['provider'],
    model: obj.model as string,
    input_tokens: obj.input_tokens as number,
    output_tokens: obj.output_tokens as number,
    latency_ms: obj.latency_ms as number,
    intent: obj.intent as string | undefined,
    callsite_id: obj.callsite_id as string | undefined,
  };
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

export async function parseEvents(path: string): Promise<InferenceEvent[]> {
  if (!existsSync(path)) {
    throw new Error(`File not found: ${path}`);
  }

  const content = readFileSync(path, 'utf-8');
  const ext = extname(path).toLowerCase();

  switch (ext) {
    case '.jsonl':
      return parseJSONL(content);
    case '.json':
      return parseJSONArray(content);
    case '.csv':
      return parseCSV(content);
    default:
      // Try to auto-detect
      if (content.trim().startsWith('[')) {
        return parseJSONArray(content);
      }
      if (content.trim().startsWith('{')) {
        return parseJSONL(content);
      }
      throw new Error(`Unknown file format: ${ext}`);
  }
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

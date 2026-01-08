/**
 * Format Normalizer - Agent-based runtime event format detection and normalization.
 *
 * This module implements PRD §6.4: Enable PeakInfer to ingest runtime data from any
 * observability system, logging framework, or custom format without requiring users
 * to transform their data first.
 *
 * Design Principles (Julie Zhou aligned):
 * - Behavior First: Detect formats automatically, fallback gracefully
 * - Clarity Over Cleverness: Clear confidence scores, no silent assumptions
 * - State Completeness: Handle all format states (known, agent-required, unknown)
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import type {
  FormatType,
  FieldMapping,
  FormatDetectionResult,
  NormalizationResult,
  NormalizationOptions,
  InferenceEvent,
  ScanResult,
} from './types.js';
import { loadPrompt } from './templates.js';

/**
 * Extract text content from Claude Agent SDK messages
 */
function extractTextFromMessages(messages: SDKMessage[]): string {
  let text = '';
  for (const msg of messages) {
    if (msg.type === 'assistant' && msg.message?.content) {
      for (const block of msg.message.content) {
        if (block.type === 'text') {
          text += block.text;
        }
      }
    }
  }
  return text;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const SAMPLE_LINES = 20;  // Number of lines to sample for detection
const MIN_CONFIDENCE_THRESHOLD = 0.7;  // Minimum confidence for auto-acceptance
const LLM_MODEL = 'claude-sonnet-4-20250514';

// Required fields for InferenceEvent
const REQUIRED_FIELDS = ['id', 'ts', 'provider', 'model', 'input_tokens', 'output_tokens', 'latency_ms'];

// =============================================================================
// FORMAT SIGNATURES
// =============================================================================

/**
 * Known format signatures for heuristic detection.
 * Each signature includes structural patterns that uniquely identify a format.
 */
const FORMAT_SIGNATURES: Record<string, {
  patterns: RegExp[];
  structuralCheck?: (data: unknown) => boolean;
  confidence: number;
}> = {
  otel: {
    patterns: [
      /resourceSpans/i,
      /scopeSpans/i,
      /traceId/i,
      /spanId/i,
    ],
    structuralCheck: (data) => {
      if (typeof data !== 'object' || data === null) return false;
      const obj = data as Record<string, unknown>;
      return 'resourceSpans' in obj || 'resource_spans' in obj;
    },
    confidence: 0.95,
  },
  jaeger: {
    patterns: [
      /traceID/,      // Jaeger uses capital ID (vs OTEL's traceId)
      /spanID/,       // Jaeger uses capital ID (vs OTEL's spanId)
      /operationName/,
      /jaeger/i,
      /"processes"/,  // Jaeger-specific field
    ],
    structuralCheck: (data) => {
      if (typeof data !== 'object' || data === null) return false;
      const obj = data as Record<string, unknown>;
      // Jaeger format: { data: [{ traceID: ..., processes: ... }] }
      if ('data' in obj && Array.isArray((obj as { data: unknown }).data)) {
        const firstTrace = (obj as { data: unknown[] }).data[0] as Record<string, unknown>;
        // Must have traceID (capital ID) to distinguish from OTEL
        return firstTrace?.traceID !== undefined && firstTrace?.processes !== undefined;
      }
      return false;
    },
    confidence: 0.95,
  },
  zipkin: {
    patterns: [
      /"traceId"/,
      /"parentId"/,
      /"localEndpoint"/,
      /zipkin/i,
    ],
    structuralCheck: (data) => {
      if (!Array.isArray(data)) return false;
      const first = data[0] as Record<string, unknown>;
      return first?.traceId !== undefined && first?.localEndpoint !== undefined;
    },
    confidence: 0.95,
  },
  langfuse: {
    patterns: [
      /observation/i,
      /generation/i,
      /langfuse/i,
      /traceId/,
    ],
    structuralCheck: (data) => {
      if (typeof data !== 'object' || data === null) return false;
      const obj = data as Record<string, unknown>;
      // Langfuse exports have type: 'GENERATION' or observations array
      return 'type' in obj && (obj.type === 'GENERATION' || obj.type === 'SPAN') ||
             'observations' in obj || 'traceId' in obj;
    },
    confidence: 0.90,
  },
  litellm: {
    patterns: [
      /litellm/i,
      /call_type/,
      /api_base/,
      /response_time_ms/,
    ],
    structuralCheck: (data) => {
      if (typeof data !== 'object' || data === null) return false;
      const obj = data as Record<string, unknown>;
      // LiteLLM logs have call_type OR api_base OR response_time_ms fields
      return 'call_type' in obj || 'api_base' in obj || 'response_time_ms' in obj;
    },
    confidence: 0.90,
  },
  helicone: {
    patterns: [
      /helicone/i,
      /helicone_request_id/,
      /helicone_response_id/,
      /helicone_properties/,
    ],
    structuralCheck: (data) => {
      if (typeof data !== 'object' || data === null) return false;
      const obj = data as Record<string, unknown>;
      // Helicone-specific fields - must have helicone_ prefixed fields
      return 'helicone_request_id' in obj || 'helicone_response_id' in obj ||
             'helicone_properties' in obj || 'helicone' in obj;
    },
    confidence: 0.85,
  },
};

// =============================================================================
// PREDEFINED FIELD MAPPINGS
// =============================================================================

/**
 * Predefined field mappings for known formats.
 * These are high-confidence mappings based on format specifications.
 */
const PREDEFINED_MAPPINGS: Record<string, FieldMapping[]> = {
  otel: [
    {
      target: 'id',
      source_path: '$.resourceSpans[*].scopeSpans[*].spans[*].spanId',
      extraction_type: 'jsonpath',
      transform: 'none',
      confidence: 1.0,
      evidence: 'OTLP span ID field',
    },
    {
      target: 'ts',
      source_path: '$.resourceSpans[*].scopeSpans[*].spans[*].startTimeUnixNano',
      extraction_type: 'jsonpath',
      transform: 'unix_nano_to_iso',
      confidence: 1.0,
      evidence: 'OTLP start time in nanoseconds',
    },
    {
      target: 'provider',
      source_path: "$.resourceSpans[*].scopeSpans[*].spans[*].attributes[?(@.key=='llm.provider')].value.stringValue",
      extraction_type: 'jsonpath',
      transform: 'provider_normalize',
      confidence: 0.9,
      evidence: 'LLM semantic convention attribute',
    },
    {
      target: 'model',
      source_path: "$.resourceSpans[*].scopeSpans[*].spans[*].attributes[?(@.key=='llm.model')].value.stringValue",
      extraction_type: 'jsonpath',
      transform: 'none',
      confidence: 0.9,
      evidence: 'LLM semantic convention attribute',
    },
    {
      target: 'input_tokens',
      source_path: "$.resourceSpans[*].scopeSpans[*].spans[*].attributes[?(@.key=='llm.token_count.prompt')].value.intValue",
      extraction_type: 'jsonpath',
      transform: 'parse_int',
      confidence: 0.9,
      evidence: 'LLM semantic convention attribute',
    },
    {
      target: 'output_tokens',
      source_path: "$.resourceSpans[*].scopeSpans[*].spans[*].attributes[?(@.key=='llm.token_count.completion')].value.intValue",
      extraction_type: 'jsonpath',
      transform: 'parse_int',
      confidence: 0.9,
      evidence: 'LLM semantic convention attribute',
    },
    {
      target: 'latency_ms',
      source_path: '(endTimeUnixNano - startTimeUnixNano) / 1000000',
      extraction_type: 'computed',
      transform: 'none',
      confidence: 1.0,
      evidence: 'Computed from OTLP start/end timestamps',
    },
  ],
  jaeger: [
    {
      target: 'id',
      source_path: '$.data[*].spans[*].spanID',
      extraction_type: 'jsonpath',
      transform: 'none',
      confidence: 1.0,
      evidence: 'Jaeger span ID',
    },
    {
      target: 'ts',
      source_path: '$.data[*].spans[*].startTime',
      extraction_type: 'jsonpath',
      transform: 'unix_ms_to_iso',
      confidence: 1.0,
      evidence: 'Jaeger start time in microseconds',
    },
    {
      target: 'provider',
      source_path: "$.data[*].spans[*].tags[?(@.key=='llm.provider')].value",
      extraction_type: 'jsonpath',
      transform: 'provider_normalize',
      confidence: 0.85,
      evidence: 'Tag-based provider extraction',
    },
    {
      target: 'model',
      source_path: "$.data[*].spans[*].tags[?(@.key=='llm.model')].value",
      extraction_type: 'jsonpath',
      transform: 'none',
      confidence: 0.85,
      evidence: 'Tag-based model extraction',
    },
    {
      target: 'input_tokens',
      source_path: "$.data[*].spans[*].tags[?(@.key=='llm.input_tokens')].value",
      extraction_type: 'jsonpath',
      transform: 'parse_int',
      confidence: 0.85,
      evidence: 'Tag-based token extraction',
    },
    {
      target: 'output_tokens',
      source_path: "$.data[*].spans[*].tags[?(@.key=='llm.output_tokens')].value",
      extraction_type: 'jsonpath',
      transform: 'parse_int',
      confidence: 0.85,
      evidence: 'Tag-based token extraction',
    },
    {
      target: 'latency_ms',
      source_path: '$.data[*].spans[*].duration',
      extraction_type: 'jsonpath',
      transform: 'none',  // Jaeger duration is already in microseconds, convert to ms
      confidence: 1.0,
      evidence: 'Jaeger duration field (microseconds -> ms)',
    },
  ],
  zipkin: [
    {
      target: 'id',
      source_path: '$[*].id',
      extraction_type: 'jsonpath',
      transform: 'none',
      confidence: 1.0,
      evidence: 'Zipkin span ID',
    },
    {
      target: 'ts',
      source_path: '$[*].timestamp',
      extraction_type: 'jsonpath',
      transform: 'unix_ms_to_iso',
      confidence: 1.0,
      evidence: 'Zipkin timestamp in microseconds',
    },
    {
      target: 'provider',
      source_path: "$[*].tags['llm.provider']",
      extraction_type: 'jsonpath',
      transform: 'provider_normalize',
      confidence: 0.85,
      evidence: 'Tag-based provider extraction',
    },
    {
      target: 'model',
      source_path: "$[*].tags['llm.model']",
      extraction_type: 'jsonpath',
      transform: 'none',
      confidence: 0.85,
      evidence: 'Tag-based model extraction',
    },
    {
      target: 'input_tokens',
      source_path: "$[*].tags['llm.input_tokens']",
      extraction_type: 'jsonpath',
      transform: 'parse_int',
      confidence: 0.85,
      evidence: 'Tag-based token extraction',
    },
    {
      target: 'output_tokens',
      source_path: "$[*].tags['llm.output_tokens']",
      extraction_type: 'jsonpath',
      transform: 'parse_int',
      confidence: 0.85,
      evidence: 'Tag-based token extraction',
    },
    {
      target: 'latency_ms',
      source_path: '$[*].duration',
      extraction_type: 'jsonpath',
      transform: 'none',  // Zipkin duration is in microseconds
      confidence: 1.0,
      evidence: 'Zipkin duration field (microseconds -> ms)',
    },
  ],
  langfuse: [
    {
      target: 'id',
      source_path: 'id',
      extraction_type: 'direct',
      transform: 'none',
      confidence: 0.95,
      evidence: 'Langfuse observation ID',
    },
    {
      target: 'ts',
      source_path: 'startTime',
      extraction_type: 'direct',
      transform: 'none',  // Already ISO format
      confidence: 0.95,
      evidence: 'Langfuse start timestamp',
    },
    {
      target: 'provider',
      source_path: 'model',
      extraction_type: 'direct',
      transform: 'provider_normalize',
      confidence: 0.8,
      evidence: 'Langfuse model field (extract provider)',
    },
    {
      target: 'model',
      source_path: 'model',
      extraction_type: 'direct',
      transform: 'none',
      confidence: 0.95,
      evidence: 'Langfuse model field',
    },
    {
      target: 'input_tokens',
      source_path: 'usage.input',
      extraction_type: 'jsonpath',
      transform: 'parse_int',
      confidence: 0.9,
      evidence: 'Langfuse usage input tokens',
    },
    {
      target: 'output_tokens',
      source_path: 'usage.output',
      extraction_type: 'jsonpath',
      transform: 'parse_int',
      confidence: 0.9,
      evidence: 'Langfuse usage output tokens',
    },
    {
      target: 'latency_ms',
      source_path: '(endTime - startTime)',
      extraction_type: 'computed',
      transform: 'duration_to_ms',
      confidence: 0.9,
      evidence: 'Langfuse computed from start/end time',
    },
  ],
  litellm: [
    {
      target: 'id',
      source_path: 'id',
      extraction_type: 'direct',
      transform: 'none',
      confidence: 0.95,
      evidence: 'LiteLLM request ID',
    },
    {
      target: 'ts',
      source_path: 'startTime',
      extraction_type: 'direct',
      transform: 'unix_ms_to_iso',
      confidence: 0.9,
      evidence: 'LiteLLM start timestamp',
    },
    {
      target: 'provider',
      source_path: 'model',
      extraction_type: 'direct',
      transform: 'provider_normalize',  // LiteLLM uses model format like "openai/gpt-4"
      confidence: 0.85,
      evidence: 'LiteLLM model field (provider/model format)',
    },
    {
      target: 'model',
      source_path: 'model',
      extraction_type: 'direct',
      transform: 'none',
      confidence: 0.95,
      evidence: 'LiteLLM model field',
    },
    {
      target: 'input_tokens',
      source_path: 'usage.prompt_tokens',
      extraction_type: 'jsonpath',
      transform: 'parse_int',
      confidence: 0.95,
      evidence: 'LiteLLM usage prompt_tokens',
    },
    {
      target: 'output_tokens',
      source_path: 'usage.completion_tokens',
      extraction_type: 'jsonpath',
      transform: 'parse_int',
      confidence: 0.95,
      evidence: 'LiteLLM usage completion_tokens',
    },
    {
      target: 'latency_ms',
      source_path: 'response_time_ms',
      extraction_type: 'direct',
      transform: 'none',
      confidence: 1.0,
      evidence: 'LiteLLM response_time_ms field',
    },
  ],
  helicone: [
    {
      target: 'id',
      source_path: 'helicone_request_id',
      extraction_type: 'direct',
      transform: 'none',
      confidence: 0.95,
      evidence: 'Helicone request ID',
    },
    {
      target: 'ts',
      source_path: 'created_at',
      extraction_type: 'direct',
      transform: 'none',  // Helicone uses ISO format
      confidence: 0.9,
      evidence: 'Helicone created_at timestamp',
    },
    {
      target: 'provider',
      source_path: 'provider',
      extraction_type: 'direct',
      transform: 'provider_normalize',
      confidence: 0.9,
      evidence: 'Helicone provider field',
    },
    {
      target: 'model',
      source_path: 'model',
      extraction_type: 'direct',
      transform: 'none',
      confidence: 0.95,
      evidence: 'Helicone model field',
    },
    {
      target: 'input_tokens',
      source_path: 'prompt_tokens',
      extraction_type: 'direct',
      transform: 'parse_int',
      confidence: 0.9,
      evidence: 'Helicone prompt_tokens',
    },
    {
      target: 'output_tokens',
      source_path: 'completion_tokens',
      extraction_type: 'direct',
      transform: 'parse_int',
      confidence: 0.9,
      evidence: 'Helicone completion_tokens',
    },
    {
      target: 'latency_ms',
      source_path: 'latency_ms',
      extraction_type: 'direct',
      transform: 'none',
      confidence: 1.0,
      evidence: 'Helicone latency_ms field',
    },
  ],
};

// =============================================================================
// FORMAT DETECTION
// =============================================================================

/**
 * Detect the format type of a runtime events file.
 *
 * Detection strategy:
 * 1. Try file extension heuristics
 * 2. Sample content and check against known signatures
 * 3. Fall back to agent-based detection for unknown formats
 */
export function detectFormat(
  content: string,
  filename?: string,
): FormatDetectionResult {
  const lines = content.trim().split('\n').slice(0, SAMPLE_LINES);

  // First, try to parse as complete JSON (object or array)
  // This handles single-line JSON arrays which would incorrectly match JSONL
  let parsedAsWhole: unknown;
  try {
    parsedAsWhole = JSON.parse(content);
  } catch {
    parsedAsWhole = null;
  }

  // If it's a JSON array, check for InferenceEvent schema first
  if (Array.isArray(parsedAsWhole) && parsedAsWhole.length > 0) {
    const first = parsedAsWhole[0] as Record<string, unknown>;
    const hasRequiredFields = REQUIRED_FIELDS.every(f => f in first);

    if (hasRequiredFields) {
      return {
        format_type: 'json_array',
        confidence: 1.0,
        evidence: 'JSON array with InferenceEvent schema',
        sample_size: Math.min(parsedAsWhole.length, SAMPLE_LINES),
        requires_agent: false,
      };
    }
  }

  // Check if it's likely JSONL (newline-delimited JSON)
  // Note: Multi-line content where each line is valid JSON
  if (lines.length > 1) {
    const isJSONL = lines.every(line => {
      const trimmed = line.trim();
      if (!trimmed) return true; // Empty lines are ok
      try {
        JSON.parse(trimmed);
        return true;
      } catch {
        return false;
      }
    });

    if (isJSONL) {
      // Parse first non-empty line
      const firstLine = lines.find(l => l.trim());
      if (firstLine) {
        try {
          const firstEvent = JSON.parse(firstLine);

          // Check if JSONL matches InferenceEvent schema
          const hasRequiredFields = REQUIRED_FIELDS.every(f => f in firstEvent);

          if (hasRequiredFields) {
            return {
              format_type: 'jsonl',
              confidence: 1.0,
              evidence: 'JSONL with InferenceEvent schema (all required fields present)',
              sample_size: lines.length,
              requires_agent: false,
            };
          }

          // Check against known format signatures for JSONL data
          // Only match if structuralCheck passes (required for JSONL format detection)
          const jsonStr = JSON.stringify(firstEvent);
          for (const [formatType, signature] of Object.entries(FORMAT_SIGNATURES)) {
            // For JSONL, require structuralCheck to pass (if defined)
            if (signature.structuralCheck) {
              const structuralMatch = signature.structuralCheck(firstEvent);
              if (!structuralMatch) continue;

              const patternMatches = signature.patterns.filter(p => p.test(jsonStr)).length;
              const patternRatio = patternMatches / signature.patterns.length;
              const confidence = Math.max(0.8, patternRatio) * signature.confidence;

              return {
                format_type: formatType as FormatType,
                confidence,
                evidence: `JSONL with ${formatType} format (structural match, ${patternMatches}/${signature.patterns.length} patterns)`,
                sample_size: lines.length,
                requires_agent: true,
              };
            }
          }

          // JSONL but unknown schema - mark as custom_json requiring agent
          return {
            format_type: 'custom_json',
            confidence: 0.7,
            evidence: 'JSONL with custom schema - requires field mapping',
            sample_size: lines.length,
            requires_agent: true,
          };
        } catch {
          // Continue to other detection methods
        }
      }
    }
  }

  // Try to parse as JSON (array or object)
  let parsedData: unknown;
  try {
    parsedData = JSON.parse(content);
  } catch {
    // Not valid JSON, check for CSV/TSV or text logs
    return detectNonJSONFormat(content, lines, filename);
  }

  // Check if it's a JSON array with InferenceEvent schema
  if (Array.isArray(parsedData) && parsedData.length > 0) {
    const first = parsedData[0] as Record<string, unknown>;
    const hasRequiredFields = REQUIRED_FIELDS.every(f => f in first);

    if (hasRequiredFields) {
      return {
        format_type: 'json_array',
        confidence: 1.0,
        evidence: 'JSON array with InferenceEvent schema',
        sample_size: Math.min(parsedData.length, SAMPLE_LINES),
        requires_agent: false,
      };
    }
  }

  // Check against known format signatures
  // Require structural match for reliable detection
  const contentStr = JSON.stringify(parsedData);

  for (const [formatType, signature] of Object.entries(FORMAT_SIGNATURES)) {
    // Require structuralCheck to pass for format identification
    if (signature.structuralCheck) {
      const structuralMatch = signature.structuralCheck(parsedData);
      if (!structuralMatch) continue;

      const patternMatches = signature.patterns.filter(p => p.test(contentStr)).length;
      const patternRatio = patternMatches / signature.patterns.length;
      const confidence = Math.max(0.8, patternRatio) * signature.confidence;

      return {
        format_type: formatType as FormatType,
        confidence,
        evidence: `Matched ${formatType} format (structural match, ${patternMatches}/${signature.patterns.length} patterns)`,
        sample_size: Array.isArray(parsedData) ? parsedData.length : 1,
        requires_agent: true,  // Known formats still need agent for field mapping
      };
    }
  }

  // Unknown JSON structure - requires agent normalization
  return {
    format_type: 'custom_json',
    confidence: 0.5,
    evidence: 'Valid JSON but unknown schema - requires agent normalization',
    sample_size: Array.isArray(parsedData) ? parsedData.length : 1,
    requires_agent: true,
  };
}

/**
 * Detect non-JSON formats (CSV, TSV, text logs).
 */
function detectNonJSONFormat(
  content: string,
  lines: string[],
  filename?: string,
): FormatDetectionResult {
  // Check for CSV
  const firstLine = lines[0];
  if (firstLine.includes(',')) {
    const headers = firstLine.split(',').map(h => h.trim().toLowerCase());
    const hasLLMHeaders = ['provider', 'model', 'latency', 'tokens'].some(
      h => headers.some(header => header.includes(h))
    );

    if (hasLLMHeaders) {
      return {
        format_type: 'csv',
        confidence: 0.9,
        evidence: 'CSV with LLM-related headers detected',
        sample_size: lines.length,
        requires_agent: false,
      };
    }

    return {
      format_type: 'csv',
      confidence: 0.7,
      evidence: 'CSV format detected but headers may need mapping',
      sample_size: lines.length,
      requires_agent: true,
    };
  }

  // Check for TSV
  if (firstLine.includes('\t')) {
    return {
      format_type: 'tsv',
      confidence: 0.8,
      evidence: 'Tab-separated values detected',
      sample_size: lines.length,
      requires_agent: true,
    };
  }

  // Structured text logs
  const logPatterns = [
    /^\d{4}-\d{2}-\d{2}/, // ISO date prefix
    /^\[\d+\]/, // Timestamp prefix
    /level=(info|warn|error|debug)/i,
    /provider=\w+/,
    /model=\w+/,
  ];

  const logMatchCount = logPatterns.filter(p =>
    lines.some(line => p.test(line))
  ).length;

  if (logMatchCount >= 2) {
    return {
      format_type: 'custom_text',
      confidence: 0.6,
      evidence: `Structured text logs detected (${logMatchCount} patterns matched)`,
      sample_size: lines.length,
      requires_agent: true,
    };
  }

  return {
    format_type: 'unknown',
    confidence: 0.3,
    evidence: 'Could not determine format - manual field mapping may be required',
    sample_size: lines.length,
    requires_agent: true,
  };
}

// =============================================================================
// AGENT-BASED NORMALIZATION
// =============================================================================

// Load normalization prompt from YAML (with hardcoded fallback)
function getNormalizationPrompt(): string {
  const prompt = loadPrompt('format-normalizer');
  if (prompt) {
    return prompt.prompt;
  }
  // Fallback to hardcoded prompt if YAML not available
  return `You are an expert at parsing log formats and trace data. Analyze the following sample data and determine field mappings to the InferenceEvent schema.

The target InferenceEvent schema requires these fields:
- id (string): Unique event identifier
- ts (string): ISO 8601 timestamp
- provider (string): LLM provider (openai, anthropic, google, etc.)
- model (string): Model name (gpt-4o, claude-3-5-sonnet, etc.)
- input_tokens (number): Input/prompt token count
- output_tokens (number): Output/completion token count
- latency_ms (number): Request latency in milliseconds

Optional fields:
- streaming (boolean), ttft_ms (number), batch_size (number), cached (boolean), retry_count (number)

For each target field, provide:
1. The source path/expression to extract the value
2. The extraction type (direct, jsonpath, regex, computed)
3. Any transform needed (unix_ms_to_iso, unix_nano_to_iso, parse_int, etc.)
4. Your confidence (0.0-1.0) in this mapping
5. Evidence explaining why you chose this mapping

If a field cannot be mapped, indicate it as unmappable with confidence 0.

Respond in JSON format:
{
  "format_type": "detected format name",
  "mappings": [
    {
      "target": "field_name",
      "source_path": "path or expression",
      "extraction_type": "direct|jsonpath|regex|computed",
      "transform": "none|unix_ms_to_iso|parse_int|...",
      "confidence": 0.9,
      "evidence": "explanation"
    }
  ],
  "unmapped_fields": ["fields that could not be mapped"],
  "warnings": ["any issues or caveats"]
}`;
}

/**
 * Use LLM agent to normalize an unknown format.
 */
export async function normalizeWithAgent(
  content: string,
  detection: FormatDetectionResult,
  options: NormalizationOptions = {},
): Promise<NormalizationResult> {
  // Check for API key
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return createFallbackResult(detection, 'No ANTHROPIC_API_KEY - agent normalization unavailable');
  }

  // Sample content for the agent
  const sampleLines = content.trim().split('\n').slice(0, SAMPLE_LINES);
  const sampleContent = sampleLines.join('\n');

  // Build context prompt
  let contextPrompt = '';
  if (options.codebase_context) {
    const scanResult = options.codebase_context as ScanResult;
    contextPrompt = `\n\nCodebase context available:
- ${scanResult.files.length} files scanned
- Languages: ${scanResult.summary.languages.join(', ')}
- ${scanResult.summary.totalCandidates} potential inference points detected

This may help identify logging patterns and field names used in the application.`;
  }

  // User hints
  let hintsPrompt = '';
  if (options.format_hint) {
    hintsPrompt += `\nUser hint: Format appears to be "${options.format_hint}"`;
  }
  if (options.field_hints) {
    hintsPrompt += `\nUser-provided field mappings: ${JSON.stringify(options.field_hints)}`;
  }

  try {
    // Use Claude Agent SDK query() function
    const agentQuery = query({
      prompt: `${getNormalizationPrompt()}${contextPrompt}${hintsPrompt}

Detected format: ${detection.format_type} (confidence: ${detection.confidence})

Sample data:
\`\`\`
${sampleContent}
\`\`\``,
      options: {
        model: LLM_MODEL,
        tools: [],
        permissionMode: 'plan',
        cwd: process.cwd(),
      },
    });

    // Collect all messages from the async generator
    const messages: SDKMessage[] = [];
    for await (const message of agentQuery) {
      messages.push(message);
    }

    // Parse LLM response
    const responseText = extractTextFromMessages(messages);
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return createFallbackResult(detection, 'Could not parse agent response');
    }

    const agentResult = JSON.parse(jsonMatch[0]) as {
      format_type?: string;
      mappings?: Array<{
        target: string;
        source_path: string;
        extraction_type: string;
        transform?: string;
        confidence: number;
        evidence?: string;
      }>;
      unmapped_fields?: string[];
      warnings?: string[];
    };

    // Validate and build result
    const mappings: FieldMapping[] = (agentResult.mappings || []).map(m => ({
      target: m.target,
      source_path: m.source_path,
      extraction_type: m.extraction_type as FieldMapping['extraction_type'],
      transform: (m.transform || 'none') as FieldMapping['transform'],
      confidence: m.confidence,
      evidence: m.evidence,
    }));

    // Check confidence threshold
    const avgConfidence = mappings.reduce((sum, m) => sum + m.confidence, 0) / mappings.length;
    const warnings = agentResult.warnings || [];

    if (avgConfidence < MIN_CONFIDENCE_THRESHOLD && !options.lenient) {
      warnings.push(
        `Average mapping confidence (${avgConfidence.toFixed(2)}) is below threshold (${MIN_CONFIDENCE_THRESHOLD}). ` +
        `Use --lenient flag to accept low-confidence mappings.`
      );
    }

    return {
      detection: {
        ...detection,
        format_type: (agentResult.format_type as FormatType) || detection.format_type,
      },
      mappings,
      unmapped_fields: agentResult.unmapped_fields || [],
      warnings,
      audit: {
        normalized_at: new Date().toISOString(),
        agent_used: true,
        codebase_context_used: !!options.codebase_context,
        llm_model: LLM_MODEL,
      },
    };
  } catch (error) {
    return createFallbackResult(
      detection,
      `Agent normalization failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Create a fallback normalization result when agent is unavailable.
 */
function createFallbackResult(
  detection: FormatDetectionResult,
  warning: string,
): NormalizationResult {
  // Use predefined mappings if available
  const predefinedMappings = PREDEFINED_MAPPINGS[detection.format_type];

  return {
    detection,
    mappings: predefinedMappings || [],
    unmapped_fields: predefinedMappings ? [] : REQUIRED_FIELDS,
    warnings: [warning],
    audit: {
      normalized_at: new Date().toISOString(),
      agent_used: false,
      codebase_context_used: false,
    },
  };
}

// =============================================================================
// FIELD EXTRACTION
// =============================================================================

/**
 * Apply a transformation to an extracted value.
 */
function applyTransform(value: unknown, transform: FieldMapping['transform']): unknown {
  if (value === null || value === undefined) return value;

  switch (transform) {
    case 'none':
      return value;

    case 'unix_ms_to_iso':
      return new Date(Number(value)).toISOString();

    case 'unix_s_to_iso':
      return new Date(Number(value) * 1000).toISOString();

    case 'unix_nano_to_iso':
      return new Date(Number(value) / 1_000_000).toISOString();

    case 'duration_to_ms': {
      const str = String(value);
      const match = str.match(/^([\d.]+)(ms|s|m)?$/);
      if (match) {
        const num = parseFloat(match[1]);
        const unit = match[2] || 'ms';
        switch (unit) {
          case 's': return num * 1000;
          case 'm': return num * 60000;
          default: return num;
        }
      }
      return parseFloat(str);
    }

    case 'parse_int':
      return parseInt(String(value), 10);

    case 'parse_float':
      return parseFloat(String(value));

    case 'lowercase':
      return String(value).toLowerCase();

    case 'provider_normalize': {
      const str = String(value).toLowerCase();
      // Normalize common provider variations
      if (str.includes('openai')) return 'openai';
      if (str.includes('anthropic')) return 'anthropic';
      if (str.includes('google')) return 'google';
      if (str.includes('azure')) return 'azure_openai';
      if (str.includes('bedrock')) return 'bedrock';
      if (str.includes('together')) return 'together';
      if (str.includes('groq')) return 'groq';
      return str;
    }

    default:
      return value;
  }
}

/**
 * Extract a value from an object using a simple path.
 * Supports basic dot notation and array access.
 */
function extractValue(obj: unknown, path: string): unknown {
  if (path.startsWith('$.')) {
    path = path.slice(2);
  }

  const parts = path.split(/\.|\[(\d+)\]/).filter(Boolean);
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;

    if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Extract InferenceEvents from normalized data using field mappings.
 */
export function extractEvents(
  content: string,
  normalization: NormalizationResult,
): { events: InferenceEvent[]; errors: string[] } {
  const events: InferenceEvent[] = [];
  const errors: string[] = [];

  // Parse content based on format type
  let records: unknown[];

  try {
    const formatType = normalization.detection.format_type;

    if (formatType === 'jsonl') {
      records = content.trim().split('\n').map(line => JSON.parse(line));
    } else if (formatType === 'json_array') {
      records = JSON.parse(content);
    } else if (formatType === 'csv' || formatType === 'tsv') {
      const delimiter = formatType === 'csv' ? ',' : '\t';
      const lines = content.trim().split('\n');
      const headers = lines[0].split(delimiter).map(h => h.trim());
      records = lines.slice(1).map(line => {
        const values = line.split(delimiter);
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => { obj[h] = values[i]?.trim() || ''; });
        return obj;
      });
    } else {
      // For complex formats (OTEL, Jaeger, etc.), parse and flatten
      const data = JSON.parse(content);
      records = flattenComplexFormat(data, normalization.detection.format_type);
    }
  } catch (error) {
    errors.push(`Failed to parse content: ${error instanceof Error ? error.message : String(error)}`);
    return { events, errors };
  }

  // Extract events using mappings
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const event: Partial<InferenceEvent> = {};

    for (const mapping of normalization.mappings) {
      try {
        let value: unknown;

        if (mapping.extraction_type === 'computed') {
          // Handle computed fields (e.g., latency = end - start)
          value = computeValue(record as Record<string, unknown>, mapping.source_path);
        } else if (mapping.extraction_type === 'constant') {
          value = mapping.source_path;
        } else {
          value = extractValue(record, mapping.source_path);
        }

        if (value !== undefined && value !== null) {
          const transformed = applyTransform(value, mapping.transform);
          (event as Record<string, unknown>)[mapping.target] = transformed;
        }
      } catch (error) {
        // Skip this field for this record
      }
    }

    // Validate required fields
    const missingFields = REQUIRED_FIELDS.filter(f => !(f in event));
    if (missingFields.length === 0) {
      events.push(event as InferenceEvent);
    } else {
      errors.push(`Record ${i + 1}: Missing required fields: ${missingFields.join(', ')}`);
    }
  }

  return { events, errors };
}

/**
 * Flatten complex nested formats (OTEL, Jaeger, Zipkin) into individual records.
 */
function flattenComplexFormat(data: unknown, formatType: FormatType): unknown[] {
  if (formatType === 'otel') {
    return flattenOTEL(data);
  } else if (formatType === 'jaeger') {
    return flattenJaeger(data);
  } else if (formatType === 'zipkin') {
    // Zipkin is already an array of spans
    return Array.isArray(data) ? data : [];
  }

  // For unknown formats, try to handle arrays or wrap single object
  if (Array.isArray(data)) return data;
  return [data];
}

/**
 * Flatten OTEL traces into individual spans.
 */
function flattenOTEL(data: unknown): unknown[] {
  const spans: unknown[] = [];
  const otelData = data as {
    resourceSpans?: Array<{
      scopeSpans?: Array<{
        spans?: unknown[];
      }>;
    }>;
  };

  for (const resourceSpan of otelData.resourceSpans || []) {
    for (const scopeSpan of resourceSpan.scopeSpans || []) {
      for (const span of scopeSpan.spans || []) {
        spans.push(span);
      }
    }
  }

  return spans;
}

/**
 * Flatten Jaeger traces into individual spans.
 */
function flattenJaeger(data: unknown): unknown[] {
  const spans: unknown[] = [];
  const jaegerData = data as {
    data?: Array<{
      spans?: unknown[];
    }>;
  };

  for (const trace of jaegerData.data || []) {
    for (const span of trace.spans || []) {
      spans.push(span);
    }
  }

  return spans;
}

/**
 * Compute a derived value from an expression.
 */
function computeValue(record: Record<string, unknown>, expression: string): number | undefined {
  // Simple expression parser for common patterns
  // e.g., "(endTimeUnixNano - startTimeUnixNano) / 1000000"

  const match = expression.match(/\((\w+)\s*-\s*(\w+)\)\s*\/\s*(\d+)/);
  if (match) {
    const [, endField, startField, divisor] = match;
    const endValue = Number(record[endField]);
    const startValue = Number(record[startField]);

    if (!isNaN(endValue) && !isNaN(startValue)) {
      return (endValue - startValue) / Number(divisor);
    }
  }

  // Try direct field access
  const fieldMatch = expression.match(/^\$\.(\w+)$/);
  if (fieldMatch) {
    return Number(record[fieldMatch[1]]);
  }

  return undefined;
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Main entry point: Detect format and normalize runtime events.
 *
 * This function implements the complete normalization pipeline:
 * 1. Detect format type from content
 * 2. For direct-parse formats (JSONL, JSON array), parse directly
 * 3. Apply predefined mappings for known complex formats
 * 4. Use agent for unknown formats (if API key available)
 */
export async function normalizeRuntimeEvents(
  content: string,
  options: NormalizationOptions = {},
): Promise<{
  events: InferenceEvent[];
  normalization: NormalizationResult;
  errors: string[];
}> {
  // Step 1: Detect format
  const detection = detectFormat(content, options.format_hint?.toString());

  // Override with user hint if provided
  if (options.format_hint) {
    detection.format_type = options.format_hint;
    detection.evidence = `User-specified format: ${options.format_hint}`;
  }

  // Step 2: For direct-parse formats, parse directly without field mappings
  if (detection.format_type === 'jsonl' || detection.format_type === 'json_array') {
    const events: InferenceEvent[] = [];
    const errors: string[] = [];

    try {
      if (detection.format_type === 'jsonl') {
        // JSONL: one JSON object per line
        const lines = content.trim().split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          try {
            const data = JSON.parse(line);
            events.push(validateAndConvertEvent(data, i + 1));
          } catch (e) {
            errors.push(`Line ${i + 1}: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
      } else {
        // JSON array
        const data = JSON.parse(content);
        if (Array.isArray(data)) {
          for (let i = 0; i < data.length; i++) {
            try {
              events.push(validateAndConvertEvent(data[i], i + 1));
            } catch (e) {
              errors.push(`Record ${i + 1}: ${e instanceof Error ? e.message : String(e)}`);
            }
          }
        }
      }
    } catch (e) {
      errors.push(`Parse error: ${e instanceof Error ? e.message : String(e)}`);
    }

    const normalization: NormalizationResult = {
      detection,
      mappings: [],
      unmapped_fields: [],
      warnings: errors.length > 0 ? [`${errors.length} records had parsing issues`] : [],
      audit: {
        normalized_at: new Date().toISOString(),
        agent_used: false,
        codebase_context_used: false,
      },
    };

    return { events, normalization, errors };
  }

  // Step 3: Get or generate field mappings for complex formats
  let normalization: NormalizationResult;

  if (!detection.requires_agent || detection.confidence >= 0.95) {
    // Use predefined mappings for known complex formats
    const predefinedMappings = PREDEFINED_MAPPINGS[detection.format_type];
    normalization = {
      detection,
      mappings: predefinedMappings || [],
      unmapped_fields: [],
      warnings: [],
      audit: {
        normalized_at: new Date().toISOString(),
        agent_used: false,
        codebase_context_used: false,
      },
    };
  } else {
    // Agent normalization required
    normalization = await normalizeWithAgent(content, detection, options);
  }

  // Step 4: Extract events using field mappings
  const { events, errors } = extractEvents(content, normalization);

  // Add extraction errors to warnings
  if (errors.length > 0 && errors.length <= 5) {
    normalization.warnings.push(...errors);
  } else if (errors.length > 5) {
    normalization.warnings.push(`${errors.length} records failed extraction (first: ${errors[0]})`);
  }

  return { events, normalization, errors };
}

/**
 * Validate and convert raw data to InferenceEvent.
 * Used for direct-parse formats (JSONL, JSON array).
 */
function validateAndConvertEvent(data: unknown, recordNum: number): InferenceEvent {
  if (typeof data !== 'object' || data === null) {
    throw new Error(`Expected object, got ${typeof data}`);
  }

  const obj = data as Record<string, unknown>;
  const errors: string[] = [];

  // Required fields
  if (typeof obj.id !== 'string') errors.push("Missing 'id'");
  if (typeof obj.ts !== 'string') errors.push("Missing 'ts'");
  if (typeof obj.provider !== 'string') errors.push("Missing 'provider'");
  if (typeof obj.model !== 'string') errors.push("Missing 'model'");
  if (typeof obj.input_tokens !== 'number') errors.push("Missing 'input_tokens'");
  if (typeof obj.output_tokens !== 'number') errors.push("Missing 'output_tokens'");
  if (typeof obj.latency_ms !== 'number') errors.push("Missing 'latency_ms'");

  if (errors.length > 0) {
    throw new Error(`Record ${recordNum}: ${errors.join(', ')}`);
  }

  return {
    id: obj.id as string,
    ts: obj.ts as string,
    provider: obj.provider as InferenceEvent['provider'],
    model: obj.model as string,
    input_tokens: obj.input_tokens as number,
    output_tokens: obj.output_tokens as number,
    latency_ms: obj.latency_ms as number,
    // Optional fields
    intent: typeof obj.intent === 'string' ? obj.intent : undefined,
    callsite_id: typeof obj.callsite_id === 'string' ? obj.callsite_id : undefined,
    streaming: typeof obj.streaming === 'boolean' ? obj.streaming : undefined,
    ttft_ms: typeof obj.ttft_ms === 'number' ? obj.ttft_ms : undefined,
    batch_size: typeof obj.batch_size === 'number' ? obj.batch_size : undefined,
    batch_id: typeof obj.batch_id === 'string' ? obj.batch_id : undefined,
    cached: typeof obj.cached === 'boolean' ? obj.cached : undefined,
    retry_count: typeof obj.retry_count === 'number' ? obj.retry_count : undefined,
    fallback_used: typeof obj.fallback_used === 'boolean' ? obj.fallback_used : undefined,
    original_model: typeof obj.original_model === 'string' ? obj.original_model : undefined,
  };
}

/**
 * Get predefined mappings for a known format type.
 */
export function getPredefinedMappings(formatType: FormatType): FieldMapping[] | undefined {
  return PREDEFINED_MAPPINGS[formatType];
}

/**
 * Check if a format type requires agent normalization.
 */
export function requiresAgentNormalization(formatType: FormatType): boolean {
  return !['jsonl', 'json_array', 'csv', 'tsv'].includes(formatType);
}

// =============================================================================
// FIELD MAPPING VALIDATION
// =============================================================================

export interface MappingValidationResult {
  valid: boolean;
  mappings: Array<{ target: string; source: string }>;
  errors: string[];
  warnings: string[];
}

/**
 * Parse and validate a field mapping string.
 * Format: "target=source,target2=source2,..."
 * Example: "model=llm_model,latency_ms=duration_ms"
 */
export function validateFieldMappings(mappingStr: string | undefined): MappingValidationResult {
  const result: MappingValidationResult = {
    valid: true,
    mappings: [],
    errors: [],
    warnings: [],
  };

  if (!mappingStr || mappingStr.trim() === '') {
    return result; // Empty mapping is valid (no custom mappings)
  }

  // Parse mapping string
  const pairs = mappingStr.split(',').map(p => p.trim()).filter(p => p);

  for (const pair of pairs) {
    const parts = pair.split('=');
    if (parts.length !== 2) {
      result.errors.push(`Invalid mapping format: "${pair}" (expected target=source)`);
      result.valid = false;
      continue;
    }

    const [target, source] = parts.map(p => p.trim());

    if (!target || !source) {
      result.errors.push(`Empty target or source in mapping: "${pair}"`);
      result.valid = false;
      continue;
    }

    // Validate target is a known InferenceEvent field
    const validTargets = [
      'id', 'ts', 'provider', 'model', 'input_tokens', 'output_tokens',
      'latency_ms', 'callsite_id', 'streaming', 'cached', 'batch_id',
      'batch_size', 'retry_count', 'fallback_used', 'error_code', 'error_message'
    ];

    if (!validTargets.includes(target)) {
      result.warnings.push(`Unknown target field "${target}" - may not be used`);
    }

    result.mappings.push({ target, source });
  }

  // Check for required fields coverage
  const mappedTargets = new Set(result.mappings.map(m => m.target));
  const criticalFields = ['model', 'latency_ms'];
  for (const field of criticalFields) {
    if (!mappedTargets.has(field)) {
      result.warnings.push(`Consider mapping "${field}" for better analysis`);
    }
  }

  return result;
}

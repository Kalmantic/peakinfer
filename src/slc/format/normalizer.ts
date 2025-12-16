/**
 * Format Normalizer - PeakInfer TDD v1.3
 * 
 * Main orchestrator for the format normalization pipeline.
 * Detects format, applies appropriate parser/adapter, and normalizes to InferenceEvent[].
 * 
 * Uses agent-based normalization when heuristic detection fails.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { InferenceEvent } from '../../types/events.js';
import type {
  FormatType,
  FormatDetection,
  FieldMapping,
  ParseResult,
  NormalizationResult,
} from './schemas.js';
import {
  DIRECT_PARSE_FORMATS,
  CONFIDENCE_THRESHOLDS,
} from './schemas.js';
import { detectFormat } from './detector.js';
import { parseJsonl } from './parsers/jsonl.js';
import { parseJsonArray } from './parsers/json-array.js';
import { parseCsv } from './parsers/csv.js';
import {
  parseOtelExport,
  isOtelFormat,
  parseJaegerExport,
  isJaegerFormat,
  parseLangSmithExport,
  isLangSmithFormat,
  parseHeliconeExport,
  isHeliconeFormat,
  parseZipkinExport,
  isZipkinFormat,
  parseWandbExport,
  isWandbFormat,
  parseLiteLLMExport,
  isLiteLLMFormat,
  parsePortkeyExport,
  isPortkeyFormat,
} from './adapters/index.js';
import {
  detectFormatWithAgent,
  mapFieldsWithAgent,
  normalizeWithAgent,
  extractLoggingContext,
} from './agent-normalizer.js';

// =============================================================================
// CONFIGURATION
// =============================================================================

export interface NormalizerOptions {
  /** Manually specified format (overrides detection) */
  format?: FormatType;
  
  /** Custom field mappings */
  mappings?: FieldMapping[];
  
  /** Allow low-confidence normalizations */
  lenient?: boolean;
  
  /** Skip records that fail to parse */
  skipErrors?: boolean;
  
  /** Maximum records to parse (0 = unlimited) */
  maxRecords?: number;
  
  /** Codebase context for improved mapping (combined mode) */
  codebaseContext?: {
    loggingPatterns: string[];
    variableNames: string[];
  };
  
  /** Progress callback */
  onProgress?: (message: string) => void;
}

// =============================================================================
// MAIN NORMALIZER
// =============================================================================

/**
 * Parse a runtime events file into normalized InferenceEvents.
 * 
 * This is the main entry point for the format normalization pipeline.
 */
export async function normalizeEventsFile(
  filePath: string,
  options: NormalizerOptions = {}
): Promise<ParseResult> {
  const absolutePath = path.resolve(filePath);
  
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }
  
  const { lenient = false, skipErrors = true, maxRecords = 0, onProgress } = options;
  
  // Step 1: Detect format (or use override)
  onProgress?.('Detecting format...');
  
  let format: FormatDetection;
  
  if (options.format) {
    // Use manually specified format
    format = {
      detected: options.format,
      confidence: 1.0,
      evidence: ['Format manually specified'],
      requiresAgent: !DIRECT_PARSE_FORMATS.includes(options.format),
      sampleLines: 0,
    };
  } else {
    // Auto-detect format
    format = await detectFormat(absolutePath);
  }
  
  onProgress?.(`Format detected: ${format.detected} (confidence: ${(format.confidence * 100).toFixed(0)}%)`);
  
  // Check confidence threshold
  if (format.confidence < CONFIDENCE_THRESHOLDS.MINIMUM) {
    throw new Error(
      `Could not determine format (confidence: ${(format.confidence * 100).toFixed(0)}%). ` +
      `Use --format to specify manually.`
    );
  }
  
  if (format.confidence < CONFIDENCE_THRESHOLDS.LENIENT_REQUIRED && !lenient) {
    throw new Error(
      `Low confidence format detection (${(format.confidence * 100).toFixed(0)}%). ` +
      `Use --lenient to proceed anyway, or --format to specify manually.`
    );
  }
  
  // Step 2: Parse using appropriate method
  onProgress?.('Parsing events...');
  
  let result: ParseResult;
  
  switch (format.detected) {
    case 'jsonl':
      result = await parseJsonl(absolutePath, {
        mappings: options.mappings,
        lenient,
        skipErrors,
        maxLines: maxRecords,
      });
      break;
      
    case 'json_array':
      result = await parseJsonArray(absolutePath, {
        mappings: options.mappings,
        lenient,
        skipErrors,
        maxRecords,
      });
      break;
      
    case 'csv':
      result = await parseCsv(absolutePath, {
        delimiter: ',',
        mappings: options.mappings,
        lenient,
        skipErrors,
        maxRows: maxRecords,
      });
      break;
      
    case 'tsv':
      result = await parseCsv(absolutePath, {
        delimiter: '\t',
        mappings: options.mappings,
        lenient,
        skipErrors,
        maxRows: maxRecords,
      });
      break;
      
    case 'otel':
    case 'jaeger':
    case 'zipkin':
    case 'langsmith':
    case 'helicone':
    case 'wandb':
    case 'litellm':
    case 'portkey':
      result = await parseObservabilityFormat(absolutePath, format.detected, options);
      break;
      
    case 'custom':
    case 'unknown':
    default:
      // For custom/unknown formats, try JSON-based parsing with lenient settings
      result = await parseUnknownFormat(absolutePath, options);
      break;
  }
  
  // Update format info in result
  result.format = format;
  
  onProgress?.(`Parsed ${result.stats.parsedRecords} events`);
  
  // Warn if low confidence
  if (format.confidence < CONFIDENCE_THRESHOLDS.NO_WARNING) {
    const warning = `Format detection confidence: ${(format.confidence * 100).toFixed(0)}% - results may be incomplete`;
    result.stats.errors.unshift(warning);
  }
  
  return result;
}

// =============================================================================
// OBSERVABILITY FORMAT PARSING
// =============================================================================

/**
 * Parse observability system exports (OTEL, Jaeger, etc.)
 */
async function parseObservabilityFormat(
  filePath: string,
  formatType: FormatType,
  options: NormalizerOptions
): Promise<ParseResult> {
  const content = fs.readFileSync(filePath, 'utf-8');
  let data: unknown;
  
  try {
    data = JSON.parse(content);
  } catch (e) {
    // Try JSONL
    const lines = content.trim().split('\n');
    data = lines.map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean);
  }
  
  let events: InferenceEvent[] = [];
  const errors: string[] = [];
  
  try {
    switch (formatType) {
      case 'otel':
        if (Array.isArray(data)) {
          for (const item of data) {
            events.push(...parseOtelExport(item));
          }
        } else {
          events = parseOtelExport(data);
        }
        break;
        
      case 'jaeger':
        if (Array.isArray(data)) {
          for (const item of data) {
            events.push(...parseJaegerExport(item));
          }
        } else {
          events = parseJaegerExport(data);
        }
        break;
        
      case 'zipkin':
        events = parseZipkinExport(data);
        break;
        
      case 'langsmith':
        events = parseLangSmithExport(data);
        break;
        
      case 'helicone':
        events = parseHeliconeExport(data);
        break;
        
      case 'wandb':
        events = parseWandbExport(data);
        break;
        
      case 'litellm':
        events = parseLiteLLMExport(data);
        break;
        
      case 'portkey':
        events = parsePortkeyExport(data);
        break;
        
      default:
        errors.push(`Unknown format: ${formatType}`);
    }
  } catch (e) {
    errors.push(`Parse error: ${e instanceof Error ? e.message : 'Unknown error'}`);
  }
  
  const totalRecords = events.length || 1;
  
  return {
    events,
    format: {
      detected: formatType,
      confidence: events.length > 0 ? 0.9 : 0.5,
      evidence: [`Parsed using ${formatType} adapter`, `Found ${events.length} LLM events`],
      requiresAgent: true,
      sampleLines: 0,
    },
    stats: {
      totalRecords,
      parsedRecords: events.length,
      failedRecords: errors.length > 0 ? 1 : 0,
      errors,
    },
    confidence: events.length > 0 ? 0.9 : 0.5,
  };
}

// =============================================================================
// UNKNOWN FORMAT PARSING
// =============================================================================

/**
 * Attempt to parse unknown format
 */
async function parseUnknownFormat(
  filePath: string,
  options: NormalizerOptions
): Promise<ParseResult> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  
  // Try JSONL first
  try {
    const firstLine = lines[0].trim();
    JSON.parse(firstLine);
    
    // Looks like JSONL
    return await parseJsonl(filePath, {
      lenient: true,
      skipErrors: true,
      maxLines: options.maxRecords || 0,
    });
  } catch {
    // Not JSONL
  }
  
  // Try JSON array
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      return await parseJsonArray(filePath, {
        lenient: true,
        skipErrors: true,
        maxRecords: options.maxRecords || 0,
      });
    }
    
    // Single JSON object - check for known formats
    if (isOtelFormat(parsed)) {
      return parseObservabilityFormat(filePath, 'otel', options);
    }
    if (isJaegerFormat(parsed)) {
      return parseObservabilityFormat(filePath, 'jaeger', options);
    }
    if (isLangSmithFormat(parsed)) {
      return parseObservabilityFormat(filePath, 'langsmith', options);
    }
    if (isHeliconeFormat(parsed)) {
      return parseObservabilityFormat(filePath, 'helicone', options);
    }
  } catch {
    // Not JSON
  }
  
  // Try CSV
  if (lines.length >= 2) {
    const commaCount = (lines[0].match(/,/g) || []).length;
    const tabCount = (lines[0].match(/\t/g) || []).length;
    
    if (commaCount >= 2) {
      return await parseCsv(filePath, {
        delimiter: ',',
        lenient: true,
        skipErrors: true,
        maxRows: options.maxRecords || 0,
      });
    }
    
    if (tabCount >= 2) {
      return await parseCsv(filePath, {
        delimiter: '\t',
        lenient: true,
        skipErrors: true,
        maxRows: options.maxRecords || 0,
      });
    }
  }
  
  // Fallback to agent-based normalization (TDD v1.3 Section 9.3)
  // Only attempt if API key is available
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey && options.lenient !== false) {
    try {
      const agentResult = await normalizeWithAgent(
        filePath,
        options.codebaseContext,
        { minConfidenceThreshold: options.lenient ? 0.5 : 0.7 }
      );
      
      if (agentResult.overallConfidence >= 0.5) {
        // Agent successfully detected format - apply mappings
        const extractedEvents = await applyAgentMappings(
          filePath,
          agentResult.format.detected,
          agentResult.mappings,
          options
        );
        
        return {
          events: extractedEvents,
          format: {
            ...agentResult.format,
            evidence: [
              ...agentResult.format.evidence,
              'Agent-based normalization applied',
            ],
          },
          stats: {
            totalRecords: extractedEvents.length,
            parsedRecords: extractedEvents.length,
            failedRecords: 0,
            errors: agentResult.validation.suggestions || [],
          },
          confidence: agentResult.overallConfidence,
        };
      }
    } catch (agentError) {
      // Agent failed - fall through to give up
      console.warn('Agent normalization failed:', agentError instanceof Error ? agentError.message : 'Unknown error');
    }
  }
  
  // Give up - heuristics and agent both failed
  return {
    events: [],
    format: {
      detected: 'unknown',
      confidence: 0.1,
      evidence: ['Could not determine format', 'Manual specification required'],
      requiresAgent: true,
      sampleLines: lines.length,
    },
    stats: {
      totalRecords: 0,
      parsedRecords: 0,
      failedRecords: 0,
      errors: ['Could not parse file - unknown format. Try --format to specify manually.'],
    },
    confidence: 0.1,
  };
}

// =============================================================================
// AGENT MAPPING APPLICATION
// =============================================================================

/**
 * Apply agent-generated field mappings to extract InferenceEvents.
 * Handles JSONPath, column, regex, and computed extraction types.
 */
async function applyAgentMappings(
  filePath: string,
  formatType: FormatType,
  mappings: FieldMapping[],
  options: NormalizerOptions
): Promise<InferenceEvent[]> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const events: InferenceEvent[] = [];
  
  // Parse the file based on detected structure
  let records: Record<string, unknown>[] = [];
  
  try {
    // Try to parse as JSON
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      records = parsed;
    } else if (typeof parsed === 'object') {
      // Single object - wrap in array
      records = [parsed];
    }
  } catch {
    // Try JSONL
    const lines = content.trim().split('\n');
    for (const line of lines) {
      try {
        const obj = JSON.parse(line.trim());
        if (typeof obj === 'object' && obj !== null) {
          records.push(obj);
        }
      } catch {
        // Skip invalid lines
      }
    }
  }
  
  // Apply mappings to each record
  for (const record of records) {
    const event = applyMappingsToRecord(record, mappings);
    if (event) {
      events.push(event);
    }
    
    // Respect maxRecords limit
    if (options.maxRecords && events.length >= options.maxRecords) {
      break;
    }
  }
  
  return events;
}

/**
 * Apply field mappings to a single record to extract an InferenceEvent.
 */
function applyMappingsToRecord(
  record: Record<string, unknown>,
  mappings: FieldMapping[]
): InferenceEvent | null {
  const event: Partial<InferenceEvent> = {};
  
  for (const mapping of mappings) {
    const value = extractFieldValue(record, mapping);
    if (value !== undefined) {
      (event as any)[mapping.targetField] = value;
    }
  }
  
  // Ensure required fields have defaults
  if (!event.id) event.id = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  if (!event.ts) event.ts = new Date().toISOString();
  if (!event.provider) event.provider = 'unknown';
  if (!event.model) event.model = 'unknown';
  if (event.input_tokens === undefined) event.input_tokens = 0;
  if (event.output_tokens === undefined) event.output_tokens = 0;
  if (event.latency_ms === undefined) event.latency_ms = 0;
  
  return event as InferenceEvent;
}

/**
 * Extract a field value from a record using the mapping's extraction strategy.
 */
function extractFieldValue(
  record: Record<string, unknown>,
  mapping: FieldMapping
): unknown {
  const { sourceExpression, extractionType } = mapping;
  
  switch (extractionType) {
    case 'jsonpath':
      // Simple dot-notation path extraction (simplified JSONPath)
      return extractByPath(record, sourceExpression);
      
    case 'column':
      // Direct column/field name access
      return record[sourceExpression];
      
    case 'regex':
      // Apply regex to string representation
      const str = JSON.stringify(record);
      const match = str.match(new RegExp(sourceExpression));
      return match ? match[1] || match[0] : undefined;
      
    case 'computed':
      // Handle common computed expressions
      return computeFieldValue(record, sourceExpression);
      
    default:
      // Default: try direct access
      return record[sourceExpression];
  }
}

/**
 * Extract value using dot-notation path (simplified JSONPath).
 */
function extractByPath(obj: unknown, path: string): unknown {
  // Handle JSONPath-like expressions: $.field.subfield or field.subfield
  const cleanPath = path.replace(/^\$\.?/, '');
  const parts = cleanPath.split('.');
  
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    
    // Handle array access like [0] or [*]
    const arrayMatch = part.match(/^(\w+)\[(\d+|\*)\]$/);
    if (arrayMatch) {
      const [, key, index] = arrayMatch;
      current = (current as Record<string, unknown>)[key];
      if (Array.isArray(current)) {
        if (index === '*') {
          // Return first element for simplicity
          current = current[0];
        } else {
          current = current[parseInt(index, 10)];
        }
      }
    } else {
      current = (current as Record<string, unknown>)[part];
    }
  }
  
  return current;
}

/**
 * Compute field values for common expressions.
 */
function computeFieldValue(record: Record<string, unknown>, expression: string): unknown {
  // Handle common patterns
  if (expression.includes('-')) {
    // Subtraction: "endTime - startTime"
    const match = expression.match(/(\w+)\s*-\s*(\w+)/);
    if (match) {
      const [, field1, field2] = match;
      const val1 = Number(record[field1] || 0);
      const val2 = Number(record[field2] || 0);
      return val1 - val2;
    }
  }
  
  if (expression.includes('/')) {
    // Division: "value / 1000000" (e.g., nanoseconds to milliseconds)
    const match = expression.match(/(\w+)\s*\/\s*(\d+)/);
    if (match) {
      const [, field, divisor] = match;
      return Number(record[field] || 0) / parseInt(divisor, 10);
    }
  }
  
  return undefined;
}

// =============================================================================
// CODEBASE-AWARE NORMALIZATION (TDD v1.3 Section 9.3)
// =============================================================================

/** Result with codebase context info */
export interface CodebaseAwareParseResult extends ParseResult {
  codebaseContext?: {
    loggingPatterns: string[];
    variableNames: string[];
    confidence: number;
  };
}

/**
 * Enhance normalization using static analysis callsites.
 * Used in combined mode (analyze ./src --events logs.jsonl)
 * 
 * TDD v1.3 Section 9.3: Codebase-aware normalization
 * Uses static analysis to extract logging patterns which improve field mapping.
 */
export async function normalizeWithCodebaseContext(
  filePath: string,
  callsites: Array<{ provider: string | null; model: string | null; file: string; line: number }>,
  options: Omit<NormalizerOptions, 'codebaseContext'> = {}
): Promise<CodebaseAwareParseResult> {
  // Extract logging context from callsites
  const loggingPatterns: string[] = [];
  const variableNames: string[] = [];
  
  // Build context from callsites
  for (const cs of callsites) {
    if (cs.provider) loggingPatterns.push(`provider:${cs.provider}`);
    if (cs.model) loggingPatterns.push(`model:${cs.model}`);
  }
  
  // Deduplicate
  const uniquePatterns = [...new Set(loggingPatterns)];
  const uniqueVars = [...new Set(variableNames)];
  
  const codebaseContext = {
    loggingPatterns: uniquePatterns,
    variableNames: uniqueVars,
  };
  
  // Do standard normalization with context
  const result = await normalizeEventsFile(filePath, {
    ...options,
    codebaseContext,
  });
  
  // Calculate context confidence based on how much context we have
  const contextConfidence = Math.min(1.0, 
    (uniquePatterns.length * 0.1) + (uniqueVars.length * 0.05)
  );
  
  // Add codebase context info to result
  const codebaseAwareResult: CodebaseAwareParseResult = {
    ...result,
    codebaseContext: {
      loggingPatterns: uniquePatterns,
      variableNames: uniqueVars,
      confidence: contextConfidence,
    },
  };
  
  // Add codebase context to format detection evidence
  if (uniquePatterns.length > 0 || uniqueVars.length > 0) {
    codebaseAwareResult.format.evidence.push(
      `Codebase context: ${uniquePatterns.length} logging patterns, ` +
      `${uniqueVars.length} variable names`
    );
    
    // Boost confidence with codebase context
    codebaseAwareResult.confidence = Math.min(1.0, result.confidence + (contextConfidence * 0.2));
    codebaseAwareResult.format.confidence = Math.min(1.0, result.format.confidence + (contextConfidence * 0.2));
  }
  
  return codebaseAwareResult;
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  detectFormat,
  parseJsonl,
  parseJsonArray,
  parseCsv,
};

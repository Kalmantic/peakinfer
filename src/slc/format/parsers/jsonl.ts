/**
 * JSONL Parser - PeakInfer TDD v1.3
 * 
 * Parses newline-delimited JSON (JSONL/NDJSON) files.
 * Supports both exact schema match and field alias resolution.
 */

import * as fs from 'fs';
import * as readline from 'readline';
import type { InferenceEvent } from '../../../types/events.js';
import type { ParseResult, FieldMapping } from '../schemas.js';
import { FIELD_ALIASES, REQUIRED_FIELDS } from '../schemas.js';

// =============================================================================
// TYPES
// =============================================================================

export interface JsonlParserOptions {
  /** Custom field mappings (overrides auto-detection) */
  mappings?: FieldMapping[];
  
  /** Allow missing required fields */
  lenient?: boolean;
  
  /** Skip lines that fail to parse */
  skipErrors?: boolean;
  
  /** Maximum lines to parse (0 = unlimited) */
  maxLines?: number;
}

// =============================================================================
// MAIN PARSER
// =============================================================================

/**
 * Parse a JSONL file into InferenceEvents
 */
export async function parseJsonl(
  filePath: string,
  options: JsonlParserOptions = {}
): Promise<ParseResult> {
  const { lenient = false, skipErrors = true, maxLines = 0 } = options;
  
  const events: InferenceEvent[] = [];
  const errors: string[] = [];
  let totalRecords = 0;
  let parsedRecords = 0;
  let failedRecords = 0;
  
  // Detect field mappings from first few lines if not provided
  const mappings = options.mappings || await detectFieldMappings(filePath);
  
  // Create readline interface for streaming parse
  const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });
  
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    totalRecords++;
    
    if (maxLines > 0 && totalRecords > maxLines) {
      break;
    }
    
    try {
      const parsed = JSON.parse(trimmed);
      
      if (typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Expected JSON object');
      }
      
      const event = mapToInferenceEvent(parsed, mappings, lenient);
      
      if (event) {
        events.push(event);
        parsedRecords++;
      } else {
        failedRecords++;
        if (!skipErrors) {
          errors.push(`Line ${totalRecords}: Failed to map to InferenceEvent`);
        }
      }
    } catch (e) {
      failedRecords++;
      const errorMsg = e instanceof Error ? e.message : 'Unknown error';
      
      if (!skipErrors) {
        errors.push(`Line ${totalRecords}: ${errorMsg}`);
      }
      
      // If we're not lenient and have critical errors, track them
      if (!lenient && failedRecords > 10 && parsedRecords === 0) {
        throw new Error(`Failed to parse JSONL: First 10 lines invalid. Last error: ${errorMsg}`);
      }
    }
  }
  
  // Calculate confidence based on success rate
  const successRate = totalRecords > 0 ? parsedRecords / totalRecords : 0;
  const confidence = successRate >= 0.95 ? 1.0 : successRate >= 0.8 ? 0.9 : successRate >= 0.5 ? 0.7 : 0.5;
  
  return {
    events,
    format: {
      detected: 'jsonl',
      confidence,
      evidence: [
        `Parsed ${parsedRecords}/${totalRecords} records`,
        mappings.length > 0 ? `Applied ${mappings.length} field mappings` : 'Direct schema match',
      ],
      requiresAgent: false,
      sampleLines: Math.min(totalRecords, 50),
    },
    mappings,
    stats: {
      totalRecords,
      parsedRecords,
      failedRecords,
      errors: errors.slice(0, 10), // Cap errors
    },
    confidence,
  };
}

// =============================================================================
// FIELD MAPPING DETECTION
// =============================================================================

/**
 * Detect field mappings by analyzing first few lines
 */
async function detectFieldMappings(filePath: string): Promise<FieldMapping[]> {
  const mappings: FieldMapping[] = [];
  const sampleLines: string[] = [];
  
  // Read first 5 lines
  const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });
  
  let count = 0;
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    sampleLines.push(trimmed);
    count++;
    
    if (count >= 5) break;
  }
  
  rl.close();
  fileStream.destroy();
  
  if (sampleLines.length === 0) return mappings;
  
  // Parse first line to get field names
  try {
    const sample = JSON.parse(sampleLines[0]);
    const sourceFields = Object.keys(sample);
    
    // Map each required/desired field
    for (const [targetField, aliases] of Object.entries(FIELD_ALIASES)) {
      const matchingSource = sourceFields.find(sf => 
        aliases.some(alias => sf.toLowerCase() === alias.toLowerCase())
      );
      
      if (matchingSource) {
        mappings.push({
          targetField: targetField as keyof InferenceEvent,
          sourceExpression: matchingSource,
          extractionType: 'jsonpath',
          confidence: 1.0,
          evidence: `Matched alias: ${matchingSource}`,
        });
      }
    }
  } catch {
    // Can't detect mappings
  }
  
  return mappings;
}

// =============================================================================
// EVENT MAPPING
// =============================================================================

/**
 * Map a parsed JSON object to an InferenceEvent
 */
function mapToInferenceEvent(
  obj: Record<string, unknown>,
  mappings: FieldMapping[],
  lenient: boolean
): InferenceEvent | null {
  const event: Partial<InferenceEvent> = {};
  
  // Apply mappings if we have them
  if (mappings.length > 0) {
    for (const mapping of mappings) {
      const value = extractValue(obj, mapping);
      if (value !== undefined) {
        (event as Record<string, unknown>)[mapping.targetField] = value;
      } else if (mapping.defaultValue !== undefined) {
        (event as Record<string, unknown>)[mapping.targetField] = mapping.defaultValue;
      }
    }
  } else {
    // Direct mapping - try field names and aliases
    for (const [targetField, aliases] of Object.entries(FIELD_ALIASES)) {
      for (const alias of aliases) {
        if (alias in obj) {
          (event as Record<string, unknown>)[targetField] = obj[alias];
          break;
        }
      }
    }
    
    // Copy metadata directly
    if ('metadata' in obj) {
      event.metadata = obj.metadata as Record<string, unknown>;
    }
  }
  
  // Validate required fields
  if (!lenient) {
    const missing = REQUIRED_FIELDS.filter(f => !(f in event) || event[f as keyof InferenceEvent] === null);
    if (missing.length > 0) {
      return null;
    }
  }
  
  // Generate ID if missing
  if (!event.id) {
    event.id = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  // Ensure timestamp
  if (!event.ts) {
    event.ts = new Date().toISOString();
  }
  
  // Type coercion for numeric fields
  if (event.input_tokens !== undefined) {
    event.input_tokens = Number(event.input_tokens) || 0;
  }
  if (event.output_tokens !== undefined) {
    event.output_tokens = Number(event.output_tokens) || 0;
  }
  if (event.latency_ms !== undefined) {
    event.latency_ms = Number(event.latency_ms) || 0;
  }
  if (event.cost_usd !== undefined) {
    event.cost_usd = Number(event.cost_usd) || 0;
  }
  
  return event as InferenceEvent;
}

/**
 * Extract a value from an object using a field mapping
 */
function extractValue(obj: Record<string, unknown>, mapping: FieldMapping): unknown {
  const { sourceExpression, extractionType, transform } = mapping;
  
  let value: unknown;
  
  switch (extractionType) {
    case 'jsonpath':
      // Simple path extraction (supports dot notation)
      value = getNestedValue(obj, sourceExpression);
      break;
      
    case 'column':
      // Direct field name
      value = obj[sourceExpression];
      break;
      
    case 'literal':
      // Literal value
      value = sourceExpression;
      break;
      
    case 'regex':
      // Regex extraction (applied to string values)
      const sourceValue = obj[sourceExpression.split(':')[0]];
      if (typeof sourceValue === 'string') {
        const pattern = sourceExpression.split(':').slice(1).join(':');
        const match = sourceValue.match(new RegExp(pattern));
        value = match ? match[1] || match[0] : undefined;
      }
      break;
      
    case 'computed':
      // Computed values - implement specific transforms
      value = computeValue(obj, sourceExpression, transform);
      break;
  }
  
  return value;
}

/**
 * Get a nested value using dot notation
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  
  return current;
}

/**
 * Compute a value using a transform function
 */
function computeValue(
  obj: Record<string, unknown>,
  expression: string,
  transform?: string
): unknown {
  switch (transform) {
    case 'timestamp_ms_to_iso':
      const ms = obj[expression];
      if (typeof ms === 'number') {
        return new Date(ms).toISOString();
      }
      break;
      
    case 'timestamp_s_to_iso':
      const s = obj[expression];
      if (typeof s === 'number') {
        return new Date(s * 1000).toISOString();
      }
      break;
      
    case 'sum':
      // Sum multiple fields: "field1+field2"
      const fields = expression.split('+');
      return fields.reduce((sum, f) => sum + (Number(obj[f.trim()]) || 0), 0);
      break;
      
    case 'provider_from_model':
      // Infer provider from model name
      const model = String(obj[expression] || '').toLowerCase();
      if (model.includes('gpt') || model.includes('openai')) return 'openai';
      if (model.includes('claude') || model.includes('anthropic')) return 'anthropic';
      if (model.includes('gemini') || model.includes('palm')) return 'google';
      if (model.includes('llama')) return 'meta';
      if (model.includes('mistral')) return 'mistral';
      return 'unknown';
      
    default:
      return obj[expression];
  }
  
  return undefined;
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  detectFieldMappings,
  mapToInferenceEvent,
  extractValue,
};

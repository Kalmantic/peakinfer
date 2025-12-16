/**
 * JSON Array Parser - PeakInfer TDD v1.3
 * 
 * Parses JSON files where the root element is an array of objects.
 */

import * as fs from 'fs';
import type { InferenceEvent } from '../../../types/events.js';
import type { ParseResult, FieldMapping } from '../schemas.js';
import { FIELD_ALIASES, REQUIRED_FIELDS } from '../schemas.js';
import { mapToInferenceEvent, extractValue } from './jsonl.js';

// =============================================================================
// TYPES
// =============================================================================

export interface JsonArrayParserOptions {
  /** Custom field mappings (overrides auto-detection) */
  mappings?: FieldMapping[];
  
  /** Allow missing required fields */
  lenient?: boolean;
  
  /** Skip records that fail to parse */
  skipErrors?: boolean;
  
  /** Maximum records to parse (0 = unlimited) */
  maxRecords?: number;
}

// =============================================================================
// MAIN PARSER
// =============================================================================

/**
 * Parse a JSON array file into InferenceEvents
 */
export async function parseJsonArray(
  filePath: string,
  options: JsonArrayParserOptions = {}
): Promise<ParseResult> {
  const { lenient = false, skipErrors = true, maxRecords = 0 } = options;
  
  const events: InferenceEvent[] = [];
  const errors: string[] = [];
  
  // Read and parse the entire file
  const content = fs.readFileSync(filePath, 'utf-8');
  let parsed: unknown;
  
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    throw new Error(`Invalid JSON: ${e instanceof Error ? e.message : 'Parse error'}`);
  }
  
  // Validate it's an array
  if (!Array.isArray(parsed)) {
    throw new Error('Expected JSON array at root level');
  }
  
  const records = parsed as unknown[];
  const totalRecords = maxRecords > 0 ? Math.min(records.length, maxRecords) : records.length;
  let parsedRecords = 0;
  let failedRecords = 0;
  
  // Detect field mappings from first record if not provided
  const mappings = options.mappings || detectFieldMappingsFromArray(records);
  
  for (let i = 0; i < totalRecords; i++) {
    const record = records[i];
    
    if (typeof record !== 'object' || record === null || Array.isArray(record)) {
      failedRecords++;
      if (!skipErrors) {
        errors.push(`Record ${i}: Expected object`);
      }
      continue;
    }
    
    try {
      const event = mapToInferenceEvent(record as Record<string, unknown>, mappings, lenient);
      
      if (event) {
        events.push(event);
        parsedRecords++;
      } else {
        failedRecords++;
        if (!skipErrors) {
          errors.push(`Record ${i}: Failed to map to InferenceEvent`);
        }
      }
    } catch (e) {
      failedRecords++;
      const errorMsg = e instanceof Error ? e.message : 'Unknown error';
      if (!skipErrors) {
        errors.push(`Record ${i}: ${errorMsg}`);
      }
    }
  }
  
  // Calculate confidence
  const successRate = totalRecords > 0 ? parsedRecords / totalRecords : 0;
  const confidence = successRate >= 0.95 ? 1.0 : successRate >= 0.8 ? 0.9 : successRate >= 0.5 ? 0.7 : 0.5;
  
  return {
    events,
    format: {
      detected: 'json_array',
      confidence,
      evidence: [
        `Parsed ${parsedRecords}/${totalRecords} records from JSON array`,
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
      errors: errors.slice(0, 10),
    },
    confidence,
  };
}

// =============================================================================
// FIELD MAPPING DETECTION
// =============================================================================

/**
 * Detect field mappings from first record in array
 */
function detectFieldMappingsFromArray(records: unknown[]): FieldMapping[] {
  const mappings: FieldMapping[] = [];
  
  if (records.length === 0) return mappings;
  
  const sample = records[0];
  if (typeof sample !== 'object' || sample === null || Array.isArray(sample)) {
    return mappings;
  }
  
  const sourceFields = Object.keys(sample as Record<string, unknown>);
  
  // Map each field using aliases
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
  
  return mappings;
}

// =============================================================================
// EXPORTS
// =============================================================================

export { detectFieldMappingsFromArray };

/**
 * CSV/TSV Parser - PeakInfer TDD v1.3
 * 
 * Parses CSV and TSV files with header row into InferenceEvents.
 * Supports field alias resolution and custom mappings.
 */

import * as fs from 'fs';
import * as readline from 'readline';
import type { InferenceEvent } from '../../../types/events.js';
import type { ParseResult, FieldMapping, FormatType } from '../schemas.js';
import { FIELD_ALIASES, REQUIRED_FIELDS } from '../schemas.js';

// =============================================================================
// TYPES
// =============================================================================

export interface CsvParserOptions {
  /** Delimiter character (',' for CSV, '\t' for TSV) */
  delimiter?: string;
  
  /** Custom field mappings (overrides auto-detection) */
  mappings?: FieldMapping[];
  
  /** Allow missing required fields */
  lenient?: boolean;
  
  /** Skip rows that fail to parse */
  skipErrors?: boolean;
  
  /** Maximum rows to parse (0 = unlimited) */
  maxRows?: number;
  
  /** Quote character for fields */
  quote?: string;
}

// =============================================================================
// MAIN PARSER
// =============================================================================

/**
 * Parse a CSV/TSV file into InferenceEvents
 */
export async function parseCsv(
  filePath: string,
  options: CsvParserOptions = {}
): Promise<ParseResult> {
  const { 
    delimiter = ',', 
    lenient = false, 
    skipErrors = true, 
    maxRows = 0,
    quote = '"',
  } = options;
  
  const events: InferenceEvent[] = [];
  const errors: string[] = [];
  let headers: string[] = [];
  let totalRecords = 0;
  let parsedRecords = 0;
  let failedRecords = 0;
  let lineNumber = 0;
  
  const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });
  
  // Will be set after parsing header
  let mappings: FieldMapping[] = [];
  
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    lineNumber++;
    
    // First line is header
    if (lineNumber === 1) {
      headers = parseRow(trimmed, delimiter, quote);
      mappings = options.mappings || detectFieldMappingsFromHeaders(headers);
      continue;
    }
    
    totalRecords++;
    
    if (maxRows > 0 && totalRecords > maxRows) {
      break;
    }
    
    try {
      const values = parseRow(trimmed, delimiter, quote);
      
      if (values.length !== headers.length) {
        // Allow some variance for trailing delimiters
        if (Math.abs(values.length - headers.length) > 2) {
          throw new Error(`Column count mismatch: expected ${headers.length}, got ${values.length}`);
        }
      }
      
      // Build object from headers and values
      const obj: Record<string, unknown> = {};
      for (let i = 0; i < headers.length; i++) {
        obj[headers[i]] = values[i] ?? null;
      }
      
      const event = mapCsvRowToEvent(obj, mappings, lenient);
      
      if (event) {
        events.push(event);
        parsedRecords++;
      } else {
        failedRecords++;
        if (!skipErrors) {
          errors.push(`Row ${lineNumber}: Failed to map to InferenceEvent`);
        }
      }
    } catch (e) {
      failedRecords++;
      const errorMsg = e instanceof Error ? e.message : 'Unknown error';
      if (!skipErrors) {
        errors.push(`Row ${lineNumber}: ${errorMsg}`);
      }
    }
  }
  
  // Calculate confidence
  const successRate = totalRecords > 0 ? parsedRecords / totalRecords : 0;
  const confidence = successRate >= 0.95 ? 1.0 : successRate >= 0.8 ? 0.9 : successRate >= 0.5 ? 0.7 : 0.5;
  
  const formatType: FormatType = delimiter === '\t' ? 'tsv' : 'csv';
  
  return {
    events,
    format: {
      detected: formatType,
      confidence,
      evidence: [
        `Parsed ${parsedRecords}/${totalRecords} rows from ${formatType.toUpperCase()}`,
        `${headers.length} columns`,
        mappings.length > 0 ? `Applied ${mappings.length} field mappings` : 'Direct column match',
      ],
      requiresAgent: false,
      sampleLines: Math.min(totalRecords + 1, 50), // +1 for header
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
// ROW PARSING
// =============================================================================

/**
 * Parse a CSV/TSV row handling quoted fields
 */
function parseRow(line: string, delimiter: string, quote: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;
  
  while (i < line.length) {
    const char = line[i];
    
    if (char === quote) {
      if (inQuotes && line[i + 1] === quote) {
        // Escaped quote
        current += quote;
        i += 2;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
        i++;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
      i++;
    } else {
      current += char;
      i++;
    }
  }
  
  // Push last field
  result.push(current.trim());
  
  return result;
}

// =============================================================================
// FIELD MAPPING
// =============================================================================

/**
 * Detect field mappings from CSV headers
 */
function detectFieldMappingsFromHeaders(headers: string[]): FieldMapping[] {
  const mappings: FieldMapping[] = [];
  const normalizedHeaders = headers.map(h => h.toLowerCase().replace(/['"]/g, ''));
  
  for (const [targetField, aliases] of Object.entries(FIELD_ALIASES)) {
    const matchIndex = normalizedHeaders.findIndex(h =>
      aliases.some(alias => h === alias.toLowerCase())
    );
    
    if (matchIndex >= 0) {
      mappings.push({
        targetField: targetField as keyof InferenceEvent,
        sourceExpression: headers[matchIndex],
        extractionType: 'column',
        confidence: 1.0,
        evidence: `Matched header: ${headers[matchIndex]}`,
      });
    }
  }
  
  return mappings;
}

/**
 * Map a CSV row object to an InferenceEvent
 */
function mapCsvRowToEvent(
  obj: Record<string, unknown>,
  mappings: FieldMapping[],
  lenient: boolean
): InferenceEvent | null {
  const event: Partial<InferenceEvent> = {};
  
  if (mappings.length > 0) {
    for (const mapping of mappings) {
      const rawValue = obj[mapping.sourceExpression];
      const value = coerceValue(rawValue, mapping.targetField);
      
      if (value !== undefined && value !== null && value !== '') {
        (event as Record<string, unknown>)[mapping.targetField] = value;
      } else if (mapping.defaultValue !== undefined) {
        (event as Record<string, unknown>)[mapping.targetField] = mapping.defaultValue;
      }
    }
  } else {
    // Direct mapping - try field names and aliases
    for (const [targetField, aliases] of Object.entries(FIELD_ALIASES)) {
      for (const alias of aliases) {
        const key = Object.keys(obj).find(k => k.toLowerCase() === alias.toLowerCase());
        if (key && obj[key] !== undefined && obj[key] !== null && obj[key] !== '') {
          (event as Record<string, unknown>)[targetField] = coerceValue(obj[key], targetField as keyof InferenceEvent);
          break;
        }
      }
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
  
  return event as InferenceEvent;
}

/**
 * Coerce a string value to the appropriate type for a field
 */
function coerceValue(value: unknown, field: keyof InferenceEvent): unknown {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  
  const strValue = String(value);
  
  switch (field) {
    case 'input_tokens':
    case 'output_tokens':
    case 'latency_ms':
    case 'context_length':
      return parseInt(strValue, 10) || 0;
      
    case 'cost_usd':
    case 'quality_score':
      return parseFloat(strValue) || 0;
      
    case 'metadata':
      try {
        return JSON.parse(strValue);
      } catch {
        return { raw: strValue };
      }
      
    default:
      return strValue;
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  parseRow,
  detectFieldMappingsFromHeaders,
  mapCsvRowToEvent,
  coerceValue,
};

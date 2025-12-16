/**
 * Format Detector - PeakInfer TDD v1.3
 * 
 * Heuristic-based format detection for runtime events files.
 * Identifies format type before parsing or agent normalization.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { FormatType, FormatDetection, FormatSignature } from './schemas.js';
import {
  DIRECT_PARSE_FORMATS,
  FORMAT_SIGNATURES,
  FIELD_ALIASES,
  REQUIRED_FIELDS,
} from './schemas.js';

// =============================================================================
// CONFIGURATION
// =============================================================================

/** Number of lines to sample for format detection */
const SAMPLE_LINES = 50;

/** Maximum bytes to read for sampling */
const MAX_SAMPLE_BYTES = 100 * 1024; // 100KB

// =============================================================================
// MAIN DETECTOR
// =============================================================================

/**
 * Detect the format of a runtime events file
 */
export async function detectFormat(filePath: string): Promise<FormatDetection> {
  const absolutePath = path.resolve(filePath);
  
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }
  
  const stats = fs.statSync(absolutePath);
  if (stats.isDirectory()) {
    throw new Error(`Expected a file, got directory: ${absolutePath}`);
  }
  
  const extension = path.extname(absolutePath).toLowerCase();
  
  // Read sample of the file
  const sample = readSample(absolutePath);
  const lines = sample.split('\n').filter(l => l.trim());
  
  // Try detection strategies in order
  const detectionResult = 
    detectByExtension(extension, lines) ||
    detectByStructure(lines, extension) ||
    detectBySignatures(sample, lines, extension) ||
    detectByHeuristics(lines, extension);
  
  return {
    ...detectionResult,
    sampleLines: Math.min(lines.length, SAMPLE_LINES),
    extension,
  };
}

// =============================================================================
// DETECTION STRATEGIES
// =============================================================================

/**
 * Detect format by file extension
 */
function detectByExtension(extension: string, lines: string[]): FormatDetection | null {
  // JSONL / NDJSON
  if (extension === '.jsonl' || extension === '.ndjson') {
    if (isValidJsonl(lines)) {
      const hasExactSchema = checkExactInferenceEventSchema(lines);
      return {
        detected: 'jsonl',
        confidence: hasExactSchema ? 1.0 : 0.9,
        evidence: [
          `File extension: ${extension}`,
          'Valid JSONL format (one JSON object per line)',
          hasExactSchema ? 'Matches InferenceEvent schema' : 'May require field mapping',
        ],
        requiresAgent: !hasExactSchema,
        sampleLines: lines.length,
      };
    }
  }
  
  // CSV
  if (extension === '.csv') {
    if (isValidCsv(lines, ',')) {
      const hasStandardHeaders = checkStandardCsvHeaders(lines[0], ',');
      return {
        detected: 'csv',
        confidence: hasStandardHeaders ? 1.0 : 0.85,
        evidence: [
          `File extension: ${extension}`,
          'Valid CSV format with header row',
          hasStandardHeaders ? 'Standard column names detected' : 'May require field mapping',
        ],
        requiresAgent: !hasStandardHeaders,
        sampleLines: lines.length,
      };
    }
  }
  
  // TSV
  if (extension === '.tsv') {
    if (isValidCsv(lines, '\t')) {
      const hasStandardHeaders = checkStandardCsvHeaders(lines[0], '\t');
      return {
        detected: 'tsv',
        confidence: hasStandardHeaders ? 1.0 : 0.85,
        evidence: [
          `File extension: ${extension}`,
          'Valid TSV format with header row',
          hasStandardHeaders ? 'Standard column names detected' : 'May require field mapping',
        ],
        requiresAgent: !hasStandardHeaders,
        sampleLines: lines.length,
      };
    }
  }
  
  // OTLP
  if (extension === '.otlp') {
    return {
      detected: 'otel',
      confidence: 0.95,
      evidence: [`File extension: ${extension}`, 'OpenTelemetry OTLP format'],
      requiresAgent: true,
      sampleLines: lines.length,
    };
  }
  
  return null;
}

/**
 * Detect format by analyzing content structure
 */
function detectByStructure(lines: string[], extension: string): FormatDetection | null {
  if (lines.length === 0) {
    return {
      detected: 'unknown',
      confidence: 0,
      evidence: ['Empty file'],
      requiresAgent: false,
      sampleLines: 0,
    };
  }
  
  const firstLine = lines[0].trim();
  
  // Try to parse as JSON
  try {
    const parsed = JSON.parse(firstLine);
    
    // Single line is a JSON object - likely JSONL
    if (typeof parsed === 'object' && !Array.isArray(parsed)) {
      // Check if all lines are valid JSON objects
      if (isValidJsonl(lines)) {
        const hasExactSchema = checkExactInferenceEventSchema(lines);
        return {
          detected: 'jsonl',
          confidence: hasExactSchema ? 0.95 : 0.8,
          evidence: [
            'Each line is a valid JSON object',
            hasExactSchema ? 'Matches InferenceEvent schema' : 'Custom JSON structure',
          ],
          requiresAgent: !hasExactSchema,
          sampleLines: lines.length,
        };
      }
    }
    
    // First line starts a JSON array
    if (Array.isArray(parsed)) {
      return {
        detected: 'json_array',
        confidence: 0.9,
        evidence: ['Root element is JSON array'],
        requiresAgent: false, // Will check schema during parsing
        sampleLines: lines.length,
      };
    }
  } catch {
    // Not valid JSON on first line
  }
  
  // Try to parse entire sample as JSON array
  const fullSample = lines.join('\n');
  try {
    const parsed = JSON.parse(fullSample);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const first = parsed[0];
      
      // Check for Zipkin format (has traceId, id, and kind/name)
      if (typeof first === 'object' && first !== null &&
          'traceId' in first && 'id' in first &&
          (('kind' in first) || ('name' in first && 'duration' in first))) {
        return {
          detected: 'zipkin',
          confidence: 0.90,
          evidence: [
            'Valid JSON array of span objects',
            'Contains Zipkin-specific fields (traceId, id, kind/name)',
          ],
          requiresAgent: true,
          sampleLines: lines.length,
        };
      }
      
      const hasExactSchema = checkObjectMatchesSchema(first);
      return {
        detected: 'json_array',
        confidence: hasExactSchema ? 0.95 : 0.85,
        evidence: [
          'Valid JSON array of objects',
          hasExactSchema ? 'Matches InferenceEvent schema' : 'May require field mapping',
        ],
        requiresAgent: !hasExactSchema,
        sampleLines: lines.length,
      };
    } else if (typeof parsed === 'object') {
      // Single JSON object - check for known formats
      const signatureMatch = matchSignature(parsed);
      if (signatureMatch) {
        return signatureMatch;
      }
    }
  } catch {
    // Not valid JSON overall
  }
  
  // Check for CSV/TSV
  if (isValidCsv(lines, ',')) {
    const hasStandardHeaders = checkStandardCsvHeaders(lines[0], ',');
    return {
      detected: 'csv',
      confidence: hasStandardHeaders ? 0.85 : 0.7,
      evidence: [
        'Comma-separated values detected',
        hasStandardHeaders ? 'Standard column names' : 'Custom column names',
      ],
      requiresAgent: !hasStandardHeaders,
      sampleLines: lines.length,
    };
  }
  
  if (isValidCsv(lines, '\t')) {
    const hasStandardHeaders = checkStandardCsvHeaders(lines[0], '\t');
    return {
      detected: 'tsv',
      confidence: hasStandardHeaders ? 0.85 : 0.7,
      evidence: [
        'Tab-separated values detected',
        hasStandardHeaders ? 'Standard column names' : 'Custom column names',
      ],
      requiresAgent: !hasStandardHeaders,
      sampleLines: lines.length,
    };
  }
  
  return null;
}

/**
 * Detect format by matching known signatures
 */
function detectBySignatures(sample: string, lines: string[], extension: string): FormatDetection | null {
  // Try to parse as JSON for signature matching
  let parsedJson: unknown;
  
  try {
    // Try full sample first
    parsedJson = JSON.parse(sample);
  } catch {
    try {
      // Try first line
      parsedJson = JSON.parse(lines[0]);
    } catch {
      return null;
    }
  }
  
  return matchSignature(parsedJson);
}

/**
 * Match parsed JSON against known format signatures
 */
function matchSignature(parsed: unknown): FormatDetection | null {
  if (!parsed || typeof parsed !== 'object') return null;
  
  const obj = parsed as Record<string, unknown>;
  const keys = Object.keys(obj);
  
  let bestMatch: { signature: FormatSignature; confidence: number; evidence: string[] } | null = null;
  
  for (const sig of FORMAT_SIGNATURES) {
    let score = 0;
    const evidence: string[] = [];
    
    // Check required keys
    if (sig.requiredKeys) {
      const hasAllRequired = sig.requiredKeys.every(k => keys.includes(k));
      if (hasAllRequired) {
        score += 0.5 * sig.weight;
        evidence.push(`Has required keys: ${sig.requiredKeys.join(', ')}`);
      } else {
        continue; // Skip this signature if missing required keys
      }
    }
    
    // Check optional keys
    if (sig.optionalKeys) {
      const matchedOptional = sig.optionalKeys.filter(k => keys.includes(k));
      if (matchedOptional.length > 0) {
        score += (0.3 * matchedOptional.length / sig.optionalKeys.length) * sig.weight;
        evidence.push(`Has optional keys: ${matchedOptional.join(', ')}`);
      }
    }
    
    // Check content pattern
    if (sig.contentPattern) {
      const content = JSON.stringify(parsed);
      if (sig.contentPattern.test(content)) {
        score += 0.2 * sig.weight;
        evidence.push(`Content matches pattern for ${sig.format}`);
      }
    }
    
    if (score > 0 && (!bestMatch || score > bestMatch.confidence)) {
      bestMatch = { signature: sig, confidence: score, evidence };
    }
  }
  
  if (bestMatch && bestMatch.confidence >= 0.5) {
    return {
      detected: bestMatch.signature.format,
      confidence: bestMatch.confidence,
      evidence: bestMatch.evidence,
      requiresAgent: true,
      sampleLines: 0,
    };
  }
  
  return null;
}

/**
 * Fall back to heuristics for unknown formats
 */
function detectByHeuristics(lines: string[], extension: string): FormatDetection {
  const firstLine = lines[0]?.trim() || '';
  
  // Check for log-like patterns
  const logPattern = /^\d{4}-\d{2}-\d{2}|^\[\d+\]|^[A-Z]+\s+\d{4}/;
  if (logPattern.test(firstLine)) {
    return {
      detected: 'custom',
      confidence: 0.5,
      evidence: ['Log-like timestamp pattern detected', 'Requires agent inference'],
      requiresAgent: true,
      sampleLines: lines.length,
    };
  }
  
  // Check for key=value patterns
  const kvPattern = /\w+=[\w"']/;
  if (kvPattern.test(firstLine)) {
    return {
      detected: 'custom',
      confidence: 0.5,
      evidence: ['Key=value pattern detected', 'Requires agent inference'],
      requiresAgent: true,
      sampleLines: lines.length,
    };
  }
  
  // Unknown format
  return {
    detected: 'unknown',
    confidence: 0.1,
    evidence: [
      'Could not identify format',
      `Extension: ${extension || 'none'}`,
      'Manual format specification recommended',
    ],
    requiresAgent: true,
    sampleLines: lines.length,
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Read a sample of the file (first N lines or first M bytes)
 */
function readSample(filePath: string): string {
  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.alloc(MAX_SAMPLE_BYTES);
  const bytesRead = fs.readSync(fd, buffer, 0, MAX_SAMPLE_BYTES, 0);
  fs.closeSync(fd);
  
  let content = buffer.toString('utf-8', 0, bytesRead);
  
  // If we hit the limit, truncate at last complete line
  if (bytesRead === MAX_SAMPLE_BYTES) {
    const lastNewline = content.lastIndexOf('\n');
    if (lastNewline > 0) {
      content = content.substring(0, lastNewline);
    }
  }
  
  return content;
}

/**
 * Check if lines form valid JSONL
 */
function isValidJsonl(lines: string[]): boolean {
  if (lines.length === 0) return false;
  
  let validCount = 0;
  const checkLines = lines.slice(0, SAMPLE_LINES);
  
  for (const line of checkLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === 'object' && !Array.isArray(parsed)) {
        validCount++;
      }
    } catch {
      return false;
    }
  }
  
  return validCount >= Math.min(checkLines.length, 3);
}

/**
 * Check if lines form valid CSV/TSV
 */
function isValidCsv(lines: string[], delimiter: string): boolean {
  if (lines.length < 2) return false;
  
  const headerCols = lines[0].split(delimiter).length;
  if (headerCols < 2) return false;
  
  // Check that other lines have similar column count
  let consistentCount = 0;
  const checkLines = lines.slice(1, Math.min(lines.length, SAMPLE_LINES));
  
  for (const line of checkLines) {
    if (!line.trim()) continue;
    const cols = line.split(delimiter).length;
    // Allow some variance (quoted fields with delimiters)
    if (Math.abs(cols - headerCols) <= 2) {
      consistentCount++;
    }
  }
  
  return consistentCount >= Math.min(checkLines.length, 3) * 0.8;
}

/**
 * Check if CSV headers match known field aliases
 */
function checkStandardCsvHeaders(headerLine: string, delimiter: string): boolean {
  const headers = headerLine.toLowerCase().split(delimiter).map(h => h.trim().replace(/['"]/g, ''));
  
  let matchedRequired = 0;
  
  for (const requiredField of REQUIRED_FIELDS) {
    const aliases = FIELD_ALIASES[requiredField] || [requiredField];
    if (aliases.some(alias => headers.includes(alias.toLowerCase()))) {
      matchedRequired++;
    }
  }
  
  // Need at least 3 of 4 required fields
  return matchedRequired >= 3;
}

/**
 * Check if JSONL objects match InferenceEvent schema
 */
function checkExactInferenceEventSchema(lines: string[]): boolean {
  const checkLines = lines.slice(0, 5);
  
  for (const line of checkLines) {
    try {
      const obj = JSON.parse(line.trim());
      if (!checkObjectMatchesSchema(obj)) {
        return false;
      }
    } catch {
      return false;
    }
  }
  
  return true;
}

/**
 * Check if an object matches InferenceEvent schema
 */
function checkObjectMatchesSchema(obj: unknown): boolean {
  if (!obj || typeof obj !== 'object') return false;
  
  const record = obj as Record<string, unknown>;
  const keys = Object.keys(record);
  
  let matchedRequired = 0;
  
  for (const requiredField of REQUIRED_FIELDS) {
    const aliases = FIELD_ALIASES[requiredField] || [requiredField];
    if (aliases.some(alias => keys.includes(alias))) {
      matchedRequired++;
    }
  }
  
  return matchedRequired >= 3;
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  readSample,
  isValidJsonl,
  isValidCsv,
  checkStandardCsvHeaders,
  checkExactInferenceEventSchema,
  checkObjectMatchesSchema,
};

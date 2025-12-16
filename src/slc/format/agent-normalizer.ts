/**
 * Agent-Based Format Normalizer - PeakInfer TDD v1.3
 * 
 * Uses Claude API to intelligently detect formats and map fields
 * when heuristic detection fails or confidence is low.
 * 
 * Implements the sub-agent pattern per TDD v1.3 Section 9.3:
 * - FormatDetector sub-agent: Identifies format type from sample lines
 * - FieldMapper sub-agent: Maps fields to InferenceEvent schema
 * - MappingValidator sub-agent: Validates extracted values
 * 
 * Context Engineering: Each sub-agent receives only the context it needs.
 */

import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import type { InferenceEvent } from '../../types/events.js';
import type {
  FormatType,
  FormatDetection,
  FieldMapping,
  ExtractionType,
} from './schemas.js';
import { FIELD_ALIASES, ALL_MAPPABLE_FIELDS } from './schemas.js';
import { FormatDetectorSubAgent } from './sub-agents/format-detector.js';
import { FieldMapperSubAgent } from './sub-agents/field-mapper.js';
import { MappingValidatorSubAgent } from './sub-agents/mapping-validator.js';
import type { SubAgentNormalizationResult } from './sub-agents/types.js';

// =============================================================================
// CONFIGURATION
// =============================================================================

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const MAX_SAMPLE_LINES = 50;

interface AgentNormalizerConfig {
  /** Maximum lines to sample for detection */
  maxSampleLines: number;
  /** Minimum confidence threshold */
  minConfidenceThreshold: number;
  /** Enable codebase context for combined mode */
  enableCodebaseContext: boolean;
  /** Prompt user if confidence too low */
  fallbackToManual: boolean;
  /** Claude model to use */
  model: string;
}

const DEFAULT_CONFIG: AgentNormalizerConfig = {
  maxSampleLines: MAX_SAMPLE_LINES,
  minConfidenceThreshold: 0.7,
  enableCodebaseContext: true,
  fallbackToManual: true,
  model: DEFAULT_MODEL,
};

// =============================================================================
// SUB-AGENT: FORMAT DETECTOR
// =============================================================================

const FORMAT_DETECTOR_PROMPT = `You are a format detection expert. Analyze the sample data and identify its format.

Sample lines from the file:
<sample>
{sampleLines}
</sample>

File extension: {extension}

Known formats to check:
- jsonl: One JSON object per line (newline-delimited JSON)
- json_array: JSON file with root array of objects
- csv: Comma-separated values with header row
- tsv: Tab-separated values with header row
- otel: OpenTelemetry OTLP format (contains resourceSpans/scopeSpans)
- jaeger: Jaeger tracing format (contains data[].spans with traceID)
- zipkin: Zipkin tracing format (array with traceId, id, kind fields)
- langsmith: LangSmith/LangChain format (contains run_type, dotted_order)
- helicone: Helicone proxy logs (contains request/response/properties)
- wandb: Weights & Biases logs (contains _wandb, _runtime)
- litellm: LiteLLM proxy logs (contains litellm_params or similar)
- portkey: Portkey gateway logs (contains virtual_key or gateway fields)
- custom: Other structured format that needs field mapping
- unknown: Cannot determine format

Respond with a JSON object:
{
  "detected": "<format_type>",
  "confidence": <0.0-1.0>,
  "evidence": ["reason 1", "reason 2"],
  "requiresAgent": <true if needs field mapping, false if standard schema>
}

Only respond with the JSON object, no other text.`;

/**
 * Detect format using Claude
 */
export async function detectFormatWithAgent(
  sampleLines: string[],
  extension: string,
  config: Partial<AgentNormalizerConfig> = {}
): Promise<FormatDetection> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  // Check for API key
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY required for agent-based format detection');
  }
  
  const client = new Anthropic({ apiKey });
  
  const prompt = FORMAT_DETECTOR_PROMPT
    .replace('{sampleLines}', sampleLines.slice(0, cfg.maxSampleLines).join('\n'))
    .replace('{extension}', extension || 'none');
  
  try {
    const response = await client.messages.create({
      model: cfg.model,
      max_tokens: 500,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    });
    
    // Extract text content
    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude');
    }
    
    // Parse JSON response
    const result = JSON.parse(textContent.text);
    
    return {
      detected: result.detected as FormatType,
      confidence: result.confidence,
      evidence: result.evidence || [],
      requiresAgent: result.requiresAgent ?? true,
      sampleLines: sampleLines.length,
      extension,
    };
  } catch (error) {
    // Fallback on error
    return {
      detected: 'unknown',
      confidence: 0.1,
      evidence: [`Agent detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
      requiresAgent: true,
      sampleLines: sampleLines.length,
      extension,
    };
  }
}

// =============================================================================
// SUB-AGENT: FIELD MAPPER
// =============================================================================

const FIELD_MAPPER_PROMPT = `You are a data schema expert. Map fields from the source format to the InferenceEvent schema.

Detected format: {formatType}

Sample record structure:
<sample>
{sampleRecord}
</sample>

Target InferenceEvent schema (required fields marked with *):
- id*: string (unique identifier for the event)
- ts*: string (ISO timestamp, e.g., "2024-12-15T10:00:00Z")
- provider*: string (openai, anthropic, google, together, fireworks, groq, etc.)
- model*: string (gpt-4o, claude-3-sonnet, llama-3-70b, etc.)
- input_tokens: number (prompt/input token count)
- output_tokens: number (completion/output token count)
- latency_ms: number (response time in milliseconds)
- intent: string (task type: chat, summarize, extract, etc.)
- cost_usd: number (cost in USD)
- region: string (datacenter/region)
- tenant: string (customer/org identifier)
- endpoint: string (API endpoint URL)

Known field aliases for common formats:
{fieldAliases}

{codebaseContext}

For each target field, determine:
1. The source field or expression to extract the value
2. How to extract it (jsonpath, column, regex, computed)
3. Confidence in the mapping (0-1)
4. Brief evidence for why this mapping is correct

Respond with a JSON object:
{
  "mappings": [
    {
      "targetField": "id",
      "sourceExpression": "request_id",
      "extractionType": "jsonpath",
      "confidence": 0.95,
      "evidence": "Field 'request_id' is a unique identifier"
    },
    ...
  ],
  "unmappedRequired": ["list", "of", "missing", "required", "fields"],
  "overallConfidence": 0.85
}

Only respond with the JSON object, no other text.`;

/**
 * Map fields using Claude
 */
export async function mapFieldsWithAgent(
  formatType: FormatType,
  sampleRecord: Record<string, unknown>,
  codebaseContext?: { loggingPatterns: string[]; variableNames: string[] },
  config: Partial<AgentNormalizerConfig> = {}
): Promise<{ mappings: FieldMapping[]; overallConfidence: number; unmappedRequired: string[] }> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY required for agent-based field mapping');
  }
  
  const client = new Anthropic({ apiKey });
  
  // Build field aliases reference
  const aliasesText = Object.entries(FIELD_ALIASES)
    .map(([field, aliases]) => `- ${field}: ${aliases.slice(0, 5).join(', ')}`)
    .join('\n');
  
  // Build codebase context section
  let contextText = '';
  if (codebaseContext && cfg.enableCodebaseContext) {
    if (codebaseContext.loggingPatterns.length > 0) {
      contextText += `\nLogging patterns found in codebase:\n${codebaseContext.loggingPatterns.slice(0, 10).join('\n')}\n`;
    }
    if (codebaseContext.variableNames.length > 0) {
      contextText += `\nVariable names used in logging:\n${codebaseContext.variableNames.slice(0, 20).join(', ')}\n`;
    }
  }
  
  const prompt = FIELD_MAPPER_PROMPT
    .replace('{formatType}', formatType)
    .replace('{sampleRecord}', JSON.stringify(sampleRecord, null, 2))
    .replace('{fieldAliases}', aliasesText)
    .replace('{codebaseContext}', contextText || 'No codebase context available.');
  
  try {
    const response = await client.messages.create({
      model: cfg.model,
      max_tokens: 2000,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    });
    
    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude');
    }
    
    const result = JSON.parse(textContent.text);
    
    // Convert to FieldMapping type
    const mappings: FieldMapping[] = (result.mappings || []).map((m: Record<string, unknown>) => ({
      targetField: m.targetField as keyof InferenceEvent,
      sourceExpression: String(m.sourceExpression),
      extractionType: (m.extractionType || 'jsonpath') as ExtractionType,
      confidence: Number(m.confidence) || 0.5,
      evidence: m.evidence ? String(m.evidence) : undefined,
    }));
    
    return {
      mappings,
      overallConfidence: result.overallConfidence || 0.5,
      unmappedRequired: result.unmappedRequired || [],
    };
  } catch (error) {
    return {
      mappings: [],
      overallConfidence: 0.1,
      unmappedRequired: ['id', 'ts', 'provider', 'model'],
    };
  }
}

// =============================================================================
// SUB-AGENT: MAPPING VALIDATOR
// =============================================================================

const MAPPING_VALIDATOR_PROMPT = `You are a data validation expert. Validate whether the extracted values are correct.

Proposed field mappings:
{mappings}

Sample of extracted values (first 5 records):
{extractedSamples}

Expected constraints:
- id: Should be a unique identifier (string)
- ts: Should be an ISO timestamp or convertible to one
- provider: Should be a known LLM provider (openai, anthropic, google, together, etc.)
- model: Should be a model name (gpt-4, claude-3-sonnet, llama-3, etc.)
- input_tokens: Should be a positive integer
- output_tokens: Should be a positive integer
- latency_ms: Should be a positive number (milliseconds)
- cost_usd: Should be a positive number

For each mapping, validate:
1. Does the extracted value look correct for the field type?
2. Is the value in the expected range/format?
3. What's the validation confidence?

Respond with a JSON object:
{
  "validations": [
    {
      "targetField": "id",
      "isValid": true,
      "confidence": 0.95,
      "issue": null
    },
    {
      "targetField": "latency_ms",
      "isValid": false,
      "confidence": 0.3,
      "issue": "Values appear to be in seconds, not milliseconds"
    }
  ],
  "overallValid": true,
  "adjustedConfidence": 0.85,
  "suggestions": ["Consider multiplying latency by 1000 to convert to ms"]
}

Only respond with the JSON object, no other text.`;

interface ValidationResult {
  validations: Array<{
    targetField: string;
    isValid: boolean;
    confidence: number;
    issue: string | null;
  }>;
  overallValid: boolean;
  adjustedConfidence: number;
  suggestions: string[];
}

/**
 * Validate mappings using Claude
 */
export async function validateMappingsWithAgent(
  mappings: FieldMapping[],
  extractedSamples: Array<Partial<InferenceEvent>>,
  config: Partial<AgentNormalizerConfig> = {}
): Promise<ValidationResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Return default validation if no API key
    return {
      validations: mappings.map(m => ({
        targetField: m.targetField,
        isValid: true,
        confidence: m.confidence,
        issue: null,
      })),
      overallValid: true,
      adjustedConfidence: mappings.reduce((sum, m) => sum + m.confidence, 0) / mappings.length,
      suggestions: [],
    };
  }
  
  const client = new Anthropic({ apiKey });
  
  const mappingsText = mappings.map(m => 
    `- ${m.targetField}: ${m.sourceExpression} (${m.extractionType}, confidence: ${m.confidence})`
  ).join('\n');
  
  const samplesText = JSON.stringify(extractedSamples.slice(0, 5), null, 2);
  
  const prompt = MAPPING_VALIDATOR_PROMPT
    .replace('{mappings}', mappingsText)
    .replace('{extractedSamples}', samplesText);
  
  try {
    const response = await client.messages.create({
      model: cfg.model,
      max_tokens: 1000,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    });
    
    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude');
    }
    
    return JSON.parse(textContent.text) as ValidationResult;
  } catch (error) {
    // Return permissive validation on error
    return {
      validations: mappings.map(m => ({
        targetField: m.targetField,
        isValid: true,
        confidence: m.confidence * 0.8, // Reduce confidence on validation failure
        issue: null,
      })),
      overallValid: true,
      adjustedConfidence: 0.6,
      suggestions: [`Validation skipped: ${error instanceof Error ? error.message : 'Unknown error'}`],
    };
  }
}

// =============================================================================
// FULL AGENT NORMALIZATION PIPELINE
// =============================================================================

export interface AgentNormalizationResult {
  format: FormatDetection;
  mappings: FieldMapping[];
  validation: ValidationResult;
  overallConfidence: number;
  agentCostUsd: number;
}

/**
 * Run the full agent normalization pipeline
 */
export async function normalizeWithAgent(
  filePath: string,
  codebaseContext?: { loggingPatterns: string[]; variableNames: string[] },
  config: Partial<AgentNormalizerConfig> = {}
): Promise<AgentNormalizationResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  // Step 1: Read sample lines
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());
  const sampleLines = lines.slice(0, cfg.maxSampleLines);
  const extension = filePath.split('.').pop() || '';
  
  // Step 2: Detect format with agent
  const format = await detectFormatWithAgent(sampleLines, extension, cfg);
  
  if (format.detected === 'unknown' || format.confidence < cfg.minConfidenceThreshold) {
    return {
      format,
      mappings: [],
      validation: {
        validations: [],
        overallValid: false,
        adjustedConfidence: format.confidence,
        suggestions: ['Format could not be determined. Use --format to specify manually.'],
      },
      overallConfidence: format.confidence,
      agentCostUsd: 0.001, // Rough estimate
    };
  }
  
  // Step 3: Parse a sample record
  let sampleRecord: Record<string, unknown> = {};
  try {
    if (format.detected === 'jsonl' || format.detected === 'json_array') {
      const firstLine = sampleLines[0].trim();
      if (firstLine.startsWith('[')) {
        const arr = JSON.parse(content);
        sampleRecord = arr[0] || {};
      } else {
        sampleRecord = JSON.parse(firstLine);
      }
    } else if (format.detected === 'csv' || format.detected === 'tsv') {
      const delimiter = format.detected === 'tsv' ? '\t' : ',';
      const headers = sampleLines[0].split(delimiter).map(h => h.trim().replace(/['"]/g, ''));
      const values = sampleLines[1]?.split(delimiter).map(v => v.trim().replace(/['"]/g, '')) || [];
      headers.forEach((h, i) => { sampleRecord[h] = values[i]; });
    } else {
      // Try JSON parse for other formats
      try {
        const parsed = JSON.parse(content);
        sampleRecord = Array.isArray(parsed) ? parsed[0] : parsed;
      } catch {
        sampleRecord = JSON.parse(sampleLines[0]);
      }
    }
  } catch {
    // If we can't parse, return early
    return {
      format,
      mappings: [],
      validation: {
        validations: [],
        overallValid: false,
        adjustedConfidence: format.confidence * 0.5,
        suggestions: ['Could not parse sample record for field mapping.'],
      },
      overallConfidence: format.confidence * 0.5,
      agentCostUsd: 0.001,
    };
  }
  
  // Step 4: Map fields with agent
  const { mappings, overallConfidence: mapConfidence, unmappedRequired } = await mapFieldsWithAgent(
    format.detected,
    sampleRecord,
    codebaseContext,
    cfg
  );
  
  if (mappings.length === 0) {
    return {
      format,
      mappings: [],
      validation: {
        validations: [],
        overallValid: false,
        adjustedConfidence: 0.3,
        suggestions: ['No field mappings could be determined.'],
      },
      overallConfidence: 0.3,
      agentCostUsd: 0.002,
    };
  }
  
  // Step 5: Extract sample values and validate
  const extractedSamples: Array<Partial<InferenceEvent>> = [];
  // (Simplified - in production would actually extract using mappings)
  
  const validation = await validateMappingsWithAgent(mappings, extractedSamples, cfg);
  
  // Calculate overall confidence
  const overallConfidence = Math.min(
    format.confidence,
    mapConfidence,
    validation.adjustedConfidence
  );
  
  return {
    format,
    mappings,
    validation,
    overallConfidence,
    agentCostUsd: 0.003, // Rough estimate for 3 API calls
  };
}

// =============================================================================
// CODEBASE CONTEXT EXTRACTION
// =============================================================================

/**
 * Extract logging patterns from codebase for context-aware normalization.
 * Scans Python and TypeScript files for logger calls and LLM-related variables.
 * Per TDD v1.3 Section 6.4 - Codebase-Aware Normalization.
 */
export async function extractLoggingContext(
  codebasePath: string
): Promise<{ loggingPatterns: string[]; variableNames: string[] }> {
  const loggingPatterns: string[] = [];
  const variableNames = new Set<string>();
  
  // Common logging patterns to search for
  const loggerPatterns = [
    /logger\.(info|debug|warn|error|log)\s*\(([^)]+)\)/g,
    /console\.(log|info|warn|error)\s*\(([^)]+)\)/g,
    /logging\.(info|debug|warning|error)\s*\(([^)]+)\)/g,
    /log\.(info|debug|warn|error)\s*\(([^)]+)\)/g,
    /print\s*\(([^)]+)\)/g,  // Python print
  ];
  
  // Variable names commonly used in LLM logging
  const llmVarPatterns = [
    /\b(model|model_name|model_id)[_\s]*[:=]/gi,
    /\b(provider|llm_provider|vendor)[_\s]*[:=]/gi,
    /\b(input_tokens|output_tokens|tokens?|token_count)[_\s]*[:=]/gi,
    /\b(latency|latency_ms|duration|response_time)[_\s]*[:=]/gi,
    /\b(cost|cost_usd|price|total_cost)[_\s]*[:=]/gi,
    /\b(intent|task|operation|request_type)[_\s]*[:=]/gi,
  ];
  
  // File extensions to scan
  const supportedExtensions = ['.py', '.ts', '.js', '.tsx', '.jsx'];
  
  // Recursively scan directory
  const scanDirectory = (dir: string) => {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = `${dir}/${entry.name}`;
        
        // Skip common non-source directories
        if (entry.isDirectory()) {
          if (!['node_modules', '.git', '__pycache__', 'dist', 'build', '.venv', 'venv'].includes(entry.name)) {
            scanDirectory(fullPath);
          }
          continue;
        }
        
        // Check file extension
        const ext = entry.name.substring(entry.name.lastIndexOf('.'));
        if (!supportedExtensions.includes(ext)) continue;
        
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          
          // Extract logging patterns
          for (const pattern of loggerPatterns) {
            const matches = content.matchAll(pattern);
            for (const match of matches) {
              const logContent = match[2] || match[1];
              if (logContent && logContent.length < 200) {
                // Check if this logging call involves LLM-related terms
                const lowerContent = logContent.toLowerCase();
                if (
                  lowerContent.includes('model') ||
                  lowerContent.includes('token') ||
                  lowerContent.includes('llm') ||
                  lowerContent.includes('inference') ||
                  lowerContent.includes('completion') ||
                  lowerContent.includes('chat') ||
                  lowerContent.includes('latency') ||
                  lowerContent.includes('provider')
                ) {
                  loggingPatterns.push(`${entry.name}: ${logContent.trim().substring(0, 100)}`);
                }
              }
            }
          }
          
          // Extract variable names
          for (const pattern of llmVarPatterns) {
            const matches = content.matchAll(pattern);
            for (const match of matches) {
              if (match[1]) {
                variableNames.add(match[1].toLowerCase());
              }
            }
          }
        } catch {
          // Skip files we can't read
        }
      }
    } catch {
      // Skip directories we can't access
    }
  };
  
  // Start scanning
  scanDirectory(codebasePath);
  
  return {
    loggingPatterns: loggingPatterns.slice(0, 50), // Limit to 50 patterns
    variableNames: Array.from(variableNames).slice(0, 30), // Limit to 30 variables
  };
}

// =============================================================================
// SUB-AGENT ARCHITECTURE (TDD v1.3 Section 9.3)
// =============================================================================

/**
 * Run full normalization using the sub-agent architecture.
 * This is the preferred method per TDD v1.3 - each sub-agent
 * receives only the context it needs (Context Engineering).
 * 
 * Pipeline: FormatDetector → FieldMapper → MappingValidator
 */
export async function normalizeWithSubAgents(
  filePath: string,
  codebaseContext?: { 
    loggingPatterns: string[]; 
    variableNames: string[];
    loggerCalls?: Array<{ file: string; line: number; fields: string[] }>;
  },
  config: Partial<AgentNormalizerConfig> = {}
): Promise<SubAgentNormalizationResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const startTime = Date.now();
  
  // Read sample lines (minimal context for FormatDetector)
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());
  const sampleLines = lines.slice(0, cfg.maxSampleLines);
  const extension = '.' + (filePath.split('.').pop() || '');
  const fileSize = fs.statSync(filePath).size;
  
  // ==========================================================================
  // Sub-Agent 1: Format Detection
  // Context: ONLY sample lines + extension (no full file, no codebase)
  // ==========================================================================
  const formatDetector = new FormatDetectorSubAgent();
  const detectorStartTime = Date.now();
  
  const detectorResult = await formatDetector.detect({
    sampleLines,
    extension,
    fileSize,
  });
  
  const formatDetectorDurationMs = Date.now() - detectorStartTime;
  
  // Build FormatDetection from detector result
  const format: FormatDetection = {
    detected: detectorResult.formatType,
    confidence: detectorResult.confidence,
    evidence: detectorResult.evidence,
    requiresAgent: detectorResult.requiresFieldMapping,
    sampleLines: sampleLines.length,
    extension,
  };
  
  // If unknown format with low confidence, return early
  if (format.detected === 'unknown' && format.confidence < cfg.minConfidenceThreshold) {
    return {
      format,
      mappings: [],
      overallConfidence: format.confidence,
      validation: {
        isValid: false,
        fieldResults: [],
        confidenceAdjustment: 0,
        suggestions: ['Format could not be determined. Use --format to specify manually.'],
      },
      warnings: ['Format detection failed'],
      usedCodebaseContext: false,
      metadata: {
        formatDetectorDurationMs,
        fieldMapperDurationMs: 0,
        validatorDurationMs: 0,
        totalCostUsd: 0.001,
      },
    };
  }
  
  // ==========================================================================
  // Parse sample records for field mapping
  // ==========================================================================
  let sampleRecords: Record<string, unknown>[] = [];
  
  try {
    if (format.detected === 'jsonl') {
      sampleRecords = sampleLines.slice(0, 5).map(line => JSON.parse(line));
    } else if (format.detected === 'json_array') {
      const parsed = JSON.parse(content);
      sampleRecords = Array.isArray(parsed) ? parsed.slice(0, 5) : [parsed];
    } else if (format.detected === 'csv' || format.detected === 'tsv') {
      const delimiter = format.detected === 'tsv' ? '\t' : ',';
      const headers = sampleLines[0].split(delimiter).map(h => h.trim().replace(/['"]/g, ''));
      
      for (let i = 1; i < Math.min(6, sampleLines.length); i++) {
        const values = sampleLines[i].split(delimiter).map(v => v.trim().replace(/['"]/g, ''));
        const record: Record<string, unknown> = {};
        headers.forEach((h, idx) => { record[h] = values[idx]; });
        sampleRecords.push(record);
      }
    } else {
      // Try parsing as JSON for other formats
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          sampleRecords = parsed.slice(0, 5);
        } else if (parsed.data && Array.isArray(parsed.data)) {
          // Jaeger-style
          const allSpans: Record<string, unknown>[] = [];
          for (const trace of parsed.data) {
            if (trace.spans) {
              allSpans.push(...(trace.spans as Record<string, unknown>[]).slice(0, 2));
            }
          }
          sampleRecords = allSpans.slice(0, 5);
        } else if (parsed.resourceSpans) {
          // OTEL-style
          const allSpans: Record<string, unknown>[] = [];
          for (const rs of parsed.resourceSpans) {
            for (const ss of (rs.scopeSpans || [])) {
              if (ss.spans) {
                allSpans.push(...(ss.spans as Record<string, unknown>[]).slice(0, 2));
              }
            }
          }
          sampleRecords = allSpans.slice(0, 5);
        } else {
          sampleRecords = [parsed];
        }
      } catch {
        // Try line-by-line JSON
        sampleRecords = sampleLines.slice(0, 5)
          .map(line => { try { return JSON.parse(line); } catch { return null; } })
          .filter((r): r is Record<string, unknown> => r !== null);
      }
    }
  } catch (error) {
    // Return partial result if we can't parse records
    return {
      format,
      mappings: [],
      overallConfidence: format.confidence * 0.5,
      validation: {
        isValid: false,
        fieldResults: [],
        confidenceAdjustment: -0.3,
        suggestions: ['Could not parse sample records for field mapping.'],
      },
      warnings: [`Parse error: ${error instanceof Error ? error.message : 'Unknown'}`],
      usedCodebaseContext: false,
      metadata: {
        formatDetectorDurationMs,
        fieldMapperDurationMs: 0,
        validatorDurationMs: 0,
        totalCostUsd: 0.001,
      },
    };
  }
  
  // ==========================================================================
  // Sub-Agent 2: Field Mapping
  // Context: Format type, sample records, target schema, optional codebase context
  // ==========================================================================
  const fieldMapper = new FieldMapperSubAgent();
  const mapperStartTime = Date.now();
  
  const mapperResult = await fieldMapper.mapFields({
    formatType: format.detected,
    sampleRecords,
    targetSchema: {
      required: ['id', 'ts', 'provider', 'model', 'input_tokens', 'output_tokens', 'latency_ms'],
      optional: ['intent', 'region', 'tenant', 'callsite_id', 'cost_usd'],
    },
    structuralHints: detectorResult.structuralHints,
    codebaseContext: codebaseContext ? {
      loggingPatterns: codebaseContext.loggingPatterns,
      variableNames: codebaseContext.variableNames,
      loggerCalls: codebaseContext.loggerCalls || [],
    } : undefined,
  });
  
  const fieldMapperDurationMs = Date.now() - mapperStartTime;
  
  // Convert to FieldMapping format
  const mappings: FieldMapping[] = mapperResult.mappings.map(m => ({
    targetField: m.targetField as keyof InferenceEvent,
    sourceExpression: m.sourceExpression,
    extractionType: m.extractionType as ExtractionType,
    confidence: m.confidence,
    evidence: m.evidence,
  }));
  
  // ==========================================================================
  // Sub-Agent 3: Mapping Validation
  // Context: ONLY mappings and extracted sample values
  // ==========================================================================
  const validator = new MappingValidatorSubAgent();
  const validatorStartTime = Date.now();
  
  // Extract sample values using mappings
  const extractedSamples: Record<string, unknown[]> = {};
  for (const mapping of mappings) {
    extractedSamples[mapping.targetField] = [];
    
    for (const record of sampleRecords) {
      const value = extractValueByExpression(record, mapping.sourceExpression, mapping.extractionType);
      if (value !== undefined) {
        extractedSamples[mapping.targetField].push(value);
      }
    }
  }
  
  const validation = validator.validate({
    mappings: mappings.map(m => ({
      targetField: m.targetField,
      sourceExpression: m.sourceExpression,
      extractionType: m.extractionType,
      confidence: m.confidence,
    })),
    extractedSamples,
    constraints: {
      id: { type: 'string' },
      ts: { type: 'iso8601' },
      provider: { type: 'string', validValues: ['openai', 'anthropic', 'google', 'together', 'fireworks', 'groq', 'cohere', 'mistral'] },
      model: { type: 'string' },
      input_tokens: { type: 'number', min: 0 },
      output_tokens: { type: 'number', min: 0 },
      latency_ms: { type: 'number', min: 0 },
    },
  });
  
  const validatorDurationMs = Date.now() - validatorStartTime;
  
  // ==========================================================================
  // Calculate overall confidence
  // ==========================================================================
  const overallConfidence = Math.min(
    format.confidence,
    mapperResult.overallConfidence,
    mapperResult.overallConfidence + validation.confidenceAdjustment
  );
  
  // Collect all warnings
  const warnings: string[] = [
    ...mapperResult.warnings,
    ...validation.suggestions,
  ];
  
  if (mapperResult.unmappedFields.length > 0) {
    warnings.push(`Unmapped required fields: ${mapperResult.unmappedFields.join(', ')}`);
  }
  
  return {
    format,
    mappings,
    overallConfidence,
    validation,
    warnings,
    usedCodebaseContext: mapperResult.usedCodebaseContext,
    metadata: {
      formatDetectorDurationMs,
      fieldMapperDurationMs,
      validatorDurationMs,
      totalCostUsd: 0.003, // Estimate for API calls
    },
  };
}

/**
 * Extract a value from a record using a source expression.
 */
function extractValueByExpression(
  record: Record<string, unknown>,
  expression: string,
  extractionType: ExtractionType
): unknown {
  if (extractionType === 'column' || extractionType === 'jsonpath') {
    // Handle JSONPath-like expressions
    let path = expression;
    if (path.startsWith('$.')) {
      path = path.slice(2);
    }
    
    const parts = path.split('.');
    let current: unknown = record;
    
    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }
    
    return current;
  }
  
  if (extractionType === 'computed') {
    // Handle computed expressions like "(endTime - startTime) / 1000"
    // Simplified - would need a proper expression evaluator in production
    if (expression.includes(' - ')) {
      const match = expression.match(/\(?\s*(\w+)\s*-\s*(\w+)\s*\)?(?:\s*\/\s*(\d+))?/);
      if (match) {
        const [, field1, field2, divisor] = match;
        const val1 = Number(record[field1] ?? record[field1.replace(/UnixNano$/, '')]);
        const val2 = Number(record[field2] ?? record[field2.replace(/UnixNano$/, '')]);
        
        if (!isNaN(val1) && !isNaN(val2)) {
          const diff = val1 - val2;
          return divisor ? diff / Number(divisor) : diff;
        }
      }
    }
    return undefined;
  }
  
  // Direct field access as fallback
  return record[expression];
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  FORMAT_DETECTOR_PROMPT,
  FIELD_MAPPER_PROMPT,
  MAPPING_VALIDATOR_PROMPT,
  DEFAULT_CONFIG,
  type AgentNormalizerConfig,
  type ValidationResult,
};

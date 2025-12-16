/**
 * FormatDetector Sub-Agent - PeakInfer TDD v1.3 Section 9.3
 * 
 * Purpose: Identify log/events file format from sample lines
 * 
 * Context Engineering:
 * - Receives ONLY sample lines + extension (no full file, no codebase)
 * - Output: FormatDetection + structural hints for FieldMapper
 * 
 * This is the first sub-agent in the format normalization pipeline.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { FormatType } from '../schemas.js';
import type {
  FormatDetectorInput,
  FormatDetectorOutput,
  FORMAT_DETECTOR_CONFIG,
} from './types.js';

// =============================================================================
// PROMPT TEMPLATE
// =============================================================================

const FORMAT_DETECTOR_PROMPT = `You are a format detection agent. Your job is to identify the format of a log/events data file.

You will receive:
1. Sample lines from the file
2. File extension
3. File size

Your job is to identify the format and provide structural hints.

KNOWN FORMATS TO CHECK:
- jsonl: One JSON object per line ({"key": "value"}\\n{"key": "value"})
- json_array: Root is JSON array ([{...}, {...}])
- csv: Comma-separated with header row
- tsv: Tab-separated with header row
- otel: OpenTelemetry format (contains resourceSpans/scopeSpans)
- jaeger: Jaeger trace format (contains data[].spans with traceID)
- zipkin: Zipkin format (array with traceId, id, kind)
- langsmith: LangSmith format (contains run_type, dotted_order)
- helicone: Helicone format (contains request/response/properties)
- wandb: Weights & Biases format (contains _wandb, _runtime)
- litellm: LiteLLM proxy format (contains model_info.llm_provider)
- portkey: Portkey format (contains provider, model, cache_status)
- custom: Other structured format
- unknown: Cannot determine

Respond with JSON:
{
  "formatType": "jsonl|json_array|csv|...",
  "confidence": 0.0-1.0,
  "evidence": ["reason 1", "reason 2"],
  "requiresFieldMapping": true|false,
  "structuralHints": {
    "isArray": true|false,
    "rootPath": "path.to.data" (if nested),
    "recordPath": "path.to.records" (if deeply nested)
  }
}

IMPORTANT:
- Be precise about confidence
- Provide clear evidence
- Set requiresFieldMapping=false only for exact InferenceEvent schema
- Provide structural hints to help the FieldMapper`;

function buildDetectorPrompt(input: FormatDetectorInput): string {
  return `${FORMAT_DETECTOR_PROMPT}

SAMPLE LINES (first ${input.sampleLines.length}):
\`\`\`
${input.sampleLines.slice(0, 20).join('\n')}
\`\`\`

FILE EXTENSION: ${input.extension || 'none'}
FILE SIZE: ${input.fileSize} bytes

Analyze and respond with JSON.`;
}

// =============================================================================
// FORMAT DETECTOR CLASS
// =============================================================================

export class FormatDetectorSubAgent {
  private client: Anthropic;
  private config = {
    name: 'format-detector',
    purpose: 'Identify log/events file format from sample lines',
    maxTokens: 1000,
    temperature: 0,
    requiresApi: true,
  };
  
  constructor() {
    this.client = new Anthropic();
  }
  
  /**
   * Detect format from sample lines.
   * This is the main entry point for the sub-agent.
   */
  async detect(input: FormatDetectorInput): Promise<FormatDetectorOutput> {
    const startTime = Date.now();
    
    // First try heuristic detection (no API call)
    const heuristicResult = this.heuristicDetect(input);
    if (heuristicResult.confidence >= 0.95) {
      return heuristicResult;
    }
    
    // Fall back to LLM detection
    try {
      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        messages: [
          {
            role: 'user',
            content: buildDetectorPrompt(input),
          },
        ],
      });
      
      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type');
      }
      
      return this.parseResponse(content.text, heuristicResult);
      
    } catch (error) {
      // Return heuristic result on API failure
      console.warn('FormatDetector API call failed, using heuristic:', error);
      return heuristicResult;
    }
  }
  
  /**
   * Heuristic format detection (no API call).
   * Used for obvious formats and as fallback.
   */
  private heuristicDetect(input: FormatDetectorInput): FormatDetectorOutput {
    const { sampleLines, extension } = input;
    const firstLine = sampleLines[0]?.trim() || '';
    
    // Check for JSONL
    if (extension === '.jsonl' || extension === '.ndjson') {
      try {
        JSON.parse(firstLine);
        return {
          formatType: 'jsonl',
          confidence: 0.98,
          evidence: ['File extension indicates JSONL', 'First line is valid JSON'],
          requiresFieldMapping: !this.hasExactSchema(firstLine),
          structuralHints: { isArray: false },
        };
      } catch {
        // Not valid JSON
      }
    }
    
    // Check for JSON array
    if (firstLine.startsWith('[')) {
      try {
        const fullContent = sampleLines.join('\n');
        const parsed = JSON.parse(fullContent);
        if (Array.isArray(parsed)) {
          return {
            formatType: 'json_array',
            confidence: 0.95,
            evidence: ['Content is JSON array'],
            requiresFieldMapping: !this.hasExactSchemaInArray(parsed),
            structuralHints: { isArray: true },
          };
        }
      } catch {
        // Not valid JSON array
      }
    }
    
    // Check for JSON object (single or OTEL/Jaeger structure)
    if (firstLine.startsWith('{')) {
      try {
        const fullContent = sampleLines.join('\n');
        const parsed = JSON.parse(fullContent);
        
        // Check for OTEL
        if (parsed.resourceSpans || parsed.scopeSpans) {
          return {
            formatType: 'otel',
            confidence: 0.95,
            evidence: ['Contains resourceSpans/scopeSpans structure'],
            requiresFieldMapping: true,
            structuralHints: {
              isArray: false,
              rootPath: 'resourceSpans',
              recordPath: 'resourceSpans[*].scopeSpans[*].spans[*]',
            },
          };
        }
        
        // Check for Jaeger
        if (parsed.data && Array.isArray(parsed.data) && parsed.data[0]?.spans) {
          return {
            formatType: 'jaeger',
            confidence: 0.95,
            evidence: ['Contains data[].spans structure'],
            requiresFieldMapping: true,
            structuralHints: {
              isArray: false,
              rootPath: 'data',
              recordPath: 'data[*].spans[*]',
            },
          };
        }
        
        // Single JSON object - might be JSONL with single line
        return {
          formatType: 'jsonl',
          confidence: 0.85,
          evidence: ['Valid JSON object on first line'],
          requiresFieldMapping: true,
          structuralHints: { isArray: false },
        };
      } catch {
        // Not valid JSON
      }
    }
    
    // Check for CSV
    if (extension === '.csv' || this.looksLikeCsv(sampleLines, ',')) {
      return {
        formatType: 'csv',
        confidence: extension === '.csv' ? 0.95 : 0.8,
        evidence: ['CSV structure detected'],
        requiresFieldMapping: true,
        structuralHints: { isArray: true },
      };
    }
    
    // Check for TSV
    if (extension === '.tsv' || this.looksLikeCsv(sampleLines, '\t')) {
      return {
        formatType: 'tsv',
        confidence: extension === '.tsv' ? 0.95 : 0.8,
        evidence: ['TSV structure detected'],
        requiresFieldMapping: true,
        structuralHints: { isArray: true },
      };
    }
    
    // Unknown format
    return {
      formatType: 'unknown',
      confidence: 0.1,
      evidence: ['Could not identify format'],
      requiresFieldMapping: true,
      structuralHints: { isArray: false },
    };
  }
  
  /**
   * Check if JSON object has exact InferenceEvent schema.
   */
  private hasExactSchema(jsonLine: string): boolean {
    try {
      const obj = JSON.parse(jsonLine);
      const requiredFields = ['id', 'ts', 'provider', 'model', 'input_tokens', 'output_tokens', 'latency_ms'];
      return requiredFields.every(f => f in obj);
    } catch {
      return false;
    }
  }
  
  /**
   * Check if JSON array has exact InferenceEvent schema.
   */
  private hasExactSchemaInArray(arr: unknown[]): boolean {
    if (arr.length === 0) return false;
    const first = arr[0];
    if (!first || typeof first !== 'object') return false;
    const requiredFields = ['id', 'ts', 'provider', 'model', 'input_tokens', 'output_tokens', 'latency_ms'];
    return requiredFields.every(f => f in (first as Record<string, unknown>));
  }
  
  /**
   * Check if lines look like CSV/TSV.
   */
  private looksLikeCsv(lines: string[], delimiter: string): boolean {
    if (lines.length < 2) return false;
    
    const headerCols = lines[0].split(delimiter).length;
    if (headerCols < 3) return false;
    
    // Check if subsequent lines have similar column count
    let consistent = 0;
    for (const line of lines.slice(1, 10)) {
      const cols = line.split(delimiter).length;
      if (Math.abs(cols - headerCols) <= 1) consistent++;
    }
    
    return consistent >= Math.min(lines.length - 1, 5);
  }
  
  /**
   * Parse LLM response to FormatDetectorOutput.
   */
  private parseResponse(
    text: string,
    fallback: FormatDetectorOutput
  ): FormatDetectorOutput {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return fallback;
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        formatType: this.validateFormatType(parsed.formatType) || fallback.formatType,
        confidence: typeof parsed.confidence === 'number' 
          ? Math.min(1, Math.max(0, parsed.confidence)) 
          : fallback.confidence,
        evidence: Array.isArray(parsed.evidence) ? parsed.evidence : fallback.evidence,
        requiresFieldMapping: parsed.requiresFieldMapping ?? fallback.requiresFieldMapping,
        structuralHints: parsed.structuralHints || fallback.structuralHints,
      };
    } catch {
      return fallback;
    }
  }
  
  /**
   * Validate format type string.
   */
  private validateFormatType(type: string): FormatType | null {
    const validTypes: FormatType[] = [
      'jsonl', 'json_array', 'csv', 'tsv',
      'otel', 'jaeger', 'zipkin', 'langsmith',
      'helicone', 'wandb', 'litellm', 'portkey',
      'custom', 'unknown',
    ];
    return validTypes.includes(type as FormatType) ? (type as FormatType) : null;
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export { buildDetectorPrompt, FORMAT_DETECTOR_PROMPT };


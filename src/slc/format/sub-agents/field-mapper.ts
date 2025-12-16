/**
 * FieldMapper Sub-Agent - PeakInfer TDD v1.3 Section 9.3
 * 
 * Purpose: Map source fields to InferenceEvent schema
 * 
 * Context Engineering:
 * - Receives format type, sample records, target schema
 * - Optionally receives codebase logging patterns (combined mode)
 * - Does NOT see raw file content or FormatDetector's internal state
 * 
 * This is the second sub-agent in the format normalization pipeline.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { FormatType, FieldMapping } from '../schemas.js';
import type { FieldMapperInput, FieldMapperOutput } from './types.js';
import type { InferenceEvent } from '../../../types/events.js';

// =============================================================================
// PROMPT TEMPLATE
// =============================================================================

const FIELD_MAPPER_PROMPT = `You are a field mapping agent. Your job is to map fields from a detected format to the InferenceEvent schema.

TARGET SCHEMA (InferenceEvent):
Required fields:
- id: string (unique identifier)
- ts: string (ISO8601 timestamp)
- provider: string (openai, anthropic, google, together, etc.)
- model: string (model name/id)
- input_tokens: number (prompt token count)
- output_tokens: number (completion token count)
- latency_ms: number (response time in milliseconds)

Optional fields:
- intent: string (task type)
- region: string (deployment region)
- tenant: string (tenant/customer id)
- callsite_id: string (code location identifier)
- cost_usd: number (cost in USD)

For each target field, provide a mapping with:
- sourceExpression: JSONPath, column name, or computed formula
- extractionType: "jsonpath" | "column" | "regex" | "computed"
- confidence: 0.0-1.0
- evidence: why this mapping was chosen

RESPOND WITH JSON:
{
  "mappings": [
    {
      "targetField": "id",
      "sourceExpression": "$.request_id",
      "extractionType": "jsonpath",
      "confidence": 0.95,
      "evidence": "Field 'request_id' matches semantic meaning"
    }
  ],
  "overallConfidence": 0.85,
  "unmappedFields": ["intent"],
  "warnings": ["latency_ms might be in seconds, not milliseconds"],
  "usedCodebaseContext": false
}

IMPORTANT:
- Map required fields with highest priority
- Use structural hints to navigate nested structures
- If codebase context is provided, use it to improve confidence
- Be explicit about computed fields (e.g., latency from start/end times)`;

function buildMapperPrompt(input: FieldMapperInput): string {
  let prompt = `${FIELD_MAPPER_PROMPT}

FORMAT TYPE: ${input.formatType}

SAMPLE RECORDS (${input.sampleRecords.length}):
\`\`\`json
${JSON.stringify(input.sampleRecords.slice(0, 3), null, 2)}
\`\`\`
`;

  if (input.structuralHints) {
    prompt += `
STRUCTURAL HINTS:
- isArray: ${input.structuralHints.isArray}
- rootPath: ${input.structuralHints.rootPath || 'none'}
- recordPath: ${input.structuralHints.recordPath || 'none'}
`;
  }

  if (input.codebaseContext) {
    prompt += `
CODEBASE CONTEXT (from static analysis):
Logging patterns found:
${input.codebaseContext.loggingPatterns.slice(0, 5).join('\n')}

Variable names used in logging:
${input.codebaseContext.variableNames.slice(0, 10).join(', ')}

Logger calls:
${input.codebaseContext.loggerCalls.slice(0, 3).map(c => `  ${c.file}:${c.line} - fields: ${c.fields.join(', ')}`).join('\n')}

Use this context to improve field mapping confidence.
`;
  }

  prompt += '\nAnalyze and respond with JSON.';
  return prompt;
}

// =============================================================================
// FIELD MAPPER CLASS
// =============================================================================

export class FieldMapperSubAgent {
  private client: Anthropic;
  private config = {
    name: 'field-mapper',
    purpose: 'Map source fields to InferenceEvent schema',
    maxTokens: 2000,
    temperature: 0,
    requiresApi: true,
  };
  
  constructor() {
    this.client = new Anthropic();
  }
  
  /**
   * Map fields from source format to InferenceEvent schema.
   */
  async mapFields(input: FieldMapperInput): Promise<FieldMapperOutput> {
    // First try heuristic mapping (no API call)
    const heuristicResult = this.heuristicMap(input);
    
    // If we have high confidence mappings for all required fields, skip API
    const requiredFields = input.targetSchema.required;
    const mappedRequired = heuristicResult.mappings.filter(
      m => requiredFields.includes(m.targetField) && m.confidence >= 0.8
    );
    
    if (mappedRequired.length === requiredFields.length && heuristicResult.overallConfidence >= 0.85) {
      return heuristicResult;
    }
    
    // Fall back to LLM mapping
    try {
      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        messages: [
          {
            role: 'user',
            content: buildMapperPrompt(input),
          },
        ],
      });
      
      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type');
      }
      
      return this.parseResponse(content.text, heuristicResult, input.codebaseContext !== undefined);
      
    } catch (error) {
      console.warn('FieldMapper API call failed, using heuristic:', error);
      return heuristicResult;
    }
  }
  
  /**
   * Heuristic field mapping based on common patterns.
   */
  private heuristicMap(input: FieldMapperInput): FieldMapperOutput {
    const mappings: FieldMapping[] = [];
    const unmappedFields: string[] = [];
    const warnings: string[] = [];
    
    if (input.sampleRecords.length === 0) {
      return {
        mappings: [],
        overallConfidence: 0,
        unmappedFields: input.targetSchema.required,
        warnings: ['No sample records available'],
        usedCodebaseContext: false,
      };
    }
    
    const sample = input.sampleRecords[0];
    const allFields = this.getAllFields(sample);
    
    // Common field aliases
    const fieldAliases: Record<string, string[]> = {
      id: ['id', 'event_id', 'request_id', 'trace_id', 'uuid', 'spanId', 'traceId'],
      ts: ['ts', 'timestamp', 'time', 'created_at', 'start_time', 'startTime', '@timestamp', 'startTimeUnixNano'],
      provider: ['provider', 'llm_provider', 'vendor', 'llm.vendor', 'model_provider'],
      model: ['model', 'model_id', 'model_name', 'llm.model', 'llm.request.model'],
      input_tokens: ['input_tokens', 'tokens_in', 'prompt_tokens', 'input_token_count', 'llm.usage.prompt_tokens', 'usage.prompt_tokens'],
      output_tokens: ['output_tokens', 'tokens_out', 'completion_tokens', 'output_token_count', 'llm.usage.completion_tokens', 'usage.completion_tokens'],
      latency_ms: ['latency_ms', 'latency', 'duration_ms', 'response_time_ms', 'duration', 'response_time'],
      intent: ['intent', 'task', 'operation', 'name'],
      region: ['region', 'location', 'datacenter'],
      cost_usd: ['cost_usd', 'cost', 'price_usd', 'total_cost'],
    };
    
    // Map each target field
    for (const targetField of [...input.targetSchema.required, ...input.targetSchema.optional]) {
      const aliases = fieldAliases[targetField] || [targetField];
      let mapped = false;
      
      for (const alias of aliases) {
        // Check direct match
        if (allFields.has(alias)) {
          mappings.push({
            targetField: targetField as keyof InferenceEvent,
            sourceExpression: this.buildSourceExpression(alias, allFields.get(alias)!),
            extractionType: 'jsonpath',
            confidence: alias === targetField ? 1.0 : 0.9,
            evidence: alias === targetField 
              ? `Exact field name match` 
              : `Alias match: ${alias} → ${targetField}`,
          });
          mapped = true;
          break;
        }
        
        // Check nested paths
        const nestedMatch = this.findNestedField(sample, alias);
        if (nestedMatch) {
          mappings.push({
            targetField: targetField as keyof InferenceEvent,
            sourceExpression: nestedMatch.path,
            extractionType: 'jsonpath',
            confidence: 0.8,
            evidence: `Nested field match at ${nestedMatch.path}`,
          });
          mapped = true;
          break;
        }
      }
      
      if (!mapped && input.targetSchema.required.includes(targetField)) {
        unmappedFields.push(targetField);
      }
    }
    
    // Check for computed fields
    if (unmappedFields.includes('latency_ms')) {
      // Check for start/end time that can be computed
      if (allFields.has('startTimeUnixNano') && allFields.has('endTimeUnixNano')) {
        mappings.push({
          targetField: 'latency_ms',
          sourceExpression: '(endTimeUnixNano - startTimeUnixNano) / 1000000',
          extractionType: 'computed',
          confidence: 0.9,
          evidence: 'Computed from startTimeUnixNano and endTimeUnixNano',
        });
        unmappedFields.splice(unmappedFields.indexOf('latency_ms'), 1);
      } else if (allFields.has('startTime') && allFields.has('endTime')) {
        mappings.push({
          targetField: 'latency_ms',
          sourceExpression: 'endTime - startTime',
          extractionType: 'computed',
          confidence: 0.85,
          evidence: 'Computed from startTime and endTime',
        });
        unmappedFields.splice(unmappedFields.indexOf('latency_ms'), 1);
      }
    }
    
    // Warnings
    const latencyMapping = mappings.find(m => m.targetField === 'latency_ms');
    if (latencyMapping && latencyMapping.sourceExpression.includes('duration') && !latencyMapping.sourceExpression.includes('_ms')) {
      warnings.push('latency_ms source might be in seconds or nanoseconds, not milliseconds');
    }
    
    // Calculate overall confidence
    const requiredMappings = mappings.filter(m => input.targetSchema.required.includes(m.targetField));
    const overallConfidence = requiredMappings.length > 0
      ? requiredMappings.reduce((sum, m) => sum + m.confidence, 0) / input.targetSchema.required.length
      : 0;
    
    return {
      mappings,
      overallConfidence,
      unmappedFields,
      warnings,
      usedCodebaseContext: false,
    };
  }
  
  /**
   * Get all field names from a sample record (including nested).
   */
  private getAllFields(obj: unknown, prefix = ''): Map<string, string> {
    const fields = new Map<string, string>();
    
    if (!obj || typeof obj !== 'object') return fields;
    
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const path = prefix ? `${prefix}.${key}` : key;
      fields.set(key, path);
      fields.set(path, path);
      
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const nested = this.getAllFields(value, path);
        for (const [k, v] of nested) {
          fields.set(k, v);
        }
      }
    }
    
    return fields;
  }
  
  /**
   * Find a field in nested structure.
   */
  private findNestedField(obj: unknown, fieldName: string, path = '$'): { value: unknown; path: string } | null {
    if (!obj || typeof obj !== 'object') return null;
    
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const currentPath = `${path}.${key}`;
      
      if (key === fieldName || key.toLowerCase() === fieldName.toLowerCase()) {
        return { value, path: currentPath };
      }
      
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const nested = this.findNestedField(value, fieldName, currentPath);
        if (nested) return nested;
      }
    }
    
    return null;
  }
  
  /**
   * Build source expression for a field.
   */
  private buildSourceExpression(fieldName: string, path: string): string {
    if (path.includes('.')) {
      return `$.${path}`;
    }
    return fieldName;
  }
  
  /**
   * Parse LLM response to FieldMapperOutput.
   */
  private parseResponse(
    text: string,
    fallback: FieldMapperOutput,
    hasCodebaseContext: boolean
  ): FieldMapperOutput {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return fallback;
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      const mappings: FieldMapping[] = (parsed.mappings || []).map((m: any) => ({
        targetField: m.targetField,
        sourceExpression: m.sourceExpression,
        extractionType: ['jsonpath', 'column', 'regex', 'computed'].includes(m.extractionType) 
          ? m.extractionType 
          : 'jsonpath',
        confidence: typeof m.confidence === 'number' ? m.confidence : 0.5,
        evidence: m.evidence,
      }));
      
      return {
        mappings: mappings.length > 0 ? mappings : fallback.mappings,
        overallConfidence: typeof parsed.overallConfidence === 'number' 
          ? parsed.overallConfidence 
          : fallback.overallConfidence,
        unmappedFields: Array.isArray(parsed.unmappedFields) 
          ? parsed.unmappedFields 
          : fallback.unmappedFields,
        warnings: Array.isArray(parsed.warnings) 
          ? parsed.warnings 
          : fallback.warnings,
        usedCodebaseContext: parsed.usedCodebaseContext ?? hasCodebaseContext,
      };
    } catch {
      return fallback;
    }
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export { buildMapperPrompt, FIELD_MAPPER_PROMPT };


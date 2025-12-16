/**
 * MappingValidator Sub-Agent - PeakInfer TDD v1.3 Section 9.3
 * 
 * Purpose: Validate extracted values match expected constraints
 * 
 * Context Engineering:
 * - Receives ONLY mappings and sample extracted values
 * - Does NOT see raw file, format detection, or codebase context
 * - Can be done deterministically (no API call required)
 * 
 * This is the third sub-agent in the format normalization pipeline.
 */

import type { MappingValidatorInput, MappingValidatorOutput } from './types.js';

// =============================================================================
// VALIDATION LOGIC
// =============================================================================

/**
 * Validate a timestamp value.
 */
function validateTimestamp(value: unknown): { valid: boolean; issue?: string } {
  if (typeof value === 'string') {
    // ISO8601 format
    const isoMatch = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value);
    if (isoMatch) return { valid: true };
    
    // Try to parse as date
    const parsed = Date.parse(value);
    if (!isNaN(parsed)) return { valid: true };
    
    return { valid: false, issue: 'Not a valid timestamp format' };
  }
  
  if (typeof value === 'number') {
    // Unix timestamp (seconds or milliseconds)
    if (value > 1000000000000) {
      // Likely milliseconds
      return { valid: true };
    }
    if (value > 1000000000) {
      // Likely seconds
      return { valid: true };
    }
    return { valid: false, issue: 'Number too small to be a valid Unix timestamp' };
  }
  
  return { valid: false, issue: `Expected string or number, got ${typeof value}` };
}

/**
 * Validate a provider value.
 */
function validateProvider(value: unknown, validValues?: string[]): { valid: boolean; issue?: string } {
  if (typeof value !== 'string') {
    return { valid: false, issue: `Expected string, got ${typeof value}` };
  }
  
  if (value.length === 0) {
    return { valid: false, issue: 'Provider cannot be empty' };
  }
  
  if (validValues && validValues.length > 0) {
    const normalized = value.toLowerCase();
    const isValid = validValues.some(v => v.toLowerCase() === normalized);
    if (!isValid) {
      return { valid: true }; // Unknown provider is still valid, just not recognized
    }
  }
  
  return { valid: true };
}

/**
 * Validate a numeric value with constraints.
 */
function validateNumber(value: unknown, min?: number, max?: number): { valid: boolean; issue?: string } {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  
  if (typeof num !== 'number' || isNaN(num)) {
    return { valid: false, issue: `Expected number, got ${typeof value}` };
  }
  
  if (min !== undefined && num < min) {
    return { valid: false, issue: `Value ${num} is less than minimum ${min}` };
  }
  
  if (max !== undefined && num > max) {
    return { valid: false, issue: `Value ${num} exceeds maximum ${max}` };
  }
  
  return { valid: true };
}

/**
 * Validate a string value.
 */
function validateString(value: unknown): { valid: boolean; issue?: string } {
  if (typeof value !== 'string') {
    return { valid: false, issue: `Expected string, got ${typeof value}` };
  }
  
  if (value.length === 0) {
    return { valid: false, issue: 'String cannot be empty' };
  }
  
  return { valid: true };
}

// =============================================================================
// MAPPING VALIDATOR CLASS
// =============================================================================

export class MappingValidatorSubAgent {
  private config = {
    name: 'mapping-validator',
    purpose: 'Validate extracted values match expected constraints',
    maxTokens: 500,
    temperature: 0,
    requiresApi: false, // Fully deterministic
  };
  
  /**
   * Validate field mappings against extracted sample values.
   * This is fully deterministic - no API call needed.
   */
  validate(input: MappingValidatorInput): MappingValidatorOutput {
    const fieldResults: MappingValidatorOutput['fieldResults'] = [];
    const suggestions: string[] = [];
    let totalConfidenceAdjustment = 0;
    let validCount = 0;
    
    // Known valid providers for reference
    const knownProviders = [
      'openai', 'anthropic', 'google', 'cohere', 'mistral',
      'together', 'fireworks', 'groq', 'aws-bedrock', 'azure-openai',
      'gcp-vertex', 'databricks', 'replicate', 'anyscale',
    ];
    
    // Validate each mapping
    for (const mapping of input.mappings) {
      const field = mapping.targetField;
      const samples = input.extractedSamples[field] || [];
      
      // Skip if no samples
      if (samples.length === 0) {
        fieldResults.push({
          field,
          isValid: false,
          confidence: 0,
          issue: 'No extracted samples to validate',
        });
        totalConfidenceAdjustment -= 0.1;
        continue;
      }
      
      // Validate based on field type
      let validSamples = 0;
      let lastIssue: string | undefined;
      
      for (const sample of samples) {
        let result: { valid: boolean; issue?: string };
        
        switch (field) {
          case 'ts':
            result = validateTimestamp(sample);
            break;
          case 'provider':
            result = validateProvider(sample, knownProviders);
            break;
          case 'model':
          case 'id':
          case 'intent':
          case 'region':
          case 'tenant':
          case 'callsite_id':
            result = validateString(sample);
            break;
          case 'input_tokens':
          case 'output_tokens':
            result = validateNumber(sample, 0);
            break;
          case 'latency_ms':
            result = validateNumber(sample, 0);
            // Additional check: latency should be reasonable
            if (result.valid && typeof sample === 'number') {
              if (sample > 300000) { // > 5 minutes
                result = { valid: false, issue: 'Latency seems too high (> 5 minutes)' };
              } else if (sample < 1 && sample > 0) {
                // Might be in seconds, not milliseconds
                suggestions.push(`${field} values are < 1, might be in seconds instead of milliseconds`);
              }
            }
            break;
          case 'cost_usd':
            result = validateNumber(sample, 0);
            break;
          default:
            result = { valid: true };
        }
        
        if (result.valid) {
          validSamples++;
        } else {
          lastIssue = result.issue;
        }
      }
      
      const validRatio = validSamples / samples.length;
      const isFieldValid = validRatio >= 0.8; // 80% threshold
      const fieldConfidence = mapping.confidence * validRatio;
      
      fieldResults.push({
        field,
        isValid: isFieldValid,
        confidence: fieldConfidence,
        issue: !isFieldValid ? lastIssue : undefined,
        suggestion: this.getSuggestionForField(field, samples, !isFieldValid),
      });
      
      if (isFieldValid) {
        validCount++;
      } else {
        // Adjust confidence down for invalid fields
        totalConfidenceAdjustment -= (1 - validRatio) * 0.2;
      }
    }
    
    // Add general suggestions
    if (fieldResults.some(r => r.field === 'latency_ms' && r.isValid)) {
      const latencySamples = input.extractedSamples['latency_ms'] || [];
      const avgLatency = latencySamples.reduce((sum: number, v) => sum + (typeof v === 'number' ? v : 0), 0) / latencySamples.length;
      
      if (avgLatency > 0 && avgLatency < 1) {
        suggestions.push('Average latency < 1ms suggests values might be in seconds');
      } else if (avgLatency > 100000) {
        suggestions.push('Very high latency values - check if these are in the correct unit');
      }
    }
    
    // Check for timestamp format consistency
    const tsSamples = input.extractedSamples['ts'] || [];
    if (tsSamples.length > 0) {
      const hasIso = tsSamples.some(s => typeof s === 'string' && s.includes('T'));
      const hasUnix = tsSamples.some(s => typeof s === 'number');
      if (hasIso && hasUnix) {
        suggestions.push('Mixed timestamp formats detected (ISO and Unix)');
      }
    }
    
    const isValid = validCount === input.mappings.length;
    
    return {
      isValid,
      fieldResults,
      confidenceAdjustment: Math.max(-0.5, Math.min(0.1, totalConfidenceAdjustment)),
      suggestions,
    };
  }
  
  /**
   * Get suggestion for a specific field based on samples.
   */
  private getSuggestionForField(field: string, samples: unknown[], hasIssue: boolean): string | undefined {
    if (!hasIssue) return undefined;
    
    switch (field) {
      case 'ts':
        return 'Try extracting from a different timestamp field or converting format';
      case 'provider':
        return 'Check if provider is nested in a different path';
      case 'input_tokens':
      case 'output_tokens':
        return 'Check for usage.prompt_tokens or similar nested structure';
      case 'latency_ms':
        return 'Check if duration is in seconds (multiply by 1000) or nanoseconds (divide by 1000000)';
      default:
        return undefined;
    }
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export { validateTimestamp, validateProvider, validateNumber, validateString };


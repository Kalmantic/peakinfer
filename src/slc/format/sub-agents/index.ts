/**
 * Sub-Agents Module - PeakInfer TDD v1.3 Section 9.3
 * 
 * Exports for the format normalization sub-agent architecture:
 * 
 * Pipeline: FormatDetector → FieldMapper → MappingValidator
 * 
 * Each sub-agent receives only the context it needs (Context Engineering).
 */

// Types
export * from './types.js';

// Sub-agents
export { FormatDetectorSubAgent } from './format-detector.js';
export { FieldMapperSubAgent } from './field-mapper.js';
export { MappingValidatorSubAgent } from './mapping-validator.js';


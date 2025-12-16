/**
 * Format Normalization Module - PeakInfer TDD v1.3
 * 
 * Main exports for the format normalization pipeline.
 */

// Schemas and types
export type {
  FormatType,
  FormatDetection,
  FieldMapping,
  ParseResult,
  NormalizationResult,
  ExtractionType,
  FormatSignature,
} from './schemas.js';

export {
  DIRECT_PARSE_FORMATS,
  AGENT_NORMALIZED_FORMATS,
  FIELD_ALIASES,
  FORMAT_SIGNATURES,
  CONFIDENCE_THRESHOLDS,
  REQUIRED_FIELDS,
  DESIRED_FIELDS,
  ALL_MAPPABLE_FIELDS,
} from './schemas.js';

// Detector
export { detectFormat } from './detector.js';

// Main normalizer
export {
  normalizeEventsFile,
  normalizeWithCodebaseContext,
  type NormalizerOptions,
  type CodebaseAwareParseResult,
} from './normalizer.js';

// Agent normalizer
export {
  detectFormatWithAgent,
  mapFieldsWithAgent,
  validateMappingsWithAgent,
  normalizeWithAgent,
  extractLoggingContext,
  type AgentNormalizerConfig,
  type AgentNormalizationResult,
} from './agent-normalizer.js';

// Direct parsers
export {
  parseJsonl,
  parseJsonArray,
  parseCsv,
  type JsonlParserOptions,
  type JsonArrayParserOptions,
  type CsvParserOptions,
} from './parsers/index.js';

// Observability adapters
export {
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

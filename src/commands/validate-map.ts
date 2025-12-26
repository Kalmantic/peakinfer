/**
 * Validate-Map Command (v1.9.3)
 *
 * CLI command for validating InferenceMap JSON files against the v0.1 schema.
 * Per PRD v1.9.3: `peakinfer validate-map ./analysis.json`
 */

import { Command } from 'commander';
import { existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// =============================================================================
// TYPES
// =============================================================================

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

interface ValidationError {
  path: string;
  message: string;
  expected?: string;
  actual?: string;
}

interface ValidationWarning {
  path: string;
  message: string;
}

// =============================================================================
// SCHEMA VALIDATION
// =============================================================================

/**
 * Load the InferenceMap v0.1 JSON Schema
 */
function loadSchema(): object {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const schemaPath = resolve(__dirname, '../../schemas/inference-map.v0.1.json');

  if (!existsSync(schemaPath)) {
    throw new Error(`Schema not found at ${schemaPath}`);
  }

  return JSON.parse(readFileSync(schemaPath, 'utf-8'));
}

/**
 * Validate an InferenceMap against the v0.1 schema.
 * Performs structural validation without external dependencies.
 */
function validateInferenceMap(data: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Type guard
  if (typeof data !== 'object' || data === null) {
    errors.push({ path: '$', message: 'InferenceMap must be an object' });
    return { valid: false, errors, warnings };
  }

  const map = data as Record<string, unknown>;

  // Required fields
  const requiredFields = ['version', 'root', 'generatedAt', 'summary', 'callsites'];
  for (const field of requiredFields) {
    if (!(field in map)) {
      errors.push({ path: `$.${field}`, message: `Missing required field: ${field}` });
    }
  }

  // Version check
  if ('version' in map && map.version !== '0.1') {
    errors.push({
      path: '$.version',
      message: 'Invalid version',
      expected: '0.1',
      actual: String(map.version),
    });
  }

  // Root validation
  if ('root' in map && typeof map.root !== 'string') {
    errors.push({ path: '$.root', message: 'root must be a string' });
  }

  // generatedAt validation (ISO 8601)
  if ('generatedAt' in map) {
    if (typeof map.generatedAt !== 'string') {
      errors.push({ path: '$.generatedAt', message: 'generatedAt must be a string' });
    } else {
      const date = new Date(map.generatedAt);
      if (isNaN(date.getTime())) {
        errors.push({ path: '$.generatedAt', message: 'generatedAt must be a valid ISO 8601 date-time' });
      }
    }
  }

  // Summary validation
  if ('summary' in map) {
    if (typeof map.summary !== 'object' || map.summary === null) {
      errors.push({ path: '$.summary', message: 'summary must be an object' });
    } else {
      const summary = map.summary as Record<string, unknown>;

      // Required summary fields
      const summaryRequired = ['totalCallsites', 'providers', 'models', 'patterns'];
      for (const field of summaryRequired) {
        if (!(field in summary)) {
          errors.push({ path: `$.summary.${field}`, message: `Missing required field: ${field}` });
        }
      }

      // Type checks
      if ('totalCallsites' in summary && typeof summary.totalCallsites !== 'number') {
        errors.push({ path: '$.summary.totalCallsites', message: 'totalCallsites must be a number' });
      }
      if ('providers' in summary && !Array.isArray(summary.providers)) {
        errors.push({ path: '$.summary.providers', message: 'providers must be an array' });
      }
      if ('models' in summary && !Array.isArray(summary.models)) {
        errors.push({ path: '$.summary.models', message: 'models must be an array' });
      }
      if ('patterns' in summary && (typeof summary.patterns !== 'object' || summary.patterns === null)) {
        errors.push({ path: '$.summary.patterns', message: 'patterns must be an object' });
      }
    }
  }

  // Callsites validation
  if ('callsites' in map) {
    if (!Array.isArray(map.callsites)) {
      errors.push({ path: '$.callsites', message: 'callsites must be an array' });
    } else {
      const callsites = map.callsites as unknown[];
      for (let i = 0; i < callsites.length; i++) {
        const callsite = callsites[i];
        if (typeof callsite !== 'object' || callsite === null) {
          errors.push({ path: `$.callsites[${i}]`, message: 'callsite must be an object' });
          continue;
        }

        const cs = callsite as Record<string, unknown>;

        // Required callsite fields
        const callsiteRequired = ['id', 'file', 'line', 'patterns', 'confidence'];
        for (const field of callsiteRequired) {
          if (!(field in cs)) {
            errors.push({ path: `$.callsites[${i}].${field}`, message: `Missing required field: ${field}` });
          }
        }

        // Type checks
        if ('id' in cs && typeof cs.id !== 'string') {
          errors.push({ path: `$.callsites[${i}].id`, message: 'id must be a string' });
        }
        if ('file' in cs && typeof cs.file !== 'string') {
          errors.push({ path: `$.callsites[${i}].file`, message: 'file must be a string' });
        }
        if ('line' in cs) {
          if (typeof cs.line !== 'number' || !Number.isInteger(cs.line) || cs.line < 1) {
            errors.push({ path: `$.callsites[${i}].line`, message: 'line must be a positive integer' });
          }
        }
        if ('confidence' in cs) {
          if (typeof cs.confidence !== 'number' || cs.confidence < 0 || cs.confidence > 1) {
            errors.push({ path: `$.callsites[${i}].confidence`, message: 'confidence must be a number between 0 and 1' });
          }
        }
        if ('patterns' in cs && (typeof cs.patterns !== 'object' || cs.patterns === null)) {
          errors.push({ path: `$.callsites[${i}].patterns`, message: 'patterns must be an object' });
        }

        // Provider validation (known providers)
        const validProviders = [
          'openai', 'anthropic', 'google', 'cohere', 'mistral',
          'bedrock', 'azure_openai', 'together', 'fireworks',
          'groq', 'replicate', 'perplexity',
          'vllm', 'sglang', 'tgi', 'ollama', 'llamacpp',
          'unknown',
        ];
        if ('provider' in cs && cs.provider !== null && typeof cs.provider === 'string') {
          if (!validProviders.includes(cs.provider)) {
            warnings.push({
              path: `$.callsites[${i}].provider`,
              message: `Unknown provider: ${cs.provider}. Known providers: ${validProviders.join(', ')}`,
            });
          }
        }
      }
    }
  }

  // Metadata validation (optional)
  if ('metadata' in map && map.metadata !== null) {
    if (typeof map.metadata !== 'object') {
      warnings.push({ path: '$.metadata', message: 'metadata should be an object' });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// =============================================================================
// OUTPUT FORMATTING
// =============================================================================

/**
 * Format validation results for terminal output
 */
function formatResults(result: ValidationResult, filePath: string): void {
  console.log('');
  console.log(`InferenceMap Validation: ${filePath}`);
  console.log('─'.repeat(60));

  if (result.valid) {
    console.log('✓ Valid InferenceMap v0.1');
  } else {
    console.log('✗ Invalid InferenceMap');
  }
  console.log('');

  if (result.errors.length > 0) {
    console.log(`Errors (${result.errors.length}):`);
    for (const error of result.errors) {
      console.log(`  ✗ ${error.path}: ${error.message}`);
      if (error.expected !== undefined) {
        console.log(`    Expected: ${error.expected}`);
        console.log(`    Actual: ${error.actual}`);
      }
    }
    console.log('');
  }

  if (result.warnings.length > 0) {
    console.log(`Warnings (${result.warnings.length}):`);
    for (const warning of result.warnings) {
      console.log(`  ⚠ ${warning.path}: ${warning.message}`);
    }
    console.log('');
  }

  if (result.valid && result.warnings.length === 0) {
    console.log('No issues found.');
    console.log('');
  }
}

// =============================================================================
// COMMAND REGISTRATION
// =============================================================================

/**
 * Register the validate-map command
 */
export function registerValidateMapCommand(program: Command): void {
  program
    .command('validate-map')
    .description('validate an InferenceMap JSON file against the v0.1 schema')
    .argument('<file>', 'path to InferenceMap JSON file')
    .option('--json', 'output validation results as JSON')
    .option('--quiet', 'only output errors (exit code indicates validity)')
    .action((file: string, options: { json?: boolean; quiet?: boolean }) => {
      try {
        // Resolve file path
        const filePath = resolve(file);

        // Check file exists
        if (!existsSync(filePath)) {
          console.error(`Error: File not found: ${filePath}`);
          process.exit(1);
        }

        // Read and parse file
        let data: unknown;
        try {
          const content = readFileSync(filePath, 'utf-8');
          data = JSON.parse(content);
        } catch (parseError) {
          if (options.json) {
            console.log(JSON.stringify({
              valid: false,
              errors: [{
                path: '$',
                message: `Invalid JSON: ${parseError instanceof Error ? parseError.message : 'Parse error'}`,
              }],
              warnings: [],
            }, null, 2));
          } else if (!options.quiet) {
            console.error(`Error: Invalid JSON in ${file}`);
            console.error(parseError instanceof Error ? parseError.message : 'Parse error');
          }
          process.exit(1);
        }

        // Validate
        const result = validateInferenceMap(data);

        // Output results
        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
        } else if (!options.quiet) {
          formatResults(result, file);
        }

        // Exit with appropriate code
        process.exit(result.valid ? 0 : 1);

      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : 'Validation failed');
        process.exit(1);
      }
    });
}

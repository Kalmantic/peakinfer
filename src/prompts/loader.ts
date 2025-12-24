/**
 * =============================================================================
 * SYNC NOTE: This file is copied from peakinfer-site (SOURCE OF TRUTH)
 * Source: peakinfer-site/lib/prompts/loader.ts
 *
 * DO NOT MODIFY THIS FILE DIRECTLY IN THE CLI REPO.
 * All changes must be made in peakinfer-site first, then synced here.
 * =============================================================================
 */

/**
 * Prompt Loader
 * Loads prompts from YAML config files for consistency with CLI
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { fileURLToPath } from 'url';

export interface PromptConfig {
  id: string;
  name: string;
  version: string;
  description: string;
  system: string;
  user_template?: string;
  input_schema?: Record<string, string>;
  output_format?: unknown;
  constraints?: string[];
  defaults?: Record<string, unknown>;
}

/**
 * Load a prompt config from YAML file
 * Note: No caching - always reads fresh to ensure latest prompts are used
 */
export function loadPrompt(promptId: string): PromptConfig {
  // Determine prompts directory path - works in ESM
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  // Go up from src/prompts to root, then into prompts/
  const promptsDir = path.resolve(__dirname, '../../prompts');
  const promptPath = path.join(promptsDir, `${promptId}.yaml`);

  if (!fs.existsSync(promptPath)) {
    throw new Error(`Prompt config not found: ${promptPath}`);
  }

  const content = fs.readFileSync(promptPath, 'utf-8');
  const config = yaml.parse(content) as PromptConfig;

  // Validate required fields
  if (!config.id || !config.system) {
    throw new Error(`Invalid prompt config: ${promptId} - missing required fields`);
  }

  return config;
}

/**
 * Format user message using template
 */
export function formatUserMessage(
  template: string,
  variables: Record<string, string>
): string {
  let message = template;
  for (const [key, value] of Object.entries(variables)) {
    message = message.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return message;
}

/**
 * Get the unified analyzer prompt
 */
export function getUnifiedAnalyzerPrompt(): {
  system: string;
  userTemplate: string;
} {
  const config = loadPrompt('unified-analyzer');
  return {
    system: config.system,
    userTemplate: config.user_template || '',
  };
}

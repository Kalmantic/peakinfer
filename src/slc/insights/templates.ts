/**
 * Insight Template Loader - PeakInfer TDD v1.3
 * 
 * Loads insight templates from YAML configuration.
 * Templates allow customizing insight copy without changing code.
 */

import * as fs from 'fs';
import * as path from 'path';
import yaml from 'yaml';
import type { InsightCategory, InsightSeverity } from './engine.js';

// =============================================================================
// TYPES
// =============================================================================

export interface InsightTemplate {
  id: string;
  severity: InsightSeverity;
  headline: string;
  description: string;
  action?: string;
  triggers: Record<string, unknown>[];
}

export interface InsightTemplates {
  version: string;
  cost: Record<string, InsightTemplate>;
  drift: Record<string, InsightTemplate>;
  pattern: Record<string, InsightTemplate>;
  performance: Record<string, InsightTemplate>;
  configuration: Record<string, InsightTemplate>;
}

// =============================================================================
// TEMPLATE LOADING
// =============================================================================

let cachedTemplates: InsightTemplates | null = null;

/**
 * Load insight templates from YAML file.
 * Templates are cached after first load.
 */
export function loadInsightTemplates(): InsightTemplates {
  if (cachedTemplates) return cachedTemplates;
  
  const templatePath = path.join(__dirname, 'templates.yaml');
  
  // Check if file exists, otherwise return defaults
  if (!fs.existsSync(templatePath)) {
    console.warn('Insight templates not found, using defaults');
    return getDefaultTemplates();
  }
  
  try {
    const content = fs.readFileSync(templatePath, 'utf-8');
    cachedTemplates = yaml.parse(content) as InsightTemplates;
    return cachedTemplates;
  } catch (error) {
    console.warn('Failed to load insight templates, using defaults:', error);
    return getDefaultTemplates();
  }
}

/**
 * Get a specific template by category and key.
 */
export function getTemplate(
  category: keyof Omit<InsightTemplates, 'version'>,
  key: string
): InsightTemplate | null {
  const templates = loadInsightTemplates();
  return templates[category]?.[key] || null;
}

/**
 * Interpolate template variables.
 * Replaces {{var}} with values from context.
 */
export function interpolateTemplate(
  template: string,
  context: Record<string, unknown>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = context[key];
    if (value === undefined) return match;
    return String(value);
  });
}

/**
 * Build insight from template with context.
 */
export function buildInsightFromTemplate(
  template: InsightTemplate,
  context: Record<string, unknown>,
  category: InsightCategory,
  affected: Array<{ file: string; line?: number }>
): {
  id: string;
  category: InsightCategory;
  severity: InsightSeverity;
  headline: string;
  description: string;
  affected: Array<{ file: string; line?: number }>;
  action?: string;
  evidence: string[];
} {
  return {
    id: template.id,
    category,
    severity: template.severity,
    headline: interpolateTemplate(template.headline, context),
    description: interpolateTemplate(template.description, context).trim(),
    affected,
    action: template.action ? interpolateTemplate(template.action, context) : undefined,
    evidence: context.evidence as string[] || [],
  };
}

// =============================================================================
// DEFAULT TEMPLATES (fallback)
// =============================================================================

function getDefaultTemplates(): InsightTemplates {
  return {
    version: '1.3.0',
    cost: {
      gpt4_to_mini: {
        id: 'cost-model-swap-gpt4',
        severity: 'opportunity',
        headline: 'GPT-4 → GPT-4o-mini could reduce costs ~{{savings}}%',
        description: '{{count}} inference points use GPT-4 which costs ~150x more than GPT-4o-mini.',
        action: 'Evaluate if GPT-4o-mini meets quality requirements',
        triggers: [{ model_contains: 'gpt-4' }, { model_not_contains: 'mini' }],
      },
    },
    drift: {
      dead_code: {
        id: 'drift-dead-code',
        severity: 'warning',
        headline: '{{count}} inference point(s) never exercised',
        description: 'These callsites exist in code but were never observed at runtime.',
        action: 'Review if these callsites are needed',
        triggers: [{ code_only_count_gt: 0 }],
      },
    },
    pattern: {
      fake_streaming: {
        id: 'pattern-fake-streaming',
        severity: 'warning',
        headline: 'Your streaming is fake',
        description: 'Code shows streaming patterns but runtime suggests otherwise.',
        action: 'Check proxy configuration',
        triggers: [{ pattern_detected: 'streaming' }],
      },
    },
    performance: {
      high_p95: {
        id: 'perf-high-p95',
        severity: 'warning',
        headline: 'p95 latency is {{p95_seconds}}s',
        description: '5% of requests take over {{p95_seconds}} seconds.',
        triggers: [{ p95_latency_gt: 5000 }],
      },
    },
    configuration: {
      no_timeout: {
        id: 'config-no-timeout',
        severity: 'warning',
        headline: 'No timeout configured',
        description: 'LLM requests can hang indefinitely without timeouts.',
        action: 'Add explicit timeout configuration',
        triggers: [{ config_missing: 'timeout' }],
      },
    },
  };
}

// =============================================================================
// TEMPLATE VALIDATION
// =============================================================================

/**
 * Validate that templates match expected schema.
 */
export function validateTemplates(templates: InsightTemplates): string[] {
  const errors: string[] = [];
  
  const requiredCategories = ['cost', 'drift', 'pattern', 'performance', 'configuration'];
  
  for (const category of requiredCategories) {
    if (!templates[category as keyof typeof templates]) {
      errors.push(`Missing category: ${category}`);
      continue;
    }
    
    const categoryTemplates = templates[category as keyof typeof templates] as Record<string, InsightTemplate>;
    
    for (const [key, template] of Object.entries(categoryTemplates)) {
      if (!template.id) errors.push(`${category}.${key}: missing id`);
      if (!template.severity) errors.push(`${category}.${key}: missing severity`);
      if (!template.headline) errors.push(`${category}.${key}: missing headline`);
      if (!template.description) errors.push(`${category}.${key}: missing description`);
      if (!Array.isArray(template.triggers)) errors.push(`${category}.${key}: triggers must be array`);
    }
  }
  
  return errors;
}


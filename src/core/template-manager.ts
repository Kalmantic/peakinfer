/**
 * Template Manager - Enhanced Version
 * Manages file-based templates with caching and validation
 * Based on PRD v0.7: File-Based Template Repository System
 */

import fsPkg from 'fs-extra';
const { readFile, pathExists, writeJson, readJson, ensureDir, stat, remove } = fsPkg;
import { existsSync } from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import * as os from 'os';
import { fileURLToPath } from 'url';
import { glob } from 'glob';
import { OptimizationTemplate, EnvironmentProfile } from '../types/template.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class TemplateManager {
  private templates: Map<string, OptimizationTemplate> = new Map();
  private templatesLoaded = false;
  private cacheDir: string;
  private templateDirs: string[];

  constructor(templateDirs?: string[]) {
    this.cacheDir = path.join(os.homedir(), '.peakinfer', 'templates');
    this.templateDirs = templateDirs || this.findTemplateDirs();
  }

  /**
   * Load all templates from directories and cache
   */
  async loadTemplates(): Promise<void> {
    console.log('📋 Loading optimization templates...');

    // Ensure cache directory exists
    await ensureDir(this.cacheDir);

    try {
      // Load from template directories
      for (const templateDir of this.templateDirs) {
        if (await pathExists(templateDir)) {
          await this.loadTemplatesFromDirectory(templateDir);
        }
      }

      // Load from cache if no templates found
      if (this.templates.size === 0) {
        await this.loadTemplatesFromCache();
      }

      // Cache loaded templates
      if (this.templates.size > 0) {
        await this.cacheTemplates();
      }

      console.log(`✅ Loaded ${this.templates.size} optimization templates`);
      this.templatesLoaded = true;
    } catch (error) {
      console.error('❌ Failed to load templates:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Load templates from a directory
   */
  private async loadTemplatesFromDirectory(dir: string): Promise<void> {
    console.log(`  📁 Loading templates from ${dir}...`);

    // Find all markdown files
    const templateFiles = await glob('**/*.md', {
      cwd: dir,
      absolute: true,
      ignore: ['**/node_modules/**', '**/.git/**'],
    });

    for (const file of templateFiles) {
      try {
        const template = await this.parseTemplateFile(file);
        if (template) {
          this.templates.set(template.id, template);
          console.log(`  ✅ Loaded: ${template.id} - ${template.name}`);
        }
      } catch (error) {
        console.warn(`  ⚠️  Failed to parse ${file}:`, error instanceof Error ? error.message : String(error));
      }
    }
  }

  /**
   * Parse a template markdown file
   */
  private async parseTemplateFile(filePath: string): Promise<OptimizationTemplate | null> {
    const content = await readFile(filePath, {encoding: 'utf-8'});

    // Extract YAML frontmatter from markdown (can be anywhere in the file, not just at start)
    const frontmatterMatch = content.match(/\n---\s*\n([\s\S]*?)\n---/);
    
    if (!frontmatterMatch) {
      console.warn(`  ⚠️  No YAML frontmatter found in ${path.basename(filePath)}`);
      return null;
    }

    const frontmatter = frontmatterMatch[1];
    const template = yaml.parse(frontmatter) as OptimizationTemplate;

    // Validate template structure
    if (!template.id || !template.name || !template.category) {
      console.warn(`  ⚠️  Invalid template structure in ${path.basename(filePath)}`);
      return null;
    }

    // Add markdown content as description if needed
    const markdownContent = content.substring(frontmatterMatch[0].length).trim();
    if (markdownContent && !template.description) {
      const firstParagraph = markdownContent.split('\n\n')[0];
      template.description = firstParagraph.substring(0, 200) + '...';
    }

    return template;
  }

  /**
   * Load templates from cache
   */
  private async loadTemplatesFromCache(): Promise<void> {
    const cacheFile = path.join(this.cacheDir, 'templates.json');

    if (await pathExists(cacheFile)) {
      console.log('  📦 Loading templates from cache...');
      const cached = await readJson(cacheFile);
      
      for (const template of cached) {
        this.templates.set(template.id, template);
      }
    }
  }

  /**
   * Cache templates to disk
   */
  private async cacheTemplates(): Promise<void> {
    const cacheFile = path.join(this.cacheDir, 'templates.json');
    const templates = Array.from(this.templates.values());
    
    await writeJson(cacheFile, templates, { spaces: 2 });
    console.log(`  💾 Cached ${templates.length} templates to ${this.cacheDir}`);
  }

  /**
   * Find template directories
   */
  private findTemplateDirs(): string[] {
    const possibleDirs = [
      path.join(process.cwd(), 'templates'),
      path.join(__dirname, '..', '..', 'templates'),
      path.join(os.homedir(), '.peakinfer', 'templates'),
    ];

    const foundDirs = possibleDirs.filter(dir => {
      try {
        // Use Node's built-in existsSync
        const exists = existsSync(dir);
        if (exists) {
          console.log(`  📁 Found template directory: ${dir}`);
        }
        return exists;
      } catch (err) {
        console.log(`  ❌ Error checking ${dir}:`, err);
        return false;
      }
    });

    if (foundDirs.length === 0) {
      console.log(`  ⚠️  No template directories found. Searched:`);
      possibleDirs.forEach(dir => console.log(`     - ${dir}`));
    }

    return foundDirs;
  }

  /**
   * Find matching templates for an environment
   */
  async findMatchingTemplates(environment: EnvironmentProfile): Promise<OptimizationTemplate[]> {
    if (!this.templatesLoaded) {
      await this.loadTemplates();
    }

    const matchingTemplates: OptimizationTemplate[] = [];

    for (const template of this.templates.values()) {
      const matchScore = this.calculateMatchScore(template, environment);

      if (matchScore > 0.5) {
        // Add match score to template for sorting
        (template as any).matchScore = matchScore;
        matchingTemplates.push(template);
      }
    }

    // Sort by confidence score and match quality
    matchingTemplates.sort((a, b) => {
      const scoreA = a.confidence * ((a as any).matchScore || 0.5);
      const scoreB = b.confidence * ((b as any).matchScore || 0.5);
      return scoreB - scoreA;
    });

    return matchingTemplates;
  }

  /**
   * Calculate match score between template and environment
   */
  private calculateMatchScore(template: OptimizationTemplate, environment: EnvironmentProfile): number {
    const match = template.environment_match;
    let score = 0;
    let criteria = 0;

    // Application Layer Matching
    if (match.runtime) {
      criteria++;
      const runtimes = Array.isArray(match.runtime) ? match.runtime : [match.runtime];
      if (environment.application.runtime_detected.some(r => runtimes.includes(r))) {
        score++;
      }
    }

    if (match.batch_size) {
      criteria++;
      const currentBatchSize = environment.serving.performance_metrics.batch_efficiency;
      if (this.matchesRange(currentBatchSize, match.batch_size)) {
        score++;
      }
    }

    if (match.gpu_utilization) {
      criteria++;
      const utilization = environment.infrastructure.gpu_inventory[0]?.utilization || 0;
      if (this.matchesRange(utilization, match.gpu_utilization)) {
        score++;
      }
    }

    if (match.memory_bound !== undefined) {
      criteria++;
      const memoryEfficiency = environment.infrastructure.memory_analysis.bandwidth_efficiency;
      const isMemoryBound = memoryEfficiency < 0.3;
      if (match.memory_bound === isMemoryBound) {
        score++;
      }
    }

    // If no criteria specified, it's a universal template
    if (criteria === 0) {
      return 0.7; // Decent match for universal templates
    }

    return score / criteria;
  }

  /**
   * Check if a value matches a range specification
   */
  private matchesRange(value: number | string, range: string | string[]): boolean {
    const ranges = Array.isArray(range) ? range : [range];

    for (const r of ranges) {
      if (typeof r === 'string') {
        const numValue = typeof value === 'string' ? parseFloat(value) : value;

        if (r.startsWith('<')) {
          const threshold = parseFloat(r.substring(1).replace('%', ''));
          if (numValue < threshold) return true;
        } else if (r.startsWith('>')) {
          const threshold = parseFloat(r.substring(1).replace('%', ''));
          if (numValue > threshold) return true;
        } else if (r.includes('-')) {
          const [min, max] = r.split('-').map(x => parseFloat(x.replace(/[GB%]/g, '')));
          if (numValue >= min && numValue <= max) return true;
        } else {
          if (value.toString().includes(r) || r.includes(value.toString())) return true;
        }
      }
    }

    return false;
  }

  /**
   * Get template by ID
   */
  getTemplate(templateId: string): OptimizationTemplate | undefined {
    return this.templates.get(templateId);
  }

  /**
   * List all templates
   */
  listTemplates(): OptimizationTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get templates by category
   */
  getTemplatesByCategory(category: string): OptimizationTemplate[] {
    return Array.from(this.templates.values()).filter(t => t.category === category);
  }

  /**
   * Get templates by layer
   */
  getTemplatesByLayer(layer: 'application' | 'serving' | 'infrastructure' | 'cross-layer'): OptimizationTemplate[] {
    const layerMap: Record<string, string[]> = {
      application: ['application_layer', 'model_routing', 'context_optimization', 'quantization'],
      serving: ['serving_layer', 'runtime_optimization', 'concurrency_optimization'],
      infrastructure: ['infrastructure_layer', 'hardware_optimization', 'edge_deployment'],
      'cross-layer': ['cross_layer'],
    };

    const categories = layerMap[layer] || [];
    return Array.from(this.templates.values()).filter(t => categories.includes(t.category));
  }

  /**
   * Validate template structure
   */
  validateTemplate(template: OptimizationTemplate): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Required fields
    if (!template.id) errors.push('Missing required field: id');
    if (!template.name) errors.push('Missing required field: name');
    if (!template.category) errors.push('Missing required field: category');
    if (!template.optimization) errors.push('Missing required field: optimization');
    if (!template.economics) errors.push('Missing required field: economics');
    if (!template.implementation) errors.push('Missing required field: implementation');

    // Validate confidence score
    if (template.confidence !== undefined && (template.confidence < 0 || template.confidence > 1)) {
      errors.push('Confidence must be between 0 and 1');
    }

    // Validate implementation steps
    if (template.implementation?.automated_steps) {
      for (const step of template.implementation.automated_steps) {
        if (!step.step_id) errors.push(`Step missing step_id: ${step.name}`);
        if (!step.validation) errors.push(`Step missing validation: ${step.step_id}`);
        if (!step.validation?.rollback_command) {
          errors.push(`Step missing rollback_command: ${step.step_id}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Sync templates from remote repository (future)
   */
  async syncTemplates(): Promise<void> {
    console.log('🔄 Syncing templates...');
    
    // For now, just reload from local directories
    this.templates.clear();
    await this.loadTemplates();
    
    console.log('✅ Templates synced successfully');
  }

  /**
   * Clear template cache
   */
  async clearCache(): Promise<void> {
    const cacheFile = path.join(this.cacheDir, 'templates.json');
    
    if (await pathExists(cacheFile)) {
      await remove(cacheFile);
      console.log('✅ Template cache cleared');
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<any> {
    const cacheFile = path.join(this.cacheDir, 'templates.json');
    
    if (await pathExists(cacheFile)) {
      const stats = await stat(cacheFile);
      const cached = await readJson(cacheFile);
      
      return {
        exists: true,
        size_bytes: stats.size,
        template_count: cached.length,
        last_modified: stats.mtime,
        cache_dir: this.cacheDir,
      };
    }
    
    return {
      exists: false,
      cache_dir: this.cacheDir,
    };
  }
}


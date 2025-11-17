/**
 * Template Engine - Loads and executes optimization templates
 * This is the core system that turns TokenSqueeze insights into actionable optimizations
 */

import * as yaml from 'yaml';
import fs from 'fs-extra';
import * as path from 'path';
import { glob } from 'glob';
import { OptimizationTemplate, EnvironmentProfile, TemplateExecutionResult } from '../types/template.js';
import https from 'https';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class TemplateEngine {
  private templates: Map<string, OptimizationTemplate> = new Map();
  private templatesLoaded = false;

  constructor(private templatesDirectory?: string) {
    // Default to design/templates or look for templates in standard locations
    // findTemplatesDirectory is async, so it will be called lazily in loadTemplates
  }

  /**
   * Stage 1: Configuration ⏳
   * Load all optimization templates from the design folder
   */
  async loadTemplates(): Promise<void> {
    console.log("Stage 1: Template Loading ⏳");

    // Initialize templates directory if not set
    if (!this.templatesDirectory) {
      this.templatesDirectory = await this.findTemplatesDirectory();
    }

    try {
      // Try local templates first
      await this.extractTemplatesFromDesignDoc();
      await this.loadStandaloneTemplateFiles();

      // If no local templates found, load from GitHub
      if (this.templates.size === 0) {
        console.log("  📡 No local templates found, loading from GitHub repository...");
        await this.loadTemplatesFromGitHub();
      }

      console.log(`Stage 1: Template Loading ✅ - Loaded ${this.templates.size} templates`);
      this.templatesLoaded = true;

    } catch (error) {
      console.error("Stage 1: Template Loading ❌", error);
      throw new Error(`Failed to load templates: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Extract templates from the main design document
   * Parses the TokenOp Template v0.2.md file to extract YAML templates
   */
  private async extractTemplatesFromDesignDoc(): Promise<void> {
    // If templatesDirectory is the design folder, look directly in it
    // Otherwise, look in the parent directory (design folder)
    const templatesDir = this.templatesDirectory || '.';
    const designDocPath = templatesDir.endsWith('design')
      ? path.join(templatesDir, 'TokenOp Template v0.2.md')
      : path.join(templatesDir, '..', 'TokenOp Template v0.2.md');

    if (!await fs.pathExists(designDocPath)) {
      console.log("Design document not found, looking for standalone templates...");
      return;
    }

    const content = await fs.readFile(designDocPath, 'utf-8');

    // Extract YAML blocks from markdown
    const yamlBlocks = this.extractYamlFromMarkdown(content);

    console.log(`Found ${yamlBlocks.length} YAML templates in design document`);

    for (const yamlBlock of yamlBlocks) {
      try {
        const template = yaml.parse(yamlBlock) as OptimizationTemplate;

        if (template.id && template.name) {
          this.templates.set(template.id, template);
          console.log(`  ✅ Loaded template: ${template.id} - ${template.name}`);
        }
      } catch (error) {
        console.warn(`  ⚠️  Failed to parse template YAML: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  /**
   * Extract YAML blocks from markdown content
   */
  private extractYamlFromMarkdown(content: string): string[] {
    const yamlBlocks: string[] = [];
    const lines = content.split('\n');
    let inYamlBlock = false;
    let currentBlock: string[] = [];

    for (const line of lines) {
      if (line.trim() === '```' && inYamlBlock) {
        // End of YAML block
        if (currentBlock.length > 0) {
          const yamlContent = currentBlock.join('\n');
          // Only include blocks that look like template YAML (have id and name)
          if (yamlContent.includes('id:') && yamlContent.includes('name:')) {
            yamlBlocks.push(yamlContent);
          }
        }
        inYamlBlock = false;
        currentBlock = [];
      } else if (line.trim() === '---' && !inYamlBlock) {
        // Start of potential YAML block
        inYamlBlock = true;
        currentBlock = ['---'];
      } else if (inYamlBlock) {
        currentBlock.push(line);
      }
    }

    return yamlBlocks;
  }

  /**
   * Load standalone template files (if any exist)
   */
  private async loadStandaloneTemplateFiles(): Promise<void> {
    if (!await fs.pathExists(this.templatesDirectory || '.')) {
      return;
    }

    const templateFiles = await glob('**/*.{yaml,yml}', {
      cwd: this.templatesDirectory || '.',
      absolute: true
    });

    for (const templateFile of templateFiles) {
      try {
        const content = await fs.readFile(templateFile, 'utf-8');
        const template = yaml.parse(content) as OptimizationTemplate;

        if (template.id && template.name) {
          this.templates.set(template.id, template);
          console.log(`  ✅ Loaded standalone template: ${template.id}`);
        }
      } catch (error) {
        console.warn(`  ⚠️  Failed to load template ${templateFile}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  /**
   * Stage 2: Template Matching ⏳
   * Find templates that match the detected environment
   */
  async findMatchingTemplates(environment: EnvironmentProfile): Promise<OptimizationTemplate[]> {
    console.log("Stage 2: Template Matching ⏳");

    if (!this.templatesLoaded) {
      await this.loadTemplates();
    }

    const matchingTemplates: OptimizationTemplate[] = [];

    for (const template of this.templates.values()) {
      const matchScore = this.calculateMatchScore(template, environment);

      if (matchScore > 0.7) { // 70% match threshold
        console.log(`  ✅ Template match: ${template.id} (score: ${matchScore.toFixed(2)})`);
        matchingTemplates.push(template);
      }
    }

    // Sort by confidence score and match quality
    matchingTemplates.sort((a, b) => {
      return (b.confidence * 100) - (a.confidence * 100);
    });

    console.log(`Stage 2: Template Matching ✅ - Found ${matchingTemplates.length} matching templates`);
    return matchingTemplates;
  }

  /**
   * Calculate how well a template matches the environment
   * Returns score 0-1 (higher = better match)
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
      const isMemoryBound = memoryEfficiency < 0.3; // Low efficiency indicates memory bound
      if (match.memory_bound === isMemoryBound) {
        score++;
      }
    }

    // If no criteria specified, it's a universal template
    if (criteria === 0) {
      return 0.5;
    }

    return score / criteria;
  }

  /**
   * Check if a value matches a range specification
   * Range can be like "<30%", ">1000", "7B-30B", etc.
   */
  private matchesRange(value: number | string, range: string | string[]): boolean {
    const ranges = Array.isArray(range) ? range : [range];

    for (const r of ranges) {
      if (typeof r === 'string') {
        // Handle ranges like "<30%", ">1000", "7B", etc.
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
          // Exact match or contains
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
   * List all available templates
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
   * Find templates directory
   */
  private async findTemplatesDirectory(): Promise<string> {
    const possiblePaths = [
      path.join(process.cwd(), 'design'),
      path.join(process.cwd(), 'design', 'templates'),
      path.join(process.cwd(), 'templates'),
      path.join(__dirname, '..', '..', 'design'),
      path.join(__dirname, '..', '..', 'design', 'templates')
    ];

    for (const possiblePath of possiblePaths) {
      try {
        await fs.access(possiblePath);
        return possiblePath;
      } catch {
        // Continue to next path
      }
    }

    // Default to design directory
    return path.join(process.cwd(), 'design');
  }

  /**
   * Validate template format
   */
  validateTemplate(template: OptimizationTemplate): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Required fields
    if (!template.id) errors.push("Template missing required field: id");
    if (!template.name) errors.push("Template missing required field: name");
    if (!template.category) errors.push("Template missing required field: category");
    if (!template.optimization) errors.push("Template missing required field: optimization");
    if (!template.economics) errors.push("Template missing required field: economics");
    if (!template.implementation) errors.push("Template missing required field: implementation");

    // Validate confidence score
    if (template.confidence !== undefined && (template.confidence < 0 || template.confidence > 1)) {
      errors.push("Template confidence must be between 0 and 1");
    }

    // Validate implementation steps
    if (template.implementation && template.implementation.automated_steps) {
      for (const step of template.implementation.automated_steps) {
        if (!step.step_id) errors.push(`Step missing step_id: ${step.name}`);
        if (!step.validation) errors.push(`Step missing validation: ${step.step_id}`);
        if (!step.validation.rollback_command) {
          errors.push(`Step missing rollback_command: ${step.step_id}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Load templates from GitHub repository
   */
  private async loadTemplatesFromGitHub(): Promise<void> {
    const githubUrl = 'https://raw.githubusercontent.com/Kalmantic/peakinfer/main/peakinfer/design/TokenOp%20Template%20v0.2.md';

    try {
      const content = await this.fetchFromGitHub(githubUrl);
      console.log("  ✅ Downloaded template document from GitHub");

      // Extract YAML blocks from the downloaded content
      const yamlBlocks = this.extractYamlFromMarkdown(content);

      console.log(`  📋 Found ${yamlBlocks.length} potential templates in remote document`);

      for (const yamlBlock of yamlBlocks) {
        try {
          const template = yaml.parse(yamlBlock) as OptimizationTemplate;

          if (template.id && template.name) {
            this.templates.set(template.id, template);
            console.log(`  ✅ Loaded remote template: ${template.id} - ${template.name}`);
          }
        } catch (error) {
          console.warn(`  ⚠️  Failed to parse remote template YAML: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

    } catch (error) {
      console.warn(`  ⚠️  Failed to load templates from GitHub: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Fetch content from GitHub using HTTPS
   */
  private async fetchFromGitHub(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      https.get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }

        let data = '';
        response.on('data', (chunk) => {
          data += chunk;
        });

        response.on('end', () => {
          resolve(data);
        });

      }).on('error', (error) => {
        reject(error);
      });
    });
  }
}
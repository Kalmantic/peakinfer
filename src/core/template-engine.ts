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

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// GitHub repository configuration
const GITHUB_REPO_OWNER = 'Kalmantic';
const GITHUB_REPO_NAME = 'peakinfer_templates';
const GITHUB_BRANCH = 'main';

export class TemplateEngine {
  private templates: Map<string, OptimizationTemplate> = new Map();
  private templatesLoaded = false;
  private githubToken?: string;

  constructor(private templatesDirectory?: string, githubToken?: string) {
    // Default to design/templates or look for templates in standard locations
    this.templatesDirectory = templatesDirectory || this.findTemplatesDirectory();
    // GitHub token for private repo access (from constructor or env)
    this.githubToken = githubToken || process.env.GITHUB_TOKEN || process.env.PEAKINFER_GITHUB_TOKEN;
  }

  /**
   * Stage 1: Configuration ⏳
   * Load all optimization templates from the templates folder
   */
  async loadTemplates(): Promise<void> {
    console.log("Stage 1: Template Loading ⏳");

    try {
      // Try local templates directory first (new structure)
      await this.loadTemplatesFromDirectory();

      // Fall back to design doc extraction
      if (this.templates.size === 0) {
        await this.extractTemplatesFromDesignDoc();
        await this.loadStandaloneTemplateFiles();
      }

      // If still no local templates found, try loading from GitHub
      if (this.templates.size === 0) {
        console.log("  📡 No local templates found, trying GitHub repository...");
        try {
          await this.loadTemplatesFromGitHub();
        } catch (githubError) {
          console.warn("  ⚠️  Could not load from GitHub, using built-in defaults");
          this.loadBuiltInTemplates();
        }
      }

      console.log(`Stage 1: Template Loading ✅ - Loaded ${this.templates.size} templates`);
      this.templatesLoaded = true;

    } catch (error) {
      console.warn("Stage 1: Template Loading ⚠️ - Some templates may be missing:", error);
      // Don't throw - allow operation with partial templates
      this.templatesLoaded = true;
    }
  }

  /**
   * Load templates from the templates/ directory structure
   */
  private async loadTemplatesFromDirectory(): Promise<void> {
    const templatesDirs = [
      path.join(process.cwd(), 'templates'),
      path.join(__dirname, '..', '..', 'templates'),
      this.templatesDirectory || '',
    ].filter(d => d);

    for (const templatesDir of templatesDirs) {
      if (!await fs.pathExists(templatesDir)) {
        continue;
      }

      // Check for index.yaml
      const indexPath = path.join(templatesDir, 'index.yaml');
      if (await fs.pathExists(indexPath)) {
        await this.loadTemplatesFromIndex(indexPath, templatesDir);
        if (this.templates.size > 0) {
          console.log(`  📂 Loaded templates from ${templatesDir}`);
          return;
        }
      }

      // Fall back to scanning directories
      const categories = ['application-layer', 'serving-layer', 'infrastructure-layer', 'cross-layer'];
      for (const category of categories) {
        const categoryPath = path.join(templatesDir, category);
        if (await fs.pathExists(categoryPath)) {
          const templateFiles = await glob('*.yaml', {
            cwd: categoryPath,
            absolute: true
          });

          for (const templateFile of templateFiles) {
            try {
              const content = await fs.readFile(templateFile, 'utf-8');
              const template = yaml.parse(content) as OptimizationTemplate;

              if (template.id && template.name) {
                this.templates.set(template.id, template);
                console.log(`  ✅ Loaded: ${template.id} (${category})`);
              }
            } catch (error) {
              console.warn(`  ⚠️  Failed to load ${templateFile}: ${error instanceof Error ? error.message : String(error)}`);
            }
          }
        }
      }

      if (this.templates.size > 0) {
        console.log(`  📂 Loaded ${this.templates.size} templates from ${templatesDir}`);
        return;
      }
    }
  }

  /**
   * Load templates from index.yaml file
   */
  private async loadTemplatesFromIndex(indexPath: string, baseDir: string): Promise<void> {
    try {
      const indexContent = await fs.readFile(indexPath, 'utf-8');
      const index = yaml.parse(indexContent);

      if (!index.categories) {
        return;
      }

      for (const category of index.categories) {
        for (const templateInfo of category.templates || []) {
          const templatePath = path.join(baseDir, templateInfo.file);
          if (await fs.pathExists(templatePath)) {
            try {
              const content = await fs.readFile(templatePath, 'utf-8');
              const template = yaml.parse(content) as OptimizationTemplate;

              if (template.id && template.name) {
                this.templates.set(template.id, template);
              }
            } catch (error) {
              console.warn(`  ⚠️  Failed to load ${templatePath}`);
            }
          }
        }
      }
    } catch (error) {
      console.warn(`  ⚠️  Failed to parse index: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Extract templates from the main design document
   * Parses the PeakInfer Template v0.2.md file to extract YAML templates
   */
  private async extractTemplatesFromDesignDoc(): Promise<void> {
    // If templatesDirectory is the design folder, look directly in it
    // Otherwise, look in the parent directory (design folder)
    const templatesDir = this.templatesDirectory || '.';
    const designDocPath = templatesDir.endsWith('design')
      ? path.join(templatesDir, 'PeakInfer Template v0.2.md')
      : path.join(templatesDir, '..', 'PeakInfer Template v0.2.md');

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
            // Split by document separators and only take first document
            const firstDoc = yamlContent.split(/\n---\n/)[0];
            yamlBlocks.push(firstDoc);
          }
        }
        inYamlBlock = false;
        currentBlock = [];
      } else if (line.trim() === '---' && !inYamlBlock) {
        // Start of potential YAML block
        inYamlBlock = true;
        currentBlock = [];
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
  private findTemplatesDirectory(): string {
    const possiblePaths = [
      path.join(process.cwd(), 'design'),
      path.join(process.cwd(), 'design', 'templates'),
      path.join(process.cwd(), 'templates'),
      path.join(__dirname, '..', '..', 'design'),
      path.join(__dirname, '..', '..', 'design', 'templates')
    ];

    for (const possiblePath of possiblePaths) {
      if (fs.pathExistsSync(possiblePath)) {
        return possiblePath;
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
   * Load built-in default templates
   * These are minimal templates for when no external templates are available
   */
  private loadBuiltInTemplates(): void {
    // Simplified templates - cast to any to avoid strict type requirements
    const builtInTemplates: any[] = [
      {
        id: 'semantic-caching',
        name: 'Semantic Caching',
        category: 'context_optimization',
        description: 'Implement semantic caching to reduce redundant LLM API calls',
        confidence: 0.85,
        optimization: {
          technique: 'semantic-caching',
          expected_cost_reduction: '20-40%',
          expected_throughput_improvement: '2-3x',
          risk_level: 'low',
          effort_estimate: '2-3 days',
        },
        environment_match: {},
        economics: {
          baseline_calculation: {},
          implementation_cost: { total_cost: 5000 },
        },
        implementation: {
          prerequisites: [],
          automated_steps: [],
        },
      },
      {
        id: 'model-routing',
        name: 'Intelligent Model Routing',
        category: 'model_routing',
        description: 'Route requests to optimal models based on complexity',
        confidence: 0.80,
        optimization: {
          technique: 'model-routing',
          expected_cost_reduction: '30-50%',
          expected_throughput_improvement: '1.5x',
          risk_level: 'medium',
          effort_estimate: '5-7 days',
        },
        environment_match: {},
        economics: {
          baseline_calculation: {},
          implementation_cost: { total_cost: 10000 },
        },
        implementation: {
          prerequisites: [],
          automated_steps: [],
        },
      },
      {
        id: 'batch-optimization',
        name: 'Batch Request Optimization',
        category: 'concurrency_optimization',
        description: 'Optimize batch sizes for GPU utilization',
        confidence: 0.90,
        optimization: {
          technique: 'batch-optimization',
          expected_cost_reduction: '15-25%',
          expected_throughput_improvement: '2x',
          risk_level: 'low',
          effort_estimate: '1-2 days',
        },
        environment_match: {},
        economics: {
          baseline_calculation: {},
          implementation_cost: { total_cost: 2000 },
        },
        implementation: {
          prerequisites: [],
          automated_steps: [],
        },
      },
      {
        id: 'spot-instances',
        name: 'Spot Instance Migration',
        category: 'hardware_optimization',
        description: 'Migrate fault-tolerant workloads to spot instances',
        confidence: 0.85,
        optimization: {
          technique: 'spot-instances',
          expected_cost_reduction: '60-70%',
          expected_throughput_improvement: 'N/A',
          risk_level: 'medium',
          effort_estimate: '3-5 days',
        },
        environment_match: {},
        economics: {
          baseline_calculation: {},
          implementation_cost: { total_cost: 8000 },
        },
        implementation: {
          prerequisites: [],
          automated_steps: [],
        },
      },
    ];

    for (const template of builtInTemplates) {
      this.templates.set(template.id, template as OptimizationTemplate);
    }
  }

  /**
   * Load templates from GitHub repository
   * Templates are stored at: https://github.com/Kalmantic/peakinfer_templates
   * Supports both public (raw.githubusercontent.com) and private (API) repos
   */
  private async loadTemplatesFromGitHub(): Promise<void> {
    console.log("  📡 Fetching templates from GitHub repository...");

    try {
      // First, try to fetch index.yaml to get template list
      const indexContent = await this.fetchGitHubFile('index.yaml');
      const index = yaml.parse(indexContent);

      if (!index.categories) {
        throw new Error('Invalid index.yaml: missing categories');
      }

      console.log(`  📋 Found ${index.total_templates || 'multiple'} templates in index`);

      // Load each template from the categories
      for (const category of index.categories) {
        console.log(`  📂 Loading ${category.name} templates...`);

        for (const templateInfo of category.templates || []) {
          try {
            const templateContent = await this.fetchGitHubFile(templateInfo.file);
            const template = yaml.parse(templateContent) as OptimizationTemplate;

            if (template.id && template.name) {
              this.templates.set(template.id, template);
              console.log(`    ✅ ${template.id}`);
            }
          } catch (error) {
            console.warn(`    ⚠️  Failed to load ${templateInfo.file}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }

      console.log(`  ✅ Loaded ${this.templates.size} templates from GitHub`);

    } catch (error) {
      console.warn(`  ⚠️  Failed to load templates from GitHub: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Fetch a file from GitHub repository
   * Uses GitHub API for private repos (with token), raw.githubusercontent.com for public
   */
  private async fetchGitHubFile(filePath: string): Promise<string> {
    if (this.githubToken) {
      // Use GitHub API for private repo access
      return this.fetchFromGitHubAPI(filePath);
    } else {
      // Try raw.githubusercontent.com for public repos
      const rawUrl = `https://raw.githubusercontent.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/${GITHUB_BRANCH}/${filePath}`;
      return this.fetchFromUrl(rawUrl);
    }
  }

  /**
   * Fetch file content using GitHub API (supports private repos)
   */
  private async fetchFromGitHubAPI(filePath: string): Promise<string> {
    const apiUrl = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/contents/${filePath}?ref=${GITHUB_BRANCH}`;

    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.github.com',
        path: `/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/contents/${filePath}?ref=${GITHUB_BRANCH}`,
        method: 'GET',
        headers: {
          'User-Agent': 'PeakInfer-TemplateEngine',
          'Accept': 'application/vnd.github.v3.raw',
          'Authorization': `Bearer ${this.githubToken}`,
        },
      };

      const req = https.request(options, (response) => {
        if (response.statusCode === 404) {
          reject(new Error(`File not found: ${filePath}`));
          return;
        }

        if (response.statusCode !== 200) {
          reject(new Error(`GitHub API error ${response.statusCode}: ${response.statusMessage}`));
          return;
        }

        let data = '';
        response.on('data', (chunk) => {
          data += chunk;
        });

        response.on('end', () => {
          resolve(data);
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.end();
    });
  }

  /**
   * Fetch content from a URL using HTTPS (for public repos)
   */
  private async fetchFromUrl(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      https.get(url, (response) => {
        if (response.statusCode === 404) {
          reject(new Error(`Not found: ${url}`));
          return;
        }

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

  /**
   * Refresh templates from GitHub (force reload)
   */
  async refreshFromGitHub(): Promise<number> {
    console.log("🔄 Refreshing templates from GitHub...");
    this.templates.clear();
    this.templatesLoaded = false;

    try {
      await this.loadTemplatesFromGitHub();
      this.templatesLoaded = true;
      return this.templates.size;
    } catch (error) {
      console.warn(`Failed to refresh from GitHub: ${error instanceof Error ? error.message : String(error)}`);
      // Fall back to local templates
      await this.loadTemplatesFromDirectory();
      this.templatesLoaded = true;
      return this.templates.size;
    }
  }

  /**
   * Set GitHub token for private repo access
   */
  setGitHubToken(token: string): void {
    this.githubToken = token;
  }
}
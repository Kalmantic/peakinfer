/**
 * Interactive Mode System — Guided CLI Experience
 *
 * Provides an interactive, wizard-like interface for:
 * - First-time setup
 * - Configuration management
 * - Guided optimization workflows
 * - Template selection
 *
 * Design: Conversational UI with progressive disclosure
 */

import * as readline from 'readline';
import chalk from 'chalk';
import { createSpinner } from './progress.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// =============================================================================
// TYPES
// =============================================================================

export interface PromptOptions {
  /** Default value */
  default?: string;
  /** Validation function */
  validate?: (input: string) => boolean | string;
  /** Mask input (for passwords) */
  mask?: boolean;
  /** Show hint text */
  hint?: string;
  /** Choices for selection */
  choices?: string[] | { value: string; label: string; hint?: string }[];
}

export interface WizardStep {
  id: string;
  title: string;
  description?: string;
  prompts: {
    key: string;
    message: string;
    type: 'text' | 'password' | 'confirm' | 'select' | 'multiselect';
    options?: PromptOptions;
  }[];
  skip?: (context: any) => boolean;
}

export interface InteractiveConfig {
  apiKey?: string;
  defaultPath?: string;
  outputFormat?: 'json' | 'html' | 'markdown';
  autoOpen?: boolean;
  collectors?: string[];
  prioritization?: 'cost' | 'latency' | 'balanced';
  templateDir?: string;
}

// =============================================================================
// INTERACTIVE PROMPT SYSTEM
// =============================================================================

/**
 * Core interactive prompt utilities.
 */
export class Interactive {
  private rl: readline.Interface;
  private config: InteractiveConfig = {};

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    // Handle Ctrl+C gracefully
    this.rl.on('SIGINT', () => {
      console.log('\n\n' + chalk.yellow('Cancelled by user'));
      process.exit(0);
    });
  }

  /**
   * Prompt for text input.
   */
  async text(message: string, options: PromptOptions = {}): Promise<string> {
    const prompt = this.formatPrompt(message, options);

    return new Promise((resolve) => {
      this.rl.question(prompt, (answer) => {
        const value = answer.trim() || options.default || '';

        if (options.validate) {
          const result = options.validate(value);
          if (result !== true) {
            console.log(chalk.red(`  ✖ ${result || 'Invalid input'}`));
            // Retry
            resolve(this.text(message, options));
            return;
          }
        }

        resolve(value);
      });
    });
  }

  /**
   * Prompt for password (masked input).
   */
  async password(message: string, options: PromptOptions = {}): Promise<string> {
    const prompt = this.formatPrompt(message, options);

    return new Promise((resolve) => {
      // Save original write function
      const originalWrite = process.stdout.write;

      // Mask output
      process.stdout.write = function(chunk: any, ...args: any[]): boolean {
        if (chunk === '\r' || chunk === '\n' || chunk === '\r\n') {
          return originalWrite.call(process.stdout, chunk, ...args);
        }
        return originalWrite.call(process.stdout, '*', ...args);
      };

      this.rl.question(prompt, (answer) => {
        // Restore original write
        process.stdout.write = originalWrite;
        console.log(); // New line after password

        const value = answer.trim();
        if (options.validate) {
          const result = options.validate(value);
          if (result !== true) {
            console.log(chalk.red(`  ✖ ${result || 'Invalid input'}`));
            resolve(this.password(message, options));
            return;
          }
        }

        resolve(value);
      });
    });
  }

  /**
   * Prompt for yes/no confirmation.
   */
  async confirm(message: string, defaultValue: boolean = false): Promise<boolean> {
    const hint = defaultValue ? '[Y/n]' : '[y/N]';
    const prompt = `${chalk.cyan('?')} ${message} ${chalk.dim(hint)} `;

    return new Promise((resolve) => {
      this.rl.question(prompt, (answer) => {
        const value = answer.trim().toLowerCase();

        if (value === '') {
          resolve(defaultValue);
        } else if (value === 'y' || value === 'yes') {
          resolve(true);
        } else if (value === 'n' || value === 'no') {
          resolve(false);
        } else {
          console.log(chalk.red('  Please answer yes (y) or no (n)'));
          resolve(this.confirm(message, defaultValue));
        }
      });
    });
  }

  /**
   * Prompt for single selection from choices.
   */
  async select(message: string, choices: string[] | { value: string; label: string; hint?: string }[], defaultIndex: number = 0): Promise<string> {
    console.log(`${chalk.cyan('?')} ${message}`);

    const normalizedChoices = this.normalizeChoices(choices);

    // Display choices
    normalizedChoices.forEach((choice, i) => {
      const prefix = i === defaultIndex ? chalk.cyan('>') : ' ';
      const num = chalk.dim(`${i + 1}.`);
      let line = `  ${prefix} ${num} ${choice.label}`;
      if (choice.hint) {
        line += chalk.dim(` - ${choice.hint}`);
      }
      console.log(line);
    });

    const prompt = chalk.dim('  Select (number or arrow keys): ');

    return new Promise((resolve) => {
      this.rl.question(prompt, (answer) => {
        const value = answer.trim();

        if (value === '') {
          resolve(normalizedChoices[defaultIndex].value);
          return;
        }

        const index = parseInt(value, 10) - 1;
        if (index >= 0 && index < normalizedChoices.length) {
          resolve(normalizedChoices[index].value);
        } else {
          console.log(chalk.red(`  Please select a number between 1 and ${normalizedChoices.length}`));
          resolve(this.select(message, choices, defaultIndex));
        }
      });
    });
  }

  /**
   * Prompt for multiple selections.
   */
  async multiselect(
    message: string,
    choices: string[] | { value: string; label: string; hint?: string }[],
    defaults: string[] = []
  ): Promise<string[]> {
    console.log(`${chalk.cyan('?')} ${message}`);
    console.log(chalk.dim('  (space to select, enter to confirm)'));

    const normalizedChoices = this.normalizeChoices(choices);
    const selected = new Set(defaults);

    // Display choices
    normalizedChoices.forEach((choice, i) => {
      const isSelected = selected.has(choice.value);
      const checkbox = isSelected ? chalk.green('☑') : chalk.dim('☐');
      const num = chalk.dim(`${i + 1}.`);
      let line = `  ${checkbox} ${num} ${choice.label}`;
      if (choice.hint) {
        line += chalk.dim(` - ${choice.hint}`);
      }
      console.log(line);
    });

    const prompt = chalk.dim('  Toggle selection (numbers separated by spaces): ');

    return new Promise((resolve) => {
      this.rl.question(prompt, (answer) => {
        const value = answer.trim();

        if (value === '') {
          resolve(Array.from(selected));
          return;
        }

        const indices = value.split(/\s+/).map(v => parseInt(v, 10) - 1);

        for (const index of indices) {
          if (index >= 0 && index < normalizedChoices.length) {
            const choice = normalizedChoices[index];
            if (selected.has(choice.value)) {
              selected.delete(choice.value);
            } else {
              selected.add(choice.value);
            }
          }
        }

        // Show updated state and prompt again
        console.clear();
        resolve(this.multiselect(message, choices, Array.from(selected)));
      });
    });
  }

  /**
   * Run a wizard with multiple steps.
   */
  async wizard(steps: WizardStep[], context: any = {}): Promise<any> {
    console.log(chalk.bold.cyan('\n🚀 PeakInfer Setup Wizard\n'));

    for (const step of steps) {
      // Check if step should be skipped
      if (step.skip && step.skip(context)) {
        continue;
      }

      // Display step header
      console.log(chalk.bold(`\n${step.title}`));
      if (step.description) {
        console.log(chalk.dim(step.description));
      }
      console.log();

      // Process prompts
      for (const prompt of step.prompts) {
        let value: any;

        switch (prompt.type) {
          case 'text':
            value = await this.text(prompt.message, prompt.options);
            break;
          case 'password':
            value = await this.password(prompt.message, prompt.options);
            break;
          case 'confirm':
            value = await this.confirm(prompt.message, prompt.options?.default === 'true');
            break;
          case 'select':
            value = await this.select(prompt.message, prompt.options?.choices || [], 0);
            break;
          case 'multiselect':
            value = await this.multiselect(prompt.message, prompt.options?.choices || [], []);
            break;
        }

        context[prompt.key] = value;
      }
    }

    return context;
  }

  /**
   * Close the readline interface.
   */
  close(): void {
    this.rl.close();
  }

  // =============================================================================
  // HELPERS
  // =============================================================================

  private formatPrompt(message: string, options: PromptOptions): string {
    let prompt = `${chalk.cyan('?')} ${message}`;

    if (options.hint) {
      prompt += chalk.dim(` (${options.hint})`);
    }

    if (options.default) {
      prompt += chalk.dim(` [${options.default}]`);
    }

    prompt += ' ';

    return prompt;
  }

  private normalizeChoices(choices: string[] | { value: string; label: string; hint?: string }[]): { value: string; label: string; hint?: string }[] {
    if (typeof choices[0] === 'string') {
      return (choices as string[]).map(c => ({ value: c, label: c }));
    }
    return choices as { value: string; label: string; hint?: string }[];
  }
}

// =============================================================================
// SETUP WIZARD
// =============================================================================

/**
 * First-time setup wizard.
 */
export async function runSetupWizard(): Promise<InteractiveConfig> {
  const interactive = new Interactive();

  const steps: WizardStep[] = [
    {
      id: 'welcome',
      title: 'Welcome to PeakInfer!',
      description: 'Let\'s get you set up with LLM cost optimization in just a few steps.',
      prompts: [
        {
          key: 'continue',
          message: 'Ready to get started?',
          type: 'confirm',
          options: { default: 'true' },
        },
      ],
    },
    {
      id: 'api-key',
      title: 'API Configuration',
      description: 'PeakInfer uses Claude to analyze your codebase.',
      prompts: [
        {
          key: 'hasApiKey',
          message: 'Do you have an Anthropic API key?',
          type: 'confirm',
          options: { default: 'false' },
        },
        {
          key: 'apiKey',
          message: 'Enter your Anthropic API key',
          type: 'password',
          options: {
            validate: (input: string) => {
              if (!input) return 'API key is required';
              if (!input.startsWith('sk-ant-')) return 'Invalid key format (should start with sk-ant-)';
              return true;
            },
            hint: 'Get one at https://console.anthropic.com',
          },
        },
      ],
      skip: (ctx) => !ctx.continue,
    },
    {
      id: 'preferences',
      title: 'Preferences',
      description: 'Configure your default settings.',
      prompts: [
        {
          key: 'defaultPath',
          message: 'Default project path',
          type: 'text',
          options: {
            default: '.',
            hint: 'Path to analyze by default',
          },
        },
        {
          key: 'outputFormat',
          message: 'Preferred output format',
          type: 'select',
          options: {
            choices: [
              { value: 'html', label: 'HTML Report', hint: 'Interactive web report' },
              { value: 'json', label: 'JSON', hint: 'Machine-readable data' },
              { value: 'markdown', label: 'Markdown', hint: 'Documentation format' },
            ],
          },
        },
        {
          key: 'autoOpen',
          message: 'Automatically open reports in browser?',
          type: 'confirm',
          options: { default: 'true' },
        },
      ],
    },
    {
      id: 'optimization',
      title: 'Optimization Strategy',
      description: 'How should PeakInfer prioritize optimizations?',
      prompts: [
        {
          key: 'prioritization',
          message: 'Optimization priority',
          type: 'select',
          options: {
            choices: [
              { value: 'cost', label: 'Cost Reduction', hint: 'Minimize spending' },
              { value: 'latency', label: 'Latency Optimization', hint: 'Improve response times' },
              { value: 'balanced', label: 'Balanced', hint: 'Balance cost and performance' },
            ],
          },
        },
        {
          key: 'collectors',
          message: 'Which data sources do you use?',
          type: 'multiselect',
          options: {
            choices: [
              { value: 'codebase', label: 'Codebase', hint: 'Analyze source code' },
              { value: 'snowflake', label: 'Snowflake', hint: 'Query usage data' },
              { value: 'databricks', label: 'Databricks', hint: 'ML workloads' },
              { value: 'terraform', label: 'Terraform', hint: 'Infrastructure as code' },
            ],
          },
        },
      ],
    },
  ];

  const config = await interactive.wizard(steps);

  // Save configuration
  if (config.apiKey) {
    await saveConfig(config);
    console.log(chalk.green('\n✅ Setup complete! Configuration saved.\n'));
    console.log('You can now run:');
    console.log(chalk.cyan('  peakinfer analyze'));
    console.log();
  }

  interactive.close();
  return config;
}

// =============================================================================
// CONFIGURATION MANAGEMENT
// =============================================================================

/**
 * Get config file path.
 */
export function getConfigPath(): string {
  const configDir = path.join(os.homedir(), '.peakinfer');
  return path.join(configDir, 'config.json');
}

/**
 * Load configuration.
 */
export async function loadConfig(): Promise<InteractiveConfig | null> {
  const configPath = getConfigPath();

  if (!fs.existsSync(configPath)) {
    return null;
  }

  try {
    const content = await fs.promises.readFile(configPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Save configuration.
 */
export async function saveConfig(config: InteractiveConfig): Promise<void> {
  const configPath = getConfigPath();
  const configDir = path.dirname(configPath);

  // Create directory if needed
  if (!fs.existsSync(configDir)) {
    await fs.promises.mkdir(configDir, { recursive: true });
  }

  // Don't save API key in plain text - use environment variable instead
  const configToSave = { ...config };
  delete configToSave.apiKey;

  if (config.apiKey) {
    console.log(chalk.yellow('\n⚠️  For security, add your API key to your shell profile:'));
    console.log(chalk.dim(`    export ANTHROPIC_API_KEY="${config.apiKey}"`));
  }

  await fs.promises.writeFile(configPath, JSON.stringify(configToSave, null, 2), 'utf-8');
}

// =============================================================================
// INTERACTIVE COMMANDS
// =============================================================================

/**
 * Interactive analysis mode.
 */
export async function interactiveAnalysis(): Promise<void> {
  const interactive = new Interactive();
  const spinner = createSpinner('Loading configuration...');

  // Load saved config
  const config = await loadConfig();
  spinner?.succeed('Configuration loaded');

  // Get analysis parameters
  const params = await interactive.wizard([
    {
      id: 'target',
      title: 'Analysis Target',
      prompts: [
        {
          key: 'path',
          message: 'Path to analyze',
          type: 'text',
          options: {
            default: config?.defaultPath || '.',
            hint: 'Directory or file path',
          },
        },
        {
          key: 'recursive',
          message: 'Analyze recursively?',
          type: 'confirm',
          options: { default: 'true' },
        },
      ],
    },
    {
      id: 'options',
      title: 'Analysis Options',
      prompts: [
        {
          key: 'includePatterns',
          message: 'Include patterns (comma-separated)',
          type: 'text',
          options: {
            default: '*.py,*.ts,*.js,*.go,*.java',
            hint: 'File patterns to include',
          },
        },
        {
          key: 'excludePatterns',
          message: 'Exclude patterns (comma-separated)',
          type: 'text',
          options: {
            default: 'node_modules,venv,.git',
            hint: 'Patterns to exclude',
          },
        },
      ],
    },
    {
      id: 'output',
      title: 'Output Settings',
      prompts: [
        {
          key: 'format',
          message: 'Output format',
          type: 'select',
          options: {
            choices: [
              { value: 'html', label: 'HTML Report' },
              { value: 'json', label: 'JSON Data' },
              { value: 'both', label: 'Both HTML and JSON' },
            ],
            default: config?.outputFormat || 'html',
          },
        },
        {
          key: 'open',
          message: 'Open report in browser?',
          type: 'confirm',
          options: { default: config?.autoOpen ? 'true' : 'false' },
        },
      ],
    },
  ]);

  interactive.close();

  // Run analysis with selected parameters
  console.log(chalk.cyan('\n🔍 Starting analysis...\n'));

  // Import and run the analyze function
  const { analyze } = await import('./cli.js');
  await analyze(params.path, {
    html: params.format === 'html' || params.format === 'both',
    open: params.open,
  });
}

/**
 * Interactive template browser.
 */
export async function interactiveTemplateBrowser(): Promise<void> {
  const interactive = new Interactive();

  // Load templates
  const spinner = createSpinner('Loading templates...');
  const { TemplateEngine } = await import('../core/template-engine.js');
  const engine = new TemplateEngine();
  await engine.loadTemplates();
  const templates = engine.listTemplates();
  spinner?.succeed(`Loaded ${templates.length} templates`);

  // Group by category
  const categories = new Map<string, any[]>();
  for (const t of templates) {
    const cat = t.category || 'other';
    if (!categories.has(cat)) categories.set(cat, []);
    categories.get(cat)!.push(t);
  }

  // Browse categories
  while (true) {
    const categoryChoice = await interactive.select(
      'Select a category to browse',
      [
        ...Array.from(categories.keys()).map(c => ({
          value: c,
          label: c,
          hint: `${categories.get(c)!.length} templates`,
        })),
        { value: 'exit', label: 'Exit', hint: 'Return to main menu' },
      ]
    );

    if (categoryChoice === 'exit') break;

    // Show templates in category
    const categoryTemplates = categories.get(categoryChoice)!;
    const templateChoice = await interactive.select(
      `Select a template from ${categoryChoice}`,
      [
        ...categoryTemplates.map(t => ({
          value: t.id,
          label: t.name,
          hint: t.optimization?.expected_cost_reduction || 'varies',
        })),
        { value: 'back', label: 'Back', hint: 'Return to categories' },
      ]
    );

    if (templateChoice === 'back') continue;

    // Show template details
    const template = engine.getTemplate(templateChoice);
    if (template) {
      console.log(chalk.bold(`\n${template.name}`));
      console.log(chalk.dim('─'.repeat(40)));
      console.log(template.description);
      console.log();
      console.log(chalk.cyan('Expected Impact:'));
      console.log(`  Throughput Improvement: ${template.optimization?.expected_throughput_improvement || 'varies'}`);
      console.log(`  Risk Level: ${template.optimization?.risk_level || 'medium'}`);
      console.log();

      const action = await interactive.select('What would you like to do?', [
        { value: 'apply', label: 'Apply this template', hint: 'Run optimization' },
        { value: 'details', label: 'View implementation details', hint: 'Show code changes' },
        { value: 'back', label: 'Back to templates', hint: 'Browse more' },
      ]);

      if (action === 'apply') {
        console.log(chalk.cyan('\n📋 Manual Application Steps:\n'));
        console.log('Templates provide optimization strategies for manual implementation.');
        console.log('Use the "View implementation details" option to see specific steps.');
        console.log('\nFor automated analysis of your codebase:');
        console.log(chalk.white('  peakinfer analyze <path>\n'));
      } else if (action === 'details') {
        console.log(chalk.cyan('\nImplementation Steps:'));
        if (template.implementation?.automated_steps) {
          template.implementation.automated_steps.forEach((step: any, i) => {
            const description = step.description || step.name || step.action || 'Step ' + (i + 1);
            console.log(`  ${i + 1}. ${description}`);
          });
        }
      }
    }
  }

  interactive.close();
}

// =============================================================================
// EXPORT MAIN INTERACTIVE ENTRY POINT
// =============================================================================

/**
 * Main interactive mode entry point.
 */
export async function runInteractiveMode(): Promise<void> {
  const interactive = new Interactive();

  console.log(chalk.bold.cyan(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║                     🚀 PeakInfer v0.95.0                      ║
║                                                               ║
║            LLM Inference Cost Optimization Platform           ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
`));

  // Check for first-time setup
  const config = await loadConfig();
  if (!config) {
    const runSetup = await interactive.confirm('First time using PeakInfer? Would you like to run the setup wizard?', true);
    if (runSetup) {
      await runSetupWizard();
      return;
    }
  }

  // Main menu loop
  while (true) {
    const choice = await interactive.select(
      'What would you like to do?',
      [
        { value: 'analyze', label: 'Analyze Codebase', hint: 'Find LLM API usage and costs' },
        { value: 'recommend', label: 'Get Recommendations', hint: 'AI-powered optimization suggestions' },
        { value: 'templates', label: 'Browse Templates', hint: 'Community optimization strategies' },
        { value: 'discover', label: 'Full Discovery', hint: 'Comprehensive infrastructure analysis' },
        { value: 'settings', label: 'Settings', hint: 'Configure PeakInfer' },
        { value: 'help', label: 'Help', hint: 'Documentation and guides' },
        { value: 'exit', label: 'Exit', hint: 'Goodbye!' },
      ]
    );

    switch (choice) {
      case 'analyze':
        await interactiveAnalysis();
        break;

      case 'recommend':
        console.log(chalk.cyan('\n🤖 AI Recommendations\n'));
        const path = await interactive.text('Path to analyze', { default: '.' });
        const { recommend } = await import('./cli.js');
        await recommend(path);
        break;

      case 'templates':
        await interactiveTemplateBrowser();
        break;

      case 'discover':
        console.log(chalk.cyan('\n📊 Discovery Mode\n'));
        console.log('For codebase analysis, use the analyze command:');
        console.log(chalk.white('  peakinfer analyze <path>\n'));
        console.log('This will scan your code for LLM API calls and provide cost estimates.\n');
        break;

      case 'settings':
        await runSetupWizard();
        break;

      case 'help':
        console.log(chalk.cyan('\n📚 PeakInfer Help\n'));
        console.log('Documentation: https://github.com/kalmantic/peakinfer');
        console.log('Issues: https://github.com/kalmantic/peakinfer/issues');
        console.log('\nQuick Commands:');
        console.log('  peakinfer analyze <path>  # Analyze codebase for LLM usage');
        console.log('  peakinfer prices          # View model pricing');
        console.log('  peakinfer templates       # Browse optimization templates');
        console.log('  peakinfer --help          # Full command reference\n');
        break;

      case 'exit':
        console.log(chalk.green('\n👋 Thanks for using PeakInfer!\n'));
        interactive.close();
        return;
    }
  }
}
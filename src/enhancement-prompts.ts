/**
 * Enhancement Prompts (v1.9.5)
 *
 * Suggests additional layers to enhance analysis.
 * Progressive Enhancement Model:
 * - Code (required)
 * - Runtime (optional) - drift detection
 * - Benchmarks (optional) - performance comparison
 * - Evals (optional, future) - quality gating
 */

import chalk from 'chalk';

export interface EnhancementPrompt {
  layer: string;
  message: string;
  cli: string;
  action: string;
  docsUrl: string;
}

export interface LayerStatus {
  runtime: boolean;
  benchmarks: boolean;
  evals: boolean;
}

/**
 * Get enhancement prompts for missing layers
 */
export function getEnhancementPrompts(
  layers: LayerStatus,
  hasRecommendations: boolean
): EnhancementPrompt[] {
  const prompts: EnhancementPrompt[] = [];

  if (!layers.runtime) {
    prompts.push({
      layer: 'Runtime',
      message: 'Detect drift between code and actual behavior',
      cli: 'peakinfer analyze ./src --runtime helicone',
      action: 'runtime-source: helicone\nruntime-api-key: ${{ secrets.HELICONE_API_KEY }}',
      docsUrl: 'https://peakinfer.com/docs/runtime',
    });
  }

  if (!layers.benchmarks) {
    prompts.push({
      layer: 'Benchmarks',
      message: 'Compare to InferenceMAX benchmarks',
      cli: 'peakinfer analyze ./src --benchmark',
      action: 'include-benchmarks: true',
      docsUrl: 'https://peakinfer.com/docs/benchmarks',
    });
  }

  if (!layers.evals && hasRecommendations) {
    prompts.push({
      layer: 'Evals',
      message: 'Gate recommendations by quality scores',
      cli: 'peakinfer analyze ./src --evals braintrust',
      action: 'evals-source: braintrust\nevals-api-key: ${{ secrets.BRAINTRUST_API_KEY }}',
      docsUrl: 'https://peakinfer.com/docs/evals',
    });
  }

  return prompts;
}

/**
 * Render enhancement prompts in CLI
 */
export function renderPromptsCLI(prompts: EnhancementPrompt[]): void {
  if (prompts.length === 0) return;

  console.log('\n' + chalk.dim('─'.repeat(60)));
  console.log(chalk.cyan('\nENHANCE YOUR ANALYSIS\n'));

  for (const prompt of prompts) {
    console.log(chalk.white(`Add ${prompt.layer}:`), chalk.dim(prompt.message));
    console.log(chalk.dim(`  ${prompt.cli}`));
    console.log('');
  }
}

/**
 * Render layer status line
 */
export function renderLayerStatus(layers: LayerStatus & { code: boolean }): string {
  const status = (enabled: boolean) => enabled ? chalk.green('✓') : chalk.dim('○');
  return `Layers: Code ${status(layers.code)} | Runtime ${status(layers.runtime)} | Benchmarks ${status(layers.benchmarks)} | Evals ${status(layers.evals)}`;
}

/**
 * Generate enhancement prompts for GitHub Action comment
 */
export function generateActionPrompts(
  prompts: EnhancementPrompt[]
): string {
  if (prompts.length === 0) return '';

  const lines: string[] = [
    '<details>',
    '<summary>Enhance Your Analysis</summary>',
    '',
  ];

  for (const prompt of prompts) {
    lines.push(`**Add ${prompt.layer}:** ${prompt.message}`);
    lines.push('```yaml');
    lines.push(prompt.action);
    lines.push('```');
    lines.push('');
  }

  lines.push('</details>');
  return lines.join('\n');
}

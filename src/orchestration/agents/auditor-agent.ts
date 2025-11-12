/**
 * Auditor Agent
 * Summarizes optimization results and generates patches
 */

import { query, type Query } from '@anthropic-ai/claude-code';
import { EnvironmentProfile, TemplateExecutionResult, OptimizationTemplate } from '../../types/template.js';
import { WorkloadProfile, OptimizationPolicy, AuditReport, Patch } from '../multi-agent-orchestrator.js';
import * as fs from 'fs-extra';
import * as path from 'path';

export class AuditorAgent {
  /**
   * Audit optimization results and generate report
   */
  async auditResults(
    results: TemplateExecutionResult[],
    environment: EnvironmentProfile,
    workloadProfile: WorkloadProfile,
    policy: OptimizationPolicy
  ): Promise<AuditReport> {
    console.log('  📝 Generating audit report...\n');

    const successfulResults = results.filter(r => r.status === 'success');

    console.log(`  ✓ ${successfulResults.length}/${results.length} optimizations succeeded`);

    // Calculate total savings
    const totalMonthlySavings = successfulResults.reduce(
      (sum, r) => sum + (r.cost_savings || 0),
      0
    );

    const totalAnnualSavings = totalMonthlySavings * 12;

    console.log(`  ✓ Monthly savings: $${totalMonthlySavings.toLocaleString()}`);
    console.log(`  ✓ Annual savings: $${totalAnnualSavings.toLocaleString()}`);

    // Calculate total implementation cost
    const totalImplementationCost = successfulResults.reduce(
      (sum, r) => {
        // Extract implementation cost from economics
        return sum + (r.economics?.implementation_cost || 0);
      },
      0
    );

    console.log(`  ✓ Implementation cost: $${totalImplementationCost.toLocaleString()}`);

    // Calculate ROI
    const roiAnnual = totalImplementationCost > 0
      ? ((totalAnnualSavings - totalImplementationCost) / totalImplementationCost) * 100
      : 0;

    console.log(`  ✓ ROI: ${roiAnnual.toFixed(1)}%`);

    // Calculate payback period
    const paybackMonths = totalImplementationCost > 0 && totalMonthlySavings > 0
      ? totalImplementationCost / totalMonthlySavings
      : 0;

    console.log(`  ✓ Payback period: ${paybackMonths.toFixed(1)} months`);

    // Calculate quality impact
    const qualityImpact = this.calculateQualityImpact(successfulResults);

    console.log(`  ✓ Quality impact: ${(qualityImpact * 100).toFixed(2)}%`);

    // Generate patches
    console.log('\n  🔧 Generating implementation patches...');
    const patches = await this.generatePatches(successfulResults, environment);

    console.log(`  ✓ Generated ${patches.length} patches\n`);

    // Generate recommendations
    const recommendations = await this.generateRecommendations(
      results,
      environment,
      workloadProfile,
      policy
    );

    return {
      total_cost_savings_monthly: totalMonthlySavings,
      total_cost_savings_annual: totalAnnualSavings,
      total_implementation_cost: totalImplementationCost,
      roi_annual: roiAnnual,
      payback_period_months: paybackMonths,
      templates_applied: successfulResults.map(r => r.template_id),
      quality_impact: qualityImpact,
      patches_generated: patches,
      recommendations
    };
  }

  /**
   * Calculate overall quality impact
   */
  private calculateQualityImpact(results: TemplateExecutionResult[]): number {
    if (results.length === 0) return 0;

    // Average quality preservation across all results
    const qualityScores = results.map(r => {
      // If quality_preserved is true, assume minimal degradation (0.5%)
      // If false, assume significant degradation (5%)
      return r.quality_preserved ? -0.005 : -0.05;
    });

    const avgQualityImpact = qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length;

    return avgQualityImpact;
  }

  /**
   * Generate implementation patches using Claude
   */
  private async generatePatches(
    results: TemplateExecutionResult[],
    environment: EnvironmentProfile
  ): Promise<Patch[]> {
    const patches: Patch[] = [];

    for (const result of results) {
      if (result.status !== 'success') continue;

      try {
        // Use Claude to generate patches for this optimization
        const patchPrompt = `You are a DevOps engineer generating implementation patches for an LLM optimization.

Template: ${result.template_id}
Steps Completed: ${result.steps_completed.join(', ')}

Based on this optimization, generate configuration patches in JSON format:
{
  "patches": [
    {
      "file_path": "config/model-serving.yaml",
      "patch_type": "config",
      "description": "Enable vLLM optimization",
      "content": "# vLLM Configuration\\ngpu_memory_utilization: 0.9\\n...",
      "auto_applicable": true
    }
  ]
}

Generate practical patches that implement this optimization. Return only JSON.`;

        let claudeResponse = '';

        const claudeQuery: Query = query({
          prompt: patchPrompt,
          options: {
            model: 'claude-sonnet-4-5-20250929',
            maxTurns: 3,
          }
        });

        for await (const message of claudeQuery) {
          if (message.type === 'assistant') {
            const content = message.message.content;
            for (const block of content) {
              if (block.type === 'text') {
                claudeResponse += block.text;
              }
            }
          }
        }

        // Parse Claude's response
        const patchData = this.parseClaudeResponse(claudeResponse);

        if (patchData.patches && Array.isArray(patchData.patches)) {
          patches.push(...patchData.patches);
        }

      } catch (error) {
        console.warn(`  ⚠️  Failed to generate patch for ${result.template_id}`);

        // Add a default patch
        patches.push({
          file_path: `patches/${result.template_id}.yaml`,
          patch_type: 'config',
          description: `Manual implementation required for ${result.template_id}`,
          content: `# Implementation patch for ${result.template_id}\n# Steps: ${result.steps_completed.join(', ')}`,
          auto_applicable: false
        });
      }
    }

    // Save patches to disk
    await this.savePatches(patches);

    return patches;
  }

  /**
   * Generate recommendations using Claude
   */
  private async generateRecommendations(
    results: TemplateExecutionResult[],
    environment: EnvironmentProfile,
    workloadProfile: WorkloadProfile,
    policy: OptimizationPolicy
  ): Promise<string[]> {
    const recommendations: string[] = [];

    // Basic recommendations based on results
    const successRate = results.filter(r => r.status === 'success').length / results.length;

    if (successRate < 0.5) {
      recommendations.push('Consider refining environment detection or template matching criteria');
    }

    if (environment.infrastructure.gpu_inventory.length === 0) {
      recommendations.push('GPU infrastructure not detected - consider adding GPU acceleration');
    }

    if (environment.serving.frameworks_detected.length === 0) {
      recommendations.push('No serving frameworks detected - consider implementing vLLM or SGLang');
    }

    const totalSavings = results.reduce((sum, r) => sum + (r.cost_savings || 0), 0);
    if (totalSavings < environment.infrastructure.cost_breakdown.total_monthly * 0.1) {
      recommendations.push('Savings below 10% of total cost - explore additional optimization layers');
    }

    recommendations.push('Monitor quality metrics closely after implementation');
    recommendations.push('Consider A/B testing optimizations in production');

    return recommendations;
  }

  /**
   * Save patches to disk
   */
  private async savePatches(patches: Patch[]): Promise<void> {
    const patchesDir = path.join(process.cwd(), 'tokenop-patches');
    await fs.ensureDir(patchesDir);

    for (const patch of patches) {
      const patchFileName = path.basename(patch.file_path);
      const patchPath = path.join(patchesDir, patchFileName);

      await fs.writeFile(patchPath, patch.content, 'utf-8');
      console.log(`    ✓ Saved patch: ${patchFileName}`);
    }
  }

  /**
   * Parse Claude's JSON response
   */
  private parseClaudeResponse(response: string): any {
    try {
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) ||
                       response.match(/```\n([\s\S]*?)\n```/) ||
                       response.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const jsonStr = jsonMatch[1] || jsonMatch[0];
        return JSON.parse(jsonStr);
      }

      return JSON.parse(response);
    } catch {
      return { patches: [] };
    }
  }
}

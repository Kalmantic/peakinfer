/**
 * Planner Agent
 * Creates optimization search plans with candidate templates
 */

import Anthropic from '@anthropic-ai/sdk';
import { EnvironmentProfile, OptimizationTemplate } from '../../types/template.js';
import { WorkloadProfile, OptimizationPolicy, OptimizationPlan, StoppingCriteria } from '../multi-agent-orchestrator.js';
import { TemplateEngine } from '../../core/template-engine.js';

export class PlannerAgent {
  private templateEngine: TemplateEngine;

  constructor() {
    this.templateEngine = new TemplateEngine();
  }

  /**
   * Create optimization plan using Claude's reasoning
   */
  async createPlan(
    environment: EnvironmentProfile,
    workloadProfile: WorkloadProfile,
    policy: OptimizationPolicy,
    templatesDir?: string
  ): Promise<OptimizationPlan> {
    console.log('  🎯 Planning optimization strategy...\n');

    // Load available templates
    await this.templateEngine.loadTemplates();
    const allTemplates = this.templateEngine.listTemplates();

    console.log(`  ✓ Loaded ${allTemplates.length} templates`);

    // Filter templates based on environment match
    const matchingTemplates = await this.templateEngine.findMatchingTemplates(environment);

    console.log(`  ✓ Found ${matchingTemplates.length} matching templates`);

    // Filter by policy constraints
    const policyFilteredTemplates = matchingTemplates.filter(template => {
      const riskLevel = template.optimization.risk_level;
      return policy.allowed_risk_levels.includes(riskLevel);
    });

    console.log(`  ✓ ${policyFilteredTemplates.length} templates pass policy constraints`);

    // Use Claude to determine best execution strategy
    const strategy = await this.determineSearchStrategy(
      environment,
      workloadProfile,
      policy,
      policyFilteredTemplates
    );

    console.log(`  ✓ Strategy: ${strategy}`);

    // Order templates by priority
    const executionOrder = this.prioritizeTemplates(policyFilteredTemplates, workloadProfile);

    console.log(`  ✓ Execution order determined (${executionOrder.length} templates)`);

    // Define early stopping criteria
    const stoppingCriteria: StoppingCriteria = {
      min_improvement_threshold: 0.05, // 5% minimum improvement
      max_candidates_to_test: Math.min(10, executionOrder.length),
      quality_degradation_threshold: 1 - policy.quality_threshold,
      max_execution_time_minutes: 60
    };

    // Estimate duration
    const estimatedDuration = this.estimateDuration(policyFilteredTemplates, strategy);

    console.log(`  ✓ Estimated duration: ${estimatedDuration} minutes\n`);

    return {
      search_strategy: strategy,
      candidate_templates: policyFilteredTemplates,
      execution_order: executionOrder,
      early_stopping_criteria: stoppingCriteria,
      estimated_duration_minutes: estimatedDuration
    };
  }

  /**
   * Determine search strategy using Claude
   */
  private async determineSearchStrategy(
    environment: EnvironmentProfile,
    workloadProfile: WorkloadProfile,
    policy: OptimizationPolicy,
    templates: OptimizationTemplate[]
  ): Promise<'greedy' | 'bandit' | 'exhaustive'> {
    // Simple heuristic for now
    // TODO: Use Claude to reason about best strategy

    // If few templates, use exhaustive
    if (templates.length <= 3) {
      return 'exhaustive';
    }

    // If high budget and time available, use bandit
    if (policy.budget_monthly > 100000) {
      return 'bandit';
    }

    // Default to greedy (fastest)
    return 'greedy';
  }

  /**
   * Prioritize templates by expected impact
   */
  private prioritizeTemplates(
    templates: OptimizationTemplate[],
    workloadProfile: WorkloadProfile
  ): string[] {
    // Sort by expected ROI
    const scored = templates.map(template => {
      // Calculate priority score
      const confidenceScore = template.confidence * 100;
      const successScore = Math.min(template.success_count / 10, 10) * 10;
      const costReductionScore = (template.optimization.cost_reduction || 0.15) * 100;

      const priorityScore = (confidenceScore * 0.4) + (successScore * 0.3) + (costReductionScore * 0.3);

      return {
        id: template.id,
        score: priorityScore
      };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    return scored.map(s => s.id);
  }

  /**
   * Estimate execution duration
   */
  private estimateDuration(
    templates: OptimizationTemplate[],
    strategy: 'greedy' | 'bandit' | 'exhaustive'
  ): number {
    const avgTemplateTime = 5; // 5 minutes per template average

    switch (strategy) {
      case 'greedy':
        // Test until first success or all templates
        return Math.min(templates.length * avgTemplateTime, 30);

      case 'bandit':
        // Test subset with multi-arm bandit
        return Math.min(templates.length * 0.6 * avgTemplateTime, 45);

      case 'exhaustive':
        // Test all templates
        return templates.length * avgTemplateTime;

      default:
        return 30;
    }
  }
}

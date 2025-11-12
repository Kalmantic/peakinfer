/**
 * Runner Evaluator Agent
 * Executes optimization candidates with bandit-style early stopping
 */

import { EnvironmentProfile, OptimizationTemplate, TemplateExecutionResult } from '../../types/template.js';
import { WorkloadProfile, OptimizationPlan } from '../multi-agent-orchestrator.js';
import { TemplateExecutionAgent } from '../../agents/template-execution-agent.js';
import { TemplateEngine } from '../../core/template-engine.js';
import { EconomicsCalculator } from '../../core/economics-calculator.js';

export class RunnerEvaluatorAgent {
  private executionAgent: TemplateExecutionAgent;
  private templateEngine: TemplateEngine;
  private economicsCalculator: EconomicsCalculator;

  constructor() {
    this.executionAgent = new TemplateExecutionAgent();
    this.templateEngine = new TemplateEngine();
    this.economicsCalculator = new EconomicsCalculator();
  }

  /**
   * Execute templates with early stopping
   */
  async executeWithEarlyStopping(
    plan: OptimizationPlan,
    environment: EnvironmentProfile,
    workloadProfile: WorkloadProfile,
    dryRun: boolean
  ): Promise<TemplateExecutionResult[]> {
    console.log('  🚀 Executing optimization candidates...\n');
    console.log(`  Strategy: ${plan.search_strategy}`);
    console.log(`  Max candidates: ${plan.early_stopping_criteria.max_candidates_to_test}`);
    console.log(`  Min improvement: ${(plan.early_stopping_criteria.min_improvement_threshold * 100).toFixed(1)}%\n`);

    const results: TemplateExecutionResult[] = [];
    const startTime = Date.now();

    let cumulativeSavings = 0;
    let candidatesTested = 0;

    for (const templateId of plan.execution_order) {
      // Check early stopping criteria
      if (this.shouldStopEarly(
        results,
        plan.early_stopping_criteria,
        startTime,
        cumulativeSavings,
        candidatesTested
      )) {
        console.log('  🛑 Early stopping triggered\n');
        break;
      }

      const template = plan.candidate_templates.find(t => t.id === templateId);
      if (!template) continue;

      candidatesTested++;

      console.log(`  [${candidatesTested}/${plan.early_stopping_criteria.max_candidates_to_test}] Testing: ${template.name}`);

      try {
        // Execute template
        const result = await this.executionAgent.executeTemplate(
          template,
          environment,
          { dryRun }
        );

        results.push(result);

        // Track cumulative savings
        if (result.cost_savings) {
          cumulativeSavings += result.cost_savings;
          console.log(`  ✅ Success! Savings: $${result.cost_savings.toLocaleString()}/month`);
          console.log(`  📊 Cumulative: $${cumulativeSavings.toLocaleString()}/month\n`);
        } else {
          console.log(`  ⚠️  Completed with no measurable savings\n`);
        }

        // Check if quality degraded too much
        if (!result.quality_preserved) {
          console.log(`  ⚠️  Quality degradation detected, skipping to next template\n`);
          continue;
        }

      } catch (error) {
        console.error(`  ❌ Execution failed: ${error instanceof Error ? error.message : String(error)}\n`);

        // Add failed result
        results.push({
          template_id: templateId,
          execution_id: `failed_${Date.now()}`,
          status: 'failed',
          start_time: new Date(),
          end_time: new Date(),
          baseline_metrics: {},
          steps_completed: [],
          steps_failed: ['execution'],
          quality_preserved: false,
          quality_metrics: {}
        });
      }

      // For greedy strategy, stop after first success
      if (plan.search_strategy === 'greedy' && results.some(r => r.status === 'success')) {
        console.log('  🎯 Greedy strategy: Stopping after first success\n');
        break;
      }
    }

    console.log(`  ✅ Execution complete. Tested ${candidatesTested} candidates\n`);

    return results;
  }

  /**
   * Check if early stopping criteria are met
   */
  private shouldStopEarly(
    results: TemplateExecutionResult[],
    criteria: OptimizationPlan['early_stopping_criteria'],
    startTime: number,
    cumulativeSavings: number,
    candidatesTested: number
  ): boolean {
    // Max candidates tested
    if (candidatesTested >= criteria.max_candidates_to_test) {
      console.log('  ℹ️  Max candidates reached');
      return true;
    }

    // Max execution time
    const elapsedMinutes = (Date.now() - startTime) / 1000 / 60;
    if (elapsedMinutes >= criteria.max_execution_time_minutes) {
      console.log('  ℹ️  Max execution time reached');
      return true;
    }

    // Check if improvement is diminishing (for bandit strategy)
    if (results.length >= 3) {
      const recentResults = results.slice(-3);
      const recentSavings = recentResults.reduce(
        (sum, r) => sum + (r.cost_savings || 0),
        0
      );

      if (recentSavings < cumulativeSavings * criteria.min_improvement_threshold) {
        console.log('  ℹ️  Diminishing returns detected');
        return true;
      }
    }

    return false;
  }

  /**
   * Evaluate candidate using multi-arm bandit approach
   */
  private async evaluateCandidate(
    template: OptimizationTemplate,
    environment: EnvironmentProfile,
    workloadProfile: WorkloadProfile,
    sampleSize: number
  ): Promise<number> {
    // Calculate expected value based on template confidence and economics
    const baseline = await this.economicsCalculator.calculateBaseline(template, environment);
    const projected = await this.economicsCalculator.calculateProjectedSavings(template, baseline);

    const expectedSavings = projected.monthly_savings || 0;
    const confidence = template.confidence;

    // Expected value = savings * confidence
    return expectedSavings * confidence;
  }
}

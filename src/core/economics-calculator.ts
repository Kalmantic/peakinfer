/**
 * Economics Calculator - Implements TokenSqueeze economic principles in template formulas
 * Calculates baseline performance, projected gains, and ROI using template economics models
 */

import { OptimizationTemplate, EnvironmentProfile, EconomicsModel } from '../types/template.js';

export class EconomicsCalculator {
  private environmentVars: Map<string, number> = new Map();

  /**
   * Calculate template impact on economics
   */
  async calculateTemplateImpact(template: OptimizationTemplate, environment: EnvironmentProfile): Promise<any> {
    console.log("    💰 Calculating template economic impact...");

    const baseline = await this.calculateBaseline(template, environment);
    const impact = {
      throughput_improvement_percent: template.optimization.throughput_improvement || 0.15,
      latency_improvement_percent: template.optimization.latency_improvement || 0.20,
      monthly_gain: baseline.throughput_per_month * (template.optimization.throughput_improvement || 0.15),
      roi_estimate: 2.5 // Simple default ROI
    };

    return impact;
  }

  /**
   * Calculate baseline economics from template and environment
   */
  async calculateBaseline(template: OptimizationTemplate, environment: EnvironmentProfile): Promise<Record<string, number>> {
    console.log("    📊 Economics Engine: Calculating baseline performance...");

    // Extract environment variables for formula evaluation
    this.extractEnvironmentVariables(environment);

    const baseline: Record<string, number> = {};
    const economics = template.economics;

    // Evaluate baseline calculation formulas
    for (const [key, formula] of Object.entries(economics.baseline_calculation)) {
      try {
        const value = this.evaluateFormula(formula, this.environmentVars);
        baseline[key] = value;
        console.log(`      ${key}: ${this.formatCurrency(value)}`);
      } catch (error) {
        console.warn(`      ⚠️  Could not calculate ${key}: ${error instanceof Error ? error.message : String(error)}`);
        baseline[key] = 0;
      }
    }

    // Calculate TokenSqueeze-specific metrics
    baseline.memory_bandwidth_utilization = this.calculateMemoryBandwidthUtilization(environment);
    baseline.arithmetic_intensity = this.calculateArithmeticIntensity(environment);
    baseline.context_length_tax = this.calculateContextLengthTax(environment);
    baseline.batch_efficiency = this.calculateBatchEfficiency(environment);

    console.log(`    📊 Baseline Economics: Monthly throughput ${(baseline.monthly_throughput || 0).toLocaleString()} tps`);
    return baseline;
  }

  /**
   * Calculate projected improvements from template
   */
  async calculateProjectedGain(template: OptimizationTemplate, baseline: Record<string, number>): Promise<Record<string, number>> {
    console.log("    📈 Economics Engine: Calculating projected performance gain...");

    const projected: Record<string, number> = {};
    const economics = template.economics;

    // Add baseline values to environment for projected calculations
    for (const [key, value] of Object.entries(baseline)) {
      this.environmentVars.set(key, value);
    }

    // Evaluate projected improvement formulas
    if (economics.projected_improvement) {
      for (const [key, formula] of Object.entries(economics.projected_improvement)) {
        try {
          const value = this.evaluateFormula(formula, this.environmentVars);
          projected[key] = value;
        } catch (error) {
          console.warn(`      ⚠️  Could not calculate projected ${key}: ${error instanceof Error ? error.message : String(error)}`);
          projected[key] = 0;
        }
      }
    }

    // Calculate performance gains
    if (economics.projected_gain) {
      for (const [key, formula] of Object.entries(economics.projected_gain)) {
        try {
          const value = this.evaluateFormula(formula, this.environmentVars);
          projected[key] = value;
        } catch (error) {
          console.warn(`      ⚠️  Could not calculate gain ${key}: ${error instanceof Error ? error.message : String(error)}`);
          projected[key] = 0;
        }
      }
    }

    const monthlyGain = projected.monthly_gain || 0;
    console.log(`    📈 Projected Gain: ${monthlyGain.toLocaleString()} throughput/month`);

    return projected;
  }

  /**
   * Calculate ROI from baseline, optimized metrics, and economics model
   */
  calculateROI(baseline: Record<string, number>, optimized: Record<string, number>, economics: EconomicsModel): number {
    const baselineThroughput = baseline.monthly_throughput || baseline.baseline_monthly_throughput || 0;
    const optimizedThroughput = optimized.monthly_throughput || optimized.optimized_monthly_throughput || baselineThroughput;
    const monthlyGain = optimizedThroughput - baselineThroughput;
    const annualGain = monthlyGain * 12;

    const implementationEffort = economics.implementation_effort.total_effort;

    if (implementationEffort === 0) return 0;

    const roi = ((annualGain - implementationEffort) / implementationEffort) * 100;
    return Math.round(roi * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Extract environment variables for formula evaluation
   */
  private extractEnvironmentVariables(environment: EnvironmentProfile): void {
    this.environmentVars.clear();

    // Application Layer Variables
    this.environmentVars.set('avg_context_length', environment.application.context_analysis.average_length);
    this.environmentVars.set('monthly_requests', environment.application.model_usage_patterns[0]?.usage_frequency || 1000);

    // Serving Layer Variables
    const performance = environment.serving.performance_metrics;
    this.environmentVars.set('current_throughput', performance.throughput);
    this.environmentVars.set('current_latency_p95', performance.latency_p95);
    this.environmentVars.set('gpu_utilization', performance.gpu_utilization);
    this.environmentVars.set('batch_efficiency', performance.batch_efficiency);

    // Infrastructure Layer Variables
    const gpu = environment.infrastructure.gpu_inventory[0];
    if (gpu) {
      this.environmentVars.set('gpu_memory_gb', gpu.memory_gb);
      this.environmentVars.set('gpu_hourly_rate', gpu.cost_per_hour);
      this.environmentVars.set('gpu_count', environment.infrastructure.gpu_inventory.length);
    }

    this.environmentVars.set('monthly_throughput', environment.infrastructure.cost_breakdown.total_monthly);

    // TokenSqueeze Economic Variables
    this.environmentVars.set('memory_bandwidth_gbps', environment.infrastructure.memory_analysis.bandwidth_efficiency * 3350); // H100 theoretical
    this.environmentVars.set('context_length_avg', environment.application.context_analysis.average_length);

    // Common Performance Variables
    this.environmentVars.set('hourly_rate', 200); // Engineering hourly rate
    this.environmentVars.set('current_throughput_per_token', 0.004); // Default throughput per token
  }

  /**
   * Evaluate formula string with environment variables
   */
  private evaluateFormula(formula: string, variables: Map<string, number>): number {
    let expression = formula;

    // Replace variables with values
    for (const [variable, value] of variables.entries()) {
      const variablePattern = new RegExp(`\\$\\{${variable}\\}`, 'g');
      expression = expression.replace(variablePattern, value.toString());
    }

    // Handle mathematical functions
    expression = expression.replace(/ceil\(/g, 'Math.ceil(');
    expression = expression.replace(/floor\(/g, 'Math.floor(');
    expression = expression.replace(/max\(/g, 'Math.max(');
    expression = expression.replace(/min\(/g, 'Math.min(');

    try {
      // Safe evaluation (only allow mathematical operations)
      if (!/^[0-9+\-*/.() Math,]+$/.test(expression.replace(/Math\.\w+/g, ''))) {
        throw new Error(`Unsafe formula: ${expression}`);
      }

      return eval(expression);
    } catch (error) {
      throw new Error(`Formula evaluation failed: ${expression} - ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Calculate memory bandwidth utilization (TokenSqueeze principle)
   */
  private calculateMemoryBandwidthUtilization(environment: EnvironmentProfile): number {
    const gpu = environment.infrastructure.gpu_inventory[0];
    if (!gpu) return 0;

    // H100 has 3350 GB/s theoretical bandwidth
    const theoreticalBandwidth = 3350;
    const actualBandwidth = environment.infrastructure.memory_analysis.bandwidth_efficiency * theoreticalBandwidth;

    // LLM inference typically achieves 1 FLOP per byte (vs 590 needed for efficiency)
    const arithmeticIntensity = 1; // FLOP per byte
    const requiredIntensity = 590;

    return (arithmeticIntensity / requiredIntensity) * 100; // Usually ~0.17%
  }

  /**
   * Calculate arithmetic intensity (TokenSqueeze core metric)
   */
  private calculateArithmeticIntensity(environment: EnvironmentProfile): number {
    // Arithmetic intensity = FLOPs per byte of memory accessed
    // For LLM inference, this is typically very low (~1 FLOP/byte)

    const modelSize = environment.serving.performance_metrics.memory_utilization *
                     (environment.infrastructure.gpu_inventory[0]?.memory_gb || 80);
    const throughput = environment.serving.performance_metrics.throughput;

    // Simplified calculation: operations per token / memory per token
    const opsPerToken = modelSize * 2; // Approximate FLOPs for forward pass
    const memoryPerToken = modelSize / throughput; // Memory bandwidth usage

    return opsPerToken / memoryPerToken;
  }

  /**
   * Calculate context length tax (TokenSqueeze KV cache principle)
   */
  private calculateContextLengthTax(environment: EnvironmentProfile): number {
    const avgContextLength = environment.application.context_analysis.average_length;
    const kvCachePerToken = 1; // MB per token for KV cache

    // Monthly overhead of KV cache on throughput
    const kvCacheMemoryGB = (avgContextLength * kvCachePerToken) / 1024;
    const concurrentUsers = environment.serving.performance_metrics.batch_efficiency * 64; // Estimate based on batch efficiency
    const totalKVMemoryGB = kvCacheMemoryGB * concurrentUsers;

    const gpu = environment.infrastructure.gpu_inventory[0];
    const memoryUtilizationForKV = totalKVMemoryGB / (gpu?.memory_gb || 80);
    const ratePerHour = gpu?.cost_per_hour || 4;

    return memoryUtilizationForKV * ratePerHour * 24 * 30; // Monthly KV cache throughput overhead
  }

  /**
   * Calculate batch efficiency (TokenSqueeze batching principle)
   */
  private calculateBatchEfficiency(environment: EnvironmentProfile): number {
    const currentBatchSize = environment.serving.performance_metrics.batch_efficiency;
    const maxBatchSize = 64; // Typical maximum for memory constraints

    return (currentBatchSize / maxBatchSize) * 100;
  }

  /**
   * Format currency for display
   */
  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  /**
   * Generate economics report
   */
  generateEconomicsReport(
    template: OptimizationTemplate,
    baseline: Record<string, number>,
    projected: Record<string, number>
  ): string {
    const monthlyGain = projected.monthly_gain || 0;
    const annualGain = monthlyGain * 12;
    const implementationEffort = template.economics.implementation_effort.total_effort;
    const roi = this.calculateROI(baseline, projected, template.economics);
    const paybackMonths = implementationEffort / monthlyGain;

    return `
📊 Economics Report: ${template.name}

📈 Performance Impact:
   • Monthly Gain: ${monthlyGain.toLocaleString()} throughput
   • Annual Gain: ${annualGain.toLocaleString()} throughput
   • Implementation Effort: ${implementationEffort} hours
   • ROI: ${roi.toFixed(1)}%
   • Payback Period: ${paybackMonths.toFixed(1)} months

🔧 TokenSqueeze Metrics:
   • Memory Bandwidth Utilization: ${baseline.memory_bandwidth_utilization?.toFixed(2)}%
   • Arithmetic Intensity: ${baseline.arithmetic_intensity?.toFixed(2)} FLOP/byte
   • Context Length Overhead: ${(baseline.context_length_tax || 0).toLocaleString()} tps/month
   • Batch Efficiency: ${baseline.batch_efficiency?.toFixed(1)}%

⚡ Expected Improvements:
   • Expected Latency Reduction: ${template.optimization.expected_latency_improvement}
   • Expected Throughput Improvement: ${template.optimization.expected_throughput_improvement}
   • Implementation Effort: ${template.optimization.effort_estimate}
   • Risk Level: ${template.optimization.risk_level}
`;
  }
}
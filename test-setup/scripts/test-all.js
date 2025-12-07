#!/usr/bin/env node
/**
 * PeakInfer Integration Test Suite
 * Tests all collectors and hardware detection with real data
 */

import { SnowflakeCollector } from '../../dist/collectors/snowflake-collector.js';
import { DatabricksCollector } from '../../dist/collectors/databricks-collector.js';
import { TerraformCollector } from '../../dist/collectors/terraform-collector.js';
import { CodebaseCollector } from '../../dist/collectors/codebase-collector.js';
import { HardwareDetector } from '../../dist/collectors/hardware-detector.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testDir = path.join(__dirname, '..');

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║           PeakInfer Integration Test Suite                     ║');
console.log('║   Full-Stack Inference Optimization: App → Serving → Infra     ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

const results = {
  snowflake: { status: 'pending', events: 0, error: null },
  databricks: { status: 'pending', events: 0, error: null },
  terraform: { status: 'pending', resources: 0, gpus: 0, error: null },
  hardware: { status: 'pending', runtimes: 0, parallelization: 0, error: null },
  codebase: { status: 'pending', llmCalls: 0, optimizations: 0, error: null },
};

// =============================================================================
// TEST 1: Snowflake Collector
// =============================================================================
async function testSnowflake() {
  console.log('┌─────────────────────────────────────────────────────────────────┐');
  console.log('│ TEST 1: Snowflake Collector                                     │');
  console.log('└─────────────────────────────────────────────────────────────────┘');

  const hasConfig = process.env.SNOWFLAKE_ACCOUNT && process.env.SNOWFLAKE_USER;

  if (!hasConfig) {
    console.log('  ⚠️  Snowflake not configured - skipping');
    console.log('  Set: SNOWFLAKE_ACCOUNT, SNOWFLAKE_USER, SNOWFLAKE_PASSWORD,');
    console.log('       SNOWFLAKE_DATABASE, SNOWFLAKE_WAREHOUSE\n');
    results.snowflake.status = 'skipped';
    return;
  }

  try {
    const collector = new SnowflakeCollector({
      query: { table: 'inference_usage', timeRange: '7_days' }
    });

    // Validate config
    const validation = await collector.validate();
    if (!validation.valid) {
      console.log('  ❌ Validation failed:', validation.errors.join(', '));
      results.snowflake.status = 'failed';
      results.snowflake.error = validation.errors.join(', ');
      return;
    }

    // Collect events
    const events = await collector.collect();

    results.snowflake.status = 'passed';
    results.snowflake.events = events.length;

    console.log(`  ✅ Collected ${events.length} inference events`);

    if (events.length > 0) {
      const providers = [...new Set(events.map(e => e.provider))];
      const models = [...new Set(events.map(e => e.model))];
      const totalCost = events.reduce((sum, e) => sum + e.cost_usd, 0);

      console.log(`  📊 Providers: ${providers.join(', ')}`);
      console.log(`  📊 Models: ${models.slice(0, 5).join(', ')}${models.length > 5 ? '...' : ''}`);
      console.log(`  💰 Total Cost: $${totalCost.toFixed(2)}`);
    }
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    results.snowflake.status = 'failed';
    results.snowflake.error = error.message;
  }

  console.log('');
}

// =============================================================================
// TEST 2: Databricks Collector
// =============================================================================
async function testDatabricks() {
  console.log('┌─────────────────────────────────────────────────────────────────┐');
  console.log('│ TEST 2: Databricks Collector                                    │');
  console.log('└─────────────────────────────────────────────────────────────────┘');

  const hasConfig = process.env.DATABRICKS_HOST && process.env.DATABRICKS_TOKEN;

  if (!hasConfig) {
    console.log('  ⚠️  Databricks not configured - skipping');
    console.log('  Set: DATABRICKS_HOST, DATABRICKS_TOKEN\n');
    results.databricks.status = 'skipped';
    return;
  }

  try {
    const collector = new DatabricksCollector();

    // Validate config
    const validation = await collector.validate();
    if (!validation.valid) {
      console.log('  ❌ Validation failed:', validation.errors.join(', '));
      results.databricks.status = 'failed';
      results.databricks.error = validation.errors.join(', ');
      return;
    }

    // Collect events
    const events = await collector.collect();

    results.databricks.status = 'passed';
    results.databricks.events = events.length;

    console.log(`  ✅ Collected ${events.length} inference events`);

    if (events.length > 0) {
      const endpoints = [...new Set(events.map(e => e.metadata?.endpoint_name).filter(Boolean))];
      console.log(`  📊 Serving Endpoints: ${endpoints.join(', ') || 'N/A'}`);
    }
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    results.databricks.status = 'failed';
    results.databricks.error = error.message;
  }

  console.log('');
}

// =============================================================================
// TEST 3: Terraform Collector
// =============================================================================
async function testTerraform() {
  console.log('┌─────────────────────────────────────────────────────────────────┐');
  console.log('│ TEST 3: Terraform Collector (Infrastructure Layer)             │');
  console.log('└─────────────────────────────────────────────────────────────────┘');

  try {
    const terraformDir = path.join(testDir, 'terraform');

    const collector = new TerraformCollector({
      paths: { configDir: terraformDir }
    });

    // Validate
    const validation = await collector.validate();
    if (validation.warnings.length > 0) {
      console.log('  ⚠️  Warnings:', validation.warnings.join(', '));
    }

    // Collect infrastructure config
    await collector.collect();
    const infraConfig = await collector.getInfrastructureConfig();

    results.terraform.status = 'passed';
    results.terraform.resources = infraConfig.resources.length;
    results.terraform.gpus = infraConfig.gpu_inventory.length;

    console.log(`  ✅ Parsed ${infraConfig.resources.length} infrastructure resources`);
    console.log(`  🖥️  Found ${infraConfig.gpu_inventory.length} GPU configurations`);

    if (infraConfig.gpu_inventory.length > 0) {
      console.log('  📊 GPU Inventory:');
      for (const gpu of infraConfig.gpu_inventory) {
        console.log(`     - ${gpu.instance_type}: ${gpu.gpu_count}x ${gpu.gpu_type} ($${gpu.hourly_cost.toFixed(2)}/hr)`);
      }
    }

    if (infraConfig.cost_estimates.length > 0) {
      const totalMonthly = infraConfig.cost_estimates.reduce((sum, e) => sum + e.monthly_cost, 0);
      const avgOptPotential = infraConfig.cost_estimates.reduce((sum, e) => sum + e.optimization_potential, 0) / infraConfig.cost_estimates.length;

      console.log(`  💰 Estimated Monthly Cost: $${totalMonthly.toLocaleString()}`);
      console.log(`  📈 Avg Optimization Potential: ${(avgOptPotential * 100).toFixed(0)}%`);
    }

    // Get recommendations
    const recommendations = collector.getOptimizationRecommendations();
    if (recommendations.length > 0) {
      console.log('  🎯 Infrastructure Recommendations:');
      for (const rec of recommendations.slice(0, 3)) {
        console.log(`     - ${rec}`);
      }
    }
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    results.terraform.status = 'failed';
    results.terraform.error = error.message;
  }

  console.log('');
}

// =============================================================================
// TEST 4: Hardware Detection
// =============================================================================
async function testHardwareDetection() {
  console.log('┌─────────────────────────────────────────────────────────────────┐');
  console.log('│ TEST 4: Hardware Detection (Serving Layer)                      │');
  console.log('└─────────────────────────────────────────────────────────────────┘');

  try {
    const sampleCodeDir = path.join(testDir, 'codebase-samples');
    const detector = new HardwareDetector(sampleCodeDir, false);

    const profile = await detector.detect();

    results.hardware.status = 'passed';
    results.hardware.runtimes = profile.servingRuntimes.length;
    results.hardware.parallelization = profile.parallelization.length;

    console.log(`  ✅ Hardware detection complete`);
    console.log(`  🖥️  Total GPUs: ${profile.summary.totalGPUs}`);

    if (profile.servingRuntimes.length > 0) {
      const runtimes = [...new Set(profile.servingRuntimes.map(r => r.runtime))];
      console.log(`  🚀 Serving Runtimes: ${runtimes.join(', ')}`);

      // Show configs
      for (const runtime of profile.servingRuntimes.slice(0, 3)) {
        if (Object.keys(runtime.config || {}).length > 0) {
          console.log(`     - ${runtime.runtime}: ${JSON.stringify(runtime.config)}`);
        }
      }
    }

    if (profile.parallelization.length > 0) {
      const strategies = [...new Set(profile.parallelization.map(p => p.strategy))];
      console.log(`  ⚡ Parallelization: ${strategies.join(', ')}`);
    }

    if (profile.quantization.length > 0) {
      const methods = [...new Set(profile.quantization.map(q => `${q.method} (${q.bits}-bit)`))];
      console.log(`  📦 Quantization: ${methods.join(', ')}`);
    }

    if (profile.modal.length > 0) {
      console.log(`  ☁️  Modal GPUs: ${profile.modal.map(m => `${m.gpuType}x${m.count}`).join(', ')}`);
    }

    if (profile.cloudInstances.length > 0) {
      console.log(`  ☁️  Cloud Instances: ${profile.cloudInstances.map(c => c.instanceType).join(', ')}`);
    }
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    results.hardware.status = 'failed';
    results.hardware.error = error.message;
  }

  console.log('');
}

// =============================================================================
// TEST 5: Codebase Collector (Full Analysis)
// =============================================================================
async function testCodebaseCollector() {
  console.log('┌─────────────────────────────────────────────────────────────────┐');
  console.log('│ TEST 5: Codebase Collector (Application Layer)                  │');
  console.log('└─────────────────────────────────────────────────────────────────┘');

  try {
    const sampleCodeDir = path.join(testDir, 'codebase-samples');

    const collector = new CodebaseCollector({
      rootPath: sampleCodeDir,
      scanDepth: 'deep',
    });

    const analysis = await collector.analyzeCodebase();

    results.codebase.status = 'passed';
    results.codebase.llmCalls = analysis.llmApiCalls.length;
    results.codebase.optimizations = analysis.optimizationOpportunities.length;

    console.log(`  ✅ Codebase analysis complete`);
    console.log(`  📊 Files Scanned: ${analysis.codeMetrics.totalFiles}`);
    console.log(`  🔍 LLM API Calls Found: ${analysis.llmApiCalls.length}`);

    if (analysis.llmApiCalls.length > 0) {
      const providers = Object.entries(analysis.codeMetrics.providerDistribution);
      console.log(`  📊 Provider Distribution:`);
      for (const [provider, count] of providers) {
        console.log(`     - ${provider}: ${count} calls`);
      }
    }

    if (analysis.optimizationOpportunities.length > 0) {
      console.log(`  🎯 Optimization Opportunities: ${analysis.optimizationOpportunities.length}`);
      for (const opt of analysis.optimizationOpportunities.slice(0, 3)) {
        console.log(`     - [${opt.priority}] ${opt.type}: ${opt.description.slice(0, 60)}...`);
      }
    }

    if (analysis.cachingOpportunities.length > 0) {
      const totalSavings = analysis.cachingOpportunities.reduce((sum, c) => sum + c.estimatedSavings, 0);
      console.log(`  💾 Caching Opportunities: ${analysis.cachingOpportunities.length} (est. savings: $${totalSavings.toFixed(2)})`);
    }

    if (analysis.hardwareProfile) {
      console.log(`  🔧 Hardware Profile: ${analysis.hardwareProfile.summary.totalGPUs} GPUs, ${analysis.hardwareProfile.servingRuntimes.length} runtimes`);
    }
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    results.codebase.status = 'failed';
    results.codebase.error = error.message;
  }

  console.log('');
}

// =============================================================================
// SUMMARY
// =============================================================================
function printSummary() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                       TEST SUMMARY                              ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const statusEmoji = {
    passed: '✅',
    failed: '❌',
    skipped: '⏭️',
    pending: '⏳',
  };

  console.log('  Collector Tests:');
  console.log(`    ${statusEmoji[results.snowflake.status]} Snowflake: ${results.snowflake.status} (${results.snowflake.events} events)`);
  console.log(`    ${statusEmoji[results.databricks.status]} Databricks: ${results.databricks.status} (${results.databricks.events} events)`);
  console.log(`    ${statusEmoji[results.terraform.status]} Terraform: ${results.terraform.status} (${results.terraform.resources} resources, ${results.terraform.gpus} GPUs)`);
  console.log(`    ${statusEmoji[results.hardware.status]} Hardware: ${results.hardware.status} (${results.hardware.runtimes} runtimes, ${results.hardware.parallelization} parallel strategies)`);
  console.log(`    ${statusEmoji[results.codebase.status]} Codebase: ${results.codebase.status} (${results.codebase.llmCalls} LLM calls, ${results.codebase.optimizations} optimizations)`);

  const passed = Object.values(results).filter(r => r.status === 'passed').length;
  const total = Object.keys(results).length;

  console.log(`\n  Total: ${passed}/${total} tests passed\n`);

  // Full-stack view
  console.log('  Full-Stack Inference View:');
  console.log('  ┌─────────────────────────────────────────┐');
  console.log('  │  APPLICATION LAYER                      │');
  console.log(`  │    LLM Calls: ${results.codebase.llmCalls.toString().padStart(4)}                        │`);
  console.log(`  │    Optimizations: ${results.codebase.optimizations.toString().padStart(4)}                   │`);
  console.log('  ├─────────────────────────────────────────┤');
  console.log('  │  SERVING LAYER                          │');
  console.log(`  │    Runtimes: ${results.hardware.runtimes.toString().padStart(4)} (vLLM, SGLang, etc.)    │`);
  console.log(`  │    Parallelization: ${results.hardware.parallelization.toString().padStart(4)}              │`);
  console.log('  ├─────────────────────────────────────────┤');
  console.log('  │  INFRASTRUCTURE LAYER                   │');
  console.log(`  │    Resources: ${results.terraform.resources.toString().padStart(4)}                       │`);
  console.log(`  │    GPU Configs: ${results.terraform.gpus.toString().padStart(4)}                     │`);
  console.log('  └─────────────────────────────────────────┘');
}

// =============================================================================
// MAIN
// =============================================================================
async function main() {
  await testSnowflake();
  await testDatabricks();
  await testTerraform();
  await testHardwareDetection();
  await testCodebaseCollector();
  printSummary();
}

main().catch(console.error);

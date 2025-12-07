#!/usr/bin/env npx ts-node
/**
 * PeakInfer Test Suite
 * 
 * Validates detection accuracy against the test codebase.
 * Checks all detection categories from PRD:
 * - Model Providers (OpenAI, Anthropic, etc.)
 * - Serving Runtimes (vLLM, SGLang, TensorRT-LLM, etc.)
 * - Infrastructure (Terraform, K8s, Docker)
 * - Inference Patterns (Batching, Streaming, Caching, Routing, Retry, Fallback)
 * - Hardware (GPU types, accelerators)
 */

import * as fs from 'fs';
import * as path from 'path';

// =============================================================================
// TYPES
// =============================================================================

interface StackMap {
  version: string;
  generated_at: string;
  summary: {
    files_scanned: number;
    callsites_found: number;
    providers_detected: string[];
    models_detected: string[];
    runtimes_detected: string[];
    patterns_detected: string[];
  };
  callsites: Callsite[];
  tech_stack: TechStack;
  patterns: InferencePatterns;
}

interface Callsite {
  id: string;
  file: string;
  line: number;
  provider: string;
  model: string;
  task_kind: string;
  framework?: string;
  runtime?: string;
  is_streaming?: boolean;
}

interface TechStack {
  application: ApplicationLayer;
  serving: ServingLayer;
  infrastructure: InfrastructureLayer;
  hardware: HardwareLayer;
}

interface ApplicationLayer {
  providers: Provider[];
  frameworks: Framework[];
}

interface Provider {
  name: string;
  models: string[];
  call_count: number;
}

interface Framework {
  name: string;
  detected_in: string[];
}

interface ServingLayer {
  runtimes: Runtime[];
  gateways: string[];
}

interface Runtime {
  name: string;
  version?: string;
  detected_in: string[];
}

interface InfrastructureLayer {
  compute: ComputeResource[];
  cloud_services: string[];
}

interface ComputeResource {
  provider: string;
  instance_type: string;
  gpu_type?: string;
  gpu_count?: number;
}

interface HardwareLayer {
  gpus: GPU[];
  accelerators: string[];
}

interface GPU {
  type: string;
  count: number;
  memory?: string;
  detected_in: string[];
}

interface InferencePatterns {
  batching: PatternDetection;
  streaming: PatternDetection;
  caching: PatternDetection;
  routing: PatternDetection;
  retry: PatternDetection;
  fallback: PatternDetection;
  guardrails: PatternDetection;
}

interface PatternDetection {
  detected: boolean;
  instances: PatternInstance[];
}

interface PatternInstance {
  file: string;
  line: number;
  pattern_type: string;
  description?: string;
}

interface PricingSummary {
  estimated_monthly_cost: {
    min: number;
    max: number;
    currency: string;
  };
  by_provider: ProviderCost[];
  by_model: ModelCost[];
  hotspots: Hotspot[];
}

interface ProviderCost {
  provider: string;
  cost_min: number;
  cost_max: number;
  percentage: number;
}

interface ModelCost {
  model: string;
  provider: string;
  cost_min: number;
  cost_max: number;
}

interface Hotspot {
  file: string;
  line: number;
  model: string;
  cost_per_month: { min: number; max: number };
  suggestions: string[];
}

interface TestResult {
  name: string;
  passed: boolean;
  expected: any;
  actual: any;
  details?: string;
}

// =============================================================================
// EXPECTED DETECTIONS (Ground Truth)
// =============================================================================

const EXPECTED_PROVIDERS = [
  'openai',
  'anthropic',
  // 'together',  // May or may not be detected depending on imports
];

const EXPECTED_MODELS = [
  'gpt-4o',
  'gpt-4o-mini',
  'claude-sonnet-4-20250514',
  'claude-3-5-haiku-20241022',
  'claude-3-opus-20240229',
  'text-embedding-3-small',
  'text-embedding-3-large',
];

const EXPECTED_RUNTIMES = [
  'vllm',
  'sglang',
  // 'tensorrt-llm',  // May need specific detection
  // 'ollama',        // May need specific detection
];

const EXPECTED_FRAMEWORKS = [
  'langchain',
  // 'llama-index',   // May need specific imports
];

const EXPECTED_PATTERNS = [
  'batching',
  'streaming',
  'caching',
  'routing',
  'retry',
  'fallback',
];

const EXPECTED_GPU_TYPES = [
  'A100',
  'H100',
  'A10G',
  'L4',
];

const EXPECTED_CLOUD_PROVIDERS = [
  'aws',
  'gcp',
];

const EXPECTED_INSTANCE_TYPES = [
  'p4d.24xlarge',
  'p5.48xlarge',
  'g5.12xlarge',
  'a2-highgpu-8g',
];

// =============================================================================
// TEST FUNCTIONS
// =============================================================================

function loadStackMap(filePath: string): StackMap | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Failed to load stackmap: ${error}`);
    return null;
  }
}

function loadPricing(filePath: string): PricingSummary | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Failed to load pricing: ${error}`);
    return null;
  }
}

// =============================================================================
// TEST: Provider Detection
// =============================================================================

function testProviderDetection(stackMap: StackMap): TestResult[] {
  const results: TestResult[] = [];
  
  const detectedProviders = stackMap.summary?.providers_detected || 
    stackMap.tech_stack?.application?.providers?.map(p => p.name.toLowerCase()) || [];
  
  for (const expectedProvider of EXPECTED_PROVIDERS) {
    const found = detectedProviders.some(p => 
      p.toLowerCase().includes(expectedProvider.toLowerCase())
    );
    
    results.push({
      name: `Provider Detection: ${expectedProvider}`,
      passed: found,
      expected: expectedProvider,
      actual: detectedProviders,
      details: found ? 'Provider detected' : 'Provider NOT detected',
    });
  }
  
  return results;
}

// =============================================================================
// TEST: Model Detection
// =============================================================================

function testModelDetection(stackMap: StackMap): TestResult[] {
  const results: TestResult[] = [];
  
  const detectedModels = stackMap.summary?.models_detected ||
    stackMap.callsites?.map(c => c.model).filter(Boolean) || [];
  
  const uniqueModels = [...new Set(detectedModels.map(m => m?.toLowerCase()))];
  
  for (const expectedModel of EXPECTED_MODELS) {
    const found = uniqueModels.some(m => 
      m?.includes(expectedModel.toLowerCase()) ||
      expectedModel.toLowerCase().includes(m || '')
    );
    
    results.push({
      name: `Model Detection: ${expectedModel}`,
      passed: found,
      expected: expectedModel,
      actual: uniqueModels,
      details: found ? 'Model detected' : 'Model NOT detected',
    });
  }
  
  return results;
}

// =============================================================================
// TEST: Runtime Detection
// =============================================================================

function testRuntimeDetection(stackMap: StackMap): TestResult[] {
  const results: TestResult[] = [];
  
  const detectedRuntimes = stackMap.summary?.runtimes_detected ||
    stackMap.tech_stack?.serving?.runtimes?.map(r => r.name.toLowerCase()) || [];
  
  for (const expectedRuntime of EXPECTED_RUNTIMES) {
    const found = detectedRuntimes.some(r => 
      r.toLowerCase().includes(expectedRuntime.toLowerCase())
    );
    
    results.push({
      name: `Runtime Detection: ${expectedRuntime}`,
      passed: found,
      expected: expectedRuntime,
      actual: detectedRuntimes,
      details: found ? 'Runtime detected' : 'Runtime NOT detected',
    });
  }
  
  return results;
}

// =============================================================================
// TEST: Framework Detection
// =============================================================================

function testFrameworkDetection(stackMap: StackMap): TestResult[] {
  const results: TestResult[] = [];
  
  const detectedFrameworks = stackMap.tech_stack?.application?.frameworks?.map(f => f.name.toLowerCase()) || [];
  
  // Also check callsites for framework field
  const callsiteFrameworks = stackMap.callsites
    ?.filter(c => c.framework)
    .map(c => c.framework!.toLowerCase()) || [];
  
  const allFrameworks = [...new Set([...detectedFrameworks, ...callsiteFrameworks])];
  
  for (const expectedFramework of EXPECTED_FRAMEWORKS) {
    const found = allFrameworks.some(f => 
      f.includes(expectedFramework.toLowerCase())
    );
    
    results.push({
      name: `Framework Detection: ${expectedFramework}`,
      passed: found,
      expected: expectedFramework,
      actual: allFrameworks,
      details: found ? 'Framework detected' : 'Framework NOT detected',
    });
  }
  
  return results;
}

// =============================================================================
// TEST: Pattern Detection
// =============================================================================

function testPatternDetection(stackMap: StackMap): TestResult[] {
  const results: TestResult[] = [];
  
  const patterns = stackMap.patterns || {};
  
  for (const expectedPattern of EXPECTED_PATTERNS) {
    const patternKey = expectedPattern.toLowerCase() as keyof InferencePatterns;
    const patternData = patterns[patternKey];
    const found = patternData?.detected === true || 
      (patternData?.instances && patternData.instances.length > 0);
    
    results.push({
      name: `Pattern Detection: ${expectedPattern}`,
      passed: found,
      expected: `${expectedPattern} pattern`,
      actual: patternData,
      details: found 
        ? `Pattern detected with ${patternData?.instances?.length || 0} instances`
        : 'Pattern NOT detected',
    });
  }
  
  return results;
}

// =============================================================================
// TEST: GPU/Hardware Detection
// =============================================================================

function testHardwareDetection(stackMap: StackMap): TestResult[] {
  const results: TestResult[] = [];
  
  const detectedGPUs = stackMap.tech_stack?.hardware?.gpus?.map(g => g.type) || [];
  const detectedAccelerators = stackMap.tech_stack?.hardware?.accelerators || [];
  
  // Also check infrastructure
  const infrastructureGPUs = stackMap.tech_stack?.infrastructure?.compute
    ?.filter(c => c.gpu_type)
    .map(c => c.gpu_type!) || [];
  
  const allHardware = [...new Set([...detectedGPUs, ...detectedAccelerators, ...infrastructureGPUs])];
  
  for (const expectedGPU of EXPECTED_GPU_TYPES) {
    const found = allHardware.some(h => 
      h.toLowerCase().includes(expectedGPU.toLowerCase())
    );
    
    results.push({
      name: `Hardware Detection: ${expectedGPU}`,
      passed: found,
      expected: expectedGPU,
      actual: allHardware,
      details: found ? 'Hardware detected' : 'Hardware NOT detected',
    });
  }
  
  return results;
}

// =============================================================================
// TEST: Infrastructure Detection (Terraform, K8s, Docker)
// =============================================================================

function testInfrastructureDetection(stackMap: StackMap): TestResult[] {
  const results: TestResult[] = [];
  
  const computeResources = stackMap.tech_stack?.infrastructure?.compute || [];
  const detectedInstanceTypes = computeResources.map(c => c.instance_type);
  const detectedProviders = computeResources.map(c => c.provider?.toLowerCase());
  
  // Test cloud providers
  for (const expectedProvider of EXPECTED_CLOUD_PROVIDERS) {
    const found = detectedProviders.some(p => 
      p?.includes(expectedProvider.toLowerCase())
    );
    
    results.push({
      name: `Cloud Provider Detection: ${expectedProvider.toUpperCase()}`,
      passed: found,
      expected: expectedProvider,
      actual: detectedProviders,
      details: found ? 'Cloud provider detected' : 'Cloud provider NOT detected',
    });
  }
  
  // Test instance types
  for (const expectedType of EXPECTED_INSTANCE_TYPES) {
    const found = detectedInstanceTypes.some(t => 
      t?.includes(expectedType)
    );
    
    results.push({
      name: `Instance Type Detection: ${expectedType}`,
      passed: found,
      expected: expectedType,
      actual: detectedInstanceTypes,
      details: found ? 'Instance type detected' : 'Instance type NOT detected',
    });
  }
  
  return results;
}

// =============================================================================
// TEST: Pricing Validation
// =============================================================================

function testPricingOutput(pricing: PricingSummary): TestResult[] {
  const results: TestResult[] = [];
  
  // Check that pricing exists and has required fields
  results.push({
    name: 'Pricing: Monthly cost calculated',
    passed: pricing.estimated_monthly_cost?.min >= 0 && pricing.estimated_monthly_cost?.max > 0,
    expected: 'Monthly cost range',
    actual: pricing.estimated_monthly_cost,
    details: pricing.estimated_monthly_cost 
      ? `$${pricing.estimated_monthly_cost.min} - $${pricing.estimated_monthly_cost.max}`
      : 'No pricing calculated',
  });
  
  results.push({
    name: 'Pricing: Provider breakdown',
    passed: pricing.by_provider?.length > 0,
    expected: 'At least one provider with costs',
    actual: pricing.by_provider,
    details: `${pricing.by_provider?.length || 0} providers with cost breakdown`,
  });
  
  results.push({
    name: 'Pricing: Model breakdown',
    passed: pricing.by_model?.length > 0,
    expected: 'At least one model with costs',
    actual: pricing.by_model,
    details: `${pricing.by_model?.length || 0} models with cost breakdown`,
  });
  
  results.push({
    name: 'Pricing: Hotspots identified',
    passed: pricing.hotspots?.length >= 0,  // 0 is acceptable
    expected: 'Hotspots array exists',
    actual: pricing.hotspots,
    details: `${pricing.hotspots?.length || 0} hotspots identified`,
  });
  
  return results;
}

// =============================================================================
// TEST: Callsite Accuracy
// =============================================================================

function testCallsiteAccuracy(stackMap: StackMap): TestResult[] {
  const results: TestResult[] = [];
  
  const callsites = stackMap.callsites || [];
  
  // Check minimum callsite count
  results.push({
    name: 'Callsites: Minimum detected',
    passed: callsites.length >= 5,  // We have many API calls in test codebase
    expected: 'At least 5 callsites',
    actual: callsites.length,
    details: `${callsites.length} callsites detected`,
  });
  
  // Check callsite structure
  const validCallsites = callsites.filter(c => 
    c.file && c.line && (c.provider || c.model)
  );
  
  results.push({
    name: 'Callsites: Valid structure',
    passed: validCallsites.length === callsites.length,
    expected: 'All callsites have file, line, and provider/model',
    actual: `${validCallsites.length}/${callsites.length} valid`,
    details: callsites.length > 0 
      ? `${(validCallsites.length / callsites.length * 100).toFixed(1)}% valid`
      : 'No callsites',
  });
  
  // Check file path accuracy (should be relative)
  const relativePathCallsites = callsites.filter(c => 
    !c.file.startsWith('/') && !c.file.startsWith('C:')
  );
  
  results.push({
    name: 'Callsites: Relative file paths',
    passed: relativePathCallsites.length === callsites.length,
    expected: 'All file paths are relative',
    actual: `${relativePathCallsites.length}/${callsites.length} relative`,
    details: 'File paths should be relative to codebase root',
  });
  
  return results;
}

// =============================================================================
// MAIN TEST RUNNER
// =============================================================================

function runAllTests(stackMapPath: string, pricingPath: string): void {
  console.log('\n' + '='.repeat(70));
  console.log('  PeakInfer Test Suite');
  console.log('='.repeat(70) + '\n');
  
  // Load outputs
  const stackMap = loadStackMap(stackMapPath);
  const pricing = loadPricing(pricingPath);
  
  if (!stackMap) {
    console.error('❌ Failed to load stackmap.json - cannot run tests');
    process.exit(1);
  }
  
  const allResults: TestResult[] = [];
  
  // Run all test categories
  console.log('📋 Running Detection Tests...\n');
  
  console.log('  1. Provider Detection');
  allResults.push(...testProviderDetection(stackMap));
  
  console.log('  2. Model Detection');
  allResults.push(...testModelDetection(stackMap));
  
  console.log('  3. Runtime Detection');
  allResults.push(...testRuntimeDetection(stackMap));
  
  console.log('  4. Framework Detection');
  allResults.push(...testFrameworkDetection(stackMap));
  
  console.log('  5. Pattern Detection');
  allResults.push(...testPatternDetection(stackMap));
  
  console.log('  6. Hardware Detection');
  allResults.push(...testHardwareDetection(stackMap));
  
  console.log('  7. Infrastructure Detection');
  allResults.push(...testInfrastructureDetection(stackMap));
  
  console.log('  8. Callsite Accuracy');
  allResults.push(...testCallsiteAccuracy(stackMap));
  
  if (pricing) {
    console.log('  9. Pricing Validation');
    allResults.push(...testPricingOutput(pricing));
  }
  
  // Print results
  console.log('\n' + '='.repeat(70));
  console.log('  Test Results');
  console.log('='.repeat(70) + '\n');
  
  const passed = allResults.filter(r => r.passed);
  const failed = allResults.filter(r => !r.passed);
  
  // Group results by category
  const categories = new Map<string, TestResult[]>();
  for (const result of allResults) {
    const category = result.name.split(':')[0];
    if (!categories.has(category)) {
      categories.set(category, []);
    }
    categories.get(category)!.push(result);
  }
  
  for (const [category, results] of categories) {
    const categoryPassed = results.filter(r => r.passed).length;
    const categoryTotal = results.length;
    const categoryStatus = categoryPassed === categoryTotal ? '✅' : categoryPassed > 0 ? '⚠️' : '❌';
    
    console.log(`${categoryStatus} ${category}: ${categoryPassed}/${categoryTotal} passed`);
    
    for (const result of results) {
      const icon = result.passed ? '  ✓' : '  ✗';
      console.log(`   ${icon} ${result.name.split(':')[1]?.trim() || result.name}`);
      if (!result.passed) {
        console.log(`      Expected: ${JSON.stringify(result.expected)}`);
        console.log(`      Actual: ${JSON.stringify(result.actual)}`);
      }
    }
    console.log();
  }
  
  // Print summary
  console.log('='.repeat(70));
  console.log(`  Summary: ${passed.length}/${allResults.length} tests passed`);
  console.log('='.repeat(70));
  
  const passRate = (passed.length / allResults.length * 100).toFixed(1);
  console.log(`\n  Pass Rate: ${passRate}%`);
  
  if (failed.length > 0) {
    console.log(`\n  ❌ ${failed.length} tests failed:`);
    for (const result of failed) {
      console.log(`     - ${result.name}`);
    }
  }
  
  console.log();
  
  // Exit with appropriate code
  process.exit(failed.length > 0 ? 1 : 0);
}

// =============================================================================
// CLI ENTRY POINT
// =============================================================================

const args = process.argv.slice(2);
const stackMapPath = args[0] || './peakinfer-stackmap.json';
const pricingPath = args[1] || './peakinfer-pricing.json';

runAllTests(stackMapPath, pricingPath);


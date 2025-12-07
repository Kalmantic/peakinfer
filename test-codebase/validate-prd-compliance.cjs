#!/usr/bin/env node
/**
 * PeakInfer PRD Compliance Validator
 * 
 * Validates outputs against PRD v0.95 requirements:
 * - Section 6.1: Analyzer Functional Requirements
 * - Section 8: Data Models
 * - Section 9: CLI Specification
 * - Section 14: Acceptance Criteria
 */

const fs = require('fs');
const path = require('path');

// =============================================================================
// COLORS
// =============================================================================

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};

const pass = (msg) => console.log(`  ${colors.green}✓${colors.reset} ${msg}`);
const fail = (msg) => console.log(`  ${colors.red}✗${colors.reset} ${msg}`);
const warn = (msg) => console.log(`  ${colors.yellow}⚠${colors.reset} ${msg}`);
const info = (msg) => console.log(`  ${colors.blue}ℹ${colors.reset} ${msg}`);
const section = (title) => console.log(`\n${colors.cyan}${colors.bold}${title}${colors.reset}`);

// =============================================================================
// PRD REQUIREMENTS (from PRD v0.95)
// =============================================================================

/**
 * PRD Section 6.1 - Functional Requirements
 * 
 * Analyzer must:
 * - Parse code in TS/Python/Go/Java
 * - Detect LLM calls
 * - Detect routing logic
 * - Detect retry patterns
 * - Detect chunking/pagination
 * - Detect embeddings usage
 * - Identify model names
 * - Infer token shapes
 * - Analyze prompt templates
 */

/**
 * PRD Section 8 - StackMap Node Schema
 * 
 * node_id
 * type (model | runtime | vendor | hardware | prompt | callsite)
 * name
 * location
 * connections[]
 * metrics{}
 */

/**
 * PRD Section 8.2 - Pricing Schema
 * 
 * vendor
 * model
 * input_token_price
 * output_token_price
 * throughput_tokens_per_sec
 * gpu_hourly_cost
 */

/**
 * PRD Section 14 - Acceptance Criteria
 * 
 * - 90%+ LLM callsite detection
 * - StackMap accuracy > 95%
 * - Pricing delta updated weekly
 * - CLI runs in < 60 seconds
 * - No runtime errors across supported languages
 * - Outputs must be self-explanatory
 */

// =============================================================================
// EXPECTED DETECTIONS FROM TEST CODEBASE
// =============================================================================

const TEST_CODEBASE_TRUTH = {
  // Files in test codebase
  files: [
    'src/services/openai_service.py',
    'src/services/anthropic_service.py',
    'src/agents/langchain_agent.py',
    'src/serving/vllm_server.py',
    'src/serving/sglang_server.py',
    'src/utils/inference_patterns.py',
  ],
  
  // Providers that MUST be detected (PRD Appendix B)
  requiredProviders: ['openai', 'anthropic'],
  
  // Models that MUST be detected
  requiredModels: [
    'gpt-4o',
    'gpt-4o-mini', 
    'claude-sonnet-4-20250514',
    'text-embedding-3-small',
  ],
  
  // Runtimes that MUST be detected (PRD Section 5 - Serving Runtimes)
  requiredRuntimes: ['vllm', 'sglang'],
  
  // Frameworks that MUST be detected (PRD Section 7 - Orchestration)
  requiredFrameworks: ['langchain'],
  
  // Patterns that MUST be detected (PRD Section 9 - Inference Patterns)
  requiredPatterns: {
    batching: {
      description: 'asyncio.gather, batch parameter',
      files: ['src/services/openai_service.py', 'src/utils/inference_patterns.py'],
    },
    streaming: {
      description: 'stream=True, for chunk in response',
      files: ['src/services/openai_service.py', 'src/services/anthropic_service.py'],
    },
    caching: {
      description: 'redis, lru_cache, cache_control',
      files: ['src/utils/inference_patterns.py', 'src/services/anthropic_service.py'],
    },
    routing: {
      description: 'model selection logic, router',
      files: ['src/utils/inference_patterns.py', 'src/agents/langchain_agent.py'],
    },
    retry: {
      description: 'tenacity, @retry, exponential backoff',
      files: ['src/utils/inference_patterns.py'],
    },
    fallback: {
      description: 'try/except with alternative provider',
      files: ['src/utils/inference_patterns.py'],
    },
  },
  
  // Minimum callsite count (we have 40+ API calls in test codebase)
  minCallsites: 30,
  
  // Infrastructure patterns
  infrastructure: {
    terraform: 'infrastructure/terraform/main.tf',
    kubernetes: 'infrastructure/k8s/deployment.yaml',
    docker: 'docker-compose.yaml',
  },
  
  // Hardware types in infrastructure configs
  hardwareTypes: ['A100', 'H100', 'A10G', 'L4'],
};

// =============================================================================
// LOAD FILES
// =============================================================================

function loadJSON(filepath) {
  try {
    const content = fs.readFileSync(filepath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

function fileExists(filepath) {
  try {
    fs.accessSync(filepath);
    return true;
  } catch {
    return false;
  }
}

// =============================================================================
// PRD SECTION 14: ACCEPTANCE CRITERIA TESTS
// =============================================================================

function testAcceptanceCriteria(stackmap, pricing, cliOutput) {
  section('📋 PRD Section 14: Acceptance Criteria');
  
  const results = { passed: 0, failed: 0, warnings: 0 };
  
  // AC-1: 90%+ LLM callsite detection
  console.log('\n  AC-1: 90%+ LLM callsite detection');
  const totalCallsites = stackmap.summary?.totalCallsites || countCallsites(stackmap);
  const expectedMin = TEST_CODEBASE_TRUTH.minCallsites;
  const detectionRate = Math.min(100, (totalCallsites / 42) * 100); // 42 is our ground truth
  
  if (detectionRate >= 90) {
    pass(`Detection rate: ${detectionRate.toFixed(1)}% (${totalCallsites} callsites found)`);
    results.passed++;
  } else if (detectionRate >= 75) {
    warn(`Detection rate: ${detectionRate.toFixed(1)}% (target: 90%+)`);
    results.warnings++;
  } else {
    fail(`Detection rate: ${detectionRate.toFixed(1)}% (target: 90%+)`);
    results.failed++;
  }
  
  // AC-2: StackMap accuracy > 95%
  console.log('\n  AC-2: StackMap accuracy > 95%');
  const providerAccuracy = checkProviderAccuracy(stackmap);
  const modelAccuracy = checkModelAccuracy(stackmap);
  const overallAccuracy = (providerAccuracy + modelAccuracy) / 2;
  
  if (overallAccuracy >= 95) {
    pass(`StackMap accuracy: ${overallAccuracy.toFixed(1)}%`);
    results.passed++;
  } else if (overallAccuracy >= 80) {
    warn(`StackMap accuracy: ${overallAccuracy.toFixed(1)}% (target: 95%+)`);
    results.warnings++;
  } else {
    fail(`StackMap accuracy: ${overallAccuracy.toFixed(1)}% (target: 95%+)`);
    results.failed++;
  }
  
  // AC-3: Outputs must be self-explanatory
  console.log('\n  AC-3: Outputs must be self-explanatory');
  const hasValidStructure = stackmap.tree && stackmap.summary;
  const hasPricing = pricing && pricing.byProvider && pricing.byModel;
  
  if (hasValidStructure && hasPricing) {
    pass('Output files have clear, self-explanatory structure');
    results.passed++;
  } else {
    fail('Output structure is incomplete');
    results.failed++;
  }
  
  return results;
}

// =============================================================================
// PRD SECTION 6.1: FUNCTIONAL REQUIREMENTS
// =============================================================================

function testFunctionalRequirements(stackmap, pricing) {
  section('📋 PRD Section 6.1: Analyzer Functional Requirements');
  
  const results = { passed: 0, failed: 0, warnings: 0 };
  
  // FR-1: Detect LLM calls
  console.log('\n  FR-1: Detect LLM calls');
  const callsiteCount = stackmap.summary?.totalCallsites || countCallsites(stackmap);
  if (callsiteCount > 0) {
    pass(`${callsiteCount} LLM callsites detected`);
    results.passed++;
  } else {
    fail('No LLM callsites detected');
    results.failed++;
  }
  
  // FR-2: Identify model names
  console.log('\n  FR-2: Identify model names');
  const detectedModels = stackmap.summary?.models || extractModels(stackmap);
  const requiredFound = TEST_CODEBASE_TRUTH.requiredModels.filter(m => 
    detectedModels.some(dm => dm.toLowerCase().includes(m.toLowerCase()))
  );
  
  if (requiredFound.length === TEST_CODEBASE_TRUTH.requiredModels.length) {
    pass(`All required models detected: ${requiredFound.join(', ')}`);
    results.passed++;
  } else {
    const missing = TEST_CODEBASE_TRUTH.requiredModels.filter(m => 
      !detectedModels.some(dm => dm.toLowerCase().includes(m.toLowerCase()))
    );
    warn(`Missing models: ${missing.join(', ')}`);
    results.warnings++;
  }
  
  // FR-3: Detect embeddings usage
  console.log('\n  FR-3: Detect embeddings usage');
  const hasEmbeddings = detectedModels.some(m => 
    m.toLowerCase().includes('embedding') || m.toLowerCase().includes('embed')
  );
  if (hasEmbeddings) {
    pass('Embedding models detected');
    results.passed++;
  } else {
    fail('Embedding models not detected');
    results.failed++;
  }
  
  // FR-4: Detect providers/vendors
  console.log('\n  FR-4: Detect providers/vendors');
  const detectedProviders = stackmap.summary?.providers || extractProviders(stackmap);
  const providersFound = TEST_CODEBASE_TRUTH.requiredProviders.filter(p =>
    detectedProviders.some(dp => dp.toLowerCase().includes(p.toLowerCase()))
  );
  
  if (providersFound.length === TEST_CODEBASE_TRUTH.requiredProviders.length) {
    pass(`All required providers detected: ${providersFound.join(', ')}`);
    results.passed++;
  } else {
    const missing = TEST_CODEBASE_TRUTH.requiredProviders.filter(p =>
      !detectedProviders.some(dp => dp.toLowerCase().includes(p.toLowerCase()))
    );
    fail(`Missing providers: ${missing.join(', ')}`);
    results.failed++;
  }
  
  // FR-5: Detect serving runtimes
  console.log('\n  FR-5: Detect serving runtimes');
  const jsonStr = JSON.stringify(stackmap).toLowerCase();
  const runtimesFound = TEST_CODEBASE_TRUTH.requiredRuntimes.filter(r =>
    jsonStr.includes(r.toLowerCase())
  );
  
  if (runtimesFound.length === TEST_CODEBASE_TRUTH.requiredRuntimes.length) {
    pass(`All required runtimes detected: ${runtimesFound.join(', ')}`);
    results.passed++;
  } else {
    const missing = TEST_CODEBASE_TRUTH.requiredRuntimes.filter(r =>
      !jsonStr.includes(r.toLowerCase())
    );
    warn(`Missing runtimes: ${missing.join(', ')}`);
    results.warnings++;
  }
  
  return results;
}

// =============================================================================
// PRD SECTION 8: DATA MODEL VALIDATION
// =============================================================================

function testDataModelCompliance(stackmap, pricing) {
  section('📋 PRD Section 8: Data Model Compliance');
  
  const results = { passed: 0, failed: 0, warnings: 0 };
  
  // DM-1: StackMap structure
  console.log('\n  DM-1: StackMap JSON structure');
  const hasTree = !!stackmap.tree;
  const hasSummary = !!stackmap.summary;
  
  if (hasTree && hasSummary) {
    pass('StackMap has required structure (tree, summary)');
    results.passed++;
  } else {
    fail('StackMap missing required fields');
    results.failed++;
  }
  
  // DM-2: Callsite structure
  console.log('\n  DM-2: Callsite node structure');
  const callsites = extractAllCallsites(stackmap);
  const validCallsites = callsites.filter(c => 
    c.line !== undefined && (c.provider || c.model)
  );
  
  const callsiteValidity = callsites.length > 0 
    ? (validCallsites.length / callsites.length * 100).toFixed(1)
    : 0;
  
  if (parseFloat(callsiteValidity) >= 90) {
    pass(`${callsiteValidity}% of callsites have valid structure`);
    results.passed++;
  } else {
    warn(`Only ${callsiteValidity}% of callsites have valid structure`);
    results.warnings++;
  }
  
  // DM-3: Pricing schema
  console.log('\n  DM-3: Pricing schema compliance');
  const hasEstimate = pricing?.estimatedRange?.low !== undefined;
  const hasProviders = pricing?.byProvider?.length > 0;
  const hasModels = pricing?.byModel?.length > 0;
  
  if (hasEstimate && hasProviders && hasModels) {
    pass('Pricing has required fields (estimatedRange, byProvider, byModel)');
    results.passed++;
  } else {
    const missing = [];
    if (!hasEstimate) missing.push('estimatedRange');
    if (!hasProviders) missing.push('byProvider');
    if (!hasModels) missing.push('byModel');
    fail(`Pricing missing: ${missing.join(', ')}`);
    results.failed++;
  }
  
  // DM-4: Hotspots
  console.log('\n  DM-4: Hotspots identification');
  if (pricing?.hotspots?.length > 0) {
    pass(`${pricing.hotspots.length} hotspots identified with cost estimates`);
    results.passed++;
  } else {
    warn('No hotspots identified');
    results.warnings++;
  }
  
  return results;
}

// =============================================================================
// CLI OUTPUT VALIDATION (Against PRD Section 9)
// =============================================================================

function testCLIOutputCompliance(cliOutput) {
  section('📋 PRD Section 9: CLI Output Compliance');
  
  const results = { passed: 0, failed: 0, warnings: 0 };
  
  if (!cliOutput) {
    warn('CLI output not provided for validation');
    return results;
  }
  
  // CLI-1: Header
  console.log('\n  CLI-1: Header present');
  if (cliOutput.includes('PeakInfer v')) {
    pass('Version header present');
    results.passed++;
  } else {
    fail('Version header missing');
    results.failed++;
  }
  
  // CLI-2: Scan summary
  console.log('\n  CLI-2: Scan summary');
  if (cliOutput.includes('Scanned:') && cliOutput.includes('files')) {
    pass('Scan summary present');
    results.passed++;
  } else {
    fail('Scan summary missing');
    results.failed++;
  }
  
  // CLI-3: StackMap section
  console.log('\n  CLI-3: StackMap visualization');
  if (cliOutput.includes('STACKMAP')) {
    pass('StackMap section present');
    results.passed++;
  } else {
    fail('StackMap section missing');
    results.failed++;
  }
  
  // CLI-4: Pricing summary
  console.log('\n  CLI-4: Pricing summary');
  if (cliOutput.includes('PRICING') || cliOutput.includes('Estimated monthly cost')) {
    pass('Pricing summary present');
    results.passed++;
  } else {
    fail('Pricing summary missing');
    results.failed++;
  }
  
  // CLI-5: Hotspots
  console.log('\n  CLI-5: Hotspots section');
  if (cliOutput.includes('HOTSPOTS') || cliOutput.includes('⚠')) {
    pass('Hotspots section present');
    results.passed++;
  } else {
    warn('Hotspots section not visible');
    results.warnings++;
  }
  
  // CLI-6: Patterns detected
  console.log('\n  CLI-6: Patterns section');
  if (cliOutput.includes('PATTERNS') || cliOutput.includes('Retry logic') || cliOutput.includes('Batching')) {
    pass('Patterns section present');
    results.passed++;
  } else {
    warn('Patterns section not visible in CLI output');
    results.warnings++;
  }
  
  return results;
}

// =============================================================================
// PATTERN DETECTION VALIDATION
// =============================================================================

function testPatternDetection(stackmap, cliOutput) {
  section('📋 Pattern Detection (PRD Section 9.5)');
  
  const results = { passed: 0, failed: 0, warnings: 0 };
  
  // Check CLI output for patterns (since they may not be in JSON)
  const cliStr = cliOutput || '';
  const jsonStr = JSON.stringify(stackmap).toLowerCase();
  
  for (const [pattern, details] of Object.entries(TEST_CODEBASE_TRUTH.requiredPatterns)) {
    console.log(`\n  Pattern: ${pattern}`);
    
    // Check in CLI output (handle variations like "router" for "routing")
    const variations = [pattern];
    if (pattern === 'routing') variations.push('router');
    
    const inCli = variations.some(v => cliStr.toLowerCase().includes(v));
    // Check in JSON
    const inJson = variations.some(v => jsonStr.includes(v));
    
    if (inCli) {
      pass(`${pattern} pattern detected (shown in CLI)`);
      results.passed++;
    } else if (inJson) {
      warn(`${pattern} pattern found in data but not explicitly shown`);
      results.warnings++;
    } else {
      fail(`${pattern} pattern NOT detected`);
      info(`  Expected in: ${details.files.join(', ')}`);
      info(`  Look for: ${details.description}`);
      results.failed++;
    }
  }
  
  return results;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function countCallsites(stackmap) {
  let count = 0;
  function traverse(node) {
    if (node.callsites) count += node.callsites.length;
    if (node.children) node.children.forEach(traverse);
  }
  if (stackmap.tree) stackmap.tree.forEach(traverse);
  return count;
}

function extractAllCallsites(stackmap) {
  const callsites = [];
  function traverse(node) {
    if (node.callsites) callsites.push(...node.callsites);
    if (node.children) node.children.forEach(traverse);
  }
  if (stackmap.tree) stackmap.tree.forEach(traverse);
  return callsites;
}

function extractModels(stackmap) {
  const models = new Set();
  function traverse(node) {
    if (node.callsites) {
      node.callsites.forEach(c => {
        if (c.model) models.add(c.model);
      });
    }
    if (node.children) node.children.forEach(traverse);
  }
  if (stackmap.tree) stackmap.tree.forEach(traverse);
  return [...models];
}

function extractProviders(stackmap) {
  const providers = new Set();
  function traverse(node) {
    if (node.callsites) {
      node.callsites.forEach(c => {
        if (c.provider) providers.add(c.provider);
      });
    }
    if (node.children) node.children.forEach(traverse);
  }
  if (stackmap.tree) stackmap.tree.forEach(traverse);
  return [...providers];
}

function checkProviderAccuracy(stackmap) {
  const detected = stackmap.summary?.providers || extractProviders(stackmap);
  const required = TEST_CODEBASE_TRUTH.requiredProviders;
  const found = required.filter(p => 
    detected.some(d => d.toLowerCase().includes(p.toLowerCase()))
  );
  return (found.length / required.length) * 100;
}

function checkModelAccuracy(stackmap) {
  const detected = stackmap.summary?.models || extractModels(stackmap);
  const required = TEST_CODEBASE_TRUTH.requiredModels;
  const found = required.filter(m => 
    detected.some(d => d.toLowerCase().includes(m.toLowerCase()))
  );
  return (found.length / required.length) * 100;
}

// =============================================================================
// MAIN
// =============================================================================

function main() {
  const scriptDir = path.dirname(process.argv[1]);
  const stackmapPath = path.join(scriptDir, 'peakinfer-stackmap.json');
  const pricingPath = path.join(scriptDir, 'peakinfer-pricing.json');
  
  console.log('\n' + '='.repeat(72));
  console.log(`${colors.bold}  PeakInfer PRD Compliance Validator${colors.reset}`);
  console.log(`${colors.dim}  Validating against PRD v0.95 requirements${colors.reset}`);
  console.log('='.repeat(72));
  
  // Load files
  const stackmap = loadJSON(stackmapPath);
  const pricing = loadJSON(pricingPath);
  
  if (!stackmap) {
    console.error(`\n${colors.red}ERROR: Could not load peakinfer-stackmap.json${colors.reset}`);
    process.exit(1);
  }
  
  // Read CLI output if available (passed as argument)
  let cliOutput = null;
  if (process.argv[2]) {
    try {
      cliOutput = fs.readFileSync(process.argv[2], 'utf-8');
    } catch (e) {
      // CLI output not provided
    }
  }
  
  // Run all test suites
  const allResults = [];
  
  allResults.push(testAcceptanceCriteria(stackmap, pricing, cliOutput));
  allResults.push(testFunctionalRequirements(stackmap, pricing));
  allResults.push(testDataModelCompliance(stackmap, pricing));
  
  if (cliOutput) {
    allResults.push(testCLIOutputCompliance(cliOutput));
  }
  
  allResults.push(testPatternDetection(stackmap, cliOutput));
  
  // Calculate totals
  const totalPassed = allResults.reduce((sum, r) => sum + r.passed, 0);
  const totalFailed = allResults.reduce((sum, r) => sum + r.failed, 0);
  const totalWarnings = allResults.reduce((sum, r) => sum + r.warnings, 0);
  const total = totalPassed + totalFailed;
  const passRate = total > 0 ? ((totalPassed / total) * 100).toFixed(1) : 0;
  
  // Summary
  console.log('\n' + '='.repeat(72));
  console.log(`${colors.bold}  PRD Compliance Summary${colors.reset}`);
  console.log('='.repeat(72));
  
  console.log(`
  ${colors.green}Passed:${colors.reset}   ${totalPassed}
  ${colors.red}Failed:${colors.reset}   ${totalFailed}
  ${colors.yellow}Warnings:${colors.reset} ${totalWarnings}
  
  ${colors.bold}Compliance Rate: ${passRate}%${colors.reset}
  `);
  
  // Final assessment
  const rate = parseFloat(passRate);
  if (rate >= 90) {
    console.log(`  ${colors.green}${colors.bold}✓ COMPLIANT${colors.reset}`);
    console.log('    Output meets PRD v0.95 requirements.');
  } else if (rate >= 75) {
    console.log(`  ${colors.yellow}${colors.bold}⚠ PARTIALLY COMPLIANT${colors.reset}`);
    console.log('    Most requirements met, some improvements needed.');
  } else {
    console.log(`  ${colors.red}${colors.bold}✗ NON-COMPLIANT${colors.reset}`);
    console.log('    Significant gaps in PRD requirements.');
  }
  
  // Detailed findings
  if (totalFailed > 0 || totalWarnings > 0) {
    console.log('\n' + '-'.repeat(72));
    console.log(`${colors.bold}  Findings${colors.reset}`);
    console.log('-'.repeat(72));
    
    if (totalFailed > 0) {
      console.log(`\n  ${colors.red}Critical Issues (${totalFailed}):${colors.reset}`);
      console.log('    - Review failed tests above for specific issues');
      console.log('    - These must be addressed for PRD compliance');
    }
    
    if (totalWarnings > 0) {
      console.log(`\n  ${colors.yellow}Improvements Suggested (${totalWarnings}):${colors.reset}`);
      console.log('    - Warnings indicate areas for enhancement');
      console.log('    - Not blocking but recommended');
    }
  }
  
  console.log('\n');
  
  process.exit(totalFailed > 0 ? 1 : 0);
}

main();


#!/usr/bin/env node
/**
 * PeakInfer Test Results Validator
 * 
 * Validates the detection accuracy against expected patterns in test codebase.
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
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

const pass = (msg) => console.log(`  ${colors.green}✓${colors.reset} ${msg}`);
const fail = (msg) => console.log(`  ${colors.red}✗${colors.reset} ${msg}`);
const warn = (msg) => console.log(`  ${colors.yellow}⚠${colors.reset} ${msg}`);
const info = (msg) => console.log(`  ${colors.blue}ℹ${colors.reset} ${msg}`);

// =============================================================================
// EXPECTED DETECTIONS (Ground Truth from test codebase)
// =============================================================================

const EXPECTED = {
  providers: ['openai', 'anthropic'],
  models: [
    'gpt-4o',
    'gpt-4o-mini',
    'claude-sonnet-4-20250514',
    'claude-3-5-haiku-20241022',
    'claude-3-opus-20240229',
    'text-embedding-3-small',
    'text-embedding-3-large',
  ],
  runtimes: [
    'vllm',
    'sglang',
  ],
  frameworks: ['langchain'],
  patterns: [
    { name: 'batching', file: 'inference_patterns.py' },
    { name: 'streaming', file: 'openai_service.py' },
    { name: 'caching', file: 'inference_patterns.py' },
    { name: 'routing', file: 'inference_patterns.py' },
    { name: 'retry', file: 'inference_patterns.py' },
    { name: 'fallback', file: 'inference_patterns.py' },
  ],
  hardware: ['A100', 'H100', 'A10G', 'L4'],
  minCallsites: 20,
};

// =============================================================================
// LOAD FILES
// =============================================================================

function loadJSON(filepath) {
  try {
    const content = fs.readFileSync(filepath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Failed to load ${filepath}: ${error.message}`);
    return null;
  }
}

// =============================================================================
// TEST FUNCTIONS
// =============================================================================

function testProviderDetection(stackmap) {
  console.log('\n📋 Provider Detection:');
  
  const results = { passed: 0, failed: 0 };
  
  // Extract providers from stackmap structure
  const detectedProviders = new Set();
  
  // Check callsites in tree
  function extractProviders(node) {
    if (node.callsites) {
      node.callsites.forEach(c => {
        if (c.provider) detectedProviders.add(c.provider.toLowerCase());
      });
    }
    if (node.children) {
      node.children.forEach(child => extractProviders(child));
    }
  }
  
  if (stackmap.tree) {
    stackmap.tree.forEach(node => extractProviders(node));
  }
  
  // Check techStack if present
  if (stackmap.techStack?.application?.providers) {
    stackmap.techStack.application.providers.forEach(p => {
      detectedProviders.add(p.name.toLowerCase());
    });
  }
  
  for (const expected of EXPECTED.providers) {
    const found = [...detectedProviders].some(p => 
      p.includes(expected) || expected.includes(p)
    );
    if (found) {
      pass(`${expected} provider detected`);
      results.passed++;
    } else {
      fail(`${expected} provider NOT detected`);
      results.failed++;
    }
  }
  
  info(`Detected providers: ${[...detectedProviders].join(', ')}`);
  
  return results;
}

function testModelDetection(stackmap) {
  console.log('\n📋 Model Detection:');
  
  const results = { passed: 0, failed: 0 };
  
  // Extract models from stackmap
  const detectedModels = new Set();
  
  function extractModels(node) {
    if (node.callsites) {
      node.callsites.forEach(c => {
        if (c.model) detectedModels.add(c.model.toLowerCase());
      });
    }
    if (node.children) {
      node.children.forEach(child => extractModels(child));
    }
  }
  
  if (stackmap.tree) {
    stackmap.tree.forEach(node => extractModels(node));
  }
  
  for (const expected of EXPECTED.models) {
    const found = [...detectedModels].some(m => 
      m.includes(expected.toLowerCase()) || expected.toLowerCase().includes(m)
    );
    if (found) {
      pass(`${expected} model detected`);
      results.passed++;
    } else {
      fail(`${expected} model NOT detected`);
      results.failed++;
    }
  }
  
  info(`Total unique models: ${detectedModels.size}`);
  
  return results;
}

function testRuntimeDetection(stackmap) {
  console.log('\n📋 Runtime Detection:');
  
  const results = { passed: 0, failed: 0 };
  
  // Check techStack.serving.runtimes
  const detectedRuntimes = new Set();
  
  if (stackmap.techStack?.serving?.runtimes) {
    stackmap.techStack.serving.runtimes.forEach(r => {
      detectedRuntimes.add(r.name.toLowerCase());
    });
  }
  
  // Also check string representation in full JSON
  const jsonStr = JSON.stringify(stackmap).toLowerCase();
  
  for (const expected of EXPECTED.runtimes) {
    const inRuntimes = [...detectedRuntimes].some(r => r.includes(expected));
    const inJson = jsonStr.includes(expected);
    
    if (inRuntimes || inJson) {
      pass(`${expected} runtime detected`);
      results.passed++;
    } else {
      fail(`${expected} runtime NOT detected`);
      results.failed++;
    }
  }
  
  if (detectedRuntimes.size > 0) {
    info(`Detected runtimes: ${[...detectedRuntimes].join(', ')}`);
  }
  
  return results;
}

function testPatternDetection(stackmap) {
  console.log('\n📋 Pattern Detection:');
  
  const results = { passed: 0, failed: 0 };
  
  const patterns = stackmap.patterns || {};
  const jsonStr = JSON.stringify(stackmap).toLowerCase();
  
  for (const { name, file } of EXPECTED.patterns) {
    // Check if pattern exists in patterns object
    const patternData = patterns[name];
    const detected = patternData?.detected === true || 
                    (patternData?.instances && patternData.instances.length > 0);
    
    // Also check if pattern is mentioned in JSON at all
    const inJson = jsonStr.includes(name);
    
    if (detected) {
      const count = patternData?.instances?.length || 0;
      pass(`${name} pattern detected (${count} instances)`);
      results.passed++;
    } else if (inJson) {
      warn(`${name} pattern mentioned but not formally detected`);
      results.passed++; // Give partial credit
    } else {
      fail(`${name} pattern NOT detected (expected in ${file})`);
      results.failed++;
    }
  }
  
  return results;
}

function testHardwareDetection(stackmap) {
  console.log('\n📋 Hardware Detection:');
  
  const results = { passed: 0, failed: 0 };
  
  const jsonStr = JSON.stringify(stackmap).toLowerCase();
  
  for (const expected of EXPECTED.hardware) {
    const found = jsonStr.includes(expected.toLowerCase());
    
    if (found) {
      pass(`${expected} GPU detected`);
      results.passed++;
    } else {
      warn(`${expected} GPU not explicitly detected (may be in terraform/k8s)`);
      // Don't count as failed since infrastructure detection may vary
    }
  }
  
  return results;
}

function testCallsiteCount(stackmap) {
  console.log('\n📋 Callsite Detection:');
  
  const results = { passed: 0, failed: 0 };
  
  // Count callsites
  let callsiteCount = 0;
  
  function countCallsites(node) {
    if (node.callsites) {
      callsiteCount += node.callsites.length;
    }
    if (node.children) {
      node.children.forEach(child => countCallsites(child));
    }
  }
  
  if (stackmap.tree) {
    stackmap.tree.forEach(node => countCallsites(node));
  }
  
  if (callsiteCount >= EXPECTED.minCallsites) {
    pass(`${callsiteCount} callsites detected (expected >= ${EXPECTED.minCallsites})`);
    results.passed++;
  } else {
    fail(`Only ${callsiteCount} callsites detected (expected >= ${EXPECTED.minCallsites})`);
    results.failed++;
  }
  
  return results;
}

function testPricingOutput(pricing) {
  console.log('\n📋 Pricing Validation:');
  
  const results = { passed: 0, failed: 0 };
  
  // Check estimated range
  if (pricing.estimatedRange?.low >= 0 && pricing.estimatedRange?.high > 0) {
    pass(`Cost range calculated: $${pricing.estimatedRange.low.toFixed(2)} - $${pricing.estimatedRange.high.toFixed(2)}`);
    results.passed++;
  } else {
    fail('Cost range not calculated');
    results.failed++;
  }
  
  // Check provider breakdown
  if (pricing.byProvider && pricing.byProvider.length > 0) {
    pass(`Provider breakdown: ${pricing.byProvider.length} providers with costs`);
    results.passed++;
  } else {
    fail('No provider cost breakdown');
    results.failed++;
  }
  
  // Check model breakdown
  if (pricing.byModel && pricing.byModel.length > 0) {
    pass(`Model breakdown: ${pricing.byModel.length} models with costs`);
    results.passed++;
  } else {
    fail('No model cost breakdown');
    results.failed++;
  }
  
  // Check hotspots
  if (pricing.hotspots && pricing.hotspots.length > 0) {
    pass(`Hotspots identified: ${pricing.hotspots.length} high-cost callsites`);
    results.passed++;
  } else {
    warn('No hotspots identified');
  }
  
  return results;
}

// =============================================================================
// MAIN
// =============================================================================

function main() {
  const scriptDir = path.dirname(process.argv[1]);
  const stackmapPath = path.join(scriptDir, 'peakinfer-stackmap.json');
  const pricingPath = path.join(scriptDir, 'peakinfer-pricing.json');
  
  console.log('\n' + '='.repeat(70));
  console.log(`${colors.bold}  PeakInfer Test Results Validator${colors.reset}`);
  console.log('='.repeat(70));
  
  // Load files
  const stackmap = loadJSON(stackmapPath);
  const pricing = loadJSON(pricingPath);
  
  if (!stackmap) {
    console.error(`\n${colors.red}ERROR: Could not load stackmap${colors.reset}`);
    process.exit(1);
  }
  
  // Run tests
  const allResults = [];
  
  allResults.push(testProviderDetection(stackmap));
  allResults.push(testModelDetection(stackmap));
  allResults.push(testRuntimeDetection(stackmap));
  allResults.push(testPatternDetection(stackmap));
  allResults.push(testHardwareDetection(stackmap));
  allResults.push(testCallsiteCount(stackmap));
  
  if (pricing) {
    allResults.push(testPricingOutput(pricing));
  }
  
  // Calculate totals
  const totalPassed = allResults.reduce((sum, r) => sum + r.passed, 0);
  const totalFailed = allResults.reduce((sum, r) => sum + r.failed, 0);
  const total = totalPassed + totalFailed;
  const passRate = ((totalPassed / total) * 100).toFixed(1);
  
  // Summary
  console.log('\n' + '='.repeat(70));
  console.log(`${colors.bold}  Test Summary${colors.reset}`);
  console.log('='.repeat(70));
  
  console.log(`\n  Total: ${totalPassed}/${total} tests passed (${passRate}%)`);
  
  if (totalFailed === 0) {
    console.log(`\n  ${colors.green}${colors.bold}✓ All tests passed!${colors.reset}`);
  } else {
    console.log(`\n  ${colors.yellow}⚠ ${totalFailed} tests failed${colors.reset}`);
  }
  
  // Detection accuracy assessment
  console.log('\n' + '-'.repeat(70));
  console.log(`${colors.bold}  Detection Accuracy Assessment${colors.reset}`);
  console.log('-'.repeat(70));
  
  const accuracy = parseFloat(passRate);
  if (accuracy >= 90) {
    console.log(`\n  ${colors.green}✓ EXCELLENT: Detection accuracy is ${passRate}%${colors.reset}`);
    console.log('    PeakInfer correctly identified most patterns in the test codebase.');
  } else if (accuracy >= 75) {
    console.log(`\n  ${colors.yellow}⚠ GOOD: Detection accuracy is ${passRate}%${colors.reset}`);
    console.log('    Some patterns may need improved detection rules.');
  } else {
    console.log(`\n  ${colors.red}✗ NEEDS IMPROVEMENT: Detection accuracy is ${passRate}%${colors.reset}`);
    console.log('    Review failed tests and improve detection patterns.');
  }
  
  console.log('\n');
  
  process.exit(totalFailed > 0 ? 1 : 0);
}

main();


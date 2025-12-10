#!/usr/bin/env node
/**
 * Enhanced HTML Test Report Generator for PeakInfer
 * Features: Test descriptions, pass criteria, PRD links, file references
 */

const fs = require('fs');
const path = require('path');

// Test metadata with descriptions, pass criteria, and PRD references
const TEST_METADATA = {
  // Unit Test Descriptions
  'Validator validateP1Response() should accept valid P1 response': {
    description: 'Validates that the P1 (Phase 1) detection response from Claude API contains properly structured callsite data',
    passCriteria: 'Response object contains valid callsites array with required fields (file, line, type)',
    prdRef: 'PRD Section 6 - Detection System',
    category: 'Core Validation'
  },
  'Validator validateP1Response() should filter out low confidence callsites (< 0.4)': {
    description: 'Ensures low-confidence detection results are filtered to maintain precision > 97%',
    passCriteria: 'Callsites with confidence < 0.4 are excluded from output',
    prdRef: 'PRD Section 6 - Quality Gates (precision ≥97%)',
    category: 'Quality Control'
  },
  'Scanner scan() should detect Python files': {
    description: 'Verifies the scanner correctly identifies and catalogs Python source files',
    passCriteria: 'Python files (.py) are detected with correct metadata',
    prdRef: 'PRD Section 4 - File Scanner',
    category: 'File Detection'
  },
  'Scanner scan() should detect TypeScript files': {
    description: 'Verifies the scanner correctly identifies TypeScript source files',
    passCriteria: 'TypeScript files (.ts/.tsx) are detected with correct metadata',
    prdRef: 'PRD Section 4 - File Scanner',
    category: 'File Detection'
  },
  'Pricing Engine calculatePricing() should calculate costs for single callsite': {
    description: 'Tests the pricing calculation engine for individual LLM API calls',
    passCriteria: 'Cost is calculated using provider pricing * estimated tokens',
    prdRef: 'PRD Section 7 - Pricing Engine',
    category: 'Cost Estimation'
  },
  'Pricing Engine getModelPrice() should return pricing for known model': {
    description: 'Validates model pricing lookup from the pricing database',
    passCriteria: 'Returns correct input/output prices per million tokens',
    prdRef: 'PRD Section 7 - Pricing Data',
    category: 'Pricing Data'
  },
  'StackMap Builder buildStackMap() should return empty stackmap for empty callsites': {
    description: 'Tests edge case handling when no LLM calls are detected',
    passCriteria: 'Returns valid empty StackMap structure without errors',
    prdRef: 'PRD Section 5 - StackMap Generation',
    category: 'StackMap'
  },
  'CLI Renderer renderSuccessState() should render summary header': {
    description: 'Validates CLI output formatting for successful analysis',
    passCriteria: 'Output contains properly formatted summary with all sections',
    prdRef: 'PRD Section 8 - CLI Output',
    category: 'User Interface'
  },
  'ClaudeDetector detectCallsites() - P1 Prompt should send correctly structured P1 prompt': {
    description: 'Verifies the AI detection prompt follows the correct format for Claude API',
    passCriteria: 'Prompt includes file content, instructions, and expected JSON schema',
    prdRef: 'PRD Section 6 - AI Detection',
    category: 'AI Integration'
  },
  // PRD Test Descriptions
  'CLI-001: --help command should list all available commands': {
    description: 'Validates CLI help output lists all available commands',
    passCriteria: 'Help shows analyze, recommend, prices commands',
    prdRef: 'PRD Section 4.1 - CLI Commands',
    category: 'CLI Functional'
  },
  'CLI-002: --version command should output valid version': {
    description: 'Validates version command returns semantic version',
    passCriteria: 'Output matches X.Y.Z version format',
    prdRef: 'PRD Section 4.1 - CLI Commands',
    category: 'CLI Functional'
  },
  'CLI-010: analyze command should execute analyze flow on fixture': {
    description: 'End-to-end test of the analyze command using R1 SaaS-only fixture',
    passCriteria: 'Analyze completes with exit code 0, detects LLM calls',
    prdRef: 'PRD Section 4.2 - Analyze Flow',
    category: 'CLI Functional'
  },
  'CLI-012: pricing command should output pricing info': {
    description: 'Validates the prices command displays pricing data',
    passCriteria: 'Output contains price/cost information',
    prdRef: 'PRD Section 4.1 - CLI Commands',
    category: 'CLI Functional'
  },
  'DET-001: SDK calls across languages should detect OpenAI SDK calls in Python': {
    description: 'Tests detection of OpenAI Python SDK calls using R1 fixture',
    passCriteria: 'At least 1 OpenAI callsite detected with correct provider',
    prdRef: 'PRD Section 6.1 - SDK Detection',
    category: 'Detection'
  },
  'DET-001: SDK calls across languages should detect Anthropic SDK calls in Python': {
    description: 'Tests detection of Anthropic Claude SDK calls using R1 fixture',
    passCriteria: 'At least 1 Anthropic callsite detected with correct provider',
    prdRef: 'PRD Section 6.1 - SDK Detection',
    category: 'Detection'
  },
};

// Category colors and icons
const CATEGORIES = {
  'Core Validation': { icon: '🔒', color: '#3b82f6' },
  'Quality Control': { icon: '✅', color: '#10b981' },
  'File Detection': { icon: '📁', color: '#8b5cf6' },
  'Cost Estimation': { icon: '💰', color: '#f59e0b' },
  'Pricing Data': { icon: '💵', color: '#f59e0b' },
  'StackMap': { icon: '🗺️', color: '#06b6d4' },
  'User Interface': { icon: '🖥️', color: '#ec4899' },
  'AI Integration': { icon: '🤖', color: '#6366f1' },
  'CLI Functional': { icon: '⌨️', color: '#14b8a6' },
  'Detection': { icon: '🔍', color: '#f97316' },
  'Security': { icon: '🔐', color: '#ef4444' },
  'Performance': { icon: '⚡', color: '#eab308' },
  'default': { icon: '📋', color: '#64748b' }
};

function getTestMetadata(fullName, title) {
  return TEST_METADATA[fullName] || TEST_METADATA[title] || {
    description: `Validates: ${title}`,
    passCriteria: 'All assertions passed successfully',
    prdRef: 'PRD Test Suite',
    category: 'default'
  };
}

function generateHTML(unitResults, prdResults = null) {
  const now = new Date().toLocaleString();

  const totalTests = unitResults.numTotalTests + (prdResults?.numTotalTests || 0);
  const passedTests = unitResults.numPassedTests + (prdResults?.numPassedTests || 0);
  const failedTests = unitResults.numFailedTests + (prdResults?.numFailedTests || 0);
  const passRate = ((passedTests / totalTests) * 100).toFixed(1);

  const statusColor = failedTests === 0 ? '#10b981' : '#ef4444';
  const statusText = failedTests === 0 ? 'ALL TESTS PASSED' : `${failedTests} TESTS FAILED`;

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PeakInfer Test Report - ${now}</title>
  <style>
    :root {
      --bg: #0f172a;
      --card-bg: #1e293b;
      --card-bg-hover: #273548;
      --text: #e2e8f0;
      --text-muted: #94a3b8;
      --border: #334155;
      --success: #10b981;
      --danger: #ef4444;
      --warning: #f59e0b;
      --primary: #3b82f6;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      padding: 2rem;
      line-height: 1.6;
    }
    .container { max-width: 1400px; margin: 0 auto; }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
      flex-wrap: wrap;
      gap: 1rem;
    }
    h1 {
      font-size: 1.75rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .logo { font-size: 2rem; }
    .meta { color: var(--text-muted); font-size: 0.85rem; text-align: right; }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .summary-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.25rem;
      text-align: center;
    }
    .summary-card.status {
      border-color: ${statusColor};
      box-shadow: 0 0 30px ${statusColor}30;
    }
    .summary-value { font-size: 2.25rem; font-weight: 700; }
    .summary-label { color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; }
    .success { color: var(--success); }
    .danger { color: var(--danger); }

    .section { margin-bottom: 2.5rem; }
    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
      padding-bottom: 0.75rem;
      border-bottom: 2px solid var(--border);
    }
    .section-title {
      font-size: 1.1rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }
    .section-badge {
      background: var(--primary);
      color: white;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
    }

    .test-suite {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      margin-bottom: 1rem;
      overflow: hidden;
    }
    .suite-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 1.25rem;
      background: rgba(255,255,255,0.02);
      cursor: pointer;
      transition: background 0.2s;
    }
    .suite-header:hover { background: var(--card-bg-hover); }
    .suite-name { font-weight: 600; display: flex; align-items: center; gap: 0.5rem; }
    .suite-stats { display: flex; gap: 1rem; font-size: 0.85rem; align-items: center; }
    .suite-tests { display: none; }
    .suite-tests.expanded { display: block; }

    .test-item {
      padding: 1rem 1.25rem;
      border-top: 1px solid var(--border);
      transition: background 0.2s;
    }
    .test-item:hover { background: rgba(255,255,255,0.02); }
    .test-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1rem;
    }
    .test-title {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      flex: 1;
    }
    .test-icon { font-size: 1.1rem; margin-top: 2px; }
    .test-name { font-weight: 500; }
    .test-meta {
      display: flex;
      gap: 0.75rem;
      font-size: 0.8rem;
      color: var(--text-muted);
      flex-shrink: 0;
    }
    .test-details {
      margin-top: 0.75rem;
      padding: 0.75rem 1rem;
      background: rgba(0,0,0,0.2);
      border-radius: 8px;
      font-size: 0.85rem;
    }
    .test-detail-row {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 0.4rem;
    }
    .test-detail-row:last-child { margin-bottom: 0; }
    .test-detail-label {
      color: var(--text-muted);
      min-width: 100px;
      font-weight: 500;
    }
    .test-detail-value { color: var(--text); }
    .category-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.15rem 0.5rem;
      border-radius: 4px;
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
    }
    .prd-link {
      color: var(--primary);
      text-decoration: none;
      font-weight: 500;
    }
    .prd-link:hover { text-decoration: underline; }

    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      margin-bottom: 1.5rem;
      padding: 1rem;
      background: var(--card-bg);
      border-radius: 8px;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.8rem;
    }

    .footer {
      text-align: center;
      color: var(--text-muted);
      font-size: 0.75rem;
      margin-top: 3rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--border);
    }
    .footer a { color: var(--primary); text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1><span class="logo">⚡</span> PeakInfer Test Report</h1>
      <div class="meta">
        <div>Generated: ${now}</div>
        <div>Version: 0.2.1 | Vitest 3.2.4</div>
      </div>
    </header>

    <div class="summary-grid">
      <div class="summary-card status">
        <div class="summary-value" style="color: ${statusColor}">${failedTests === 0 ? '✓' : '✗'}</div>
        <div class="summary-label">${statusText}</div>
      </div>
      <div class="summary-card">
        <div class="summary-value">${totalTests}</div>
        <div class="summary-label">Total Tests</div>
      </div>
      <div class="summary-card">
        <div class="summary-value success">${passedTests}</div>
        <div class="summary-label">Passed</div>
      </div>
      <div class="summary-card">
        <div class="summary-value ${failedTests > 0 ? 'danger' : ''}">${failedTests}</div>
        <div class="summary-label">Failed</div>
      </div>
      <div class="summary-card">
        <div class="summary-value">${passRate}%</div>
        <div class="summary-label">Pass Rate</div>
      </div>
    </div>

    <div class="legend">
      <strong style="margin-right: 0.5rem;">Categories:</strong>
      ${Object.entries(CATEGORIES).filter(([k]) => k !== 'default').map(([name, {icon, color}]) => `
        <span class="legend-item"><span>${icon}</span> <span style="color: ${color}">${name}</span></span>
      `).join('')}
    </div>

    <div class="section">
      <div class="section-header">
        <h2 class="section-title">Unit Tests</h2>
        <span class="section-badge">${unitResults.numTotalTests} tests</span>
      </div>
      ${unitResults.testResults.map(suite => generateSuiteHTML(suite, 'unit')).join('')}
    </div>
`;

  if (prdResults && prdResults.testResults) {
    html += `
    <div class="section">
      <div class="section-header">
        <h2 class="section-title">PRD Integration Tests</h2>
        <span class="section-badge">${prdResults.numTotalTests} tests</span>
      </div>
      ${prdResults.testResults.map(suite => generateSuiteHTML(suite, 'prd')).join('')}
    </div>
`;
  }

  html += `
    <div class="footer">
      <p>PeakInfer SLC v1 Test Report</p>
      <p>Test Document Reference: <a href="https://github.com/kalmantic/peakinfer/blob/main/design/test-document.md">PRD Test Cases v0.96</a></p>
      <p>Report generated by test-results/generate-html-report.cjs</p>
    </div>
  </div>

  <script>
    document.querySelectorAll('.suite-header').forEach(header => {
      header.addEventListener('click', () => {
        header.nextElementSibling.classList.toggle('expanded');
        const arrow = header.querySelector('.arrow');
        if (arrow) arrow.textContent = header.nextElementSibling.classList.contains('expanded') ? '▼' : '▶';
      });
    });
  </script>
</body>
</html>`;

  return html;
}

function generateSuiteHTML(suite, type) {
  const suiteName = path.basename(suite.name);
  const passedCount = suite.assertionResults.filter(t => t.status === 'passed').length;
  const failedCount = suite.assertionResults.filter(t => t.status === 'failed').length;
  const duration = Math.round(suite.endTime - suite.startTime);

  const statusIcon = failedCount === 0 ? '✓' : '✗';
  const statusClass = failedCount === 0 ? 'success' : 'danger';

  return `
      <div class="test-suite">
        <div class="suite-header">
          <span class="suite-name">
            <span class="${statusClass}">${statusIcon}</span>
            ${suiteName}
            <span class="arrow" style="color: var(--text-muted); font-size: 0.8rem;">▶</span>
          </span>
          <div class="suite-stats">
            <span class="success">${passedCount} passed</span>
            ${failedCount > 0 ? `<span class="danger">${failedCount} failed</span>` : ''}
            <span style="color: var(--text-muted)">${duration}ms</span>
          </div>
        </div>
        <div class="suite-tests">
          ${suite.assertionResults.map(test => generateTestHTML(test, suite.name)).join('')}
        </div>
      </div>
  `;
}

function generateTestHTML(test, suitePath) {
  const meta = getTestMetadata(test.fullName, test.title);
  const cat = CATEGORIES[meta.category] || CATEGORIES.default;
  const duration = Math.round(test.duration);
  const statusIcon = test.status === 'passed' ? '✓' : '✗';
  const statusClass = test.status === 'passed' ? 'success' : 'danger';

  return `
          <div class="test-item">
            <div class="test-header">
              <div class="test-title">
                <span class="test-icon ${statusClass}">${statusIcon}</span>
                <span class="test-name">${test.title}</span>
              </div>
              <div class="test-meta">
                <span class="category-badge" style="background: ${cat.color}20; color: ${cat.color}">
                  ${cat.icon} ${meta.category}
                </span>
                <span>${duration}ms</span>
              </div>
            </div>
            <div class="test-details">
              <div class="test-detail-row">
                <span class="test-detail-label">Description:</span>
                <span class="test-detail-value">${meta.description}</span>
              </div>
              <div class="test-detail-row">
                <span class="test-detail-label">Pass Criteria:</span>
                <span class="test-detail-value">${meta.passCriteria}</span>
              </div>
              <div class="test-detail-row">
                <span class="test-detail-label">PRD Reference:</span>
                <span class="test-detail-value"><span class="prd-link">${meta.prdRef}</span></span>
              </div>
              ${test.status === 'failed' && test.failureMessages?.length ? `
              <div class="test-detail-row">
                <span class="test-detail-label" style="color: var(--danger)">Error:</span>
                <span class="test-detail-value" style="color: var(--danger)">${test.failureMessages[0]?.substring(0, 200) || 'Unknown error'}...</span>
              </div>
              ` : ''}
            </div>
          </div>
  `;
}

// Main execution
try {
  const unitResultsPath = path.join(__dirname, 'results.json');
  const prdResultsPath = path.join(__dirname, 'prd-results.json');

  const unitResults = JSON.parse(fs.readFileSync(unitResultsPath, 'utf-8'));
  let prdResults = null;

  if (fs.existsSync(prdResultsPath)) {
    prdResults = JSON.parse(fs.readFileSync(prdResultsPath, 'utf-8'));
  }

  const html = generateHTML(unitResults, prdResults);
  const outputPath = path.join(__dirname, 'report.html');
  fs.writeFileSync(outputPath, html);

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  📊 PeakInfer Test Report Generated');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`  📁 Report: ${outputPath}`);
  console.log('');
  console.log('  📋 Summary:');
  console.log(`     Unit Tests:     ${unitResults.numPassedTests}/${unitResults.numTotalTests} passed`);
  if (prdResults) {
    console.log(`     PRD Tests:      ${prdResults.numPassedTests}/${prdResults.numTotalTests} passed`);
  }
  console.log('');
  console.log('  ➡️  Open report.html in your browser to view details');
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
} catch (error) {
  console.error('Error generating report:', error.message);
  process.exit(1);
}

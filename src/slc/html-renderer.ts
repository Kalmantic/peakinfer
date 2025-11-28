/**
 * HTML Report Renderer
 *
 * Generates a self-contained HTML report with dark/light mode,
 * interactive file tree, cost breakdown, and optimization recommendations.
 */

import type { ScanResult, StackMap, StackMapNode, PricingSummary, CallsiteCost, TechStack } from './types.js';
import { formatCurrency } from './renderer.js';

// =============================================================================
// HTML REPORT GENERATOR
// =============================================================================

/**
 * Generate a complete HTML report.
 */
export function generateHTMLReport(
  scan: ScanResult,
  stackMap: StackMap,
  pricing: PricingSummary,
  techStack?: TechStack
): string {
  const timestamp = new Date().toISOString();
  const projectName = scan.root.split('/').pop() || 'Project';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PeakInfer Report — ${escapeHtml(projectName)}</title>
  <style>
${getStyles()}
  </style>
</head>
<body>
  <div class="container">
    ${renderHeader(projectName, timestamp)}
    ${renderSummaryCards(scan, stackMap, pricing)}
    ${techStack ? renderTechStackSection(techStack) : ''}
    ${renderCostBreakdown(pricing)}
    ${renderFileTree(stackMap)}
    ${renderOptimizations(pricing)}
    ${renderUnknownModelsSection(stackMap)}
    ${renderFooter()}
  </div>
  <script>
${getScript()}
  </script>
</body>
</html>`;
}

// =============================================================================
// STYLES
// =============================================================================

function getStyles(): string {
  return `
    :root {
      --bg-primary: #0d1117;
      --bg-secondary: #161b22;
      --bg-tertiary: #21262d;
      --text-primary: #e6edf3;
      --text-secondary: #8b949e;
      --text-muted: #6e7681;
      --border-color: #30363d;
      --accent-blue: #58a6ff;
      --accent-green: #3fb950;
      --accent-yellow: #d29922;
      --accent-red: #f85149;
      --accent-purple: #a371f7;
      --accent-orange: #db6d28;
    }

    @media (prefers-color-scheme: light) {
      :root {
        --bg-primary: #ffffff;
        --bg-secondary: #f6f8fa;
        --bg-tertiary: #eaeef2;
        --text-primary: #1f2328;
        --text-secondary: #656d76;
        --text-muted: #8c959f;
        --border-color: #d0d7de;
      }
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.6;
      font-size: 14px;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 24px;
    }

    /* Header */
    .header {
      margin-bottom: 32px;
      padding-bottom: 24px;
      border-bottom: 1px solid var(--border-color);
    }

    .header h1 {
      font-size: 28px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .header .logo {
      width: 32px;
      height: 32px;
      background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple));
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
    }

    .header .meta {
      margin-top: 8px;
      color: var(--text-secondary);
      font-size: 13px;
    }

    /* Summary Cards */
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 32px;
    }

    .summary-card {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 20px;
    }

    .summary-card .label {
      color: var(--text-secondary);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }

    .summary-card .value {
      font-size: 28px;
      font-weight: 600;
    }

    .summary-card .detail {
      color: var(--text-secondary);
      font-size: 12px;
      margin-top: 4px;
    }

    .summary-card.cost .value {
      color: var(--accent-green);
    }

    .summary-card.warning .value {
      color: var(--accent-yellow);
    }

    /* Sections */
    .section {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      margin-bottom: 24px;
      overflow: hidden;
    }

    .section-header {
      padding: 16px 20px;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .section-header h2 {
      font-size: 16px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .section-content {
      padding: 20px;
    }

    /* Cost Breakdown */
    .cost-bar {
      margin-bottom: 12px;
    }

    .cost-bar-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 6px;
    }

    .cost-bar-provider {
      font-weight: 500;
    }

    .cost-bar-amount {
      color: var(--text-secondary);
    }

    .cost-bar-track {
      height: 8px;
      background: var(--bg-tertiary);
      border-radius: 4px;
      overflow: hidden;
    }

    .cost-bar-fill {
      height: 100%;
      border-radius: 4px;
      transition: width 0.3s ease;
    }

    .cost-bar-fill.openai { background: linear-gradient(90deg, #10a37f, #1a7f64); }
    .cost-bar-fill.anthropic { background: linear-gradient(90deg, #d4a27f, #c4886a); }
    .cost-bar-fill.google { background: linear-gradient(90deg, #4285f4, #34a853); }
    .cost-bar-fill.other { background: linear-gradient(90deg, var(--accent-purple), var(--accent-blue)); }

    /* File Tree */
    .file-tree {
      font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', monospace;
      font-size: 13px;
    }

    .tree-node {
      padding: 4px 0;
    }

    .tree-dir {
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 8px;
      border-radius: 6px;
    }

    .tree-dir:hover {
      background: var(--bg-tertiary);
    }

    .tree-dir .icon {
      color: var(--accent-blue);
    }

    .tree-file {
      padding: 4px 8px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .tree-file .icon {
      color: var(--text-muted);
    }

    .tree-children {
      margin-left: 20px;
      border-left: 1px solid var(--border-color);
      padding-left: 12px;
    }

    .tree-callsite {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      margin: 4px 0;
      background: var(--bg-tertiary);
      border-radius: 6px;
      font-size: 12px;
    }

    .tree-callsite .line {
      color: var(--text-muted);
      min-width: 50px;
    }

    .tree-callsite .provider {
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
    }

    .provider-openai { background: rgba(16, 163, 127, 0.2); color: #10a37f; }
    .provider-anthropic { background: rgba(212, 162, 127, 0.2); color: #d4a27f; }
    .provider-google { background: rgba(66, 133, 244, 0.2); color: #4285f4; }
    .provider-unknown { background: rgba(139, 148, 158, 0.2); color: var(--text-secondary); }

    .tree-callsite .model {
      color: var(--text-secondary);
    }

    .model-unknown {
      color: var(--accent-yellow);
      font-style: italic;
    }

    /* Optimizations */
    .optimization-item {
      padding: 16px;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      margin-bottom: 12px;
      background: var(--bg-primary);
    }

    .optimization-item:last-child {
      margin-bottom: 0;
    }

    .optimization-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
    }

    .optimization-location {
      font-family: 'SF Mono', 'Cascadia Code', monospace;
      font-size: 13px;
    }

    .optimization-model {
      color: var(--text-secondary);
      font-size: 12px;
    }

    .optimization-suggestion {
      padding: 12px;
      background: var(--bg-tertiary);
      border-radius: 6px;
      border-left: 3px solid var(--accent-green);
      font-size: 13px;
    }

    /* Unknown Models Section */
    .unknown-callout {
      background: rgba(210, 153, 34, 0.1);
      border: 1px solid rgba(210, 153, 34, 0.3);
      border-radius: 8px;
      padding: 16px;
    }

    .unknown-callout h3 {
      color: var(--accent-yellow);
      font-size: 14px;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .unknown-callout p {
      color: var(--text-secondary);
      font-size: 13px;
      margin-bottom: 12px;
    }

    .unknown-callout ul {
      margin-left: 20px;
      color: var(--text-secondary);
      font-size: 13px;
    }

    .unknown-callout li {
      margin-bottom: 4px;
    }

    /* Footer */
    .footer {
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid var(--border-color);
      text-align: center;
      color: var(--text-muted);
      font-size: 12px;
    }

    .footer a {
      color: var(--accent-blue);
      text-decoration: none;
    }

    .footer a:hover {
      text-decoration: underline;
    }

    /* Utility */
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 500;
    }

    .badge-info {
      background: rgba(88, 166, 255, 0.1);
      color: var(--accent-blue);
    }

    .badge-warning {
      background: rgba(210, 153, 34, 0.1);
      color: var(--accent-yellow);
    }

    .empty-state {
      text-align: center;
      padding: 40px;
      color: var(--text-muted);
    }

    /* Tech Stack */
    .tech-stack {
      font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', monospace;
      font-size: 13px;
    }

    .stack-layer {
      position: relative;
      padding-left: 24px;
      margin-bottom: 16px;
    }

    .stack-layer::before {
      content: '';
      position: absolute;
      left: 8px;
      top: 20px;
      bottom: -8px;
      width: 1px;
      background: var(--border-color);
    }

    .stack-layer.last::before {
      display: none;
    }

    .stack-layer-header {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      margin-bottom: 8px;
    }

    .stack-connector {
      color: var(--text-muted);
      margin-left: -16px;
    }

    .stack-name {
      color: var(--text-primary);
    }

    .stack-layer-content {
      padding-left: 8px;
    }

    .stack-item {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin-bottom: 6px;
    }

    .stack-label {
      color: var(--text-secondary);
      min-width: 100px;
    }

    .stack-values {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .stack-tag {
      display: inline-block;
      padding: 2px 10px;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      font-size: 12px;
      color: var(--text-primary);
    }
  `;
}

// =============================================================================
// COMPONENT RENDERERS
// =============================================================================

function renderHeader(projectName: string, timestamp: string): string {
  const date = new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return `
    <header class="header">
      <h1>
        <span class="logo">P</span>
        peakinfer
      </h1>
      <div class="meta">
        ${escapeHtml(projectName)} / ${date}
      </div>
    </header>
  `;
}

function renderSummaryCards(scan: ScanResult, stackMap: StackMap, pricing: PricingSummary): string {
  const unknownCount = stackMap.summary.models.filter(m => m === 'unknown').length;
  const knownModels = stackMap.summary.models.filter(m => m !== 'unknown');

  return `
    <div class="summary-grid">
      <div class="summary-card">
        <div class="label">Files Scanned</div>
        <div class="value">${scan.totalFiles.toLocaleString()}</div>
        <div class="detail">${scan.totalLines.toLocaleString()} lines of code</div>
      </div>
      <div class="summary-card">
        <div class="label">LLM Callsites</div>
        <div class="value">${stackMap.summary.totalCallsites}</div>
        <div class="detail">${stackMap.summary.providers.length} provider(s) detected</div>
      </div>
      <div class="summary-card cost">
        <div class="label">Est. Monthly Cost</div>
        <div class="value">${formatCurrency(pricing.estimatedRange.high)}</div>
        <div class="detail">Range: ${formatCurrency(pricing.estimatedRange.low)} - ${formatCurrency(pricing.estimatedRange.high)}</div>
      </div>
      <div class="summary-card ${unknownCount > 0 ? 'warning' : ''}">
        <div class="label">Models Detected</div>
        <div class="value">${knownModels.length}</div>
        <div class="detail">${unknownCount > 0 ? `${unknownCount} dynamic/unknown` : 'All models identified'}</div>
      </div>
    </div>
  `;
}

function renderCostBreakdown(pricing: PricingSummary): string {
  if (pricing.byProvider.length === 0) {
    return `
      <section class="section">
        <div class="section-header">
          <h2>cost breakdown</h2>
        </div>
        <div class="section-content">
          <div class="empty-state">
            <p>no cost data available (all models are dynamic/unknown)</p>
          </div>
        </div>
      </section>
    `;
  }

  const maxCost = Math.max(...pricing.byProvider.map(p => p.cost));

  const bars = pricing.byProvider.map(p => {
    const width = maxCost > 0 ? (p.cost / maxCost) * 100 : 0;
    const providerClass = ['openai', 'anthropic', 'google'].includes(p.provider) ? p.provider : 'other';

    return `
      <div class="cost-bar">
        <div class="cost-bar-header">
          <span class="cost-bar-provider">${escapeHtml(p.provider)}</span>
          <span class="cost-bar-amount">${formatCurrency(p.cost)}/mo (${p.percentage}%)</span>
        </div>
        <div class="cost-bar-track">
          <div class="cost-bar-fill ${providerClass}" style="width: ${width}%"></div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <section class="section">
      <div class="section-header">
        <h2>cost breakdown by provider</h2>
        <span class="badge badge-info">based on default usage estimates</span>
      </div>
      <div class="section-content">
        ${bars}
      </div>
    </section>
  `;
}

function renderTechStackSection(techStack: TechStack): string {
  const { application, serving, infrastructure, hardware } = techStack;

  const hasApp = application.frameworks.length > 0 || application.sdks.length > 0 || application.patterns.length > 0;
  const hasServing = serving.runtimes.length > 0 || serving.gateways.length > 0 || serving.platforms.length > 0;
  const hasInfra = infrastructure.cloud.length > 0 || infrastructure.compute.length > 0 || infrastructure.orchestration.length > 0;
  const hasHardware = hardware.gpus.length > 0 || hardware.accelerators.length > 0;

  if (!hasApp && !hasServing && !hasInfra && !hasHardware) {
    return '';
  }

  const renderLayer = (name: string, icon: string, items: { label: string; values: string[] }[], isLast: boolean = false) => {
    const filteredItems = items.filter(i => i.values.length > 0);
    if (filteredItems.length === 0) return '';

    const connector = isLast ? '└' : '├';
    const lineClass = isLast ? 'last' : '';

    return `
      <div class="stack-layer ${lineClass}">
        <div class="stack-layer-header">
          <span class="stack-connector">${connector}─</span>
          <span class="stack-name">${name}</span>
        </div>
        <div class="stack-layer-content">
          ${filteredItems.map(item => `
            <div class="stack-item">
              <span class="stack-label">${item.label}:</span>
              <span class="stack-values">${item.values.map(v => `<span class="stack-tag">${escapeHtml(v)}</span>`).join('')}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  };

  const layers = [
    hasApp ? renderLayer('application', '', [
      { label: 'frameworks', values: application.frameworks },
      { label: 'sdks', values: application.sdks },
      { label: 'patterns', values: application.patterns },
    ]) : '',
    hasServing ? renderLayer('serving', '', [
      { label: 'runtimes', values: serving.runtimes },
      { label: 'gateways', values: serving.gateways },
      { label: 'platforms', values: serving.platforms },
    ]) : '',
    hasInfra ? renderLayer('infrastructure', '', [
      { label: 'cloud', values: infrastructure.cloud },
      { label: 'compute', values: infrastructure.compute },
      { label: 'orchestration', values: infrastructure.orchestration },
    ]) : '',
    hasHardware ? renderLayer('hardware' + (hardware.estimated ? ' (estimated)' : ''), '', [
      { label: 'gpus', values: hardware.gpus },
      { label: 'accelerators', values: hardware.accelerators },
    ], true) : '',
  ].filter(Boolean);

  // Mark the last layer
  if (layers.length > 0) {
    layers[layers.length - 1] = layers[layers.length - 1].replace('stack-layer"', 'stack-layer last"');
  }

  return `
    <section class="section">
      <div class="section-header">
        <h2>inference tech stack</h2>
        <span class="badge badge-info">application to hardware</span>
      </div>
      <div class="section-content">
        <div class="tech-stack">
          ${layers.join('')}
        </div>
      </div>
    </section>
  `;
}

function renderFileTree(stackMap: StackMap): string {
  if (stackMap.tree.length === 0) {
    return '';
  }

  const treeHtml = stackMap.tree.map(node => renderTreeNode(node)).join('');

  return `
    <section class="section">
      <div class="section-header">
        <h2>callsite map</h2>
        <span class="badge badge-info">${stackMap.summary.totalCallsites} callsites</span>
      </div>
      <div class="section-content">
        <div class="file-tree">
          ${treeHtml}
        </div>
      </div>
    </section>
  `;
}

function renderTreeNode(node: StackMapNode): string {
  if (node.type === 'directory') {
    const children = node.children?.map(c => renderTreeNode(c)).join('') || '';
    return `
      <div class="tree-node">
        <div class="tree-dir" onclick="this.parentElement.classList.toggle('collapsed')">
          <span class="icon">/</span>
          <span>${escapeHtml(node.name)}/</span>
        </div>
        <div class="tree-children">
          ${children}
        </div>
      </div>
    `;
  }

  const callsites = node.callsites?.map(cs => {
    const provider = cs.provider || 'unknown';
    const model = cs.model || 'unknown';
    const providerClass = `provider-${['openai', 'anthropic', 'google'].includes(provider) ? provider : 'unknown'}`;
    const modelClass = model === 'unknown' ? 'model-unknown' : '';

    return `
      <div class="tree-callsite">
        <span class="line">:${cs.line}</span>
        <span class="provider ${providerClass}">${escapeHtml(provider)}</span>
        <span class="model ${modelClass}">${escapeHtml(model)}</span>
      </div>
    `;
  }).join('') || '';

  return `
    <div class="tree-node">
      <div class="tree-file">
        <span>${escapeHtml(node.name)}</span>
      </div>
      ${callsites}
    </div>
  `;
}

function renderOptimizations(pricing: PricingSummary): string {
  const suggestions = pricing.hotspots.filter((h: CallsiteCost) => h.suggestion).slice(0, 5);

  if (suggestions.length === 0) {
    return `
      <section class="section">
        <div class="section-header">
          <h2>optimization suggestions</h2>
        </div>
        <div class="section-content">
          <div class="empty-state">
            <p>no optimization suggestions available</p>
            <p style="font-size: 12px; margin-top: 8px;">all detected models appear to be appropriately selected for their use cases</p>
          </div>
        </div>
      </section>
    `;
  }

  const items = suggestions.map(h => `
    <div class="optimization-item">
      <div class="optimization-header">
        <div>
          <div class="optimization-location">${escapeHtml(h.file)}:${h.line}</div>
          <div class="optimization-model">current model: ${escapeHtml(h.model)}</div>
        </div>
      </div>
      <div class="optimization-suggestion">
        ${escapeHtml(h.suggestion || '')}
      </div>
    </div>
  `).join('');

  return `
    <section class="section">
      <div class="section-header">
        <h2>optimization suggestions</h2>
        <span class="badge badge-info">${suggestions.length} opportunities</span>
      </div>
      <div class="section-content">
        ${items}
      </div>
    </section>
  `;
}

function renderUnknownModelsSection(stackMap: StackMap): string {
  // Count unknown models in the tree
  let unknownCount = 0;
  const countUnknown = (nodes: StackMapNode[]) => {
    for (const node of nodes) {
      if (node.callsites) {
        unknownCount += node.callsites.filter(cs => !cs.model || cs.model === 'unknown').length;
      }
      if (node.children) {
        countUnknown(node.children);
      }
    }
  };
  countUnknown(stackMap.tree);

  if (unknownCount === 0) {
    return '';
  }

  return `
    <section class="section">
      <div class="section-header">
        <h2>dynamic model references</h2>
        <span class="badge badge-warning">${unknownCount} callsites</span>
      </div>
      <div class="section-content">
        <div class="unknown-callout">
          <h3>why are some models "unknown"?</h3>
          <p>
            peakinfer detected ${unknownCount} callsite(s) where the model name couldn't be determined
            through static analysis. this typically happens when:
          </p>
          <ul>
            <li><strong>dynamic configuration</strong> — model set via environment variables (e.g., <code>process.env.MODEL_NAME</code>)</li>
            <li><strong>factory patterns</strong> — client created through factory functions with runtime parameters</li>
            <li><strong>wrapper classes</strong> — abstraction layers that configure models at runtime</li>
            <li><strong>user selection</strong> — model chosen based on user input or API parameters</li>
          </ul>
          <p style="margin-top: 12px;">
            to get accurate cost estimates, consider adding model annotations
            in comments or using a configuration file that peakinfer can parse.
          </p>
        </div>
      </div>
    </section>
  `;
}

function renderFooter(): string {
  return `
    <footer class="footer">
      <p>
        generated by <strong>peakinfer</strong><br>
        <a href="https://github.com/kalmantic/peakinfer" target="_blank">github</a> ·
        <a href="https://peakinfer.dev" target="_blank">docs</a>
      </p>
    </footer>
  `;
}

// =============================================================================
// SCRIPT
// =============================================================================

function getScript(): string {
  return `
    // Toggle collapsed state for directories
    document.querySelectorAll('.tree-dir').forEach(dir => {
      dir.addEventListener('click', () => {
        dir.parentElement.classList.toggle('collapsed');
      });
    });

    // Add collapsed style
    const style = document.createElement('style');
    style.textContent = '.tree-node.collapsed .tree-children { display: none; }';
    document.head.appendChild(style);
  `;
}

// =============================================================================
// HELPERS
// =============================================================================

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

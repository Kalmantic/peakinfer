import type { InferenceMap, Insight, JoinedOutput, RuntimeSummary } from './types.js';
import { generateImpactSummary, type ImpactSummary } from './impact.js';
import { VERSION } from './version.js';

// =============================================================================
// TYPES
// =============================================================================

export interface HTMLData {
  inferenceMap: InferenceMap;
  insights: Insight[];
  joined?: JoinedOutput;
  runtime?: RuntimeSummary;
  impactSummary?: ImpactSummary;
}

// =============================================================================
// STYLES
// =============================================================================

const STYLES = `
:root {
  --critical: #dc2626;
  --warning: #d97706;
  --info: #2563eb;
  --bg: #fafafa;
  --text: #1a1a1a;
  --muted: #6b7280;
  --border: #e5e7eb;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: system-ui, -apple-system, sans-serif;
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
  background: var(--bg);
  color: var(--text);
  line-height: 1.6;
}

header {
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border);
}

h1 { font-size: 1.5rem; font-weight: 600; }
h2 { font-size: 1.25rem; font-weight: 600; margin: 1.5rem 0 1rem; }
h3 { font-size: 1rem; font-weight: 600; margin: 1rem 0 0.5rem; }

.meta { color: var(--muted); font-size: 0.875rem; margin-top: 0.5rem; }
.meta-grid { display: grid; grid-template-columns: auto 1fr; gap: 0.25rem 1rem; margin-top: 0.75rem; }
.meta-label { color: var(--muted); font-size: 0.8rem; }
.meta-value { font-family: ui-monospace, monospace; font-size: 0.8rem; word-break: break-all; }
.project-name { font-size: 1.1rem; font-weight: 500; margin-top: 0.5rem; color: var(--text); }

section { margin-bottom: 2rem; }

.finding {
  border-left: 4px solid;
  padding: 1rem;
  margin: 1rem 0;
  background: white;
  border-radius: 0 4px 4px 0;
}

.finding.critical { border-color: var(--critical); }
.finding.warning { border-color: var(--warning); }
.finding.info { border-color: var(--info); }

.finding h3 { margin: 0 0 0.5rem; }
.finding p { color: var(--muted); margin: 0; }
.finding code {
  display: block;
  margin-top: 0.5rem;
  font-size: 0.875rem;
  color: var(--muted);
  font-family: ui-monospace, monospace;
}

.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.stat {
  background: white;
  padding: 1rem;
  border-radius: 4px;
  border: 1px solid var(--border);
}

.stat-label { font-size: 0.875rem; color: var(--muted); }
.stat-value { font-size: 1.5rem; font-weight: 600; }

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
  background: white;
  border-radius: 4px;
  overflow: hidden;
}

th, td {
  text-align: left;
  padding: 0.75rem;
  border-bottom: 1px solid var(--border);
}

th { background: var(--bg); font-weight: 600; }
tr:last-child td { border-bottom: none; }

details { margin: 1rem 0; }
summary { cursor: pointer; font-weight: 500; }

footer {
  margin-top: 3rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border);
  color: var(--muted);
  font-size: 0.875rem;
}

footer a { color: var(--info); text-decoration: none; }
footer a:hover { text-decoration: underline; }

.badge {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
}

.badge.streaming { background: #dbeafe; color: #1d4ed8; }
.badge.batching { background: #dcfce7; color: #15803d; }
.badge.retries { background: #fef3c7; color: #b45309; }
.badge.caching { background: #f3e8ff; color: #7e22ce; }
.badge.fallback { background: #fee2e2; color: #dc2626; }

.summary-line { font-size: 1.25rem; margin: 0.5rem 0; }
.potential { font-size: 1.5rem; margin: 1rem 0; }
.potential strong { color: #15803d; }

.layer-table { max-width: 500px; margin: 1rem 0; }
.layer-table td:first-child { width: 40px; }

.quick-wins { margin: 1rem 0; padding-left: 1.5rem; }
.quick-wins li { margin: 0.5rem 0; }

.impact-tag {
  font-size: 0.75rem;
  color: var(--muted);
  font-weight: normal;
}

.location-list {
  margin: 0.5rem 0;
  padding-left: 1.5rem;
  font-size: 0.8rem;
}

.location-list li {
  margin: 0.25rem 0;
}

.location-list code {
  display: inline;
  margin: 0;
  color: var(--text);
}

.finding details {
  margin-top: 0.5rem;
}

.finding details summary {
  font-size: 0.875rem;
  color: var(--muted);
  cursor: pointer;
}

.finding p {
  font-size: 0.875rem;
}
`;

// =============================================================================
// HELPERS
// =============================================================================

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function renderPatterns(patterns: Record<string, boolean | undefined>): string {
  return Object.entries(patterns)
    .filter(([_, v]) => v)
    .map(([k]) => `<span class="badge ${k}">${k}</span>`)
    .join(' ');
}

// =============================================================================
// SECTIONS
// =============================================================================

function renderSummary(insights: Insight[], callsiteCount: number): string {
  const summary = generateImpactSummary(insights);
  const { costReductionPercent, latencyReductionPercent, throughputGainPercent } = summary.totalPotentialImpact;

  const potentialParts: string[] = [];
  if (costReductionPercent > 0) potentialParts.push(`<strong>-${costReductionPercent}%</strong> cost`);
  if (latencyReductionPercent > 0) potentialParts.push(`<strong>-${latencyReductionPercent}%</strong> latency`);
  if (throughputGainPercent > 0) potentialParts.push(`<strong>+${throughputGainPercent}%</strong> throughput`);

  const layerRows = summary.stackRanking.map((rank, i) => {
    const avgImpact = Math.round(rank.totalImpactPercent / rank.insightCount);
    return `<tr><td>${i + 1}</td><td>${rank.layer}</td><td>~${avgImpact}%</td><td>${rank.insightCount}</td></tr>`;
  }).join('');

  // Deduplicate quick wins by templateId+model combination, show unique recommendations
  const seen = new Set<string>();
  const uniqueQuickWins = summary.quickWins.filter(insight => {
    const key = `${insight.templateId || ''}:${insight.headline}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 3);

  const quickWins = uniqueQuickWins.map(insight => {
    const pct = insight.impact?.estimatedImpactPercent || 0;
    const type = insight.impact?.impactType || '';
    const typeLabel = type === 'cost' ? 'cost reduction' : type === 'latency' ? 'latency reduction' : type;
    // Use assumptions if available (more actionable), otherwise headline
    const recommendation = insight.impact?.assumptions || insight.headline;
    return `<li><strong>${escapeHtml(recommendation)}</strong> <span class="impact-tag">(${pct}% ${typeLabel})</span></li>`;
  }).join('');

  return `
    <section id="summary">
      <h2>Potential Performance Improvement</h2>
      <p class="summary-line">${insights.length} findings across ${callsiteCount} inference points</p>
      ${potentialParts.length > 0 ? `<p class="potential">${potentialParts.join(' &nbsp;|&nbsp; ')}</p>` : ''}

      ${summary.stackRanking.length > 0 ? `
        <h3>By Layer</h3>
        <table class="layer-table">
          <thead><tr><th>#</th><th>Layer</th><th>Avg Impact</th><th>Items</th></tr></thead>
          <tbody>${layerRows}</tbody>
        </table>
      ` : ''}

      ${summary.quickWins.length > 0 ? `
        <h3>Quick Wins</h3>
        <ul class="quick-wins">${quickWins}</ul>
      ` : ''}
    </section>
  `;
}

function renderFindings(insights: Insight[]): string {
  if (insights.length === 0) {
    return `
      <section id="findings">
        <h2>Findings</h2>
        <p>No issues detected. Your inference setup looks good.</p>
      </section>
    `;
  }

  // Group insights by recommendation (assumptions or headline)
  // Julie Zhou: "Progress should be phase-based (not noisy per-file spam)"
  const grouped = new Map<string, {
    recommendation: string;
    severity: string;
    layer: string;
    impactType: string;
    impactPercent: number;
    locations: string[];
    evidence: string;
  }>();

  for (const insight of insights) {
    const recommendation = insight.impact?.assumptions || insight.headline;
    const key = recommendation;

    if (!grouped.has(key)) {
      grouped.set(key, {
        recommendation,
        severity: insight.severity,
        layer: insight.impact?.layer || '',
        impactType: insight.impact?.impactType || 'improvement',
        impactPercent: insight.impact?.estimatedImpactPercent || 0,
        locations: [],
        evidence: insight.evidence,
      });
    }
    if (insight.location) {
      grouped.get(key)!.locations.push(insight.location);
    }
  }

  // Sort by impact (highest first)
  const sortedGroups = Array.from(grouped.values()).sort((a, b) => b.impactPercent - a.impactPercent);

  const items = sortedGroups.map(group => {
    const typeLabel = group.impactType === 'cost' ? 'cost reduction'
      : group.impactType === 'latency' ? 'latency reduction'
      : group.impactType;
    const impactTag = group.layer
      ? `<span class="impact-tag">[${group.layer}] ${group.impactPercent}% ${typeLabel}</span>`
      : '';
    const locationCount = group.locations.length;
    const locationList = group.locations.map(loc => `<li><code>${escapeHtml(loc)}</code></li>`).join('');

    return `
    <div class="finding ${group.severity}">
      <h3>${escapeHtml(group.recommendation)} ${impactTag}</h3>
      <p>${locationCount} inference point${locationCount !== 1 ? 's' : ''}</p>
      ${locationCount > 0 ? `
        <details>
          <summary>Show locations</summary>
          <ul class="location-list">${locationList}</ul>
        </details>
      ` : ''}
    </div>
  `;
  }).join('');

  return `
    <section id="findings">
      <h2>Findings</h2>
      ${items}
    </section>
  `;
}

function renderInferenceMap(map: InferenceMap): string {
  const rows = map.callsites.map(cs => `
    <tr>
      <td>${escapeHtml(cs.file)}</td>
      <td>${cs.line}</td>
      <td>${cs.provider || '-'}</td>
      <td>${cs.model || '-'}</td>
      <td>${renderPatterns(cs.patterns)}</td>
    </tr>
  `).join('');

  return `
    <section id="inferencemap">
      <h2>InferenceMap</h2>
      <details>
        <summary>${map.summary.totalCallsites} inference points</summary>
        <table>
          <thead>
            <tr>
              <th>File</th>
              <th>Line</th>
              <th>Provider</th>
              <th>Model</th>
              <th>Patterns</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </details>
    </section>
  `;
}

function renderRuntime(runtime: RuntimeSummary): string {
  return `
    <section id="runtime">
      <h2>Runtime</h2>
      <div class="stats">
        <div class="stat">
          <div class="stat-label">Total Events</div>
          <div class="stat-value">${formatNumber(runtime.totalEvents)}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Latency p50</div>
          <div class="stat-value">${runtime.global.p50}ms</div>
        </div>
        <div class="stat">
          <div class="stat-label">Latency p95</div>
          <div class="stat-value">${runtime.global.p95}ms</div>
        </div>
        <div class="stat">
          <div class="stat-label">Latency p99</div>
          <div class="stat-value">${runtime.global.p99}ms</div>
        </div>
      </div>
    </section>
  `;
}

function renderDrift(joined: JoinedOutput): string {
  if (joined.drift.length === 0) return '';

  const codeOnlyItems = joined.codeOnly.map(cs =>
    `<li>${escapeHtml(cs.file)}:${cs.line} — ${cs.provider || '?'}/${cs.model || '?'}</li>`
  ).join('');

  const runtimeByKey = new Map<string, number>();
  for (const evt of joined.runtimeOnly) {
    const key = `${evt.provider}/${evt.model}`;
    runtimeByKey.set(key, (runtimeByKey.get(key) || 0) + 1);
  }

  const runtimeOnlyItems = Array.from(runtimeByKey.entries())
    .map(([key, count]) => `<li>${escapeHtml(key)} — ${count} events</li>`)
    .join('');

  return `
    <section id="drift">
      <h2>Drift</h2>
      ${joined.codeOnly.length > 0 ? `
        <h3>Code-only (${joined.codeOnly.length})</h3>
        <ul>${codeOnlyItems}</ul>
      ` : ''}
      ${joined.runtimeOnly.length > 0 ? `
        <h3>Runtime-only (${runtimeByKey.size})</h3>
        <ul>${runtimeOnlyItems}</ul>
      ` : ''}
    </section>
  `;
}

// =============================================================================
// PUBLIC API
// =============================================================================

export function generateHTML(data: HTMLData): string {
  const { inferenceMap, insights, joined, runtime } = data;
  const now = new Date();
  const timestamp = now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
  const callsiteCount = inferenceMap.summary.totalCallsites;

  // Use absolute path if available, otherwise fall back to root
  const absolutePath = inferenceMap.metadata?.absolutePath || inferenceMap.root;
  const projectName = absolutePath.split('/').filter(Boolean).pop() || 'Unknown Project';

  // Build project overview
  const providers = inferenceMap.summary.providers;
  const models = inferenceMap.summary.models;
  const patterns = Object.entries(inferenceMap.summary.patterns)
    .filter(([_, count]) => count > 0)
    .map(([name, count]) => `${name} (${count})`)
    .join(', ') || 'none detected';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PeakInfer Report — ${escapeHtml(projectName)}</title>
  <style>${STYLES}</style>
</head>
<body>
  <header>
    <h1>PeakInfer Report</h1>
    <p class="project-name">${escapeHtml(projectName)}</p>
    <div class="meta-grid">
      <span class="meta-label">Path</span>
      <span class="meta-value">${escapeHtml(absolutePath)}</span>
      <span class="meta-label">Generated</span>
      <span class="meta-value">${timestamp}</span>
    </div>
  </header>

  <section id="overview">
    <h2>Project Overview</h2>
    <p><strong>${callsiteCount}</strong> inference points found across <strong>${providers.length}</strong> providers and <strong>${models.length}</strong> models.</p>
    <div class="meta-grid" style="margin-top: 1rem;">
      <span class="meta-label">Providers</span>
      <span class="meta-value">${escapeHtml(providers.join(', '))}</span>
      <span class="meta-label">Models</span>
      <span class="meta-value">${escapeHtml(models.slice(0, 5).join(', '))}${models.length > 5 ? ` +${models.length - 5} more` : ''}</span>
      <span class="meta-label">Patterns</span>
      <span class="meta-value">${escapeHtml(patterns)}</span>
    </div>
  </section>

  ${renderSummary(insights, callsiteCount)}
  ${renderFindings(insights)}
  ${renderInferenceMap(inferenceMap)}
  ${runtime ? renderRuntime(runtime) : ''}
  ${joined ? renderDrift(joined) : ''}

  <footer>
    <p>Generated by PeakInfer v${VERSION} | <a href="https://github.com/Kalmantic/peakinfer">GitHub</a></p>
  </footer>
</body>
</html>`;
}

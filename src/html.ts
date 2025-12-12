import type { InferenceMap, Insight, JoinedOutput, RuntimeSummary } from './types.js';

// =============================================================================
// TYPES
// =============================================================================

export interface HTMLData {
  inferenceMap: InferenceMap;
  insights: Insight[];
  joined?: JoinedOutput;
  runtime?: RuntimeSummary;
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

function renderFindings(insights: Insight[]): string {
  if (insights.length === 0) {
    return `
      <section id="findings">
        <h2>Findings</h2>
        <p>No issues detected. Your inference setup looks good.</p>
      </section>
    `;
  }

  const items = insights.map(insight => `
    <div class="finding ${insight.severity}">
      <h3>${escapeHtml(insight.headline)}</h3>
      <p>${escapeHtml(insight.evidence)}</p>
      ${insight.location ? `<code>${escapeHtml(insight.location)}</code>` : ''}
    </div>
  `).join('');

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
        <summary>${map.summary.totalCallsites} callsites</summary>
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
  const timestamp = new Date().toISOString().split('T')[0];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PeakInfer Report</title>
  <style>${STYLES}</style>
</head>
<body>
  <header>
    <h1>PeakInfer Report</h1>
    <p class="meta">Generated: ${timestamp} | Root: ${escapeHtml(inferenceMap.root)}</p>
  </header>

  ${renderFindings(insights)}
  ${renderInferenceMap(inferenceMap)}
  ${runtime ? renderRuntime(runtime) : ''}
  ${joined ? renderDrift(joined) : ''}

  <footer>
    <p>Generated by PeakInfer v1.0 | <a href="https://github.com/Kalmantic/peakinfer">GitHub</a></p>
  </footer>
</body>
</html>`;
}

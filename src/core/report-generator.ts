/**
 * Report Generator
 * Generates beautiful HTML, Markdown, and JSON reports
 * For optimization suggestions and analysis results
 */

import fs from 'fs-extra';
import * as path from 'path';
import { SuggestionReport, OptimizationSuggestion } from '../types/suggestions.js';
import { CodebaseAnalysis } from '../types/codebase.js';
import { DiscoveryResult } from '../types/multi-agent.js';

export interface ReportOptions {
  outputDir: string;
  formats: ('html' | 'markdown' | 'json')[];
  includeCodeSnippets?: boolean;
  includeCharts?: boolean;
}

export class ReportGenerator {
  /**
   * Generate comprehensive reports in multiple formats
   */
  async generateReports(
    suggestionReport: SuggestionReport,
    discoveryResult: DiscoveryResult,
    options: ReportOptions
  ): Promise<{ files: string[] }> {
    console.log(`\n📊 Generating reports in ${options.formats.join(', ')} format(s)...\n`);

    await fs.ensureDir(options.outputDir);
    const generatedFiles: string[] = [];

    for (const format of options.formats) {
      switch (format) {
        case 'html':
          const htmlPath = await this.generateHTMLReport(suggestionReport, discoveryResult, options);
          generatedFiles.push(htmlPath);
          break;
        case 'markdown':
          const mdPath = await this.generateMarkdownReport(suggestionReport, discoveryResult, options);
          generatedFiles.push(mdPath);
          break;
        case 'json':
          const jsonPath = await this.generateJSONReport(suggestionReport, options);
          generatedFiles.push(jsonPath);
          break;
      }
    }

    console.log(`  ✅ Generated ${generatedFiles.length} report files\n`);
    return { files: generatedFiles };
  }

  /**
   * Generate HTML report
   */
  private async generateHTMLReport(
    report: SuggestionReport,
    discovery: DiscoveryResult,
    options: ReportOptions
  ): Promise<string> {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PeakInfer Optimization Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f5f7fa;
    }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px;
      border-radius: 12px;
      margin-bottom: 30px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
    }
    .header h1 { font-size: 2.5em; margin-bottom: 10px; }
    .header p { font-size: 1.1em; opacity: 0.9; }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .stat-card {
      background: white;
      padding: 25px;
      border-radius: 10px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      border-left: 4px solid #667eea;
    }
    .stat-card h3 { color: #667eea; font-size: 0.9em; text-transform: uppercase; margin-bottom: 10px; }
    .stat-card .value { font-size: 2em; font-weight: bold; color: #2d3748; }
    .stat-card .subtext { color: #718096; font-size: 0.9em; margin-top: 5px; }
    .suggestion-card {
      background: white;
      padding: 30px;
      border-radius: 10px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      margin-bottom: 20px;
      border-left: 5px solid #48bb78;
    }
    .suggestion-card.high { border-left-color: #f56565; }
    .suggestion-card.medium { border-left-color: #ed8936; }
    .suggestion-card.low { border-left-color: #48bb78; }
    .suggestion-header {
      display: flex;
      justify-content: space-between;
      align-items: start;
      margin-bottom: 15px;
    }
    .suggestion-title { font-size: 1.5em; font-weight: bold; color: #2d3748; }
    .priority-badge {
      padding: 5px 15px;
      border-radius: 20px;
      font-size: 0.8em;
      font-weight: bold;
      text-transform: uppercase;
    }
    .priority-high { background: #fed7d7; color: #c53030; }
    .priority-medium { background: #feebc8; color: #c05621; }
    .priority-low { background: #c6f6d5; color: #276749; }
    .suggestion-description { color: #4a5568; margin-bottom: 20px; line-height: 1.8; }
    .metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 15px;
      margin: 20px 0;
      padding: 20px;
      background: #f7fafc;
      border-radius: 8px;
    }
    .metric { text-align: center; }
    .metric-label { font-size: 0.9em; color: #718096; margin-bottom: 5px; }
    .metric-value { font-size: 1.3em; font-weight: bold; color: #2d3748; }
    .code-block {
      background: #2d3748;
      color: #e2e8f0;
      padding: 20px;
      border-radius: 8px;
      overflow-x: auto;
      margin: 15px 0;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 0.9em;
    }
    .code-header {
      color: #a0aec0;
      margin-bottom: 10px;
      font-size: 0.85em;
    }
    .steps-list {
      background: #f7fafc;
      padding: 20px;
      border-radius: 8px;
      margin: 15px 0;
    }
    .steps-list h4 { color: #2d3748; margin-bottom: 15px; }
    .steps-list ol { margin-left: 20px; }
    .steps-list li { margin: 10px 0; color: #4a5568; }
    .footer {
      text-align: center;
      padding: 40px;
      color: #718096;
      margin-top: 50px;
    }
    .section-title {
      font-size: 1.8em;
      color: #2d3748;
      margin: 40px 0 20px 0;
      padding-bottom: 10px;
      border-bottom: 2px solid #e2e8f0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚀 PeakInfer Optimization Report</h1>
      <p>LLM Inference Cost & Performance Optimization Analysis</p>
      <p style="margin-top: 10px; font-size: 0.9em;">Generated: ${new Date().toISOString().split('T')[0]}</p>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <h3>💰 Total Savings Opportunity</h3>
        <div class="value">$${report.summary.totalMonthlySavings.toLocaleString()}</div>
        <div class="subtext">per month ($${report.summary.totalAnnualSavings.toLocaleString()}/year)</div>
      </div>
      <div class="stat-card">
        <h3>🎯 Optimization Opportunities</h3>
        <div class="value">${report.summary.totalOpportunities}</div>
        <div class="subtext">${report.summary.quickWins.length} quick wins identified</div>
      </div>
      <div class="stat-card">
        <h3>📈 Average ROI</h3>
        <div class="value">${report.metadata.averageROI.toFixed(0)}%</div>
        <div class="subtext">Return on implementation investment</div>
      </div>
      <div class="stat-card">
        <h3>⏱️ Implementation Time</h3>
        <div class="value">${Math.round(report.summary.averageImplementationTime)}h</div>
        <div class="subtext">Average per optimization</div>
      </div>
    </div>

    <h2 class="section-title">🏆 Quick Wins (High ROI, Low Effort)</h2>
    ${report.summary.quickWins.map(s => this.renderSuggestionCard(s, true)).join('\n')}

    <h2 class="section-title">💡 All Optimization Opportunities</h2>
    ${report.suggestions.map(s => this.renderSuggestionCard(s, options.includeCodeSnippets || false)).join('\n')}

    <div class="footer">
      <p><strong>Generated by PeakInfer</strong></p>
      <p style="margin-top: 10px; font-size: 0.9em;">
        Multi-Agent LLM Inference Optimization Platform<br>
        Powered by Claude & Community Templates
      </p>
    </div>
  </div>
</body>
</html>`;

    const filePath = path.join(options.outputDir, 'optimization-report.html');
    await fs.writeFile(filePath, html, 'utf-8');
    console.log(`  📄 HTML report: ${filePath}`);
    return filePath;
  }

  /**
   * Render suggestion card HTML
   */
  private renderSuggestionCard(suggestion: OptimizationSuggestion, includeCode: boolean): string {
    return `
    <div class="suggestion-card ${suggestion.priorityLevel}">
      <div class="suggestion-header">
        <div class="suggestion-title">${suggestion.title}</div>
        <div class="priority-badge priority-${suggestion.priorityLevel}">${suggestion.priorityLevel}</div>
      </div>
      <div class="suggestion-description">${suggestion.description}</div>

      <div class="metrics">
        <div class="metric">
          <div class="metric-label">Monthly Savings</div>
          <div class="metric-value">$${suggestion.estimatedMonthlySavings.toLocaleString()}</div>
        </div>
        <div class="metric">
          <div class="metric-label">Annual Savings</div>
          <div class="metric-value">$${suggestion.estimatedAnnualSavings.toLocaleString()}</div>
        </div>
        <div class="metric">
          <div class="metric-label">Implementation</div>
          <div class="metric-value">${suggestion.implementationTimeHours}h</div>
        </div>
        <div class="metric">
          <div class="metric-label">ROI</div>
          <div class="metric-value">${suggestion.roi.toFixed(0)}%</div>
        </div>
        <div class="metric">
          <div class="metric-label">Complexity</div>
          <div class="metric-value">${suggestion.implementationComplexity}</div>
        </div>
        <div class="metric">
          <div class="metric-label">Confidence</div>
          <div class="metric-value">${(suggestion.confidence * 100).toFixed(0)}%</div>
        </div>
      </div>

      ${includeCode && suggestion.codeSnippets.length > 0 ? `
      <div class="code-block">
        <div class="code-header">📁 ${path.basename(suggestion.codeSnippets[0].file)}:${suggestion.codeSnippets[0].startLine}</div>
        <pre>${this.escapeHtml(suggestion.codeSnippets[0].suggestedCode)}</pre>
      </div>
      ` : ''}

      <div class="steps-list">
        <h4>Implementation Steps:</h4>
        <ol>
          ${suggestion.implementationSteps.map(step => `<li>${step}</li>`).join('\n')}
        </ol>
      </div>

      ${suggestion.template_id ? `<p style="color: #718096; font-size: 0.9em; margin-top: 15px;">📚 Template: ${suggestion.template_id}</p>` : ''}
    </div>`;
  }

  /**
   * Generate Markdown report
   */
  private async generateMarkdownReport(
    report: SuggestionReport,
    discovery: DiscoveryResult,
    options: ReportOptions
  ): Promise<string> {
    const markdown = `# 🚀 PeakInfer Optimization Report

**Generated:** ${new Date().toISOString().split('T')[0]}

## Executive Summary

- **Total Optimization Opportunities:** ${report.summary.totalOpportunities}
- **Estimated Monthly Savings:** $${report.summary.totalMonthlySavings.toLocaleString()}
- **Estimated Annual Savings:** $${report.summary.totalAnnualSavings.toLocaleString()}
- **Average ROI:** ${report.metadata.averageROI.toFixed(0)}%
- **Average Implementation Time:** ${Math.round(report.summary.averageImplementationTime)} hours

## 🏆 Quick Wins (High ROI, Low Effort)

${report.summary.quickWins.map(s => this.renderSuggestionMarkdown(s, true)).join('\n\n---\n\n')}

## 💡 All Optimization Opportunities

${report.suggestions.map((s, i) => `### ${i + 1}. ${s.title}\n\n${this.renderSuggestionMarkdown(s, options.includeCodeSnippets || false)}`).join('\n\n---\n\n')}

## 📊 Statistics

### By Layer
${Object.entries(report.summary.byLayer).map(([layer, count]) => `- **${layer}**: ${count} opportunities`).join('\n')}

### By Priority
${Object.entries(report.summary.byPriority).map(([priority, count]) => `- **${priority}**: ${count} opportunities`).join('\n')}

## 🚀 Next Steps

1. **Review Quick Wins**: Start with high-ROI, low-effort optimizations
2. **Prioritize by Business Impact**: Consider your specific constraints and goals
3. **Implement Incrementally**: Apply optimizations one at a time
4. **Monitor Results**: Track actual savings and performance improvements
5. **Iterate**: Use learnings to refine future optimizations

---

*Generated by **PeakInfer** - Multi-Agent LLM Inference Optimization Platform*
`;

    const filePath = path.join(options.outputDir, 'OPTIMIZATION_GUIDE.md');
    await fs.writeFile(filePath, markdown, 'utf-8');
    console.log(`  📄 Markdown report: ${filePath}`);
    return filePath;
  }

  /**
   * Render suggestion as Markdown
   */
  private renderSuggestionMarkdown(suggestion: OptimizationSuggestion, includeCode: boolean): string {
    let md = `**Priority:** ${suggestion.priorityLevel.toUpperCase()} | **Layer:** ${suggestion.layer} | **Category:** ${suggestion.category}

${suggestion.description}

**Economics:**
- Monthly Savings: $${suggestion.estimatedMonthlySavings.toLocaleString()}
- Annual Savings: $${suggestion.estimatedAnnualSavings.toLocaleString()}
- Implementation Time: ${suggestion.implementationTimeHours} hours
- ROI: ${suggestion.roi.toFixed(0)}%
- Complexity: ${suggestion.implementationComplexity}
- Confidence: ${(suggestion.confidence * 100).toFixed(0)}%
`;

    if (suggestion.affectedFiles.length > 0) {
      md += `\n**Affected Files:**\n${suggestion.affectedFiles.map(f => `- \`${f.path}\``).join('\n')}\n`;
    }

    if (includeCode && suggestion.codeSnippets.length > 0) {
      const snippet = suggestion.codeSnippets[0];
      md += `\n**Code Example:**\n\n\`${snippet.file}:${snippet.startLine}\`\n\n\`\`\`${snippet.language}\n${snippet.suggestedCode}\n\`\`\`\n`;
    }

    md += `\n**Implementation Steps:**\n${suggestion.implementationSteps.map((step, i) => `${i + 1}. ${step}`).join('\n')}\n`;

    if (suggestion.prerequisites.length > 0) {
      md += `\n**Prerequisites:**\n${suggestion.prerequisites.map(p => `- ${p}`).join('\n')}\n`;
    }

    if (suggestion.template_id) {
      md += `\n**Template:** \`${suggestion.template_id}\`\n`;
    }

    return md;
  }

  /**
   * Generate JSON report
   */
  private async generateJSONReport(
    report: SuggestionReport,
    options: ReportOptions
  ): Promise<string> {
    const filePath = path.join(options.outputDir, 'suggestions.json');
    await fs.writeJson(filePath, report, { spaces: 2 });
    console.log(`  📄 JSON report: ${filePath}`);
    return filePath;
  }

  /**
   * Escape HTML
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }
}


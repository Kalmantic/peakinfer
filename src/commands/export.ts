/**
 * Export Command (v1.6)
 *
 * CLI command for exporting analysis results in various formats:
 * - inferencemap: InferenceMap v0.1 schema (default)
 * - json: Full analysis results
 * - prometheus: Prometheus metrics format
 */

import { Command } from 'commander';
import { existsSync, writeFileSync } from 'fs';
import { listRuns, loadRun } from '../history.js';
import type { InferenceMap, Insight } from '../types.js';

// =============================================================================
// TYPES
// =============================================================================

interface ExportOptions {
  format: 'inferencemap' | 'json' | 'prometheus';
  output?: string;
  run?: string;
}

interface AnalysisExport {
  inferenceMap?: InferenceMap;
  insights?: Insight[];
  runtime?: unknown;
  joined?: unknown;
}

// =============================================================================
// EXPORTERS
// =============================================================================

/**
 * Export in InferenceMap v0.1 schema format
 * Matches schemas/inference-map.v0.1.json
 */
function exportInferenceMap(data: AnalysisExport): string {
  if (!data.inferenceMap) {
    throw new Error('No inference map data available to export');
  }

  // InferenceMap v0.1 schema - preserve the original version
  // The inferenceMap should already have version: "0.1"
  const output = {
    ...data.inferenceMap,
    exportedAt: new Date().toISOString(),
  };

  return JSON.stringify(output, null, 2);
}

/**
 * Export full analysis results as JSON
 */
function exportJSON(data: AnalysisExport): string {
  const output = {
    exportedAt: new Date().toISOString(),
    format: 'peakinfer-analysis',
    version: '1.0',
    inferenceMap: data.inferenceMap,
    insights: data.insights,
    runtime: data.runtime,
    joined: data.joined,
  };

  return JSON.stringify(output, null, 2);
}

/**
 * Export in Prometheus metrics format
 */
function exportPrometheus(data: AnalysisExport): string {
  const lines: string[] = [];
  const timestamp = Date.now();

  // Helper to add metric
  const addMetric = (name: string, help: string, type: string, value: number, labels: Record<string, string> = {}) => {
    lines.push(`# HELP ${name} ${help}`);
    lines.push(`# TYPE ${name} ${type}`);

    const labelStr = Object.entries(labels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');

    const fullName = labelStr ? `${name}{${labelStr}}` : name;
    lines.push(`${fullName} ${value} ${timestamp}`);
  };

  if (data.inferenceMap) {
    const map = data.inferenceMap;

    // Total inference points
    addMetric(
      'peakinfer_inference_points_total',
      'Total number of inference points detected',
      'gauge',
      map.summary.totalCallsites
    );

    // Providers
    for (const provider of map.summary.providers) {
      const count = map.callsites.filter(c => c.provider === provider).length;
      addMetric(
        'peakinfer_inference_points_by_provider',
        'Inference points by provider',
        'gauge',
        count,
        { provider }
      );
    }

    // Models
    for (const model of map.summary.models) {
      const count = map.callsites.filter(c => c.model === model).length;
      addMetric(
        'peakinfer_inference_points_by_model',
        'Inference points by model',
        'gauge',
        count,
        { model }
      );
    }

    // Patterns
    for (const [pattern, count] of Object.entries(map.summary.patterns)) {
      addMetric(
        'peakinfer_pattern_usage',
        'Pattern usage across inference points',
        'gauge',
        count,
        { pattern }
      );
    }

    // Average confidence
    const avgConfidence = map.callsites.length > 0
      ? map.callsites.reduce((sum, c) => sum + c.confidence, 0) / map.callsites.length
      : 0;
    addMetric(
      'peakinfer_detection_confidence_avg',
      'Average detection confidence (0-1)',
      'gauge',
      avgConfidence
    );
  }

  // Insights by severity
  if (data.insights) {
    const bySeverity = {
      critical: data.insights.filter(i => i.severity === 'critical').length,
      warning: data.insights.filter(i => i.severity === 'warning').length,
      info: data.insights.filter(i => i.severity === 'info').length,
    };

    for (const [severity, count] of Object.entries(bySeverity)) {
      addMetric(
        'peakinfer_insights_total',
        'Total insights by severity',
        'gauge',
        count,
        { severity }
      );
    }

    // Insights by category
    const byCategory: Record<string, number> = {};
    for (const insight of data.insights) {
      byCategory[insight.category] = (byCategory[insight.category] || 0) + 1;
    }

    for (const [category, count] of Object.entries(byCategory)) {
      addMetric(
        'peakinfer_insights_by_category',
        'Insights by category',
        'gauge',
        count,
        { category }
      );
    }
  }

  return lines.join('\n');
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Get the default output filename based on format
 */
function getDefaultFilename(format: string): string {
  switch (format) {
    case 'inferencemap':
      return 'inference-map.json';
    case 'prometheus':
      return 'metrics.prom';
    case 'json':
    default:
      return 'analysis.json';
  }
}

/**
 * Load analysis data from history or latest run
 */
function loadAnalysisData(runId?: string): AnalysisExport | null {
  if (runId) {
    // Load specific run
    const run = loadRun(runId);
    if (!run) {
      return null;
    }
    return run.data;
  }

  // Load latest run
  const runs = listRuns();
  if (runs.length === 0) {
    return null;
  }

  const latestRun = loadRun(runs[0].runId);
  return latestRun?.data || null;
}

// =============================================================================
// COMMAND
// =============================================================================

/**
 * Register export command
 */
export function registerExportCommand(program: Command): void {
  program
    .command('export')
    .description('export analysis results in various formats')
    .option('--format <format>', 'output format: inferencemap (default), json, prometheus', 'inferencemap')
    .option('--output <file>', 'output file path')
    .option('--run <runId>', 'specific run to export (default: latest)')
    .action(async (options: ExportOptions) => {
      try {
        // Validate format
        const validFormats = ['inferencemap', 'json', 'prometheus'];
        if (!validFormats.includes(options.format)) {
          console.error(`Invalid format: ${options.format}`);
          console.log(`Valid formats: ${validFormats.join(', ')}`);
          process.exit(1);
        }

        // Load analysis data
        const data = loadAnalysisData(options.run);
        if (!data) {
          console.error('No analysis data found.');
          console.log('\nRun "peakinfer analyze ." first to generate analysis data.');
          console.log('Or specify a run ID with --run <runId>');
          process.exit(1);
        }

        // Export based on format
        let output: string;
        try {
          switch (options.format) {
            case 'inferencemap':
              output = exportInferenceMap(data);
              break;
            case 'prometheus':
              output = exportPrometheus(data);
              break;
            case 'json':
            default:
              output = exportJSON(data);
          }
        } catch (error) {
          console.error('Export failed:', error instanceof Error ? error.message : 'Unknown error');
          process.exit(1);
        }

        // Determine output destination
        const outputFile = options.output || getDefaultFilename(options.format);

        // Write to file or stdout
        if (outputFile === '-') {
          console.log(output);
        } else {
          writeFileSync(outputFile, output);
          console.log(`Exported to ${outputFile} (${options.format} format)`);
        }
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : 'Export failed');
        process.exit(1);
      }
    });
}

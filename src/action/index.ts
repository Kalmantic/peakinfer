/**
 * PeakInfer GitHub Action Entry Point (v1.6)
 *
 * Uses managed API - no Anthropic key required from user.
 * Credits are tracked and deducted via peakinfer.com API.
 */

import * as core from '@actions/core';
import * as github from '@actions/github';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { generatePRComment, generateExhaustedComment } from './comments.js';
import { postInlineComments } from './inline.js';
import { getChangedFiles, filterToChangedFiles } from './diff.js';
import { getBaseline, compareToBaseline } from './baseline.js';
import { parseCommand, handleCommentCommand } from './commands.js';
import type { Insight } from '../types.js';

// API endpoint
const PEAKINFER_API = process.env.PEAKINFER_API_URL || 'https://www.peakinfer.com';

// Type alias for Octokit
type OctokitType = ReturnType<typeof github.getOctokit>;

// =============================================================================
// TYPES
// =============================================================================

interface ActionInputs {
  path: string;
  inlineComments: boolean;
  failOnRegression: boolean;
  targetP95?: number;
}

interface AnalysisResponse {
  success: boolean;
  analysis: {
    inferencePoints: Array<{
      file: string;
      line: number;
      provider: string;
      model: string;
      streaming: boolean;
      hasRetry: boolean;
      hasFallback: boolean;
      costTier: 'high' | 'medium' | 'low';
    }>;
    insights: Insight[];
    summary: {
      totalInferencePoints: number;
      streamingEnabled: number;
      withRetries: number;
      estimatedMonthlyCost: string;
      primaryRisk: string;
    };
  };
  credits: {
    used: number;
    limit: number;
    remaining: number;
  };
  meta: {
    repo: string;
    prNumber: number;
    analyzedAt: string;
    filesAnalyzed: number;
  };
}

interface CreditExhaustedResponse {
  error: string;
  used: number;
  limit: number;
  plan: string;
  resetDate: string;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Parse action inputs
 */
function getInputs(): ActionInputs {
  return {
    path: core.getInput('path') || './src',
    inlineComments: core.getInput('inline-comments') !== 'false',
    failOnRegression: core.getInput('fail-on-regression') === 'true',
    targetP95: core.getInput('target-p95') ? parseInt(core.getInput('target-p95'), 10) : undefined,
  };
}

/**
 * Supported file extensions for analysis
 */
const SUPPORTED_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.go', '.java', '.kt', '.rs', '.rb',
]);

/**
 * Recursively collect files from a directory
 */
function collectFiles(dir: string, files: Array<{ path: string; content: string }> = [], maxFiles = 50): Array<{ path: string; content: string }> {
  if (files.length >= maxFiles) return files;

  const entries = readdirSync(dir);

  for (const entry of entries) {
    if (files.length >= maxFiles) break;

    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    // Skip node_modules, .git, etc.
    if (stat.isDirectory()) {
      if (!['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', 'vendor'].includes(entry)) {
        collectFiles(fullPath, files, maxFiles);
      }
    } else if (stat.isFile()) {
      const ext = extname(entry);
      if (SUPPORTED_EXTENSIONS.has(ext) && stat.size < 100000) { // Max 100KB per file
        try {
          const content = readFileSync(fullPath, 'utf-8');
          files.push({ path: fullPath, content });
        } catch {
          // Skip unreadable files
        }
      }
    }
  }

  return files;
}

/**
 * Call the managed analysis API
 */
async function callAnalysisAPI(
  orgId: string,
  files: Array<{ path: string; content: string }>,
  repo: string,
  prNumber: number
): Promise<AnalysisResponse | CreditExhaustedResponse> {
  const response = await fetch(`${PEAKINFER_API}/api/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      orgId,
      files,
      repo,
      prNumber,
    }),
  });

  const data = await response.json();

  if (response.status === 402) {
    return data as CreditExhaustedResponse;
  }

  if (!response.ok) {
    const errorData = data as { error?: string };
    throw new Error(errorData.error || `API error: ${response.status}`);
  }

  return data as AnalysisResponse;
}

/**
 * Get model downgrade suggestion
 */
function getModelDowngrade(model: string): string | null {
  const downgrades: Record<string, string> = {
    'gpt-4': 'gpt-4o-mini',
    'gpt-4-turbo': 'gpt-4o-mini',
    'gpt-4o': 'gpt-4o-mini',
    'claude-3-opus-20240229': 'claude-3-haiku-20240307',
    'claude-3-sonnet-20240229': 'claude-3-haiku-20240307',
  };
  return downgrades[model] || null;
}

/**
 * Generate insights with locations from inference points.
 * Includes suggestedFix for one-click apply in GitHub.
 */
function generateLocationAwareInsights(
  inferencePoints: AnalysisResponse['analysis']['inferencePoints']
): Insight[] {
  const insights: Insight[] = [];

  for (const point of inferencePoints) {
    const location = `${point.file}:${point.line}`;

    // High-cost model warning with full line replacement fix
    if (point.costTier === 'high') {
      const downgrade = getModelDowngrade(point.model);

      insights.push({
        severity: 'warning',
        category: 'cost',
        headline: 'Expensive model',
        evidence: `Using ${point.model}. For this task, a smaller model would work.`,
        recommendation: downgrade ? `Change to ${downgrade}` : 'Consider a smaller model',
        location,
        source: 'template',
        // Full line replacement for one-click apply
        fullLineFix: downgrade ? `    model: '${downgrade}',` : undefined,
      } as Insight & { fullLineFix?: string });
    }

    // No streaming - text recommendation only (adding a line is complex)
    if (!point.streaming) {
      insights.push({
        severity: 'warning',
        category: 'latency',
        headline: 'No streaming',
        evidence: 'Streaming improves perceived latency for users.',
        recommendation: 'Add stream: true to the options',
        location,
        source: 'template',
      });
    }

    // No error handling - suggest try-catch wrapper
    if (!point.hasRetry && !point.hasFallback) {
      insights.push({
        severity: 'critical',
        category: 'reliability',
        headline: 'No error handling',
        evidence: 'LLM calls can fail. Add retry logic or fallback.',
        recommendation: 'Wrap in try-catch with retry logic',
        location,
        source: 'template',
      });
    }
  }

  return insights;
}

/**
 * Determine status based on analysis results
 */
function determineStatus(
  analysis: AnalysisResponse['analysis'],
  inputs: ActionInputs
): { status: 'pass' | 'warning' | 'fail'; regressions: string[] } {
  const regressions: string[] = [];
  let status: 'pass' | 'warning' | 'fail' = 'pass';

  // Check for critical severity insights
  const criticalSeverity = analysis.insights.filter(i => i.severity === 'critical');
  if (criticalSeverity.length > 0) {
    status = 'warning';
    regressions.push(`${criticalSeverity.length} critical severity issues found`);
  }

  // Check for drift (streaming configured but not working, etc.)
  const streamingDrift = analysis.inferencePoints.filter(p => !p.streaming);
  if (streamingDrift.length > 0 && analysis.summary.streamingEnabled === 0) {
    regressions.push('Streaming not enabled on any inference points');
    if (status === 'pass') status = 'warning';
  }

  // Check reliability
  const noRetry = analysis.inferencePoints.filter(p => !p.hasRetry && !p.hasFallback);
  if (noRetry.length > analysis.inferencePoints.length * 0.5) {
    regressions.push('More than 50% of inference points lack retry/fallback');
    if (status === 'pass') status = 'warning';
  }

  // Override if fail-on-regression is set
  if (inputs.failOnRegression && regressions.length > 0) {
    status = 'fail';
  }

  return { status, regressions };
}

// =============================================================================
// MAIN
// =============================================================================

async function run(): Promise<void> {
  try {
    // Get GitHub context first to check for command events
    const context = github.context;
    const token = process.env.GITHUB_TOKEN || core.getInput('github-token');

    if (!token) {
      core.setFailed('GITHUB_TOKEN is required for PR comments');
      return;
    }

    const octokit = github.getOctokit(token);

    // Check if this is a command event (issue_comment)
    const eventType = core.getInput('event-type') || context.eventName;
    const commentBody = core.getInput('comment-body') || '';

    if (eventType === 'issue_comment' && commentBody) {
      core.info('Processing comment command...');
      const command = parseCommand(commentBody);

      if (command) {
        if (command.type === 'rerun') {
          // For rerun, continue to normal analysis
          core.info('Re-running analysis...');
        } else {
          // For fix/dismiss commands, handle and exit
          const handled = await handleCommentCommand(octokit, context);
          if (handled) {
            core.info('Command handled successfully');
            return;
          }
        }
      }
    }

    const inputs = getInputs();
    core.info(`Analyzing path: ${inputs.path}`);

    // Validate path
    if (!existsSync(inputs.path)) {
      core.setFailed(`Path not found: ${inputs.path}`);
      return;
    }

    const orgId = context.repo.owner;
    const repo = `${context.repo.owner}/${context.repo.repo}`;
    const prNumber = context.payload.pull_request?.number || context.payload.issue?.number || 0;

    // Collect files for analysis
    core.info('Collecting files for analysis...');
    const files = collectFiles(inputs.path);
    core.info(`Found ${files.length} files to analyze`);

    if (files.length === 0) {
      core.warning('No supported files found for analysis');
      return;
    }

    // Call the managed API
    core.info('Calling PeakInfer analysis API...');
    const response = await callAnalysisAPI(orgId, files, repo, prNumber);

    // Check for credit exhaustion
    if ('error' in response && response.error === 'Credit limit reached') {
      core.warning('Credit limit reached');

      // Post exhaustion comment if in PR context
      if (context.payload.pull_request) {
        const exhaustedResponse = response as CreditExhaustedResponse;
        const comment = generateExhaustedComment(exhaustedResponse.used, exhaustedResponse.limit);
        await octokit.rest.issues.createComment({
          owner: context.repo.owner,
          repo: context.repo.repo,
          issue_number: context.payload.pull_request.number,
          body: comment,
        });
      }

      // Don't fail the action, just warn
      core.setOutput('status', 'skipped');
      core.setOutput('reason', 'credit_limit_reached');
      return;
    }

    const analysisResponse = response as AnalysisResponse;
    const { analysis, credits } = analysisResponse;

    core.info(`Analysis complete: ${analysis.summary.totalInferencePoints} inference points found`);
    core.info(`Credits: ${credits.used}/${credits.limit} used`);

    // Load baseline for comparison
    let baseline = null;
    try {
      baseline = await getBaseline(octokit, context);
      if (baseline) {
        core.info('Loaded baseline for comparison');
      }
    } catch {
      // No baseline available
    }

    // Determine status
    const { status, regressions } = determineStatus(analysis, inputs);

    // Set outputs
    core.setOutput('status', status);
    core.setOutput('inference-points', analysis.summary.totalInferencePoints);
    core.setOutput('summary', JSON.stringify({
      inferencePoints: analysis.summary.totalInferencePoints,
      status,
      regressions,
      credits: credits.remaining,
    }));

    // Post PR comment if in PR context
    if (context.payload.pull_request) {
      core.info('Posting PR comment...');

      // Get changed files
      const changedFiles = await getChangedFiles(octokit, context);

      // Generate location-aware insights from inference points
      // These have file:line locations for inline comments
      const locationAwareInsights = generateLocationAwareInsights(analysis.inferencePoints);

      // Combine API insights with location-aware ones
      const allInsights = [...analysis.insights, ...locationAwareInsights];

      // Filter insights to changed files
      const { newIssues } = filterToChangedFiles(allInsights, changedFiles);

      // Generate and post comment
      const comment = generatePRComment({
        results: {
          inferenceMap: {
            callsites: analysis.inferencePoints,
            summary: {
              totalCallsites: analysis.summary.totalInferencePoints,
              providers: [...new Set(analysis.inferencePoints.map(p => p.provider))],
              models: [...new Set(analysis.inferencePoints.map(p => p.model))],
            },
          },
          insights: allInsights,
        },
        baseline,
        status,
        regressions,
        newIssues,
        changedFiles,
        credits,
        repoContext: {
          owner: context.repo.owner,
          repo: context.repo.repo,
          sha: context.payload.pull_request.head.sha,
        },
      });

      await octokit.rest.issues.createComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: context.payload.pull_request.number,
        body: comment,
      });

      // Post inline comments if enabled
      if (inputs.inlineComments && newIssues.length > 0) {
        core.info('Posting inline comments...');
        const { posted, omitted } = await postInlineComments(octokit, context, newIssues);
        core.info(`Posted ${posted} inline comments (${omitted} omitted)`);
      }
    }

    // Set final status
    if (status === 'fail') {
      core.setFailed(`Analysis failed: ${regressions.join(', ')}`);
    } else if (status === 'warning') {
      core.warning(`Analysis warnings: ${regressions.join(', ')}`);
    } else {
      core.info('Analysis passed');
    }

  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('An unexpected error occurred');
    }
  }
}

run();

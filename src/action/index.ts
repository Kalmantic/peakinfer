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
import { parseEvents } from '../runtime.js';
import { getChangedFiles, filterToChangedFiles, filterFilesToChanged, detectEventsFile } from './diff.js';
import { getBaseline, compareToBaseline } from './baseline.js';
import { parseCommand, handleCommentCommand } from './commands.js';
import { runStaticAnalysis } from '../orchestrator.js';
import type { StaticAnalysisOutput, PerformanceProfile } from '../orchestrator.js';
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
  // v1.8: Runtime correlation inputs
  events?: string;
  eventsUrl?: string;
  eventsMap?: string;
  // v1.9: BYOK fallback
  apiKey?: string;
  // v1.9: Baseline comparison
  compareBaseline: boolean;
  // v1.9: Changed files only mode
  changedFilesOnly: boolean;
}

// Issue type returned by API (LLM-generated fixes)
interface APIIssue {
  type: string;
  severity: 'critical' | 'warning' | 'info';
  headline: string;
  evidence: string;
  originalCode: string;
  suggestedFix: string | null;
  aiAgentPrompt: string;
}

interface AnalysisResponse {
  success: boolean;
  analysis: {
    inferencePoints: Array<{
      id: string;
      file: string;
      line: number;
      provider: string;
      model: string;
      // Original code for the inference point
      originalCode?: string;
      // LLM-generated issues with fixes (v1.6)
      issues?: APIIssue[];
      // Legacy fields
      streaming?: boolean;
      hasRetry?: boolean;
      hasFallback?: boolean;
      costTier?: 'high' | 'medium' | 'low';
      // New 4D profile fields
      hasStreaming?: boolean;
      hasErrorHandling?: boolean;
      estimatedP95Ms?: number;
      isBlocking?: boolean;
      hasRateLimiting?: boolean;
      hasBatching?: boolean;
      hasTimeout?: boolean;
      reliabilityLevel?: string;
    }>;
    insights: Insight[];
    summary: {
      totalInferencePoints: number;
      streamingEnabled?: number;
      withRetries?: number;
      estimatedMonthlyCost?: string;
      primaryRisk?: string;
      // New 4D summary fields
      totalFiles?: number;
      providers?: string[];
      models?: string[];
      estimatedCostPer1kCalls?: number;
      estimatedP95Ms?: number;
      blockingCalls?: number;
      hasRateLimiting?: number;
      hasErrorHandling?: number;
      hasRetry?: number;
      hasFallback?: number;
      overallReliability?: string;
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
    version?: string;
    analysisType?: string;
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

const LANGUAGE_MAP: Record<string, string> = {
  '.py': 'python',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.go': 'go',
  '.java': 'java',
  '.kt': 'kotlin',
  '.rs': 'rust',
  '.rb': 'ruby',
  '.php': 'php',
  '.cs': 'csharp',
  '.swift': 'swift',
  '.scala': 'scala',
};

function detectLanguage(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  return LANGUAGE_MAP[ext] || 'unknown';
}

function mapCostTier(level?: string | null): 'high' | 'medium' | 'low' | undefined {
  if (!level) return undefined;
  if (level === 'critical') return 'high';
  if (level === 'high' || level === 'medium' || level === 'low') return level;
  return undefined;
}

function mapInsightsToActionType(insights: StaticAnalysisOutput['insights']): Insight[] {
  return insights.map(insight => {
    if (!insight.impact) return insight as Insight;
    const layer = insight.impact.layer === 'infrastructure' ? 'hardware' : insight.impact.layer;
    return {
      ...insight,
      impact: {
        ...insight.impact,
        layer,
      },
    } as Insight;
  });
}

function mapProfilesToInferencePoints(
  profiles: PerformanceProfile[]
): AnalysisResponse['analysis']['inferencePoints'] {
  return profiles.map(profile => ({
    id: profile.inference_point_id,
    file: profile.file,
    line: profile.line,
    provider: profile.provider,
    model: profile.model || 'unknown',
    originalCode: profile.originalCode,
    issues: profile.issues?.map(issue => ({
      type: issue.type,
      severity: issue.severity,
      headline: issue.headline,
      evidence: issue.evidence,
      originalCode: issue.originalCode,
      suggestedFix: issue.suggestedFix,
      aiAgentPrompt: issue.aiAgentPrompt,
    })),
    hasStreaming: profile.latency?.streaming_analysis.streaming_enabled,
    hasErrorHandling: profile.reliability?.error_handling.has_try_catch,
    hasRetry: profile.reliability?.retry_strategy.has_retry,
    hasFallback: profile.reliability?.fallback_strategy.has_fallback,
    hasTimeout: profile.reliability?.timeout_handling.timeout_configured ?? profile.latency?.timeout_analysis.timeout_configured,
    hasRateLimiting: profile.throughput?.rate_limiting.has_rate_limiter,
    hasBatching: profile.throughput?.batching_analysis.batching_enabled,
    estimatedP95Ms: profile.latency?.latency_estimate.p95_ms,
    costTier: mapCostTier(profile.cost?.cost_risk.level),
    reliabilityLevel: profile.reliability?.reliability_risk.level,
  }));
}

/**
 * Parse action inputs
 */
function getInputs(): ActionInputs {
  return {
    path: core.getInput('path') || './src',
    inlineComments: core.getInput('inline-comments') !== 'false',
    failOnRegression: core.getInput('fail-on-regression') === 'true',
    targetP95: core.getInput('target-p95') ? parseInt(core.getInput('target-p95'), 10) : undefined,
    // v1.8: Runtime correlation inputs
    events: core.getInput('events') || undefined,
    eventsUrl: core.getInput('events-url') || undefined,
    eventsMap: core.getInput('events-map') || undefined,
    // v1.9: BYOK fallback (uses user's Anthropic key if API unavailable)
    apiKey: core.getInput('api-key') || process.env.ANTHROPIC_API_KEY || undefined,
    // v1.9: Baseline comparison
    compareBaseline: core.getInput('compare-baseline') === 'true',
    // v1.9: Analyze only changed files (faster for large repos)
    changedFilesOnly: core.getInput('changed-files-only') === 'true',
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
 * Run local analysis using BYOK mode (v1.9 fallback)
 * Used when managed API is unavailable and user provides api-key
 */
async function runLocalAnalysis(
  files: Array<{ path: string; content: string }>,
  apiKey: string,
  repo: string,
  prNumber: number
): Promise<AnalysisResponse> {
  core.info('Running local analysis (BYOK mode)...');

  const filesWithLanguage = files.map(file => ({
    ...file,
    language: detectLanguage(file.path),
  }));
  const output = await runStaticAnalysis({ files: filesWithLanguage }, apiKey);
  const inferencePoints = mapProfilesToInferencePoints(output.performance_profiles);

  // Convert orchestrator output to API response format
  return {
    success: true,
    analysis: {
      inferencePoints,
      insights: mapInsightsToActionType(output.insights),
      summary: {
        totalInferencePoints: output.summary.total_inference_points,
        totalFiles: output.summary.total_files,
        providers: output.summary.providers,
        models: output.summary.models,
      },
    },
    credits: { used: 0, limit: 0, remaining: 0 }, // BYOK mode doesn't use credits
    meta: {
      repo,
      prNumber,
      analyzedAt: new Date().toISOString(),
      filesAnalyzed: files.length,
      version: 'byok',
      analysisType: 'local',
    },
  };
}

/**
 * Get model downgrade suggestion
 */
function getModelDowngrade(model: string): string | null {
  const downgrades: Record<string, string> = {
    // Claude model downgrades (Anthropic)
    'claude-3-opus-20240229': 'claude-3-haiku-20240307',
    'claude-3-sonnet-20240229': 'claude-3-haiku-20240307',
    'claude-sonnet-4-20250514': 'claude-3-5-haiku-20241022',
    'claude-opus-4-20250514': 'claude-sonnet-4-20250514',
  };
  return downgrades[model] || null;
}

/**
 * Convert LLM-generated issues from API to Insights.
 * Issues now come with originalCode, suggestedFix, and aiAgentPrompt from the LLM.
 */
function convertAPIIssuesToInsights(
  inferencePoints: AnalysisResponse['analysis']['inferencePoints']
): Insight[] {
  const insights: Insight[] = [];

  for (const point of inferencePoints) {
    const location = `${point.file}:${point.line}`;

    // Convert LLM-generated issues to insights (v1.6)
    if (point.issues && point.issues.length > 0) {
      for (const issue of point.issues) {
        // Map issue type to category
        let category: Insight['category'] = 'reliability';
        if (issue.type.includes('model') || issue.type.includes('cost')) {
          category = 'cost';
        } else if (issue.type.includes('streaming') || issue.type.includes('latency') || issue.type.includes('timeout')) {
          category = 'latency';
        } else if (issue.type.includes('rate') || issue.type.includes('batch') || issue.type.includes('throughput')) {
          category = 'throughput';
        }

        insights.push({
          severity: issue.severity,
          category,
          headline: issue.headline,
          evidence: issue.evidence,
          location,
          source: 'llm',
          // CodeRabbit-style fix fields
          originalCode: issue.originalCode,
          suggestedFix: issue.suggestedFix || undefined,
          aiAgentPrompt: issue.aiAgentPrompt,
          // For backwards compatibility and suggestion syntax
          fullLineFix: issue.suggestedFix || undefined,
          recommendation: issue.aiAgentPrompt,
        } as Insight);
      }
    } else {
      // Fallback to template-based insights if no LLM issues
      // (for backwards compatibility with older API versions)
      const downgrade = getModelDowngrade(point.model);
      const hasStreaming = point.streaming ?? point.hasStreaming ?? false;
      const hasRetry = point.hasRetry ?? false;
      const hasFallback = point.hasFallback ?? false;
      const hasErrorHandling = point.hasErrorHandling ?? false;

      // Model downgrade suggestion
      if (downgrade) {
        insights.push({
          severity: 'warning',
          category: 'cost',
          headline: 'Consider smaller model',
          evidence: `${point.model} is expensive for many tasks.`,
          recommendation: `Use ${downgrade} instead`,
          location,
          source: 'template',
          fullLineFix: `    model: '${downgrade}',`,
        } as Insight);
      }

      // No streaming
      if (!hasStreaming) {
        insights.push({
          severity: 'warning',
          category: 'latency',
          headline: 'No streaming',
          evidence: 'Streaming improves perceived latency.',
          recommendation: 'Add stream: true',
          location,
          source: 'template',
          fullLineFix: `    stream: true,`,
        } as Insight);
      }

      // No error handling
      if (!hasRetry && !hasFallback && !hasErrorHandling) {
        insights.push({
          severity: 'critical',
          category: 'reliability',
          headline: 'No error handling',
          evidence: 'LLM calls can fail unexpectedly.',
          recommendation: 'Add try-catch with retry',
          location,
          source: 'template',
          fullLineFix: `  try {\n    // ... existing code ...\n  } catch (error) {\n    // Retry or handle error\n  }`,
        } as Insight);
      }
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

  // Check for critical issues from LLM analysis (v1.6)
  const criticalIssues = analysis.inferencePoints.reduce((count, p) => {
    return count + (p.issues?.filter(i => i.severity === 'critical').length || 0);
  }, 0);
  if (criticalIssues > 0 && status === 'pass') {
    status = 'warning';
    regressions.push(`${criticalIssues} critical issues found by LLM analysis`);
  }

  // Check for streaming drift (supports both old and new field names)
  const streamingEnabled = analysis.summary.streamingEnabled ?? 0;
  const noStreaming = analysis.inferencePoints.filter(p => {
    const hasStreaming = p.streaming ?? p.hasStreaming ?? false;
    return !hasStreaming;
  });
  if (noStreaming.length > 0 && streamingEnabled === 0) {
    regressions.push('Streaming not enabled on any inference points');
    if (status === 'pass') status = 'warning';
  }

  // Check reliability (supports both old and new field names)
  const noErrorHandling = analysis.inferencePoints.filter(p => {
    const hasRetry = p.hasRetry ?? false;
    const hasFallback = p.hasFallback ?? false;
    const hasErrorHandling = p.hasErrorHandling ?? false;
    return !hasRetry && !hasFallback && !hasErrorHandling;
  });
  if (noErrorHandling.length > analysis.inferencePoints.length * 0.5) {
    regressions.push('More than 50% of inference points lack error handling');
    if (status === 'pass') status = 'warning';
  }

  // Check target-p95 latency threshold (v1.9)
  if (inputs.targetP95 !== undefined) {
    const worstP95 = Math.max(
      ...analysis.inferencePoints
        .map(p => p.estimatedP95Ms ?? 0)
        .filter(v => v > 0)
    );
    if (worstP95 > inputs.targetP95) {
      regressions.push(`Worst p95 latency (${worstP95}ms) exceeds target (${inputs.targetP95}ms)`);
      if (status === 'pass') status = 'warning';
    }
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
    let files = collectFiles(inputs.path);
    core.info(`Found ${files.length} files to analyze`);

    // v1.9: Filter to changed files only if requested
    let changedFilesForFiltering: string[] = [];
    if (inputs.changedFilesOnly && context.payload.pull_request) {
      core.info('Changed-files-only mode enabled, filtering...');
      changedFilesForFiltering = await getChangedFiles(octokit, context);
      const originalCount = files.length;
      files = filterFilesToChanged(files, changedFilesForFiltering);
      core.info(`Filtered to ${files.length} files (${originalCount - files.length} excluded)`);
    }

    if (files.length === 0) {
      core.warning('No supported files found for analysis');
      return;
    }

    // v1.8: Load runtime events if provided (for gap messaging)
    // v1.9.3: Auto-detect events file in PR if not explicitly provided
    let hasRuntime = false;
    let runtimeEventCount = 0;
    let eventsPath = inputs.events;

    // Auto-detect events file in PR (per PRD v1.9.3)
    if (!eventsPath && context.payload.pull_request) {
      const detectedEvents = await detectEventsFile(octokit, context);
      if (detectedEvents) {
        core.info(`Auto-detected runtime events file: ${detectedEvents}`);
        eventsPath = detectedEvents;
      }
    }

    if (eventsPath && existsSync(eventsPath)) {
      try {
        core.info(`Loading runtime events from ${eventsPath}...`);

        // Parse events-map input (format: "timestamp=time,inputTokens=prompt_tokens")
        const fieldHints: Record<string, string> = {};
        if (inputs.eventsMap) {
          const mappings = inputs.eventsMap.split(',');
          for (const mapping of mappings) {
            const [target, source] = mapping.trim().split('=');
            if (target && source) {
              fieldHints[target.trim()] = source.trim();
            }
          }
          core.info(`Applied ${Object.keys(fieldHints).length} field mappings from events-map`);
        }

        const runtimeEvents = await parseEvents(eventsPath, {
          field_hints: Object.keys(fieldHints).length > 0 ? fieldHints : undefined,
        });
        hasRuntime = runtimeEvents.length > 0;
        runtimeEventCount = runtimeEvents.length;
        core.info(`Loaded ${runtimeEventCount} runtime events`);
      } catch (error) {
        core.warning(`Failed to parse runtime events: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Call the managed API (with BYOK fallback)
    let response: AnalysisResponse | CreditExhaustedResponse;
    let usedFallback = false;

    try {
      core.info('Calling PeakInfer analysis API...');
      response = await callAnalysisAPI(orgId, files, repo, prNumber);
    } catch (apiError) {
      // Network error - try BYOK fallback if api-key provided
      if (inputs.apiKey) {
        core.warning(`API unavailable, using BYOK fallback: ${apiError instanceof Error ? apiError.message : 'Unknown error'}`);
        response = await runLocalAnalysis(files, inputs.apiKey, repo, prNumber);
        usedFallback = true;
      } else {
        throw apiError; // Re-throw if no fallback available
      }
    }

    // Check for credit exhaustion (only applies to managed API)
    if (!usedFallback && 'error' in response && response.error === 'Credit limit reached') {
      // Try BYOK fallback if available
      if (inputs.apiKey) {
        core.warning('Credits exhausted, using BYOK fallback');
        response = await runLocalAnalysis(files, inputs.apiKey, repo, prNumber);
        usedFallback = true;
      } else {
        core.warning('Credit limit reached');

        // Post exhaustion comment if in PR context
        if (context.payload.pull_request) {
          const exhaustedResponse = response as CreditExhaustedResponse;
          // Pass file count as unanalyzed count (closest approximation since analysis stopped)
          const comment = generateExhaustedComment(exhaustedResponse.used, exhaustedResponse.limit, files.length);
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
    }

    const analysisResponse = response as AnalysisResponse;
    const { analysis, credits } = analysisResponse;

    core.info(`Analysis complete: ${analysis.summary.totalInferencePoints} inference points found`);
    core.info(`Credits: ${credits.remaining} remaining (of ${credits.limit})`);

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

      // Convert LLM-generated issues to insights (v1.6)
      // These have file:line locations and originalCode/suggestedFix from LLM
      const locationAwareInsights = convertAPIIssuesToInsights(analysis.inferencePoints);

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
          baseSha: context.payload.pull_request.base.sha,
          prNumber: context.payload.pull_request.number,
        },
        // v1.8: Runtime correlation gap messaging
        hasRuntime,
        runtimeEventCount,
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

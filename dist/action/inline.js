/**
 * Inline PR Comments (v1.6)
 *
 * Posts inline comments with suggested fixes on specific files/lines.
 * Design aligned with DD v1.6: Clean, text labels, no emoji clutter.
 */
/**
 * Parse location string to file and line
 */
function parseLocation(location) {
    if (!location)
        return {};
    const match = location.match(/^(.+):(\d+)$/);
    if (match) {
        return { file: match[1], line: parseInt(match[2], 10) };
    }
    return { file: location };
}
// =============================================================================
// CONSTANTS
// =============================================================================
// With Option A (minimal summary), inline comments carry all the detail
// Increased to 10 to cover most issues
const MAX_INLINE_COMMENTS = 10;
// =============================================================================
// HELPERS
// =============================================================================
/**
 * Get severity score for sorting
 */
function severityScore(insight) {
    const scores = {
        critical: 3,
        warning: 2,
        info: 1,
    };
    return scores[insight.severity] || 0;
}
/**
 * Get issue title, supporting both formats.
 */
function getIssueTitle(insight) {
    return insight.headline || insight.title || 'Issue';
}
/**
 * Get severity label for accessible indication.
 * Uses text labels per DD Section 3.7 (don't rely on color alone).
 */
function getSeverityLabel(severity) {
    switch (severity) {
        case 'critical': return 'CRITICAL';
        case 'warning': return 'WARNING';
        default: return 'INFO';
    }
}
/**
 * Get severity icon and label (CodeRabbit style)
 */
function getSeverityBadge(severity) {
    switch (severity) {
        case 'critical':
            return { icon: '🔴', label: 'Critical' };
        case 'warning':
            return { icon: '🟡', label: 'Medium' };
        default:
            return { icon: '🔵', label: 'Low' };
    }
}
/**
 * Format insight as inline comment body (CodeRabbit style).
 * Structure: Severity badge → Explanation → One-click suggestion
 *
 * Uses GitHub's native ```suggestion syntax for one-click "Commit suggestion" button.
 * Julie Zhou principle: Make the primary action obvious and friction-free.
 */
function formatInlineComment(insight) {
    const lines = [];
    const title = getIssueTitle(insight);
    const badge = getSeverityBadge(insight.severity);
    // Severity header (CodeRabbit style - clear, scannable)
    lines.push(`**${getSeverityLabel(insight.severity)}:** ${title}`);
    lines.push('');
    // Evidence - why this matters
    if (insight.evidence) {
        lines.push(insight.evidence);
        lines.push('');
    }
    // Get fix content from API
    const suggestedFix = insight.suggestedFix;
    // One-click fix using GitHub's suggestion syntax
    // This creates "Commit suggestion" and "Add suggestion to batch" buttons
    if (suggestedFix) {
        lines.push('**Fix:** Click "Apply suggestion" below');
        lines.push('');
        lines.push('```suggestion');
        lines.push(suggestedFix);
        lines.push('```');
    }
    else if (insight.recommendation) {
        // Fallback to text recommendation if no code fix
        lines.push(`**Fix:** ${insight.recommendation}`);
    }
    lines.push('');
    lines.push('---');
    lines.push('*PeakInfer*');
    return lines.join('\n');
}
// =============================================================================
// MAIN
// =============================================================================
/**
 * Calculate line range for multi-line suggestions.
 * GitHub's suggestion syntax replaces lines from start_line to line.
 */
function calculateLineRange(insight) {
    const loc = parseLocation(insight.location);
    if (!loc.line)
        return null;
    // Get original code to calculate how many lines to replace
    const originalCode = insight.originalCode;
    if (originalCode) {
        const lineCount = originalCode.split('\n').length;
        return {
            startLine: loc.line,
            endLine: loc.line + lineCount - 1,
        };
    }
    // Single line replacement
    return { startLine: loc.line, endLine: loc.line };
}
/**
 * Post inline comments on PR files with one-click apply suggestions.
 *
 * Features:
 * - One-click "Commit suggestion" button for each fix
 * - "Add suggestion to batch" for applying multiple fixes at once
 * - Multi-line suggestion support for function-level fixes
 *
 * Returns count of posted and omitted comments
 */
export async function postInlineComments(octokit, context, insights, options) {
    const pr = context.payload.pull_request;
    if (!pr) {
        return { posted: 0, omitted: 0 };
    }
    // Filter to insights with valid locations
    let validInsights = insights.filter(i => {
        const loc = parseLocation(i.location);
        return loc.file && loc.line;
    });
    // Sort by severity (critical first)
    validInsights = validInsights.sort((a, b) => severityScore(b) - severityScore(a));
    // Unless showAll is true, only show critical and warning by default
    if (!options?.showAll) {
        validInsights = validInsights.filter(i => i.severity === 'critical' || i.severity === 'warning');
    }
    // Limit to MAX_INLINE_COMMENTS
    const topInsights = validInsights.slice(0, MAX_INLINE_COMMENTS);
    let posted = 0;
    for (const insight of topInsights) {
        const loc = parseLocation(insight.location);
        if (!loc.file || !loc.line)
            continue;
        const lineRange = calculateLineRange(insight);
        if (!lineRange)
            continue;
        try {
            // For multi-line suggestions, use start_line parameter
            const commentParams = {
                owner: context.repo.owner,
                repo: context.repo.repo,
                pull_number: pr.number,
                body: formatInlineComment(insight),
                commit_id: pr.head.sha,
                path: loc.file,
                line: lineRange.endLine,
                side: 'RIGHT',
            };
            // Add start_line for multi-line suggestions
            if (lineRange.startLine !== lineRange.endLine) {
                commentParams.start_line = lineRange.startLine;
                commentParams.start_side = 'RIGHT';
            }
            await octokit.rest.pulls.createReviewComment(commentParams);
            posted++;
        }
        catch {
            // Skip if comment fails (e.g., file not in PR diff)
            continue;
        }
    }
    const omitted = Math.max(0, validInsights.length - MAX_INLINE_COMMENTS);
    return { posted, omitted };
}
//# sourceMappingURL=inline.js.map
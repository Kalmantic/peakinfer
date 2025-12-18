/**
 * Inline PR Comments (v1.6)
 *
 * Posts inline comments on specific files/lines in PRs.
 * Throttled to max 10 comments per PR.
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
 * Format insight as inline comment body
 */
function formatInlineComment(insight) {
    const lines = [];
    // Severity badge
    const badges = {
        critical: '[!] CRITICAL',
        warning: '[*] WARNING',
        info: '[-] INFO',
    };
    lines.push(`**${badges[insight.severity] || insight.severity}**: ${insight.headline}`);
    lines.push('');
    if (insight.evidence) {
        lines.push(`> ${insight.evidence}`);
        lines.push('');
    }
    if (insight.recommendation) {
        lines.push(`**Recommendation:** ${insight.recommendation}`);
    }
    lines.push('');
    lines.push('<sub>PeakInfer</sub>');
    return lines.join('\n');
}
// =============================================================================
// MAIN
// =============================================================================
/**
 * Post inline comments on PR files
 *
 * Returns count of posted and omitted comments
 */
export async function postInlineComments(octokit, context, insights) {
    const pr = context.payload.pull_request;
    if (!pr) {
        return { posted: 0, omitted: 0 };
    }
    // Sort by severity and take top N (only those with valid locations)
    const topInsights = insights
        .filter(i => {
        const loc = parseLocation(i.location);
        return loc.file && loc.line;
    })
        .sort((a, b) => severityScore(b) - severityScore(a))
        .slice(0, MAX_INLINE_COMMENTS);
    let posted = 0;
    for (const insight of topInsights) {
        const loc = parseLocation(insight.location);
        if (!loc.file || !loc.line)
            continue;
        try {
            await octokit.rest.pulls.createReviewComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                pull_number: pr.number,
                body: formatInlineComment(insight),
                commit_id: pr.head.sha,
                path: loc.file,
                line: loc.line,
                side: 'RIGHT',
            });
            posted++;
        }
        catch {
            // Skip if comment fails (e.g., file not in PR diff)
            continue;
        }
    }
    const omitted = Math.max(0, insights.length - MAX_INLINE_COMMENTS);
    return { posted, omitted };
}
//# sourceMappingURL=inline.js.map
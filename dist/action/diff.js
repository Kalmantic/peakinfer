/**
 * Diff-Aware Filtering (v1.6)
 *
 * Gets changed files in PR and filters insights to only those
 * affecting changed files.
 */
/**
 * Parse location string to extract file path
 */
function parseLocationFile(location) {
    if (!location)
        return undefined;
    const match = location.match(/^(.+):(\d+)$/);
    if (match) {
        return match[1];
    }
    return location;
}
// =============================================================================
// MAIN
// =============================================================================
/**
 * Get list of files changed in the PR
 */
export async function getChangedFiles(octokit, context) {
    const pr = context.payload.pull_request;
    if (!pr) {
        return [];
    }
    try {
        const { data } = await octokit.rest.pulls.listFiles({
            owner: context.repo.owner,
            repo: context.repo.repo,
            pull_number: pr.number,
        });
        return data.map((f) => f.filename);
    }
    catch {
        return [];
    }
}
/**
 * Filter insights to those affecting changed files
 *
 * Returns:
 * - newIssues: Issues in files changed by this PR
 * - preExisting: Issues in files not changed by this PR
 */
export function filterToChangedFiles(insights, changedFiles) {
    // Normalize paths for comparison
    const normalizedChanged = new Set(changedFiles.map(f => f.replace(/^\.\//, '')));
    const newIssues = [];
    const preExisting = [];
    for (const insight of insights) {
        const file = parseLocationFile(insight.location);
        if (!file) {
            // No file associated, treat as new
            newIssues.push(insight);
            continue;
        }
        const normalizedFile = file.replace(/^\.\//, '');
        if (normalizedChanged.has(normalizedFile)) {
            newIssues.push(insight);
        }
        else {
            preExisting.push(insight);
        }
    }
    return { newIssues, preExisting };
}
//# sourceMappingURL=diff.js.map
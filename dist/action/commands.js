/**
 * PR Comment Commands (v1.6)
 *
 * Handles commands from PR comments:
 * - /peakinfer - Re-run analysis
 * - /fix <id> - Apply fix for issue
 * - /fix all - Apply all fixes
 * - /dismiss <id> - Dismiss issue
 *
 * Design: User types command in comment → workflow triggers → action taken
 */
import * as core from '@actions/core';
// =============================================================================
// COMMAND PARSING
// =============================================================================
/**
 * Parse command from comment body
 */
export function parseCommand(body) {
    const trimmed = body.trim().toLowerCase();
    // /peakinfer or /peakinfer rerun
    if (trimmed === '/peakinfer' || trimmed === '/peakinfer rerun') {
        return { type: 'rerun' };
    }
    // /fix all
    if (trimmed === '/fix all' || trimmed === '/peakinfer fix all') {
        return { type: 'fix-all' };
    }
    // /fix <id>
    const fixMatch = trimmed.match(/^\/(?:peakinfer\s+)?fix\s+(\d+)$/);
    if (fixMatch) {
        return { type: 'fix', issueId: parseInt(fixMatch[1], 10) };
    }
    // /dismiss <id>
    const dismissMatch = trimmed.match(/^\/(?:peakinfer\s+)?dismiss\s+(\d+)$/);
    if (dismissMatch) {
        return { type: 'dismiss', issueId: parseInt(dismissMatch[1], 10) };
    }
    return null;
}
// =============================================================================
// STATE MANAGEMENT
// =============================================================================
const STATE_COMMENT_MARKER = '<!-- peakinfer-state:';
/**
 * Store PR state in a hidden comment
 */
export async function storePRState(octokit, context, state) {
    const stateJson = JSON.stringify(state);
    const body = `${STATE_COMMENT_MARKER}${stateJson}-->`;
    // Find existing state comment
    const comments = await octokit.rest.issues.listComments({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: state.prNumber,
    });
    const stateComment = comments.data.find(c => c.body?.startsWith(STATE_COMMENT_MARKER));
    if (stateComment) {
        await octokit.rest.issues.updateComment({
            owner: context.repo.owner,
            repo: context.repo.repo,
            comment_id: stateComment.id,
            body,
        });
    }
    else {
        await octokit.rest.issues.createComment({
            owner: context.repo.owner,
            repo: context.repo.repo,
            issue_number: state.prNumber,
            body,
        });
    }
}
/**
 * Load PR state from hidden comment
 */
export async function loadPRState(octokit, context, prNumber) {
    const comments = await octokit.rest.issues.listComments({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: prNumber,
    });
    const stateComment = comments.data.find(c => c.body?.startsWith(STATE_COMMENT_MARKER));
    if (!stateComment?.body)
        return null;
    try {
        const jsonStart = stateComment.body.indexOf(STATE_COMMENT_MARKER) + STATE_COMMENT_MARKER.length;
        const jsonEnd = stateComment.body.indexOf('-->');
        const json = stateComment.body.slice(jsonStart, jsonEnd);
        return JSON.parse(json);
    }
    catch {
        return null;
    }
}
// =============================================================================
// COMMAND HANDLERS
// =============================================================================
/**
 * Handle /fix <id> command - apply a specific fix
 */
export async function handleFix(octokit, context, issueId) {
    const prNumber = context.payload.issue?.number;
    if (!prNumber) {
        return { success: false, message: 'Not in a PR context' };
    }
    // Load state
    const state = await loadPRState(octokit, context, prNumber);
    if (!state) {
        return { success: false, message: 'No analysis found. Run /peakinfer first.' };
    }
    const issue = state.issues.find(i => i.id === issueId);
    if (!issue) {
        return { success: false, message: `Issue #${issueId} not found` };
    }
    if (issue.status !== 'pending') {
        return { success: false, message: `Issue #${issueId} already ${issue.status}` };
    }
    if (!issue.suggestedFix || !issue.location) {
        return { success: false, message: `Issue #${issueId} has no automated fix available` };
    }
    // Parse location
    const locMatch = issue.location.match(/^(.+):(\d+)$/);
    if (!locMatch) {
        return { success: false, message: `Invalid location format: ${issue.location}` };
    }
    const [, filePath, lineStr] = locMatch;
    const line = parseInt(lineStr, 10);
    try {
        // Get PR details
        const pr = await octokit.rest.pulls.get({
            owner: context.repo.owner,
            repo: context.repo.repo,
            pull_number: prNumber,
        });
        // Get file content from PR branch
        const { data: fileContent } = await octokit.rest.repos.getContent({
            owner: context.repo.owner,
            repo: context.repo.repo,
            path: filePath,
            ref: pr.data.head.ref,
        });
        if (!('content' in fileContent)) {
            return { success: false, message: `Could not read file: ${filePath}` };
        }
        // Decode and apply fix
        const content = Buffer.from(fileContent.content, 'base64').toString('utf-8');
        const lines = content.split('\n');
        // Multi-line aware patching:
        // - If fix contains newlines, splice multiple lines
        // - Find end line by counting original indentation block
        const fixLines = issue.suggestedFix.split('\n');
        const originalIndent = lines[line - 1]?.match(/^(\s*)/)?.[1] || '';
        // Determine how many lines to replace (find next line with same/less indent)
        let endLine = line;
        if (fixLines.length > 1) {
            for (let i = line; i < lines.length; i++) {
                const lineIndent = lines[i].match(/^(\s*)/)?.[1] || '';
                const lineContent = lines[i].trim();
                // Stop at same-or-less indent (unless empty line)
                if (lineContent && lineIndent.length <= originalIndent.length && i > line - 1) {
                    endLine = i;
                    break;
                }
                if (i === lines.length - 1)
                    endLine = i + 1;
            }
        }
        // Splice in the fix (remove old lines, insert new)
        lines.splice(line - 1, endLine - line + 1, ...fixLines);
        const newContent = lines.join('\n');
        // Create commit
        await octokit.rest.repos.createOrUpdateFileContents({
            owner: context.repo.owner,
            repo: context.repo.repo,
            path: filePath,
            message: `fix: ${issue.headline}\n\nApplied PeakInfer suggestion #${issueId}`,
            content: Buffer.from(newContent).toString('base64'),
            sha: fileContent.sha,
            branch: pr.data.head.ref,
        });
        // Update state
        issue.status = 'fixed';
        await storePRState(octokit, context, state);
        return {
            success: true,
            message: `Fixed issue #${issueId}: ${issue.headline}`,
        };
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, message: `Failed to apply fix: ${msg}` };
    }
}
/**
 * Handle /dismiss <id> command
 */
export async function handleDismiss(octokit, context, issueId) {
    const prNumber = context.payload.issue?.number;
    if (!prNumber) {
        return { success: false, message: 'Not in a PR context' };
    }
    const state = await loadPRState(octokit, context, prNumber);
    if (!state) {
        return { success: false, message: 'No analysis found. Run /peakinfer first.' };
    }
    const issue = state.issues.find(i => i.id === issueId);
    if (!issue) {
        return { success: false, message: `Issue #${issueId} not found` };
    }
    if (issue.status !== 'pending') {
        return { success: false, message: `Issue #${issueId} already ${issue.status}` };
    }
    issue.status = 'dismissed';
    await storePRState(octokit, context, state);
    return {
        success: true,
        message: `Dismissed issue #${issueId}: ${issue.headline}`,
    };
}
/**
 * Handle /fix all command
 */
export async function handleFixAll(octokit, context) {
    const prNumber = context.payload.issue?.number;
    if (!prNumber) {
        return { success: false, message: 'Not in a PR context' };
    }
    const state = await loadPRState(octokit, context, prNumber);
    if (!state) {
        return { success: false, message: 'No analysis found. Run /peakinfer first.' };
    }
    const pendingWithFixes = state.issues.filter(i => i.status === 'pending' && i.suggestedFix && i.location);
    if (pendingWithFixes.length === 0) {
        return { success: false, message: 'No pending issues with fixes available' };
    }
    let fixed = 0;
    let failed = 0;
    for (const issue of pendingWithFixes) {
        const result = await handleFix(octokit, context, issue.id);
        if (result.success) {
            fixed++;
        }
        else {
            failed++;
            core.warning(`Failed to fix #${issue.id}: ${result.message}`);
        }
    }
    return {
        success: fixed > 0,
        message: `Applied ${fixed} fixes${failed > 0 ? `, ${failed} failed` : ''}`,
    };
}
// =============================================================================
// RESPONSE POSTING
// =============================================================================
/**
 * Post command response as a reply
 */
export async function postCommandResponse(octokit, context, success, message) {
    const prNumber = context.payload.issue?.number;
    if (!prNumber)
        return;
    const statusLabel = success ? '[OK]' : '[ERROR]';
    const body = `${statusLabel} ${message}\n\n<sub>PeakInfer</sub>`;
    await octokit.rest.issues.createComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: prNumber,
        body,
    });
}
// =============================================================================
// MAIN HANDLER
// =============================================================================
/**
 * Handle comment command
 * Returns true if a command was found and handled
 */
export async function handleCommentCommand(octokit, context) {
    const comment = context.payload.comment;
    if (!comment?.body)
        return false;
    const command = parseCommand(comment.body);
    if (!command)
        return false;
    core.info(`Handling command: ${command.type}`);
    let result;
    switch (command.type) {
        case 'rerun':
            // Rerun is handled by re-running the analysis workflow
            result = { success: true, message: 'Re-running analysis...' };
            break;
        case 'fix':
            if (command.issueId === undefined) {
                result = { success: false, message: 'Missing issue ID' };
            }
            else {
                result = await handleFix(octokit, context, command.issueId);
            }
            break;
        case 'fix-all':
            result = await handleFixAll(octokit, context);
            break;
        case 'dismiss':
            if (command.issueId === undefined) {
                result = { success: false, message: 'Missing issue ID' };
            }
            else {
                result = await handleDismiss(octokit, context, command.issueId);
            }
            break;
        default:
            return false;
    }
    await postCommandResponse(octokit, context, result.success, result.message);
    return true;
}
//# sourceMappingURL=commands.js.map
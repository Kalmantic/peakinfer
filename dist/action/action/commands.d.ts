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
import * as github from '@actions/github';
type OctokitType = ReturnType<typeof github.getOctokit>;
interface Command {
    type: 'rerun' | 'fix' | 'fix-all' | 'dismiss' | 'unknown';
    issueId?: number;
}
interface StoredIssue {
    id: number;
    headline: string;
    location?: string;
    suggestedFix?: string;
    status: 'pending' | 'fixed' | 'dismissed';
}
interface PRState {
    prNumber: number;
    repo: string;
    issues: StoredIssue[];
    lastAnalysis: string;
}
/**
 * Parse command from comment body
 */
export declare function parseCommand(body: string): Command | null;
/**
 * Store PR state in a hidden comment
 */
export declare function storePRState(octokit: OctokitType, context: typeof github.context, state: PRState): Promise<void>;
/**
 * Load PR state from hidden comment
 */
export declare function loadPRState(octokit: OctokitType, context: typeof github.context, prNumber: number): Promise<PRState | null>;
/**
 * Handle /fix <id> command - apply a specific fix
 */
export declare function handleFix(octokit: OctokitType, context: typeof github.context, issueId: number): Promise<{
    success: boolean;
    message: string;
}>;
/**
 * Handle /dismiss <id> command
 */
export declare function handleDismiss(octokit: OctokitType, context: typeof github.context, issueId: number): Promise<{
    success: boolean;
    message: string;
}>;
/**
 * Handle /fix all command
 */
export declare function handleFixAll(octokit: OctokitType, context: typeof github.context): Promise<{
    success: boolean;
    message: string;
}>;
/**
 * Post command response as a reply
 */
export declare function postCommandResponse(octokit: OctokitType, context: typeof github.context, success: boolean, message: string): Promise<void>;
/**
 * Handle comment command
 * Returns true if a command was found and handled
 */
export declare function handleCommentCommand(octokit: OctokitType, context: typeof github.context): Promise<boolean>;
export {};
//# sourceMappingURL=commands.d.ts.map
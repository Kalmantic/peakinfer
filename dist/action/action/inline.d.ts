/**
 * Inline PR Comments (v1.6)
 *
 * Posts inline comments with suggested fixes on specific files/lines.
 * Design aligned with DD v1.6: Clean, text labels, no emoji clutter.
 */
import type { Insight } from '../types.js';
type Octokit = any;
type Context = any;
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
export declare function postInlineComments(octokit: Octokit, context: Context, insights: Insight[], options?: {
    showAll?: boolean;
}): Promise<{
    posted: number;
    omitted: number;
}>;
export {};
//# sourceMappingURL=inline.d.ts.map
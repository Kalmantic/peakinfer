/**
 * CI Command (v1.6)
 *
 * CLI command for CI/CD integration:
 * - Runs analysis with baseline comparison
 * - Returns exit codes for CI gates
 * - Outputs machine-readable JSON
 *
 * Exit codes:
 * - 0: Pass (no regressions)
 * - 1: Warning (minor regressions)
 * - 2: Fail (major regressions)
 */
import { Command } from 'commander';
/**
 * Register CI command
 */
export declare function registerCICommand(program: Command): void;
//# sourceMappingURL=ci.d.ts.map
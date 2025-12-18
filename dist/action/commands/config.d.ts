/**
 * Config Commands (v1.6)
 *
 * CLI commands for managing PeakInfer configuration:
 * - set: Set a configuration value
 * - show: Display current configuration
 *
 * Configuration resolution chain:
 * CLI flags → env vars → ~/.peakinfer/config.yaml → ./peakinfer.yaml → defaults
 */
import { Command } from 'commander';
/**
 * Register config commands
 */
export declare function registerConfigCommands(program: Command): void;
//# sourceMappingURL=config.d.ts.map
/**
 * Agent Module - PeakInfer TDD v1.3
 * 
 * Exports for the two-pass execution model:
 * - Planner (Pass 1): Generates execution plans
 * - Executor (Pass 2): Runs plans with tool resolution
 * - Orchestrator: Coordinates the complete analysis
 * - ContextManager: Filesystem-based persistence for resumability
 */

// Types
export * from './types.js';

// Core components
export { Planner } from './planner.js';
export { Executor } from './executor.js';
export { AgentOrchestrator, analyzeWithTwoPass } from './orchestrator.js';
export type { OrchestratorOptions, AnalysisResult } from './orchestrator.js';

// Context management
export { ContextManager, DEFAULT_CONTEXT_CONFIG } from './context-manager.js';
export type { ContextPointer, RunMetadata, ContextManagerConfig } from './context-manager.js';


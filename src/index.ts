/**
 * PeakInfer - LLM Inference Performance Analysis
 *
 * @packageDocumentation
 */

console.log('hello world');

// Version
export { VERSION, VERSION_DISPLAY } from './version.js';

// Core types
export type {
  Provider,
  Callsite,
  Patterns,
  CallsitePatterns,
  InferenceEvent,
  RuntimeSummary,
  JoinedOutput,
  InferenceMap,
  Insight,
  InsightTemplate,
  PerformanceEnvelope,
  ScanResult,
  ScannedFile,
  ScanCandidate,
} from './types.js';

// Agent
export { Agent, plan } from './agent.js';
export type { AgentOptions, AgentCallbacks, AgentResults, PlanResult, ProgressPhase, ProgressData } from './agent.js';

// Scanner
export { scan } from './scanner.js';

// Analyzer
export { analyze, analyzeFile } from './analyzer.js';

// Runtime parser
export { parseEvents, aggregate } from './runtime.js';

// Joiner
export { join } from './joiner.js';

// Templates
export { loadTemplates } from './templates.js';

// Insights
export { evaluate } from './insights.js';

// Costs
export { loadPricing, getModelCost, calculateCost } from './costs.js';

// Envelopes
export { ENVELOPES, getEnvelope, getThroughputPercent } from './envelopes.js';

// Renderer
export { createRenderer } from './renderer.js';
export type { Renderer, RendererOptions } from './renderer.js';

// HTML
export { generateHTML } from './html.js';
export type { HTMLData } from './html.js';

// Artifacts
export {
  saveArtifacts,
  getOutputDir,
  artifactsExist,
  checkResumable,
  loadArtifacts,
  generateRunId,
} from './artifacts.js';
export type { ArtifactData, SaveOptions } from './artifacts.js';

// Run Identity
export {
  getRunDir,
  createManifest,
  canResume,
  loadManifest,
  loadCachedArtifacts,
} from './runid.js';
export type { RunInputs, RunManifest, CachedArtifacts } from './runid.js';

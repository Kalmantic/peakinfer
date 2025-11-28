/**
 * PeakInfer SLC v2 — Module Exports
 *
 * Per Tech Design v1.1: AI-First Architecture
 * Powered by AI agents for intelligent analysis.
 */

// Core types
export * from './types.js';

// Agent Analyzer — AI agent powered (NEW, FAST!)
export { analyzeWithAgent, analyzeWithAgentStreaming } from './agent-analyzer.js';

// Scanner — file discovery
export { scan } from './scanner.js';

// Detector — LLM-powered callsite detection (legacy)
export { createDetector, type ClaudeDetector } from './detector.js';

// Validator — LLM output validation
export { validateP1Response, validateP2Response, normalizeProvider } from './validator.js';

// StackMap — hierarchical callsite mapping
export { buildStackMap } from './stackmap.js';

// Pricing — deterministic cost calculation
export { calculatePricing, getModelPrice, PRICING_DATA } from './pricing.js';

// Renderer — CLI output
export {
  renderZeroState,
  renderLoadingState,
  renderErrorState,
  renderPartialState,
  renderSuccessState,
  clearLoadingState,
  formatCurrency,
} from './renderer.js';

// HTML Renderer — Beautiful reports
export { generateHTMLReport } from './html-renderer.js';

// CLI
export { analyze } from './cli.js';

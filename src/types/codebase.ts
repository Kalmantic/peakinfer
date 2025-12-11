/**
 * Codebase Analysis Type Definitions
 * Types for static code analysis and optimization discovery
 * Based on PRD v0.7: Codebase Scanner & Analysis
 */

import { HardwareProfile } from './hardware.js';

/**
 * Complete codebase analysis result
 */
export interface CodebaseAnalysis {
  llmApiCalls: LLMAPICall[];
  modelUsagePatterns: ModelUsagePattern[];
  configurationFiles: ConfigFile[];
  cachingOpportunities: CachingOpportunity[];
  optimizationOpportunities: CodeOptimization[];
  integrationPoints: IntegrationPoint[];
  codeMetrics: CodeMetrics;
  hardwareProfile?: HardwareProfile;
}

/**
 * LLM API call detected in code
 */
export interface LLMAPICall {
  file: string;
  lineNumber: number;
  lineEnd: number;
  apiProvider: string;
  model: string | null;
  callPattern: string;
  context: string;
  estimatedThroughput: number;
  hasCaching: boolean;
  hasErrorHandling: boolean;
  hasRetry: boolean;
  functionName?: string;
  language: string;
}

/**
 * Model usage pattern aggregated across codebase
 */
export interface ModelUsagePattern {
  model: string;
  provider: string;
  occurrences: number;
  files: string[];
  estimatedMonthlyThroughput: number;
  averageContextLength: number;
  usageType: 'chat' | 'completion' | 'embedding' | 'unknown';
}

/**
 * Configuration file detected
 */
export interface ConfigFile {
  file: string;
  type: 'env' | 'yaml' | 'json' | 'toml' | 'terraform' | 'docker' | 'kubernetes' | 'other';
  hasLLMConfig: boolean;
  hasApiKeys: boolean;
  sanitizedContent?: string;
  llmSettings?: {
    providers: string[];
    models: string[];
    endpoints: string[];
  };
}

/**
 * Caching opportunity identified
 */
export interface CachingOpportunity {
  file: string;
  lineNumber: number;
  recommendation: string;
  estimatedGain: number;
  implementationComplexity: 'low' | 'medium' | 'high';
  affectedCalls: number;
  cacheType: 'semantic' | 'exact' | 'distributed';
  confidence: number;
}

/**
 * Code-level optimization opportunity
 */
export interface CodeOptimization {
  file: string;
  lineNumber: number;
  type: 'caching' | 'batching' | 'routing' | 'context' | 'error-handling' | 'config' | 'redundant-call';
  description: string;
  currentCode: string;
  suggestedCode?: string;
  estimatedGain: number;
  implementationEffort: 'low' | 'medium' | 'high';
  priority: 'high' | 'medium' | 'low';
  templateId?: string;
}

/**
 * Integration point with external systems
 */
export interface IntegrationPoint {
  file: string;
  lineNumber: number;
  type: 'databricks' | 'snowflake' | 'terraform' | 'docker' | 'kubernetes' | 'api' | 'database';
  platform: string;
  description: string;
  optimizationPotential: number;
}

/**
 * Code metrics summary
 */
export interface CodeMetrics {
  totalFiles: number;
  filesWithLLMCalls: number;
  totalLLMCalls: number;
  estimatedMonthlyCalls: number;
  potentialCacheableCalls: number;
  codebaseLanguages: string[];
  totalLinesScanned: number;
  scanDurationMs: number;
  providerDistribution: Record<string, number>;
  modelDistribution: Record<string, number>;
}

/**
 * Scan configuration options
 */
export interface CodebaseScanOptions {
  rootPath: string;
  ignorePatterns?: string[];
  includePatterns?: string[];
  maxFileSize?: number;
  maxFiles?: number;
  scanDepth?: 'shallow' | 'normal' | 'deep';
  followSymlinks?: boolean;
  detectLanguages?: string[];
}

/**
 * Language-specific pattern definitions
 */
export interface LanguagePatterns {
  language: string;
  extensions: string[];
  llmApiPatterns: {
    provider: string;
    patterns: RegExp[];
  }[];
  importPatterns: RegExp[];
  cachePatterns: RegExp[];
  errorHandlingPatterns: RegExp[];
}

/**
 * File analysis result
 */
export interface FileAnalysis {
  file: string;
  language: string;
  linesOfCode: number;
  llmApiCalls: LLMAPICall[];
  hasLLMImports: boolean;
  hasCaching: boolean;
  hasErrorHandling: boolean;
  configType?: string;
  errors: string[];
}

/**
 * Code context around a detected pattern
 */
export interface CodeContext {
  beforeLines: string[];
  matchLine: string;
  afterLines: string[];
  startLine: number;
  endLine: number;
}

/**
 * Suggestion for code changes
 */
export interface CodeSuggestion {
  id: string;
  file: string;
  lineNumber: number;
  title: string;
  description: string;
  category: 'performance' | 'throughput' | 'reliability' | 'best-practice';
  currentCode: string;
  suggestedCode: string;
  impact: {
    throughputGain: number;
    performanceGain: string;
    reliabilityImprovement: string;
  };
  implementationSteps: string[];
  rollbackPlan: string;
}


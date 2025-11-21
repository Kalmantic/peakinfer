/**
 * Optimization Suggestion Type Definitions
 * Types for code-level optimization suggestions and recommendations
 */

import { CodebaseAnalysis } from './codebase.js';
import { DiscoveryResult } from './multi-agent.js';
import { OptimizationTemplate } from './template.js';

/**
 * Complete optimization suggestion
 */
export interface OptimizationSuggestion {
  id: string;
  title: string;
  layer: 'application' | 'serving' | 'infrastructure' | 'code' | 'cross-layer';
  category: string;
  description: string;
  template_id?: string;
  
  // Code-specific details
  affectedFiles: AffectedFile[];
  codeSnippets: CodeSnippet[];
  
  // Economics
  estimatedMonthlySavings: number;
  estimatedAnnualSavings: number;
  implementationComplexity: 'low' | 'medium' | 'high';
  implementationTimeHours: number;
  roi: number;
  confidence: number;
  
  // Implementation
  implementationSteps: string[];
  requiredChanges: RequiredChange[];
  prerequisites: string[];
  rollbackPlan: string;
  
  // Prioritization
  priorityScore: number;
  priorityLevel: 'critical' | 'high' | 'medium' | 'low';
  
  // Metadata
  detectedAt: string;
  templateSource?: OptimizationTemplate;
}

/**
 * File affected by an optimization
 */
export interface AffectedFile {
  path: string;
  language: string;
  linesAffected: number;
  changesRequired: number;
  complexity: 'low' | 'medium' | 'high';
}

/**
 * Code snippet with before/after
 */
export interface CodeSnippet {
  file: string;
  startLine: number;
  endLine: number;
  language: string;
  currentCode: string;
  suggestedCode: string;
  explanation: string;
  category: 'add' | 'modify' | 'remove' | 'refactor';
}

/**
 * Required code change
 */
export interface RequiredChange {
  file: string;
  lineNumber: number;
  changeType: 'add-import' | 'modify-function' | 'add-caching' | 'add-error-handling' | 'refactor' | 'config-change';
  description: string;
  codeChange: CodeSnippet;
  dependencies: string[];
  testingRequired: boolean;
}

/**
 * Suggestion generation context
 */
export interface SuggestionContext {
  discoveryResult: DiscoveryResult;
  codebaseAnalysis?: CodebaseAnalysis;
  templates: OptimizationTemplate[];
  userConstraints?: UserConstraints;
}

/**
 * User constraints and preferences
 */
export interface UserConstraints {
  maxImplementationTime?: number; // hours
  minROI?: number; // percentage
  allowedLayers?: ('application' | 'serving' | 'infrastructure')[];
  riskTolerance?: 'low' | 'medium' | 'high';
  budgetConstraint?: number; // USD
  qualityThreshold?: number; // 0-1
}

/**
 * Suggestion filter criteria
 */
export interface SuggestionFilter {
  layers?: string[];
  minSavings?: number;
  maxComplexity?: 'low' | 'medium' | 'high';
  minConfidence?: number;
  categories?: string[];
}

/**
 * Suggestion report
 */
export interface SuggestionReport {
  summary: SuggestionSummary;
  suggestions: OptimizationSuggestion[];
  metadata: {
    generatedAt: string;
    totalSuggestions: number;
    totalEstimatedSavings: number;
    averageROI: number;
    codebaseScanned: string;
  };
}

/**
 * Suggestion summary statistics
 */
export interface SuggestionSummary {
  totalOpportunities: number;
  byLayer: Record<string, number>;
  byPriority: Record<string, number>;
  totalMonthlySavings: number;
  totalAnnualSavings: number;
  averageImplementationTime: number;
  quickWins: OptimizationSuggestion[]; // high ROI, low effort
  strategicInitiatives: OptimizationSuggestion[]; // high impact, higher effort
}

/**
 * Interactive suggestion selection
 */
export interface SuggestionSelection {
  suggestionId: string;
  selected: boolean;
  notes?: string;
  scheduledFor?: string;
  assignedTo?: string;
}

/**
 * Suggestion execution result
 */
export interface SuggestionExecutionResult {
  suggestionId: string;
  status: 'success' | 'partial' | 'failed' | 'skipped';
  appliedChanges: AppliedChange[];
  actualSavings?: number;
  executionTime: number;
  errors: string[];
  rollbackAvailable: boolean;
}

/**
 * Applied code change
 */
export interface AppliedChange {
  file: string;
  changeType: string;
  linesChanged: number;
  backupPath?: string;
  verified: boolean;
}


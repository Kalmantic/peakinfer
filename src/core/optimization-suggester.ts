/**
 * Optimization Suggester
 * Generates actionable code-level optimization suggestions
 * Matches codebase patterns against community templates
 * Uses AI for contextual analysis
 */

import Anthropic from '@anthropic-ai/sdk';
import { CodebaseAnalysis, LLMAPICall, CachingOpportunity } from '../types/codebase.js';
import { DiscoveryResult } from '../types/multi-agent.js';
import { OptimizationTemplate } from '../types/template.js';
import {
  OptimizationSuggestion,
  CodeSnippet,
  AffectedFile,
  RequiredChange,
  SuggestionContext,
  SuggestionReport,
  SuggestionSummary
} from '../types/suggestions.js';
import fs from 'fs-extra';
import * as path from 'path';

export class OptimizationSuggester {
  private anthropic: Anthropic;
  private model: string = 'claude-sonnet-4-5-20250929';
  private maxTokens: number = 4096;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.ANTHROPIC_API_KEY;
    if (!key) {
      throw new Error('ANTHROPIC_API_KEY required for optimization suggestions');
    }
    this.anthropic = new Anthropic({ apiKey: key });
  }

  /**
   * Generate comprehensive optimization suggestions
   */
  async generateSuggestions(context: SuggestionContext): Promise<SuggestionReport> {
    console.log('\n💡 Generating optimization suggestions...\n');

    const suggestions: OptimizationSuggestion[] = [];

    // 1. Generate code-level suggestions from codebase analysis
    if (context.codebaseAnalysis) {
      console.log('  📝 Analyzing codebase patterns...');
      const codeSuggestions = await this.generateCodeLevelSuggestions(context);
      suggestions.push(...codeSuggestions);
    }

    // 2. Match patterns against templates
    console.log('  🎯 Matching against community templates...');
    const templateSuggestions = await this.matchTemplatesToContext(context);
    suggestions.push(...templateSuggestions);

    // 3. Use AI for contextual analysis
    console.log('  analyzing for contextual recommendations...');
    const aiSuggestions = await this.generateAIRecommendations(context);
    suggestions.push(...aiSuggestions);

    // 4. Calculate ROI and prioritize
    console.log('  📊 Calculating ROI and prioritizing...');
    const prioritizedSuggestions = this.prioritizeSuggestions(suggestions);

    // 5. Generate report
    const report = this.generateReport(prioritizedSuggestions, context);

    console.log(`\n  ✅ Generated ${prioritizedSuggestions.length} optimization suggestions\n`);

    return report;
  }

  /**
   * Generate code-level suggestions from codebase analysis
   */
  private async generateCodeLevelSuggestions(context: SuggestionContext): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];
    const codebase = context.codebaseAnalysis;

    if (!codebase) return suggestions;

    // Suggestion 1: Add caching where missing
    for (const opportunity of codebase.cachingOpportunities) {
      suggestions.push({
        id: `caching-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: 'Implement Semantic Caching',
        layer: 'application',
        category: 'caching',
        description: `Add semantic caching to reduce redundant LLM calls in ${path.basename(opportunity.file)}`,
        template_id: 'semantic-caching-optimization',
        affectedFiles: [{
          path: opportunity.file,
          language: 'unknown',
          linesAffected: opportunity.affectedCalls * 3,
          changesRequired: 1,
          complexity: opportunity.implementationComplexity
        }],
        codeSnippets: await this.generateCachingCodeSnippet(opportunity, codebase),
        estimatedMonthlyGain: opportunity.estimatedGain,
        estimatedAnnualGain: opportunity.estimatedGain * 12,
        implementationComplexity: opportunity.implementationComplexity,
        implementationTimeHours: opportunity.implementationComplexity === 'low' ? 4 : opportunity.implementationComplexity === 'medium' ? 8 : 16,
        roi: (opportunity.estimatedGain * 12) / (200 * (opportunity.implementationComplexity === 'low' ? 4 : 8)),
        confidence: opportunity.confidence,
        implementationSteps: [
          'Install semantic caching library (e.g., Redis + embeddings)',
          'Initialize cache client in application',
          'Wrap LLM API calls with cache check',
          'Configure cache TTL and similarity threshold',
          'Monitor cache hit rates'
        ],
        requiredChanges: [],
        prerequisites: ['Redis server', 'Embedding model for semantic similarity'],
        rollbackPlan: 'Remove cache wrapper, revert to direct API calls',
        priorityScore: this.calculatePriorityScore(opportunity.estimatedGain, opportunity.implementationComplexity, opportunity.confidence),
        priorityLevel: opportunity.estimatedGain > 1000 ? 'high' : opportunity.estimatedGain > 500 ? 'medium' : 'low',
        detectedAt: new Date().toISOString()
      });
    }

    // Suggestion 2: Add error handling
    const callsWithoutErrorHandling = codebase.llmApiCalls.filter(call => !call.hasErrorHandling);
    if (callsWithoutErrorHandling.length > 0) {
      // Group by file
      const byFile = new Map<string, LLMAPICall[]>();
      for (const call of callsWithoutErrorHandling) {
        if (!byFile.has(call.file)) {
          byFile.set(call.file, []);
        }
        byFile.get(call.file)!.push(call);
      }

      for (const [file, calls] of byFile.entries()) {
        const monthlyGain = 100 * calls.length;
        suggestions.push({
          id: `error-handling-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          title: 'Add Error Handling for LLM Calls',
          layer: 'code',
          category: 'reliability',
          description: `Add comprehensive error handling for ${calls.length} LLM API calls in ${path.basename(file)}`,
          affectedFiles: [{
            path: file,
            language: calls[0].language,
            linesAffected: calls.length * 5,
            changesRequired: calls.length,
            complexity: 'low'
          }],
          codeSnippets: await this.generateErrorHandlingSnippet(calls[0]),
          estimatedMonthlyGain: monthlyGain,
          estimatedAnnualGain: monthlyGain * 12,
          implementationComplexity: 'low',
          implementationTimeHours: 2,
          roi: (monthlyGain * 12) / (200 * 2),
          confidence: 0.9,
          implementationSteps: [
            'Wrap LLM calls in try-catch blocks',
            'Add retry logic with exponential backoff',
            'Implement fallback responses',
            'Log errors for monitoring',
            'Add timeout handling'
          ],
          requiredChanges: [],
          prerequisites: [],
          rollbackPlan: 'Remove try-catch wrappers if causing issues',
          priorityScore: this.calculatePriorityScore(monthlyGain, 'low', 0.9),
          priorityLevel: 'medium',
          detectedAt: new Date().toISOString()
        });
      }
    }

    // Suggestion 3: Code-level optimizations
    for (const optimization of codebase.optimizationOpportunities) {
      if (optimization.type === 'caching' && optimization.templateId) {
        // Already handled above
        continue;
      }

      suggestions.push({
        id: `code-opt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: `${optimization.type} Optimization`,
        layer: 'code',
        category: optimization.type,
        description: optimization.description,
        template_id: optimization.templateId,
        affectedFiles: [{
          path: optimization.file,
          language: 'unknown',
          linesAffected: 10,
          changesRequired: 1,
          complexity: optimization.implementationEffort
        }],
        codeSnippets: [{
          file: optimization.file,
          startLine: optimization.lineNumber,
          endLine: optimization.lineNumber + 5,
          language: 'unknown',
          currentCode: optimization.currentCode,
          suggestedCode: optimization.suggestedCode || '// See template for implementation',
          explanation: optimization.description,
          category: 'modify'
        }],
        estimatedMonthlyGain: optimization.estimatedGain,
        estimatedAnnualGain: optimization.estimatedGain * 12,
        implementationComplexity: optimization.implementationEffort,
        implementationTimeHours: optimization.implementationEffort === 'low' ? 2 : optimization.implementationEffort === 'medium' ? 6 : 12,
        roi: (optimization.estimatedGain * 12) / (200 * (optimization.implementationEffort === 'low' ? 2 : 6)),
        confidence: 0.75,
        implementationSteps: ['Review code', 'Apply optimization', 'Test changes', 'Monitor results'],
        requiredChanges: [],
        prerequisites: [],
        rollbackPlan: 'Revert code changes',
        priorityScore: this.calculatePriorityScore(optimization.estimatedGain, optimization.implementationEffort, 0.75),
        priorityLevel: optimization.priority,
        detectedAt: new Date().toISOString()
      });
    }

    return suggestions;
  }

  /**
   * Match community templates to context
   */
  private async matchTemplatesToContext(context: SuggestionContext): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];

    // Match templates based on discovered opportunities
    for (const template of context.templates) {
      // Check if template matches discovered patterns
      const matchScore = this.calculateTemplateMatch(template, context);

      if (matchScore > 0.5) {
        suggestions.push({
          id: `template-${template.id}-${Date.now()}`,
          title: template.name,
          layer: this.mapTemplateCategory(template.category),
          category: template.category,
          description: template.description,
          template_id: template.id,
          affectedFiles: [], // Will be populated by AI analysis
          codeSnippets: [],
          estimatedMonthlyGain: this.estimateTemplateGain(template, context),
          estimatedAnnualGain: this.estimateTemplateGain(template, context) * 12,
          implementationComplexity: template.optimization.risk_level as any,
          implementationTimeHours: this.parseEffortEstimate(template.optimization.effort_estimate),
          roi: 0, // Will be calculated
          confidence: template.confidence * matchScore,
          implementationSteps: template.implementation.automated_steps.map(step => step.name),
          requiredChanges: [],
          prerequisites: template.implementation.prerequisites.map(p => p.requirement),
          rollbackPlan: 'Follow template rollback procedures',
          priorityScore: 0, // Will be calculated
          priorityLevel: 'medium',
          detectedAt: new Date().toISOString(),
          templateSource: template
        });
      }
    }

    return suggestions;
  }

  /**
   * Generate AI-powered recommendations
   */
  private async generateAIRecommendations(context: SuggestionContext): Promise<OptimizationSuggestion[]> {
    const systemPrompt = `You are an expert LLM optimization consultant. Analyze the codebase and runtime data to provide actionable optimization recommendations.

Focus on:
1. High-ROI optimizations with clear cost savings
2. Low-risk improvements that can be implemented quickly
3. Code-level improvements specific to files and lines
4. Template-backed strategies from the community

Provide specific, actionable suggestions with:
- Exact file paths and line numbers
- Before/after code examples
- Estimated savings calculations
- Implementation steps`;

    const codebaseContext = context.codebaseAnalysis ? `
## Codebase Analysis:
- ${context.codebaseAnalysis.codeMetrics.totalLLMCalls} LLM API calls across ${context.codebaseAnalysis.codeMetrics.filesWithLLMCalls} files
- Languages: ${context.codebaseAnalysis.codeMetrics.codebaseLanguages.join(', ')}
- ${context.codebaseAnalysis.cachingOpportunities.length} files without caching
- ${context.codebaseAnalysis.optimizationOpportunities.length} code-level optimizations identified

Top API Calls:
${context.codebaseAnalysis.llmApiCalls.slice(0, 5).map(call => 
  `- ${call.file}:${call.lineNumber} - ${call.apiProvider} ${call.model || ''} - ${call.hasCaching ? 'cached' : 'NO CACHE'}`
).join('\n')}
` : '';

    const prompt = `Analyze this LLM infrastructure and provide 3-5 top optimization recommendations:

${codebaseContext}

## Runtime Data:
${JSON.stringify(context.discoveryResult.configSummary, null, 2)}

## Available Templates:
${context.templates.slice(0, 5).map(t => `- ${t.id}: ${t.name} (${t.optimization.expected_throughput_improvement})`).join('\n')}

Provide recommendations as a JSON array with format:
[{
  "title": "string",
  "description": "string",  
  "category": "caching|routing|error-handling|etc",
  "affectedFiles": ["file paths"],
  "estimatedMonthlySavings": number,
  "implementationHours": number,
  "priority": "high|medium|low",
  "implementationSteps": ["step1", "step2"],
  "templateId": "optional-template-id"
}]`;

    try {
      const response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }]
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        return [];
      }

      // Parse AI response
      const jsonMatch = content.text.match(/```json\s*([\s\S]*?)\s*```/) || content.text.match(/\[([\s\S]*?)\]/);
      if (!jsonMatch) {
        return [];
      }

      const recommendations = JSON.parse(jsonMatch[1] || jsonMatch[0]);

      return recommendations.map((rec: any) => ({
        id: `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: rec.title,
        layer: 'application' as const,
        category: rec.category,
        description: rec.description,
        template_id: rec.templateId,
        affectedFiles: rec.affectedFiles?.map((f: string) => ({
          path: f,
          language: 'unknown',
          linesAffected: 20,
          changesRequired: 1,
          complexity: 'medium' as const
        })) || [],
        codeSnippets: [],
        estimatedMonthlyGain: rec.estimatedMonthlySavings || rec.estimatedMonthlyGain || 1000,
        estimatedAnnualGain: (rec.estimatedMonthlySavings || rec.estimatedMonthlyGain || 1000) * 12,
        implementationComplexity: 'medium' as const,
        implementationTimeHours: rec.implementationHours || 8,
        roi: ((rec.estimatedMonthlySavings || rec.estimatedMonthlyGain || 1000) * 12) / (200 * (rec.implementationHours || 8)),
        confidence: 0.8,
        implementationSteps: rec.implementationSteps || [],
        requiredChanges: [],
        prerequisites: [],
        rollbackPlan: 'Follow standard rollback procedures',
        priorityScore: 0,
        priorityLevel: rec.priority || 'medium',
        detectedAt: new Date().toISOString()
      }));

    } catch (error) {
      console.warn('  warning: AI recommendations failed:', error instanceof Error ? error.message : String(error));
      return [];
    }
  }

  /**
   * Prioritize suggestions by impact and effort
   */
  private prioritizeSuggestions(suggestions: OptimizationSuggestion[]): OptimizationSuggestion[] {
    return suggestions
      .map(s => ({
        ...s,
        roi: s.estimatedAnnualGain / (200 * s.implementationTimeHours),
        priorityScore: this.calculatePriorityScore(
          s.estimatedMonthlyGain,
          s.implementationComplexity,
          s.confidence
        )
      }))
      .sort((a, b) => b.priorityScore - a.priorityScore);
  }

  /**
   * Calculate priority score (0-100)
   */
  private calculatePriorityScore(
    gain: number,
    complexity: 'low' | 'medium' | 'high',
    confidence: number
  ): number {
    const gainScore = Math.min(gain / 100, 50); // Max 50 points for gain
    const complexityScore = complexity === 'low' ? 30 : complexity === 'medium' ? 20 : 10;
    const confidenceScore = confidence * 20; // Max 20 points for confidence

    return Math.min(gainScore + complexityScore + confidenceScore, 100);
  }

  /**
   * Generate report
   */
  private generateReport(suggestions: OptimizationSuggestion[], context: SuggestionContext): SuggestionReport {
    // Calculate quick wins and strategic initiatives
    const quickWins = suggestions.filter(s =>
      s.implementationComplexity === 'low' && s.roi > 10
    );

    const strategicInitiatives = suggestions.filter(s =>
      s.estimatedMonthlyGain > 1000 || s.layer === 'cross-layer'
    );

    const summary: SuggestionSummary = {
      totalOpportunities: suggestions.length,
      byLayer: this.groupByLayer(suggestions),
      byPriority: this.groupByPriority(suggestions),
      totalMonthlyGain: suggestions.reduce((sum, s) => sum + s.estimatedMonthlyGain, 0),
      totalAnnualGain: suggestions.reduce((sum, s) => sum + s.estimatedAnnualGain, 0),
      averageImplementationTime: suggestions.reduce((sum, s) => sum + s.implementationTimeHours, 0) / suggestions.length,
      quickWins: quickWins.slice(0, 5),
      strategicInitiatives: strategicInitiatives.slice(0, 5)
    };

    return {
      summary,
      suggestions,
      metadata: {
        generatedAt: new Date().toISOString(),
        totalSuggestions: suggestions.length,
        totalEstimatedGain: summary.totalMonthlyGain,
        averageROI: suggestions.reduce((sum, s) => sum + s.roi, 0) / suggestions.length,
        codebaseScanned: context.codebaseAnalysis ? context.discoveryResult.metadata.codebase_path || 'Yes' : 'No'
      }
    };
  }

  // Helper methods

  private async generateCachingCodeSnippet(opportunity: CachingOpportunity, codebase: CodebaseAnalysis): Promise<CodeSnippet[]> {
    const calls = codebase.llmApiCalls.filter(call => call.file === opportunity.file);
    if (calls.length === 0) return [];

    const firstCall = calls[0];
    return [{
      file: opportunity.file,
      startLine: opportunity.lineNumber,
      endLine: opportunity.lineNumber + 10,
      language: firstCall.language,
      currentCode: firstCall.context,
      suggestedCode: `// Add caching wrapper\nconst cache = new SemanticCache();\nconst cachedResult = await cache.get(prompt);\nif (cachedResult) return cachedResult;\n\n${firstCall.callPattern}\n\nawait cache.set(prompt, result);`,
      explanation: 'Add semantic caching to reduce redundant API calls',
      category: 'add'
    }];
  }

  private async generateErrorHandlingSnippet(call: LLMAPICall): Promise<CodeSnippet[]> {
    return [{
      file: call.file,
      startLine: call.lineNumber,
      endLine: call.lineEnd,
      language: call.language,
      currentCode: call.callPattern,
      suggestedCode: `try {\n  ${call.callPattern}\n} catch (error) {\n  console.error('LLM API error:', error);\n  // Implement retry logic or fallback\n  throw error;\n}`,
      explanation: 'Add error handling to prevent unhandled failures',
      category: 'modify'
    }];
  }

  private calculateTemplateMatch(template: OptimizationTemplate, context: SuggestionContext): number {
    let score = 0.5; // Base score

    // Check environment match
    if (context.codebaseAnalysis) {
      const envMatch = template.environment_match;
      if (envMatch.runtime) {
        const runtimes = Array.isArray(envMatch.runtime) ? envMatch.runtime : [envMatch.runtime];
        if (context.discoveryResult.configSummary.application.runtimes.some(r => runtimes.includes(r))) {
          score += 0.2;
        }
      }
    }

    return Math.min(score, 1.0);
  }

  private estimateTemplateGain(template: OptimizationTemplate, context: SuggestionContext): number {
    // Parse expected throughput improvement
    const improvement = template.optimization.expected_throughput_improvement || '20-40%';
    const match = improvement.match(/(\d+)-?(\d+)?%?/);
    if (!match) return 1000;

    const percentage = parseInt(match[1]) / 100;
    const totalThroughput = context.discoveryResult.configSummary.application.total_monthly_throughput;

    return totalThroughput * percentage;
  }

  private parseEffortEstimate(effort: string): number {
    const match = effort.match(/(\d+)/);
    return match ? parseInt(match[1]) * 8 : 8; // Convert days to hours
  }

  private mapTemplateCategory(category: string): 'application' | 'serving' | 'infrastructure' | 'code' | 'cross-layer' {
    if (category.includes('application') || category.includes('caching') || category.includes('routing')) {
      return 'application';
    }
    if (category.includes('serving') || category.includes('runtime')) {
      return 'serving';
    }
    if (category.includes('infrastructure') || category.includes('hardware')) {
      return 'infrastructure';
    }
    if (category.includes('cross')) {
      return 'cross-layer';
    }
    return 'code';
  }

  private groupByLayer(suggestions: OptimizationSuggestion[]): Record<string, number> {
    const grouped: Record<string, number> = {};
    for (const suggestion of suggestions) {
      grouped[suggestion.layer] = (grouped[suggestion.layer] || 0) + 1;
    }
    return grouped;
  }

  private groupByPriority(suggestions: OptimizationSuggestion[]): Record<string, number> {
    const grouped: Record<string, number> = {};
    for (const suggestion of suggestions) {
      grouped[suggestion.priorityLevel] = (grouped[suggestion.priorityLevel] || 0) + 1;
    }
    return grouped;
  }
}


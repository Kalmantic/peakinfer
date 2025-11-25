/**
 * Multi-Agent Orchestrator
 * Coordinates the 4 specialized agents for LLM inference optimization
 * Based on PRD v0.7 Section 3: Multi-Agent Claude Integration
 */

import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs-extra';
import * as yaml from 'yaml';
import { 
  DiscoveryResult, 
  OptimizationPlan, 
  EvaluationResult, 
  AuditReport,
  ProfileResult,
  ApplicationSummary,
  ServingSummary,
  InfrastructureSummary,
  WorkloadProfile,
  OptimizationOpportunity,
  PerformanceBaseline,
  GPUSummary,
  UtilizationMetrics,
  TrafficDistribution,
  QualityRequirement,
  CostDriver
} from '../types/multi-agent.js';
import { InferenceEvent } from '../types/events.js';
import { OptimizationTemplate } from '../types/template.js';
import { CodebaseAnalysis } from '../types/codebase.js';
import { jsonrepair } from 'jsonrepair';
import { CodebaseCollector } from '../collectors/codebase-collector.js';

interface DiscoveryParseContext {
  mergedData: any;
  codebaseAnalysis?: CodebaseAnalysis | null;
}

interface OrchestratorOptions {
  verbose?: boolean;
}

export class MultiAgentOrchestrator {
  private anthropic: Anthropic;
  private maxTokens: number = 16000;
  private model: string = 'claude-sonnet-4-5-20250929';
  private verbose: boolean;

  constructor(apiKey?: string, options?: OrchestratorOptions) {
    const key = apiKey || process.env.ANTHROPIC_API_KEY;
    if (!key) {
      throw new Error('ANTHROPIC_API_KEY not found. Please set it in your environment or pass it to the constructor.');
    }
    
    this.anthropic = new Anthropic({ apiKey: key });
    this.verbose = Boolean(options?.verbose);
    this.logVerbose('MultiAgentOrchestrator initialized', {
      model: this.model,
      maxTokens: this.maxTokens,
    });
  }

  /**
   * Run Codebase Analyzer
   * Scans target codebase to identify LLM API calls, configurations, and optimization opportunities
   */
  async runCodebaseAnalyzer(codebasePath: string): Promise<CodebaseAnalysis> {
    console.log(`\n🔍 Running Codebase Analyzer on: ${codebasePath}`);
    this.logVerbose('Codebase analyzer started', { codebasePath });
    
    const collector = new CodebaseCollector({
      rootPath: codebasePath,
      scanDepth: 'normal'
    });
    
    const analysis = await collector.analyzeCodebase();
    this.logVerbose('Codebase analysis complete', {
      totalFiles: analysis.codeMetrics.totalFiles,
      llmCalls: analysis.llmApiCalls.length
    });
    
    // Save analysis to file
    await fs.writeFile('codebase-analysis.yaml', yaml.stringify(analysis), 'utf-8');
    console.log('✅ Codebase analysis saved to codebase-analysis.yaml');
    this.logVerbose('Codebase analysis persisted to codebase-analysis.yaml');
    
    return analysis;
  }

  /**
   * Run Discovery Agent
   * Analyzes merged input data and creates comprehensive discovery summary
   * Now supports optional codebase analysis integration
   */
  async runDiscoveryAgent(inputFiles: string[], codebasePath?: string): Promise<DiscoveryResult> {
    console.log('🔍 Running Discovery Agent...');
    this.logVerbose('Discovery Agent invoked', {
      inputFiles,
      codebasePath: codebasePath ?? null
    });
    
    // Run codebase analysis if path provided
    let codebaseAnalysis: CodebaseAnalysis | null = null;
    if (codebasePath) {
      codebaseAnalysis = await this.runCodebaseAnalyzer(codebasePath);
      this.logVerbose('Codebase analysis attached to discovery payload', {
        totalFiles: codebaseAnalysis.codeMetrics.totalFiles,
        llmCalls: codebaseAnalysis.llmApiCalls.length,
      });
    }
    
    // Merge input data from all sources
    const mergedData = await this.mergeInputData(inputFiles);
    this.logVerbose('Merged input data summary', {
      sources: mergedData.metadata?.sources,
      totalEvents: mergedData.events?.length ?? 0,
    });
    
    const systemPrompt = `You are the Discovery Agent in PeakInfer's multi-agent system. Your role is to analyze infrastructure data AND codebase patterns to create a comprehensive discovery summary.

You combine TWO types of analysis:
1. **Runtime Analysis**: Actual inference events from production/staging (events.jsonl)
2. **Static Code Analysis**: LLM API calls, patterns, and configurations found in source code

Focus on:
1. Infrastructure configuration summary across Application, Serving, and Infrastructure layers
2. Workload pattern analysis from inference events + static code patterns
3. Cost driver identification (actual usage + code-level inefficiencies)
4. Performance bottleneck analysis (runtime + code patterns)
5. Optimization opportunity mapping across all layers
6. Code-level improvements (add caching, optimize API calls, fix inefficient patterns)

Provide structured, actionable analysis that combines both runtime behavior and code implementation details.`;

    // Build codebase context if available
    const codebaseContext = codebaseAnalysis ? `

## Codebase Analysis Results:

**Files Scanned:** ${codebaseAnalysis.codeMetrics.totalFiles}
**LLM API Calls Found:** ${codebaseAnalysis.llmApiCalls.length} calls across ${codebaseAnalysis.codeMetrics.filesWithLLMCalls} files
**Languages Detected:** ${codebaseAnalysis.codeMetrics.codebaseLanguages.join(', ')}

**Provider Distribution:**
${Object.entries(codebaseAnalysis.codeMetrics.providerDistribution).map(([provider, count]) => `- ${provider}: ${count} calls`).join('\n')}

**Caching Opportunities:** ${codebaseAnalysis.cachingOpportunities.length} files without caching
**Optimization Opportunities:** ${codebaseAnalysis.optimizationOpportunities.length} code-level improvements identified
**Configuration Files:** ${codebaseAnalysis.configurationFiles.length} files

**Key Findings:**
${codebaseAnalysis.llmApiCalls.slice(0, 5).map(call => `- ${call.file}:${call.lineNumber} - ${call.apiProvider} (${call.model || 'unknown model'}) - ${call.hasCaching ? 'has caching' : 'NO CACHING'}`).join('\n')}

**Sample Code Patterns:**
${codebaseAnalysis.llmApiCalls.slice(0, 3).map(call => `
File: ${call.file}:${call.lineNumber}
Provider: ${call.apiProvider}
Pattern: ${call.callPattern}
Has Caching: ${call.hasCaching ? 'Yes' : 'No'}
Has Error Handling: ${call.hasErrorHandling ? 'Yes' : 'No'}
`).join('\n')}` : '';

    const prompt = `Analyze this infrastructure data ${codebaseAnalysis ? 'AND codebase patterns' : ''} to create a comprehensive discovery summary:

## Runtime Event Data:
${JSON.stringify(mergedData, null, 2)}
${codebaseContext}

Generate a comprehensive analysis including:

1. **Configuration Summary**:
   - Application layer: Runtimes, model usage, API patterns (from events + code)
   - Serving layer: Frameworks, model formats, performance baseline
   - Infrastructure layer: GPU inventory, utilization, costs

2. **Workload Profile**:
   - Request patterns and traffic distribution (runtime events)
   - Static code patterns (LLM API call locations and frequency)
   - Quality requirements and constraints
   - Cost sensitivity and latency tolerance

3. **Optimization Opportunities** (CRITICAL - Merge runtime + code insights):
   - Application layer: 
     * Caching (especially where code has NO caching but high call volume)
     * Model routing (detect expensive models that could use cheaper alternatives)
     * Prompt optimization
   - Serving layer: Runtime migration, quantization, batching
   - Infrastructure layer: Spot instances, auto-scaling, right-sizing
   - **Code-level improvements**:
     * Files missing error handling for LLM calls
     * Files missing caching layers
     * Redundant or inefficient API call patterns
     * Configuration improvements
   - Cross-layer: Compound optimizations across layers

4. **Cost Drivers**:
   - Runtime cost contributors (from events)
   - Code-level cost contributors (API calls without optimization)
   - Identify top opportunities with estimated savings

5. **Codebase Insights** (if codebase was scanned):
   - Files with highest LLM usage
   - Missing optimizations per file
   - Configuration issues
   - Integration points with Databricks, Snowflake, etc.

Format the output as a structured JSON object matching the DiscoveryResult interface. 
IMPORTANT: Include a 'codebaseInsights' field with CodebaseAnalysis data if codebase was scanned.`;

    try {
      const response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }

      const result = this.parseDiscoveryResult(
        content.text,
        {
          mergedData,
          codebaseAnalysis: codebaseAnalysis || undefined
        }
      );
      this.logVerbose('Discovery agent output parsed successfully', {
        totalOpportunities: result.optimizationOpportunities.length,
        totalEventsAnalyzed: result.metadata.total_events_analyzed,
        codebaseInsights: Boolean(result.codebaseInsights),
      });
      
      // Save to file
      await fs.writeFile('discovered.yaml', yaml.stringify(result), 'utf-8');
      console.log('✅ Discovery complete. Results saved to discovered.yaml');
      if (codebaseAnalysis) {
        console.log('   Including codebase insights from static analysis');
      }
      this.logVerbose('Discovery results persisted to discovered.yaml');
      
      return result;
        } catch (error) {
      console.error('❌ Discovery Agent failed:', error);
      console.warn('⚙️  Falling back to local heuristic discovery using provided data');
      const fallbackResult = this.buildDataDrivenDiscoveryResult({
        mergedData,
        codebaseAnalysis: codebaseAnalysis || undefined
      });
      await fs.writeFile('discovered.yaml', yaml.stringify(fallbackResult), 'utf-8');
      console.log('✅ Discovery fallback complete. Results saved to discovered.yaml');
      this.logVerbose('Fallback discovery result generated');
      return fallbackResult;
    }
  }

  /**
   * Run Profile Agent
   * Clusters inference events into representative workloads
   */
  async runProfileAgent(
    events: InferenceEvent[],
    options?: { clusterMethod?: string }
  ): Promise<ProfileResult> {
    if (!events || events.length === 0) {
      throw new Error('No inference events provided for profiling');
    }

    console.log('📈 Running Profile Agent...');
    const clusterMethod = options?.clusterMethod || 'semantic';
    this.logVerbose('Profile Agent invoked', {
      clusterMethod,
      totalEvents: events.length,
    });
    const stats = this.calculateEventStats(events);
    this.logVerbose('Profile Agent event stats', stats);
    const limitedEvents = events.slice(0, 50); // Sample for prompt context

    const systemPrompt = `You are the Workload Profiler Agent in PeakInfer's multi-agent system.
Your mission is to cluster inference events, identify representative prompts, and provide actionable recommendations.
Output must be valid JSON matching the ProfileResult interface.`;

    const prompt = `Analyze these inference events to create a workload profile:

Cluster Method: ${clusterMethod}
Events Provided (sample of ${events.length}):
${JSON.stringify(limitedEvents, null, 2)}

Aggregate Stats:
- Total events: ${events.length}
- Total cost (sample): $${stats.totalCost.toFixed(2)}
- Average latency: ${stats.avgLatencyMs.toFixed(2)} ms
- Average input tokens: ${stats.avgInputTokens.toFixed(2)}
- Average output tokens: ${stats.avgOutputTokens.toFixed(2)}
- Top intents: ${stats.topIntents.join(', ')}
- Top providers: ${stats.topProviders.join(', ')}

Generate JSON with:
1. metadata (timestamp, events_analyzed, cluster_method, total_clusters, top_intents)
2. workloadStats (totals, averages, peak hours)
3. clusters[] with representative prompts and recommended actions
4. samplePrompts[] (at least 5) referencing cluster IDs
5. recommendations[] with impact and estimated savings

Ensure JSON strictly matches the ProfileResult interface.`;

    try {
      const response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }

      const profile = this.parseProfileResult(content.text);
      await fs.writeFile('profile-report.yaml', yaml.stringify(profile), 'utf-8');
      console.log('✅ Profile complete. Results saved to profile-report.yaml');
      this.logVerbose('Profile report saved to profile-report.yaml', {
        totalClusters: profile.metadata.total_clusters,
        eventsAnalyzed: profile.metadata.events_analyzed,
      });

      return profile;
    } catch (error) {
      console.error('❌ Profile Agent failed:', error);
      throw error;
    }
  }

  /**
   * Run Planner Agent
   * Creates comprehensive optimization plan using discovery results and community templates
   */
  async runPlannerAgent(
    discoveryResult: DiscoveryResult,
    communityTemplates: OptimizationTemplate[]
  ): Promise<OptimizationPlan> {
    console.log('📋 Running Planner Agent...');
    this.logVerbose('Planner Agent invoked', {
      optimizationOpportunities: discoveryResult.optimizationOpportunities.length,
      templatesProvided: communityTemplates.length,
    });

    const systemPrompt = `You are the Planner Agent in PeakInfer's multi-agent system. Your role is to create comprehensive, implementable optimization strategies across all infrastructure layers.

Focus on:
1. Application layer optimizations (caching, routing, prompt optimization)
2. Serving layer optimizations (runtime migration, quantization, batching)
3. Infrastructure layer optimizations (spot instances, reserved capacity, auto-scaling)
4. Cross-layer coordination strategies for compound benefits
5. Implementation sequence and dependencies
6. Risk assessment and rollback procedures
7. Economic impact projections with confidence intervals

Prioritize based on ROI, implementation complexity, and risk.`;

    const prompt = `Create a comprehensive optimization plan using discovery results and community templates:

Discovery Results:
${JSON.stringify(discoveryResult, null, 2)}

Available Community Templates (${communityTemplates.length} templates):
${JSON.stringify(communityTemplates.slice(0, 10).map(t => ({
  id: t.id,
  name: t.name,
  category: t.category,
  expected_savings: t.optimization.expected_cost_reduction,
  confidence: t.confidence,
})), null, 2)}

Create an optimization plan with:

1. **Layer-Specific Optimizations**:
   - Application: Caching strategies, model routing, prompt optimization
   - Serving: Runtime migration (PyTorch → vLLM/TensorRT), quantization, batching
   - Infrastructure: Spot instances, reserved capacity, auto-scaling policies

2. **Cross-Layer Strategies**:
   - Coordination between layers for compound savings
   - Implementation dependencies
   - Synergy opportunities

3. **Implementation Plan**:
   - Phased rollout sequence
   - Prerequisites and dependencies
   - Risk mitigation strategies
   - Rollback procedures

4. **Economic Projections**:
   - Baseline vs optimized costs
   - Expected savings by layer
   - Implementation costs
   - ROI and payback period
   - Confidence intervals

Format the output as a structured JSON object matching the OptimizationPlan interface.`;

    try {
      const response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }

      const plan = this.parseOptimizationPlan(content.text);
      
      // Save to file
      await fs.writeFile('optimization-plan.yaml', yaml.stringify(plan), 'utf-8');
      console.log('✅ Planning complete. Plan saved to optimization-plan.yaml');
      console.log(`💰 Estimated savings: $${(plan.estimatedSavings || 0).toLocaleString()}/month`);
      console.log(`🔧 Implementation complexity: ${plan.implementationComplexity}`);
      this.logVerbose('Planner output summary', {
        estimatedSavings: plan.estimatedSavings,
        applicationLayer: plan.applicationLayer.length,
        servingLayer: plan.servingLayer.length,
        infrastructureLayer: plan.infrastructureLayer.length,
        crossLayer: plan.crossLayerStrategies.length,
      });
      
      return plan;
    } catch (error) {
      console.error('❌ Planner Agent failed:', error);
      throw error;
    }
  }

  /**
   * Run Runner/Evaluator Agent
   * Executes optimization plan with baseline comparison and quality evaluation
   */
  async runRunnerEvaluator(
    plan: OptimizationPlan,
    samplePrompts: any[]
  ): Promise<EvaluationResult> {
    console.log('🏃 Running Runner/Evaluator Agent...');
    this.logVerbose('Runner/Evaluator Agent invoked', {
      planOptimizations: {
        application: plan.applicationLayer.length,
        serving: plan.servingLayer.length,
        infrastructure: plan.infrastructureLayer.length,
        crossLayer: plan.crossLayerStrategies.length,
      },
      samplePrompts: samplePrompts.length,
    });

    const systemPrompt = `You are the Runner/Evaluator Agent in PeakInfer's multi-agent system. Your role is to execute optimizations safely with comprehensive evaluation.

Focus on:
1. Baseline performance measurement
2. Optimization candidate testing with bandit-style early stopping
3. Quality evaluation using LLM judges and rule-based metrics
4. Cost and latency comparison
5. Statistical significance testing
6. Risk assessment based on performance variance

Execute optimizations incrementally and provide detailed evaluation results.`;

    const prompt = `Execute the optimization plan with baseline comparison:

Optimization Plan:
${JSON.stringify(plan, null, 2)}

Sample Prompts for Testing (${samplePrompts.length} samples):
${JSON.stringify(samplePrompts.slice(0, 5), null, 2)}

Execute the following evaluation process:

1. **Baseline Measurement**:
   - Measure current performance (cost, latency, quality)
   - Establish statistical baseline
   - Document current behavior

2. **Optimization Execution**:
   - Apply optimizations incrementally
   - Test each optimization with sample prompts
   - Monitor for quality degradation
   - Early stop if metrics fall below thresholds

3. **Quality Evaluation**:
   - Compare baseline vs optimized responses
   - Use LLM judges to assess quality preservation
   - Apply rule-based quality checks
   - Calculate quality scores

4. **Statistical Analysis**:
   - Calculate statistical significance
   - Determine confidence intervals
   - Assess effect sizes
   - Validate sample size adequacy

5. **Risk Assessment**:
   - Identify performance variance
   - Flag quality degradation
   - Recommend rollback if needed

Format the output as a structured JSON object matching the EvaluationResult interface.`;

    try {
      const response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }

      const evaluation = this.parseEvaluationResult(content.text);
      
      // Save to file
      await fs.writeFile('evaluation-report.yaml', yaml.stringify(evaluation), 'utf-8');
      console.log('✅ Evaluation complete. Results saved to evaluation-report.yaml');
      this.logVerbose('Runner/Evaluator output summary', {
        baselineCost: evaluation.baseline.total_cost,
        optimizedCost: evaluation.optimized.total_cost,
        qualityPreserved: evaluation.qualityEvaluation.overall_quality_preserved,
      });
      
      return evaluation;
    } catch (error) {
      console.error('❌ Runner/Evaluator Agent failed:', error);
      throw error;
    }
  }

  /**
   * Run Auditor Agent
   * Generates final recommendations and implementation artifacts
   */
  async runAuditorAgent(evaluationResults: EvaluationResult): Promise<AuditReport> {
    console.log('📊 Running Auditor Agent...');
    this.logVerbose('Auditor Agent invoked', {
      baselineCost: evaluationResults.baseline.total_cost,
      optimizedCost: evaluationResults.optimized.total_cost,
      qualityPreserved: evaluationResults.qualityEvaluation.overall_quality_preserved,
    });

    const systemPrompt = `You are the Auditor Agent in PeakInfer's multi-agent system. Your role is to generate comprehensive implementation artifacts and business reporting.

Focus on:
1. Executive summary of optimization results
2. Detailed cost savings breakdown
3. Implementation artifacts (router configs, terraform diffs, cache settings)
4. Monitoring and alerting recommendations
5. Rollback procedures and risk mitigation
6. Community contribution report for template validation

Format outputs for both technical implementation and business reporting.`;

    const prompt = `Generate final recommendations and implementation artifacts:

Evaluation Results:
${JSON.stringify(evaluationResults, null, 2)}

Generate comprehensive audit report including:

1. **Executive Summary**:
   - Total cost savings and ROI
   - Payback period
   - Quality preservation status
   - Key achievements
   - Next steps

2. **Detailed Results**:
   - Savings by layer (Application, Serving, Infrastructure)
   - Cross-layer synergy benefits
   - Performance improvements
   - Cost breakdown

3. **Implementation Artifacts**:
   - Router configuration files
   - Cache configuration
   - Terraform diffs for infrastructure changes
   - Serving framework configs
   - Deployment scripts

4. **Monitoring Recommendations**:
   - Key metrics to track
   - Alert thresholds
   - Dashboard configurations
   - Rollback triggers

5. **Community Contribution**:
   - Implementation reports for templates used
   - Lessons learned
   - Template improvement suggestions

Format the output as a structured JSON object matching the AuditReport interface.`;

    try {
      const response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }

      const report = this.parseAuditReport(content.text);
      
      // Save implementation artifacts
      await this.generateImplementationArtifacts(report);
      await this.generateCommunityContribution(report);
      
      // Save final report
      await fs.writeFile('audit-report.yaml', yaml.stringify(report), 'utf-8');
      console.log('✅ Audit complete. Report saved to audit-report.yaml');
      this.logVerbose('Audit report summary', report.executiveSummary);
      
      return report;
    } catch (error) {
      console.error('❌ Auditor Agent failed:', error);
      throw error;
    }
  }

  private logVerbose(message: string, data?: unknown): void {
    if (!this.verbose) {
      return;
    }
    if (typeof data !== 'undefined') {
      console.log('[orchestrator]', message, data);
      return;
    }
    console.log('[orchestrator]', message);
  }

  /**
   * Merge input data from multiple sources
   */
  private async mergeInputData(inputFiles: string[]): Promise<any> {
    const merged: any = {
      events: [],
      infrastructure: {},
      metadata: {
        sources: [],
        total_files: inputFiles.length,
      },
    };

    for (const file of inputFiles) {
      try {
        if (await fs.pathExists(file)) {
          const ext = file.split('.').pop()?.toLowerCase();
          this.logVerbose('Merging input file', { file, ext });
          
          if (ext === 'jsonl') {
            const content = await fs.readFile(file, 'utf-8');
            const events = content
              .trim()
              .split('\n')
              .filter(line => line.trim())
              .map(line => JSON.parse(line));
            merged.events.push(...events);
            merged.metadata.sources.push(file);
            this.logVerbose('Appended JSONL events', { file, events: events.length });
          } else if (ext === 'json') {
            const content = await fs.readJson(file);
            if (Array.isArray(content)) {
              merged.events.push(...content);
              this.logVerbose('Appended JSON events', { file, events: content.length });
            } else if (content.resources) {
              merged.infrastructure = content;
              this.logVerbose('Loaded infrastructure JSON', { file, resourceCount: Object.keys(content.resources).length });
            } else {
              merged.events.push(content);
              this.logVerbose('Appended single JSON event', { file });
            }
            merged.metadata.sources.push(file);
          } else if (ext === 'yaml' || ext === 'yml') {
            const content = await fs.readFile(file, 'utf-8');
            const data = yaml.parse(content);
            if (data.resources) {
              merged.infrastructure = data;
              this.logVerbose('Loaded infrastructure YAML', { file, resourceCount: Object.keys(data.resources).length });
            }
            merged.metadata.sources.push(file);
          }
        } else {
          this.logVerbose('Input file not found, skipping', { file });
        }
      } catch (error) {
        console.warn(`⚠️  Failed to load ${file}:`, error instanceof Error ? error.message : String(error));
        this.logVerbose('Failed to process input file', {
          file,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    this.logVerbose('Input merging complete', {
      totalEvents: merged.events.length,
      sources: merged.metadata.sources,
    });

    return merged;
  }

  /**
   * Parse discovery result from Claude response
   */
  private parseDiscoveryResult(text: string, context: DiscoveryParseContext): DiscoveryResult {
    try {
      const { mergedData, codebaseAnalysis } = context;
      const jsonText = this.extractJsonPayload(text) ?? text.trim();
      const parsed = this.safeJsonParse(jsonText);
      
      // Validate and provide defaults
      const result: DiscoveryResult = {
        configSummary: parsed.configSummary || this.buildApplicationFirstConfigSummary(mergedData?.events || []),
        workloadProfile: parsed.workloadProfile || this.buildBaselineWorkloadProfile(mergedData?.events || []),
        optimizationOpportunities: parsed.optimizationOpportunities || [],
        codebaseInsights: codebaseAnalysis || parsed.codebaseInsights,
        metadata: parsed.metadata || {
          timestamp: new Date().toISOString(),
          sources: mergedData?.metadata?.sources || [],
          total_events_analyzed: mergedData?.events?.length || 0,
          time_range: { 
            start: this.extractTimeBoundary(mergedData?.events || [], 'start'),
            end: this.extractTimeBoundary(mergedData?.events || [], 'end')
          },
          codebase_scanned: !!codebaseAnalysis,
          codebase_path: codebaseAnalysis ? 'codebase-analysis.yaml' : undefined,
        },
      };
      
      return result;
    } catch (error) {
      console.error('Failed to parse discovery result, generating data-driven fallback:', error instanceof Error ? error.message : error);
      return this.buildDataDrivenDiscoveryResult(context);
    }
  }

  /**
   * Extract the JSON payload from the LLM response.
   * Handles fenced code blocks and scans for the first balanced object.
   */
  private extractJsonPayload(text: string): string | null {
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (codeBlockMatch?.[1]) {
      return codeBlockMatch[1].trim();
    }
    
    const firstBrace = text.indexOf('{');
    if (firstBrace === -1) {
      return null;
    }

    let depth = 0;
    let inString = false;
    let escapeNext = false;

    for (let i = firstBrace; i < text.length; i++) {
      const char = text[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === '\\') {
        escapeNext = true;
        continue;
      }

      if (char === '"' && text[i - 1] !== '\\') {
        inString = !inString;
      }

      if (inString) {
        continue;
      }

      if (char === '{') {
        depth++;
      } else if (char === '}') {
        depth--;
        if (depth === 0) {
          return text.slice(firstBrace, i + 1).trim();
        }
      }
    }

    return null;
  }

  /**
   * Attempt to parse JSON while applying light repairs for common LLM formatting issues.
   */
  private safeJsonParse(text: string): any {
    try {
      return JSON.parse(text);
    } catch (error) {
      try {
        const repairedWithLibrary = jsonrepair(text);
        return JSON.parse(repairedWithLibrary);
      } catch {
        const repaired = this.repairJsonText(text);
        return JSON.parse(repaired);
      }
    }
  }

  /**
   * Apply conservative fixes to JSON-like text:
   * - normalize smart quotes
   * - remove trailing commas before } or ]
   */
  private repairJsonText(text: string): string {
    let repaired = text
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/,\s*([}\]])/g, '$1')
      .trim();

    // If text starts or ends with code fences after previous steps, strip them.
    if (repaired.startsWith('```')) {
      const fenceIndex = repaired.indexOf('\n');
      if (fenceIndex !== -1) {
        repaired = repaired.slice(fenceIndex + 1);
      }
      repaired = repaired.replace(/```$/, '').trim();
    }

    return repaired;
  }

  /**
   * Parse profile result from Claude response
   */
  private parseProfileResult(text: string): ProfileResult {
    try {
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;
      const parsed = JSON.parse(jsonText);

      return {
        metadata: parsed.metadata || {
          timestamp: new Date().toISOString(),
          events_analyzed: 0,
          cluster_method: 'semantic',
          total_clusters: 0,
          top_intents: [],
        },
        workloadStats: parsed.workloadStats || {
          total_events: 0,
          total_cost: 0,
          avg_latency_ms: 0,
          avg_input_tokens: 0,
          avg_output_tokens: 0,
        },
        clusters: parsed.clusters || [],
        samplePrompts: parsed.samplePrompts || [],
        recommendations: parsed.recommendations || [],
      };
    } catch (error) {
      console.error('Failed to parse profile result, using mock data');
      return this.getMockProfileResult();
    }
  }

  /**
   * Parse optimization plan from Claude response
   */
  private parseOptimizationPlan(text: string): OptimizationPlan {
    try {
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;
      
      const parsed = JSON.parse(jsonText);
      
      const economicProjections = parsed.economicProjections || {};
      
      return {
        applicationLayer: parsed.applicationLayer || [],
        servingLayer: parsed.servingLayer || [],
        infrastructureLayer: parsed.infrastructureLayer || [],
        crossLayerStrategies: parsed.crossLayerStrategies || [],
        estimatedSavings: parsed.estimatedSavings || 0,
        implementationComplexity: parsed.implementationComplexity || 'moderate',
        implementationSequence: parsed.implementationSequence || [],
        riskAssessment: parsed.riskAssessment || {},
        economicProjections: {
          baseline_monthly_cost: economicProjections.baseline_monthly_cost || 0,
          optimized_monthly_cost: economicProjections.optimized_monthly_cost || 0,
          monthly_savings: economicProjections.monthly_savings || 0,
          annual_savings: economicProjections.annual_savings || 0,
          implementation_cost: economicProjections.implementation_cost || 0,
          payback_period_months: economicProjections.payback_period_months || 0,
          roi_percentage: economicProjections.roi_percentage || 0,
          confidence_interval: economicProjections.confidence_interval || {
            lower_bound: 0,
            upper_bound: 0,
            confidence_level: 0.95,
          },
        },
        metadata: parsed.metadata || {
          created_at: new Date().toISOString(),
          discovery_id: '',
          templates_used: [],
          confidence_score: 0.7,
        },
      };
    } catch (error) {
      console.error('Failed to parse optimization plan, using mock data');
      return this.getMockOptimizationPlan();
    }
  }

  /**
   * Parse evaluation result from Claude response
   */
  private parseEvaluationResult(text: string): EvaluationResult {
    try {
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;
      
      const parsed = JSON.parse(jsonText);
      
      return {
        evaluation_id: parsed.evaluation_id || `eval-${Date.now()}`,
        plan_id: parsed.plan_id || '',
        baseline: parsed.baseline || {},
        optimized: parsed.optimized || {},
        optimizationResults: parsed.optimizationResults || [],
        qualityEvaluation: parsed.qualityEvaluation || {},
        statisticalSignificance: parsed.statisticalSignificance || {},
        recommendations: parsed.recommendations || [],
        metadata: parsed.metadata || {
          timestamp: new Date().toISOString(),
          sample_size: 0,
          evaluation_duration_seconds: 0,
          early_stopping_triggered: false,
        },
      };
    } catch (error) {
      console.error('Failed to parse evaluation result, using mock data');
      return this.getMockEvaluationResult();
    }
  }

  /**
   * Parse audit report from Claude response
   */
  private parseAuditReport(text: string): AuditReport {
    try {
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;
      
      const parsed = JSON.parse(jsonText);
      
      const executiveSummary = parsed.executiveSummary || {};
      
      return {
        report_id: parsed.report_id || `report-${Date.now()}`,
        executiveSummary: {
          total_cost_savings: executiveSummary.total_cost_savings || 0,
          cost_reduction_percentage: executiveSummary.cost_reduction_percentage || 0,
          payback_period_months: executiveSummary.payback_period_months || 0,
          roi_percentage: executiveSummary.roi_percentage || 0,
          quality_preserved: executiveSummary.quality_preserved || false,
          optimizations_applied: executiveSummary.optimizations_applied || 0,
          optimizations_successful: executiveSummary.optimizations_successful || 0,
          key_achievements: executiveSummary.key_achievements || [],
          risks_mitigated: executiveSummary.risks_mitigated || [],
          next_steps: executiveSummary.next_steps || [],
        },
        detailedResults: parsed.detailedResults || {},
        implementationArtifacts: parsed.implementationArtifacts || {},
        monitoringRecommendations: parsed.monitoringRecommendations || [],
        communityContribution: parsed.communityContribution || {},
        metadata: parsed.metadata || {
          generated_at: new Date().toISOString(),
          evaluation_id: '',
          plan_id: '',
          discovery_id: '',
        },
      };
    } catch (error) {
      console.error('Failed to parse audit report, using mock data');
      return this.getMockAuditReport();
    }
  }

  /**
   * Generate implementation artifacts from audit report
   */
  private async generateImplementationArtifacts(report: AuditReport): Promise<void> {
    const artifactsDir = 'implementation-artifacts';
    await fs.ensureDir(artifactsDir);

    // Generate router configs
    if (report.implementationArtifacts.router_configs) {
      for (const config of report.implementationArtifacts.router_configs) {
        await fs.writeFile(
          `${artifactsDir}/${config.config_file}`,
          config.content,
          'utf-8'
        );
      }
    }

    // Generate cache configs
    if (report.implementationArtifacts.cache_configs) {
      for (const config of report.implementationArtifacts.cache_configs) {
        await fs.writeFile(
          `${artifactsDir}/${config.config_file}`,
          config.content,
          'utf-8'
        );
      }
    }

    // Generate terraform diffs
    if (report.implementationArtifacts.terraform_diffs) {
      const diffContent = report.implementationArtifacts.terraform_diffs
        .map(diff => `# ${diff.resource}\n${diff.changes}\n# Estimated savings: $${diff.estimated_savings}/month\n`)
        .join('\n---\n\n');
      
      await fs.writeFile(
        `${artifactsDir}/terraform.diff`,
        diffContent,
        'utf-8'
      );
    }

    console.log(`  📁 Implementation artifacts saved to ${artifactsDir}/`);
  }

  /**
   * Generate community contribution from audit report
   */
  private async generateCommunityContribution(report: AuditReport): Promise<void> {
    const contributionDir = 'community-contributions';
    await fs.ensureDir(contributionDir);

    const contribution = {
      timestamp: new Date().toISOString(),
      templates_used: report.communityContribution.templates_used || [],
      implementation_reports: report.communityContribution.implementation_reports || [],
      lessons_learned: report.communityContribution.lessons_learned || [],
      suggested_improvements: report.communityContribution.suggested_template_improvements || [],
    };

    await fs.writeFile(
      `${contributionDir}/contribution-${Date.now()}.json`,
      JSON.stringify(contribution, null, 2),
      'utf-8'
    );

    console.log(`  🤝 Community contribution saved to ${contributionDir}/`);
  }

  private buildDataDrivenDiscoveryResult(context: DiscoveryParseContext): DiscoveryResult {
    const events: InferenceEvent[] = Array.isArray(context.mergedData?.events)
      ? context.mergedData.events
      : [];
    const configSummary = this.buildApplicationFirstConfigSummary(
      events,
      context.mergedData?.infrastructure,
      context.codebaseAnalysis
    );

    const workloadProfile = this.buildBaselineWorkloadProfile(events);
    const optimizationOpportunities = this.buildOptimizationOpportunities(
      events,
      context.codebaseAnalysis
    );

    return {
      configSummary,
      workloadProfile,
      optimizationOpportunities,
      codebaseInsights: context.codebaseAnalysis || undefined,
      metadata: {
        timestamp: new Date().toISOString(),
        sources: context.mergedData?.metadata?.sources || [],
        total_events_analyzed: events.length,
        time_range: {
          start: this.extractTimeBoundary(events, 'start'),
          end: this.extractTimeBoundary(events, 'end'),
        },
        codebase_scanned: Boolean(context.codebaseAnalysis),
        codebase_path: context.codebaseAnalysis ? 'codebase-analysis.yaml' : undefined,
      },
    };
  }

  private buildApplicationFirstConfigSummary(
    events: InferenceEvent[],
    infrastructureData?: any,
    codebaseAnalysis?: CodebaseAnalysis | null
  ): DiscoveryResult['configSummary'] {
    const totalCost = events.reduce((sum, event) => sum + (event.cost_usd || 0), 0);

    return {
      application: this.buildApplicationSummary(events, totalCost, codebaseAnalysis),
      serving: this.buildServingSummary(events),
      infrastructure: this.buildInfrastructureSummary(events, totalCost, infrastructureData),
    };
  }

  private buildApplicationSummary(
    events: InferenceEvent[],
    totalCost: number,
    codebaseAnalysis?: CodebaseAnalysis | null
  ): ApplicationSummary {
    if (!events.length) {
      return {
        runtimes: ['unknown'],
        model_usage: [],
        api_patterns: [],
        cost_drivers: [],
        total_monthly_cost: 0,
      };
    }

    const runtimes = Array.from(new Set(events.map(event => event.provider || 'unknown')));
    const modelUsageMap = new Map<string, {
      model: string;
      provider: string;
      request_count: number;
      total_cost: number;
      latency_sum: number;
      optimization_candidates: Set<string>;
    }>();
    const endpointMap = new Map<string, {
      endpoint: string;
      call_volume: number;
      cost_contribution: number;
      intents: Set<string>;
    }>();

    for (const event of events) {
      const key = `${event.provider || 'unknown'}::${event.model || 'unknown'}`;
      if (!modelUsageMap.has(key)) {
        modelUsageMap.set(key, {
          model: event.model || 'unknown',
          provider: event.provider || 'unknown',
          request_count: 0,
          total_cost: 0,
          latency_sum: 0,
          optimization_candidates: new Set<string>(),
        });
      }
      const usage = modelUsageMap.get(key)!;
      usage.request_count += 1;
      usage.total_cost += event.cost_usd || 0;
      usage.latency_sum += event.latency_ms || 0;

      if ((event.model || '').toLowerCase().includes('gpt-4') || (event.model || '').toLowerCase().includes('opus')) {
        usage.optimization_candidates.add('Route tolerant traffic to lower-cost models');
      }
      if ((event.latency_ms || 0) > 2000) {
        usage.optimization_candidates.add('Batch or parallelize high latency workloads');
      }
      if ((event.input_tokens || 0) > 2000) {
        usage.optimization_candidates.add('Trim prompts / enable retrieval grounding');
      }

      if (event.endpoint) {
        if (!endpointMap.has(event.endpoint)) {
          endpointMap.set(event.endpoint, {
            endpoint: event.endpoint,
            call_volume: 0,
            cost_contribution: 0,
            intents: new Set<string>(),
          });
        }
        const endpointStats = endpointMap.get(event.endpoint)!;
        endpointStats.call_volume += 1;
        endpointStats.cost_contribution += event.cost_usd || 0;
        if (event.intent) {
          endpointStats.intents.add(event.intent);
        }
      }
    }

    const model_usage = Array.from(modelUsageMap.values()).map(usage => ({
      model: usage.model,
      provider: usage.provider,
      request_count: usage.request_count,
      total_cost: Number(usage.total_cost.toFixed(4)),
      avg_latency: usage.request_count ? usage.latency_sum / usage.request_count : 0,
      optimization_candidates: Array.from(usage.optimization_candidates),
    }));

    const api_patterns = Array.from(endpointMap.values()).map(pattern => ({
      endpoint: pattern.endpoint,
      call_volume: pattern.call_volume,
      cost_contribution: Number(pattern.cost_contribution.toFixed(4)),
      cacheable_percentage: Math.min(
        90,
        pattern.call_volume > 10 ? 40 + pattern.intents.size * 5 : 25
      ),
      routing_opportunities: [
        `Route ${pattern.endpoint} traffic by intent`,
        'Layer semantic cache before provider call',
      ],
    }));

    const cost_drivers = this.buildCostDrivers(model_usage, totalCost, codebaseAnalysis);

    return {
      runtimes,
      model_usage,
      api_patterns,
      cost_drivers,
      total_monthly_cost: Number(totalCost.toFixed(4)),
    };
  }

  private buildServingSummary(events: InferenceEvent[]): ServingSummary {
    const frameworksMap: Record<string, string> = {
      openai: 'OpenAI Managed API',
      anthropic: 'Anthropic Messages',
      together: 'Together Router',
      baseten: 'Baseten FastServe',
      databricks: 'Databricks Model Serving',
      modal: 'Modal Functions',
    };

    const frameworks = Array.from(new Set(
      events.map(event => frameworksMap[event.provider || ''] || 'Custom Serving')
    ));

    const model_formats = Array.from(new Set(
      events.map(event => {
        if ((event.model || '').toLowerCase().includes('mistral') || (event.model || '').toLowerCase().includes('llama')) {
          return 'transformer';
        }
        if ((event.model || '').toLowerCase().includes('mixtral')) {
          return 'mixture-of-experts';
        }
        return 'managed-api';
      })
    ));

    const latencies = events.map(event => event.latency_ms || 0).sort((a, b) => a - b);
    const performance_baseline: PerformanceBaseline = {
      throughput_rps: this.estimateThroughput(events),
      latency_p50: this.getPercentile(latencies, 0.5),
      latency_p95: this.getPercentile(latencies, 0.95),
      latency_p99: this.getPercentile(latencies, 0.99),
      gpu_utilization: latencies.length ? Math.min(95, Math.max(35, this.getPercentile(latencies, 0.75) / 40)) : 45,
      memory_utilization: events.length ? Math.min(90, 40 + Math.round(events.reduce((sum, event) => sum + (event.input_tokens || 0), 0) / (events.length * 50))) : 55,
      batch_size_avg: events.length ? Math.max(1, Number((events.length / (frameworks.length || 1)).toFixed(1))) : 1,
    };

    const bottlenecks: string[] = [];
    if (performance_baseline.latency_p95 > 2500) {
      bottlenecks.push('High tail latency from serialized provider calls');
    }
    if (performance_baseline.batch_size_avg <= 1.5) {
      bottlenecks.push('Minimal batching - opportunity for request coalescing');
    }
    if (performance_baseline.memory_utilization > 75) {
      bottlenecks.push('Large prompts causing high memory pressure');
    }

    return {
      frameworks: frameworks.length ? frameworks : ['Custom Serving'],
      model_formats: model_formats.length ? model_formats : ['managed-api'],
      performance_baseline,
      bottlenecks,
      optimization_readiness: Math.min(0.95, 0.55 + bottlenecks.length * 0.1),
    };
  }

  private buildInfrastructureSummary(
    events: InferenceEvent[],
    totalCost: number,
    infrastructureData?: any
  ): InfrastructureSummary {
    const tenants = Array.from(new Set(events.map(event => event.tenant).filter(Boolean)));

    const resources = Array.isArray(infrastructureData?.resources) ? infrastructureData.resources : [];
    const gpuResources = resources.filter((resource: any) =>
      typeof resource.type === 'string' && resource.type.toLowerCase().includes('gpu')
    );

    const total_monthly_cost = Number(
      (infrastructureData?.totals?.monthly || totalCost * 0.45).toFixed(4)
    );

    const gpu_inventory: GPUSummary[] = gpuResources.length
      ? gpuResources.map((resource: any, index: number) => ({
          type: resource.type || `gpu-cluster-${index + 1}`,
          count: resource.count || 1,
          utilization: resource.utilization || 55,
          monthly_cost: resource.monthly_cost || Number((total_monthly_cost / gpuResources.length).toFixed(2)),
          optimization_opportunities: resource.optimization_opportunities || ['Consolidate workloads', 'Adopt spot or reserved capacity'],
        }))
      : [
          {
            type: 'managed-provider',
            count: tenants.length || 1,
            utilization: 55,
            monthly_cost: total_monthly_cost,
            optimization_opportunities: ['Introduce autoscaling policies', 'Consider spot-capable serving'],
          },
        ];

    const utilization_metrics: UtilizationMetrics = {
      cpu_avg: infrastructureData?.utilization?.cpu ?? 55,
      gpu_avg: gpu_inventory.reduce((sum, gpu) => sum + gpu.utilization, 0) / gpu_inventory.length,
      memory_avg: infrastructureData?.utilization?.memory ?? 65,
      network_avg: infrastructureData?.utilization?.network ?? 45,
      efficiency_score: Number(((gpu_inventory.reduce((sum, gpu) => sum + gpu.utilization, 0) / (gpu_inventory.length || 1)) / 100).toFixed(2)),
    };

    return {
      total_resources: resources.length || tenants.length || 1,
      gpu_inventory,
      total_monthly_cost,
      utilization_metrics,
      optimization_potential: Math.min(0.95, 0.5 + (total_monthly_cost > 0 ? 0.00002 * total_monthly_cost : 0.15)),
    };
  }

  private buildBaselineWorkloadProfile(events: InferenceEvent[]): WorkloadProfile {
    if (!events.length) {
      return {
        request_patterns: [],
        traffic_distribution: {
          by_hour: [],
          by_day_of_week: [],
          peak_hours: [],
          off_peak_hours: [],
          burst_patterns: false,
        },
        quality_requirements: [],
        cost_sensitivity: 0.5,
        latency_tolerance: 1200,
      };
    }

    const intentStats = new Map<string, {
      count: number;
      totalTokens: number;
    }>();

    for (const event of events) {
      if (!event.intent) continue;
      if (!intentStats.has(event.intent)) {
        intentStats.set(event.intent, { count: 0, totalTokens: 0 });
      }
      const stats = intentStats.get(event.intent)!;
      stats.count += 1;
      stats.totalTokens += (event.input_tokens || 0) + (event.output_tokens || 0);
    }

    const totalEvents = events.length;
    const request_patterns = Array.from(intentStats.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([intent, stats], idx) => {
        const avgTokens = stats.count ? Math.round(stats.totalTokens / stats.count) : 0;
        return {
          pattern_id: `intent-${idx + 1}`,
          description: `Requests for ${intent}`,
          frequency: Number(((stats.count / totalEvents) * 100).toFixed(2)),
          avg_tokens: avgTokens,
          intent_category: intent,
          optimization_suitability: [
            avgTokens > 2000 ? 'prompt-trimming' : 'semantic-cache',
            'model-routing',
          ],
        };
      });

    const traffic_distribution = this.buildTrafficDistribution(events);
    const latencies = events.map(event => event.latency_ms || 0).sort((a, b) => a - b);
    const totalCost = events.reduce((sum, event) => sum + (event.cost_usd || 0), 0);

    return {
      request_patterns,
      traffic_distribution,
      quality_requirements: this.deriveQualityRequirements(events),
      cost_sensitivity: Math.min(1, Number(((totalCost / (totalEvents || 1)) / 0.1).toFixed(2))),
      latency_tolerance: Math.max(800, this.getPercentile(latencies, 0.95) + 200),
    };
  }

  private buildOptimizationOpportunities(
    events: InferenceEvent[],
    codebaseAnalysis?: CodebaseAnalysis | null
  ): OptimizationOpportunity[] {
    if (!events.length && !codebaseAnalysis) {
      return [];
    }

    const totalCost = events.reduce((sum, event) => sum + (event.cost_usd || 0), 0);
    const modelUsage = new Map<string, number>();
    for (const event of events) {
      const key = `${event.provider || 'unknown'}::${event.model || 'unknown'}`;
      modelUsage.set(key, (modelUsage.get(key) || 0) + (event.cost_usd || 0));
    }

    const expensiveModels = Array.from(modelUsage.entries())
      .filter(([key]) => key.toLowerCase().includes('gpt-4') || key.toLowerCase().includes('opus'))
      .sort((a, b) => b[1] - a[1]);

    const opportunities: OptimizationOpportunity[] = [];

    if (events.length) {
      const repeatIntents = this.identifyRepeatIntents(events);
      if (repeatIntents.reusableTraffic > 0.15 || (codebaseAnalysis?.cachingOpportunities?.length || 0) > 0) {
        const estimatedSavings = Number((totalCost * 0.25).toFixed(4));
        opportunities.push({
          layer: 'application',
          category: 'semantic-caching',
          description: `Introduce caching for ${repeatIntents.topIntent || 'high-overlap'} prompts to eliminate repeated expensive calls`,
          estimated_savings_monthly: estimatedSavings,
          estimated_savings_percentage: totalCost ? Number(((estimatedSavings / totalCost) * 100).toFixed(2)) : 0,
          implementation_complexity: 'medium',
          risk_level: 'low',
          applicable_templates: ['application-layer/semantic-caching', 'application-layer/prompt-optimization'],
          priority_score: 78,
        });
      }
    }

    if (expensiveModels.length) {
      const highCost = expensiveModels.slice(0, 2).reduce((sum, [, cost]) => sum + cost, 0);
      const estimatedSavings = Number((highCost * 0.35).toFixed(4));
      opportunities.push({
        layer: 'cross-layer',
        category: 'model-routing',
        description: 'Route tolerant workloads from premium models to cheaper alternates (e.g., GPT-4o → GPT-4o-mini, Claude Opus → Sonnet)',
        estimated_savings_monthly: estimatedSavings,
        estimated_savings_percentage: totalCost ? Number(((estimatedSavings / totalCost) * 100).toFixed(2)) : 0,
        implementation_complexity: 'medium',
        risk_level: 'medium',
        applicable_templates: ['cross-layer/model-routing', 'serving-layer/vllm-migration'],
        priority_score: 74,
      });
    }

    const infraSavings = Number(((totalCost || 1000) * 0.2).toFixed(4));
    opportunities.push({
      layer: 'infrastructure',
      category: 'infra-optimization',
      description: 'Adopt autoscaling and spot-friendly serving infrastructure (Databricks/Modal/Terraform)',
      estimated_savings_monthly: infraSavings,
      estimated_savings_percentage: totalCost ? Number(((infraSavings / totalCost) * 100).toFixed(2)) : 0,
      implementation_complexity: 'medium',
      risk_level: 'medium',
      applicable_templates: ['infrastructure-layer/spot-instance-optimization', 'cross-layer/databricks-vllm-optimization'],
      priority_score: 70,
    });

    if ((codebaseAnalysis?.optimizationOpportunities?.length || 0) > 0) {
      const codeSavings = Number((totalCost * 0.1 || 1000).toFixed(4));
      opportunities.push({
        layer: 'application',
        category: 'code-refactor',
        description: 'Implement code-level optimizations surfaced by codebase analysis (missing caching, retries, configuration cleanup)',
        estimated_savings_monthly: codeSavings,
        estimated_savings_percentage: totalCost ? Number(((codeSavings / totalCost) * 100).toFixed(2)) : 0,
        implementation_complexity: 'low',
        risk_level: 'low',
        applicable_templates: ['application-layer/codebase-hardening', 'application-layer/prompt-optimization'],
        priority_score: 65,
      });
    }

    return opportunities;
  }

  private buildTrafficDistribution(events: InferenceEvent[]): TrafficDistribution {
    const by_hour = new Array(24).fill(0);
    const by_day_of_week = new Array(7).fill(0);

    for (const event of events) {
      const date = event.ts ? new Date(event.ts) : null;
      if (!date || Number.isNaN(date.getTime())) continue;
      by_hour[date.getUTCHours()] += 1;
      by_day_of_week[date.getUTCDay()] += 1;
    }

    const peak_hours = this.getTopIndexes(by_hour, 3);
    const off_peak_hours = by_hour
      .map((value, index) => ({ value, index }))
      .filter(entry => entry.value === 0)
      .map(entry => entry.index);

    const avgHour = by_hour.reduce((sum, value) => sum + value, 0) / (by_hour.length || 1);
    const burst_patterns = by_hour.some(value => value > avgHour * 1.5 && avgHour > 0);

    return {
      by_hour,
      by_day_of_week,
      peak_hours,
      off_peak_hours,
      burst_patterns,
    };
  }

  private deriveQualityRequirements(events: InferenceEvent[]): QualityRequirement[] {
    const requirements: QualityRequirement[] = [];

    const qualityScores = events
      .map(event => event.quality_score)
      .filter((score): score is number => typeof score === 'number');

    if (qualityScores.length) {
      const minQuality = Math.min(...qualityScores);
      requirements.push({
        metric: 'llm_quality_score',
        threshold: Number(minQuality.toFixed(2)),
        priority: 'high',
      });
    } else {
      requirements.push(
        {
          metric: 'semantic_accuracy',
          threshold: 0.95,
          priority: 'high',
        },
        {
          metric: 'latency_p95_ms',
          threshold: 2500,
          priority: 'medium',
        }
      );
    }

    return requirements;
  }

  private buildCostDrivers(
    modelUsage: Array<{
      model: string;
      provider: string;
      request_count: number;
      total_cost: number;
      avg_latency: number;
      optimization_candidates: string[];
    }>,
    totalCost: number,
    codebaseAnalysis?: CodebaseAnalysis | null
  ): CostDriver[] {
    const drivers: CostDriver[] = modelUsage
      .sort((a, b) => b.total_cost - a.total_cost)
      .slice(0, 3)
      .map((usage, index): CostDriver => ({
        category: 'model',
        description: `${usage.provider}:${usage.model}`,
        monthly_cost: Number(usage.total_cost.toFixed(4)),
        percentage_of_total: totalCost ? Number(((usage.total_cost / totalCost) * 100).toFixed(2)) : 0,
        optimization_potential: 0.6 - index * 0.1,
      }));

    if ((codebaseAnalysis?.cachingOpportunities?.length || 0) > 0) {
      drivers.push({
        category: 'tokens',
        description: 'Redundant prompts without caching',
        monthly_cost: Number((totalCost * 0.2).toFixed(4)),
        percentage_of_total: totalCost ? Number(((totalCost * 0.2) / totalCost) * 100) : 0,
        optimization_potential: 0.75,
      });
    }

    return drivers;
  }

  private identifyRepeatIntents(events: InferenceEvent[]): { reusableTraffic: number; topIntent?: string } {
    if (!events.length) {
      return { reusableTraffic: 0 };
    }

    const intentCounts = new Map<string, number>();
    for (const event of events) {
      if (!event.intent) continue;
      intentCounts.set(event.intent, (intentCounts.get(event.intent) || 0) + 1);
    }

    const topIntentEntry = Array.from(intentCounts.entries()).sort((a, b) => b[1] - a[1])[0];
    const reusableTraffic = topIntentEntry ? topIntentEntry[1] / events.length : 0;

    return {
      reusableTraffic,
      topIntent: topIntentEntry?.[0],
    };
  }

  private extractTimeBoundary(events: InferenceEvent[], boundary: 'start' | 'end'): string {
    if (!events.length) {
      return '';
    }

    const timestamps = events
      .map(event => (event.ts ? new Date(event.ts).getTime() : NaN))
      .filter(value => !Number.isNaN(value));

    if (!timestamps.length) {
      return '';
    }

    const value = boundary === 'start'
      ? Math.min(...timestamps)
      : Math.max(...timestamps);

    return new Date(value).toISOString();
  }

  private estimateThroughput(events: InferenceEvent[]): number {
    if (events.length < 2) {
      return events.length ? Math.max(1, events.length) : 0;
    }

    const timestamps = events
      .map(event => (event.ts ? new Date(event.ts).getTime() : NaN))
      .filter(value => !Number.isNaN(value))
      .sort((a, b) => a - b);

    if (timestamps.length < 2) {
      return Math.max(1, events.length);
    }

    const durationSeconds = Math.max(1, (timestamps[timestamps.length - 1] - timestamps[0]) / 1000);
    return Number((events.length / durationSeconds).toFixed(2));
  }

  private getPercentile(values: number[], percentile: number): number {
    if (!values.length) {
      return 0;
    }

    const index = percentile * (values.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) {
      return Math.round(values[lower]);
    }

    const weight = index - lower;
    return Math.round(values[lower] * (1 - weight) + values[upper] * weight);
  }

  private getTopIndexes(values: number[], count: number): number[] {
    return values
      .map((value, index) => ({ value, index }))
      .sort((a, b) => b.value - a.value)
      .slice(0, count)
      .filter(entry => entry.value > 0)
      .map(entry => entry.index);
  }

  // Mock data methods for fallback
  private getMockDiscoveryResult(): DiscoveryResult {
    return {
      configSummary: {
        application: {
          runtimes: ['openai', 'anthropic'],
          model_usage: [],
          api_patterns: [],
          cost_drivers: [],
          total_monthly_cost: 10000,
        },
        serving: {
          frameworks: ['transformers'],
          model_formats: ['pytorch'],
          performance_baseline: {
            throughput_rps: 10,
            latency_p50: 200,
            latency_p95: 500,
            latency_p99: 1000,
            gpu_utilization: 30,
            memory_utilization: 60,
            batch_size_avg: 4,
          },
          bottlenecks: ['memory_bandwidth'],
          optimization_readiness: 0.8,
        },
        infrastructure: {
          total_resources: 3,
          gpu_inventory: [],
          total_monthly_cost: 5000,
          utilization_metrics: {
            cpu_avg: 40,
            gpu_avg: 30,
            memory_avg: 60,
            network_avg: 20,
            efficiency_score: 0.3,
          },
          optimization_potential: 0.6,
        },
      },
      workloadProfile: {
        request_patterns: [],
        traffic_distribution: {
          by_hour: [],
          by_day_of_week: [],
          peak_hours: [9, 10, 11, 14, 15],
          off_peak_hours: [0, 1, 2, 3, 4, 5, 22, 23],
          burst_patterns: false,
        },
        quality_requirements: [],
        cost_sensitivity: 0.7,
        latency_tolerance: 1000,
      },
      optimizationOpportunities: [],
      metadata: {
        timestamp: new Date().toISOString(),
        sources: [],
        total_events_analyzed: 0,
        time_range: {
          start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          end: new Date().toISOString(),
        },
      },
    };
  }

  private getMockOptimizationPlan(): OptimizationPlan {
    return {
      applicationLayer: [],
      servingLayer: [],
      infrastructureLayer: [],
      crossLayerStrategies: [],
      estimatedSavings: 5000,
      implementationComplexity: 'moderate',
      implementationSequence: [],
      riskAssessment: {
        overall_risk: 'medium',
        risks: [],
        mitigation_strategies: [],
        rollback_procedures: [],
      },
      economicProjections: {
        baseline_monthly_cost: 10000,
        optimized_monthly_cost: 5000,
        monthly_savings: 5000,
        annual_savings: 60000,
        implementation_cost: 10000,
        payback_period_months: 2,
        roi_percentage: 500,
        confidence_interval: {
          lower_bound: 4000,
          upper_bound: 6000,
          confidence_level: 0.95,
        },
      },
      metadata: {
        created_at: new Date().toISOString(),
        discovery_id: '',
        templates_used: [],
        confidence_score: 0.75,
      },
    };
  }

  private getMockEvaluationResult(): EvaluationResult {
    return {
      evaluation_id: `eval-${Date.now()}`,
      plan_id: '',
      baseline: {
        cost_per_request: 0.05,
        latency_p50: 200,
        latency_p95: 500,
        latency_p99: 1000,
        throughput_rps: 10,
        error_rate: 0.01,
        quality_score: 0.9,
        total_cost: 10000,
        sample_count: 1000,
      },
      optimized: {
        cost_per_request: 0.02,
        latency_p50: 150,
        latency_p95: 400,
        latency_p99: 800,
        throughput_rps: 15,
        error_rate: 0.01,
        quality_score: 0.88,
        total_cost: 5000,
        sample_count: 1000,
      },
      optimizationResults: [],
      qualityEvaluation: {
        overall_quality_preserved: true,
        quality_metrics: [],
        llm_judge_scores: [],
        rule_based_scores: [],
        human_eval_recommended: false,
      },
      statisticalSignificance: {
        sample_size: 1000,
        statistical_power: 0.9,
        confidence_level: 0.95,
        p_value: 0.001,
        effect_size: 0.5,
        significant: true,
      },
      recommendations: [],
      metadata: {
        timestamp: new Date().toISOString(),
        sample_size: 1000,
        evaluation_duration_seconds: 300,
        early_stopping_triggered: false,
      },
    };
  }

  private getMockAuditReport(): AuditReport {
    return {
      report_id: `report-${Date.now()}`,
      executiveSummary: {
        total_cost_savings: 5000,
        cost_reduction_percentage: 50,
        payback_period_months: 2,
        roi_percentage: 500,
        quality_preserved: true,
        optimizations_applied: 5,
        optimizations_successful: 5,
        key_achievements: ['Reduced costs by 50%', 'Maintained quality', 'Improved latency'],
        risks_mitigated: [],
        next_steps: ['Monitor metrics', 'Apply remaining optimizations'],
      },
      detailedResults: {
        by_layer: {
          application: {
            optimizations_applied: 2,
            cost_savings: 2000,
            savings_percentage: 40,
            quality_impact: 0,
            key_improvements: [],
          },
          serving: {
            optimizations_applied: 2,
            cost_savings: 2000,
            savings_percentage: 40,
            quality_impact: 0,
            key_improvements: [],
          },
          infrastructure: {
            optimizations_applied: 1,
            cost_savings: 1000,
            savings_percentage: 20,
            quality_impact: 0,
            key_improvements: [],
          },
        },
        cross_layer_benefits: {
          synergy_savings: 500,
          coordination_effectiveness: 0.8,
          compound_benefits: [],
        },
        performance_improvements: {
          latency_improvement_percentage: 25,
          throughput_improvement_percentage: 50,
          utilization_improvement_percentage: 100,
          efficiency_gains: [],
        },
        cost_breakdown: {
          baseline_monthly: 10000,
          optimized_monthly: 5000,
          savings_by_category: {},
          savings_by_optimization: {},
        },
      },
      implementationArtifacts: {
        router_configs: [],
        cache_configs: [],
        terraform_diffs: [],
        serving_configs: [],
        deployment_scripts: [],
      },
      monitoringRecommendations: [],
      communityContribution: {
        templates_used: [],
        implementation_reports: [],
        lessons_learned: [],
        suggested_template_improvements: [],
      },
      metadata: {
        generated_at: new Date().toISOString(),
        evaluation_id: '',
        plan_id: '',
        discovery_id: '',
      },
    };
  }

  private getMockProfileResult(): ProfileResult {
    return {
      metadata: {
        timestamp: new Date().toISOString(),
        events_analyzed: 100,
        cluster_method: 'semantic',
        total_clusters: 3,
        top_intents: ['summarize_doc', 'extract_email', 'classify_ticket'],
      },
      workloadStats: {
        total_events: 100,
        total_cost: 250,
        avg_latency_ms: 850,
        p95_latency_ms: 1600,
        avg_input_tokens: 1200,
        avg_output_tokens: 250,
        peak_hours: [10, 11, 14],
        top_providers: ['openai', 'anthropic'],
        top_models: ['gpt-4', 'claude-3-sonnet'],
      },
      clusters: [
        {
          cluster_id: 'cluster-1',
          size: 45,
          intent: 'summarize_doc',
          description: 'Long-form document summarization for support tickets',
          representative_prompt: 'Summarize the following customer support transcript...',
          avg_input_tokens: 1800,
          avg_output_tokens: 200,
          cost_per_request: 0.45,
          monthly_cost: 1200,
          dominant_provider: 'openai',
          dominant_model: 'gpt-4',
          recommended_action: 'Introduce hybrid routing to gpt-4o-mini + cache repeated requests',
        },
      ],
      samplePrompts: [
        {
          id: 'sample-1',
          cluster_id: 'cluster-1',
          provider: 'openai',
          model: 'gpt-4',
          prompt: 'Summarize the meeting notes below...',
          tokens: { input: 2000, output: 180 },
          cost_usd: 0.52,
        },
      ],
      recommendations: [
        {
          recommendation_id: 'rec-1',
          description: 'Introduce semantic caching for docs with >30% repetition',
          impact: 'high',
          estimated_savings: 1200,
          action_items: ['Implement SemanticCache', 'Store embeddings in Redis'],
          related_clusters: ['cluster-1'],
          suggested_templates: ['semantic-caching-optimization'],
        },
      ],
    };
  }

  private calculateEventStats(events: InferenceEvent[]) {
    let totalCost = 0;
    let totalLatency = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    const providerCounts = new Map<string, number>();
    const intentCounts = new Map<string, number>();

    for (const event of events) {
      totalCost += event.cost_usd || 0;
      totalLatency += event.latency_ms || 0;
      totalInputTokens += event.input_tokens || 0;
      totalOutputTokens += event.output_tokens || 0;

      if (event.provider) {
        providerCounts.set(event.provider, (providerCounts.get(event.provider) || 0) + 1);
      }

      if (event.intent) {
        intentCounts.set(event.intent, (intentCounts.get(event.intent) || 0) + 1);
      }
    }

    const avgLatencyMs = events.length ? totalLatency / events.length : 0;
    const avgInputTokens = events.length ? totalInputTokens / events.length : 0;
    const avgOutputTokens = events.length ? totalOutputTokens / events.length : 0;

    const topProviders = Array.from(providerCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([provider]) => provider);

    const topIntents = Array.from(intentCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([intent]) => intent);

    return {
      totalCost,
      avgLatencyMs,
      avgInputTokens,
      avgOutputTokens,
      topProviders,
      topIntents,
    };
  }
}


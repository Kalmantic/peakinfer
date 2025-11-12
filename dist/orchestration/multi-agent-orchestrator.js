/**
 * Multi-Agent Orchestrator - Coordinates all optimization agents
 *
 * This is the core orchestration system that coordinates:
 * - DiscoveryAgent: Environment discovery
 * - WorkloadProfiler: Prompt clustering and sampling
 * - PolicyAgent: Organizational constraints
 * - PlannerAgent: Optimization search planning
 * - RunnerEvaluator: Execution with early stopping
 * - AuditorAgent: Savings summary and patches
 */
import { query } from '@anthropic-ai/claude-code';
import { ClaudeDiscoveryAgent } from './agents/claude-discovery-agent.js';
import { WorkloadProfilerAgent } from './agents/workload-profiler-agent.js';
import { PolicyAgent } from './agents/policy-agent.js';
import { PlannerAgent } from './agents/planner-agent.js';
import { RunnerEvaluatorAgent } from './agents/runner-evaluator-agent.js';
import { AuditorAgent } from './agents/auditor-agent.js';
export class MultiAgentOrchestrator {
    discoveryAgent;
    profilerAgent;
    policyAgent;
    plannerAgent;
    runnerAgent;
    auditorAgent;
    constructor() {
        this.discoveryAgent = new ClaudeDiscoveryAgent();
        this.profilerAgent = new WorkloadProfilerAgent();
        this.policyAgent = new PolicyAgent();
        this.plannerAgent = new PlannerAgent();
        this.runnerAgent = new RunnerEvaluatorAgent();
        this.auditorAgent = new AuditorAgent();
    }
    /**
     * Main orchestration flow - coordinates all agents
     */
    async orchestrateOptimization(options) {
        console.log('\n🚀 TokenOp Multi-Agent Orchestration Starting...\n');
        // Stage 1: Discovery - Understand the environment
        console.log('Stage 1️⃣: Environment Discovery');
        console.log('━'.repeat(60));
        const environment = await this.discoveryAgent.discover();
        console.log('✅ Environment discovery complete\n');
        // Stage 2: Workload Profiling - Cluster and analyze workload
        console.log('Stage 2️⃣: Workload Profiling');
        console.log('━'.repeat(60));
        const workloadProfile = await this.profilerAgent.profileWorkload(options.workloadDataPath, environment);
        console.log('✅ Workload profiling complete\n');
        // Stage 3: Policy Loading - Load organizational constraints
        console.log('Stage 3️⃣: Policy Loading');
        console.log('━'.repeat(60));
        const policy = await this.policyAgent.loadPolicy(options.policyPath);
        console.log('✅ Policy loaded\n');
        // Stage 4: Planning - Build optimization search plan
        console.log('Stage 4️⃣: Optimization Planning');
        console.log('━'.repeat(60));
        const plan = await this.plannerAgent.createPlan(environment, workloadProfile, policy, options.templatesDir);
        console.log('✅ Optimization plan created\n');
        // Stage 5: Execution - Run optimizations with early stopping
        console.log('Stage 5️⃣: Execution & Evaluation');
        console.log('━'.repeat(60));
        const executionResults = await this.runnerAgent.executeWithEarlyStopping(plan, environment, workloadProfile, options.dryRun || false);
        console.log('✅ Execution complete\n');
        // Stage 6: Auditing - Summarize results and generate patches
        console.log('Stage 6️⃣: Auditing & Reporting');
        console.log('━'.repeat(60));
        const audit = await this.auditorAgent.auditResults(executionResults, environment, workloadProfile, policy);
        console.log('✅ Audit complete\n');
        // Calculate final metrics
        const totalSavings = executionResults.reduce((sum, result) => sum + (result.cost_savings || 0), 0);
        const totalImplementationCost = executionResults.reduce((sum, result) => {
            const template = plan.candidate_templates.find(t => t.id === result.template_id);
            return sum + (template?.economics.implementation_cost.total_cost || 0);
        }, 0);
        const roi = totalImplementationCost > 0
            ? ((totalSavings * 12 - totalImplementationCost) / totalImplementationCost) * 100
            : 0;
        console.log('🎉 Multi-Agent Orchestration Complete!\n');
        return {
            environment,
            workload_profile: workloadProfile,
            policy,
            plan,
            execution_results: executionResults,
            audit,
            total_savings: totalSavings,
            roi
        };
    }
    /**
     * Run a single agent query with Claude
     */
    async runAgentQuery(prompt, context) {
        const contextStr = context ? `\n\nContext:\n${JSON.stringify(context, null, 2)}` : '';
        const fullPrompt = `${prompt}${contextStr}`;
        let response = '';
        try {
            const claudeQuery = query({
                prompt: fullPrompt,
                options: {
                    model: 'claude-sonnet-4-5-20250929',
                    maxTurns: 10,
                    maxThinkingTokens: 2000,
                }
            });
            for await (const message of claudeQuery) {
                if (message.type === 'assistant') {
                    // Extract text from assistant message
                    const content = message.message.content;
                    for (const block of content) {
                        if (block.type === 'text') {
                            response += block.text;
                        }
                    }
                }
            }
            return response.trim();
        }
        catch (error) {
            console.error('Agent query failed:', error);
            throw error;
        }
    }
    /**
     * Get orchestration summary
     */
    getOrchestrationSummary(result) {
        return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🎯 TokenOp Optimization Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Environment Discovered:
  • Runtime: ${result.environment.application.runtime_detected.join(', ') || 'None'}
  • Serving: ${result.environment.serving.frameworks_detected.join(', ') || 'None'}
  • GPUs: ${result.environment.infrastructure.gpu_inventory.length}
  • Monthly Cost: $${result.environment.infrastructure.cost_breakdown.total_monthly.toLocaleString()}

📈 Workload Analysis:
  • Total Requests: ${result.workload_profile.total_requests.toLocaleString()}
  • Intent Clusters: ${result.workload_profile.clustered_intents.length}
  • Representative Samples: ${result.workload_profile.representative_samples.length}

🎯 Optimization Results:
  • Templates Applied: ${result.execution_results.length}
  • Successful: ${result.execution_results.filter(r => r.status === 'success').length}
  • Failed: ${result.execution_results.filter(r => r.status === 'failed').length}

💰 Economic Impact:
  • Monthly Savings: $${result.total_savings.toLocaleString()}
  • Annual Savings: $${(result.total_savings * 12).toLocaleString()}
  • Implementation Cost: $${result.audit.total_implementation_cost.toLocaleString()}
  • ROI: ${result.roi.toFixed(1)}%
  • Payback Period: ${result.audit.payback_period_months.toFixed(1)} months

🔧 Patches Generated: ${result.audit.patches_generated.length}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
    }
}

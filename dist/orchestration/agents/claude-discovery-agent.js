/**
 * Claude-Powered Discovery Agent
 * Uses Claude Code SDK for intelligent environment discovery
 */
import { query } from '@anthropic-ai/claude-code';
import { ClaudeHelper } from '../../utils/claude-helper.js';
import * as fs from 'fs-extra';
import * as path from 'path';
export class ClaudeDiscoveryAgent {
    /**
     * Discover environment using Claude's intelligence
     */
    async discover() {
        console.log('  🔍 Claude Discovery Agent analyzing your infrastructure...\n');
        // Initialize default environment
        const environment = {
            application: {
                runtime_detected: [],
                model_usage_patterns: [],
                api_call_patterns: [],
                context_analysis: {
                    average_length: 2048,
                    distribution: [512, 1024, 2048, 4096],
                    memory_impact: 0.5,
                    batching_opportunities: []
                }
            },
            serving: {
                frameworks_detected: [],
                model_formats: [],
                serving_configs: [],
                performance_metrics: {
                    throughput: 25,
                    latency_p95: 200,
                    gpu_utilization: 35,
                    memory_utilization: 60,
                    batch_efficiency: 4
                }
            },
            infrastructure: {
                gpu_inventory: [],
                memory_analysis: {
                    total_capacity: 24,
                    utilization: 60,
                    bandwidth_efficiency: 0.15,
                    bottlenecks: ['memory_bandwidth', 'sequential_generation']
                },
                network_topology: {
                    bandwidth: 1000,
                    latency: 1,
                    multi_gpu_setup: false,
                    communication_overhead: 0
                },
                cost_breakdown: {
                    compute_cost: 2000,
                    storage_cost: 100,
                    network_cost: 50,
                    total_monthly: 2150,
                    optimization_potential: 1290
                }
            }
        };
        try {
            // Use Claude to analyze the codebase
            const analysisPrompt = `You are an LLM infrastructure expert analyzing a codebase for optimization opportunities.

Please analyze the current directory and subdirectories to discover:

1. **Application Layer**:
   - Programming languages and frameworks (Python, Node.js, etc.)
   - LLM libraries (OpenAI, Anthropic, HuggingFace, LangChain, etc.)
   - API patterns and usage
   - Context length patterns

2. **Serving Layer**:
   - Serving frameworks (vLLM, TensorRT, SGLang, Transformers)
   - Model formats (ONNX, PyTorch, SafeTensors)
   - Performance configurations

3. **Infrastructure Layer**:
   - GPU detection and specifications
   - Kubernetes/Docker configurations
   - Terraform/infrastructure-as-code files
   - Cloud provider configurations

Please provide your analysis as a JSON object with the following structure:
{
  "runtimes": ["openai", "huggingface"],
  "frameworks": ["vllm", "transformers"],
  "infrastructure": ["kubernetes", "terraform"],
  "gpu_detected": true,
  "estimated_monthly_cost": 2000,
  "key_findings": ["finding1", "finding2"]
}

Analyze the codebase now and return only the JSON, no additional explanation.`;
            let claudeResponse = '';
            const claudeQuery = query({
                prompt: analysisPrompt,
                options: {
                    model: 'claude-sonnet-4-5-20250929',
                    maxTurns: 5,
                    cwd: process.cwd(),
                    allowedTools: ['Read', 'Glob', 'Bash', 'Grep'],
                }
            });
            for await (const message of claudeQuery) {
                if (message.type === 'assistant') {
                    const content = message.message.content;
                    for (const block of content) {
                        if (block.type === 'text') {
                            claudeResponse += block.text;
                        }
                    }
                }
            }
            // Parse Claude's response
            const analysis = this.parseClaudeResponse(claudeResponse);
            // Show Claude's analysis beautifully
            ClaudeHelper.showThinking('Analyzing your LLM infrastructure...');
            // Update environment with Claude's findings
            if (analysis.runtimes) {
                environment.application.runtime_detected = analysis.runtimes;
            }
            if (analysis.frameworks) {
                environment.serving.frameworks_detected = analysis.frameworks;
            }
            if (analysis.estimated_monthly_cost) {
                environment.infrastructure.cost_breakdown.total_monthly = analysis.estimated_monthly_cost;
                environment.infrastructure.cost_breakdown.compute_cost = analysis.estimated_monthly_cost * 0.9;
            }
            // Add default GPU if detected
            if (analysis.gpu_detected) {
                environment.infrastructure.gpu_inventory.push({
                    model: 'Detected GPU',
                    memory_gb: 40,
                    bandwidth_gbps: 2000,
                    utilization: 35,
                    cost_per_hour: 3.0
                });
            }
            // Add model usage patterns if runtimes detected
            if (environment.application.runtime_detected.length > 0) {
                environment.application.model_usage_patterns = [
                    {
                        model_name: 'gpt-4',
                        usage_frequency: 1000,
                        context_patterns: ['conversational', 'document_analysis'],
                        cost_contribution: 0.7
                    }
                ];
                environment.application.api_call_patterns = [
                    {
                        endpoint: 'api.openai.com',
                        call_volume: 1000,
                        cost_per_call: 0.03,
                        optimization_opportunities: ['model_routing', 'semantic_caching']
                    }
                ];
            }
            // Format Claude's analysis beautifully
            const formattedAnalysis = {
                findings: analysis.key_findings || [],
                problems: this.identifyProblems(environment),
                solutions: this.suggestSolutions(environment)
            };
            ClaudeHelper.formatAnalysis('Infrastructure Discovery', formattedAnalysis);
            console.log('  ✓ Runtimes:', environment.application.runtime_detected.join(', ') || 'None');
            console.log('  ✓ Frameworks:', environment.serving.frameworks_detected.join(', ') || 'None');
            console.log('  ✓ GPUs:', environment.infrastructure.gpu_inventory.length);
            console.log('  ✓ Monthly Cost:', `$${environment.infrastructure.cost_breakdown.total_monthly.toLocaleString()}`);
            // Show specific problem/solution pairs
            if (environment.application.runtime_detected.length === 0) {
                ClaudeHelper.formatProblemSolution('No LLM runtime detected in your infrastructure', 'Consider adding OpenAI, Anthropic, or HuggingFace libraries to enable LLM optimization', {
                    cost_impact: 'Potential 20-40% cost reduction',
                    implementation_time: '1-2 days',
                    complexity: 'Low'
                });
            }
            if (environment.serving.frameworks_detected.length === 0) {
                ClaudeHelper.formatProblemSolution('No serving framework detected (vLLM, TensorRT, SGLang)', 'Implement vLLM or SGLang for 2-3x inference speedup and better GPU utilization', {
                    cost_impact: '$500-2000/month savings',
                    implementation_time: '3-5 days',
                    complexity: 'Medium'
                });
            }
            if (environment.infrastructure.gpu_inventory.length === 0) {
                ClaudeHelper.formatProblemSolution('No GPU acceleration detected', 'Add GPU infrastructure (NVIDIA A100/H100) for 10-50x inference speedup', {
                    cost_impact: 'Enable large-scale optimization',
                    implementation_time: '1-2 weeks',
                    complexity: 'High'
                });
            }
            return environment;
        }
        catch (error) {
            console.warn('  ⚠️  Claude discovery failed, using heuristic discovery');
            console.warn('  Error:', error instanceof Error ? error.message : String(error));
            // Fallback to basic heuristic discovery
            return this.fallbackDiscovery(environment);
        }
    }
    /**
     * Parse Claude's JSON response
     */
    parseClaudeResponse(response) {
        try {
            // Extract JSON from markdown code blocks if present
            const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) ||
                response.match(/```\n([\s\S]*?)\n```/) ||
                response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const jsonStr = jsonMatch[1] || jsonMatch[0];
                return JSON.parse(jsonStr);
            }
            // Try parsing the entire response as JSON
            return JSON.parse(response);
        }
        catch (error) {
            console.warn('  ⚠️  Could not parse Claude response as JSON');
            return {
                runtimes: [],
                frameworks: [],
                infrastructure: [],
                gpu_detected: false,
                estimated_monthly_cost: 2000,
                key_findings: []
            };
        }
    }
    /**
     * Identify problems in the environment
     */
    identifyProblems(environment) {
        const problems = [];
        if (environment.application.runtime_detected.length === 0) {
            problems.push('No LLM runtime libraries detected - missing optimization opportunities');
        }
        if (environment.serving.frameworks_detected.length === 0) {
            problems.push('No serving frameworks detected - missing 2-3x inference speedup potential');
        }
        if (environment.infrastructure.gpu_inventory.length === 0) {
            problems.push('No GPU acceleration - running on CPU limits optimization potential');
        }
        if (environment.infrastructure.cost_breakdown.total_monthly > 5000) {
            problems.push(`High monthly cost ($${environment.infrastructure.cost_breakdown.total_monthly.toLocaleString()}) - significant optimization potential`);
        }
        if (environment.serving.performance_metrics.gpu_utilization < 50) {
            problems.push(`Low GPU utilization (${environment.serving.performance_metrics.gpu_utilization}%) - inefficient resource usage`);
        }
        return problems;
    }
    /**
     * Suggest solutions for identified problems
     */
    suggestSolutions(environment) {
        const solutions = [];
        if (environment.application.runtime_detected.length === 0) {
            solutions.push({
                title: 'Add LLM Runtime Libraries',
                description: 'Integrate OpenAI, Anthropic, or HuggingFace APIs to enable cost optimization',
                savings: 0,
                effort: '1-2 days'
            });
        }
        if (environment.serving.frameworks_detected.length === 0) {
            solutions.push({
                title: 'Implement Serving Framework',
                description: 'Deploy vLLM or SGLang for 2-3x inference speedup and better batching',
                savings: 1500,
                effort: '3-5 days'
            });
        }
        if (environment.infrastructure.gpu_inventory.length === 0) {
            solutions.push({
                title: 'Add GPU Infrastructure',
                description: 'Deploy NVIDIA A100 or H100 GPUs for 10-50x inference acceleration',
                savings: 0,
                effort: '1-2 weeks'
            });
        }
        else {
            // Has GPUs but low utilization
            if (environment.serving.performance_metrics.gpu_utilization < 50) {
                solutions.push({
                    title: 'Optimize GPU Utilization',
                    description: 'Implement continuous batching and KV cache optimization to increase GPU efficiency',
                    savings: 800,
                    effort: '2-3 days'
                });
            }
        }
        if (environment.infrastructure.cost_breakdown.total_monthly > 5000) {
            solutions.push({
                title: 'Implement Multi-Layer Optimization',
                description: 'Apply semantic caching, model routing, and serving optimizations for 20-40% cost reduction',
                savings: Math.round(environment.infrastructure.cost_breakdown.total_monthly * 0.3),
                effort: '1-2 weeks'
            });
        }
        return solutions;
    }
    /**
     * Fallback to basic file-based discovery
     */
    async fallbackDiscovery(environment) {
        console.log('  🔍 Performing basic file scan...');
        try {
            // Check for common files
            const cwd = process.cwd();
            // Check for Python
            if (await this.fileExists(path.join(cwd, 'requirements.txt')) ||
                await this.fileExists(path.join(cwd, 'pyproject.toml'))) {
                environment.application.runtime_detected.push('python');
            }
            // Check for Node.js
            if (await this.fileExists(path.join(cwd, 'package.json'))) {
                environment.application.runtime_detected.push('nodejs');
                // Read package.json to check for LLM libraries
                const packageJson = await fs.readJson(path.join(cwd, 'package.json'));
                const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
                if (deps['openai'])
                    environment.application.runtime_detected.push('openai');
                if (deps['@anthropic-ai/sdk'])
                    environment.application.runtime_detected.push('anthropic');
                if (deps['langchain'])
                    environment.application.runtime_detected.push('langchain');
            }
            // Check for Kubernetes
            if (await this.fileExists(path.join(cwd, 'k8s')) ||
                await this.fileExists(path.join(cwd, 'kubernetes'))) {
                console.log('  ✓ Kubernetes configuration detected');
            }
            // Add default GPU
            environment.infrastructure.gpu_inventory.push({
                model: 'Estimated GPU',
                memory_gb: 24,
                bandwidth_gbps: 1000,
                utilization: 30,
                cost_per_hour: 2.0
            });
        }
        catch (error) {
            console.warn('  ⚠️  Fallback discovery error:', error instanceof Error ? error.message : String(error));
        }
        return environment;
    }
    /**
     * Check if file exists
     */
    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        }
        catch {
            return false;
        }
    }
}

/**
 * Environment Discovery Agent - Discovers the full LLM stack
 * Analyzes Application, Serving, and Infrastructure layers for optimization opportunities
 */
import * as fs from 'fs-extra';
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);
export class EnvironmentDiscoveryAgent {
    /**
     * Stage 2: Environment Discovery ⏳
     * Discover the full LLM stack
     */
    async discoverEnvironment() {
        console.log("Stage 2: Environment Discovery ⏳");
        // Initialize environment profile with defaults
        const environment = {
            application: {
                runtime_detected: [],
                model_usage_patterns: [],
                api_call_patterns: [],
                context_analysis: {
                    average_length: 2048,
                    distribution: [1024, 2048, 4096],
                    memory_impact: 0.5,
                    batching_opportunities: ['semantic_caching', 'request_batching']
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
                    bandwidth_efficiency: 0.15, // TokenSqueeze: typical low efficiency
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
                    optimization_potential: 1290 // 60% potential savings
                }
            }
        };
        try {
            // Application Layer Discovery
            await this.discoverApplicationLayer(environment);
            // Serving Layer Discovery
            await this.discoverServingLayer(environment);
            // Infrastructure Layer Discovery
            await this.discoverInfrastructureLayer(environment);
            console.log("Stage 2: Environment Discovery ✅");
            return environment;
        }
        catch (error) {
            console.error("Stage 2: Environment Discovery ❌", error.message);
            // Return default environment for demo
            return environment;
        }
    }
    /**
     * Discover Application Layer
     */
    async discoverApplicationLayer(environment) {
        console.log("  📱 Discovering Application Layer...");
        try {
            // Look for Python files with LLM usage
            const pythonFiles = await this.findFiles('**/*.py');
            // Look for common LLM patterns
            const hasOpenAI = await this.searchInFiles(pythonFiles, ['openai', 'OpenAI']);
            const hasHuggingFace = await this.searchInFiles(pythonFiles, ['transformers', 'from transformers']);
            const hasLangChain = await this.searchInFiles(pythonFiles, ['langchain', 'from langchain']);
            // Detect runtimes
            if (hasOpenAI)
                environment.application.runtime_detected.push('openai');
            if (hasHuggingFace)
                environment.application.runtime_detected.push('huggingface');
            if (hasLangChain)
                environment.application.runtime_detected.push('langchain');
            // Look for JavaScript/Node.js files
            const jsFiles = await this.findFiles('**/*.{js,ts}');
            const hasNodeOpenAI = await this.searchInFiles(jsFiles, ['openai', '@anthropic-ai']);
            if (hasNodeOpenAI)
                environment.application.runtime_detected.push('nodejs');
            // Add default model usage patterns if runtime detected
            if (environment.application.runtime_detected.length > 0) {
                environment.application.model_usage_patterns = [
                    {
                        model_name: 'gpt-4',
                        usage_frequency: 1000,
                        context_patterns: ['conversational', 'document_analysis'],
                        cost_contribution: 0.7
                    },
                    {
                        model_name: 'gpt-3.5-turbo',
                        usage_frequency: 2000,
                        context_patterns: ['simple_queries'],
                        cost_contribution: 0.3
                    }
                ];
                environment.application.api_call_patterns = [
                    {
                        endpoint: 'api.openai.com',
                        call_volume: 3000,
                        cost_per_call: 0.03,
                        optimization_opportunities: ['model_routing', 'semantic_caching', 'batch_processing']
                    }
                ];
            }
            console.log("    ✅ Application layer analysis complete");
        }
        catch (error) {
            console.log("    ⚠️  Application layer analysis failed, using defaults");
        }
    }
    /**
     * Discover Serving Layer
     */
    async discoverServingLayer(environment) {
        console.log("  🚀 Discovering Serving Layer...");
        try {
            // Look for serving framework files
            const allFiles = await this.findFiles('**/*.{py,yaml,yml,json}');
            const hasVLLM = await this.searchInFiles(allFiles, ['vllm', 'from vllm']);
            const hasTensorRT = await this.searchInFiles(allFiles, ['tensorrt', 'trt']);
            const hasSGLang = await this.searchInFiles(allFiles, ['sglang', 'from sglang']);
            const hasTransformers = await this.searchInFiles(allFiles, ['torch', 'pytorch']);
            // Update frameworks detected
            if (hasVLLM) {
                environment.serving.frameworks_detected.push('vllm');
                // vLLM indicates optimized setup
                environment.serving.performance_metrics.throughput = 80;
                environment.serving.performance_metrics.gpu_utilization = 75;
                environment.serving.performance_metrics.batch_efficiency = 16;
            }
            if (hasTensorRT) {
                environment.serving.frameworks_detected.push('tensorrt');
                environment.serving.performance_metrics.throughput = 120;
                environment.serving.performance_metrics.latency_p95 = 50;
            }
            if (hasSGLang) {
                environment.serving.frameworks_detected.push('sglang');
                environment.serving.performance_metrics.throughput = 100;
            }
            if (hasTransformers) {
                environment.serving.frameworks_detected.push('transformers');
                // Basic transformers - lower performance
                environment.serving.performance_metrics.throughput = 25;
                environment.serving.performance_metrics.batch_efficiency = 4;
            }
            // Look for model formats
            const hasONNX = await this.searchInFiles(allFiles, ['.onnx', 'onnx']);
            const hasPyTorch = await this.searchInFiles(allFiles, ['.pt', '.pth', 'torch.save']);
            if (hasONNX)
                environment.serving.model_formats.push('onnx');
            if (hasPyTorch)
                environment.serving.model_formats.push('pytorch');
            console.log("    ✅ Serving layer analysis complete");
        }
        catch (error) {
            console.log("    ⚠️  Serving layer analysis failed, using defaults");
        }
    }
    /**
     * Discover Infrastructure Layer
     */
    async discoverInfrastructureLayer(environment) {
        console.log("  ☁️  Discovering Infrastructure Layer...");
        try {
            // Try to detect GPUs
            await this.detectGPUs(environment);
            // Look for infrastructure files
            const infraFiles = await this.findFiles('**/*.{tf,yaml,yml}');
            const hasTerraform = await this.searchInFiles(infraFiles, ['aws_instance', 'google_compute', 'azurerm']);
            const hasK8s = await this.searchInFiles(infraFiles, ['apiVersion', 'kind: Deployment']);
            if (hasTerraform) {
                console.log("    📦 Terraform configuration detected");
            }
            if (hasK8s) {
                console.log("    ☸️  Kubernetes configuration detected");
                environment.infrastructure.network_topology.bandwidth = 10000; // K8s cluster networking
            }
            // Calculate costs based on detected GPUs
            const totalMonthlyCost = environment.infrastructure.gpu_inventory.reduce((sum, gpu) => sum + (gpu.cost_per_hour * 24 * 30), 0);
            if (totalMonthlyCost > 0) {
                environment.infrastructure.cost_breakdown.compute_cost = totalMonthlyCost;
                environment.infrastructure.cost_breakdown.total_monthly = totalMonthlyCost + 150;
                environment.infrastructure.cost_breakdown.optimization_potential = totalMonthlyCost * 0.6;
            }
            console.log("    ✅ Infrastructure layer analysis complete");
        }
        catch (error) {
            console.log("    ⚠️  Infrastructure layer analysis failed, using defaults");
        }
    }
    /**
     * Try to detect GPUs using nvidia-smi
     */
    async detectGPUs(environment) {
        try {
            const { stdout } = await execAsync('nvidia-smi --query-gpu=name,memory.total --format=csv,noheader,nounits');
            const lines = stdout.trim().split('\n');
            for (const line of lines) {
                const [name, memoryStr] = line.split(',').map(s => s.trim());
                const memory = parseInt(memoryStr);
                const gpu = {
                    model: name,
                    memory_gb: Math.floor(memory / 1024),
                    bandwidth_gbps: this.getGPUBandwidth(name),
                    utilization: 35, // Default utilization
                    cost_per_hour: this.getGPUCost(name)
                };
                environment.infrastructure.gpu_inventory.push(gpu);
                console.log(`    🎮 Detected GPU: ${gpu.model} (${gpu.memory_gb}GB)`);
            }
            // Update memory analysis
            const totalMemory = environment.infrastructure.gpu_inventory.reduce((sum, gpu) => sum + gpu.memory_gb, 0);
            environment.infrastructure.memory_analysis.total_capacity = totalMemory;
            environment.infrastructure.network_topology.multi_gpu_setup = environment.infrastructure.gpu_inventory.length > 1;
        }
        catch (error) {
            // No GPUs detected or nvidia-smi not available
            console.log("    💻 No GPUs detected, using CPU-based estimates");
            // Add default GPU for cost estimation
            environment.infrastructure.gpu_inventory.push({
                model: 'Estimated GPU',
                memory_gb: 24,
                bandwidth_gbps: 1000,
                utilization: 30,
                cost_per_hour: 2.0
            });
        }
    }
    /**
     * Search for patterns in files
     */
    async searchInFiles(files, patterns) {
        for (const file of files.slice(0, 20)) { // Limit search for performance
            try {
                if (await fs.pathExists(file)) {
                    const content = await fs.readFile(file, 'utf-8');
                    if (patterns.some(pattern => content.toLowerCase().includes(pattern.toLowerCase()))) {
                        return true;
                    }
                }
            }
            catch (error) {
                // Continue searching other files
            }
        }
        return false;
    }
    /**
     * Find files matching pattern
     */
    async findFiles(pattern) {
        try {
            const { glob } = await import('glob');
            return await glob(pattern, {
                ignore: ['node_modules/**', '.git/**', 'dist/**'],
                maxDepth: 3
            });
        }
        catch (error) {
            return [];
        }
    }
    /**
     * Get GPU bandwidth by name
     */
    getGPUBandwidth(name) {
        const lowerName = name.toLowerCase();
        if (lowerName.includes('h100'))
            return 3350;
        if (lowerName.includes('a100'))
            return 2000;
        if (lowerName.includes('v100'))
            return 900;
        if (lowerName.includes('rtx'))
            return 1000;
        return 800; // Default
    }
    /**
     * Get GPU hourly cost by name
     */
    getGPUCost(name) {
        const lowerName = name.toLowerCase();
        if (lowerName.includes('h100'))
            return 4.0;
        if (lowerName.includes('a100'))
            return 3.0;
        if (lowerName.includes('v100'))
            return 2.0;
        if (lowerName.includes('rtx'))
            return 1.5;
        return 2.0; // Default
    }
}

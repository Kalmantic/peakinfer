/**
 * Hardware Detector
 * Detects GPUs, TPUs, accelerators, serving runtimes, and parallelization strategies
 * from code, config files, and environment.
 */

import fs from 'fs-extra';
import * as path from 'path';
import { glob } from 'glob';
import * as yaml from 'yaml';

import {
  HardwareProfile,
  HardwareSummary,
  DetectedGPU,
  DetectedTPU,
  DetectedAccelerator,
  DetectedServingRuntime,
  DetectedParallelization,
  DetectedQuantization,
  DetectedKubernetesGPU,
  DetectedDockerGPU,
  DetectedModalGPU,
  DetectedCloudInstance,
  GPUEnvironment,
  ServingRuntimeType,
  ParallelizationStrategy,
  QuantizationMethod,
  AcceleratorType,
  CloudProvider,
} from '../types/hardware.js';

// =============================================================================
// GPU SPECS FOR IDENTIFICATION
// =============================================================================

const GPU_MEMORY_MAP: Record<string, number> = {
  'H200': 141,
  'H100': 80,
  'H100-SXM': 80,
  'H100-PCIe': 80,
  'A100-80GB': 80,
  'A100-40GB': 40,
  'A100': 80,
  'A10G': 24,
  'A10': 24,
  'L40S': 48,
  'L40': 48,
  'L4': 24,
  'V100': 32,
  'T4': 16,
  'RTX 4090': 24,
  'RTX 3090': 24,
  'RTX A6000': 48,
  'MI300X': 192,
  'MI250X': 128,
};

const CLOUD_INSTANCE_GPU_MAP: Record<string, { gpu: string; count: number }> = {
  // AWS
  'p5.48xlarge': { gpu: 'H100', count: 8 },
  'p4d.24xlarge': { gpu: 'A100', count: 8 },
  'p4de.24xlarge': { gpu: 'A100-80GB', count: 8 },
  'p3.16xlarge': { gpu: 'V100', count: 8 },
  'p3.8xlarge': { gpu: 'V100', count: 4 },
  'p3.2xlarge': { gpu: 'V100', count: 1 },
  'g5.48xlarge': { gpu: 'A10G', count: 8 },
  'g5.12xlarge': { gpu: 'A10G', count: 4 },
  'g5.xlarge': { gpu: 'A10G', count: 1 },
  'g4dn.xlarge': { gpu: 'T4', count: 1 },
  'g4dn.12xlarge': { gpu: 'T4', count: 4 },
  'inf2.xlarge': { gpu: 'Inferentia2', count: 1 },
  'inf2.48xlarge': { gpu: 'Inferentia2', count: 12 },
  'trn1.32xlarge': { gpu: 'Trainium', count: 16 },
  'trn1.2xlarge': { gpu: 'Trainium', count: 1 },
  // GCP
  'a3-highgpu-8g': { gpu: 'H100', count: 8 },
  'a2-highgpu-8g': { gpu: 'A100', count: 8 },
  'a2-highgpu-4g': { gpu: 'A100', count: 4 },
  'a2-highgpu-2g': { gpu: 'A100', count: 2 },
  'a2-highgpu-1g': { gpu: 'A100', count: 1 },
  'n1-standard-8-t4': { gpu: 'T4', count: 1 },
  // Azure
  'Standard_ND96asr_v4': { gpu: 'A100', count: 8 },
  'Standard_NC96ads_A100_v4': { gpu: 'A100', count: 4 },
  'Standard_ND96isr_H100_v5': { gpu: 'H100', count: 8 },
};

// =============================================================================
// MAIN DETECTOR CLASS
// =============================================================================

export class HardwareDetector {
  private codebasePath: string;
  private verbose: boolean;

  constructor(codebasePath: string, verbose = false) {
    this.codebasePath = codebasePath;
    this.verbose = verbose;
  }

  /**
   * Run full hardware detection
   */
  async detect(): Promise<HardwareProfile> {
    this.log('Starting hardware detection...');

    const [
      gpuEnv,
      gpusFromCode,
      tpus,
      accelerators,
      servingRuntimes,
      parallelization,
      quantization,
      kubernetes,
      docker,
      modal,
      cloudInstances,
    ] = await Promise.all([
      this.detectGPUEnvironment(),
      this.detectGPUsFromCode(),
      this.detectTPUs(),
      this.detectAccelerators(),
      this.detectServingRuntimes(),
      this.detectParallelization(),
      this.detectQuantization(),
      this.detectKubernetesGPU(),
      this.detectDockerGPU(),
      this.detectModalGPU(),
      this.detectCloudInstances(),
    ]);

    // Merge GPU detections
    const allGPUs = [
      ...gpusFromCode,
      ...this.gpusFromKubernetes(kubernetes),
      ...this.gpusFromDocker(docker),
      ...this.gpusFromModal(modal),
      ...this.gpusFromCloud(cloudInstances),
    ];

    const profile: HardwareProfile = {
      gpus: this.deduplicateGPUs(allGPUs),
      tpus,
      accelerators,
      servingRuntimes,
      parallelization,
      quantization,
      kubernetes,
      docker,
      modal,
      cloudInstances,
      environment: gpuEnv,
      summary: this.buildSummary(allGPUs, tpus, accelerators, servingRuntimes, parallelization),
    };

    this.log(`Hardware detection complete: ${profile.summary.totalGPUs} GPUs found`);
    return profile;
  }

  // ===========================================================================
  // GPU ENVIRONMENT DETECTION
  // ===========================================================================

  private async detectGPUEnvironment(): Promise<GPUEnvironment> {
    const env: GPUEnvironment = {};

    // Check .env files
    const envFiles = await glob('**/.env*', {
      cwd: this.codebasePath,
      ignore: ['**/node_modules/**', '**/.git/**'],
      absolute: true,
    });

    for (const envFile of envFiles) {
      try {
        const content = await fs.readFile(envFile, 'utf-8');

        const cudaMatch = content.match(/CUDA_VISIBLE_DEVICES\s*=\s*["']?([^"'\n]+)/);
        if (cudaMatch) env.cudaVisible = cudaMatch[1];

        const nvidiaMatch = content.match(/NVIDIA_VISIBLE_DEVICES\s*=\s*["']?([^"'\n]+)/);
        if (nvidiaMatch) env.nvidiaVisible = nvidiaMatch[1];

        const cudaVersionMatch = content.match(/CUDA_VERSION\s*=\s*["']?([^"'\n]+)/);
        if (cudaVersionMatch) env.cudaVersion = cudaVersionMatch[1];
      } catch (e) {
        // Skip unreadable files
      }
    }

    // Also check docker-compose for environment
    const dockerFiles = await glob('**/docker-compose*.{yml,yaml}', {
      cwd: this.codebasePath,
      ignore: ['**/node_modules/**'],
      absolute: true,
    });

    for (const dockerFile of dockerFiles) {
      try {
        const content = await fs.readFile(dockerFile, 'utf-8');
        const parsed = yaml.parse(content);

        for (const service of Object.values(parsed.services || {})) {
          const svc = service as any;
          if (svc.environment) {
            const envList = Array.isArray(svc.environment) ? svc.environment : Object.entries(svc.environment).map(([k, v]) => `${k}=${v}`);
            for (const e of envList) {
              if (typeof e === 'string') {
                if (e.startsWith('CUDA_VISIBLE_DEVICES=')) env.cudaVisible = e.split('=')[1];
                if (e.startsWith('NVIDIA_VISIBLE_DEVICES=')) env.nvidiaVisible = e.split('=')[1];
              }
            }
          }
        }
      } catch (e) {
        // Skip parse errors
      }
    }

    return env;
  }

  // ===========================================================================
  // GPU DETECTION FROM CODE
  // ===========================================================================

  private async detectGPUsFromCode(): Promise<DetectedGPU[]> {
    const gpus: DetectedGPU[] = [];

    const codeFiles = await glob('**/*.{py,ts,js,yaml,yml,json,toml}', {
      cwd: this.codebasePath,
      ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**'],
      absolute: true,
    });

    for (const file of codeFiles) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const detected = this.extractGPUsFromContent(content, file);
        gpus.push(...detected);
      } catch (e) {
        // Skip unreadable files
      }
    }

    return gpus;
  }

  private extractGPUsFromContent(content: string, location: string): DetectedGPU[] {
    const gpus: DetectedGPU[] = [];

    // Pattern: gpu="H100", gpu='A100', etc.
    const gpuStringPatterns = [
      /gpu\s*[=:]\s*["']([A-Z]\d+[A-Za-z0-9-]*)["']/gi,
      /gpu_type\s*[=:]\s*["']([A-Z]\d+[A-Za-z0-9-]*)["']/gi,
      /accelerator_type\s*[=:]\s*["']([^"']+gpu[^"']*)["']/gi,
      /--gpu[_-]?type[=\s]+["']?([A-Z]\d+[A-Za-z0-9-]*)["']?/gi,
    ];

    for (const pattern of gpuStringPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const gpuType = this.normalizeGPUType(match[1]);
        if (gpuType) {
          gpus.push({
            type: gpuType,
            count: 1,
            memory: GPU_MEMORY_MAP[gpuType],
            source: 'code_import',
            confidence: 0.8,
            location,
          });
        }
      }
    }

    // Pattern: num_gpus=8, gpu_count=4
    const gpuCountPatterns = [
      /num_gpus\s*[=:]\s*(\d+)/gi,
      /gpu_count\s*[=:]\s*(\d+)/gi,
      /n_gpu\s*[=:]\s*(\d+)/gi,
      /--num[_-]?gpus?\s+(\d+)/gi,
    ];

    for (const pattern of gpuCountPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const count = parseInt(match[1], 10);
        if (count > 0 && !gpus.some(g => g.location === location)) {
          gpus.push({
            type: 'unknown',
            count,
            source: 'code_import',
            confidence: 0.6,
            location,
          });
        }
      }
    }

    // CUDA device patterns
    if (/torch\.cuda\.device_count\(\)|cuda\.device_count/i.test(content)) {
      gpus.push({
        type: 'CUDA GPU',
        count: 1,
        source: 'code_import',
        confidence: 0.5,
        location,
      });
    }

    return gpus;
  }

  private normalizeGPUType(raw: string): string | null {
    const upper = raw.toUpperCase();

    if (upper.includes('H100')) return 'H100';
    if (upper.includes('H200')) return 'H200';
    if (upper.includes('A100')) return upper.includes('80') ? 'A100-80GB' : 'A100';
    if (upper.includes('A10G')) return 'A10G';
    if (upper.includes('A10')) return 'A10';
    if (upper.includes('L40S')) return 'L40S';
    if (upper.includes('L40')) return 'L40';
    if (upper.includes('L4')) return 'L4';
    if (upper.includes('V100')) return 'V100';
    if (upper.includes('T4')) return 'T4';
    if (upper.includes('4090')) return 'RTX 4090';
    if (upper.includes('3090')) return 'RTX 3090';
    if (upper.includes('MI300')) return 'MI300X';
    if (upper.includes('MI250')) return 'MI250X';

    return null;
  }

  // ===========================================================================
  // TPU DETECTION
  // ===========================================================================

  private async detectTPUs(): Promise<DetectedTPU[]> {
    const tpus: DetectedTPU[] = [];

    const files = await glob('**/*.{py,yaml,yml,json}', {
      cwd: this.codebasePath,
      ignore: ['**/node_modules/**', '**/.git/**'],
      absolute: true,
    });

    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');

        // JAX TPU patterns
        if (/jax\.devices\s*\(\s*['"]tpu['"]\s*\)/i.test(content)) {
          tpus.push({ type: 'TPU', count: 1, source: 'jax', location: file });
        }

        // TPU_NAME environment
        if (/TPU_NAME|TPU_WORKER_ID|XRT_TPU_CONFIG/i.test(content)) {
          tpus.push({ type: 'TPU', count: 1, source: 'environment', location: file });
        }

        // GCP TPU configs
        const tpuTypeMatch = content.match(/accelerator[_-]?type\s*[=:]\s*["']?(v[45][ep]?-\d+)["']?/i);
        if (tpuTypeMatch) {
          tpus.push({
            type: tpuTypeMatch[1].toUpperCase(),
            topology: tpuTypeMatch[1],
            count: 1,
            source: 'gcp_config',
            location: file,
          });
        }

        // ct5lp-hightpu instance types
        if (/ct5lp-hightpu|tpu-v[45]/i.test(content)) {
          tpus.push({ type: 'TPU v5', count: 1, source: 'instance_type', location: file });
        }
      } catch (e) {
        // Skip
      }
    }

    return tpus;
  }

  // ===========================================================================
  // ACCELERATOR DETECTION (Inferentia, Gaudi, Groq, etc.)
  // ===========================================================================

  private async detectAccelerators(): Promise<DetectedAccelerator[]> {
    const accelerators: DetectedAccelerator[] = [];

    const files = await glob('**/*.{py,ts,js,yaml,yml}', {
      cwd: this.codebasePath,
      ignore: ['**/node_modules/**', '**/.git/**'],
      absolute: true,
    });

    const patterns: { pattern: RegExp; type: AcceleratorType; name: string }[] = [
      { pattern: /neuronx|aws[_-]?neuron|inf2\./i, type: 'aws_inferentia', name: 'AWS Inferentia2' },
      { pattern: /trainium|trn1\./i, type: 'aws_trainium', name: 'AWS Trainium' },
      { pattern: /habana|gaudi|HABANA_VISIBLE_DEVICES/i, type: 'intel_gaudi', name: 'Intel Gaudi' },
      { pattern: /from groq|import groq|groq\.com/i, type: 'groq_lpu', name: 'Groq LPU' },
      { pattern: /cerebras|wse-|cs-2/i, type: 'cerebras_wse', name: 'Cerebras WSE' },
      { pattern: /sambanova|sn40l/i, type: 'sambanova', name: 'SambaNova' },
      { pattern: /graphcore|poptorch|ipu/i, type: 'graphcore_ipu', name: 'Graphcore IPU' },
      { pattern: /ROCR_VISIBLE_DEVICES|rocm|hip_visible/i, type: 'amd_gpu', name: 'AMD GPU (ROCm)' },
    ];

    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');

        for (const { pattern, type, name } of patterns) {
          if (pattern.test(content)) {
            accelerators.push({
              type,
              name,
              count: 1,
              source: file,
              location: file,
            });
          }
        }
      } catch (e) {
        // Skip
      }
    }

    return accelerators;
  }

  // ===========================================================================
  // SERVING RUNTIME DETECTION
  // ===========================================================================

  private async detectServingRuntimes(): Promise<DetectedServingRuntime[]> {
    const runtimes: DetectedServingRuntime[] = [];

    const files = await glob('**/*.{py,ts,js,yaml,yml,toml,json,sh}', {
      cwd: this.codebasePath,
      ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**'],
      absolute: true,
    });

    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const detected = this.detectRuntimesInContent(content, file);
        runtimes.push(...detected);
      } catch (e) {
        // Skip
      }
    }

    // Also check for model files
    const modelFiles = await glob('**/*.{gguf,ggml,exl2,engine,safetensors}', {
      cwd: this.codebasePath,
      ignore: ['**/node_modules/**'],
      absolute: true,
    });

    for (const modelFile of modelFiles) {
      const ext = path.extname(modelFile).toLowerCase();
      if (ext === '.gguf' || ext === '.ggml') {
        runtimes.push({
          runtime: 'llama_cpp',
          config: { modelPath: modelFile },
          location: modelFile,
          confidence: 0.9,
        });
      } else if (ext === '.exl2') {
        runtimes.push({
          runtime: 'exllamav2',
          config: { modelPath: modelFile },
          location: modelFile,
          confidence: 0.9,
        });
      } else if (ext === '.engine') {
        runtimes.push({
          runtime: 'tensorrt_llm',
          config: { modelPath: modelFile },
          location: modelFile,
          confidence: 0.9,
        });
      }
    }

    return this.deduplicateRuntimes(runtimes);
  }

  private detectRuntimesInContent(content: string, location: string): DetectedServingRuntime[] {
    const runtimes: DetectedServingRuntime[] = [];

    // vLLM
    if (/from vllm|import vllm|LLM\s*\(|SamplingParams|--served-model-name/i.test(content)) {
      const config: any = {};

      const tpMatch = content.match(/tensor[_-]?parallel[_-]?size\s*[=:]\s*(\d+)/i);
      if (tpMatch) config.tensorParallelSize = parseInt(tpMatch[1], 10);

      const ppMatch = content.match(/pipeline[_-]?parallel[_-]?size\s*[=:]\s*(\d+)/i);
      if (ppMatch) config.pipelineParallelSize = parseInt(ppMatch[1], 10);

      const memMatch = content.match(/gpu[_-]?memory[_-]?utilization\s*[=:]\s*([0-9.]+)/i);
      if (memMatch) config.gpuMemoryUtilization = parseFloat(memMatch[1]);

      const prefixMatch = content.match(/enable[_-]?prefix[_-]?caching\s*[=:]\s*(true|True|1)/i);
      if (prefixMatch) config.enablePrefixCaching = true;

      runtimes.push({ runtime: 'vllm', config, location, confidence: 0.95 });
    }

    // SGLang
    if (/from sglang|import sglang|RuntimeEndpoint|@sgl\.function|sglang\.launch_server/i.test(content)) {
      const config: any = {};

      const tpMatch = content.match(/tp\s*[=:]\s*(\d+)|--tp\s+(\d+)/i);
      if (tpMatch) config.tensorParallelSize = parseInt(tpMatch[1] || tpMatch[2], 10);

      runtimes.push({ runtime: 'sglang', config, location, confidence: 0.95 });
    }

    // TensorRT-LLM
    if (/tensorrt_llm|trtllm|\.engine|TRTLLMModel/i.test(content)) {
      runtimes.push({ runtime: 'tensorrt_llm', config: {}, location, confidence: 0.9 });
    }

    // Text Generation Inference (TGI)
    if (/text_generation|huggingface.*tgi|--model-id.*--/i.test(content)) {
      runtimes.push({ runtime: 'tgi', config: {}, location, confidence: 0.85 });
    }

    // llama.cpp
    if (/llama_cpp|from llama_cpp|Llama\s*\(|llama\.cpp|llama-server/i.test(content)) {
      const config: any = {};

      const gpuLayersMatch = content.match(/n_gpu_layers\s*[=:]\s*(-?\d+)/i);
      if (gpuLayersMatch) config.gpuLayers = parseInt(gpuLayersMatch[1], 10);

      runtimes.push({ runtime: 'llama_cpp', config, location, confidence: 0.9 });
    }

    // Ollama
    if (/ollama|localhost:11434|OLLAMA_HOST/i.test(content)) {
      runtimes.push({ runtime: 'ollama', config: {}, location, confidence: 0.85 });
    }

    // LMStudio
    if (/lmstudio|localhost:1234/i.test(content)) {
      runtimes.push({ runtime: 'lmstudio', config: {}, location, confidence: 0.8 });
    }

    // MLX (Apple Silicon)
    if (/from mlx|import mlx|mlx_lm|mlx\.core/i.test(content)) {
      runtimes.push({ runtime: 'mlx', config: {}, location, confidence: 0.9 });
    }

    // ExLlamaV2
    if (/exllamav2|ExLlamaV2|\.exl2/i.test(content)) {
      runtimes.push({ runtime: 'exllamav2', config: {}, location, confidence: 0.9 });
    }

    // Triton Inference Server
    if (/tritonclient|tritonserver|model_repository/i.test(content)) {
      runtimes.push({ runtime: 'triton', config: {}, location, confidence: 0.85 });
    }

    // Ray Serve
    if (/ray\.serve|@serve\.deployment|RayServeHandle/i.test(content)) {
      runtimes.push({ runtime: 'ray_serve', config: {}, location, confidence: 0.85 });
    }

    // BentoML / OpenLLM
    if (/bentoml|@bentoml|openllm/i.test(content)) {
      runtimes.push({ runtime: 'bentoml', config: {}, location, confidence: 0.8 });
    }

    // LocalAI
    if (/localai|localhost:8080.*model/i.test(content)) {
      runtimes.push({ runtime: 'localai', config: {}, location, confidence: 0.7 });
    }

    // CTranslate2
    if (/ctranslate2|CTranslate2/i.test(content)) {
      runtimes.push({ runtime: 'ctranslate2', config: {}, location, confidence: 0.85 });
    }

    return runtimes;
  }

  // ===========================================================================
  // PARALLELIZATION DETECTION
  // ===========================================================================

  private async detectParallelization(): Promise<DetectedParallelization[]> {
    const parallelization: DetectedParallelization[] = [];

    const files = await glob('**/*.{py,yaml,yml,json}', {
      cwd: this.codebasePath,
      ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**'],
      absolute: true,
    });

    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const detected = this.detectParallelizationInContent(content, file);
        parallelization.push(...detected);
      } catch (e) {
        // Skip
      }
    }

    return parallelization;
  }

  private detectParallelizationInContent(content: string, location: string): DetectedParallelization[] {
    const results: DetectedParallelization[] = [];

    // DeepSpeed
    if (/deepspeed|from deepspeed|import deepspeed/i.test(content)) {
      const config: any = {};

      // Detect ZeRO stage
      const zeroMatch = content.match(/zero[_-]?optimization.*stage['":\s]+(\d)/i) ||
                        content.match(/stage['":\s]+(\d).*zero/i) ||
                        content.match(/ZeRO-(\d)/i);
      if (zeroMatch) {
        config.zeroStage = parseInt(zeroMatch[1], 10);
      }

      const offloadMatch = content.match(/offload[_-]?optimizer['":\s]+(true|True|1)/i);
      if (offloadMatch) config.offloadOptimizer = true;

      const offloadParamMatch = content.match(/offload[_-]?param['":\s]+(true|True|1)/i);
      if (offloadParamMatch) config.offloadParam = true;

      const strategy: ParallelizationStrategy = config.zeroStage === 3 ? 'zero_3' :
                                                 config.zeroStage === 2 ? 'zero_2' :
                                                 config.zeroStage === 1 ? 'zero_1' : 'zero_2';

      results.push({
        strategy,
        config,
        framework: 'deepspeed',
        location,
        confidence: 0.9,
      });
    }

    // PyTorch FSDP
    if (/FullyShardedDataParallel|FSDP|torch\.distributed\.fsdp/i.test(content)) {
      const config: any = {};

      const shardingMatch = content.match(/sharding[_-]?strategy\s*[=:]\s*["']?(\w+)/i);
      if (shardingMatch) config.shardingStrategy = shardingMatch[1];

      results.push({
        strategy: 'fsdp',
        config,
        framework: 'pytorch',
        location,
        confidence: 0.9,
      });
    }

    // Tensor Parallelism
    if (/tensor[_-]?parallel|--tp\s+\d|ColumnParallelLinear|RowParallelLinear/i.test(content)) {
      const config: any = {};

      const tpMatch = content.match(/tensor[_-]?parallel[_-]?size\s*[=:]\s*(\d+)|--tp\s+(\d+)/i);
      if (tpMatch) config.tensorParallelSize = parseInt(tpMatch[1] || tpMatch[2], 10);

      results.push({
        strategy: 'tensor_parallel',
        config,
        framework: 'megatron',
        location,
        confidence: 0.85,
      });
    }

    // Pipeline Parallelism
    if (/pipeline[_-]?parallel|--pp\s+\d|PipelineParallel/i.test(content)) {
      const config: any = {};

      const ppMatch = content.match(/pipeline[_-]?parallel[_-]?size\s*[=:]\s*(\d+)|--pp\s+(\d+)/i);
      if (ppMatch) config.pipelineParallelSize = parseInt(ppMatch[1] || ppMatch[2], 10);

      results.push({
        strategy: 'pipeline_parallel',
        config,
        framework: 'megatron',
        location,
        confidence: 0.85,
      });
    }

    // Data Parallelism (DDP)
    if (/DistributedDataParallel|torch\.nn\.parallel\.DDP|accelerate.*ddp/i.test(content)) {
      const config: any = {};

      const worldSizeMatch = content.match(/world[_-]?size\s*[=:]\s*(\d+)/i);
      if (worldSizeMatch) config.worldSize = parseInt(worldSizeMatch[1], 10);

      results.push({
        strategy: 'data_parallel',
        config,
        framework: 'pytorch',
        location,
        confidence: 0.85,
      });
    }

    // Megatron-LM
    if (/megatron|from megatron|import megatron/i.test(content)) {
      results.push({
        strategy: 'megatron',
        config: {},
        framework: 'megatron-lm',
        location,
        confidence: 0.9,
      });
    }

    // Accelerate
    if (/from accelerate|Accelerator\(\)/i.test(content)) {
      const config: any = {};

      // Try to detect accelerate config
      if (/mixed_precision\s*[=:]\s*["']?(fp16|bf16)/i.test(content)) {
        config.mixedPrecision = true;
      }

      results.push({
        strategy: 'data_parallel',
        config,
        framework: 'accelerate',
        location,
        confidence: 0.75,
      });
    }

    // Horovod
    if (/horovod|hvd\./i.test(content)) {
      results.push({
        strategy: 'data_parallel',
        config: {},
        framework: 'horovod',
        location,
        confidence: 0.85,
      });
    }

    return results;
  }

  // ===========================================================================
  // QUANTIZATION DETECTION
  // ===========================================================================

  private async detectQuantization(): Promise<DetectedQuantization[]> {
    const quantization: DetectedQuantization[] = [];

    const files = await glob('**/*.{py,yaml,yml,json}', {
      cwd: this.codebasePath,
      ignore: ['**/node_modules/**', '**/.git/**'],
      absolute: true,
    });

    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const detected = this.detectQuantizationInContent(content, file);
        quantization.push(...detected);
      } catch (e) {
        // Skip
      }
    }

    return quantization;
  }

  private detectQuantizationInContent(content: string, location: string): DetectedQuantization[] {
    const results: DetectedQuantization[] = [];

    // GPTQ
    if (/gptq|\.gptq\.|auto-gptq|AutoGPTQ/i.test(content)) {
      results.push({ method: 'gptq', bits: 4, location });
    }

    // AWQ
    if (/awq|\.awq\.|autoawq|AutoAWQ/i.test(content)) {
      results.push({ method: 'awq', bits: 4, location });
    }

    // bitsandbytes INT8
    if (/load_in_8bit\s*[=:]\s*(True|true|1)|LLM\.int8/i.test(content)) {
      results.push({ method: 'int8', bits: 8, location });
    }

    // bitsandbytes INT4 / NF4
    if (/load_in_4bit\s*[=:]\s*(True|true|1)|bnb_4bit|nf4/i.test(content)) {
      results.push({ method: 'nf4', bits: 4, location });
    }

    // FP8
    if (/dtype\s*[=:]\s*["']?fp8|float8|kv[_-]?cache[_-]?dtype\s*[=:]\s*["']?fp8/i.test(content)) {
      results.push({ method: 'fp8', bits: 8, location });
    }

    // FP16
    if (/dtype\s*[=:]\s*["']?float16|torch\.float16|fp16/i.test(content)) {
      results.push({ method: 'fp16', bits: 16, location });
    }

    // BF16
    if (/dtype\s*[=:]\s*["']?bfloat16|torch\.bfloat16|bf16/i.test(content)) {
      results.push({ method: 'bf16', bits: 16, location });
    }

    // SmoothQuant
    if (/smoothquant/i.test(content)) {
      results.push({ method: 'smoothquant', bits: 8, location });
    }

    // AQLM
    if (/aqlm/i.test(content)) {
      results.push({ method: 'aqlm', bits: 2, location });
    }

    // EXL2
    if (/exl2|\.exl2/i.test(content)) {
      results.push({ method: 'exl2', bits: 4, location });
    }

    return results;
  }

  // ===========================================================================
  // KUBERNETES GPU DETECTION
  // ===========================================================================

  private async detectKubernetesGPU(): Promise<DetectedKubernetesGPU[]> {
    const k8sGPUs: DetectedKubernetesGPU[] = [];

    const k8sFiles = await glob('**/*.{yaml,yml}', {
      cwd: this.codebasePath,
      ignore: ['**/node_modules/**', '**/.git/**'],
      absolute: true,
    });

    for (const file of k8sFiles) {
      try {
        const content = await fs.readFile(file, 'utf-8');

        // Check if it's a Kubernetes manifest
        if (!/apiVersion:|kind:/i.test(content)) continue;

        // nvidia.com/gpu
        const nvidiaMatch = content.match(/nvidia\.com\/gpu['":\s]+["']?(\d+)/gi);
        if (nvidiaMatch) {
          for (const match of nvidiaMatch) {
            const countMatch = match.match(/(\d+)/);
            if (countMatch) {
              k8sGPUs.push({
                resourceType: 'nvidia.com/gpu',
                requestCount: parseInt(countMatch[1], 10),
                limitCount: parseInt(countMatch[1], 10),
                location: file,
              });
            }
          }
        }

        // amd.com/gpu
        const amdMatch = content.match(/amd\.com\/gpu['":\s]+["']?(\d+)/gi);
        if (amdMatch) {
          for (const match of amdMatch) {
            const countMatch = match.match(/(\d+)/);
            if (countMatch) {
              k8sGPUs.push({
                resourceType: 'amd.com/gpu',
                requestCount: parseInt(countMatch[1], 10),
                limitCount: parseInt(countMatch[1], 10),
                location: file,
              });
            }
          }
        }

        // cloud.google.com/gke-accelerator
        if (/cloud\.google\.com\/gke-accelerator/i.test(content)) {
          const typeMatch = content.match(/gke-accelerator['":\s]+["']?([^"'\s]+)/i);
          k8sGPUs.push({
            resourceType: typeMatch ? typeMatch[1] : 'gke-accelerator',
            requestCount: 1,
            limitCount: 1,
            location: file,
          });
        }

        // Node selectors for GPU nodes
        const nodeSelectorMatch = content.match(/nodeSelector:[\s\S]*?(gpu|accelerator)['":\s]+["']?([^"'\n]+)/i);
        if (nodeSelectorMatch && !k8sGPUs.some(g => g.location === file)) {
          k8sGPUs.push({
            resourceType: 'nodeSelector',
            requestCount: 1,
            limitCount: 1,
            nodeSelector: { [nodeSelectorMatch[1]]: nodeSelectorMatch[2] },
            location: file,
          });
        }
      } catch (e) {
        // Skip parse errors
      }
    }

    return k8sGPUs;
  }

  // ===========================================================================
  // DOCKER GPU DETECTION
  // ===========================================================================

  private async detectDockerGPU(): Promise<DetectedDockerGPU[]> {
    const dockerGPUs: DetectedDockerGPU[] = [];

    const dockerFiles = await glob('**/docker-compose*.{yaml,yml}', {
      cwd: this.codebasePath,
      ignore: ['**/node_modules/**'],
      absolute: true,
    });

    const dockerfileFiles = await glob('**/Dockerfile*', {
      cwd: this.codebasePath,
      ignore: ['**/node_modules/**'],
      absolute: true,
    });

    // docker-compose
    for (const file of dockerFiles) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const parsed = yaml.parse(content);

        for (const [serviceName, service] of Object.entries(parsed.services || {})) {
          const svc = service as any;

          // deploy.resources.reservations.devices
          const devices = svc?.deploy?.resources?.reservations?.devices;
          if (devices) {
            for (const device of devices) {
              if (device.driver === 'nvidia' || device.capabilities?.includes('gpu')) {
                dockerGPUs.push({
                  runtime: 'nvidia',
                  count: device.count || 'all',
                  capabilities: device.capabilities,
                  location: file,
                });
              }
            }
          }

          // runtime: nvidia
          if (svc?.runtime === 'nvidia') {
            dockerGPUs.push({
              runtime: 'nvidia',
              count: 'all',
              location: file,
            });
          }
        }
      } catch (e) {
        // Skip
      }
    }

    // Dockerfile
    for (const file of dockerfileFiles) {
      try {
        const content = await fs.readFile(file, 'utf-8');

        // FROM nvidia/cuda
        if (/FROM\s+nvidia\/cuda/i.test(content)) {
          dockerGPUs.push({
            runtime: 'nvidia',
            location: file,
          });
        }

        // --gpus flag hint in comments or entrypoint
        if (/--gpus|NVIDIA_VISIBLE_DEVICES/i.test(content)) {
          if (!dockerGPUs.some(g => g.location === file)) {
            dockerGPUs.push({
              runtime: 'nvidia',
              location: file,
            });
          }
        }
      } catch (e) {
        // Skip
      }
    }

    return dockerGPUs;
  }

  // ===========================================================================
  // MODAL GPU DETECTION
  // ===========================================================================

  private async detectModalGPU(): Promise<DetectedModalGPU[]> {
    const modalGPUs: DetectedModalGPU[] = [];

    const pyFiles = await glob('**/*.py', {
      cwd: this.codebasePath,
      ignore: ['**/node_modules/**', '**/.git/**', '**/venv/**'],
      absolute: true,
    });

    for (const file of pyFiles) {
      try {
        const content = await fs.readFile(file, 'utf-8');

        // @app.function(gpu="H100")
        // @stub.function(gpu=modal.gpu.A100(count=2))
        const gpuPatterns = [
          /gpu\s*=\s*["']([A-Z]\d+[A-Za-z0-9-]*)["']/gi,
          /gpu\s*=\s*modal\.gpu\.([A-Z]\d+)\s*\(\s*count\s*=\s*(\d+)/gi,
          /gpu\s*=\s*modal\.gpu\.([A-Z]\d+)/gi,
        ];

        for (const pattern of gpuPatterns) {
          let match;
          while ((match = pattern.exec(content)) !== null) {
            const gpuType = match[1].toUpperCase();
            const count = match[2] ? parseInt(match[2], 10) : 1;

            modalGPUs.push({
              gpuType,
              count,
              memory: GPU_MEMORY_MAP[gpuType],
              location: file,
            });
          }
        }
      } catch (e) {
        // Skip
      }
    }

    return modalGPUs;
  }

  // ===========================================================================
  // CLOUD INSTANCE DETECTION
  // ===========================================================================

  private async detectCloudInstances(): Promise<DetectedCloudInstance[]> {
    const instances: DetectedCloudInstance[] = [];

    const files = await glob('**/*.{tf,yaml,yml,json,py,ts,js}', {
      cwd: this.codebasePath,
      ignore: ['**/node_modules/**', '**/.git/**'],
      absolute: true,
    });

    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');

        // AWS instance types
        for (const [instanceType, gpuInfo] of Object.entries(CLOUD_INSTANCE_GPU_MAP)) {
          if (content.includes(instanceType)) {
            instances.push({
              provider: this.getProviderFromInstanceType(instanceType),
              instanceType,
              gpuType: gpuInfo.gpu,
              gpuCount: gpuInfo.count,
              location: file,
            });
          }
        }

        // AWS region detection
        const regionMatch = content.match(/region\s*[=:]\s*["']?(us-[a-z]+-\d|eu-[a-z]+-\d|ap-[a-z]+-\d)/i);
        if (regionMatch && instances.length > 0) {
          instances[instances.length - 1].region = regionMatch[1];
        }
      } catch (e) {
        // Skip
      }
    }

    return instances;
  }

  private getProviderFromInstanceType(instanceType: string): CloudProvider {
    if (instanceType.startsWith('p') || instanceType.startsWith('g') || instanceType.startsWith('inf') || instanceType.startsWith('trn')) {
      return 'aws';
    }
    if (instanceType.includes('highgpu') || instanceType.startsWith('a2') || instanceType.startsWith('a3')) {
      return 'gcp';
    }
    if (instanceType.startsWith('Standard_N')) {
      return 'azure';
    }
    return 'aws';
  }

  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================

  private gpusFromKubernetes(k8s: DetectedKubernetesGPU[]): DetectedGPU[] {
    return k8s.map(k => ({
      type: k.resourceType.includes('nvidia') ? 'NVIDIA GPU' : 'GPU',
      count: k.requestCount,
      source: 'kubernetes' as const,
      confidence: 0.85,
      location: k.location,
    }));
  }

  private gpusFromDocker(docker: DetectedDockerGPU[]): DetectedGPU[] {
    return docker.map(d => ({
      type: d.runtime === 'nvidia' ? 'NVIDIA GPU' : 'GPU',
      count: typeof d.count === 'number' ? d.count : 1,
      source: 'docker_compose' as const,
      confidence: 0.8,
      location: d.location,
    }));
  }

  private gpusFromModal(modal: DetectedModalGPU[]): DetectedGPU[] {
    return modal.map(m => ({
      type: m.gpuType,
      count: m.count,
      memory: m.memory,
      source: 'modal_config' as const,
      confidence: 0.9,
      location: m.location,
    }));
  }

  private gpusFromCloud(cloud: DetectedCloudInstance[]): DetectedGPU[] {
    return cloud
      .filter(c => c.gpuType)
      .map(c => ({
        type: c.gpuType!,
        count: c.gpuCount || 1,
        memory: GPU_MEMORY_MAP[c.gpuType!],
        source: 'cloud_instance_type' as const,
        confidence: 0.9,
        location: c.location,
      }));
  }

  private deduplicateGPUs(gpus: DetectedGPU[]): DetectedGPU[] {
    const seen = new Map<string, DetectedGPU>();

    for (const gpu of gpus) {
      const key = `${gpu.type}-${gpu.location}`;
      const existing = seen.get(key);

      if (!existing || gpu.confidence > existing.confidence) {
        seen.set(key, gpu);
      }
    }

    return Array.from(seen.values());
  }

  private deduplicateRuntimes(runtimes: DetectedServingRuntime[]): DetectedServingRuntime[] {
    const seen = new Map<string, DetectedServingRuntime>();

    for (const runtime of runtimes) {
      const key = `${runtime.runtime}-${runtime.location}`;
      const existing = seen.get(key);

      if (!existing || runtime.confidence > existing.confidence) {
        seen.set(key, runtime);
      }
    }

    return Array.from(seen.values());
  }

  private buildSummary(
    gpus: DetectedGPU[],
    tpus: DetectedTPU[],
    accelerators: DetectedAccelerator[],
    runtimes: DetectedServingRuntime[],
    parallelization: DetectedParallelization[]
  ): HardwareSummary {
    const totalGPUs = gpus.reduce((sum, g) => sum + g.count, 0);
    const gpuTypes = gpus.map(g => g.type).filter(t => t !== 'unknown' && t !== 'NVIDIA GPU' && t !== 'GPU');
    const primaryGPUType = gpuTypes.length > 0 ? this.mode(gpuTypes) : undefined;

    const totalMemory = gpus.reduce((sum, g) => sum + (g.memory || 0) * g.count, 0);

    const primaryRuntime = runtimes.length > 0
      ? runtimes.sort((a, b) => b.confidence - a.confidence)[0].runtime
      : undefined;

    const primaryParallelization = parallelization.length > 0
      ? parallelization.sort((a, b) => b.confidence - a.confidence)[0].strategy
      : undefined;

    return {
      totalGPUs,
      primaryGPUType,
      totalGPUMemory: totalMemory > 0 ? totalMemory : undefined,
      hasTPU: tpus.length > 0,
      hasSpecializedAccelerator: accelerators.some(a => !['nvidia_gpu', 'amd_gpu'].includes(a.type)),
      primaryRuntime,
      primaryParallelization,
    };
  }

  private mode(arr: string[]): string {
    const counts = new Map<string, number>();
    for (const item of arr) {
      counts.set(item, (counts.get(item) || 0) + 1);
    }
    let maxCount = 0;
    let mode = arr[0];
    for (const [item, count] of counts) {
      if (count > maxCount) {
        maxCount = count;
        mode = item;
      }
    }
    return mode;
  }

  private log(message: string) {
    if (this.verbose) {
      console.log(`[HardwareDetector] ${message}`);
    }
  }
}

// =============================================================================
// CONVENIENCE FUNCTION
// =============================================================================

export async function detectHardware(codebasePath: string, verbose = false): Promise<HardwareProfile> {
  const detector = new HardwareDetector(codebasePath, verbose);
  return detector.detect();
}

/**
 * Hardware Detection Types
 * Types for GPU, TPU, accelerator, and parallelization detection
 */

// =============================================================================
// GPU DETECTION
// =============================================================================

export interface DetectedGPU {
  type: string;                    // H100, A100, V100, etc.
  count: number;
  memory?: number;                 // GB
  source: GPUDetectionSource;
  confidence: number;              // 0-1
  location?: string;               // File path where detected
}

export type GPUDetectionSource =
  | 'environment_variable'
  | 'terraform'
  | 'kubernetes'
  | 'docker_compose'
  | 'modal_config'
  | 'ray_config'
  | 'code_import'
  | 'cloud_instance_type';

export interface GPUEnvironment {
  cudaVisible?: string;            // CUDA_VISIBLE_DEVICES
  nvidiaVisible?: string;          // NVIDIA_VISIBLE_DEVICES
  cudaVersion?: string;
  cudnnVersion?: string;
  nccl?: boolean;
}

// =============================================================================
// TPU / ACCELERATOR DETECTION
// =============================================================================

export interface DetectedTPU {
  type: string;                    // v4, v5e, v5p
  topology?: string;               // 2x2, 4x4, etc.
  count: number;
  source: string;
  location?: string;
}

export interface DetectedAccelerator {
  type: AcceleratorType;
  name: string;
  count: number;
  source: string;
  location?: string;
}

export type AcceleratorType =
  | 'nvidia_gpu'
  | 'amd_gpu'
  | 'google_tpu'
  | 'aws_inferentia'
  | 'aws_trainium'
  | 'intel_gaudi'
  | 'groq_lpu'
  | 'cerebras_wse'
  | 'sambanova'
  | 'graphcore_ipu';

// =============================================================================
// SERVING RUNTIME DETECTION
// =============================================================================

export interface DetectedServingRuntime {
  runtime: ServingRuntimeType;
  version?: string;
  config: ServingRuntimeConfig;
  location: string;
  confidence: number;
}

export type ServingRuntimeType =
  | 'vllm'
  | 'sglang'
  | 'tensorrt_llm'
  | 'tgi'                          // Text Generation Inference
  | 'llama_cpp'
  | 'ollama'
  | 'lmstudio'
  | 'mlx'
  | 'exllamav2'
  | 'ctranslate2'
  | 'triton'
  | 'ray_serve'
  | 'bentoml'
  | 'localai';

export interface ServingRuntimeConfig {
  modelPath?: string;
  tensorParallelSize?: number;
  pipelineParallelSize?: number;
  maxBatchSize?: number;
  gpuMemoryUtilization?: number;
  quantization?: string;
  dtype?: string;
  enablePrefixCaching?: boolean;
  enableChunkedPrefill?: boolean;
}

// =============================================================================
// PARALLELIZATION DETECTION
// =============================================================================

export interface DetectedParallelization {
  strategy: ParallelizationStrategy;
  config: ParallelizationConfig;
  framework?: string;
  location: string;
  confidence: number;
}

export type ParallelizationStrategy =
  | 'tensor_parallel'
  | 'pipeline_parallel'
  | 'data_parallel'
  | 'expert_parallel'              // MoE
  | 'sequence_parallel'
  | 'zero_1'                       // DeepSpeed ZeRO Stage 1
  | 'zero_2'                       // DeepSpeed ZeRO Stage 2
  | 'zero_3'                       // DeepSpeed ZeRO Stage 3
  | 'fsdp'                         // PyTorch FSDP
  | 'megatron'
  | 'none';

export interface ParallelizationConfig {
  worldSize?: number;
  tensorParallelSize?: number;
  pipelineParallelSize?: number;
  dataParallelSize?: number;
  zeroStage?: number;
  offloadOptimizer?: boolean;
  offloadParam?: boolean;
  gradientCheckpointing?: boolean;
}

// =============================================================================
// QUANTIZATION DETECTION
// =============================================================================

export interface DetectedQuantization {
  method: QuantizationMethod;
  bits: number;
  location: string;
  modelFile?: string;
}

export type QuantizationMethod =
  | 'none'
  | 'fp16'
  | 'bf16'
  | 'fp8'
  | 'int8'
  | 'int4'
  | 'gptq'
  | 'awq'
  | 'gguf'
  | 'exl2'
  | 'smoothquant'
  | 'nf4'
  | 'aqlm';

// =============================================================================
// INFRASTRUCTURE CONFIG DETECTION
// =============================================================================

export interface DetectedKubernetesGPU {
  resourceType: string;            // nvidia.com/gpu, amd.com/gpu
  requestCount: number;
  limitCount: number;
  nodeSelector?: Record<string, string>;
  tolerations?: string[];
  location: string;
}

export interface DetectedDockerGPU {
  runtime?: string;                // nvidia, amd
  deviceIds?: string[];
  capabilities?: string[];
  count?: number | 'all';
  location: string;
}

export interface DetectedModalGPU {
  gpuType: string;                 // H100, A100, A10G, T4
  count: number;
  memory?: number;
  location: string;
}

export interface DetectedCloudInstance {
  provider: CloudProvider;
  instanceType: string;
  gpuType?: string;
  gpuCount?: number;
  region?: string;
  location: string;
}

export type CloudProvider = 'aws' | 'gcp' | 'azure' | 'coreweave' | 'lambda' | 'runpod' | 'vastai';

// =============================================================================
// AGGREGATED HARDWARE PROFILE
// =============================================================================

export interface HardwareProfile {
  gpus: DetectedGPU[];
  tpus: DetectedTPU[];
  accelerators: DetectedAccelerator[];
  servingRuntimes: DetectedServingRuntime[];
  parallelization: DetectedParallelization[];
  quantization: DetectedQuantization[];
  kubernetes: DetectedKubernetesGPU[];
  docker: DetectedDockerGPU[];
  modal: DetectedModalGPU[];
  cloudInstances: DetectedCloudInstance[];
  environment: GPUEnvironment;

  // Summary
  summary: HardwareSummary;
}

export interface HardwareSummary {
  totalGPUs: number;
  primaryGPUType?: string;
  totalGPUMemory?: number;         // GB
  hasTPU: boolean;
  hasSpecializedAccelerator: boolean;
  primaryRuntime?: ServingRuntimeType;
  primaryParallelization?: ParallelizationStrategy;
  estimatedThroughput?: number;    // tokens/sec
  estimatedCostPerHour?: number;
}

// =============================================================================
// DETECTION PATTERNS
// =============================================================================

export interface HardwareDetectionPattern {
  name: string;
  type: 'import' | 'config' | 'env' | 'file' | 'code';
  pattern: RegExp;
  extract?: (match: RegExpMatchArray, content: string) => Partial<DetectedGPU | DetectedServingRuntime | DetectedParallelization>;
}

export interface RuntimeDetectionPattern {
  runtime: ServingRuntimeType;
  importPatterns: RegExp[];
  configPatterns: RegExp[];
  filePatterns: RegExp[];
  cliPatterns: RegExp[];
}

export interface ParallelizationDetectionPattern {
  strategy: ParallelizationStrategy;
  framework: string;
  importPatterns: RegExp[];
  configPatterns: RegExp[];
  envPatterns: RegExp[];
}

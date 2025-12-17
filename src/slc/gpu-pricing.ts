/**
 * GPU Pricing Database
 *
 * Tracks rental rates across providers + purchase prices for TCO calculation.
 * Data sources: Cloud provider pricing pages, GPU cloud aggregators.
 *
 * Design: Static data with periodic manual updates (prices change monthly, not daily).
 */

// =============================================================================
// TYPES
// =============================================================================

export interface GPURentalRates {
  runpod?: number;
  lambda?: number;
  aws?: number;
  gcp?: number;
  azure?: number;
  modal?: number;
  coreweave?: number;
  together?: number;
  vastai?: number;
}

export interface GPUSpecs {
  name: string;
  memory: number;              // GB
  generation: string;          // Hopper, Ampere, Ada, etc.
  tensorCores: boolean;
  fp8Support: boolean;
  bandwidthGBps: number;       // Memory bandwidth
  tdpWatts: number;            // Thermal design power
}

export interface GPUPricingEntry {
  gpu: string;
  specs: GPUSpecs;
  purchasePrice: number;       // MSRP in USD
  rental: GPURentalRates;      // $/hr
  amortizedHourly: number;     // $/hr assuming 3-year lifespan, 60% util
}

// =============================================================================
// GPU SPECIFICATIONS
// =============================================================================

const GPU_SPECS: Record<string, GPUSpecs> = {
  'H100-SXM': {
    name: 'NVIDIA H100 SXM',
    memory: 80,
    generation: 'Hopper',
    tensorCores: true,
    fp8Support: true,
    bandwidthGBps: 3350,
    tdpWatts: 700,
  },
  'H100-PCIe': {
    name: 'NVIDIA H100 PCIe',
    memory: 80,
    generation: 'Hopper',
    tensorCores: true,
    fp8Support: true,
    bandwidthGBps: 2000,
    tdpWatts: 350,
  },
  'H200': {
    name: 'NVIDIA H200',
    memory: 141,
    generation: 'Hopper',
    tensorCores: true,
    fp8Support: true,
    bandwidthGBps: 4800,
    tdpWatts: 700,
  },
  'A100-80GB': {
    name: 'NVIDIA A100 80GB',
    memory: 80,
    generation: 'Ampere',
    tensorCores: true,
    fp8Support: false,
    bandwidthGBps: 2039,
    tdpWatts: 400,
  },
  'A100-40GB': {
    name: 'NVIDIA A100 40GB',
    memory: 40,
    generation: 'Ampere',
    tensorCores: true,
    fp8Support: false,
    bandwidthGBps: 1555,
    tdpWatts: 400,
  },
  'A10G': {
    name: 'NVIDIA A10G',
    memory: 24,
    generation: 'Ampere',
    tensorCores: true,
    fp8Support: false,
    bandwidthGBps: 600,
    tdpWatts: 150,
  },
  'L40S': {
    name: 'NVIDIA L40S',
    memory: 48,
    generation: 'Ada',
    tensorCores: true,
    fp8Support: true,
    bandwidthGBps: 864,
    tdpWatts: 350,
  },
  'L4': {
    name: 'NVIDIA L4',
    memory: 24,
    generation: 'Ada',
    tensorCores: true,
    fp8Support: true,
    bandwidthGBps: 300,
    tdpWatts: 72,
  },
  'T4': {
    name: 'NVIDIA T4',
    memory: 16,
    generation: 'Turing',
    tensorCores: true,
    fp8Support: false,
    bandwidthGBps: 300,
    tdpWatts: 70,
  },
  'RTX-4090': {
    name: 'NVIDIA RTX 4090',
    memory: 24,
    generation: 'Ada',
    tensorCores: true,
    fp8Support: true,
    bandwidthGBps: 1008,
    tdpWatts: 450,
  },
  'RTX-3090': {
    name: 'NVIDIA RTX 3090',
    memory: 24,
    generation: 'Ampere',
    tensorCores: true,
    fp8Support: false,
    bandwidthGBps: 936,
    tdpWatts: 350,
  },
  'MI300X': {
    name: 'AMD MI300X',
    memory: 192,
    generation: 'CDNA3',
    tensorCores: true,
    fp8Support: true,
    bandwidthGBps: 5300,
    tdpWatts: 750,
  },
};

// =============================================================================
// GPU PRICING DATA (as of Jan 2025)
// =============================================================================

/**
 * GPU Pricing Database
 *
 * Sources:
 * - RunPod: runpod.io/gpu-instance/pricing
 * - Lambda: lambdalabs.com/service/gpu-cloud
 * - AWS: aws.amazon.com/ec2/instance-types
 * - Modal: modal.com/pricing
 * - CoreWeave: coreweave.com/pricing
 *
 * Purchase prices from NVIDIA/AMD MSRP and secondary market averages.
 */
export const GPU_PRICING: Record<string, GPUPricingEntry> = {
  'H100-SXM': {
    gpu: 'H100-SXM',
    specs: GPU_SPECS['H100-SXM'],
    purchasePrice: 30000,
    rental: {
      runpod: 3.99,
      lambda: 2.49,
      aws: 4.03,      // p5.48xlarge / 8 GPUs
      modal: 4.06,
      coreweave: 2.99,
      together: 3.50,
    },
    amortizedHourly: 1.90, // $30K / (3yr * 8760hr * 0.6 util)
  },
  'H100-PCIe': {
    gpu: 'H100-PCIe',
    specs: GPU_SPECS['H100-PCIe'],
    purchasePrice: 25000,
    rental: {
      runpod: 3.49,
      lambda: 2.29,
      coreweave: 2.49,
    },
    amortizedHourly: 1.58,
  },
  'H200': {
    gpu: 'H200',
    specs: GPU_SPECS['H200'],
    purchasePrice: 40000,
    rental: {
      runpod: 4.99,
      coreweave: 3.99,
    },
    amortizedHourly: 2.53,
  },
  'A100-80GB': {
    gpu: 'A100-80GB',
    specs: GPU_SPECS['A100-80GB'],
    purchasePrice: 15000,
    rental: {
      runpod: 1.99,
      lambda: 1.29,
      aws: 2.21,      // p4d.24xlarge / 8 GPUs
      gcp: 2.93,      // a2-highgpu-1g
      modal: 2.78,
      coreweave: 1.89,
      together: 1.80,
    },
    amortizedHourly: 0.95,
  },
  'A100-40GB': {
    gpu: 'A100-40GB',
    specs: GPU_SPECS['A100-40GB'],
    purchasePrice: 10000,
    rental: {
      runpod: 1.49,
      lambda: 1.10,
      aws: 1.61,
      gcp: 2.13,
      modal: 2.08,
      coreweave: 1.29,
    },
    amortizedHourly: 0.63,
  },
  'A10G': {
    gpu: 'A10G',
    specs: GPU_SPECS['A10G'],
    purchasePrice: 4000,
    rental: {
      runpod: 0.69,
      lambda: 0.50,
      aws: 0.75,      // g5.xlarge
      modal: 0.76,
    },
    amortizedHourly: 0.25,
  },
  'L40S': {
    gpu: 'L40S',
    specs: GPU_SPECS['L40S'],
    purchasePrice: 8000,
    rental: {
      runpod: 1.29,
      lambda: 0.99,
      coreweave: 1.09,
    },
    amortizedHourly: 0.51,
  },
  'L4': {
    gpu: 'L4',
    specs: GPU_SPECS['L4'],
    purchasePrice: 3000,
    rental: {
      runpod: 0.44,
      aws: 0.53,      // g6.xlarge
      gcp: 0.65,
      modal: 0.59,
    },
    amortizedHourly: 0.19,
  },
  'T4': {
    gpu: 'T4',
    specs: GPU_SPECS['T4'],
    purchasePrice: 2000,
    rental: {
      runpod: 0.29,
      lambda: 0.20,
      aws: 0.38,      // g4dn.xlarge
      gcp: 0.35,
      modal: 0.30,
    },
    amortizedHourly: 0.13,
  },
  'RTX-4090': {
    gpu: 'RTX-4090',
    specs: GPU_SPECS['RTX-4090'],
    purchasePrice: 1600,
    rental: {
      runpod: 0.49,
      lambda: 0.50,
      vastai: 0.30,
    },
    amortizedHourly: 0.10,
  },
  'RTX-3090': {
    gpu: 'RTX-3090',
    specs: GPU_SPECS['RTX-3090'],
    purchasePrice: 1000,
    rental: {
      runpod: 0.34,
      vastai: 0.20,
    },
    amortizedHourly: 0.06,
  },
  'MI300X': {
    gpu: 'MI300X',
    specs: GPU_SPECS['MI300X'],
    purchasePrice: 20000,
    rental: {
      // AMD rental availability is limited
      runpod: 2.99,
    },
    amortizedHourly: 1.27,
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get GPU pricing entry by name (case-insensitive, flexible matching)
 */
export function getGPUPricing(gpuName: string): GPUPricingEntry | null {
  // Normalize input
  const normalized = gpuName.toUpperCase().replace(/\s+/g, '-');

  // Direct match
  if (GPU_PRICING[normalized]) {
    return GPU_PRICING[normalized];
  }

  // Fuzzy match
  const patterns: Array<[RegExp, string]> = [
    [/H100.*SXM/i, 'H100-SXM'],
    [/H100.*PCIE/i, 'H100-PCIe'],
    [/H100/i, 'H100-SXM'],  // Default to SXM
    [/H200/i, 'H200'],
    [/A100.*80/i, 'A100-80GB'],
    [/A100.*40/i, 'A100-40GB'],
    [/A100/i, 'A100-80GB'],  // Default to 80GB
    [/A10G/i, 'A10G'],
    [/L40S/i, 'L40S'],
    [/L40/i, 'L40S'],
    [/L4/i, 'L4'],
    [/T4/i, 'T4'],
    [/4090/i, 'RTX-4090'],
    [/3090/i, 'RTX-3090'],
    [/MI300/i, 'MI300X'],
  ];

  for (const [pattern, key] of patterns) {
    if (pattern.test(gpuName)) {
      return GPU_PRICING[key] || null;
    }
  }

  return null;
}

/**
 * Get cheapest rental rate for a GPU
 */
export function getCheapestRental(gpu: string): { provider: string; rate: number } | null {
  const pricing = getGPUPricing(gpu);
  if (!pricing) return null;

  const rental = pricing.rental;
  let cheapest: { provider: string; rate: number } | null = null;

  for (const [provider, rate] of Object.entries(rental)) {
    if (rate && (!cheapest || rate < cheapest.rate)) {
      cheapest = { provider, rate };
    }
  }

  return cheapest;
}

/**
 * Calculate amortized hourly cost for self-hosted GPU
 */
export function calculateAmortizedCost(
  purchasePrice: number,
  lifespanYears: number = 3,
  utilizationPercent: number = 0.6
): number {
  const totalHours = lifespanYears * 365 * 24;
  const effectiveHours = totalHours * utilizationPercent;
  return purchasePrice / effectiveHours;
}

/**
 * Get all GPUs sorted by rental cost (cheapest first)
 */
export function getGPUsByRentalCost(): Array<{ gpu: string; cheapestRate: number; provider: string }> {
  const result: Array<{ gpu: string; cheapestRate: number; provider: string }> = [];

  for (const [gpuKey, pricing] of Object.entries(GPU_PRICING)) {
    const cheapest = getCheapestRental(gpuKey);
    if (cheapest) {
      result.push({
        gpu: gpuKey,
        cheapestRate: cheapest.rate,
        provider: cheapest.provider,
      });
    }
  }

  return result.sort((a, b) => a.cheapestRate - b.cheapestRate);
}

/**
 * Check if a model fits in GPU memory
 * Rule of thumb: FP16 needs ~2GB per 1B parameters
 */
export function canModelFitOnGPU(
  modelSizeB: number,
  gpuMemoryGB: number,
  precision: 'fp32' | 'fp16' | 'fp8' | 'int8' | 'int4' = 'fp16'
): boolean {
  const bytesPerParam: Record<string, number> = {
    fp32: 4,
    fp16: 2,
    fp8: 1,
    int8: 1,
    int4: 0.5,
  };

  const modelMemoryGB = (modelSizeB * bytesPerParam[precision]) / 1;
  const overheadMultiplier = 1.2; // KV cache, activations, etc.

  return gpuMemoryGB >= modelMemoryGB * overheadMultiplier;
}

/**
 * Get suitable GPUs for a model size
 */
export function getSuitableGPUs(
  modelSizeB: number,
  precision: 'fp32' | 'fp16' | 'fp8' | 'int8' | 'int4' = 'fp16'
): string[] {
  const suitable: string[] = [];

  for (const [gpuKey, pricing] of Object.entries(GPU_PRICING)) {
    if (canModelFitOnGPU(modelSizeB, pricing.specs.memory, precision)) {
      suitable.push(gpuKey);
    }
  }

  return suitable;
}

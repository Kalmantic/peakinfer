/**
 * Terraform Collector - Real Implementation
 * Parses Terraform state files and configurations for infrastructure analysis
 * Based on PRD v0.7: Parse state or terraform show -json
 */

import { BaseCollector } from './base-collector.js';
import { InferenceEvent } from '../types/events.js';
import fs from 'fs-extra';
import * as path from 'path';
import { glob } from 'glob';
import { exec } from 'child_process';
import { promisify } from 'util';
import {
  CollectorValidationResult,
  TerraformCollectorConfig,
  InfrastructureConfig,
  InfrastructureResource,
  GPUInventory,
  CostEstimate,
} from '../types/collectors.js';

const execAsync = promisify(exec);

// GPU instance type mappings for cost calculations
const GPU_INSTANCE_SPECS: Record<string, { gpu: string; count: number; hourly: number }> = {
  // AWS
  'p5.48xlarge': { gpu: 'H100', count: 8, hourly: 98.32 },
  'p4d.24xlarge': { gpu: 'A100', count: 8, hourly: 32.77 },
  'p4de.24xlarge': { gpu: 'A100-80GB', count: 8, hourly: 40.96 },
  'p3.16xlarge': { gpu: 'V100', count: 8, hourly: 24.48 },
  'p3.8xlarge': { gpu: 'V100', count: 4, hourly: 12.24 },
  'p3.2xlarge': { gpu: 'V100', count: 1, hourly: 3.06 },
  'g5.48xlarge': { gpu: 'A10G', count: 8, hourly: 16.29 },
  'g5.24xlarge': { gpu: 'A10G', count: 4, hourly: 8.14 },
  'g5.12xlarge': { gpu: 'A10G', count: 4, hourly: 5.67 },
  'g5.xlarge': { gpu: 'A10G', count: 1, hourly: 1.01 },
  'g4dn.xlarge': { gpu: 'T4', count: 1, hourly: 0.53 },
  'g4dn.12xlarge': { gpu: 'T4', count: 4, hourly: 3.91 },
  'inf2.xlarge': { gpu: 'Inferentia2', count: 1, hourly: 0.76 },
  'inf2.48xlarge': { gpu: 'Inferentia2', count: 12, hourly: 12.98 },
  'trn1.32xlarge': { gpu: 'Trainium', count: 16, hourly: 21.50 },
  'trn1.2xlarge': { gpu: 'Trainium', count: 1, hourly: 1.34 },
  // GCP
  'a3-highgpu-8g': { gpu: 'H100', count: 8, hourly: 80.00 },
  'a2-highgpu-8g': { gpu: 'A100', count: 8, hourly: 29.39 },
  'a2-highgpu-4g': { gpu: 'A100', count: 4, hourly: 14.69 },
  'a2-highgpu-2g': { gpu: 'A100', count: 2, hourly: 7.35 },
  'a2-highgpu-1g': { gpu: 'A100', count: 1, hourly: 3.67 },
  'n1-standard-8+nvidia-tesla-t4': { gpu: 'T4', count: 1, hourly: 0.95 },
  'g2-standard-4': { gpu: 'L4', count: 1, hourly: 0.84 },
  'g2-standard-8': { gpu: 'L4', count: 1, hourly: 1.18 },
  // Azure
  'Standard_ND96asr_v4': { gpu: 'A100', count: 8, hourly: 27.20 },
  'Standard_NC96ads_A100_v4': { gpu: 'A100', count: 4, hourly: 14.69 },
  'Standard_ND96isr_H100_v5': { gpu: 'H100', count: 8, hourly: 72.00 },
  'Standard_NC6s_v3': { gpu: 'V100', count: 1, hourly: 3.06 },
  'Standard_NC24s_v3': { gpu: 'V100', count: 4, hourly: 12.24 },
};

// Spot discount rates by provider
const SPOT_DISCOUNTS: Record<string, number> = {
  aws: 0.70, // Up to 70% discount
  gcp: 0.60, // Up to 60% discount
  azure: 0.65, // Up to 65% discount
};

export class TerraformCollector extends BaseCollector {
  private terraformConfig: TerraformCollectorConfig;
  private infrastructureConfig?: InfrastructureConfig;

  constructor(config?: Partial<TerraformCollectorConfig>) {
    super('terraform', config);
    this.terraformConfig = {
      ...this.config,
      paths: {
        stateFile: config?.paths?.stateFile || process.env.TERRAFORM_STATE_FILE || '',
        configDir: config?.paths?.configDir || process.env.TERRAFORM_CONFIG_DIR || './',
        ...config?.paths,
      },
      resources: {
        types: config?.resources?.types || [
          'aws_instance',
          'aws_spot_instance_request',
          'aws_eks_node_group',
          'aws_sagemaker_endpoint',
          'google_compute_instance',
          'google_container_node_pool',
          'google_vertex_ai_endpoint',
          'azurerm_virtual_machine',
          'azurerm_kubernetes_cluster_node_pool',
          'azurerm_machine_learning_compute_instance',
        ],
        ...config?.resources,
      },
    } as TerraformCollectorConfig;
  }

  /**
   * Collect infrastructure configuration from Terraform
   */
  async collect(): Promise<InferenceEvent[]> {
    console.log('  🏗️  Collecting Terraform infrastructure configuration...');

    this.respectTrustBoundaries();

    try {
      // Parse Terraform state/config
      this.infrastructureConfig = await this.parseInfrastructure();

      // Log results
      const resources = this.infrastructureConfig.resources.length;
      const gpus = this.infrastructureConfig.gpu_inventory.length;
      const totalCost = this.calculateTotalCost();

      console.log(`  ✅ Analyzed ${resources} infrastructure resources`);
      console.log(`  🖥️  Found ${gpus} GPU configurations`);
      console.log(`  💰 Total monthly infrastructure cost: $${totalCost.toLocaleString()}`);

      // Terraform collector doesn't produce inference events
      // Infrastructure config is accessed via getInfrastructureConfig()
      return [];
    } catch (error) {
      console.error('  ❌ Terraform collection failed:', error);
      throw error;
    }
  }

  /**
   * Validate Terraform collector configuration
   */
  async validate(): Promise<CollectorValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    const paths = this.terraformConfig.paths;

    // Check if state file exists
    if (paths?.stateFile) {
      const stateExists = await fs.pathExists(paths.stateFile);
      if (!stateExists) {
        warnings.push(`State file not found: ${paths.stateFile}`);
      }
    }

    // Check if config directory exists
    if (paths?.configDir) {
      const configExists = await fs.pathExists(paths.configDir);
      if (!configExists) {
        errors.push(`Config directory not found: ${paths.configDir}`);
      } else {
        // Check for .tf files
        const tfFiles = await glob('**/*.tf', {
          cwd: paths.configDir,
          ignore: ['**/.terraform/**'],
        });
        if (tfFiles.length === 0) {
          warnings.push(`No .tf files found in ${paths.configDir}`);
        }
      }
    }

    // Check if terraform CLI is available
    try {
      await execAsync('terraform version');
    } catch (error) {
      warnings.push('Terraform CLI not found - will use state file parsing only');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      trustBoundariesRespected: true,
    };
  }

  /**
   * Get infrastructure configuration
   */
  async getInfrastructureConfig(): Promise<InfrastructureConfig> {
    if (!this.infrastructureConfig) {
      this.infrastructureConfig = await this.parseInfrastructure();
    }
    return this.infrastructureConfig;
  }

  /**
   * Parse Terraform infrastructure from state and config files
   */
  private async parseInfrastructure(): Promise<InfrastructureConfig> {
    const resources: InfrastructureResource[] = [];

    // Try to get state from terraform show -json first
    const stateResources = await this.parseFromTerraformShow();
    if (stateResources.length > 0) {
      resources.push(...stateResources);
    } else {
      // Fall back to state file parsing
      const fileResources = await this.parseStateFile();
      resources.push(...fileResources);
    }

    // Also parse .tf files for additional context
    const configResources = await this.parseTerraformConfigs();
    for (const configRes of configResources) {
      // Merge or add resources not in state
      if (!resources.some(r => r.name === configRes.name && r.type === configRes.type)) {
        resources.push(configRes);
      }
    }

    // Extract GPU inventory and calculate costs
    const gpuInventory = this.extractGPUInventory(resources);
    const costEstimates = this.generateCostEstimates(resources);

    // Extract network topology
    const networkTopology = this.extractNetworkTopology(resources);

    return {
      resources,
      cost_estimates: costEstimates,
      gpu_inventory: gpuInventory,
      network_topology: networkTopology,
    };
  }

  /**
   * Parse resources using terraform show -json
   */
  private async parseFromTerraformShow(): Promise<InfrastructureResource[]> {
    const configDir = this.terraformConfig.paths?.configDir;
    if (!configDir) return [];

    try {
      const { stdout } = await execAsync('terraform show -json', {
        cwd: configDir,
        maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large states
      });

      const state = JSON.parse(stdout);
      return this.extractResourcesFromState(state);
    } catch (error) {
      // terraform show failed, try state file
      return [];
    }
  }

  /**
   * Parse terraform.tfstate file directly
   */
  private async parseStateFile(): Promise<InfrastructureResource[]> {
    const stateFile = this.terraformConfig.paths?.stateFile;
    const configDir = this.terraformConfig.paths?.configDir;

    // Try explicit state file first
    if (stateFile && await fs.pathExists(stateFile)) {
      const content = await fs.readFile(stateFile, 'utf-8');
      const state = JSON.parse(content);
      return this.extractResourcesFromStateFile(state);
    }

    // Try default locations
    const defaultPaths = [
      path.join(configDir || '.', 'terraform.tfstate'),
      path.join(configDir || '.', '.terraform', 'terraform.tfstate'),
    ];

    for (const statePath of defaultPaths) {
      if (await fs.pathExists(statePath)) {
        const content = await fs.readFile(statePath, 'utf-8');
        const state = JSON.parse(content);
        return this.extractResourcesFromStateFile(state);
      }
    }

    return [];
  }

  /**
   * Extract resources from terraform show -json output
   */
  private extractResourcesFromState(state: any): InfrastructureResource[] {
    const resources: InfrastructureResource[] = [];
    const allowedTypes = this.terraformConfig.resources?.types || [];

    // Handle both root_module and child modules
    const processModule = (module: any) => {
      for (const resource of module.resources || []) {
        if (allowedTypes.length === 0 || allowedTypes.includes(resource.type)) {
          resources.push(this.normalizeResource(resource));
        }
      }

      for (const childModule of module.child_modules || []) {
        processModule(childModule);
      }
    };

    if (state.values?.root_module) {
      processModule(state.values.root_module);
    }

    return resources;
  }

  /**
   * Extract resources from terraform.tfstate file format
   */
  private extractResourcesFromStateFile(state: any): InfrastructureResource[] {
    const resources: InfrastructureResource[] = [];
    const allowedTypes = this.terraformConfig.resources?.types || [];

    // Handle Terraform state file format (v4)
    for (const resource of state.resources || []) {
      if (allowedTypes.length === 0 || allowedTypes.includes(resource.type)) {
        for (const instance of resource.instances || []) {
          resources.push({
            type: resource.type,
            name: resource.name,
            provider: this.getProviderFromType(resource.type),
            attributes: instance.attributes || {},
            tags: instance.attributes?.tags || {},
          });
        }
      }
    }

    return resources;
  }

  /**
   * Parse .tf configuration files
   */
  private async parseTerraformConfigs(): Promise<InfrastructureResource[]> {
    const configDir = this.terraformConfig.paths?.configDir;
    if (!configDir) return [];

    const resources: InfrastructureResource[] = [];

    try {
      const tfFiles = await glob('**/*.tf', {
        cwd: configDir,
        absolute: true,
        ignore: ['**/.terraform/**', '**/node_modules/**'],
      });

      for (const tfFile of tfFiles) {
        const content = await fs.readFile(tfFile, 'utf-8');
        const fileResources = this.parseHCLContent(content, tfFile);
        resources.push(...fileResources);
      }
    } catch (error) {
      console.warn('  ⚠️  Could not parse Terraform config files:', error);
    }

    return resources;
  }

  /**
   * Parse HCL content (simplified regex-based parser)
   */
  private parseHCLContent(content: string, source: string): InfrastructureResource[] {
    const resources: InfrastructureResource[] = [];
    const allowedTypes = this.terraformConfig.resources?.types || [];

    // Match resource blocks
    const resourceRegex = /resource\s+"([^"]+)"\s+"([^"]+)"\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/g;
    let match;

    while ((match = resourceRegex.exec(content)) !== null) {
      const type = match[1];
      const name = match[2];
      const body = match[3];

      if (allowedTypes.length > 0 && !allowedTypes.includes(type)) {
        continue;
      }

      const attributes = this.parseHCLAttributes(body);

      resources.push({
        type,
        name,
        provider: this.getProviderFromType(type),
        attributes,
        tags: attributes.tags || {},
      });
    }

    return resources;
  }

  /**
   * Parse HCL attribute block (simplified)
   */
  private parseHCLAttributes(body: string): Record<string, any> {
    const attrs: Record<string, any> = {};

    // Match simple key = value pairs
    const attrRegex = /(\w+)\s*=\s*"([^"]+)"/g;
    let match;

    while ((match = attrRegex.exec(body)) !== null) {
      attrs[match[1]] = match[2];
    }

    // Match key = number
    const numRegex = /(\w+)\s*=\s*(\d+)/g;
    while ((match = numRegex.exec(body)) !== null) {
      attrs[match[1]] = parseInt(match[2], 10);
    }

    // Match instance_type/machine_type specifically
    const instanceMatch = body.match(/instance_type\s*=\s*"([^"]+)"/);
    if (instanceMatch) attrs.instance_type = instanceMatch[1];

    const machineMatch = body.match(/machine_type\s*=\s*"([^"]+)"/);
    if (machineMatch) attrs.machine_type = machineMatch[1];

    // Match availability_zone/zone
    const zoneMatch = body.match(/(?:availability_zone|zone)\s*=\s*"([^"]+)"/);
    if (zoneMatch) attrs.availability_zone = zoneMatch[1];

    return attrs;
  }

  /**
   * Normalize resource to common format
   */
  private normalizeResource(resource: any): InfrastructureResource {
    return {
      type: resource.type,
      name: resource.name,
      provider: this.getProviderFromType(resource.type),
      attributes: resource.values || resource.attributes || {},
      tags: resource.values?.tags || resource.attributes?.tags || {},
    };
  }

  /**
   * Get provider from resource type
   */
  private getProviderFromType(type: string): string {
    if (type.startsWith('aws_')) return 'aws';
    if (type.startsWith('google_')) return 'gcp';
    if (type.startsWith('azurerm_')) return 'azure';
    return 'unknown';
  }

  /**
   * Extract GPU inventory from resources
   */
  private extractGPUInventory(resources: InfrastructureResource[]): GPUInventory[] {
    const inventory: GPUInventory[] = [];

    for (const resource of resources) {
      const instanceType = resource.attributes.instance_type ||
                           resource.attributes.machine_type ||
                           resource.attributes.vm_size;

      if (!instanceType) continue;

      const gpuSpec = GPU_INSTANCE_SPECS[instanceType];
      if (gpuSpec) {
        // Check if it's a spot instance
        const isSpot = resource.type.includes('spot') ||
                       resource.attributes.spot_price !== undefined ||
                       resource.attributes.preemptible === true ||
                       resource.attributes.priority === 'Spot';

        const provider = resource.provider;
        const discount = isSpot ? SPOT_DISCOUNTS[provider] || 0.5 : 0;
        const hourlyRate = gpuSpec.hourly * (1 - discount);

        inventory.push({
          instance_type: instanceType,
          gpu_type: gpuSpec.gpu,
          gpu_count: gpuSpec.count,
          memory_gb: this.getGPUMemory(gpuSpec.gpu) * gpuSpec.count,
          hourly_cost: hourlyRate,
          region: resource.attributes.availability_zone ||
                  resource.attributes.zone ||
                  resource.attributes.location ||
                  'unknown',
          availability: isSpot ? 'spot' : 'on-demand',
        });
      }
    }

    return inventory;
  }

  /**
   * Get GPU memory in GB
   */
  private getGPUMemory(gpuType: string): number {
    const memoryMap: Record<string, number> = {
      'H100': 80,
      'A100': 40,
      'A100-80GB': 80,
      'V100': 32,
      'A10G': 24,
      'L4': 24,
      'T4': 16,
      'Inferentia2': 32,
      'Trainium': 32,
    };
    return memoryMap[gpuType] || 0;
  }

  /**
   * Generate cost estimates for resources
   */
  private generateCostEstimates(resources: InfrastructureResource[]): CostEstimate[] {
    const estimates: CostEstimate[] = [];

    for (const resource of resources) {
      const instanceType = resource.attributes.instance_type ||
                           resource.attributes.machine_type ||
                           resource.attributes.vm_size;

      if (!instanceType) continue;

      const gpuSpec = GPU_INSTANCE_SPECS[instanceType];
      if (!gpuSpec) continue;

      const isSpot = resource.type.includes('spot') ||
                     resource.attributes.spot_price !== undefined ||
                     resource.attributes.preemptible === true;

      const provider = resource.provider;
      const spotDiscount = isSpot ? SPOT_DISCOUNTS[provider] || 0.5 : 0;
      const hourlyRate = gpuSpec.hourly * (1 - spotDiscount);
      const monthlyRate = hourlyRate * 24 * 30;

      // Calculate optimization potential
      let optimizationPotential = 0;
      if (!isSpot) {
        // Can save by using spot instances
        optimizationPotential = SPOT_DISCOUNTS[provider] || 0.5;
      }

      // Check for reserved instance potential
      const hasReservedPricing = resource.attributes.reserved_instance_type !== undefined;
      if (!hasReservedPricing && !isSpot) {
        optimizationPotential = Math.max(optimizationPotential, 0.40);
      }

      estimates.push({
        resource_id: resource.name,
        resource_type: resource.type,
        hourly_cost: hourlyRate,
        monthly_cost: monthlyRate,
        optimization_potential: optimizationPotential,
      });
    }

    return estimates;
  }

  /**
   * Extract network topology from resources
   */
  private extractNetworkTopology(resources: InfrastructureResource[]): any {
    const regions = new Set<string>();
    let bandwidth = 10; // Default 10 Gbps

    for (const resource of resources) {
      const region = resource.attributes.availability_zone ||
                     resource.attributes.zone ||
                     resource.attributes.region ||
                     resource.attributes.location;

      if (region) {
        // Extract region from AZ (e.g., us-west-2a -> us-west-2)
        const regionMatch = region.match(/^([a-z]+-[a-z]+-\d+)/);
        regions.add(regionMatch ? regionMatch[1] : region);
      }

      // Check for enhanced networking
      if (resource.attributes.ena_support === true ||
          resource.attributes.placement?.group_name) {
        bandwidth = Math.max(bandwidth, 100);
      }
    }

    return {
      regions: Array.from(regions),
      multi_region: regions.size > 1,
      bandwidth_gbps: bandwidth,
    };
  }

  /**
   * Calculate total infrastructure cost
   */
  private calculateTotalCost(): number {
    if (!this.infrastructureConfig) return 0;

    return this.infrastructureConfig.cost_estimates.reduce(
      (sum, estimate) => sum + estimate.monthly_cost,
      0
    );
  }

  /**
   * Get GPU optimization recommendations
   */
  getOptimizationRecommendations(): string[] {
    if (!this.infrastructureConfig) return [];

    const recommendations: string[] = [];

    for (const estimate of this.infrastructureConfig.cost_estimates) {
      if (estimate.optimization_potential > 0.3) {
        const savings = estimate.monthly_cost * estimate.optimization_potential;
        recommendations.push(
          `${estimate.resource_id}: Could save $${savings.toFixed(2)}/month ` +
          `(${(estimate.optimization_potential * 100).toFixed(0)}%) by using spot/preemptible instances`
        );
      }
    }

    // Check for multi-region optimization
    if (this.infrastructureConfig.network_topology?.multi_region) {
      recommendations.push(
        'Consider using a single region for inference workloads to reduce latency and cross-region data transfer costs'
      );
    }

    return recommendations;
  }

  /**
   * Get environment variable requirements
   */
  static getRequiredEnvVars(): string[] {
    return [
      'TERRAFORM_STATE_FILE - (Optional) Path to terraform.tfstate file',
      'TERRAFORM_CONFIG_DIR - (Optional) Path to Terraform configuration directory',
    ];
  }
}

# =============================================================================
# PeakInfer Test Infrastructure - Terraform
# Tests Terraform Detection: GPU instances, regions, instance types
# =============================================================================

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

# =============================================================================
# VARIABLES
# =============================================================================

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "region" {
  description = "AWS region"
  type        = string
  default     = "us-west-2"
}

# =============================================================================
# AWS PROVIDER
# =============================================================================

provider "aws" {
  region = var.region
}

# =============================================================================
# PATTERN: GPU Instance for LLM Inference (AWS)
# Should detect: p4d.24xlarge, 8x A100 GPUs
# =============================================================================

resource "aws_instance" "llm_inference_primary" {
  ami           = "ami-0c55b159cbfafe1f0"  # Deep Learning AMI
  instance_type = "p4d.24xlarge"            # 8x A100 80GB GPUs - $32.77/hr
  
  tags = {
    Name        = "llm-inference-primary"
    Environment = var.environment
    Purpose     = "LLM-Inference"
    GPUType     = "A100"
    GPUCount    = "8"
  }

  root_block_device {
    volume_size = 500
    volume_type = "gp3"
  }

  # User data for NVIDIA driver and vLLM setup
  user_data = <<-EOF
    #!/bin/bash
    nvidia-smi
    pip install vllm
    python -m vllm.entrypoints.api_server --model meta-llama/Llama-3.1-70B-Instruct --tensor-parallel-size 8
  EOF
}

# =============================================================================
# PATTERN: H100 Instance for High-Performance Inference
# Should detect: p5.48xlarge, 8x H100 GPUs
# =============================================================================

resource "aws_instance" "llm_inference_h100" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "p5.48xlarge"             # 8x H100 80GB GPUs - $98.32/hr
  
  tags = {
    Name        = "llm-inference-h100"
    Environment = var.environment
    Purpose     = "LLM-Inference-Premium"
    GPUType     = "H100"
    GPUCount    = "8"
  }
}

# =============================================================================
# PATTERN: Cost-Effective Inference (A10G)
# Should detect: g5.12xlarge, 4x A10G GPUs
# =============================================================================

resource "aws_instance" "llm_inference_budget" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "g5.12xlarge"             # 4x A10G 24GB GPUs - $5.67/hr
  
  tags = {
    Name        = "llm-inference-budget"
    Environment = var.environment
    Purpose     = "LLM-Inference-Budget"
    GPUType     = "A10G"
    GPUCount    = "4"
  }
}

# =============================================================================
# PATTERN: Embedding Service (Lower GPU Requirements)
# Should detect: g5.xlarge, 1x A10G GPU
# =============================================================================

resource "aws_instance" "embedding_service" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "g5.xlarge"               # 1x A10G 24GB GPU - $1.00/hr
  count         = 2
  
  tags = {
    Name        = "embedding-service-${count.index}"
    Environment = var.environment
    Purpose     = "Embeddings"
    GPUType     = "A10G"
    GPUCount    = "1"
  }
}

# =============================================================================
# PATTERN: Inferentia for Cost Optimization
# Should detect: inf2.48xlarge, AWS Inferentia2
# =============================================================================

resource "aws_instance" "inferentia_inference" {
  ami           = "ami-inferentia-optimized"
  instance_type = "inf2.48xlarge"           # 12x Inferentia2 chips - $12.98/hr
  
  tags = {
    Name         = "inferentia-inference"
    Environment  = var.environment
    Purpose      = "LLM-Inference-Inferentia"
    Accelerator  = "Inferentia2"
    AccelCount   = "12"
  }
}

# =============================================================================
# PATTERN: Trainium for Training
# Should detect: trn1.32xlarge, AWS Trainium
# =============================================================================

resource "aws_instance" "training_cluster" {
  ami           = "ami-trainium-optimized"
  instance_type = "trn1.32xlarge"           # 16x Trainium chips - $21.50/hr
  count         = 4
  
  tags = {
    Name        = "training-node-${count.index}"
    Environment = var.environment
    Purpose     = "LLM-Training"
    Accelerator = "Trainium"
    AccelCount  = "16"
  }
}

# =============================================================================
# PATTERN: Spot Instance for Batch Inference (Cost Savings)
# Should detect: spot instance, cost optimization
# =============================================================================

resource "aws_spot_instance_request" "batch_inference" {
  ami                    = "ami-0c55b159cbfafe1f0"
  instance_type          = "p4d.24xlarge"
  spot_price             = "20.00"  # Max bid price
  wait_for_fulfillment   = true
  spot_type              = "persistent"
  
  tags = {
    Name        = "batch-inference-spot"
    Environment = var.environment
    Purpose     = "Batch-LLM-Inference"
    CostType    = "Spot"
  }
}

# =============================================================================
# GCP PROVIDER (Multi-Cloud)
# =============================================================================

provider "google" {
  project = "peakinfer-test"
  region  = "us-central1"
}

# =============================================================================
# PATTERN: GCP GPU Instance
# Should detect: a2-highgpu-8g, 8x A100 GPUs
# =============================================================================

resource "google_compute_instance" "gcp_inference" {
  name         = "gcp-llm-inference"
  machine_type = "a2-highgpu-8g"            # 8x A100 GPUs
  zone         = "us-central1-a"

  boot_disk {
    initialize_params {
      image = "deeplearning-platform-release/pytorch-latest-gpu"
      size  = 500
    }
  }

  guest_accelerator {
    type  = "nvidia-a100-80gb"
    count = 8
  }

  scheduling {
    on_host_maintenance = "TERMINATE"
  }

  network_interface {
    network = "default"
    access_config {
      // Ephemeral IP
    }
  }

  metadata = {
    purpose   = "LLM-Inference"
    gpu_type  = "A100"
    gpu_count = "8"
  }
}

# =============================================================================
# PATTERN: GCP TPU for Training
# Should detect: TPU v4, Google TPU
# =============================================================================

resource "google_tpu_node" "tpu_training" {
  name               = "tpu-training-cluster"
  zone               = "us-central1-a"
  accelerator_type   = "v4-8"               # TPU v4 pod
  tensorflow_version = "tpu-vm-pt-2.0"
  cidr_block         = "10.2.0.0/29"

  labels = {
    purpose = "llm-training"
    tpu_version = "v4"
  }
}

# =============================================================================
# OUTPUTS
# =============================================================================

output "primary_inference_ip" {
  value = aws_instance.llm_inference_primary.public_ip
}

output "h100_inference_ip" {
  value = aws_instance.llm_inference_h100.public_ip
}

output "total_a100_gpus" {
  value = 8 + 8  # primary + h100 equivalents
}

output "estimated_hourly_cost" {
  value = 32.77 + 98.32 + 5.67 + 2.00  # Sum of instance costs
}


# PeakInfer Test Infrastructure
# Simulates a real ML inference deployment for testing optimization recommendations

terraform {
  required_version = ">= 1.0.0"
}

# =============================================================================
# GPU COMPUTE INSTANCES - Inference Servers
# =============================================================================

# Primary inference cluster - expensive on-demand A100s
resource "aws_instance" "inference_primary" {
  ami           = "ami-0123456789abcdef0"  # Deep Learning AMI
  instance_type = "p4d.24xlarge"           # 8x A100 GPUs - $32.77/hr

  availability_zone = "us-west-2a"

  tags = {
    Name        = "ml-inference-primary"
    Purpose     = "llm-inference"
    Team        = "ml-platform"
    Environment = "production"
    Model       = "llama-3.1-70b"
    Runtime     = "vllm"
  }
}

# Secondary inference - V100s (could be optimized to spot)
resource "aws_instance" "inference_secondary" {
  ami           = "ami-0123456789abcdef0"
  instance_type = "p3.8xlarge"             # 4x V100 GPUs - $12.24/hr

  availability_zone = "us-west-2b"

  tags = {
    Name        = "ml-inference-secondary"
    Purpose     = "llm-inference"
    Team        = "ml-platform"
    Environment = "production"
    Model       = "mixtral-8x7b"
    Runtime     = "vllm"
  }
}

# Embedding service - over-provisioned (optimization opportunity)
resource "aws_instance" "embedding_service" {
  ami           = "ami-0123456789abcdef0"
  instance_type = "g5.12xlarge"            # 4x A10G - overkill for embeddings

  availability_zone = "us-west-2a"

  tags = {
    Name        = "embedding-service"
    Purpose     = "embeddings"
    Team        = "search"
    Environment = "production"
    Model       = "bge-large"
  }
}

# =============================================================================
# SPOT INSTANCE REQUEST - Cost optimized batch inference
# =============================================================================

resource "aws_spot_instance_request" "batch_inference" {
  ami           = "ami-0123456789abcdef0"
  instance_type = "p4d.24xlarge"
  spot_price    = "15.00"                  # ~54% savings vs on-demand

  availability_zone = "us-west-2c"

  tags = {
    Name        = "batch-inference-spot"
    Purpose     = "batch-inference"
    Team        = "data-science"
    Environment = "production"
  }
}

# =============================================================================
# GCP INSTANCES - Multi-cloud inference
# =============================================================================

resource "google_compute_instance" "inference_gcp" {
  name         = "inference-gcp-primary"
  machine_type = "a2-highgpu-4g"           # 4x A100 on GCP
  zone         = "us-west1-b"

  labels = {
    purpose     = "llm-inference"
    team        = "ml-platform"
    environment = "production"
  }

  # GPU configuration
  guest_accelerator {
    type  = "nvidia-tesla-a100"
    count = 4
  }
}

# =============================================================================
# EKS NODE GROUP - Kubernetes inference cluster
# =============================================================================

resource "aws_eks_node_group" "inference_nodes" {
  cluster_name    = "ml-inference-cluster"
  node_group_name = "gpu-inference-nodes"
  node_role_arn   = "arn:aws:iam::123456789012:role/eks-node-role"
  subnet_ids      = ["subnet-12345678", "subnet-87654321"]

  instance_types = ["p4d.24xlarge"]

  scaling_config {
    desired_size = 3
    max_size     = 10
    min_size     = 1
  }

  tags = {
    Purpose     = "gpu-inference"
    Team        = "platform"
    Environment = "production"
  }
}

# =============================================================================
# SAGEMAKER ENDPOINT - Managed inference
# =============================================================================

resource "aws_sagemaker_endpoint" "llm_endpoint" {
  name                 = "llm-inference-endpoint"
  endpoint_config_name = "llm-endpoint-config"

  tags = {
    Purpose = "managed-inference"
    Model   = "claude-3-haiku"
  }
}

# =============================================================================
# OUTPUTS - Infrastructure summary
# =============================================================================

output "infrastructure_summary" {
  value = {
    total_gpu_instances   = 5
    on_demand_instances   = 4
    spot_instances        = 1
    multi_region          = true
    estimated_monthly_cost = 85000  # Approximate
    optimization_potential = "40-60% with spot/reserved instances"
  }
}

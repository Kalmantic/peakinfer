# Spot Instance Optimization Template

---
id: spot-instance-optimization
name: GPU Spot Instance Migration
description: Migrate LLM inference workloads to spot instances for 60-70% cost reduction
category: infrastructure_layer
confidence: 0.85
success_count: 41
verified_environments: 29
contributors:
  - peakinfer-community
  - devops-team
last_updated: "2024-12-01"

environment_match:
  deployment:
    - cloud
    - aws
    - gcp
    - azure
  gpu_utilization: ">40%"
  workload_type: "inference"
  criticality: "non-critical"
  fault_tolerance: "high"

optimization:
  technique: spot_instance_migration
  expected_cost_reduction: "60-70%"
  expected_availability: "95-98%"
  effort_estimate: "3-5 engineering days"
  risk_level: medium

economics:
  baseline_calculation:
    num_gpus: "gpu_count"
    gpu_type: "A100"
    on_demand_hourly: "3.00"
    monthly_hours: "24 * 30"
    monthly_cost: "num_gpus * on_demand_hourly * monthly_hours"
  
  projected_improvement:
    spot_hourly: "1.00"
    spot_discount: "0.67"
    availability: "0.97"
    effective_cost: "num_gpus * spot_hourly * monthly_hours / availability"
  
  projected_savings:
    monthly_savings: "monthly_cost - effective_cost"
    savings_percentage: "(monthly_savings / monthly_cost) * 100"
  
  implementation_cost:
    engineering_hours: 32
    hourly_rate: 200
    total_cost: 6400
  
  roi_calculation:
    payback_months: "implementation_cost / monthly_savings"
    annual_roi: "(monthly_savings * 12 - implementation_cost) / implementation_cost"

implementation:
  prerequisites:
    - requirement: "Terraform or similar IaC tool"
      validation_command: "terraform version"
      optional: false
    - requirement: "Auto-scaling group configured"
      validation_command: "aws autoscaling describe-auto-scaling-groups"
      optional: false
    - requirement: "Load balancer for traffic distribution"
      validation_command: "aws elbv2 describe-load-balancers"
      optional: false
    - requirement: "Graceful shutdown handling"
      validation_command: "# Manual verification required"
      optional: false
  
  automated_steps:
    - step_id: "create_launch_template"
      name: "Create spot instance launch template"
      executable: true
      commands:
        - "terraform apply -target=aws_launch_template.spot_gpu_inference"
      validation:
        command: "aws ec2 describe-launch-templates --launch-template-names spot-gpu-inference"
        success_criteria: "launch template exists"
        rollback_command: "terraform destroy -target=aws_launch_template.spot_gpu_inference"
    
    - step_id: "configure_asg"
      name: "Configure auto-scaling with spot instances"
      executable: true
      commands:
        - "terraform apply -target=aws_autoscaling_group.spot_inference"
      validation:
        command: "aws autoscaling describe-auto-scaling-groups --auto-scaling-group-names spot-inference"
        success_criteria: "ASG configured with spot instances"
        rollback_command: "terraform destroy -target=aws_autoscaling_group.spot_inference"
    
    - step_id: "implement_interruption_handling"
      name: "Implement spot interruption handling"
      executable: false
      commands:
        - "# Add spot interruption listener"
        - "# Implement graceful shutdown on 2-minute warning"
        - "# Configure request draining"
      validation:
        command: "systemctl status spot-interrupt-handler"
        success_criteria: "service active"
        rollback_command: "systemctl stop spot-interrupt-handler"
    
    - step_id: "gradual_migration"
      name: "Gradually shift traffic to spot instances"
      executable: true
      commands:
        - "aws autoscaling set-desired-capacity --auto-scaling-group-name spot-inference --desired-capacity 1"
        - "# Monitor for 1 hour"
        - "aws autoscaling set-desired-capacity --auto-scaling-group-name spot-inference --desired-capacity 3"
      validation:
        command: "aws autoscaling describe-auto-scaling-groups --query 'AutoScalingGroups[0].Instances[*].HealthStatus'"
        success_criteria: "All instances healthy"
        rollback_command: "aws autoscaling set-desired-capacity --auto-scaling-group-name spot-inference --desired-capacity 0"

monitoring:
  key_metrics:
    - metric: "spot_interruption_rate"
      target: "<5% per day"
      alert_threshold: ">10% per day"
    - metric: "instance_availability"
      target: ">95%"
      alert_threshold: "<90%"
    - metric: "request_failure_rate"
      target: "<0.1%"
      alert_threshold: ">1%"
    - metric: "cost_savings"
      target: ">60%"
      alert_threshold: "<50%"
  
  rollback_triggers:
    - condition: "spot_interruption_rate > 15% for 24 hours"
      action: "alert_and_investigation"
    - condition: "request_failure_rate > 5%"
      action: "automatic_rollback"
      delay_minutes: 10

results:
  implementations:
    - organization: "ML Inference Platform"
      baseline_cost: 32400
      optimized_cost: 11340
      savings_percentage: 65
      implementation_time_days: 4
      availability: 97.2
    - organization: "AI API Service"
      baseline_cost: 21600
      optimized_cost: 7560
      savings_percentage: 65
      implementation_time_days: 5
      availability: 96.8
---

## Overview

GPU spot instances offer 60-70% cost savings compared to on-demand instances. With proper fault tolerance and interruption handling, spot instances can achieve 95-98% availability for non-critical inference workloads.

## Architecture Pattern

### Multi-AZ Spot Fleet
```
┌─────────────────────────────────────────┐
│     Application Load Balancer           │
└────────────┬────────────────────────────┘
             │
     ┌───────┴────────┐
     │                │
┌────▼─────┐   ┌─────▼────┐
│  Spot    │   │  Spot    │
│ GPU-1    │   │ GPU-2    │
│ us-east-1a│  │ us-east-1b│
└──────────┘   └──────────┘
     │                │
┌────▼────────────────▼────┐
│   Spot Fleet ASG         │
│ - Diversified instance   │
│ - Multiple AZs           │
│ - Interruption handler   │
└──────────────────────────┘
```

## Implementation: Terraform Example

```hcl
resource "aws_launch_template" "spot_gpu_inference" {
  name_prefix   = "spot-gpu-inference-"
  image_id      = var.gpu_ami_id
  instance_type = "g5.xlarge"  # or p3.2xlarge, etc.
  
  instance_market_options {
    market_type = "spot"
    spot_options {
      max_price          = "1.50"  # ~50% of on-demand
      spot_instance_type = "one-time"
    }
  }
  
  user_data = base64encode(<<-EOF
    #!/bin/bash
    # Install spot interruption handler
    cat > /usr/local/bin/spot-interrupt-handler.sh <<'SCRIPT'
    #!/bin/bash
    TOKEN=$(curl -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")
    while true; do
      SPOT_TERMINATION=$(curl -H "X-aws-ec2-metadata-token: $TOKEN" -s http://169.254.169.254/latest/meta-data/spot/instance-action)
      if [ $? -eq 0 ]; then
        echo "Spot interruption detected, gracefully shutting down..."
        # Drain active requests (2 min warning)
        systemctl stop inference-server
        sleep 10
        exit 0
      fi
      sleep 5
    done
    SCRIPT
    
    chmod +x /usr/local/bin/spot-interrupt-handler.sh
    /usr/local/bin/spot-interrupt-handler.sh &
  EOF
  )
}

resource "aws_autoscaling_group" "spot_inference" {
  name                = "spot-inference-asg"
  desired_capacity    = 3
  min_size           = 2
  max_size           = 10
  health_check_type  = "ELB"
  health_check_grace_period = 300
  
  mixed_instances_policy {
    instances_distribution {
      on_demand_base_capacity                  = 1  # Keep 1 on-demand for stability
      on_demand_percentage_above_base_capacity = 0  # Rest are spot
      spot_allocation_strategy                 = "capacity-optimized"
    }
    
    launch_template {
      launch_template_specification {
        launch_template_id = aws_launch_template.spot_gpu_inference.id
        version           = "$Latest"
      }
      
      # Diversify across multiple instance types
      override {
        instance_type = "g5.xlarge"
      }
      override {
        instance_type = "g5.2xlarge"
      }
      override {
        instance_type = "p3.2xlarge"
      }
    }
  }
  
  target_group_arns = [aws_lb_target_group.inference.arn]
  
  tag {
    key                 = "Name"
    value               = "spot-gpu-inference"
    propagate_at_launch = true
  }
}
```

## Economics

### Cost Comparison (1 A100 GPU)
| Instance Type | On-Demand | Spot | Savings |
|--------------|-----------|------|---------|
| p4d.24xlarge | $32.77/hr | $10.90/hr | 67% |
| p3.2xlarge   | $3.06/hr  | $0.92/hr  | 70% |
| g5.xlarge    | $1.01/hr  | $0.30/hr  | 70% |

### Monthly Costs (24/7 operation)
- **On-Demand**: 3 × $3.06 × 730 = $6,701/month
- **Spot**: 3 × $0.92 × 730 = $2,014/month
- **Savings**: $4,687/month (70%)

## Handling Spot Interruptions

### Best Practices
1. **Diversification**: Use multiple instance types and AZs
2. **Graceful Shutdown**: Implement 2-minute warning handler
3. **Request Draining**: Stop accepting new requests before shutdown
4. **Fast Recovery**: Auto-scaling replaces terminated instances in 2-3 minutes
5. **Hybrid Fleet**: Keep 10-20% on-demand for baseline capacity

### Interruption Frequency
- **Typical**: 2-5% per day
- **Best case**: <1% per day (diversified fleet)
- **Worst case**: 10-15% per day (single instance type)

## Monitoring Dashboard

Key metrics to track:
```yaml
- spot_interruption_rate (target: <5%/day)
- instance_replacement_time (target: <3 min)
- request_failure_rate (target: <0.1%)
- cost_per_request (target: <40% of baseline)
- fleet_availability (target: >95%)
```

## Risk Mitigation

1. **Capacity Challenges**: Use capacity-optimized allocation
2. **Price Spikes**: Set max price at 50-60% of on-demand
3. **Interruptions**: Diversify instance types and AZs
4. **Critical Workloads**: Keep hybrid fleet with on-demand baseline

## When NOT to Use Spot

- **Critical, real-time services** requiring 99.99% availability
- **Stateful workloads** without distributed architecture
- **Training jobs** that can't checkpoint frequently
- **Workloads requiring specific GPU types** (limited spot availability)


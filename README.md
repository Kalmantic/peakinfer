# PeakInfer

> Inference peak performance  through template-driven Claude Code SDK agents

PeakInfer is a **Simple, Lovable, Complete** tool that discovers optimization opportunities across your full LLM stack application using intelligent template matching and Claude Code SDK execution.

## 🎯 Core Philosophy

**Templates > Code**: Instead of hardcoding optimizations, PeakInfer uses 27+ community-validated templates that encode PeakInfer book economic insights. Claude Code SDK agents intelligently load, match, and execute these templates for your specific environment.

## 🚀 The One Perfect Command

```bash
# Discover and analyze optimization opportunities across your full stack
peakinfer discover


# Browse available templates
peakinfer templates --category runtime_optimization
```

## 🏗️ Architecture

TokenOp performs **full-stack analysis** across three layers:

1. **📱 Application Layer**: Source code analysis for LLM usage patterns, API calls, prompts
2. **🚀 Serving Layer**: Runtime infrastructure (vLLM, TensorRT, SGLang, model serving)
3. **☁️ Infrastructure Layer**: Cloud resources, Terraform, Kubernetes, spot instances

The key innovation is **cross-layer coordination** where optimizations span multiple layers for compound savings (20-70% total).

## 📊 PeakInfer Economics Integration

Based on the TokenSqueeze book, TokenOp focuses on:

- **Memory Bandwidth Optimization**: Address the universal constraint (3-6% GPU utilization)
- **Context Length Tax**: Manage KV cache economics (~1MB per token)
- **Arithmetic Intensity**: Improve the 590x efficiency gap
- **Batch Utilization**: Primary economic lever for cost reduction

## 🔧 Installation

```bash
npm install -g @kalmantic/tokenop
```

## 📋 Templates

TokenOp includes 27+ optimization templates covering:

### Core Infrastructure
- `pytorch-to-onnx-migration` - 50-70% cost reduction through runtime optimization
- `vllm-high-throughput-optimization` - 3-5x throughput improvement
- `memory-bandwidth-optimization` - Hardware-aware optimization for large models

### Application Layer
- `smart-model-routing` - Route requests to cost-effective models
- `context-window-optimization` - Manage long context economics
- `aggressive-4bit-quantization` - Quality-preserving quantization

### Serving Layer
- `tensorrt-llm-performance` - Maximum performance optimization
- `sglang-concurrency-optimization` - Handle thousands of concurrent requests

### Infrastructure Layer
- `distributed-training-cost` - Multi-GPU training optimization
- `auto-scaling-optimization` - Dynamic resource scaling

## 🎯 Usage Examples

### Discovery and Analysis
```bash
# Full stack discovery
peakinfer discover

# Save results for analysis
peakinfer discover --output results.json

# Dry run to see what would be optimized
peakinfer discover --dry-run
```

### Template Execution
```bash
# Execute with dry run first
peakinfer execute vllm-migration-memory-bound --dry-run

# Live execution
peakinfer execute vllm-migration-memory-bound

# Skip prerequisites (not recommended)
peakinfer execute pytorch-to-onnx-migration --skip-prerequisites
```

### Template Management
```bash
# List all templates
peakinfer templates

# Filter by category
peakinfer templates --category quantization

# Detailed template information
peakinfer templates --detailed
```

## 🔬 Under the Hood

### Template-Driven Intelligence
1. **Template Loading**: Extracts 27+ templates from design documents
2. **Environment Discovery**: Claude Code SDK agents analyze your full stack
3. **Smart Matching**: Matches templates to your environment using confidence scoring
4. **Economics Calculation**: Applies TokenSqueeze formulas for ROI analysis
5. **Intelligent Execution**: Claude agents execute templates with rollback safety

### Claude Code SDK Integration
- **EnvironmentDiscoveryAgent**: Analyzes application, serving, and infrastructure layers
- **TemplateExecutionAgent**: Interprets and executes optimization templates
- **MonitoringSystem**: Tracks execution and triggers rollbacks when needed

### Template Structure
Each template includes:
- **Environment Matching**: Criteria for when the template applies
- **Economics Model**: TokenSqueeze-based cost calculations and ROI formulas
- **Implementation Steps**: Executable commands with validation and rollback
- **Monitoring**: Key metrics and rollback triggers
- **Community Results**: Validation from real implementations

## 📈 Expected Results

Based on TokenSqueeze principles and community validation:

- **20-70% cost reduction** through cross-layer optimization
- **3-5x throughput improvement** with serving optimizations
- **Sub-30 second analysis** for typical environments
- **Automated rollback** if quality degrades

## 🛡️ Safety Features

- **Dry Run Mode**: Simulate all optimizations before execution
- **Automatic Rollback**: Revert changes if metrics degrade
- **Prerequisites Validation**: Ensure environment compatibility
- **Quality Monitoring**: Track performance and quality metrics
- **Community Validation**: Templates validated by 27+ implementations

## 🤝 Contributing

TokenOp is built on community-validated templates. Contribute by:

1. **Sharing Results**: Submit implementation reports for template validation
2. **Creating Templates**: Add new optimization strategies as templates
3. **Improving Detection**: Enhance environment discovery for your stack
4. **Economic Validation**: Help validate TokenSqueeze economic models

## 📚 Learn More

- [TokenSqueeze Book](./design/Token%20Squeeze%20-%20Guide%20to%20viable%20AI%20economics%20v0.52.md) - Economic foundations
- [Template Specifications](./design/TokenOp%20Template%20v0.2.md) - All 27+ templates
- [Product Requirements](./design/TokenOp%20Product%20Requirements%20Document%20(PRD)%20v0.7.md) - Technical architecture

## 📄 License

Apache 2.0 - Open source core with community templates

---

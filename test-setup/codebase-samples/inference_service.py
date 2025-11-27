"""
Sample LLM Inference Service
This file contains patterns across all optimization layers for PeakInfer to detect.

OPTIMIZATION OPPORTUNITIES:
- Application Layer: No caching, no batching, expensive model for simple tasks
- Serving Layer: Basic vLLM config, no prefix caching, low GPU utilization
- Infrastructure Layer: On-demand instances, single region
"""

# =============================================================================
# APPLICATION LAYER - LLM API Calls (Optimization: Caching, Routing, Batching)
# =============================================================================

from openai import OpenAI
from anthropic import Anthropic
import together

# Initialize clients
openai_client = OpenAI()
anthropic_client = Anthropic()

# ISSUE: Using GPT-4 for simple classification (should route to smaller model)
def classify_support_ticket(ticket_text: str) -> str:
    """Classify support ticket - EXPENSIVE: Uses GPT-4 for simple task"""
    response = openai_client.chat.completions.create(
        model="gpt-4o",  # Optimization: Route to gpt-4o-mini or fine-tuned classifier
        messages=[
            {"role": "system", "content": "Classify this ticket as: billing, technical, or general"},
            {"role": "user", "content": ticket_text}
        ],
        max_tokens=10
    )
    return response.choices[0].message.content

# ISSUE: No caching for repeated queries
def generate_sql(natural_language_query: str) -> str:
    """Generate SQL from natural language - NO CACHING"""
    # Same queries generate same SQL but we call API every time
    response = openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": "Convert to SQL. Output only the SQL query."},
            {"role": "user", "content": natural_language_query}
        ],
        temperature=0  # Deterministic output = perfect cache candidate
    )
    return response.choices[0].message.content

# ISSUE: No batching - sequential API calls
def process_documents(documents: list[str]) -> list[str]:
    """Process multiple documents - NO BATCHING"""
    summaries = []
    for doc in documents:  # Should batch these calls
        response = anthropic_client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=500,
            messages=[{"role": "user", "content": f"Summarize: {doc}"}]
        )
        summaries.append(response.content[0].text)
    return summaries

# ISSUE: Using expensive model for embeddings
def get_embeddings(texts: list[str]) -> list[list[float]]:
    """Get embeddings - USING EXPENSIVE MODEL"""
    # Should use text-embedding-3-small instead of large
    response = openai_client.embeddings.create(
        model="text-embedding-3-large",  # Optimization: Use text-embedding-3-small
        input=texts
    )
    return [e.embedding for e in response.data]


# =============================================================================
# SERVING LAYER - vLLM Configuration (Optimization: Prefix Caching, Tensor Parallel)
# =============================================================================

from vllm import LLM, SamplingParams

# ISSUE: Low GPU memory utilization, no prefix caching
llm = LLM(
    model="meta-llama/Llama-3.1-70B-Instruct",
    tensor_parallel_size=4,
    gpu_memory_utilization=0.85,  # Could be 0.95 with careful tuning
    enable_prefix_caching=False,  # OPTIMIZATION: Enable for repeated system prompts
    max_model_len=4096,  # Could be longer for some workloads
)

sampling_params = SamplingParams(
    temperature=0.7,
    top_p=0.9,
    max_tokens=2048,
)

def vllm_inference(prompts: list[str]) -> list[str]:
    """Run inference with vLLM"""
    outputs = llm.generate(prompts, sampling_params)
    return [output.outputs[0].text for output in outputs]


# =============================================================================
# SERVING LAYER - DeepSpeed Configuration
# =============================================================================

import deepspeed

# DeepSpeed ZeRO-3 config for training/fine-tuning
ds_config = {
    "zero_optimization": {
        "stage": 3,
        "offload_optimizer": {
            "device": "cpu",
            "pin_memory": True
        },
        "offload_param": {
            "device": "cpu",
            "pin_memory": True
        },
        "overlap_comm": True,
        "contiguous_gradients": True,
    },
    "fp16": {
        "enabled": True,
        "loss_scale": 0,
        "initial_scale_power": 16,
    },
    "gradient_accumulation_steps": 4,
    "train_batch_size": 32,
}


# =============================================================================
# SERVING LAYER - SGLang for high-throughput inference
# =============================================================================

from sglang import RuntimeEndpoint
import sglang as sgl

@sgl.function
def chat_completion(s, user_message):
    s += sgl.system("You are a helpful assistant.")
    s += sgl.user(user_message)
    s += sgl.assistant(sgl.gen("response", max_tokens=512))

# Initialize SGLang runtime
sglang_runtime = RuntimeEndpoint("http://localhost:30000")


# =============================================================================
# SERVING LAYER - Ollama for local inference
# =============================================================================

import ollama

ollama_client = ollama.Client(host="localhost:11434")

def ollama_inference(prompt: str, model: str = "llama3.1:70b") -> str:
    """Local inference with Ollama"""
    response = ollama_client.chat(
        model=model,
        messages=[{"role": "user", "content": prompt}]
    )
    return response["message"]["content"]


# =============================================================================
# SERVING LAYER - TensorRT-LLM optimized inference
# =============================================================================

# TensorRT-LLM engine loading
import tensorrt_llm
from tensorrt_llm.runtime import ModelRunner

def load_trt_engine(engine_path: str):
    """Load TensorRT-LLM optimized engine"""
    runner = ModelRunner.from_dir(engine_path)
    return runner


# =============================================================================
# INFRASTRUCTURE LAYER - Ray Serve deployment
# =============================================================================

from ray import serve

@serve.deployment(
    num_replicas=2,
    ray_actor_options={"num_gpus": 2}  # 2 GPUs per replica
)
class LLMDeployment:
    def __init__(self):
        self.model = LLM(
            model="meta-llama/Llama-3.1-8B-Instruct",
            tensor_parallel_size=2,
        )

    async def __call__(self, request):
        prompt = request.query_params.get("prompt")
        outputs = self.model.generate([prompt], sampling_params)
        return outputs[0].outputs[0].text


# =============================================================================
# INFRASTRUCTURE LAYER - Modal deployment
# =============================================================================

import modal

app = modal.App("llm-inference-service")

# ISSUE: Using on-demand H100s - could use spot for batch workloads
@app.function(
    gpu="H100",
    memory=32768,
    timeout=600,
)
def modal_inference(prompt: str) -> str:
    """Run inference on Modal H100"""
    from vllm import LLM, SamplingParams

    llm = LLM(model="meta-llama/Llama-3.1-70B-Instruct")
    outputs = llm.generate([prompt], SamplingParams(max_tokens=1024))
    return outputs[0].outputs[0].text


# =============================================================================
# INFRASTRUCTURE LAYER - Quantization for cost reduction
# =============================================================================

from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
import torch

# 4-bit quantization config
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_use_double_quant=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.bfloat16
)

# Load quantized model
model_4bit = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3.1-70B-Instruct",
    quantization_config=bnb_config,
    device_map="auto",
    torch_dtype=torch.bfloat16,
)


# =============================================================================
# INFRASTRUCTURE LAYER - FSDP for distributed training
# =============================================================================

from torch.distributed.fsdp import FullyShardedDataParallel as FSDP
from torch.distributed.fsdp import ShardingStrategy

# FSDP wrapping for multi-GPU training
def wrap_model_fsdp(model):
    """Wrap model with FSDP for distributed training"""
    fsdp_model = FSDP(
        model,
        sharding_strategy=ShardingStrategy.FULL_SHARD,
        use_orig_params=True,
    )
    return fsdp_model


# =============================================================================
# INFRASTRUCTURE CONFIG - Cloud instances
# =============================================================================

# AWS instance configurations
AWS_INFERENCE_CONFIG = {
    "primary_cluster": {
        "instance_type": "p4d.24xlarge",  # 8x A100 - $32.77/hr
        "count": 2,
        "region": "us-west-2",
    },
    "embedding_cluster": {
        "instance_type": "g5.12xlarge",  # 4x A10G - overkill for embeddings
        "count": 1,
        "region": "us-west-2",
    },
}

# CUDA environment
CUDA_VISIBLE_DEVICES = "0,1,2,3,4,5,6,7"


if __name__ == "__main__":
    # Example usage
    result = classify_support_ticket("My payment didn't go through")
    print(f"Classification: {result}")

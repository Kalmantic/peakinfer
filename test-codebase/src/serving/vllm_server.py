"""
vLLM Server - Tests vLLM Runtime Detection
Patterns: LLM class, SamplingParams, prefix caching, tensor parallelism
"""

from vllm import LLM, SamplingParams
from vllm.distributed.parallel_state import initialize_model_parallel
from typing import List, Optional, Dict, Any
import os


# =============================================================================
# CONFIGURATION
# =============================================================================

# GPU Configuration
os.environ["CUDA_VISIBLE_DEVICES"] = "0,1,2,3"

# Model configuration
MODEL_NAME = "meta-llama/Llama-3.1-70B-Instruct"
TENSOR_PARALLEL_SIZE = 4


# =============================================================================
# PATTERN: Basic vLLM Setup
# =============================================================================

# Initialize vLLM with standard configuration
llm = LLM(
    model=MODEL_NAME,
    tensor_parallel_size=TENSOR_PARALLEL_SIZE,
    gpu_memory_utilization=0.90,  # High utilization for production
    max_model_len=8192,
    trust_remote_code=True,
)

# Default sampling parameters
default_sampling_params = SamplingParams(
    temperature=0.7,
    top_p=0.9,
    max_tokens=2048,
    presence_penalty=0.0,
    frequency_penalty=0.0,
)


def generate(prompts: List[str], sampling_params: Optional[SamplingParams] = None) -> List[str]:
    """Basic generation with vLLM"""
    params = sampling_params or default_sampling_params
    outputs = llm.generate(prompts, params)
    return [output.outputs[0].text for output in outputs]


# =============================================================================
# PATTERN: Prefix Caching (for repeated system prompts)
# =============================================================================

# vLLM with prefix caching enabled
llm_with_cache = LLM(
    model="meta-llama/Llama-3.1-8B-Instruct",
    tensor_parallel_size=2,
    gpu_memory_utilization=0.85,
    enable_prefix_caching=True,  # PREFIX CACHING PATTERN
    max_model_len=4096,
)

SYSTEM_PROMPT = """You are a helpful AI assistant specialized in technical documentation.
You provide clear, concise, and accurate answers based on the provided context.
Always cite sources when available and acknowledge uncertainty when appropriate."""

def generate_with_prefix_cache(user_query: str) -> str:
    """Generation with prefix caching for repeated system prompts"""
    full_prompt = f"{SYSTEM_PROMPT}\n\nUser: {user_query}\n\nAssistant:"
    
    outputs = llm_with_cache.generate([full_prompt], default_sampling_params)
    return outputs[0].outputs[0].text


# =============================================================================
# PATTERN: High-Throughput Batch Processing
# =============================================================================

# Optimized for batch workloads
llm_batch = LLM(
    model="meta-llama/Llama-3.1-8B-Instruct",
    tensor_parallel_size=2,
    gpu_memory_utilization=0.95,
    max_num_batched_tokens=8192,  # High batch size
    max_num_seqs=256,  # Many concurrent sequences
    enable_chunked_prefill=True,  # Better scheduling
)

batch_sampling_params = SamplingParams(
    temperature=0.0,  # Deterministic for batch
    max_tokens=512,
)

def batch_generate(prompts: List[str]) -> List[str]:
    """High-throughput batch generation"""
    outputs = llm_batch.generate(prompts, batch_sampling_params)
    return [output.outputs[0].text for output in outputs]


# =============================================================================
# PATTERN: Speculative Decoding
# =============================================================================

# vLLM with speculative decoding for faster inference
llm_speculative = LLM(
    model="meta-llama/Llama-3.1-70B-Instruct",
    tensor_parallel_size=4,
    speculative_model="meta-llama/Llama-3.1-8B-Instruct",  # Draft model
    num_speculative_tokens=5,
    gpu_memory_utilization=0.85,
)

def speculative_generate(prompts: List[str]) -> List[str]:
    """Generation with speculative decoding"""
    outputs = llm_speculative.generate(prompts, default_sampling_params)
    return [output.outputs[0].text for output in outputs]


# =============================================================================
# PATTERN: Quantized Model (AWQ)
# =============================================================================

# AWQ quantized model for memory efficiency
llm_quantized = LLM(
    model="TheBloke/Llama-2-70B-Chat-AWQ",
    quantization="awq",  # QUANTIZATION PATTERN
    tensor_parallel_size=2,
    gpu_memory_utilization=0.90,
    dtype="half",  # FP16
)

def quantized_generate(prompts: List[str]) -> List[str]:
    """Generation with quantized model"""
    outputs = llm_quantized.generate(prompts, default_sampling_params)
    return [output.outputs[0].text for output in outputs]


# =============================================================================
# PATTERN: Streaming Output
# =============================================================================

def streaming_generate(prompt: str):
    """Streaming generation with vLLM - should detect streaming pattern"""
    from vllm import AsyncLLMEngine, SamplingParams as AsyncSamplingParams
    
    # For async streaming
    streaming_params = SamplingParams(
        temperature=0.7,
        max_tokens=1024,
    )
    
    # vLLM supports streaming through the AsyncLLMEngine
    outputs = llm.generate([prompt], streaming_params)
    
    for output in outputs:
        for completion in output.outputs:
            yield completion.text


# =============================================================================
# PATTERN: LoRA Adapter Loading
# =============================================================================

# vLLM with LoRA adapters
llm_lora = LLM(
    model="meta-llama/Llama-3.1-8B-Instruct",
    enable_lora=True,  # LORA PATTERN
    max_lora_rank=64,
    max_loras=4,  # Support multiple LoRA adapters
)

def generate_with_lora(prompts: List[str], lora_path: str) -> List[str]:
    """Generation with LoRA adapter"""
    from vllm.lora.request import LoRARequest
    
    lora_request = LoRARequest("custom_adapter", 1, lora_path)
    
    outputs = llm_lora.generate(
        prompts, 
        default_sampling_params,
        lora_request=lora_request
    )
    return [output.outputs[0].text for output in outputs]


# =============================================================================
# PATTERN: Guided Generation (JSON Mode)
# =============================================================================

from pydantic import BaseModel

class StructuredOutput(BaseModel):
    name: str
    age: int
    occupation: str

def guided_generate(prompt: str) -> Dict[str, Any]:
    """Guided generation with JSON schema"""
    from vllm.sampling_params import GuidedDecodingParams
    
    guided_params = SamplingParams(
        temperature=0.0,
        max_tokens=256,
        guided_decoding=GuidedDecodingParams(json=StructuredOutput.schema())
    )
    
    outputs = llm.generate([prompt], guided_params)
    import json
    return json.loads(outputs[0].outputs[0].text)


# =============================================================================
# HEALTHCHECK ENDPOINT
# =============================================================================

def health_check() -> Dict[str, Any]:
    """Health check endpoint"""
    return {
        "status": "healthy",
        "model": MODEL_NAME,
        "tensor_parallel_size": TENSOR_PARALLEL_SIZE,
        "gpu_count": len(os.environ.get("CUDA_VISIBLE_DEVICES", "0").split(",")),
    }


if __name__ == "__main__":
    # Test basic generation
    results = generate(["What is the capital of France?"])
    print(f"Result: {results[0]}")


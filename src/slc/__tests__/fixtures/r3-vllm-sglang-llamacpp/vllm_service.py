# R3 - Self-Hosted GPU
# vLLM, SGLang, llama.cpp with GPU resources

from vllm import LLM, SamplingParams
import sglang as sgl
from llama_cpp import Llama
import torch

# vLLM setup with GPU
llm = LLM(
    model="meta-llama/Llama-3.1-8B-Instruct",
    tensor_parallel_size=1,
    gpu_memory_utilization=0.9
)

# SGLang runtime
sgl_engine = sgl.Engine(model_path="meta-llama/Llama-3.1-8B-Instruct")

# llama.cpp with CUDA
llama_model = Llama(
    model_path="./models/llama-3.1-8b-instruct.Q4_K_M.gguf",
    n_gpu_layers=-1,  # All layers on GPU
    n_ctx=4096
)

sampling_params = SamplingParams(temperature=0.7, max_tokens=1024)

def vllm_generate(prompt: str) -> str:
    """vLLM inference on GPU"""
    outputs = llm.generate([prompt], sampling_params)
    return outputs[0].outputs[0].text

def sglang_generate(prompt: str) -> str:
    """SGLang inference"""
    with sgl_engine.session() as s:
        s += sgl.user(prompt)
        s += sgl.assistant(sgl.gen("response", max_tokens=1024))
    return s["response"]

def llamacpp_generate(prompt: str) -> str:
    """llama.cpp with CUDA acceleration"""
    output = llama_model(
        prompt,
        max_tokens=1024,
        temperature=0.7
    )
    return output["choices"][0]["text"]

def batch_inference(prompts: list[str]) -> list[str]:
    """Batched vLLM inference for throughput"""
    outputs = llm.generate(prompts, sampling_params)
    return [out.outputs[0].text for out in outputs]

# GPU detection
if torch.cuda.is_available():
    print(f"GPU: {torch.cuda.get_device_name(0)}")
    print(f"VRAM: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")

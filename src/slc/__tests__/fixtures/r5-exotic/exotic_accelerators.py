# R5 - Exotic Accelerators
# Cerebras, Groq, AMD MI300

from cerebras.cloud.sdk import Cerebras
from groq import Groq
import torch
import os

# Cerebras WSE client
cerebras = Cerebras(api_key=os.getenv("CEREBRAS_API_KEY"))

# Groq LPU client
groq = Groq(api_key=os.getenv("GROQ_API_KEY"))

def cerebras_inference(prompt: str) -> str:
    """Cerebras Wafer-Scale Engine inference"""
    response = cerebras.chat.completions.create(
        model="llama3.1-70b",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=1024
    )
    return response.choices[0].message.content

def groq_inference(prompt: str) -> str:
    """Groq LPU inference - ultra-low latency"""
    response = groq.chat.completions.create(
        model="llama-3.1-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=1024
    )
    return response.choices[0].message.content

def groq_streaming(prompt: str):
    """Groq streaming response"""
    stream = groq.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": prompt}],
        stream=True
    )
    for chunk in stream:
        if chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content

# AMD MI300 with ROCm
def amd_rocm_available() -> bool:
    """Check for AMD ROCm GPU"""
    return torch.cuda.is_available() and 'rocm' in torch.version.hip

def amd_inference_setup():
    """Setup for AMD MI300 with vLLM"""
    if amd_rocm_available():
        from vllm import LLM
        # vLLM with ROCm backend
        llm = LLM(
            model="meta-llama/Llama-3.1-70B-Instruct",
            tensor_parallel_size=8,  # MI300X has 8 XCDs
            dtype="float16"
        )
        return llm
    return None

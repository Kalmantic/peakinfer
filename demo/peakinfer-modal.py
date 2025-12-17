"""
🏔️ PeakInfer on Modal - Analyze TinyLLM with GPU

This script demonstrates running PeakInfer analysis on Modal's serverless GPU infrastructure.

Usage:
    modal run demo/peakinfer-modal.py

Prerequisites:
    pip install modal
    modal token new
"""

import modal
import subprocess

# Define the Modal app
app = modal.App("peakinfer-demo")

# Create image with Node.js and dependencies
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("curl", "git", "ca-certificates", "gnupg")
    .run_commands(
        # Install Node.js 20
        "curl -fsSL https://deb.nodesource.com/setup_20.x | bash -",
        "apt-get install -y nodejs",
    )
    .pip_install("anthropic")
)


@app.function(
    image=image,
    gpu="T4",  # Use T4 for cost efficiency, or "A10G", "A100" for more power
    timeout=600,
    secrets=[modal.Secret.from_name("anthropic-secret")],  # Set in Modal dashboard
)
def analyze_tinyllm():
    """Clone TinyLLM and analyze it with PeakInfer."""
    import os
    import subprocess

    print("🏔️ PeakInfer on Modal - TinyLLM Analysis")
    print("=" * 50)

    # Check GPU
    result = subprocess.run(["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv"],
                          capture_output=True, text=True)
    print(f"\n📊 GPU: {result.stdout.strip()}")

    # Clone TinyLLM
    print("\n📥 Cloning TinyLLM...")
    subprocess.run(["git", "clone", "https://github.com/jasonacox/TinyLLM.git", "/tmp/TinyLLM"],
                  capture_output=True)

    # List Python files
    print("\n📁 TinyLLM Python files:")
    result = subprocess.run(["find", "/tmp/TinyLLM", "-name", "*.py", "-type", "f"],
                          capture_output=True, text=True)
    files = result.stdout.strip().split('\n')
    for f in files[:15]:
        print(f"   {f}")
    if len(files) > 15:
        print(f"   ... and {len(files) - 15} more")

    # Search for LLM-related code
    print("\n🔍 LLM-related imports found:")
    patterns = ["openai", "vllm", "llama", "anthropic", "ollama"]
    for pattern in patterns:
        result = subprocess.run(
            ["grep", "-r", "-l", pattern, "/tmp/TinyLLM", "--include=*.py"],
            capture_output=True, text=True
        )
        if result.stdout.strip():
            files_found = result.stdout.strip().split('\n')
            print(f"   {pattern}: {len(files_found)} files")

    # TODO: Once PeakInfer is published to npm, run actual analysis:
    # subprocess.run(["npm", "install", "-g", "@kalmantic/peakinfer"])
    # subprocess.run(["peakinfer", "recommend", "/tmp/TinyLLM"])

    print("\n✅ Analysis complete!")
    print("\n💡 To run full PeakInfer analysis:")
    print("   1. Publish peakinfer to npm")
    print("   2. Add: subprocess.run(['peakinfer', 'recommend', '/tmp/TinyLLM'])")

    return {
        "status": "success",
        "files_analyzed": len(files),
        "gpu": result.stdout.strip() if result.returncode == 0 else "N/A"
    }


@app.function(
    image=image,
    gpu="A10G",  # Larger GPU for running vLLM
    timeout=1800,
    secrets=[modal.Secret.from_name("anthropic-secret")],
)
def run_vllm_inference():
    """Run vLLM inference server and analyze with PeakInfer."""
    import subprocess
    import time

    print("🚀 Starting vLLM on Modal A10G...")

    # Install vLLM
    subprocess.run(["pip", "install", "vllm"], check=True)

    # Start vLLM server in background
    # Using a small model for demo
    vllm_process = subprocess.Popen([
        "python", "-m", "vllm.entrypoints.openai.api_server",
        "--model", "facebook/opt-125m",  # Small model for demo
        "--port", "8000",
        "--gpu-memory-utilization", "0.5"
    ])

    # Wait for server to start
    print("⏳ Waiting for vLLM server to start...")
    time.sleep(30)

    # Test inference
    import requests
    try:
        response = requests.post(
            "http://localhost:8000/v1/completions",
            json={
                "model": "facebook/opt-125m",
                "prompt": "Hello, I am",
                "max_tokens": 20
            }
        )
        print(f"✅ vLLM Response: {response.json()}")
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        vllm_process.terminate()

    return {"status": "vLLM inference test complete"}


@app.local_entrypoint()
def main():
    """Run the analysis."""
    print("🏔️ Running PeakInfer on Modal...")
    print("-" * 50)

    # Run analysis
    result = analyze_tinyllm.remote()
    print(f"\n📊 Result: {result}")

    # Optionally run vLLM inference test
    # result = run_vllm_inference.remote()
    # print(f"\n📊 vLLM Result: {result}")


if __name__ == "__main__":
    # For local testing without Modal
    print("Run with: modal run demo/peakinfer-modal.py")

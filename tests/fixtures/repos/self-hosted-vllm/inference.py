from openai import OpenAI

# vLLM OpenAI-compatible server
client = OpenAI(
    base_url="http://localhost:8000/v1",
    api_key="dummy"
)

def generate(prompt: str, max_tokens: int = 512) -> str:
    response = client.completions.create(
        model="meta-llama/Llama-3-70b-chat-hf",
        prompt=prompt,
        max_tokens=max_tokens,
        temperature=0.7
    )
    return response.choices[0].text

def batch_generate(prompts: list[str]) -> list[str]:
    results = []
    for prompt in prompts:
        results.append(generate(prompt))
    return results

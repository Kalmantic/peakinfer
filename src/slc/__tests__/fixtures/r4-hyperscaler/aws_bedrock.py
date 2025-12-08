# R4 - Hyperscaler ML
# AWS Bedrock, GCP Vertex, Azure OpenAI

import boto3
from google.cloud import aiplatform
from openai import AzureOpenAI
import os

# AWS Bedrock client
bedrock = boto3.client(
    service_name='bedrock-runtime',
    region_name='us-east-1'
)

# GCP Vertex AI
aiplatform.init(project='my-project', location='us-central1')

# Azure OpenAI
azure_client = AzureOpenAI(
    api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    api_version="2024-02-01",
    azure_endpoint="https://my-resource.openai.azure.com"
)

def bedrock_claude(prompt: str) -> str:
    """AWS Bedrock with Claude"""
    import json
    body = json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 1024,
        "messages": [{"role": "user", "content": prompt}]
    })
    response = bedrock.invoke_model(
        modelId="anthropic.claude-3-5-sonnet-20241022-v2:0",
        body=body
    )
    return json.loads(response['body'].read())['content'][0]['text']

def bedrock_llama(prompt: str) -> str:
    """AWS Bedrock with Llama on Inferentia"""
    import json
    body = json.dumps({
        "prompt": prompt,
        "max_gen_len": 1024,
        "temperature": 0.7
    })
    response = bedrock.invoke_model(
        modelId="meta.llama3-1-70b-instruct-v1:0",
        body=body
    )
    return json.loads(response['body'].read())['generation']

def vertex_gemini(prompt: str) -> str:
    """GCP Vertex AI with Gemini"""
    from vertexai.generative_models import GenerativeModel
    model = GenerativeModel("gemini-1.5-pro")
    response = model.generate_content(prompt)
    return response.text

def vertex_palm(prompt: str) -> str:
    """GCP Vertex AI with PaLM on TPU"""
    from vertexai.language_models import TextGenerationModel
    model = TextGenerationModel.from_pretrained("text-bison@002")
    response = model.predict(prompt, max_output_tokens=1024)
    return response.text

def azure_openai_chat(prompt: str) -> str:
    """Azure OpenAI Service"""
    response = azure_client.chat.completions.create(
        model="gpt-4o",  # deployment name
        messages=[{"role": "user", "content": prompt}]
    )
    return response.choices[0].message.content

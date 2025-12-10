# R12 - Observability and Monitoring
# LangSmith, Weights & Biases, Arize, Phoenix, OpenTelemetry

from openai import OpenAI
from anthropic import Anthropic
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
from langsmith import Client as LangSmithClient
from langsmith.run_helpers import traceable
from langsmith.wrappers import wrap_openai
import wandb
from arize.pandas.logger import Client as ArizeClient
from arize.utils.types import ModelTypes, Environments
import phoenix as px
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
import time
import uuid

# Initialize clients
openai_client = OpenAI()
anthropic_client = Anthropic()
langsmith_client = LangSmithClient()

# LangSmith Tracing
@traceable(run_type="llm")
def langsmith_traced_completion(prompt: str, model: str = "gpt-4o") -> str:
    """LangSmith traced completion"""
    response = openai_client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}]
    )
    return response.choices[0].message.content

def langsmith_wrapped_client(prompt: str) -> str:
    """Use LangSmith-wrapped OpenAI client"""
    wrapped_client = wrap_openai(openai_client)

    response = wrapped_client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}]
    )
    return response.choices[0].message.content

@traceable(run_type="chain", name="multi_step_chain")
def langsmith_traced_chain(query: str) -> str:
    """Multi-step chain with LangSmith tracing"""
    # Step 1: Classification
    classification = langsmith_traced_completion(
        f"Classify this query: {query}",
        model="gpt-4o-mini"
    )

    # Step 2: Processing
    result = langsmith_traced_completion(
        f"Based on classification '{classification}', answer: {query}",
        model="gpt-4o"
    )

    return result

# LangSmith with LangChain
def langchain_with_langsmith(query: str) -> str:
    """LangChain with automatic LangSmith tracing"""
    # LangSmith tracing is automatic when LANGCHAIN_TRACING_V2=true
    llm = ChatOpenAI(model="gpt-4o", temperature=0)

    response = llm.invoke(query)
    return response.content

# Weights & Biases Logging
def wandb_logged_completion(prompt: str, project: str = "llm-inference") -> str:
    """W&B logged completion"""
    wandb.init(project=project, job_type="inference")

    start_time = time.time()
    response = openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}]
    )
    latency = time.time() - start_time

    # Log metrics
    wandb.log({
        "prompt_tokens": response.usage.prompt_tokens,
        "completion_tokens": response.usage.completion_tokens,
        "total_tokens": response.usage.total_tokens,
        "latency_ms": latency * 1000,
        "model": "gpt-4o"
    })

    wandb.finish()
    return response.choices[0].message.content

def wandb_trace_completion(prompt: str) -> str:
    """W&B Trace for LLM observability"""
    from wandb.sdk.data_types.trace_tree import Trace

    wandb.init(project="llm-traces")

    root_span = Trace(
        name="inference_request",
        kind="llm",
        metadata={"model": "gpt-4o"}
    )

    response = openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}]
    )

    root_span.log(name="inference_complete")
    wandb.finish()

    return response.choices[0].message.content

# Arize AI Logging
def arize_logged_completion(prompt: str) -> str:
    """Arize AI logged completion"""
    arize_client = ArizeClient(
        space_key="space-key",
        api_key="api-key"
    )

    prediction_id = str(uuid.uuid4())

    response = openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}]
    )

    # Log to Arize
    arize_client.log(
        model_id="gpt-4o-inference",
        model_version="1.0",
        model_type=ModelTypes.GENERATIVE_LLM,
        environment=Environments.PRODUCTION,
        prediction_id=prediction_id,
        prediction_label=response.choices[0].message.content,
        features={
            "prompt": prompt,
            "prompt_tokens": response.usage.prompt_tokens
        },
        embedding_features={
            "prompt_embedding": {
                "vector": [0.1] * 1536,  # Placeholder
                "raw_data": prompt
            }
        }
    )

    return response.choices[0].message.content

# Phoenix (Arize) Tracing
def phoenix_traced_completion(prompt: str) -> str:
    """Phoenix traced completion"""
    # Start Phoenix session
    session = px.launch_app()

    from phoenix.trace.openai import OpenAIInstrumentor
    OpenAIInstrumentor().instrument()

    response = openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}]
    )

    return response.choices[0].message.content

# OpenTelemetry Tracing
def setup_otel_tracing():
    """Setup OpenTelemetry tracing"""
    provider = TracerProvider()
    processor = BatchSpanProcessor(
        OTLPSpanExporter(endpoint="http://localhost:4317")
    )
    provider.add_span_processor(processor)
    trace.set_tracer_provider(provider)

    return trace.get_tracer("llm-inference")

def otel_traced_completion(prompt: str) -> str:
    """OpenTelemetry traced completion"""
    tracer = setup_otel_tracing()

    with tracer.start_as_current_span("openai_completion") as span:
        span.set_attribute("llm.model", "gpt-4o")
        span.set_attribute("llm.prompt", prompt)

        response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}]
        )

        span.set_attribute("llm.response", response.choices[0].message.content)
        span.set_attribute("llm.tokens.prompt", response.usage.prompt_tokens)
        span.set_attribute("llm.tokens.completion", response.usage.completion_tokens)

        return response.choices[0].message.content

# Custom Metrics Collector
class InferenceMetricsCollector:
    """Custom metrics collector for inference"""

    def __init__(self):
        self.client = OpenAI()
        self.metrics = []

    def complete(self, prompt: str, model: str = "gpt-4o") -> str:
        start_time = time.time()

        response = self.client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}]
        )

        latency = time.time() - start_time

        self.metrics.append({
            "timestamp": time.time(),
            "model": model,
            "prompt_tokens": response.usage.prompt_tokens,
            "completion_tokens": response.usage.completion_tokens,
            "latency_ms": latency * 1000,
            "cost_usd": self._calculate_cost(response.usage, model)
        })

        return response.choices[0].message.content

    def _calculate_cost(self, usage, model: str) -> float:
        # Simplified cost calculation
        pricing = {
            "gpt-4o": {"input": 2.50, "output": 10.00},
            "gpt-4o-mini": {"input": 0.15, "output": 0.60}
        }
        if model in pricing:
            p = pricing[model]
            return (usage.prompt_tokens * p["input"] + usage.completion_tokens * p["output"]) / 1_000_000
        return 0.0

    def get_metrics(self) -> list:
        return self.metrics

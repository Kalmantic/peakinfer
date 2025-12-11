# R11 - PEFT and Fine-Tuning
# LoRA, QLoRA, OpenAI Fine-Tuning, Adapters, PEFT

from openai import OpenAI
from anthropic import Anthropic
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from peft import LoraConfig, get_peft_model, PeftModel, prepare_model_for_kbit_training
from trl import SFTTrainer
from datasets import load_dataset
import together
from vllm import LLM, SamplingParams

# Initialize clients
openai_client = OpenAI()
together_client = together.Together()

# OpenAI Fine-Tuning
def create_openai_finetuning_job(training_file: str, model: str = "gpt-4o-mini-2024-07-18") -> str:
    """Create OpenAI fine-tuning job"""
    # Upload training file
    file_response = openai_client.files.create(
        file=open(training_file, "rb"),
        purpose="fine-tune"
    )

    # Create fine-tuning job
    job = openai_client.fine_tuning.jobs.create(
        training_file=file_response.id,
        model=model,
        hyperparameters={
            "n_epochs": 3,
            "batch_size": 4,
            "learning_rate_multiplier": 1.0
        }
    )

    return job.id

def use_finetuned_openai_model(prompt: str, finetuned_model: str) -> str:
    """Use a fine-tuned OpenAI model"""
    response = openai_client.chat.completions.create(
        model=finetuned_model,  # e.g., "ft:gpt-4o-mini-2024-07-18:org:custom:id"
        messages=[{"role": "user", "content": prompt}]
    )
    return response.choices[0].message.content

# Together AI Fine-Tuning
def create_together_finetuning_job(dataset_file: str, model: str = "meta-llama/Llama-3.3-70B-Instruct") -> str:
    """Create Together AI fine-tuning job"""
    job = together_client.fine_tuning.create(
        training_file=dataset_file,
        model=model,
        n_epochs=3,
        n_checkpoints=1,
        batch_size=4,
        learning_rate=1e-5,
        suffix="custom-model"
    )
    return job.id

def use_finetuned_together_model(prompt: str, finetuned_model: str) -> str:
    """Use a fine-tuned Together model"""
    response = together_client.chat.completions.create(
        model=finetuned_model,
        messages=[{"role": "user", "content": prompt}]
    )
    return response.choices[0].message.content

# LoRA Training with PEFT
def train_lora_adapter(
    base_model: str,
    dataset_path: str,
    output_dir: str
) -> str:
    """Train a LoRA adapter"""
    # Load base model
    model = AutoModelForCausalLM.from_pretrained(
        base_model,
        torch_dtype=torch.float16,
        device_map="auto"
    )
    tokenizer = AutoTokenizer.from_pretrained(base_model)

    # LoRA config
    lora_config = LoraConfig(
        r=16,
        lora_alpha=32,
        target_modules=["q_proj", "v_proj", "k_proj", "o_proj"],
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM"
    )

    # Apply LoRA
    model = get_peft_model(model, lora_config)

    # Load dataset
    dataset = load_dataset("json", data_files=dataset_path)

    # Train
    trainer = SFTTrainer(
        model=model,
        train_dataset=dataset["train"],
        tokenizer=tokenizer,
        max_seq_length=2048,
        args={
            "output_dir": output_dir,
            "num_train_epochs": 3,
            "per_device_train_batch_size": 4,
            "learning_rate": 2e-4,
        }
    )

    trainer.train()
    model.save_pretrained(output_dir)

    return output_dir

# QLoRA Training (4-bit quantized)
def train_qlora_adapter(
    base_model: str,
    dataset_path: str,
    output_dir: str
) -> str:
    """Train a QLoRA adapter with 4-bit quantization"""
    # Quantization config
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.float16,
        bnb_4bit_use_double_quant=True
    )

    # Load quantized model
    model = AutoModelForCausalLM.from_pretrained(
        base_model,
        quantization_config=bnb_config,
        device_map="auto"
    )

    model = prepare_model_for_kbit_training(model)

    tokenizer = AutoTokenizer.from_pretrained(base_model)

    # QLoRA config
    lora_config = LoraConfig(
        r=64,
        lora_alpha=16,
        target_modules=["q_proj", "v_proj", "k_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        lora_dropout=0.1,
        bias="none",
        task_type="CAUSAL_LM"
    )

    model = get_peft_model(model, lora_config)

    # Load and train
    dataset = load_dataset("json", data_files=dataset_path)

    trainer = SFTTrainer(
        model=model,
        train_dataset=dataset["train"],
        tokenizer=tokenizer,
        max_seq_length=4096,
    )

    trainer.train()
    model.save_pretrained(output_dir)

    return output_dir

# Load and Use LoRA Adapter
def load_lora_model(base_model: str, adapter_path: str):
    """Load a base model with LoRA adapter"""
    model = AutoModelForCausalLM.from_pretrained(
        base_model,
        torch_dtype=torch.float16,
        device_map="auto"
    )

    model = PeftModel.from_pretrained(model, adapter_path)
    tokenizer = AutoTokenizer.from_pretrained(base_model)

    return model, tokenizer

def inference_with_lora(prompt: str, model, tokenizer) -> str:
    """Run inference with LoRA-adapted model"""
    inputs = tokenizer(prompt, return_tensors="pt").to(model.device)

    outputs = model.generate(
        **inputs,
        max_new_tokens=512,
        temperature=0.7,
        do_sample=True
    )

    return tokenizer.decode(outputs[0], skip_special_tokens=True)

# vLLM with LoRA
def vllm_with_lora(prompt: str, base_model: str, lora_path: str) -> str:
    """vLLM inference with LoRA adapter"""
    llm = LLM(
        model=base_model,
        enable_lora=True,
        max_lora_rank=64
    )

    sampling_params = SamplingParams(
        temperature=0.7,
        max_tokens=512
    )

    # Load LoRA request
    from vllm.lora.request import LoRARequest
    lora_request = LoRARequest("custom-lora", 1, lora_path)

    outputs = llm.generate(
        [prompt],
        sampling_params,
        lora_request=lora_request
    )

    return outputs[0].outputs[0].text

# Merge LoRA into Base Model
def merge_lora_adapter(base_model: str, adapter_path: str, output_path: str):
    """Merge LoRA adapter into base model"""
    model = AutoModelForCausalLM.from_pretrained(
        base_model,
        torch_dtype=torch.float16,
        device_map="auto"
    )

    model = PeftModel.from_pretrained(model, adapter_path)
    merged_model = model.merge_and_unload()

    merged_model.save_pretrained(output_path)

    return output_path

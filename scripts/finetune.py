#!/usr/bin/env python3
"""
finetune.py
───────────
Fine-tunes Qwen2.5-7B-Instruct on the Deanchor training dataset using
Unsloth + QLoRA (4-bit) on RTX 3080 (10GB VRAM).

Requirements:
  pip install "unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git"
  pip install --no-deps trl peft accelerate bitsandbytes

Usage:
  python scripts/finetune.py
  python scripts/finetune.py --epochs 5 --output-name my-deanchor-v2
"""

import os
import sys
import argparse
import pathlib
import json

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

ROOT     = pathlib.Path(__file__).parent.parent
MODELS   = ROOT / "models"
DATASETS = ROOT / "datasets"

# ── Config ──────────────────────────────────────────────────────────────────
BASE_MODEL_PATH = str(MODELS / "Qwen2.5-7B-Instruct-HF")
TRAIN_DATA_PATH = str(DATASETS / "train.jsonl")
DEFAULT_OUTPUT  = "qwen2.5-7b-deanchor-lora"


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--base-model",   default=BASE_MODEL_PATH)
    p.add_argument("--data",         default=TRAIN_DATA_PATH)
    p.add_argument("--output-name",  default=DEFAULT_OUTPUT)
    p.add_argument("--epochs",       type=int,   default=3)
    p.add_argument("--lr",           type=float, default=2e-4)
    p.add_argument("--batch-size",   type=int,   default=2)
    p.add_argument("--grad-accum",   type=int,   default=4)
    p.add_argument("--max-seq-len",  type=int,   default=4096)
    p.add_argument("--lora-r",       type=int,   default=16)
    p.add_argument("--lora-alpha",   type=int,   default=16)
    p.add_argument("--export-gguf",  action="store_true", default=True)
    p.add_argument("--dry-run",      action="store_true")
    return p.parse_args()


def load_dataset(path: str):
    """Load JSONL dataset into Unsloth-compatible format."""
    data = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                data.append(json.loads(line))
    print(f"Loaded {len(data)} training examples from {path}")
    return data


def main():
    args = parse_args()

    # Check paths
    if not pathlib.Path(args.base_model).exists():
        print(f"ERROR: Base model not found at: {args.base_model}")
        print("Please download: huggingface-cli download Qwen/Qwen2.5-7B-Instruct "
              f"--local-dir {args.base_model}")
        sys.exit(1)

    if not pathlib.Path(args.data).exists():
        print(f"ERROR: Training data not found at: {args.data}")
        print("Please run: python scripts/generate_dataset.py")
        sys.exit(1)

    if args.dry_run:
        print("── DRY RUN MODE ──")
        print(f"Base model:   {args.base_model}")
        print(f"Training data: {args.data}")
        print(f"Output name:  {args.output_name}")
        print(f"Epochs:       {args.epochs}")
        print(f"LR:           {args.lr}")
        print(f"Batch:        {args.batch_size} × {args.grad_accum} (effective={args.batch_size*args.grad_accum})")
        print(f"Max seq len:  {args.max_seq_len}")
        print(f"LoRA rank:    {args.lora_r}, alpha: {args.lora_alpha}")
        data = load_dataset(args.data)
        print(f"Would train on {len(data)} examples × {args.epochs} epochs")
        return

    import torch
    from datasets import Dataset
    from transformers import (
        AutoModelForCausalLM,
        AutoTokenizer,
        BitsAndBytesConfig,
        TrainingArguments,
    )
    from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
    from trl import SFTTrainer

    print("\n── LOADING BASE MODEL ──")
    print(f"Model:   {args.base_model}")
    print(f"VRAM:    4-bit QLoRA on RTX 3080")

    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16,
        bnb_4bit_use_double_quant=True,
    )

    tokenizer = AutoTokenizer.from_pretrained(args.base_model, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    model = AutoModelForCausalLM.from_pretrained(
        args.base_model,
        quantization_config=bnb_config,
        device_map="auto",
        trust_remote_code=True,
    )
    model = prepare_model_for_kbit_training(model)

    print("\n── APPLYING LORA ──")
    peft_config = LoraConfig(
        r=args.lora_r,
        lora_alpha=args.lora_alpha,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
    )
    model = get_peft_model(model, peft_config)
    model.print_trainable_parameters()

    print("\n── LOADING TRAINING DATA ──")
    raw_data = load_dataset(args.data)

    def format_example(example):
        """Convert messages list to tokenized format."""
        text = tokenizer.apply_chat_template(
            example["messages"],
            tokenize=False,
            add_generation_prompt=False,
        )
        return {"text": text}

    hf_dataset = Dataset.from_list(raw_data)
    hf_dataset = hf_dataset.map(format_example, batched=False)

    print(f"Training examples: {len(hf_dataset)}")
    print(f"Sample (truncated):\n{hf_dataset[0]['text'][:300]}...\n")

    output_dir = str(MODELS / args.output_name)

    print(f"\n── TRAINING ──")
    print(f"Output:   {output_dir}")
    print(f"Epochs:   {args.epochs}")
    print(f"LR:       {args.lr}")
    print(f"Effective batch size: {args.batch_size * args.grad_accum}")

    from trl import SFTTrainer, SFTConfig

    training_args = SFTConfig(
        dataset_text_field="text",
        max_length=args.max_seq_len,
        per_device_train_batch_size=args.batch_size,
        gradient_accumulation_steps=args.grad_accum,
        warmup_steps=1,
        num_train_epochs=args.epochs,
        learning_rate=args.lr,
        fp16=not torch.cuda.is_bf16_supported(),
        bf16=torch.cuda.is_bf16_supported(),
        logging_steps=1,
        optim="paged_adamw_8bit",
        weight_decay=0.01,
        lr_scheduler_type="linear",
        seed=42,
        output_dir=output_dir,
        report_to="none",
    )

    trainer = SFTTrainer(
        model=model,
        processing_class=tokenizer,
        train_dataset=hf_dataset,
        args=training_args,
    )

    print("\nStarting training...")
    gpu_stats = torch.cuda.get_device_properties(0)
    print(f"GPU: {gpu_stats.name} ({gpu_stats.total_memory / 1e9:.1f}GB VRAM)")

    trainer_stats = trainer.train()

    print(f"\n── TRAINING COMPLETE ──")
    print(f"Training time: {trainer_stats.metrics['train_runtime']:.0f}s "
          f"({trainer_stats.metrics['train_runtime']/60:.1f} min)")
    print(f"Final loss:    {trainer_stats.metrics.get('train_loss', 'N/A'):.4f}")

    # Save LoRA adapter
    print(f"\nSaving LoRA adapter → {output_dir}")
    model.save_pretrained(output_dir)
    tokenizer.save_pretrained(output_dir)
    print("LoRA adapter saved.")

    # ── EXPORT TO GGUF ────────────────────────────────────────────────────
    if args.export_gguf:
        try:
            gguf_name = args.output_name.replace("-lora", "") + "-Q4_K_M"
            gguf_path = str(MODELS / f"{gguf_name}.gguf")

            print(f"\n── EXPORTING TO GGUF ──")
            print(f"Method: Q4_K_M quantization")
            print(f"Output: {gguf_path}")

            if hasattr(model, "save_pretrained_gguf"):
                model.save_pretrained_gguf(
                    gguf_path.replace(".gguf", ""),
                    tokenizer,
                    quantization_method="q4_k_m",
                )
                print(f"GGUF export complete: {gguf_path}")
            else:
                print("LoRA checkpoint saved successfully. To convert to GGUF, use llama.cpp/convert_lora_to_ggml.py.")
        except Exception as e:
            print(f"GGUF export notice: {e}")


if __name__ == "__main__":
    main()

"""
Florence-2 Fine-Tuning Pipeline for Engineering Blueprint Grounding.
Trains the Vision-Language Model to output simultaneous coordinates and descriptions.
"""

import json
import os
import sys
from typing import Dict, List

import numpy as np
from PIL import Image
import torch
from torch.utils.data import DataLoader, Dataset
from transformers import AdamW, AutoModelForCausalLM, AutoProcessor

from services.perception.perception.vlm.dataset import PIDVLMDatasetGenerator
from services.perception.perception.vlm.florence_config import TASK_DENSE_REGION_CAPTION


class PIDFlorenceDataset(Dataset):
    def __init__(self, json_path: str, processor, max_samples: int = 50):
        self.processor = processor
        self.base_dir = os.path.dirname(json_path)

        with open(json_path, "r", encoding="utf-8") as f:
            self.data = json.load(f)[:max_samples]

    def __len__(self):
        return len(self.data)

    def __getitem__(self, idx):
        item = self.data[idx]
        img_path = os.path.join(self.base_dir, "images", item["image"])
        image = Image.open(img_path).convert("RGB")

        prompt = TASK_DENSE_REGION_CAPTION
        target = item["tasks"][TASK_DENSE_REGION_CAPTION]

        inputs = self.processor(text=prompt, images=image, return_tensors="pt")
        target_tokens = self.processor.tokenizer(
            text=target,
            return_tensors="pt",
            padding="max_length",
            max_length=512,
            truncation=True,
        )

        return {
            "input_ids": inputs["input_ids"].squeeze(0),
            "pixel_values": inputs["pixel_values"].squeeze(0),
            "labels": target_tokens["input_ids"].squeeze(0),
        }


def collate_fn(batch):
    input_ids = torch.stack([b["input_ids"] for b in batch])
    pixel_values = torch.stack([b["pixel_values"] for b in batch])
    labels = torch.stack([b["labels"] for b in batch])
    # Ignore padding index in cross entropy loss
    labels[labels == 0] = -100

    return {
        "input_ids": input_ids,
        "pixel_values": pixel_values,
        "labels": labels,
    }


def train_florence(
    model_dir: str = "models/florence2",
    output_dir: str = "models/florence2_finetuned",
    epochs: int = 3,
    batch_size: int = 2,
    lr: float = 1e-5,
    num_samples: int = 30,
) -> str:
    """
    Execute local fine-tuning of Florence-2 VLM on Apple Silicon MPS.
    """
    os.makedirs(output_dir, exist_ok=True)
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    print(f"🚀 Initializing Florence-2 VLM Training on device: {device.upper()}")

    # 1. Generate or load training dataset
    data_gen = PIDVLMDatasetGenerator(output_dir="data/florence_dataset")
    dataset_json = os.path.join("data/florence_dataset", "dataset.json")
    if not os.path.exists(dataset_json):
        print("Generating P&ID Vision-Language grounding dataset...")
        dataset_json = data_gen.generate_dataset(num_samples=num_samples)
    else:
        print(f"Using existing dataset at: {dataset_json}")

    # 2. Load processor and model
    print(f"Loading base weights from: {model_dir}...")
    processor = AutoProcessor.from_pretrained(model_dir, trust_remote_code=True)
    model = AutoModelForCausalLM.from_pretrained(
        model_dir,
        torch_dtype=torch.float32,
        trust_remote_code=True,
    ).to(device)

    # Freeze vision tower slightly to focus on cross-attention / language decoder
    for param in model.vision_tower.parameters():
        param.requires_grad = False

    dataset = PIDFlorenceDataset(dataset_json, processor, max_samples=num_samples)
    dataloader = DataLoader(dataset, batch_size=batch_size, shuffle=True, collate_fn=collate_fn)

    optimizer = AdamW(filter(lambda p: p.requires_grad, model.parameters()), lr=lr)
    model.train()

    print(f"Starting fine-tuning: {epochs} epochs, {len(dataset)} samples...")
    for epoch in range(1, epochs + 1):
        epoch_loss = 0.0
        steps = 0
        for step, batch in enumerate(dataloader, 1):
            optimizer.zero_grad()
            input_ids = batch["input_ids"].to(device)
            pixel_values = batch["pixel_values"].to(device)
            labels = batch["labels"].to(device)

            outputs = model(
                input_ids=input_ids,
                pixel_values=pixel_values,
                labels=labels,
            )
            loss = outputs.loss
            loss.backward()
            optimizer.step()

            epoch_loss += loss.item()
            steps += 1
            if step % 5 == 0 or step == len(dataloader):
                print(f" Epoch [{epoch}/{epochs}] Step [{step}/{len(dataloader)}] - Batch Loss: {loss.item():.4f}")

        avg_loss = epoch_loss / max(steps, 1)
        print(f"✅ Epoch {epoch} complete. Average Loss: {avg_loss:.4f}")

    # Save fine-tuned checkpoint
    print(f"Saving fine-tuned model to: {output_dir}...")
    model.save_pretrained(output_dir)
    processor.save_pretrained(output_dir)
    print(f"🎉 Florence-2 fine-tuning complete! Saved to: {output_dir}")
    return output_dir


if __name__ == "__main__":
    epochs = int(sys.argv[1]) if len(sys.argv) > 1 else 2
    train_florence(epochs=epochs, num_samples=25)

import base64
import io
import random
import time
from pathlib import Path
from typing import Any
from uuid import uuid4

import requests
import torch
import torch.nn.functional as F
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image
from torchvision import models, transforms

BASE_DIR = Path(__file__).resolve().parent
IMAGES_DIR = BASE_DIR / "images"
IMAGES_DIR.mkdir(parents=True, exist_ok=True)

session = requests.Session()
session.headers.update({"User-Agent": "Mozilla/5.0"})

IMAGE_SPECS = [
    {
        "label": "dog",
        "filename": "dog.jpg",
        "urls": ["https://raw.githubusercontent.com/pytorch/hub/master/images/dog.jpg"],
        "class_index": 207,
    },
    {
        "label": "cat",
        "filename": "cat.jpg",
        "urls": ["https://raw.githubusercontent.com/EliSchwartz/imagenet-sample-images/master/n02123045_tabby.JPEG"],
        "class_index": 281,
    },
    {
        "label": "banana",
        "filename": "banana.jpg",
        "urls": ["https://raw.githubusercontent.com/EliSchwartz/imagenet-sample-images/master/n07753592_banana.JPEG"],
        "class_index": 954,
    },
    {
        "label": "car",
        "filename": "car.jpg",
        "urls": ["https://raw.githubusercontent.com/EliSchwartz/imagenet-sample-images/master/n02814533_beach_wagon.JPEG"],
        "class_index": 436,
    },
    {
        "label": "bird",
        "filename": "bird.jpg",
        "urls": ["https://raw.githubusercontent.com/EliSchwartz/imagenet-sample-images/master/n01558993_robin.JPEG"],
        "class_index": 15,
    },
    {
        "label": "chair",
        "filename": "chair.jpg",
        "urls": ["https://raw.githubusercontent.com/EliSchwartz/imagenet-sample-images/master/n03001627_chain_saw.JPEG"],
        "class_index": 559,
    },
    {
        "label": "apple",
        "filename": "apple.jpg",
        "urls": ["https://raw.githubusercontent.com/EliSchwartz/imagenet-sample-images/master/n07739125_apple.JPEG"],
        "class_index": 948,
    },
    {
        "label": "clock",
        "filename": "clock.jpg",
        "urls": ["https://raw.githubusercontent.com/EliSchwartz/imagenet-sample-images/master/n03196217_digital_clock.JPEG"],
        "class_index": 530,
    },
    {
        "label": "shoe",
        "filename": "shoe.jpg",
        "urls": ["https://raw.githubusercontent.com/EliSchwartz/imagenet-sample-images/master/n04199027_shower_cap.JPEG"],
        "class_index": 770,
    },
    {
        "label": "guitar",
        "filename": "guitar.jpg",
        "urls": ["https://raw.githubusercontent.com/EliSchwartz/imagenet-sample-images/master/n03272010_electric_guitar.JPEG"],
        "class_index": 546,
    },
]


class VerifyPayload(BaseModel):
    challenge_id: str
    answer: str


app = FastAPI(title="JANUS FGSM Service")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

weights = models.ResNet18_Weights.IMAGENET1K_V1
preprocess = transforms.ToTensor()
imagenet_mean = torch.tensor([0.485, 0.456, 0.406], dtype=torch.float32).view(1, 3, 1, 1)
imagenet_std = torch.tensor([0.229, 0.224, 0.225], dtype=torch.float32).view(1, 3, 1, 1)

challenge_store: dict[str, dict[str, Any]] = {}
image_bank: list[dict[str, Any]] = []
simple_label_by_index = {spec["class_index"]: spec["label"] for spec in IMAGE_SPECS}
tracked_class_indices = [spec["class_index"] for spec in IMAGE_SPECS]


def cleanup_expired() -> None:
    now = time.time()
    expired = [challenge_id for challenge_id, entry in challenge_store.items() if entry["expires_at"] <= now]
    for challenge_id in expired:
        challenge_store.pop(challenge_id, None)


def download_image(url: str, destination: Path) -> None:
    response = session.get(url, timeout=30)
    response.raise_for_status()
    destination.write_bytes(response.content)


def load_image_tensor(image_path: Path) -> torch.Tensor:
    image = Image.open(image_path).convert("RGB")
    image = image.resize((224, 224), Image.Resampling.LANCZOS)
    return preprocess(image)


def ensure_image_file(spec: dict[str, Any]) -> Path:
    destination = IMAGES_DIR / spec["filename"]
    for url in spec["urls"]:
        try:
            download_image(url, destination)
            return destination
        except Exception:
            continue
    if destination.exists():
        return destination
    raise RuntimeError(f"Unable to download demo image for {spec['label']}")


def load_resnet18() -> models.ResNet:
    model = models.resnet18(weights=weights)
    model.eval()
    return model


def classify_simple_label(logits: torch.Tensor) -> str:
    indexed_scores = logits[0, tracked_class_indices]
    best_offset = int(indexed_scores.argmax().item())
    best_index = tracked_class_indices[best_offset]
    return simple_label_by_index[best_index]


def tensor_to_base64_png(image_tensor: torch.Tensor) -> str:
    image = transforms.ToPILImage()(image_tensor.squeeze(0).cpu())
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


@app.on_event("startup")
def startup() -> None:
    image_bank.clear()
    for spec in IMAGE_SPECS:
        image_path = ensure_image_file(spec)
        image_tensor = load_image_tensor(image_path)
        image_bank.append(
            {
                "label": spec["label"],
                "tensor": image_tensor,
                "class_index": spec["class_index"],
                "source": str(image_path),
            }
        )

    global model
    model = load_resnet18()


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/generate")
def generate() -> dict[str, Any]:
    cleanup_expired()

    sample = random.choice(image_bank)
    input_tensor = sample["tensor"].unsqueeze(0).clone()
    input_tensor.requires_grad_(True)

    normalized_input = (input_tensor - imagenet_mean) / imagenet_std
    logits = model(normalized_input)
    predicted_label = classify_simple_label(logits)

    target = torch.tensor([int(sample["class_index"])], dtype=torch.long)
    loss = F.cross_entropy(logits, target)
    model.zero_grad(set_to_none=True)
    loss.backward()

    gradient = input_tensor.grad.detach()
    epsilon = round(random.uniform(0.007, 0.05), 4)
    perturbed = torch.clamp(input_tensor + epsilon * gradient.sign(), 0, 1).detach()

    perturbed_logits = model((perturbed - imagenet_mean) / imagenet_std)
    wrong_label = classify_simple_label(perturbed_logits)

    challenge_id = str(uuid4())
    challenge_store[challenge_id] = {
        "correct_label": sample["label"],
        "epsilon": epsilon,
        "expires_at": time.time() + 60,
    }

    return {
        "challenge_id": challenge_id,
        "image_b64": tensor_to_base64_png(perturbed),
        "correct_label": sample["label"],
        "ai_sees": wrong_label if wrong_label != sample["label"] else predicted_label,
        "epsilon": epsilon,
    }


@app.post("/verify")
def verify(payload: VerifyPayload) -> dict[str, bool]:
    cleanup_expired()
    entry = challenge_store.get(payload.challenge_id)
    if not entry:
        return {"correct": False}

    is_correct = payload.answer.strip().lower() == str(entry["correct_label"]).lower()
    if is_correct:
        challenge_store.pop(payload.challenge_id, None)
    return {"correct": is_correct}

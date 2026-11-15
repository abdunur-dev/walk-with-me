"""Local Amharic speech transcription and text translation helpers.

Heavy model dependencies are imported only when a corresponding function runs,
so importing the API package does not initialize NeMo or Transformers.
"""

from __future__ import annotations

import os
import tempfile
from functools import lru_cache
from pathlib import Path
from typing import Any

from .config import _load_dotenv

_load_dotenv()

ASR_MODEL_ID = os.getenv("WWM_ASR_MODEL", "addisai/addis-scribe-streaming")
TRANSLATION_MODEL_ID = os.getenv(
    "WWM_TRANSLATION_MODEL", "b1n1yam/gemma-2-27b-amharic-alpaca-sft"
)
SAMPLE_RATE = 16_000
MIN_TRANSLATION_VRAM_GB = float(os.getenv("WWM_MIN_TRANSLATION_VRAM_GB", "20"))
MAX_DURATION_SECONDS = int(os.getenv("SPEECH_MAX_DURATION_SECONDS", "120"))


def _required_file(path: str | Path) -> Path:
    audio_path = Path(path).expanduser().resolve()
    if not audio_path.is_file():
        raise FileNotFoundError(f"Audio file does not exist: {audio_path}")
    if audio_path.stat().st_size == 0:
        raise ValueError("Audio file is empty")
    return audio_path


def _as_16khz_mono_wav(path: str | Path, output_path: str | Path) -> None:
    """Decode supported audio input, convert to mono/16 kHz PCM WAV."""
    try:
        import librosa
        import numpy as np
        import soundfile as sf
    except ImportError as exc:
        raise RuntimeError(
            "Audio preprocessing dependencies are missing. Install with: "
            "pip install -r requirements-speech.txt"
        ) from exc

    # Check duration before decoding the payload into memory. librosa handles
    # channel downmixing/resampling and delegates compressed formats to decoders.
    duration = librosa.get_duration(path=str(path))
    if duration <= 0:
        raise ValueError("Audio file contains no decodable samples")
    if duration > MAX_DURATION_SECONDS:
        raise ValueError(f"Audio is longer than the {MAX_DURATION_SECONDS}-second limit")
    mono, _ = librosa.load(str(path), sr=SAMPLE_RATE, mono=True, dtype=np.float32)
    mono = np.asarray(mono, dtype=np.float32)
    if mono.size == 0:
        raise ValueError("Audio file contains no samples after resampling")
    sf.write(str(output_path), mono, SAMPLE_RATE, format="WAV", subtype="PCM_16")


@lru_cache(maxsize=1)
def _load_asr_model() -> Any:
    try:
        import torch
        from nemo.collections.asr.models import ASRModel
    except ImportError as exc:
        raise RuntimeError(
            "NeMo ASR dependencies are missing. Install with: "
            "pip install -r requirements-speech.txt"
        ) from exc

    model = ASRModel.from_pretrained(model_name=ASR_MODEL_ID)
    model = model.to("cuda" if torch.cuda.is_available() else "cpu")
    model.eval()
    return model


def transcribe_audio(path: str | Path) -> str:
    """Transcribe Amharic speech after converting audio to 16 kHz mono WAV."""
    audio_path = _required_file(path)
    with tempfile.TemporaryDirectory(prefix="wwm-asr-") as directory:
        wav_path = Path(directory) / "normalized-16khz-mono.wav"
        _as_16khz_mono_wav(audio_path, wav_path)
        result = _load_asr_model().transcribe([str(wav_path)])

    if not result:
        return ""
    first = result[0]
    text = first if isinstance(first, str) else getattr(first, "text", None)
    if text is None:
        raise RuntimeError("NeMo returned an unsupported transcription result")
    return str(text).strip()


def _cuda_memory_available(torch: Any) -> tuple[bool, float]:
    if not torch.cuda.is_available():
        return False, 0.0
    try:
        free_bytes, _ = torch.cuda.mem_get_info()
    except Exception:
        return False, 0.0
    free_gb = free_bytes / (1024**3)
    return free_gb >= MIN_TRANSLATION_VRAM_GB, free_gb


@lru_cache(maxsize=1)
def _load_local_translation_model() -> tuple[Any, Any, Any]:
    try:
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
    except ImportError as exc:
        raise RuntimeError(
            "Local translation dependencies are missing. Install with: "
            "pip install -r requirements-speech.txt"
        ) from exc

    enough_memory, free_gb = _cuda_memory_available(torch)
    if not enough_memory:
        raise RuntimeError(
            f"Local translation needs a CUDA GPU with at least "
            f"{MIN_TRANSLATION_VRAM_GB:.0f} GiB free; detected {free_gb:.1f} GiB. "
            "Configure HF_INFERENCE_ENDPOINT_URL or use a suitable GPU."
        )

    quantization = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.float16,
        bnb_4bit_use_double_quant=True,
    )
    tokenizer = AutoTokenizer.from_pretrained(TRANSLATION_MODEL_ID)
    model = AutoModelForCausalLM.from_pretrained(
        TRANSLATION_MODEL_ID,
        quantization_config=quantization,
        device_map="auto",
        low_cpu_mem_usage=True,
    )
    model.eval()
    return torch, tokenizer, model


def _translation_prompt(text: str, source_language: str, target_language: str) -> str:
    return (
        f"Translate the following text from {source_language} to {target_language}. "
        "Preserve its meaning and names. Return only the translation.\n\n"
        f"Text:\n{text}"
    )


def _translate_with_endpoint(
    text: str, source_language: str, target_language: str, endpoint_url: str
) -> str:
    try:
        from huggingface_hub import InferenceClient
    except ImportError as exc:
        raise RuntimeError(
            "huggingface_hub is missing. Install with: pip install -r requirements-speech.txt"
        ) from exc

    client = InferenceClient(model=endpoint_url, token=os.getenv("HF_TOKEN") or None)
    response = client.chat_completion(
        messages=[
            {
                "role": "user",
                "content": _translation_prompt(text, source_language, target_language),
            }
        ],
        max_tokens=int(os.getenv("WWM_TRANSLATION_MAX_NEW_TOKENS", "256")),
        temperature=0.0,
    )
    content = response.choices[0].message.content
    if not content:
        raise RuntimeError("Translation endpoint returned an empty response")
    return content.strip()


def translate_text(
    text: str, source_language: str = "Amharic", target_language: str = "English"
) -> str:
    """Translate text with the configured Hugging Face endpoint or local 4-bit LLM."""
    text = text.strip()
    if not text:
        raise ValueError("Text to translate cannot be empty")
    if not source_language.strip() or not target_language.strip():
        raise ValueError("Source and target languages must be provided")

    endpoint_url = os.getenv("HF_INFERENCE_ENDPOINT_URL", "").strip()
    if endpoint_url:
        return _translate_with_endpoint(text, source_language, target_language, endpoint_url)

    torch, tokenizer, model = _load_local_translation_model()
    prompt = _translation_prompt(text, source_language, target_language)
    messages = [{"role": "user", "content": prompt}]
    if getattr(tokenizer, "chat_template", None):
        inputs = tokenizer.apply_chat_template(
            messages, add_generation_prompt=True, return_tensors="pt", return_dict=True
        )
    else:
        inputs = tokenizer(prompt, return_tensors="pt")
    input_device = model.get_input_embeddings().weight.device
    inputs = {key: value.to(input_device) for key, value in inputs.items()}
    with torch.inference_mode():
        generated = model.generate(
            **inputs,
            max_new_tokens=int(os.getenv("WWM_TRANSLATION_MAX_NEW_TOKENS", "256")),
            do_sample=False,
        )
    new_tokens = generated[0, inputs["input_ids"].shape[1] :]
    return tokenizer.decode(new_tokens, skip_special_tokens=True).strip()


def speech_to_translated_text(
    path: str | Path, target_language: str = "English"
) -> dict[str, str]:
    """Run Amharic audio transcription followed by translation."""
    transcript = transcribe_audio(path)
    if not transcript:
        raise RuntimeError("No speech was recognized in the audio file")
    translation = translate_text(
        transcript, source_language="Amharic", target_language=target_language
    )
    return {
        "transcript": transcript,
        "source_language": "Amharic",
        "translation": translation,
        "target_language": target_language,
    }

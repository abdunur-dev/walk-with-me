# Audio transcription and translation implementation plan

Date: 2026-11-14

## Current project structure

- The backend is a Python 3.11+ FastAPI application in `api/app/`.
- `api/app/` currently owns configuration, API routers, model providers, and shared services. `scripts/` contains standalone data and build commands.
- `requirements.txt` is the small dependency list for the whole application. The Docker image uses Python 3.12 and installs that file, so large GPU/ASR dependencies should stay out of the default API image.
- The web client is a separate Next.js static export. The end-user feature uses a new accessible upload page and API route; transcripts and uploaded audio are not added to the database.
- This change will be developed on `codex/speech-translation-pipeline`, separate from the existing widget PR branch.

## Model and runtime findings

### Speech recognition

Use `addisai/addis-scribe-streaming` through NeMo's `ASRModel.from_pretrained()` and `transcribe()` APIs. The model card identifies a 0.6B Cache-aware FastConformer with RNNT/CTC decoding. Its supported input is mono Amharic at 16 kHz; its transcript output has no punctuation. The current card's streaming implementation calls for NeMo 3.0, `numba-cuda[cu12]`, `numpy<2.4`, and `nvidia-nvjitlink-cu12>=12.9`. The model is licensed under OpenMDW-1.1. [Model card](https://huggingface.co/addisai/addis-scribe-streaming)

### Translation checkpoint

The Addis AI organization page links a curated Amharic language-model collection. The most recent checkpoint in that collection whose card explicitly documents instruction fine-tuning is `b1n1yam/gemma-2-27b-amharic-alpaca-sft`, a 27B supervised fine-tune for Amharic conversational use. It is described as an early research release, and its card does not publish translation-specific evaluation. It is larger than a typical consumer GPU can run without quantization. [Addis AI collection](https://huggingface.co/collections/addisai/amharic-language-models-and-instruction-data) · [Gemma SFT model card](https://huggingface.co/b1n1yam/gemma-2-27b-amharic-alpaca-sft)

The collection also has a newer `b1n1yam/qwen-amh-2b` text-generation PEFT adapter based on `unsloth/Qwen3.5-2B`. Its model card is largely placeholder text and does not document the adapter's license, instruction-tuning objective, or translation quality. The implementation will not silently treat it as a translation-ready checkpoint. [Qwen adapter card](https://huggingface.co/b1n1yam/qwen-amh-2b)

Neither Gemma SFT nor the Qwen adapter currently has a Hugging Face Inference Provider deployment. The fallback therefore must use a user-configured Hugging Face Inference Endpoint URL (or compatible endpoint), not assume serverless Inference API support. [Gemma SFT deployment status](https://huggingface.co/b1n1yam/gemma-2-27b-amharic-alpaca-sft) · [Qwen adapter deployment status](https://huggingface.co/b1n1yam/qwen-amh-2b)

This machine reports no usable NVIDIA driver/GPU. A full local model run cannot be verified here without GPU access or a configured inference endpoint; avoid downloading large weights as part of setup.

## Proposed implementation

1. Add `api/app/speech_translation.py` with lazy model loading and three public functions:
   - `transcribe_audio(path)`: decode input, convert to mono, resample to 16 kHz, write a temporary PCM WAV, pass only that WAV to NeMo, and remove it afterward.
   - `translate_text(text, source_language, target_language)`: use the configured local checkpoint or configured hosted endpoint and return translation text.
   - `speech_to_translated_text(path, target_language)`: return both transcript and translation, with Amharic as the fixed ASR source language.
2. Add `requirements-speech.txt` for optional speech/LLM dependencies so routine API and Docker installs do not pull in CUDA and NeMo packages. Include NeMo ASR 3.x, PyTorch, Transformers, Accelerate, bitsandbytes, librosa, soundfile, and huggingface_hub.
3. Load the 27B translation checkpoint only when explicitly configured for local use and only with 4-bit quantization on a compatible CUDA GPU with enough free memory. If that cannot be used, require a configured endpoint URL and return an actionable error if neither backend is available. Never silently fall back to unquantized CPU loading.
4. Add `POST /v1/speech/translate` with consent enforcement, upload size and duration limits, Redis-backed production rate limiting, one in-process inference slot, temporary file cleanup, and a disabled-by-default feature flag.
5. Add an accessible Next.js `/speech` upload page and link it from navigation and the home page. Keep model imports lazy so normal API startup remains lightweight.
6. Keep `scripts/speech_translate.py` as a local CLI. Document model limitations, optional installation, endpoint configuration, and deployment requirements in `README.md` and `.env.example`.

## Verification plan

- Confirm the CLI help works without loading model dependencies.
- Exercise audio preprocessing with a small synthetic non-16-kHz stereo WAV and confirm NeMo receives a temporary 16-kHz mono WAV.
- Exercise translation backend selection and clear failure messages without loading the 27B checkpoint.
- Do not claim a full ASR/translation run unless a compatible GPU or configured inference endpoint is available.

## Implementation status

- Added the optional dependency file, lazy-loading service functions, local 4-bit CUDA guard, Hugging Face Inference Endpoint path, and CLI in `scripts/speech_translate.py`.
- Added the consent-based audio upload API, protected model credentials, size/duration limits, rate limiting, temporary file cleanup, accessible `/speech` page, and site navigation.
- Added Redis-backed shared rate limits for production, a profile-gated Redis service for Compose, and an Nginx reverse-proxy configuration that caps request size.
- Added optional environment settings and setup/usage guidance to `.env.example` and `README.md`.
- The model repository contains a 499 MB Q5 GGUF export for Android tests, but its card says parity, Amharic accuracy, and runtime behavior are unverified. The app retains NeMo as its ASR runtime. Translation weights already use 4-bit quantization for suitable CUDA GPUs.
- Verified CLI `--help`, Python bytecode compilation, and `git diff --check` on 2026-11-14.
- The new page passes targeted ESLint and the Next TypeScript check. The full repository ESLint command reports six existing hook-rule errors in unrelated console/jobs files. Production build could not fetch the existing Google Fonts due network restrictions. API import/runtime route validation is pending installation of `python-multipart`; package installation was blocked because this environment cannot resolve PyPI.
- Full inference and preprocessing could not be exercised on this host: the optional audio packages are not installed and no NVIDIA driver/GPU is available. Install the optional requirements and configure a suitable GPU or endpoint to run the pipeline.

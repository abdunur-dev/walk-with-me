#!/usr/bin/env python3
"""Transcribe Amharic audio and translate it with Addis AI Hugging Face models."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("audio", type=Path, help="Input audio file (for example WAV, FLAC, or MP3)")
    parser.add_argument("--target-language", default="English", help="Translation language (default: English)")
    parser.add_argument("--json", action="store_true", dest="as_json", help="Print machine-readable JSON")
    args = parser.parse_args()

    from api.app.speech_translation import speech_to_translated_text

    try:
        result = speech_to_translated_text(args.audio, target_language=args.target_language)
    except Exception as exc:
        print(f"Speech translation failed: {exc}", file=sys.stderr)
        return 2
    if args.as_json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(f"Transcript ({result['source_language']}):\n{result['transcript']}\n")
        print(f"Translation ({result['target_language']}):\n{result['translation']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

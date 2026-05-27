#!/usr/bin/env python3
from __future__ import annotations

import asyncio
import json
import re
import sys
from pathlib import Path

try:
    import edge_tts
except ImportError:
    sys.exit("Missing dependency: python3 -m pip install --user edge-tts")


def clean_text(text: str) -> str:
    return (
        text.replace("\n", " ")
        .replace("—", ",")
        .replace("–", ",")
        .replace("...", ".")
        .replace("??", "?")
        .replace("💪", "")
        .replace("😱", "")
        .replace("🌷", "")
        .replace("😊", "")
        .replace("✨", "")
        .replace("📓", "")
        .replace("📍", "")
        .replace("👇", "")
        .replace("🙋", "")
        .replace("🍔", "")
        .replace("🚪", "")
        .strip()
    )


def voice_for(line: dict, voices: dict[str, str], default_voice: str) -> str:
    speaker = str(line.get("speaker") or "").strip()
    if speaker in voices:
        return voices[speaker]
    role = str(line.get("role") or "").strip()
    if role == "male":
        return voices.get("Kevin", default_voice)
    if role == "female":
        return voices.get("Mia", voices.get("You", default_voice))
    if role == "question":
        return voices.get("question", default_voice)
    return voices.get("narration", default_voice)


async def generate_one(text: str, voice: str, rate: str, output_path: Path, force: bool) -> str:
    if output_path.exists() and output_path.stat().st_size < 1024:
        output_path.unlink()
    if output_path.exists() and not force:
        return "skip"

    output_path.parent.mkdir(parents=True, exist_ok=True)
    for attempt in range(1, 4):
        try:
            communicate = edge_tts.Communicate(text, voice, rate=rate)
            await communicate.save(str(output_path))
            if output_path.exists() and output_path.stat().st_size >= 1024:
                return "ok"
        except Exception as exc:
            if output_path.exists() and output_path.stat().st_size < 1024:
                output_path.unlink()
            if attempt == 3:
                print(f"  FAIL {output_path.name:30s} [{voice}] {exc}", file=sys.stderr)
                return "fail"
            await asyncio.sleep(0.8 * attempt)
    return "fail"


async def main() -> None:
    force = "--force" in sys.argv
    root = Path(__file__).resolve().parents[1]
    config = json.loads((root / "src/data/config/prelude_tutorial.json").read_text(encoding="utf-8"))
    voices_config = json.loads((root / "src/data/config/voices.json").read_text(encoding="utf-8"))
    voices = voices_config["voices"]
    default_voice = voices_config.get("default_voice", "en-US-AriaNeural")
    rate = voices_config.get("edge_rate", "-30%")
    output_root = root / "public/audio/prelude"

    jobs = []
    for line_id, line in config.get("lines", {}).items():
        audio = line.get("audio")
        if not audio:
            continue
        raw_text = str(line.get("text") or line.get("textTemplate") or "")
        text = clean_text(re.sub(r"\{playerName\}", "friend", raw_text))
        if not text:
            continue
        jobs.append((line_id, audio, voice_for(line, voices, default_voice), text))

    print(f"Prelude: {len(jobs)} audio lines")
    generated = 0
    skipped = 0
    for line_id, filename, voice, text in jobs:
        status = await generate_one(text, voice, rate, output_root / filename, force)
        if status == "ok":
            generated += 1
            print(f"  OK   {filename:30s} [{voice}] {line_id}")
        elif status == "skip":
            skipped += 1
            print(f"  skip {filename:30s} {line_id}")
        else:
            print(f"  fail {filename:30s} {line_id}")

    print(f"Done. generated={generated}, skipped={skipped}")


if __name__ == "__main__":
    asyncio.run(main())

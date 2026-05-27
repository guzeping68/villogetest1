#!/usr/bin/env python3
from __future__ import annotations

import asyncio
import json
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
        .replace("✨", "")
        .replace("💫", "")
        .replace("🎙️", "")
        .replace("💬", "")
        .replace("📓", "")
        .strip()
    )


async def generate_one(text: str, voice: str, rate: str, output_path: Path, force: bool) -> str:
    if output_path.exists() and output_path.stat().st_size < 1024:
        output_path.unlink()
    if output_path.exists() and not force:
        return "skip"

    output_path.parent.mkdir(parents=True, exist_ok=True)
    for attempt in range(1, 4):
        try:
            communicate = edge_tts.Communicate(clean_text(text), voice, rate=rate)
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
    voices_config = json.loads((root / "src/data/config/voices.json").read_text(encoding="utf-8"))
    voices = voices_config["voices"]
    rate = voices_config.get("edge_rate", "-30%")
    mia_voice = voices.get("Mia", voices_config.get("default_voice", "en-US-JennyNeural"))

    jobs = [
        (
            "public/audio/onboarding/001_intro_fun.mp3",
            "Start your language adventure now!",
        ),
        (
            "public/audio/onboarding/002_barista_question.mp3",
            "Hey! What can I get for you?",
        ),
        (
            "public/audio/onboarding/002_me_latte.mp3",
            "I'd like a latte, please.",
        ),
        (
            "public/audio/onboarding/003_town_growth.mp3",
            "Every lesson grows your town.",
        ),
        (
            "public/audio/onboarding/004_mia_welcome.mp3",
            "Hi, welcome to LingoVille! I'm Mia, your learning buddy.",
        ),
        (
            "public/audio/onboarding/004_mia_name_prompt.mp3",
            "Before we get started, let's get to know each other. What's your name?",
        ),
        (
            "public/audio/onboarding/004_mia_ready.mp3",
            "Everything's set! Your town will grow as you learn. Let's get started!",
        ),
        (
            "public/audio/ui/start.mp3",
            "Start.",
        ),
        (
            "public/audio/ui/learning.mp3",
            "Learning.",
        ),
        (
            "public/audio/guides/001_first_decoration.mp3",
            "Look, your apartment has its first decoration. Already feeling more like home!",
        ),
        (
            "public/audio/guides/002_decoration_system.mp3",
            "Here's how it works. Every unit you finish equals one new decoration. Your apartment will keep growing as you learn.",
        ),
        (
            "public/audio/guides/101_framework_overview.mp3",
            "Eight buildings. Eight real-life situations. Every place teaches you English you'll actually use.",
        ),
        (
            "public/audio/guides/102_mistake_book.mp3",
            "This is your Mistake Book. Every tricky one is saved here for review!",
        ),
        (
            "public/audio/guides/103_ai_custom.mp3",
            "Tell me what you want to learn. I'll create a lesson just for you.",
        ),
        (
            "public/audio/guides/104_ai_speaking.mp3",
            "Need to practice speaking? Tap here whenever you want to chat!",
        ),
    ]

    print(f"UI audio: {len(jobs)} lines")
    generated = 0
    skipped = 0
    for relative_path, text in jobs:
        output_path = root / relative_path
        status = await generate_one(text, mia_voice, rate, output_path, force)
        if status == "ok":
            generated += 1
            print(f"  OK   {output_path.relative_to(root)}")
        elif status == "skip":
            skipped += 1
            print(f"  skip {output_path.relative_to(root)}")
        else:
            print(f"  fail {output_path.relative_to(root)}")

    print(f"Done. generated={generated}, skipped={skipped}")


if __name__ == "__main__":
    asyncio.run(main())

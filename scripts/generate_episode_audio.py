#!/usr/bin/env python3
from __future__ import annotations

import argparse
import asyncio
import json
import re
import sys
from pathlib import Path

try:
    import edge_tts
except ImportError:
    sys.exit("Missing dependency: python3 -m pip install --user edge-tts")


def slugify_speaker(speaker: str | None) -> str:
    value = (speaker or "narration").lower()
    value = value.replace(".", "").replace(",", "")
    value = re.sub(r"[^a-z0-9]+", "_", value)
    return value.strip("_") or "speaker"


def normalize_speaker(speaker: str | None) -> str:
    if not speaker:
        return ""
    return re.sub(r"\s+", " ", speaker).strip()


def voice_for(speaker: str | None, voices: dict[str, str], default_voice: str) -> str:
    normalized = normalize_speaker(speaker)
    if normalized in voices:
        return voices[normalized]

    lowered = normalized.lower()
    for key, voice in voices.items():
        key_lower = key.lower()
        if lowered.startswith(key_lower) or key_lower.startswith(lowered):
            return voice

    return default_voice


def clean_text(text: str) -> str:
    return (
        text.replace("📍", "")
        .replace("\n", " ")
        .replace("—", ",")
        .replace("–", ",")
        .replace("…", "...")
        .replace("“", '"')
        .replace("”", '"')
        .strip()
    )


def collect_jobs(episode_path: Path, episode_num: int, voices: dict[str, str], default_voice: str):
    data = json.loads(episode_path.read_text(encoding="utf-8"))
    steps = data.get("steps", data)
    jobs = []

    for idx, step in enumerate(steps, start=1):
        step_type = step.get("type")
        speaker = step.get("speaker")

        if step_type == "narrator":
            text = step.get("speech_text") or step.get("text_en") or step.get("text") or step.get("text_cn") or ""
            voice = voices.get("narration", default_voice)
            speaker_slug = "narration"
        elif step_type == "dialogue":
            text = step.get("speech_text") or step.get("text_en") or step.get("text") or ""
            voice = voice_for(speaker, voices, default_voice)
            speaker_slug = slugify_speaker(speaker)
        elif step_type in {"question", "interactive"}:
            text = (
                step.get("speech_text")
                or step.get("target_sentence")
                or step.get("instruction")
                or step.get("question")
                or ""
            )
            voice = voices.get("question", voices.get("narration", default_voice))
            speaker_slug = "question"
        else:
            continue

        text = clean_text(text)
        if not text or not re.search(r"[A-Za-z0-9\u4e00-\u9fff]", text):
            continue

        filename = f"step_{idx:03d}_{speaker_slug}.mp3"
        jobs.append((filename, voice, text))

    return jobs


async def generate_one(text: str, voice: str, rate: str, output_path: Path, force: bool):
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
                print(f"  FAIL {output_path.name:34s} [{voice}] {exc}", file=sys.stderr)
                return "fail"
            await asyncio.sleep(0.8 * attempt)

    return "fail"


async def main():
    parser = argparse.ArgumentParser(description="Generate LingoVille episode audio with Edge TTS voices.")
    parser.add_argument("--episode", default="all", help='Episode number, comma list, or "all".')
    parser.add_argument("--force", action="store_true", help="Overwrite existing mp3 files.")
    parser.add_argument("--root", default=str(Path(__file__).resolve().parents[1]))
    args = parser.parse_args()

    root = Path(args.root)
    voices_config = json.loads((root / "src/data/config/voices.json").read_text(encoding="utf-8"))
    voices = voices_config["voices"]
    default_voice = voices_config.get("default_voice", "en-US-AriaNeural")
    rate = voices_config.get("edge_rate", "-30%")

    config_dir = root / "src/data/config"
    output_root = root / "public/audio/episodes"

    if args.episode == "all":
        targets = sorted(
            int(match.group(1))
            for path in config_dir.glob("episode_*.json")
            if (match := re.search(r"episode_(\d+)\.json$", path.name))
        )
    else:
        targets = [int(value) for value in args.episode.split(",")]

    total_ok = 0
    total_skip = 0
    for episode_num in targets:
        episode_path = config_dir / f"episode_{episode_num}.json"
        if not episode_path.exists():
            print(f"Episode {episode_num}: missing {episode_path}", file=sys.stderr)
            continue

        jobs = collect_jobs(episode_path, episode_num, voices, default_voice)
        out_dir = output_root / f"episode_{episode_num}"
        print(f"\nEpisode {episode_num}: {len(jobs)} audio lines")

        for filename, voice, text in jobs:
            status = await generate_one(text, voice, rate, out_dir / filename, args.force)
            if status == "ok":
                total_ok += 1
                print(f"  OK   {filename:34s} [{voice}]")
            elif status == "skip":
                total_skip += 1
                print(f"  skip {filename}")
            else:
                print(f"  fail {filename}")

    print(f"\nDone. generated={total_ok}, skipped={total_skip}")


if __name__ == "__main__":
    asyncio.run(main())

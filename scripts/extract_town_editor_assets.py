#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import shutil
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont


SOURCE_DIR = Path("/Users/guzeping/Desktop/建筑和装饰资源")
PROJECT_DIR = Path(__file__).resolve().parents[1]
ASSET_ROOT = PROJECT_DIR / "public" / "assets" / "town-editor"
BUILDINGS_DIR = ASSET_ROOT / "buildings"
DECORATIONS_DIR = ASSET_ROOT / "decorations"
PREVIEWS_DIR = ASSET_ROOT / "previews"
CONFIG_PATH = PROJECT_DIR / "src" / "data" / "config" / "town_editor_assets.json"

SLUGS = {
    1: "home",
    2: "food_street",
    3: "shopping_center",
    4: "transit_hub",
    5: "health_center",
    6: "academy",
    7: "stage",
    8: "company",
    9: "building_09",
    10: "building_10",
    11: "building_11",
}

MIN_DECOR_AREA = 2_000
MIN_DECOR_SIZE = 28
PADDING = 6


def parse_source_name(path: Path) -> tuple[int, str, bool] | None:
    match = re.match(r"^(\d+)(.+?)(装饰)?$", path.stem)
    if not match:
        return None
    building_id = int(match.group(1))
    name = match.group(2)
    return building_id, name, bool(match.group(3))


def edge_palette(rgb: np.ndarray) -> np.ndarray:
    edge = np.concatenate(
        [rgb[0, :, :], rgb[-1, :, :], rgb[:, 0, :], rgb[:, -1, :]],
        axis=0,
    ).astype(np.float32)
    brightness = edge.mean(axis=1)
    median = np.median(brightness)
    dark = edge[brightness < median]
    light = edge[brightness >= median]
    if len(dark) == 0 or len(light) == 0:
        return np.array([edge.mean(axis=0)], dtype=np.float32)
    return np.array([dark.mean(axis=0), light.mean(axis=0)], dtype=np.float32)


def remove_flat_or_checker_background(
    image: Image.Image,
    *,
    tolerance: float,
) -> Image.Image:
    rgba = image.convert("RGBA")
    rgb = np.asarray(rgba.convert("RGB")).astype(np.int16)
    palette = edge_palette(rgb)
    distances = np.sqrt(
        ((rgb[:, :, None, :] - palette[None, None, :, :]) ** 2).sum(axis=3),
    )
    object_mask = distances.min(axis=2) > tolerance

    alpha = np.where(object_mask, 255, 0).astype(np.uint8)
    output = np.asarray(rgba).copy()
    output[:, :, 3] = alpha
    return Image.fromarray(output, "RGBA")


def connected_components(mask: np.ndarray) -> list[dict[str, object]]:
    height, width = mask.shape
    pixels = bytearray(mask.astype(np.uint8).ravel())
    components: list[dict[str, object]] = []

    for start, value in enumerate(pixels):
        if not value:
            continue

        pixels[start] = 0
        stack = [start]
        indices: list[int] = []
        min_x = width
        min_y = height
        max_x = 0
        max_y = 0

        while stack:
            current = stack.pop()
            indices.append(current)
            y, x = divmod(current, width)
            min_x = min(min_x, x)
            min_y = min(min_y, y)
            max_x = max(max_x, x)
            max_y = max(max_y, y)

            y0 = -1 if y > 0 else 0
            y1 = 1 if y < height - 1 else 0
            x0 = -1 if x > 0 else 0
            x1 = 1 if x < width - 1 else 0

            for dy in range(y0, y1 + 1):
                base = current + dy * width
                for dx in range(x0, x1 + 1):
                    if dx == 0 and dy == 0:
                        continue
                    neighbor = base + dx
                    if pixels[neighbor]:
                        pixels[neighbor] = 0
                        stack.append(neighbor)

        bbox_width = max_x - min_x + 1
        bbox_height = max_y - min_y + 1
        area = len(indices)
        if (
            area >= MIN_DECOR_AREA
            and bbox_width >= MIN_DECOR_SIZE
            and bbox_height >= MIN_DECOR_SIZE
        ):
            components.append(
                {
                    "indices": indices,
                    "area": area,
                    "bbox": (min_x, min_y, max_x, max_y),
                },
            )

    components.sort(key=lambda item: (item["bbox"][1], item["bbox"][0]))
    return components


def crop_component(
    rgba: Image.Image,
    component: dict[str, object],
    component_index: int,
    output_path: Path,
) -> dict[str, object]:
    width, height = rgba.size
    min_x, min_y, max_x, max_y = component["bbox"]  # type: ignore[misc]
    crop_left = max(0, min_x - PADDING)
    crop_top = max(0, min_y - PADDING)
    crop_right = min(width, max_x + PADDING + 1)
    crop_bottom = min(height, max_y + PADDING + 1)
    crop = rgba.crop((crop_left, crop_top, crop_right, crop_bottom))

    crop_alpha = np.zeros((crop_bottom - crop_top, crop_right - crop_left), dtype=np.uint8)
    for pixel_index in component["indices"]:  # type: ignore[union-attr]
        y, x = divmod(pixel_index, width)
        if crop_left <= x < crop_right and crop_top <= y < crop_bottom:
            crop_alpha[y - crop_top, x - crop_left] = 255

    crop_array = np.asarray(crop).copy()
    crop_array[:, :, 3] = crop_alpha
    output = Image.fromarray(crop_array, "RGBA")
    output.save(output_path)

    crop_width = crop_right - crop_left
    crop_height = crop_bottom - crop_top
    return {
        "id": output_path.stem,
        "src": f"/assets/town-editor/decorations/{output_path.parent.name}/{output_path.name}",
        "x": round((crop_left / width) * 100, 3),
        "y": round((crop_top / height) * 100, 3),
        "width": round((crop_width / width) * 100, 3),
        "height": round((crop_height / height) * 100, 3),
        "pixelBox": [crop_left, crop_top, crop_width, crop_height],
        "area": component["area"],
        "order": component_index,
    }


def build_preview(
    base: Image.Image,
    decor: Image.Image,
    components: list[dict[str, object]],
    output_path: Path,
) -> None:
    preview = Image.new("RGBA", base.size, (255, 255, 255, 255))
    preview.alpha_composite(base)
    preview.alpha_composite(decor)
    draw = ImageDraw.Draw(preview)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 34)
    except OSError:
        font = ImageFont.load_default()

    colors = [
        (239, 68, 68, 255),
        (37, 99, 235, 255),
        (22, 163, 74, 255),
        (217, 119, 6, 255),
        (147, 51, 234, 255),
        (14, 165, 233, 255),
    ]
    for index, component in enumerate(components, start=1):
        min_x, min_y, max_x, max_y = component["bbox"]  # type: ignore[misc]
        color = colors[(index - 1) % len(colors)]
        draw.rectangle((min_x, min_y, max_x, max_y), outline=color, width=5)
        text = str(index)
        draw.rounded_rectangle(
            (min_x, max(0, min_y - 46), min_x + 58, max(46, min_y)),
            radius=10,
            fill=(0, 0, 0, 180),
        )
        draw.text((min_x + 16, max(0, min_y - 42)), text, fill=(255, 255, 255, 255), font=font)

    preview.thumbnail((1100, 1100), Image.Resampling.LANCZOS)
    preview.convert("RGB").save(output_path, quality=92)


def main() -> None:
    if not SOURCE_DIR.exists():
        raise SystemExit(f"source folder not found: {SOURCE_DIR}")

    for directory in (BUILDINGS_DIR, DECORATIONS_DIR, PREVIEWS_DIR):
        if directory.exists():
            shutil.rmtree(directory)
        directory.mkdir(parents=True, exist_ok=True)

    source_pairs: dict[int, dict[str, Path | str]] = {}
    for path in SOURCE_DIR.glob("*.png"):
        parsed = parse_source_name(path)
        if not parsed:
            continue
        building_id, name, is_decor = parsed
        source_pairs.setdefault(building_id, {"name": name})
        if is_decor:
            source_pairs[building_id]["decor"] = path
        else:
            source_pairs[building_id]["building"] = path
            source_pairs[building_id]["name"] = name

    manifest = {
        "source": str(SOURCE_DIR),
        "canvas": {"width": 2048, "height": 2048},
        "buildings": [],
    }

    for building_id in sorted(source_pairs):
        pair = source_pairs[building_id]
        if "building" not in pair or "decor" not in pair:
            continue

        name = str(pair["name"])
        slug = SLUGS.get(building_id, f"building_{building_id:02d}")
        building_src = Path(pair["building"])
        decor_src = Path(pair["decor"])

        processed_building = remove_flat_or_checker_background(
            Image.open(building_src),
            tolerance=22,
        )
        building_filename = f"{building_id:02d}_{slug}.png"
        processed_building.save(BUILDINGS_DIR / building_filename)

        processed_decor = remove_flat_or_checker_background(
            Image.open(decor_src),
            tolerance=12,
        )
        alpha = np.asarray(processed_decor.getchannel("A")) > 0
        components = connected_components(alpha)

        building_decor_dir = DECORATIONS_DIR / f"{building_id:02d}_{slug}"
        building_decor_dir.mkdir(parents=True, exist_ok=True)

        decorations = []
        for component_index, component in enumerate(components, start=1):
            output_path = building_decor_dir / (
                f"{building_id:02d}_{slug}_decor_{component_index:02d}.png"
            )
            decorations.append(
                crop_component(processed_decor, component, component_index, output_path),
            )

        build_preview(
            processed_building,
            processed_decor,
            components,
            PREVIEWS_DIR / f"{building_id:02d}_{slug}_preview.jpg",
        )

        manifest["buildings"].append(
            {
                "id": building_id,
                "name": name,
                "slug": slug,
                "src": f"/assets/town-editor/buildings/{building_filename}",
                "decorations": decorations,
            },
        )
        print(f"{building_id:02d} {name}: {len(decorations)} decorations")

    CONFIG_PATH.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"wrote {CONFIG_PATH}")


if __name__ == "__main__":
    main()

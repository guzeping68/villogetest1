from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


SOURCE = Path("/Users/guzeping/Downloads/小镇全部建筑及装饰.png")
OUT_DIR = Path("public/assets/town-buildings")
RAW_DIR = OUT_DIR / "raw"
PREVIEW_DIR = OUT_DIR / "previews"


BUILDINGS = [
    {
        "id": "post_office",
        "name": "Post Office",
        "box": (20, 165, 570, 525),
    },
    {
        "id": "clock_plaza",
        "name": "Clock Plaza",
        "box": (735, 10, 1385, 620),
    },
    {
        "id": "barber_style",
        "name": "Barber & Style",
        "box": (1525, 170, 2048, 525),
    },
    {
        "id": "fog_brew",
        "name": "Fog & Brew",
        "box": (405, 465, 965, 905),
    },
    {
        "id": "mirror_mart",
        "name": "Mirror Mart",
        "box": (1210, 495, 1815, 920),
    },
    {
        "id": "post_parcel",
        "name": "Post & Parcel",
        "box": (35, 960, 520, 1345),
    },
    {
        "id": "home",
        "name": "Home",
        "box": (660, 855, 1425, 1375),
    },
    {
        "id": "general_store",
        "name": "General Store",
        "box": (1580, 840, 2040, 1195),
    },
    {
        "id": "bloom_flowers_tall",
        "name": "Bloom & Co. Tall",
        "box": (215, 1260, 650, 1745),
    },
    {
        "id": "book_nook",
        "name": "Book Nook",
        "box": (1470, 1225, 2040, 1645),
    },
    {
        "id": "bloom_flowers",
        "name": "Bloom & Co. Flowers",
        "box": (455, 1610, 1115, 2048),
    },
]


def get_font(size: int) -> ImageFont.ImageFont:
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
    ]
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            pass
    return ImageFont.load_default()


def main() -> None:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)

    image = Image.open(SOURCE).convert("RGBA")
    preview = image.copy()
    draw = ImageDraw.Draw(preview)
    font = get_font(26)
    small_font = get_font(18)

    for index, building in enumerate(BUILDINGS, start=1):
        box = building["box"]
        crop = remove_edge_fragments(image.crop(box))
        crop.save(RAW_DIR / f"{index:02d}_{building['id']}.png")

        x1, y1, x2, y2 = box
        label = f"{index}. {building['name']}"
        draw.rectangle(box, outline=(255, 58, 58, 255), width=5)
        text_box = draw.textbbox((0, 0), label, font=font)
        text_w = text_box[2] - text_box[0]
        text_h = text_box[3] - text_box[1]
        label_x = x1
        label_y = max(0, y1 - text_h - 14)
        draw.rounded_rectangle(
            (label_x, label_y, label_x + text_w + 18, label_y + text_h + 12),
            radius=8,
            fill=(255, 58, 58, 230),
        )
        draw.text(
            (label_x + 9, label_y + 5),
            label,
            fill=(255, 255, 255, 255),
            font=font,
        )
        draw.text(
            (x1 + 8, y2 - 26),
            f"{x2 - x1}x{y2 - y1}",
            fill=(45, 45, 45, 255),
            font=small_font,
            stroke_width=3,
            stroke_fill=(255, 255, 255, 220),
        )

    preview.save(PREVIEW_DIR / "00_building_crop_preview.png")
    make_contact_sheet()
    print(f"Generated {len(BUILDINGS)} building crops")
    print(PREVIEW_DIR / "00_building_crop_preview.png")


def remove_edge_fragments(image: Image.Image) -> Image.Image:
    """Remove unrelated transparent-PNG fragments caught by wide crop boxes."""
    image = image.copy().convert("RGBA")
    width, height = image.size
    alpha = image.getchannel("A")
    pixels = alpha.load()
    visited = bytearray(width * height)
    components = []

    def offset(px: int, py: int) -> int:
        return py * width + px

    for y in range(height):
        for x in range(width):
            idx = offset(x, y)
            if visited[idx] or pixels[x, y] == 0:
                continue

            stack = [(x, y)]
            visited[idx] = 1
            area = 0
            min_x = max_x = x
            min_y = max_y = y
            points = []

            while stack:
                cx, cy = stack.pop()
                area += 1
                min_x = min(min_x, cx)
                max_x = max(max_x, cx)
                min_y = min(min_y, cy)
                max_y = max(max_y, cy)
                points.append((cx, cy))

                for nx, ny in (
                    (cx + 1, cy),
                    (cx - 1, cy),
                    (cx, cy + 1),
                    (cx, cy - 1),
                ):
                    if nx < 0 or nx >= width or ny < 0 or ny >= height:
                        continue
                    n_idx = offset(nx, ny)
                    if visited[n_idx] or pixels[nx, ny] == 0:
                        continue
                    visited[n_idx] = 1
                    stack.append((nx, ny))

            components.append(
                {
                    "area": area,
                    "box": (min_x, min_y, max_x, max_y),
                    "points": points,
                    "touches_edge": min_x <= 1
                    or min_y <= 1
                    or max_x >= width - 2
                    or max_y >= height - 2,
                }
            )

    if not components:
        return image

    max_area = max(component["area"] for component in components)
    keep = set()
    for component_index, component in enumerate(components):
        if component["area"] >= max_area * 0.18:
            keep.add(component_index)
        elif component["area"] >= 450 and not component["touches_edge"]:
            keep.add(component_index)

    output_alpha = alpha.copy()
    output_pixels = output_alpha.load()
    for component_index, component in enumerate(components):
        if component_index in keep:
            continue
        for x, y in component["points"]:
            output_pixels[x, y] = 0

    image.putalpha(output_alpha)
    return image


def make_contact_sheet() -> None:
    font = get_font(22)
    label_font = get_font(18)
    thumbs = []
    thumb_w, thumb_h = 360, 280
    for index, building in enumerate(BUILDINGS, start=1):
        crop = Image.open(RAW_DIR / f"{index:02d}_{building['id']}.png").convert("RGBA")
        crop.thumbnail((thumb_w, thumb_h - 42), Image.LANCZOS)
        tile = Image.new("RGBA", (thumb_w, thumb_h), (250, 250, 250, 255))
        draw = ImageDraw.Draw(tile)
        x = (thumb_w - crop.width) // 2
        y = 10
        tile.alpha_composite(crop, (x, y))
        label = f"{index:02d} {building['id']}"
        draw.text((14, thumb_h - 34), label, fill=(30, 30, 30, 255), font=font)
        draw.text(
            (14, thumb_h - 12),
            building["name"],
            fill=(90, 90, 90, 255),
            font=label_font,
        )
        thumbs.append(tile)

    columns = 3
    rows = (len(thumbs) + columns - 1) // columns
    sheet = Image.new(
        "RGBA",
        (columns * thumb_w, rows * thumb_h),
        (238, 241, 245, 255),
    )
    for index, tile in enumerate(thumbs):
        col = index % columns
        row = index // columns
        sheet.alpha_composite(tile, (col * thumb_w, row * thumb_h))
    sheet.save(PREVIEW_DIR / "01_building_contact_sheet.png")


if __name__ == "__main__":
    main()

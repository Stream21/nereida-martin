"""Build square home-screen icons from the studio wordmark."""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
LOGO = PUBLIC / "logo2.png"

# Site background so the shortcut matches the linen page.
BG = (250, 250, 249, 255)
# Horizontal margin. The wordmark is wide and sits in the vertical center,
# which stays inside both iOS squircles and Android circular masks.
PAD_RATIO = 0.07


def load_logo():
    logo = Image.open(LOGO).convert("RGBA")
    bbox = logo.getbbox()
    if bbox:
        logo = logo.crop(bbox)
    return logo


def make_icon(logo: Image.Image, size: int) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), BG)
    pad = round(size * PAD_RATIO)
    max_w = size - pad * 2
    max_h = size - pad * 2
    scale = min(max_w / logo.width, max_h / logo.height)
    resized = logo.resize(
        (max(1, round(logo.width * scale)), max(1, round(logo.height * scale))),
        Image.Resampling.LANCZOS,
    )
    x = (size - resized.width) // 2
    y = (size - resized.height) // 2
    canvas.alpha_composite(resized, (x, y))
    return canvas.convert("RGB")


def main():
    logo = load_logo()
    outputs = {
        180: PUBLIC / "apple-touch-icon.png",
        192: PUBLIC / "icon-192.png",
        512: PUBLIC / "icon-512.png",
        32: PUBLIC / "favicon-32.png",
    }
    for size, path in outputs.items():
        # Supersample large sizes from the source; 32px is already small.
        icon = make_icon(logo, size)
        icon.save(path, "PNG", optimize=True)
        print(f"wrote {path.name} {icon.size}")


if __name__ == "__main__":
    main()

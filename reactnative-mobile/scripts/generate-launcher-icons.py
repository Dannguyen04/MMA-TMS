"""Generate Android launcher mipmaps from assets/icon.png (fist + reticle)."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
RES = ROOT / "android" / "app" / "src" / "main" / "res"
ICON = ROOT / "assets" / "icon.png"
MONO = ROOT / "assets" / "android-icon-monochrome.png"
BG_ASSET = ROOT / "assets" / "android-icon-background.png"
FG_ASSET = ROOT / "assets" / "android-icon-foreground.png"

BG = (0, 0, 0, 255)  # #000000

DENSITIES = {
    "mdpi": (48, 108),
    "hdpi": (72, 162),
    "xhdpi": (96, 216),
    "xxhdpi": (144, 324),
    "xxxhdpi": (192, 432),
}

# Adaptive icons crop 108dp down to a 72dp circle. Fill that safe zone so the
# glove is fully visible and smaller than a 108dp bleed (which looks zoomed-in).
SAFE_ZONE = 72 / 108


def resize(img: Image.Image, size: int) -> Image.Image:
    return img.resize((size, size), Image.Resampling.LANCZOS)


def letterbox(img: Image.Image, canvas: int, content_ratio: float = SAFE_ZONE) -> Image.Image:
    inner = max(1, int(round(canvas * content_ratio)))
    fitted = resize(img.convert("RGBA"), inner)
    out = Image.new("RGBA", (canvas, canvas), BG)
    offset = (canvas - inner) // 2
    out.paste(fitted, (offset, offset), fitted)
    return out


def circle(img: Image.Image, size: int) -> Image.Image:
    square = img.convert("RGBA")
    if square.size != (size, size):
        square = resize(square, size)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(square, mask=mask)
    return out


def to_mono(img: Image.Image, size: int) -> Image.Image:
    gray = resize(img.convert("RGBA"), size).convert("L")
    alpha = gray.point(lambda p: 0 if p < 18 else min(255, int((p - 18) * 1.15)))
    painted = Image.new("RGBA", (size, size), (255, 255, 255, 255))
    painted.putalpha(alpha)
    return painted


def solid(size: int) -> Image.Image:
    return Image.new("RGBA", (size, size), BG)


def save(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "PNG")
    print(f"wrote {path.relative_to(ROOT)} {path.stat().st_size}")


def main() -> None:
    icon = Image.open(ICON).convert("RGBA")
    if icon.size != (1024, 1024):
        icon = resize(icon, 1024)
    save(icon, ICON)
    save(solid(1024), BG_ASSET)
    save(letterbox(icon, 1024), FG_ASSET)
    save(to_mono(letterbox(icon, 1024), 1024), MONO)

    for density, (launcher, adaptive) in DENSITIES.items():
        folder = RES / f"mipmap-{density}"
        for stale in folder.glob("ic_launcher*.webp"):
            stale.unlink()
            print(f"removed {stale.relative_to(ROOT)}")

        launcher_art = letterbox(icon, launcher, 0.86)
        save(launcher_art, folder / "ic_launcher.png")
        save(circle(launcher_art, launcher), folder / "ic_launcher_round.png")
        save(letterbox(icon, adaptive), folder / "ic_launcher_foreground.png")
        save(solid(adaptive), folder / "ic_launcher_background.png")
        save(to_mono(letterbox(icon, adaptive), adaptive), folder / "ic_launcher_monochrome.png")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Rebuild KayKit palette atlases into EMBERCROWN's ash/brass/ember palette.

The source atlases are CC0. This script preserves the original UV layout while
replacing colour families, allowing the same rigged GLB models to carry the
project's own material language.
"""
from __future__ import annotations

import argparse
import colorsys
from pathlib import Path
from PIL import Image, ImageDraw


def clamp(v: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, v))


def scale_colour(rgb: tuple[int, int, int], value: float, contrast: float = 1.0) -> tuple[int, int, int]:
    value = clamp((value - 0.5) * contrast + 0.5)
    factor = 0.42 + value * 0.92
    return tuple(int(clamp((c / 255.0) * factor) * 255) for c in rgb)


def recolour(source: Path, target: Path, role: str) -> None:
    image = Image.open(source).convert("RGBA")
    out = Image.new("RGBA", image.size)
    src = image.load()
    dst = out.load()

    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = src[x, y]
            if a == 0:
                dst[x, y] = (0, 0, 0, 0)
                continue

            rf, gf, bf = r / 255.0, g / 255.0, b / 255.0
            h, sat, val = colorsys.rgb_to_hsv(rf, gf, bf)
            hue = h * 360.0
            lum = clamp(0.2126 * rf + 0.7152 * gf + 0.0722 * bf)

            if role == "knight":
                # Cloth and leather keep an ember undertone; metals become cold
                # iron, while bright trim becomes aged brass.
                if sat < 0.12:
                    base = (166, 157, 139) if lum > 0.67 else (63, 70, 69)
                elif hue < 48 or hue >= 335:
                    base = (123, 50, 31) if lum < 0.72 else (196, 102, 45)
                elif hue < 92:
                    base = (151, 112, 48) if lum > 0.48 else (81, 59, 28)
                elif hue < 175:
                    base = (66, 79, 59)
                elif hue < 275:
                    base = (55, 67, 72) if lum < 0.68 else (127, 139, 138)
                else:
                    base = (53, 31, 35)
                nr, ng, nb = scale_colour(base, lum, 1.06)
            else:
                # Bone remains legible; coloured regions become grave-cyan or
                # oath-breaking violet, with no toy-like saturated colours.
                if sat < 0.16:
                    base = (191, 183, 158) if lum > 0.52 else (74, 77, 70)
                elif 165 <= hue < 255:
                    base = (49, 91, 99)
                elif hue >= 255 or hue < 25:
                    base = (75, 39, 91)
                elif 25 <= hue < 85:
                    base = (116, 91, 45)
                else:
                    base = (53, 65, 58)
                nr, ng, nb = scale_colour(base, lum, 1.12)

            dst[x, y] = (nr, ng, nb, a)

    target.parent.mkdir(parents=True, exist_ok=True)
    out.save(target, optimize=True)


def make_crown_texture(target: Path) -> None:
    size = 128
    image = Image.new("RGB", (size, size), (34, 18, 16))
    draw = ImageDraw.Draw(image)
    # Worn horizontal bands.
    for y in range(0, size, 16):
        shade = 32 + (y // 16 % 2) * 8
        draw.rectangle((0, y, size, y + 7), fill=(shade + 12, shade, shade - 3))
    # Broken-oath runes. The texture is intentionally abstract: it reads as
    # incised metal at gameplay distance rather than literal UI text.
    amber = (233, 142, 50)
    dim = (112, 58, 32)
    for ox, oy in ((8, 10), (70, 5), (38, 66), (90, 76)):
        draw.line((ox, oy + 34, ox + 14, oy, ox + 28, oy + 34), fill=amber, width=4)
        draw.line((ox + 7, oy + 19, ox + 21, oy + 19), fill=dim, width=3)
        draw.ellipse((ox + 11, oy + 13, ox + 17, oy + 19), fill=(255, 196, 82))
    target.parent.mkdir(parents=True, exist_ok=True)
    image.save(target, optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--knight", type=Path, required=True)
    parser.add_argument("--skeleton", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()

    args.out.mkdir(parents=True, exist_ok=True)
    recolour(args.knight, args.out / "knight_embercrown.png", "knight")
    recolour(args.skeleton, args.out / "skeleton_ash_oath.png", "skeleton")
    make_crown_texture(args.out / "crown_runes.png")


if __name__ == "__main__":
    main()

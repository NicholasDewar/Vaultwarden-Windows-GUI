"""
生成 Tauri / Windows 可用的应用图标（PNG + 多层 ICO）。
依赖: pip install pillow
"""
from __future__ import annotations

import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw
except ImportError:
    print("请先安装: pip install pillow", file=sys.stderr)
    sys.exit(1)


def render_icon(size: int) -> Image.Image:
    """绘制简单「保险箱」风格圆角方块 + 挂锁，适配任意方形尺寸。"""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    s = float(size)
    margin = s * 0.08
    r = s * 0.18
    x0, y0, x1, y1 = margin, margin, s - margin, s - margin
    draw.rounded_rectangle(
        (x0, y0, x1, y1),
        radius=r,
        fill=(40, 44, 58, 255),
        outline=(90, 98, 120, 255),
        width=max(1, int(s / 64)),
    )
    cx, cy = s / 2, s * 0.52
    lock_w, lock_h = s * 0.34, s * 0.26
    shackle_r = s * 0.09
    body_top = cy - lock_h * 0.15
    # 锁梁（弧形）
    draw.arc(
        (
            cx - shackle_r * 2.2,
            body_top - shackle_r * 2.4,
            cx + shackle_r * 2.2,
            body_top + shackle_r * 0.2,
        ),
        start=200,
        end=340,
        fill=(230, 186, 80, 255),
        width=max(2, int(s / 32)),
    )
    # 锁体
    bw, bh = lock_w * 0.55, lock_h * 0.85
    bx0, by0 = cx - bw / 2, body_top
    bx1, by1 = cx + bw / 2, by0 + bh
    draw.rounded_rectangle(
        (bx0, by0, bx1, by1),
        radius=max(2, int(s / 64)),
        fill=(230, 186, 80, 255),
    )
    keyhole_r = max(1.0, s * 0.028)
    draw.ellipse(
        (
            cx - keyhole_r * 1.8,
            by0 + bh * 0.22,
            cx + keyhole_r * 1.8,
            by0 + bh * 0.22 + keyhole_r * 3.6,
        ),
        fill=(40, 44, 58, 255),
    )
    return img


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    out_dir = root / "src-tauri" / "icons"
    out_dir.mkdir(parents=True, exist_ok=True)

    master = render_icon(1024)
    master.save(out_dir / "app-icon.png", "PNG")

    # 托盘 / 安装包用较高分辨率 PNG
    icon_png = master.resize((512, 512), Image.Resampling.LANCZOS)
    icon_png.save(out_dir / "icon.png", "PNG")

    # Tauri 文档: ICO 需 16,24,32,48,64,256；32px 放首位利于开发期显示
    ico_sizes = [(32, 32), (16, 16), (24, 24), (48, 48), (64, 64), (256, 256)]
    ico_path = out_dir / "icon.ico"
    master.save(
        str(ico_path),
        format="ICO",
        sizes=ico_sizes,
    )
    print(f"已写入: {out_dir / 'icon.ico'}")
    print(f"已写入: {out_dir / 'icon.png'}")
    print(f"已写入: {out_dir / 'app-icon.png'}")


if __name__ == "__main__":
    main()

"""Copy Figma logo assets into public/logos for Next.js static serving."""

from __future__ import annotations

import os
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SRC = Path(r"C:\Users\USER\figma_logos")
SRC = Path(os.environ.get("FIGMA_LOGOS_DIR", DEFAULT_SRC))
DST = ROOT / "public" / "logos"


def copy_tree(src: Path, dst: Path) -> int:
    if not src.exists():
        raise FileNotFoundError(f"Logo source not found: {src}")
    if dst.exists():
        shutil.rmtree(dst)
    shutil.copytree(src, dst)
    return sum(1 for p in dst.rglob("*") if p.is_file())


def main() -> None:
    count = copy_tree(SRC, DST)
    print(f"Synced {count} logo files from {SRC} -> {DST}")


if __name__ == "__main__":
    main()

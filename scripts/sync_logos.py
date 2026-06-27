"""Copy Figma logo assets into public/logos (incremental merge)."""

from __future__ import annotations

import os
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SRC = Path(r"C:\Users\USER\figma_logos")
SRC = Path(os.environ.get("FIGMA_LOGOS_DIR", DEFAULT_SRC))
DST = ROOT / "public" / "logos"
SUBDIRS = ("financial", "stock")


def copy_subtree(src_root: Path, dst_root: Path) -> int:
    if not src_root.exists():
        print(f"Skip missing source: {src_root}")
        return 0
    count = 0
    for src in src_root.rglob("*.svg"):
        rel = src.relative_to(src_root)
        target = dst_root / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, target)
        count += 1
    return count


def main() -> None:
    if not SRC.exists():
        raise FileNotFoundError(f"Logo source not found: {SRC}")

    DST.mkdir(parents=True, exist_ok=True)
    total = 0
    for name in SUBDIRS:
        copied = copy_subtree(SRC / name, DST / name)
        print(f"  {name}: {copied} svg")
        total += copied
    print(f"Synced {total} logo files from {SRC} -> {DST}")


if __name__ == "__main__":
    main()

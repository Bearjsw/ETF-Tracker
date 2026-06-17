"""Apply SQL migrations to Vercel Postgres."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from db_client import execute_script, get_connection

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS_DIR = ROOT / "db" / "migrations"


def main() -> None:
    parser = argparse.ArgumentParser(description="Run database migrations")
    parser.add_argument("--file", type=Path, help="Single migration file")
    args = parser.parse_args()

    files = [args.file] if args.file else sorted(MIGRATIONS_DIR.glob("*.sql"))
    if not files:
        raise FileNotFoundError(f"No migrations found in {MIGRATIONS_DIR}")

    with get_connection() as conn:
        for path in files:
            sql = path.read_text(encoding="utf-8")
            print(f"Applying {path.name}...")
            execute_script(conn, sql)

    print("Migrations complete.")


if __name__ == "__main__":
    main()

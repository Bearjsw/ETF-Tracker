"""Shared PostgreSQL helpers for Python scripts (Vercel Postgres / Neon)."""

from __future__ import annotations

import os
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Generator, Iterable, Sequence

from dotenv import load_dotenv
from psycopg import Connection, connect
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env.local")
load_dotenv(ROOT / ".env")


def get_database_url() -> str:
    url = (
        os.environ.get("POSTGRES_URL")
        or os.environ.get("POSTGRES_URL_NON_POOLING")
        or os.environ.get("DATABASE_URL")
    )
    if not url:
        raise RuntimeError("POSTGRES_URL (or DATABASE_URL) is required")
    return url


@contextmanager
def get_connection() -> Generator[Connection, None, None]:
    with connect(get_database_url(), row_factory=dict_row) as conn:
        yield conn


def fetch_all(conn: Connection, query: str, params: Sequence[Any] | None = None) -> list[dict[str, Any]]:
    with conn.cursor() as cur:
        cur.execute(query, params or ())
        rows = cur.fetchall()
    return [dict(row) for row in rows]


def execute_script(conn: Connection, script: str) -> None:
    statements = [part.strip() for part in script.split(";") if part.strip()]
    with conn.cursor() as cur:
        for statement in statements:
            cur.execute(statement)
    conn.commit()


def upsert_rows(
    conn: Connection,
    table: str,
    rows: list[dict[str, Any]],
    conflict_columns: list[str],
    update_columns: list[str] | None = None,
) -> int:
    if not rows:
        return 0

    columns = list(rows[0].keys())
    if update_columns is None:
        update_columns = [c for c in columns if c not in conflict_columns]

    placeholders_row = ", ".join(f"%({c})s" for c in columns)
    columns_sql = ", ".join(columns)
    conflict_sql = ", ".join(conflict_columns)
    update_sql = ", ".join(f"{c} = EXCLUDED.{c}" for c in update_columns)

    query = f"""
        INSERT INTO {table} ({columns_sql})
        VALUES ({placeholders_row})
        ON CONFLICT ({conflict_sql}) DO UPDATE SET {update_sql}
    """

    prepared = []
    for row in rows:
        item = dict(row)
        for key, value in item.items():
            if isinstance(value, (dict, list)) and key == "metadata":
                item[key] = Jsonb(value)
            elif isinstance(value, list) and key in ("theme_tags", "etf_tickers"):
                item[key] = value
        prepared.append(item)

    with conn.cursor() as cur:
        cur.executemany(query, prepared)
    conn.commit()
    return len(prepared)


def insert_rows(conn: Connection, table: str, rows: list[dict[str, Any]]) -> int:
    if not rows:
        return 0

    columns = list(rows[0].keys())
    placeholders_row = ", ".join(f"%({c})s" for c in columns)
    columns_sql = ", ".join(columns)
    query = f"INSERT INTO {table} ({columns_sql}) VALUES ({placeholders_row})"

    prepared = []
    for row in rows:
        item = dict(row)
        for key, value in item.items():
            if isinstance(value, (dict, list)) and key == "metadata":
                item[key] = Jsonb(value)
            elif isinstance(value, list) and key == "etf_tickers":
                item[key] = value
        prepared.append(item)

    with conn.cursor() as cur:
        cur.executemany(query, prepared)
    conn.commit()
    return len(prepared)

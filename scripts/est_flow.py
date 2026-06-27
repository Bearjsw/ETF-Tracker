"""Shared look-through flow estimate helpers (mirror lib/est-flow.ts)."""

from __future__ import annotations

FLOW_AUM_CAP_MULTIPLIER = 1.25
DEFAULT_MEDIAN_AUM_KRW = 50_000_000_000.0


def flow_cap_krw(aum: float | None, weight_delta: float | None) -> float | None:
    if aum is None or aum <= 0 or weight_delta is None or weight_delta == 0:
        return None
    return abs(aum) * (min(abs(float(weight_delta)), 100.0) / 100.0) * FLOW_AUM_CAP_MULTIPLIER


def expected_flow_krw(aum: float, weight_delta: float) -> float:
    return float(aum) * (float(weight_delta) / 100.0)


def resolve_est_flow_krw(
    weight_delta: float | None,
    aum: float | None,
    stored: float | None = None,
    *,
    median_aum: float | None = None,
) -> float | None:
    """Return KRW flow estimate; prefers ETF AUM, validates stored values."""
    if weight_delta is None or weight_delta == 0:
        return float(stored) if stored not in (None, 0) else None

    base_aum = aum if aum is not None and aum > 0 else None
    if base_aum is None:
        if stored not in (None, 0):
            return float(stored)
        if median_aum is not None and median_aum > 0:
            base_aum = median_aum
        else:
            return None

    expected = expected_flow_krw(base_aum, weight_delta)
    if stored in (None, 0):
        return expected

    cap = flow_cap_krw(base_aum, weight_delta)
    if cap is not None and abs(float(stored)) <= cap:
        return float(stored)
    return expected


def is_implausible_stored_flow(
    stored: float | None,
    weight_delta: float | None,
    aum: float | None,
) -> bool:
    if stored in (None, 0) or weight_delta in (None, 0):
        return False
    if aum is None or aum <= 0:
        return True
    cap = flow_cap_krw(aum, weight_delta)
    return cap is not None and abs(float(stored)) > cap

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  expectedFlowKrw,
  flowCapKrw,
  resolveEstFlowKrw,
  summarizeFlowTotals,
} from "./est-flow.ts";
import { formatKrw } from "./utils.ts";

describe("resolveEstFlowKrw", () => {
  const aumMap = new Map([["A0189Z0", 10_000_000_000]]);

  it("recomputes when stored flow exceeds AUM cap", () => {
    const stored = 500_000_000_000;
    const resolved = resolveEstFlowKrw(
      { etf_ticker: "A0189Z0", weight_delta: 2, est_flow_krw: stored },
      aumMap,
      50_000_000_000,
    );
    assert.equal(resolved, expectedFlowKrw(10_000_000_000, 2));
  });

  it("keeps plausible stored values", () => {
    const stored = 200_000_000;
    const resolved = resolveEstFlowKrw(
      { etf_ticker: "A0189Z0", weight_delta: 2, est_flow_krw: stored },
      aumMap,
    );
    assert.equal(resolved, stored);
  });

  it("documents string est_flow_krw concat vs numeric sum", () => {
    const rows = [
      { est_flow_krw: "100000000" as unknown as number },
      { est_flow_krw: "200000000" as unknown as number },
    ];
    const buggy = rows.reduce((s, d) => s + (d.est_flow_krw ?? 0), 0);
    assert.equal(typeof buggy, "string");

    const safe = rows.reduce((s, d) => s + Number(d.est_flow_krw ?? 0), 0);
    assert.equal(safe, 300_000_000);
  });
});

describe("summarizeFlowTotals", () => {
  it("caps totals to AUM multiplier", () => {
    const aum = 10_000_000_000;
    const cap = flowCapKrw(aum, 100)!;
    const { inflow, outflow } = summarizeFlowTotals(
      [{ est_flow_krw: cap * 2 }, { est_flow_krw: -(cap * 2) }],
      aum,
    );
    assert.equal(inflow, cap);
    assert.equal(outflow, cap);
  });
});

describe("formatKrw", () => {
  it("returns dash for non-finite values", () => {
    assert.equal(formatKrw(Number.NaN), "-");
    assert.equal(formatKrw(Number.POSITIVE_INFINITY), "-");
    assert.equal(formatKrw("1e99" as unknown as number), "-");
  });

  it("formats 억 units", () => {
    assert.equal(formatKrw(150_000_000), "1.5억");
  });
});

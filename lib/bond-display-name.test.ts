import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveBondDisplayName } from "./bond-display-name.ts";
import { formatStockDisplayName } from "./stock-display.ts";

describe("resolveBondDisplayName", () => {
  it("shortens monetary stabilization bonds", () => {
    const result = resolveBondDisplayName("통화안정증권02280-2607-01", "010102");
    assert.ok(result);
    assert.equal(result!.display, "통안채 26.07");
    assert.equal(result!.simplified, true);
  });

  it("preserves bank fund department instruments with serial", () => {
    const result = resolveBondDisplayName("신한 자금부 20260219-365-1", "008801");
    assert.ok(result);
    assert.equal(result!.display, "신한 자금부 20260219-365-1");
    assert.equal(result!.simplified, false);
  });

  it("preserves treasury bond serial names", () => {
    const result = resolveBondDisplayName("국고채권05500-2912(09-5)", "001660");
    assert.ok(result);
    assert.equal(result!.display, "국고채권05500-2912(09-5)");
    assert.equal(result!.simplified, false);
  });
});

describe("formatStockDisplayName", () => {
  it("uses bond display for treasury instruments", () => {
    assert.equal(
      formatStockDisplayName("통화안정증권02280-2607-01", "010102"),
      "통안채 26.07",
    );
    assert.equal(
      formatStockDisplayName("신한 자금부 20260219-365-1", "008801"),
      "신한 자금부 20260219-365-1",
    );
    assert.equal(
      formatStockDisplayName("국고채권05500-2912(09-5)", "001660"),
      "국고채권05500-2912(09-5)",
    );
  });
});

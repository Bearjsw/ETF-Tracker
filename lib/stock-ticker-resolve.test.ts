import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveStockTickerSymbol } from "./stock-ticker-resolve.ts";

describe("resolveStockTickerSymbol", () => {
  it("maps BTQ Technologies to BTQ, not Logitech (LOGI)", () => {
    assert.equal(resolveStockTickerSymbol("BTQ Technologies Corp", "558691"), "BTQ");
  });

  it("maps Tyler Technologies by name fragment, not LOGI substring", () => {
    assert.equal(resolveStockTickerSymbol("Tyler Technologies Inc", "999999"), "TYL");
  });
});

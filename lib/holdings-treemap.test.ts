import assert from "node:assert/strict";
import { test } from "node:test";
import {
  TREEMAP_BUCKET_COLORS,
  TREEMAP_LOGO_GREEN,
  TREEMAP_LOGO_GREEN_SOFT,
  returnBucket,
  treemapCellLayout,
  treemapLabelColor,
} from "./holdings-treemap";

test("treemapLabelColor uses dark text on bright cells", () => {
  assert.equal(treemapLabelColor(TREEMAP_BUCKET_COLORS[0]), "#3a4238");
  assert.equal(treemapLabelColor(TREEMAP_BUCKET_COLORS[1]), "#3a4238");
  assert.equal(treemapLabelColor(TREEMAP_BUCKET_COLORS[2]), "#3a4238");
  assert.equal(treemapLabelColor(TREEMAP_BUCKET_COLORS[-1]), "#3a4238");
  assert.equal(treemapLabelColor("#e8ebe6"), "#3a4238");
});

test("treemapLabelColor uses white text on dark cells", () => {
  assert.equal(treemapLabelColor(TREEMAP_BUCKET_COLORS[5]), "#ffffff");
  assert.equal(treemapLabelColor(TREEMAP_BUCKET_COLORS[4]), "#ffffff");
});

test("treemap -4 step uses softened ETF Tracker logo green", () => {
  assert.equal(TREEMAP_BUCKET_COLORS[-4], TREEMAP_LOGO_GREEN_SOFT);
  assert.equal(TREEMAP_LOGO_GREEN_SOFT, "#c8e2b0");
});

test("returnBucket adds fine steps between flat and -1%", () => {
  assert.equal(returnBucket(-0.2), -0.25);
  assert.equal(returnBucket(-0.45), -0.5);
  assert.equal(returnBucket(-0.7), -0.75);
  assert.equal(returnBucket(-0.9), -1);
  assert.equal(returnBucket(-1.5), -2);
});

test("treemapCellLayout shrinks gap for thin edge cells", () => {
  const tiny = treemapCellLayout(100, 0, 6, 40);
  assert.equal(tiny.inset, 0);
  assert.equal(tiny.innerW, 6);

  const small = treemapCellLayout(100, 0, 14, 40);
  assert.equal(small.inset, 1);
  assert.equal(small.innerW, 12);

  const normal = treemapCellLayout(0, 0, 80, 40);
  assert.equal(normal.inset, 2);
  assert.equal(normal.innerW, 76);
});

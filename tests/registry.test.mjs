import assert from "node:assert/strict";
import test from "node:test";

import {
  createAlgorithm,
  getSelectableAlgorithms,
} from "../js/algorithms/registry.js";

test("DFS stays available internally but is hidden from the UI selector", async () => {
  const selectableIds = getSelectableAlgorithms().map((algorithm) => algorithm.id);
  const dfs = await createAlgorithm("dfs");

  assert.equal(selectableIds.includes("dfs"), false);
  assert.equal(dfs.name, "DFS");
});

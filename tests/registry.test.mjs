import assert from "node:assert/strict";
import test from "node:test";

import {
  createAlgorithm,
  getSelectableAlgorithms,
} from "../js/algorithms/registry.js";
import { sampleMapRegistry } from "../js/sampleMaps.js";

test("DFS stays available internally but is hidden from the UI selector", async () => {
  const selectableIds = getSelectableAlgorithms().map((algorithm) => algorithm.id);
  const dfs = await createAlgorithm("dfs");

  assert.equal(selectableIds.includes("dfs"), false);
  assert.equal(dfs.name, "DFS");
});

test("demo maps declare selectable default algorithms", () => {
  const selectableIds = new Set(
    getSelectableAlgorithms().map((algorithm) => algorithm.id)
  );

  sampleMapRegistry.forEach((preset) => {
    assert.ok(preset.defaultAlgorithm, `${preset.id} is missing defaultAlgorithm`);
    assert.ok(
      selectableIds.has(preset.defaultAlgorithm),
      `${preset.id} uses unavailable algorithm ${preset.defaultAlgorithm}`
    );
  });
});

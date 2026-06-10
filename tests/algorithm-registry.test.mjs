import assert from "node:assert/strict";
import test from "node:test";

import { algorithmRegistry } from "../js/algorithms/registry.js";

test("algorithm controls do not expose DFS", () => {
  assert.equal(
    algorithmRegistry.some((algorithm) => algorithm.id === "dfs"),
    false
  );
});

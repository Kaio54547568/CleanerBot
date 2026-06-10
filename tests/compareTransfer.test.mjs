import assert from "node:assert/strict";
import test from "node:test";

import {
  consumeCompareState,
  storeCompareState,
} from "../js/compareTransfer.js";

test("compare state can be consumed once from shared storage", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
  const state = { steps: 0, map: { grid_size_x: 5 } };
  const key = storeCompareState(storage, state, "fixed-key");

  assert.equal(key, "fixed-key");
  assert.deepEqual(consumeCompareState(storage, key), state);
  assert.equal(consumeCompareState(storage, key), null);
});

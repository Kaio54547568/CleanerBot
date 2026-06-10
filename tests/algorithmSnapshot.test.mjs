import assert from "node:assert/strict";
import test from "node:test";

import { BFSAlgorithm } from "../js/algorithms/bfs.js";

test("algorithm snapshot restores metrics, target, route caches, and recent positions", () => {
  const algorithm = new BFSAlgorithm();
  algorithm.cachedRoute = [{ x: 0, y: 0 }, { x: 1, y: 0 }];
  algorithm.cachedTargetKey = "3,2";
  algorithm.pathCache.set("route", [{ x: 2, y: 1 }]);
  algorithm.recentPositions = [{ x: 0, y: 0 }, { x: 1, y: 0 }];
  algorithm.setCurrentTarget({ x: 3, y: 2 });
  algorithm.recordNodeVisit({
    position: { x: 1, y: 1 },
    goal: { x: 3, y: 2 },
    g: 2,
    h: 3,
  });
  algorithm.recordMemoryUsage(9);
  algorithm.addBatteryConsumed(4);

  const snapshot = algorithm.getStateSnapshot();
  algorithm.reset();
  algorithm.cachedRoute = null;
  algorithm.pathCache.set("other", []);
  algorithm.recentPositions = [];
  algorithm.restoreStateSnapshot(snapshot);

  assert.deepEqual(algorithm.cachedRoute, [{ x: 0, y: 0 }, { x: 1, y: 0 }]);
  assert.deepEqual(algorithm.pathCache.get("route"), [{ x: 2, y: 1 }]);
  assert.deepEqual(algorithm.recentPositions, [{ x: 0, y: 0 }, { x: 1, y: 0 }]);
  assert.deepEqual(algorithm.getCurrentTarget(), { x: 3, y: 2 });
  assert.equal(algorithm.getMetricSummary().visitedNodes, 1);
  assert.equal(algorithm.getMetricSummary().peakMemory, 9);
  assert.equal(algorithm.getMetricSummary().batteryConsumed, 4);
  assert.equal(algorithm.getTraceSlice().length, 1);
});

import assert from "node:assert/strict";
import test from "node:test";

import { AStarAlgorithm } from "../js/algorithms/astar.js";
import { IDSAlgorithm } from "../js/algorithms/ids.js";

test("A* trace records current position and target metadata", () => {
  const algorithm = new AStarAlgorithm();

  algorithm.findPath(createOpenState(), { x: 0, y: 0 }, { x: 2, y: 0 });

  const [entry] = algorithm.getTraceSlice();
  assert.deepEqual(entry.position, { x: 0, y: 0 });
  assert.deepEqual(entry.goal, { x: 2, y: 0, label: "C1" });
});

test("IDS trace records current search depth", () => {
  const algorithm = new IDSAlgorithm();

  algorithm.findPath(createOpenState(), { x: 0, y: 0 }, { x: 2, y: 0 });

  const trace = algorithm.getTraceSlice();
  assert.ok(trace.some((entry) => entry.depth === 0));
  assert.ok(trace.some((entry) => entry.depth === 1));
});

function createOpenState() {
  return {
    robot: { x: 0, y: 0, battery: 100, capacity: 0, maxCapacity: 5 },
    map: {
      grid_size_x: 3,
      grid_size_y: 3,
      start_x: 0,
      start_y: 0,
      trashPositions: [{ x: 2, y: 0 }],
      obstaclePositions: [],
      chargingStation: { x: 0, y: 0 },
      trashCan: { x: 2, y: 2 },
      done: false,
    },
    config: { maxBattery: 100, batteryLoss: 1, actionCost: 1 },
    steps: 0,
    latestAction: null,
    latestLog: "",
  };
}

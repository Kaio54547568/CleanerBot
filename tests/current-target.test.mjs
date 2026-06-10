import assert from "node:assert/strict";
import test from "node:test";

import { BFSAlgorithm } from "../js/algorithms/bfs.js";
import { GreedyAlgorithm } from "../js/algorithms/greedy.js";

const targetTrash = { x: 3, y: 1 };

function createState() {
  return {
    robot: { x: 1, y: 1, battery: 100, capacity: 0, maxCapacity: 5 },
    map: {
      grid_size_x: 5,
      grid_size_y: 5,
      trashPositions: [{ ...targetTrash }],
      obstaclePositions: [],
      chargingStation: { x: 0, y: 0 },
      trashCan: { x: 4, y: 4 },
      done: false,
    },
    config: { maxBattery: 100, batteryLoss: 1, actionCost: 1 },
  };
}

for (const Algorithm of [BFSAlgorithm, GreedyAlgorithm]) {
  test(`${Algorithm.name} exposes and resets its current trash target`, () => {
    const algorithm = new Algorithm();

    algorithm.nextAction(createState());

    assert.deepEqual(algorithm.getCurrentTarget(), targetTrash);

    algorithm.reset();

    assert.equal(algorithm.getCurrentTarget(), null);
  });
}

import assert from "node:assert/strict";
import test from "node:test";

import { Environment } from "../js/environment.js";
import { ACTIONS } from "../js/models.js";
import { Simulator } from "../js/simulator.js";
import { BFSAlgorithm } from "../js/algorithms/bfs.js";

class SequenceAlgorithm {
  constructor(actions) {
    this.actions = actions;
    this.index = 0;
  }

  reset() {}

  nextAction() {
    const action = this.actions[this.index] ?? ACTIONS.STAY;
    this.index += 1;
    return action;
  }

  getMetricsSnapshot() {
    return {};
  }

  restoreMetrics() {}

  addBatteryConsumed() {}

  getMetricSummary() {
    return null;
  }

  getTraceSlice() {
    return [];
  }
}

test("Simulator returns a limited latest position history slice while keeping the total count", () => {
  const environment = new Environment({
    gridSizeX: 20,
    gridSizeY: 4,
    trashCount: 0,
    obstacleCount: 0,
    maxCapacity: 5,
    batteryLoss: 0,
  });

  const simulator = new Simulator({
    environment,
    algorithm: new SequenceAlgorithm([
      ...Array.from({ length: 19 }, () => ACTIONS.RIGHT),
      ...Array.from({ length: 6 }, () => ACTIONS.LEFT),
    ]),
    onStateChange: () => {},
  });

  for (let index = 0; index < 25; index += 1) {
    simulator.step();
  }

  const latestHistory = simulator.getPositionHistorySlice(20);

  assert.equal(simulator.getPositionHistoryCount(), 26);
  assert.equal(latestHistory.length, 20);
  assert.equal(latestHistory[0].step, 6);
  assert.equal(latestHistory.at(-1).step, 25);
});

test("previous step restores BFS visited nodes and preview state exactly", () => {
  const environment = new Environment();
  environment.loadState({
    robot: { battery: 100, capacity: 0, maxCapacity: 5, x: 0, y: 0 },
    map: {
      grid_size_x: 6,
      grid_size_y: 6,
      start_x: 0,
      start_y: 0,
      trashPositions: [{ x: 3, y: 2 }],
      obstaclePositions: [{ x: 1, y: 0 }, { x: 1, y: 1 }],
      chargingStation: { x: 0, y: 0 },
      trashCan: { x: 5, y: 5 },
      done: false,
    },
    config: { maxBattery: 100, batteryLoss: 1, actionCost: 1 },
  });

  let simulator;
  simulator = new Simulator({
    environment,
    algorithm: new BFSAlgorithm(),
    onStateChange: () => simulator.peekNextAction(),
  });

  simulator.peekNextAction();
  const beforeStep = simulator.getAlgorithmMetricSummary().visitedNodes;

  simulator.step();
  const afterStep = simulator.getAlgorithmMetricSummary().visitedNodes;

  simulator.previousStep();
  const afterPrevious = simulator.getAlgorithmMetricSummary().visitedNodes;

  simulator.step();
  const afterReplay = simulator.getAlgorithmMetricSummary().visitedNodes;

  assert.equal(afterPrevious, beforeStep);
  assert.equal(afterReplay, afterStep);
});

test("loading a map resets simulator history and algorithm metrics", () => {
  const environment = new Environment();
  const simulator = new Simulator({
    environment,
    algorithm: new BFSAlgorithm(),
    onStateChange: () => {},
  });

  simulator.peekNextAction();
  simulator.step();

  const loadedState = simulator.loadState({
    robot: { battery: 100, capacity: 0, maxCapacity: 8, x: 2, y: 1 },
    map: {
      grid_size_x: 5,
      grid_size_y: 4,
      start_x: 2,
      start_y: 1,
      trashPositions: [{ x: 4, y: 2 }],
      obstaclePositions: [{ x: 1, y: 1 }],
      chargingStation: { x: 0, y: 0 },
      trashCan: { x: 4, y: 3 },
      done: false,
    },
    config: { maxBattery: 100, batteryLoss: 2, actionCost: 1 },
    steps: 0,
  });

  assert.equal(loadedState.robot.x, 2);
  assert.equal(loadedState.steps, 0);
  assert.equal(simulator.canStepBack(), false);
  assert.equal(simulator.getPositionHistoryCount(), 1);
  assert.equal(simulator.getAlgorithmMetricSummary().visitedNodes, 0);
});

test("BFS exposes its current trash target after previewing the next action", () => {
  const environment = new Environment();
  environment.loadState({
    robot: { battery: 100, capacity: 0, maxCapacity: 5, x: 0, y: 0 },
    map: {
      grid_size_x: 5,
      grid_size_y: 5,
      start_x: 0,
      start_y: 0,
      trashPositions: [{ x: 3, y: 1 }],
      obstaclePositions: [],
      chargingStation: { x: 0, y: 0 },
      trashCan: { x: 4, y: 4 },
      done: false,
    },
    config: { maxBattery: 100, batteryLoss: 1, actionCost: 1 },
  });
  const simulator = new Simulator({
    environment,
    algorithm: new BFSAlgorithm(),
    onStateChange: () => {},
  });

  simulator.peekNextAction();

  assert.deepEqual(simulator.getCurrentTarget(), { x: 3, y: 1 });
});

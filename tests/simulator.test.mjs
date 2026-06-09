import assert from "node:assert/strict";
import test from "node:test";

import { Environment } from "../js/environment.js";
import { ACTIONS } from "../js/models.js";
import { Simulator } from "../js/simulator.js";

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

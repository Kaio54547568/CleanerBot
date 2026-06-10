import assert from "node:assert/strict";
import test from "node:test";

import { createTemplateRecord, sanitizeTemplateName } from "../js/templates.js";

const baseState = {
  robot: { x: 1, y: 1, battery: 80, capacity: 8, maxCapacity: 10 },
  map: {
    grid_size_x: 5,
    grid_size_y: 5,
    start_x: 1,
    start_y: 1,
    trashPositions: [{ x: 2, y: 2 }],
    obstaclePositions: [{ x: 3, y: 3 }],
    chargingStation: { x: 1, y: 1 },
    trashCan: { x: 4, y: 4 },
    done: false,
  },
  config: { maxBattery: 100, batteryLoss: 1, actionCost: 1 },
  steps: 12,
  latestAction: "right",
  latestLog: "Moved right.",
};

test("sanitizeTemplateName trims duplicate whitespace", () => {
  assert.equal(sanitizeTemplateName("  Map   demo  "), "Map demo");
});

test("createTemplateRecord stores a clean template state", () => {
  const template = createTemplateRecord({
    id: "user:demo",
    name: "Demo",
    state: baseState,
    maxCapacity: 5,
    battery: 45,
  });

  assert.equal(template.name, "Demo");
  assert.equal(template.state.robot.maxCapacity, 5);
  assert.equal(template.state.robot.capacity, 5);
  assert.equal(template.state.robot.battery, 45);
  assert.equal(template.state.steps, 0);
  assert.equal(template.state.latestAction, null);
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  createMapDocument,
  parseMapDocument,
  sanitizeMapFilename,
} from "../js/mapStorage.js";

const SAMPLE_STATE = {
  robot: {
    battery: 100,
    capacity: 0,
    maxCapacity: 7,
    x: 1,
    y: 2,
  },
  map: {
    grid_size_x: 6,
    grid_size_y: 5,
    start_x: 1,
    start_y: 2,
    trashPositions: [{ x: 2, y: 2 }, { x: 4, y: 1 }],
    obstaclePositions: [{ x: 3, y: 3 }],
    chargingStation: { x: 0, y: 0 },
    trashCan: { x: 5, y: 4 },
    done: false,
  },
  config: {
    maxBattery: 100,
    batteryLoss: 1.5,
    actionCost: 1,
  },
  steps: 0,
  latestAction: null,
  latestLog: "Map ready.",
};

test("map document round-trip preserves the clean map and settings", () => {
  const document = createMapDocument("Demo map", SAMPLE_STATE);
  const loaded = parseMapDocument(JSON.stringify(document));

  assert.equal(loaded.name, "Demo map");
  assert.deepEqual(loaded.state.map, SAMPLE_STATE.map);
  assert.equal(loaded.state.robot.battery, 100);
  assert.equal(loaded.state.robot.capacity, 0);
  assert.equal(loaded.state.robot.x, SAMPLE_STATE.map.start_x);
  assert.equal(loaded.state.robot.y, SAMPLE_STATE.map.start_y);
  assert.equal(loaded.state.robot.maxCapacity, 7);
  assert.equal(loaded.state.config.batteryLoss, 1.5);
  assert.equal(loaded.state.steps, 0);
});

test("map document rejects malformed, unsupported, and oversized files", () => {
  assert.throws(() => parseMapDocument("{"), /valid JSON/i);

  const unsupported = createMapDocument("Future map", SAMPLE_STATE);
  unsupported.version = 2;
  assert.throws(
    () => parseMapDocument(JSON.stringify(unsupported)),
    /unsupported map version/i
  );

  assert.throws(
    () => parseMapDocument(`{"padding":"${"x".repeat(1_000_000)}"}`),
    /larger than 1 MB/i
  );
});

test("map document rejects positions outside the map", () => {
  const document = createMapDocument("Invalid map", SAMPLE_STATE);
  document.map.trash[0] = { x: document.map.width, y: 0 };

  assert.throws(
    () => parseMapDocument(JSON.stringify(document)),
    /outside the map/i
  );
});

test("map document rejects duplicate and conflicting map items", () => {
  const document = createMapDocument("Conflicting map", SAMPLE_STATE);
  document.map.obstacles.push({ ...document.map.trash[0] });

  assert.throws(
    () => parseMapDocument(JSON.stringify(document)),
    /conflict|duplicate/i
  );
});

test("map filename is sanitized and receives exactly one JSON extension", () => {
  assert.equal(
    sanitizeMapFilename(' Demo: map?.json '),
    "Demo- map-.json"
  );
});

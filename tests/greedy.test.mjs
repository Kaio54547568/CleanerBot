import assert from "node:assert/strict";
import test from "node:test";

import { GreedyAlgorithm } from "../js/algorithms/greedy.js";
import { Environment } from "../js/environment.js";
import { ACTIONS } from "../js/models.js";
import { Simulator } from "../js/simulator.js";

function createState({
  robot = { x: 1, y: 1, battery: 100, capacity: 0, maxCapacity: 5 },
  trashPositions = [{ x: 3, y: 1 }],
  obstaclePositions = [],
  chargingStation = { x: 0, y: 0 },
  trashCan = { x: 4, y: 4 },
  config = { maxBattery: 100, batteryLoss: 0, actionCost: 1 },
} = {}) {
  return {
    robot: { ...robot },
    map: {
      grid_size_x: 5,
      grid_size_y: 5,
      start_x: 0,
      start_y: 0,
      trashPositions: trashPositions.map((position) => ({ ...position })),
      obstaclePositions: obstaclePositions.map((position) => ({ ...position })),
      chargingStation: { ...chargingStation },
      trashCan: { ...trashCan },
      done: false,
    },
    config: { ...config },
    steps: 0,
    latestAction: null,
    latestLog: "Test state.",
  };
}

test("Greedy prefers a less-visited move even when Manhattan distance is worse", () => {
  const algorithm = new GreedyAlgorithm();

  algorithm.nextAction(createState({ robot: { x: 2, y: 1, battery: 100, capacity: 0, maxCapacity: 5 } }));
  algorithm.nextAction(createState({ robot: { x: 2, y: 1, battery: 100, capacity: 0, maxCapacity: 5 } }));

  const action = algorithm.nextAction(createState());

  assert.equal(action, ACTIONS.UP);
});

test("Greedy avoids immediately backtracking when another move is available", () => {
  const algorithm = new GreedyAlgorithm();

  algorithm.nextAction(createState());

  const action = algorithm.nextAction(
    createState({
      robot: { x: 2, y: 1, battery: 100, capacity: 0, maxCapacity: 5 },
      trashPositions: [{ x: 0, y: 1 }],
    })
  );

  assert.equal(action, ACTIONS.UP);
});

test("Greedy does not oscillate between two cells when an obstacle blocks the direct route", () => {
  const environment = new Environment();
  environment.loadState(
    createState({
      robot: { x: 0, y: 1, battery: 100, capacity: 0, maxCapacity: 5 },
      trashPositions: [{ x: 2, y: 1 }],
      obstaclePositions: [{ x: 1, y: 1 }],
      chargingStation: { x: 0, y: 0 },
      trashCan: { x: 2, y: 2 },
    })
  );
  const simulator = new Simulator({
    environment,
    algorithm: new GreedyAlgorithm(),
    onStateChange: () => {},
  });

  for (let index = 0; index < 4; index += 1) {
    simulator.step();
  }

  assert.equal(hasAlternatingTwoCellLoop(simulator.getPositionHistory()), false);
});

test("Greedy rejects a trash target when the real obstacle path exceeds battery", () => {
  const algorithm = new GreedyAlgorithm();
  const action = algorithm.nextAction(
    createState({
      robot: { x: 0, y: 0, battery: 8, capacity: 0, maxCapacity: 5 },
      trashPositions: [{ x: 2, y: 0 }],
      obstaclePositions: [{ x: 1, y: 0 }],
      chargingStation: { x: 0, y: 0 },
      trashCan: { x: 4, y: 4 },
      config: { maxBattery: 8, batteryLoss: 1, actionCost: 1 },
    })
  );

  assert.equal(action, ACTIONS.STAY);
});

test("Greedy chooses only moves that preserve enough battery to return to charging", () => {
  const algorithm = new GreedyAlgorithm();
  const action = algorithm.chooseMoveTowardTarget(
    createState({
      robot: { x: 1, y: 1, battery: 2, capacity: 0, maxCapacity: 5 },
      chargingStation: { x: 0, y: 1 },
      trashPositions: [{ x: 2, y: 1 }],
      config: { maxBattery: 100, batteryLoss: 1, actionCost: 1 },
    }),
    { x: 2, y: 1 }
  );

  assert.equal(action, ACTIONS.LEFT);
});

test("Greedy follows the shortest route when returning to charging station", () => {
  const algorithm = new GreedyAlgorithm();
  const chargingState = createState({
    robot: { x: 0, y: 1, battery: 100, capacity: 0, maxCapacity: 5 },
    trashPositions: [],
    chargingStation: { x: 0, y: 1 },
  });
  algorithm.nextAction(chargingState);

  const action = algorithm.chooseMoveTowardTarget(
    createState({
      robot: { x: 1, y: 1, battery: 10, capacity: 0, maxCapacity: 5 },
      chargingStation: { x: 0, y: 1 },
      trashPositions: [],
      config: { maxBattery: 100, batteryLoss: 1, actionCost: 1 },
    }),
    { x: 0, y: 1 }
  );

  assert.equal(action, ACTIONS.LEFT);
});

test("Greedy does not suck trash when the action would break charging reserve", () => {
  const algorithm = new GreedyAlgorithm();
  const action = algorithm.nextAction(
    createState({
      robot: { x: 1, y: 0, battery: 1, capacity: 0, maxCapacity: 5 },
      chargingStation: { x: 0, y: 0 },
      trashPositions: [{ x: 1, y: 0 }],
      config: { maxBattery: 100, batteryLoss: 1, actionCost: 1 },
    })
  );

  assert.equal(action, ACTIONS.LEFT);
});

test("Greedy does not empty trash when the action would break charging reserve", () => {
  const algorithm = new GreedyAlgorithm();
  const action = algorithm.nextAction(
    createState({
      robot: { x: 1, y: 0, battery: 1, capacity: 1, maxCapacity: 5 },
      chargingStation: { x: 0, y: 0 },
      trashCan: { x: 1, y: 0 },
      trashPositions: [],
      config: { maxBattery: 100, batteryLoss: 1, actionCost: 1 },
    })
  );

  assert.equal(action, ACTIONS.LEFT);
});

test("Greedy exposes the trash position it is currently targeting", () => {
  const algorithm = new GreedyAlgorithm();

  algorithm.nextAction(createState({
    trashPositions: [{ x: 3, y: 1 }],
  }));

  assert.deepEqual(algorithm.getCurrentTarget(), { x: 3, y: 1 });
});

test("Greedy exposes cell scores for every walkable map cell", () => {
  const algorithm = new GreedyAlgorithm();
  const state = createState({
    obstaclePositions: [{ x: 0, y: 1 }],
    trashPositions: [{ x: 3, y: 1 }],
  });

  algorithm.nextAction(state);
  const scores = algorithm.getCellScores(state);

  assert.equal(scores.has("0,1"), false);
  assert.deepEqual(scores.get("2,1"), {
    distance: 1,
    visits: 0,
    backtrackPenalty: 0,
    score: 1,
  });
  assert.deepEqual(scores.get("1,1"), {
    distance: 2,
    visits: 1,
    backtrackPenalty: 0,
    score: 5,
  });
});

test("Greedy trace includes substituted score calculations for each candidate step", () => {
  const algorithm = new GreedyAlgorithm();

  algorithm.nextAction(createState());

  const [entry] = algorithm.getTraceSlice();
  assert.match(entry.note, /Action: right/);
  assert.match(entry.note, /right->C2: 1 \+ 0\*3 \+ 0 = 1/);
  assert.match(entry.note, /left->A2: 3 \+ 0\*3 \+ 0 = 3/);
});

function hasAlternatingTwoCellLoop(history) {
  for (let index = 0; index <= history.length - 4; index += 1) {
    const first = history[index];
    const second = history[index + 1];
    const third = history[index + 2];
    const fourth = history[index + 3];

    if (
      sameCoordinates(first, third) &&
      sameCoordinates(second, fourth) &&
      !sameCoordinates(first, second)
    ) {
      return true;
    }
  }

  return false;
}

function sameCoordinates(a, b) {
  return a.x === b.x && a.y === b.y;
}

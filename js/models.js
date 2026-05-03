export const ACTIONS = Object.freeze({
  UP: "up",
  DOWN: "down",
  LEFT: "left",
  RIGHT: "right",
  CHARGE: "charge",
  SUCK_TRASH: "suck_trash",
  LET_TRASH_OUT: "let_trash_out",
  STAY: "stay",
});

export class Robot {
  constructor({ battery = 100, capacity = 0, maxCapacity = 5, x = 0, y = 0 } = {}) {
    this.battery = battery;
    this.capacity = capacity;
    this.maxCapacity = maxCapacity;
    this.x = x;
    this.y = y;
  }

  clone() {
    return new Robot({
      battery: this.battery,
      capacity: this.capacity,
      maxCapacity: this.maxCapacity,
      x: this.x,
      y: this.y,
    });
  }
}

export class CleanerMap {
  constructor({
    grid_size_x = 8,
    grid_size_y = 8,
    start_x = 0,
    start_y = 0,
    trashPositions = [],
    obstaclePositions = [],
    chargingStation = { x: 0, y: 0 },
    trashCan = { x: 7, y: 7 },
    done = false,
  } = {}) {
    this.grid_size_x = grid_size_x;
    this.grid_size_y = grid_size_y;
    this.start_x = start_x;
    this.start_y = start_y;
    this.trashPositions = trashPositions;
    this.obstaclePositions = obstaclePositions;
    this.chargingStation = chargingStation;
    this.trashCan = trashCan;
    this.done = done;
  }

  clone() {
    return new CleanerMap({
      grid_size_x: this.grid_size_x,
      grid_size_y: this.grid_size_y,
      start_x: this.start_x,
      start_y: this.start_y,
      trashPositions: this.trashPositions.map((position) => ({ ...position })),
      obstaclePositions: this.obstaclePositions.map((position) => ({ ...position })),
      chargingStation: { ...this.chargingStation },
      trashCan: { ...this.trashCan },
      done: this.done,
    });
  }
}

export class SimulationState {
  constructor({ robot, map, config = {}, steps = 0, latestAction = null, latestLog = "No action yet." }) {
    this.robot = robot;
    this.map = map;
    this.config = { ...config };
    this.steps = steps;
    this.latestAction = latestAction;
    this.latestLog = latestLog;
  }

  clone() {
    return new SimulationState({
      robot: this.robot.clone(),
      map: this.map.clone(),
      config: { ...this.config },
      steps: this.steps,
      latestAction: this.latestAction,
      latestLog: this.latestLog,
    });
  }
}

export function simulationStateFromPlain(value = {}) {
  if (value instanceof SimulationState) {
    return value.clone();
  }

  return new SimulationState({
    robot: value.robot instanceof Robot ? value.robot.clone() : new Robot(value.robot),
    map: value.map instanceof CleanerMap ? value.map.clone() : new CleanerMap(value.map),
    config: { ...(value.config ?? {}) },
    steps: value.steps ?? 0,
    latestAction: value.latestAction ?? null,
    latestLog: value.latestLog ?? "No action yet.",
  });
}

export function simulationStateToPlain(state) {
  const snapshot = simulationStateFromPlain(state);

  return {
    robot: {
      battery: snapshot.robot.battery,
      capacity: snapshot.robot.capacity,
      maxCapacity: snapshot.robot.maxCapacity,
      x: snapshot.robot.x,
      y: snapshot.robot.y,
    },
    map: {
      grid_size_x: snapshot.map.grid_size_x,
      grid_size_y: snapshot.map.grid_size_y,
      start_x: snapshot.map.start_x,
      start_y: snapshot.map.start_y,
      trashPositions: snapshot.map.trashPositions.map((position) => ({ ...position })),
      obstaclePositions: snapshot.map.obstaclePositions.map((position) => ({ ...position })),
      chargingStation: { ...snapshot.map.chargingStation },
      trashCan: { ...snapshot.map.trashCan },
      done: snapshot.map.done,
    },
    config: { ...snapshot.config },
    steps: snapshot.steps,
    latestAction: snapshot.latestAction,
    latestLog: snapshot.latestLog,
  };
}

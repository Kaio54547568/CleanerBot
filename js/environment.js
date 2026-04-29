import { ACTIONS, CleanerMap, Robot, SimulationState } from "./models.js";

const MAX_BATTERY = 100;
const ACTION_COST = 1;

const DEFAULT_CONFIG = Object.freeze({
  gridSizeX: 12,
  gridSizeY: 12,
  trashCount: 10,
  obstacleCount: 10,
  maxCapacity: 5,
  batteryLoss: 1,
});

export class Environment {
  constructor(config = {}) {
    this.config = this.normalizeConfig(config);
    this.initialState = this.createInitialState(this.config);
    this.state = this.initialState.clone();
  }

  createInitialState(config = this.config) {
    const gridSizeX = config.gridSizeX;
    const gridSizeY = config.gridSizeY;
    const start = { x: 0, y: 0 };
    const chargingStation = { ...start };
    const trashCan = { x: gridSizeX - 1, y: gridSizeY - 1 };
    const reservedPositions = [start, trashCan];
    const obstaclePositions = this.pickConnectedObstaclePositions(
      config.obstacleCount,
      reservedPositions,
      gridSizeX,
      gridSizeY
    );
    const reachablePositions = this.getReachablePositions(
      start,
      obstaclePositions,
      gridSizeX,
      gridSizeY
    );
    const trashPositions = this.pickRandomPositionsFromList(
      config.trashCount,
      reachablePositions.filter((position) => {
        return ![...reservedPositions, ...obstaclePositions].some((blocked) =>
          samePosition(blocked, position)
        );
      })
    );

    const map = new CleanerMap({
      grid_size_x: gridSizeX,
      grid_size_y: gridSizeY,
      start_x: start.x,
      start_y: start.y,
      trashPositions,
      obstaclePositions,
      chargingStation,
      trashCan,
    });

    const robot = new Robot({
      battery: MAX_BATTERY,
      capacity: 0,
      maxCapacity: config.maxCapacity,
      x: map.start_x,
      y: map.start_y,
    });

    return new SimulationState({
      robot,
      map,
      config: this.createStateConfig(config),
    });
  }

  generate(config = this.config) {
    this.config = this.normalizeConfig(config);
    this.initialState = this.createInitialState(this.config);
    this.state = this.initialState.clone();
    return this.getState();
  }

  updateConfig(config = this.config) {
    const nextConfig = this.normalizeConfig(config);
    const shouldRegenerateMap =
      nextConfig.gridSizeX !== this.config.gridSizeX ||
      nextConfig.gridSizeY !== this.config.gridSizeY ||
      nextConfig.trashCount !== this.config.trashCount ||
      nextConfig.obstacleCount !== this.config.obstacleCount;

    if (shouldRegenerateMap) {
      return this.generate(nextConfig);
    }

    this.config = nextConfig;
    this.state.config = this.createStateConfig(nextConfig);
    this.state.robot.maxCapacity = nextConfig.maxCapacity;
    this.state.robot.capacity = Math.min(
      this.state.robot.capacity,
      nextConfig.maxCapacity
    );
    this.initialState.config = this.createStateConfig(nextConfig);
    this.initialState.robot.maxCapacity = nextConfig.maxCapacity;
    this.initialState.robot.capacity = Math.min(
      this.initialState.robot.capacity,
      nextConfig.maxCapacity
    );
    this.updateDoneStatus();
    return this.getState();
  }

  reset() {
    this.state = this.initialState.clone();
    return this.getState();
  }

  saveCurrentAsInitialState() {
    const cleanInitialState = this.state.clone();
    cleanInitialState.robot.battery = MAX_BATTERY;
    cleanInitialState.robot.capacity = 0;
    cleanInitialState.robot.maxCapacity = this.config.maxCapacity;
    cleanInitialState.robot.x = cleanInitialState.map.start_x;
    cleanInitialState.robot.y = cleanInitialState.map.start_y;
    cleanInitialState.steps = 0;
    cleanInitialState.latestAction = null;
    cleanInitialState.latestLog = "Map ready.";
    cleanInitialState.map.done =
      cleanInitialState.map.trashPositions.length === 0 &&
      cleanInitialState.robot.capacity === 0 &&
      samePosition(cleanInitialState.robot, cleanInitialState.map.chargingStation);
    this.initialState = cleanInitialState;
  }

  normalizeConfig(config) {
    const gridSizeX = clampInteger(config.gridSizeX, 4, 20, DEFAULT_CONFIG.gridSizeX);
    const gridSizeY = clampInteger(config.gridSizeY, 4, 20, DEFAULT_CONFIG.gridSizeY);
    const usableCellCount = Math.max(0, gridSizeX * gridSizeY - 2);
    const obstacleCount = clampInteger(config.obstacleCount, 0, usableCellCount, DEFAULT_CONFIG.obstacleCount);
    const maxTrashCount = Math.max(0, usableCellCount - obstacleCount);
    const trashCount = clampInteger(config.trashCount, 0, maxTrashCount, DEFAULT_CONFIG.trashCount);
    const maxCapacity = clampInteger(config.maxCapacity, 1, 20, DEFAULT_CONFIG.maxCapacity);
    const batteryLoss = clampNumber(config.batteryLoss, 0, 100, DEFAULT_CONFIG.batteryLoss);

    return {
      gridSizeX,
      gridSizeY,
      trashCount,
      obstacleCount,
      maxCapacity,
      batteryLoss,
    };
  }

  createStateConfig(config = this.config) {
    return {
      maxBattery: MAX_BATTERY,
      batteryLoss: config.batteryLoss,
      actionCost: ACTION_COST,
    };
  }

  pickRandomPositions(count, blockedPositions, gridSizeX, gridSizeY) {
    const availablePositions = [];

    for (let y = 0; y < gridSizeY; y += 1) {
      for (let x = 0; x < gridSizeX; x += 1) {
        const position = { x, y };

        if (!blockedPositions.some((blocked) => samePosition(blocked, position))) {
          availablePositions.push(position);
        }
      }
    }

    shuffleArray(availablePositions);
    return availablePositions.slice(0, count);
  }

  pickConnectedObstaclePositions(count, reservedPositions, gridSizeX, gridSizeY) {
    const candidates = this.pickRandomPositions(
      gridSizeX * gridSizeY,
      reservedPositions,
      gridSizeX,
      gridSizeY
    );
    const obstaclePositions = [];

    for (const candidate of candidates) {
      if (obstaclePositions.length >= count) {
        break;
      }

      const nextObstaclePositions = [...obstaclePositions, candidate];

      if (
        this.isWalkableAreaConnected(
          nextObstaclePositions,
          gridSizeX,
          gridSizeY
        )
      ) {
        obstaclePositions.push(candidate);
      }
    }

    return obstaclePositions;
  }

  pickRandomPositionsFromList(count, positions) {
    const availablePositions = positions.map((position) => ({ ...position }));
    shuffleArray(availablePositions);
    return availablePositions.slice(0, count);
  }

  isWalkableAreaConnected(obstaclePositions, gridSizeX, gridSizeY) {
    const start = this.findFirstWalkablePosition(
      obstaclePositions,
      gridSizeX,
      gridSizeY
    );

    if (!start) {
      return true;
    }

    const reachablePositions = this.getReachablePositions(
      start,
      obstaclePositions,
      gridSizeX,
      gridSizeY
    );
    const walkableCellCount =
      gridSizeX * gridSizeY - obstaclePositions.length;

    return reachablePositions.length === walkableCellCount;
  }

  findFirstWalkablePosition(obstaclePositions, gridSizeX, gridSizeY) {
    for (let y = 0; y < gridSizeY; y += 1) {
      for (let x = 0; x < gridSizeX; x += 1) {
        const position = { x, y };

        if (!isPositionBlocked(position, obstaclePositions)) {
          return position;
        }
      }
    }

    return null;
  }

  getReachablePositions(start, obstaclePositions, gridSizeX, gridSizeY) {
    const reachablePositions = [];
    const queue = [start];
    const visited = new Set([positionKey(start)]);

    while (queue.length > 0) {
      const current = queue.shift();
      reachablePositions.push(current);

      for (const neighbor of getNeighborPositions(current)) {
        const key = positionKey(neighbor);

        if (
          visited.has(key) ||
          neighbor.x < 0 ||
          neighbor.y < 0 ||
          neighbor.x >= gridSizeX ||
          neighbor.y >= gridSizeY ||
          isPositionBlocked(neighbor, obstaclePositions)
        ) {
          continue;
        }

        visited.add(key);
        queue.push(neighbor);
      }
    }

    return reachablePositions;
  }

  getState() {
    return this.state.clone();
  }

  getInitialState() {
    return this.initialState.clone();
  }

  restoreState(state) {
    this.state = state.clone();
    return this.getState();
  }

  applyMapEdit(tool, x, y) {
    if (!this.isInsideMap(x, y)) {
      this.state.latestLog = `Cannot edit (${x}, ${y}): outside map.`;
      return this.getState();
    }

    switch (tool) {
      case "inspect":
        this.inspectCell(x, y);
        break;
      case "empty":
        this.clearCell(x, y);
        break;
      case "trash":
        this.placeTrash(x, y);
        break;
      case "obstacle":
        this.placeObstacle(x, y);
        break;
      case "charger":
        this.placeChargingStation(x, y);
        break;
      case "trash_can":
        this.placeTrashCan(x, y);
        break;
      case "robot_start":
        this.placeRobotStart(x, y);
        break;
      default:
        this.state.latestLog = `Unknown edit tool: ${tool}`;
        break;
    }

    this.updateDoneStatus();
    this.state.latestAction = `edit:${tool}`;
    return this.getState();
  }

  inspectCell(x, y) {
    this.state.latestLog = this.getCellInfo(x, y);
  }

  getCellInfo(x, y) {
    if (!this.isInsideMap(x, y)) {
      return `Cell (${x}, ${y}) is outside map.`;
    }

    const position = { x, y };
    const labels = [];
    const { robot, map } = this.state;

    if (samePosition(robot, position)) {
      labels.push(`robot battery ${formatNumber(robot.battery)}%, capacity ${robot.capacity}/${robot.maxCapacity}`);
    }

    if (this.hasTrash(x, y)) labels.push("trash");
    if (this.hasObstacle(x, y)) labels.push("obstacle");
    if (samePosition(map.chargingStation, position)) labels.push("charging station");
    if (samePosition(map.trashCan, position)) labels.push("trash can");

    return labels.length > 0
      ? `Cell (${x}, ${y}): ${labels.join(", ")}.`
      : `Cell (${x}, ${y}) is empty.`;
  }

  clearCell(x, y) {
    this.removeTrashAt(x, y);
    this.removeObstacleAt(x, y);
    this.state.latestLog = `Cleared editable items at (${x}, ${y}).`;
  }

  placeTrash(x, y) {
    const position = { x, y };

    if (this.hasObstacle(x, y)) {
      this.state.latestLog = "Cannot place trash on obstacle.";
      return;
    }

    if (samePosition(this.state.map.chargingStation, position) || samePosition(this.state.map.trashCan, position)) {
      this.state.latestLog = "Cannot place trash on station cells.";
      return;
    }

    if (!this.hasTrash(x, y)) {
      this.state.map.trashPositions.push(position);
    }

    this.state.latestLog = `Placed trash at (${x}, ${y}).`;
  }

  placeObstacle(x, y) {
    const position = { x, y };

    if (samePosition(this.state.robot, position)) {
      this.state.latestLog = "Cannot place obstacle on robot.";
      return;
    }

    if (samePosition(this.state.map.chargingStation, position) || samePosition(this.state.map.trashCan, position)) {
      this.state.latestLog = "Cannot place obstacle on station cells.";
      return;
    }

    this.removeTrashAt(x, y);

    if (!this.hasObstacle(x, y)) {
      this.state.map.obstaclePositions.push(position);
    }

    this.state.latestLog = `Placed obstacle at (${x}, ${y}).`;
  }

  placeChargingStation(x, y) {
    const position = { x, y };

    if (samePosition(this.state.map.trashCan, position)) {
      this.state.latestLog = "Cannot place charging station on trash can.";
      return;
    }

    this.removeTrashAt(x, y);
    this.removeObstacleAt(x, y);
    this.state.map.chargingStation = position;
    this.state.latestLog = `Moved charging station to (${x}, ${y}).`;
  }

  placeTrashCan(x, y) {
    const position = { x, y };

    if (samePosition(this.state.map.chargingStation, position)) {
      this.state.latestLog = "Cannot place trash can on charging station.";
      return;
    }

    this.removeTrashAt(x, y);
    this.removeObstacleAt(x, y);
    this.state.map.trashCan = position;
    this.state.latestLog = `Moved trash can to (${x}, ${y}).`;
  }

  placeRobotStart(x, y) {
    this.removeObstacleAt(x, y);
    this.state.robot.x = x;
    this.state.robot.y = y;
    this.state.map.start_x = x;
    this.state.map.start_y = y;
    this.state.latestLog = `Moved robot start to (${x}, ${y}).`;
  }

  applyAction(action) {
    if (this.state.map.done) {
      this.state.latestAction = ACTIONS.STAY;
      this.state.latestLog = "Simulation already done.";
      return this.getState();
    }

    this.state.latestAction = action ?? ACTIONS.STAY;

    switch (action) {
      case ACTIONS.UP:
        this.moveRobot(0, -1, action);
        break;
      case ACTIONS.DOWN:
        this.moveRobot(0, 1, action);
        break;
      case ACTIONS.LEFT:
        this.moveRobot(-1, 0, action);
        break;
      case ACTIONS.RIGHT:
        this.moveRobot(1, 0, action);
        break;
      case ACTIONS.CHARGE:
        this.chargeRobot();
        break;
      case ACTIONS.SUCK_TRASH:
        this.suckTrash();
        break;
      case ACTIONS.LET_TRASH_OUT:
        this.letTrashOut();
        break;
      case ACTIONS.STAY:
      case null:
      case undefined:
        this.state.latestLog = "Robot stayed in place.";
        break;
      default:
        this.state.latestAction = `${action}`;
        this.state.latestLog = `Unknown action: ${action}`;
        break;
    }

    this.updateDoneStatus();
    return this.getState();
  }

  moveRobot(deltaX, deltaY, actionName) {
    const nextX = this.state.robot.x + deltaX;
    const nextY = this.state.robot.y + deltaY;

    if (this.state.robot.battery <= 0) {
      this.state.latestLog = "Cannot move: battery is empty.";
      return;
    }

    if (!this.isInsideMap(nextX, nextY)) {
      this.state.latestLog = `Cannot move ${actionName}: outside map.`;
      return;
    }

    if (this.hasObstacle(nextX, nextY)) {
      this.state.latestLog = `Cannot move ${actionName}: obstacle blocked.`;
      return;
    }

    this.state.robot.x = nextX;
    this.state.robot.y = nextY;
    this.consumeBattery(this.config.batteryLoss);
    this.state.steps += 1;
    this.state.latestLog = `Moved ${actionName}.`;
  }

  chargeRobot() {
    const { robot, map } = this.state;

    if (!samePosition(robot, map.chargingStation)) {
      this.state.latestLog = "Cannot charge: robot is not at charging station.";
      return;
    }

    robot.battery = MAX_BATTERY;
    this.state.steps += 1;
    this.state.latestLog = "Battery charged.";
  }

  suckTrash() {
    const { robot, map } = this.state;
    const trashIndex = map.trashPositions.findIndex((trash) => samePosition(robot, trash));

    if (trashIndex === -1) {
      this.state.latestLog = "Cannot suck trash: no trash at this cell.";
      return;
    }

    if (robot.capacity >= robot.maxCapacity) {
      this.state.latestLog = "Cannot suck trash: capacity is full.";
      return;
    }

    map.trashPositions.splice(trashIndex, 1);
    robot.capacity += 1;
    this.consumeBattery(ACTION_COST);
    this.state.steps += 1;
    this.state.latestLog = "Trash collected.";
  }

  letTrashOut() {
    const { robot, map } = this.state;

    if (!samePosition(robot, map.trashCan)) {
      this.state.latestLog = "Cannot empty trash: robot is not at trash can.";
      return;
    }

    if (robot.capacity === 0) {
      this.state.latestLog = "Trash container is already empty.";
      return;
    }

    robot.capacity = 0;
    this.consumeBattery(ACTION_COST);
    this.state.steps += 1;
    this.state.latestLog = "Trash container emptied.";
  }

  updateDoneStatus() {
    const { robot, map } = this.state;
    map.done =
      map.trashPositions.length === 0 &&
      robot.capacity === 0 &&
      samePosition(robot, map.chargingStation);
  }

  isInsideMap(x, y) {
    return x >= 0 && y >= 0 && x < this.state.map.grid_size_x && y < this.state.map.grid_size_y;
  }

  hasObstacle(x, y) {
    return this.state.map.obstaclePositions.some((obstacle) => obstacle.x === x && obstacle.y === y);
  }

  hasTrash(x, y) {
    return this.state.map.trashPositions.some((trash) => trash.x === x && trash.y === y);
  }

  removeTrashAt(x, y) {
    this.state.map.trashPositions = this.state.map.trashPositions.filter((trash) => {
      return trash.x !== x || trash.y !== y;
    });
  }

  removeObstacleAt(x, y) {
    this.state.map.obstaclePositions = this.state.map.obstaclePositions.filter((obstacle) => {
      return obstacle.x !== x || obstacle.y !== y;
    });
  }

  consumeBattery(amount) {
    this.state.robot.battery = Math.max(0, this.state.robot.battery - amount);
  }
}

export function samePosition(a, b) {
  return a.x === b.x && a.y === b.y;
}

function clampInteger(value, min, max, fallback) {
  const numberValue = Number.parseInt(value, 10);

  if (Number.isNaN(numberValue)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, numberValue));
}

function clampNumber(value, min, max, fallback) {
  const numberValue = Number.parseFloat(value);

  if (Number.isNaN(numberValue)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, numberValue));
}

function formatNumber(value) {
  return Number.isInteger(value) ? `${value}` : `${Number(value.toFixed(2))}`;
}

function isPositionBlocked(position, blockedPositions) {
  return blockedPositions.some((blocked) => samePosition(blocked, position));
}

function positionKey(position) {
  return `${position.x},${position.y}`;
}

function getNeighborPositions(position) {
  return [
    { x: position.x, y: position.y - 1 },
    { x: position.x, y: position.y + 1 },
    { x: position.x - 1, y: position.y },
    { x: position.x + 1, y: position.y },
  ];
}

function shuffleArray(items) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    const currentItem = items[index];
    items[index] = items[randomIndex];
    items[randomIndex] = currentItem;
  }
}

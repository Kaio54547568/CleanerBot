import { ACTIONS } from "../models.js";
import { samePosition } from "../environment.js";
import { BaseAlgorithm } from "./baseAlgorithm.js";

const DEFAULT_MAX_BATTERY = 100;
const DEFAULT_BATTERY_LOSS = 1;

export class GreedyAlgorithm extends BaseAlgorithm {
  constructor() {
    super();
    this.name = "Greedy";
  }

  reset() {
    super.reset();
    // Greedy hien tai khong luu trang thai noi bo.
  }

  nextAction(state) {
    const { robot, map } = state;

    if (samePosition(robot, map.trashCan) && robot.capacity > 0) {
      return ACTIONS.LET_TRASH_OUT;
    }

    if (this.isAtChargingStation(state) && this.shouldCharge(state)) {
      return ACTIONS.CHARGE;
    }

    if (this.hasTrashAtRobot(state) && robot.capacity < robot.maxCapacity) {
      return ACTIONS.SUCK_TRASH;
    }

    let target = this.chooseWorkTarget(state);

    if (target && !samePosition(target, map.chargingStation) && !this.hasEnoughBatteryForTarget(state, target)) {
      target = map.chargingStation;
    }

    if (!target) {
      return ACTIONS.STAY;
    }

    if (samePosition(robot, target)) {
      return this.getActionAtTarget(state, target);
    }

    if (this.getBatteryLoss(state) > robot.battery && !this.isAtChargingStation(state)) {
      return ACTIONS.STAY;
    }

    return this.chooseMoveTowardTarget(state, target);
  }

  chooseWorkTarget(state) {
    const { robot, map } = state;

    if (robot.capacity >= robot.maxCapacity || (map.trashPositions.length === 0 && robot.capacity > 0)) {
      return map.trashCan;
    }

    if (map.trashPositions.length > 0) {
      return this.findNearestPosition(robot, map.trashPositions);
    }

    return null;
  }

  getActionAtTarget(state, target) {
    const { robot, map } = state;

    if (samePosition(target, map.chargingStation) && robot.battery < this.getMaxBattery(state)) {
      return ACTIONS.CHARGE;
    }

    if (samePosition(target, map.trashCan) && robot.capacity > 0) {
      return ACTIONS.LET_TRASH_OUT;
    }

    if (this.hasTrashAtRobot(state) && robot.capacity < robot.maxCapacity) {
      return ACTIONS.SUCK_TRASH;
    }

    return ACTIONS.STAY;
  }

  shouldCharge(state) {
    const { robot } = state;
    const maxBattery = this.getMaxBattery(state);

    if (robot.battery >= maxBattery) {
      return false;
    }

    const workTarget = this.chooseWorkTarget(state);

    if (!workTarget) {
      return false;
    }

    return !this.hasEnoughBatteryForTarget(state, workTarget);
  }

  hasEnoughBatteryForTarget(state, target) {
    const { robot, map } = state;
    const batteryLoss = this.getBatteryLoss(state);

    if (batteryLoss === 0) {
      return true;
    }

    const distanceToTarget = this.manhattanDistance(robot, target);
    let safeExitDistance = this.manhattanDistance(target, map.chargingStation);

    if (samePosition(target, map.trashCan)) {
      safeExitDistance = this.manhattanDistance(target, map.chargingStation);
    }

    if (map.trashPositions.some((trash) => samePosition(trash, target))) {
      const willBeFull = robot.capacity + 1 >= robot.maxCapacity;
      safeExitDistance = willBeFull
        ? this.manhattanDistance(target, map.trashCan)
        : this.manhattanDistance(target, map.chargingStation);
    }

    const requiredBattery = (distanceToTarget + safeExitDistance) * batteryLoss;
    return robot.battery >= requiredBattery;
  }

  findNearestPosition(robot, positions) {
    return positions.reduce((nearest, current) => {
      const nearestDistance = this.manhattanDistance(robot, nearest);
      const currentDistance = this.manhattanDistance(robot, current);
      return currentDistance < nearestDistance ? current : nearest;
    });
  }

  chooseMoveTowardTarget(state, target) {
    const { robot } = state;
    const candidates = this.getMoveCandidates(robot);

    candidates.sort((a, b) => {
      return this.manhattanDistance(a.position, target) - this.manhattanDistance(b.position, target);
    });

    const bestMove = candidates.find((candidate) => this.canMoveTo(state, candidate.position));

    if (bestMove) {
      return bestMove.action;
    }

    return ACTIONS.STAY;
  }

  getMoveCandidates(robot) {
    return [
      { action: ACTIONS.UP, position: { x: robot.x, y: robot.y - 1 } },
      { action: ACTIONS.DOWN, position: { x: robot.x, y: robot.y + 1 } },
      { action: ACTIONS.LEFT, position: { x: robot.x - 1, y: robot.y } },
      { action: ACTIONS.RIGHT, position: { x: robot.x + 1, y: robot.y } },
    ];
  }

  canMoveTo(state, position) {
    const { map } = state;
    const insideMap = position.x >= 0
      && position.y >= 0
      && position.x < map.grid_size_x
      && position.y < map.grid_size_y;

    if (!insideMap) {
      return false;
    }

    return !map.obstaclePositions.some((obstacle) => samePosition(obstacle, position));
  }

  hasTrashAtRobot(state) {
    const { robot, map } = state;
    return map.trashPositions.some((trash) => samePosition(robot, trash));
  }

  isAtChargingStation(state) {
    return samePosition(state.robot, state.map.chargingStation);
  }

  getMaxBattery(state) {
    return state.config?.maxBattery ?? DEFAULT_MAX_BATTERY;
  }

  getBatteryLoss(state) {
    return state.config?.batteryLoss ?? DEFAULT_BATTERY_LOSS;
  }

  manhattanDistance(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }
}

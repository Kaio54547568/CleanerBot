import { ACTIONS } from "../models.js";
import { samePosition } from "../environment.js";

const DEFAULT_MAX_BATTERY = 100;
const DEFAULT_BATTERY_LOSS = 1;
const DEFAULT_ACTION_COST = 1;

export class BaseAlgorithm {
  constructor() {
    this.name = "BaseAlgorithm";
  }

  reset() {
    // Child algorithms can clear their queue, stack, visited set, or heuristic cache here.
  }

  nextAction(state) {
    return ACTIONS.STAY;
  }

  getMaxBattery(state) {
    return state.config?.maxBattery ?? DEFAULT_MAX_BATTERY;
  }

  getBatteryLoss(state) {
    return state.config?.batteryLoss ?? DEFAULT_BATTERY_LOSS;
  }

  getActionCost(state) {
    return state.config?.actionCost ?? DEFAULT_ACTION_COST;
  }

  manhattanDistance(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  hasTrashAtRobot(state) {
    const { robot, map } = state;
    return map.trashPositions.some((trash) => samePosition(robot, trash));
  }

  isAtChargingStation(state) {
    return samePosition(state.robot, state.map.chargingStation);
  }

  isAtTrashCan(state) {
    return samePosition(state.robot, state.map.trashCan);
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

    const insideMap =
      position.x >= 0 &&
      position.y >= 0 &&
      position.x < map.grid_size_x &&
      position.y < map.grid_size_y;

    if (!insideMap) {
      return false;
    }

    return !map.obstaclePositions.some((obstacle) =>
      samePosition(obstacle, position)
    );
  }

  findNearestPosition(fromPosition, positions) {
    if (!positions || positions.length === 0) {
      return null;
    }

    return positions.reduce((nearest, current) => {
      const nearestDistance = this.manhattanDistance(fromPosition, nearest);
      const currentDistance = this.manhattanDistance(fromPosition, current);
      return currentDistance < nearestDistance ? current : nearest;
    });
  }

  chooseMoveTowardTarget(state, target) {
    const { robot } = state;
    const candidates = this.getMoveCandidates(robot);

    candidates.sort((a, b) => {
      return (
        this.manhattanDistance(a.position, target) -
        this.manhattanDistance(b.position, target)
      );
    });

    const bestMove = candidates.find((candidate) =>
      this.canMoveTo(state, candidate.position)
    );

    return bestMove ? bestMove.action : ACTIONS.STAY;
  }
}

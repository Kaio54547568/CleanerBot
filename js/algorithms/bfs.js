import { ACTIONS } from "../models.js";
import { samePosition } from "../environment.js";
import { BaseAlgorithm } from "./baseAlgorithm.js";

const EPSILON = 1e-9;
const MAX_RECENT_POSITIONS = 6;

export class BFSAlgorithm extends BaseAlgorithm {
  constructor() {
    super();
    this.name = "BFS";
    this.reset();
  }

  reset() {
    super.reset();
    this.cachedRoute = null;
    this.cachedTargetKey = null;
    this.cachedMapKey = null;
    this.recentPositions = [];
    this.setHeuristicDescription("BFS does not use heuristic.");
  }

  computeNextAction(state) {
    const { robot, map } = state;
    this.rememberPosition(state);

    if (map.done) {
      this.clearRoute();
      return ACTIONS.STAY;
    }

    if (
      this.isAtTrashCan(state) &&
      this.shouldEmptyTrash(state) &&
      this.hasEnoughBatteryForTarget(state, map.trashCan)
    ) {
      this.clearRoute();
      return ACTIONS.LET_TRASH_OUT;
    }

    if (this.isAtChargingStation(state) && this.shouldCharge(state)) {
      this.clearRoute();
      return ACTIONS.CHARGE;
    }

    if (this.hasTrashAtRobot(state) && robot.capacity < robot.maxCapacity) {
      if (this.hasEnoughBatteryForTarget(state, robot)) {
        this.clearRoute();
        return ACTIONS.SUCK_TRASH;
      }
    }

    let target = this.chooseWorkTarget(state);

    if (!target) {
      this.clearRoute();
      return ACTIONS.STAY;
    }

    let route = this.getRouteToTarget(state, target);

    if ((!route || route.length < 2) && !samePosition(target, map.chargingStation)) {
      target = map.chargingStation;
      route = this.getRouteToTarget(state, target);
    }

    if (!route || route.length < 2) {
      this.clearRoute();
      return ACTIONS.STAY;
    }

    if (this.isLoopingBetweenTwoCells()) {
      const previousPosition = this.recentPositions[this.recentPositions.length - 2];
      this.clearRoute();
      route = this.getRouteToTarget(state, target, {
        avoidFirstStepToPosition: previousPosition,
      });

      if ((!route || route.length < 2) && !samePosition(target, map.chargingStation)) {
        target = map.chargingStation;
        route = this.getRouteToTarget(state, target, {
          avoidFirstStepToPosition: previousPosition,
        });
      }
    }

    if (!route || route.length < 2) {
      this.clearRoute();
      return ACTIONS.STAY;
    }

    const action = this.getActionForRouteStep(route[0], route[1]);

    if (action === ACTIONS.STAY || !this.canMoveTo(state, route[1])) {
      this.clearRoute();
      return ACTIONS.STAY;
    }

    return action;
  }

  chooseWorkTarget(state) {
    const { robot, map } = state;

    if (this.shouldReturnToChargingStationAfterCleaning(state)) {
      return map.chargingStation;
    }

    if (this.shouldEmptyTrash(state)) {
      if (this.hasEnoughBatteryForTarget(state, map.trashCan)) {
        return map.trashCan;
      }

      if (this.hasEnoughBatteryForTarget(state, map.chargingStation)) {
        return map.chargingStation;
      }

      return null;
    }

    if (map.trashPositions.length > 0 && robot.capacity < robot.maxCapacity) {
      const trashResult = this.findNearestSafeTrashTarget(state);

      if (trashResult) {
        this.cachedRoute = trashResult.route;
        this.cachedTargetKey = this.positionKey(trashResult.target);
        this.cachedMapKey = this.getStaticMapKey(state);
        return trashResult.target;
      }

      if (this.hasEnoughBatteryForTarget(state, map.chargingStation)) {
        return map.chargingStation;
      }

      return null;
    }

    if (this.hasEnoughBatteryForTarget(state, map.chargingStation)) {
      return map.chargingStation;
    }

    return null;
  }

  findNearestSafeTrashTarget(state) {
    const { robot } = state;
    const start = { x: robot.x, y: robot.y };
    const queue = [
      {
        position: start,
        path: [start],
      },
    ];
    const visited = new Set([this.positionKey(start)]);

    this.recordMemoryUsage(queue.length + visited.size);

    while (queue.length > 0) {
      const node = queue.shift();
      const current = node.position;
      this.recordNodeVisit({ position: current });
      this.recordMemoryUsage(queue.length + visited.size);

      if (this.isTrashPosition(state, current)) {
        if (
          robot.capacity < robot.maxCapacity &&
          this.hasEnoughBatteryForTarget(state, current)
        ) {
          return {
            target: current,
            route: node.path,
          };
        }
      }

      for (const candidate of this.getMoveCandidates(current)) {
        const key = this.positionKey(candidate.position);

        if (visited.has(key) || !this.canMoveTo(state, candidate.position)) {
          continue;
        }

        visited.add(key);
        queue.push({
          position: candidate.position,
          path: [...node.path, candidate.position],
        });
        this.recordMemoryUsage(queue.length + visited.size);
      }
    }

    return null;
  }

  findPath(state, start, goal, options = {}) {
    if (!start || !goal) {
      return null;
    }

    if (samePosition(start, goal)) {
      return [{ x: start.x, y: start.y }];
    }

    const avoidFirstStepKey = options.avoidFirstStepToPosition
      ? this.positionKey(options.avoidFirstStepToPosition)
      : null;
    const normalizedStart = { x: start.x, y: start.y };
    const queue = [
      {
        position: normalizedStart,
        path: [normalizedStart],
      },
    ];
    const visited = new Set([this.positionKey(normalizedStart)]);

    this.recordMemoryUsage(queue.length + visited.size);

    while (queue.length > 0) {
      const node = queue.shift();
      const current = node.position;
      this.recordNodeVisit({ position: current });
      this.recordMemoryUsage(queue.length + visited.size);

      if (samePosition(current, goal)) {
        return node.path;
      }

      for (const candidate of this.getMoveCandidates(current)) {
        const key = this.positionKey(candidate.position);

        if (visited.has(key) || !this.canMoveTo(state, candidate.position)) {
          continue;
        }

        if (node.path.length === 1 && avoidFirstStepKey && key === avoidFirstStepKey) {
          continue;
        }

        visited.add(key);
        queue.push({
          position: candidate.position,
          path: [...node.path, candidate.position],
        });
        this.recordMemoryUsage(queue.length + visited.size);
      }
    }

    return null;
  }

  getRouteToTarget(state, target, options = {}) {
    const syncedRoute = this.syncCachedRoute(state, target);

    if (syncedRoute && syncedRoute.length > 0) {
      if (options.avoidFirstStepToPosition && syncedRoute.length >= 2) {
        const avoidKey = this.positionKey(options.avoidFirstStepToPosition);

        if (this.positionKey(syncedRoute[1]) === avoidKey) {
          this.clearRoute();
        } else {
          return syncedRoute;
        }
      } else {
        return syncedRoute;
      }
    }

    const route = this.findPath(state, state.robot, target, options);

    if (!route) {
      this.clearRoute();
      return null;
    }

    this.cachedRoute = route;
    this.cachedTargetKey = this.positionKey(target);
    this.cachedMapKey = this.getStaticMapKey(state);
    return this.cachedRoute;
  }

  syncCachedRoute(state, target) {
    if (!this.cachedRoute || this.cachedRoute.length === 0) {
      return null;
    }

    if (this.cachedTargetKey !== this.positionKey(target)) {
      this.clearRoute();
      return null;
    }

    if (this.cachedMapKey !== this.getStaticMapKey(state)) {
      this.clearRoute();
      return null;
    }

    const currentIndex = this.cachedRoute.findIndex((position) =>
      samePosition(position, state.robot)
    );

    if (currentIndex === -1) {
      this.clearRoute();
      return null;
    }

    this.cachedRoute = this.cachedRoute.slice(currentIndex);
    return this.cachedRoute;
  }

  clearRoute() {
    this.cachedRoute = null;
    this.cachedTargetKey = null;
    this.cachedMapKey = null;
  }

  getMoveCandidates(position) {
    return [
      { action: ACTIONS.UP, position: { x: position.x, y: position.y - 1 } },
      { action: ACTIONS.RIGHT, position: { x: position.x + 1, y: position.y } },
      { action: ACTIONS.DOWN, position: { x: position.x, y: position.y + 1 } },
      { action: ACTIONS.LEFT, position: { x: position.x - 1, y: position.y } },
    ];
  }

  getActionForRouteStep(from, to) {
    if (to.x === from.x && to.y === from.y - 1) {
      return ACTIONS.UP;
    }

    if (to.x === from.x && to.y === from.y + 1) {
      return ACTIONS.DOWN;
    }

    if (to.x === from.x - 1 && to.y === from.y) {
      return ACTIONS.LEFT;
    }

    if (to.x === from.x + 1 && to.y === from.y) {
      return ACTIONS.RIGHT;
    }

    return ACTIONS.STAY;
  }

  shouldEmptyTrash(state) {
    const { robot, map } = state;
    return (
      robot.capacity > 0 &&
      (robot.capacity >= robot.maxCapacity || map.trashPositions.length === 0)
    );
  }

  shouldReturnToChargingStationAfterCleaning(state) {
    const { robot, map } = state;
    return map.trashPositions.length === 0 && robot.capacity === 0;
  }

  isFinalDoneState(state) {
    const { robot, map } = state;
    return (
      map.trashPositions.length === 0 &&
      robot.capacity === 0 &&
      samePosition(robot, map.chargingStation)
    );
  }

  shouldCharge(state) {
    const { robot, map } = state;
    const maxBattery = this.getMaxBattery(state);

    if (robot.battery + EPSILON >= maxBattery) {
      return false;
    }

    if (this.isFinalDoneState(state)) {
      return true;
    }

    if (this.shouldEmptyTrash(state)) {
      return !this.hasEnoughBatteryForTarget(state, map.trashCan);
    }

    if (map.trashPositions.length > 0 && robot.capacity < robot.maxCapacity) {
      const trashResult = this.findNearestSafeTrashTarget(state);
      return !trashResult;
    }

    return false;
  }

  hasEnoughBatteryForTarget(state, target) {
    const { robot } = state;
    const requiredBattery = this.getRequiredBatteryForTarget(state, target);

    if (!Number.isFinite(requiredBattery)) {
      return false;
    }

    return robot.battery + EPSILON >= requiredBattery;
  }

  getSafeExitTargetAfterTarget(state, target) {
    const { robot, map } = state;

    if (samePosition(target, map.chargingStation)) {
      return null;
    }

    if (samePosition(target, map.trashCan)) {
      return map.chargingStation;
    }

    if (!this.isTrashPosition(state, target)) {
      return map.chargingStation;
    }

    const willBeFull = robot.capacity + 1 >= robot.maxCapacity;
    return willBeFull ? map.trashCan : map.chargingStation;
  }

  getRequiredBatteryForTarget(state, target) {
    const { robot, map } = state;
    const actionCost = this.getActionCost(state);
    const start = { x: robot.x, y: robot.y };
    const pathToTarget = this.findPath(state, start, target);

    if (!pathToTarget) {
      return Number.POSITIVE_INFINITY;
    }

    let requiredBattery = this.getMovementCostForPath(state, pathToTarget);

    if (samePosition(target, map.chargingStation)) {
      return requiredBattery;
    }

    if (samePosition(target, map.trashCan)) {
      if (this.shouldEmptyTrash(state)) {
        requiredBattery += actionCost;
      }

      const pathToChargingStation = this.findPath(state, target, map.chargingStation);

      if (!pathToChargingStation) {
        return Number.POSITIVE_INFINITY;
      }

      requiredBattery += this.getMovementCostForPath(state, pathToChargingStation);
      return requiredBattery;
    }

    if (!this.isTrashPosition(state, target) || robot.capacity >= robot.maxCapacity) {
      const pathToChargingStation = this.findPath(state, target, map.chargingStation);

      if (!pathToChargingStation) {
        return Number.POSITIVE_INFINITY;
      }

      requiredBattery += this.getMovementCostForPath(state, pathToChargingStation);
      return requiredBattery;
    }

    requiredBattery += actionCost;
    const safeExitTarget = this.getSafeExitTargetAfterTarget(state, target);

    if (!safeExitTarget) {
      return requiredBattery;
    }

    const safeExitPath = this.findPath(state, target, safeExitTarget);

    if (!safeExitPath) {
      return Number.POSITIVE_INFINITY;
    }

    requiredBattery += this.getMovementCostForPath(state, safeExitPath);

    if (samePosition(safeExitTarget, map.trashCan)) {
      requiredBattery += actionCost;

      const trashCanToChargingStation = this.findPath(
        state,
        map.trashCan,
        map.chargingStation
      );

      if (!trashCanToChargingStation) {
        return Number.POSITIVE_INFINITY;
      }

      requiredBattery += this.getMovementCostForPath(
        state,
        trashCanToChargingStation
      );
    }

    return requiredBattery;
  }

  getMovementCostForPath(state, path) {
    const distance = Math.max(0, (path?.length ?? 0) - 1);
    return distance * this.getBatteryLoss(state);
  }

  positionKey(position) {
    return `${position.x},${position.y}`;
  }

  getStaticMapKey(state) {
    const { map } = state;
    const obstacleSignature = [...map.obstaclePositions]
      .sort((a, b) => a.y - b.y || a.x - b.x)
      .map((position) => this.positionKey(position))
      .join(",");

    return `${map.grid_size_x}x${map.grid_size_y}|${obstacleSignature}`;
  }

  isTrashPosition(state, position) {
    return state.map.trashPositions.some((trash) => samePosition(trash, position));
  }

  rememberPosition(state) {
    const current = { x: state.robot.x, y: state.robot.y };
    this.recentPositions.push(current);

    if (this.recentPositions.length > MAX_RECENT_POSITIONS) {
      this.recentPositions = this.recentPositions.slice(
        this.recentPositions.length - MAX_RECENT_POSITIONS
      );
    }
  }

  isLoopingBetweenTwoCells() {
    if (this.recentPositions.length < 4) {
      return false;
    }

    const n = this.recentPositions.length;
    const a = this.recentPositions[n - 4];
    const b = this.recentPositions[n - 3];
    const c = this.recentPositions[n - 2];
    const d = this.recentPositions[n - 1];

    return samePosition(a, c) && samePosition(b, d) && !samePosition(c, d);
  }
}

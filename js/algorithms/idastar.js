import { ACTIONS } from "../models.js";
import { samePosition } from "../environment.js";
import { BaseAlgorithm } from "./baseAlgorithm.js";

const DEFAULT_MAX_BATTERY = 100;
const DEFAULT_BATTERY_LOSS = 1;
const SEARCH_FOUND = Symbol("ida_star_found");

export class IDAStarAlgorithm extends BaseAlgorithm {
  constructor() {
    super();
    this.name = "IDA*";
    this.reset();
  }

  reset() {
    super.reset();
    this.pathCache = new Map();
    this.cachedRoute = null;
    this.cachedTargetKey = null;
    this.cachedMapKey = null;
  }

  nextAction(state) {
    const { robot, map } = state;

    if (samePosition(robot, map.trashCan) && robot.capacity > 0) {
      this.clearRoute();
      return ACTIONS.LET_TRASH_OUT;
    }

    if (this.isAtChargingStation(state) && this.shouldCharge(state)) {
      this.clearRoute();
      return ACTIONS.CHARGE;
    }

    if (this.hasTrashAtRobot(state) && robot.capacity < robot.maxCapacity) {
      this.clearRoute();
      return ACTIONS.SUCK_TRASH;
    }

    let target = this.chooseWorkTarget(state);

    if (target && !samePosition(target, map.chargingStation) && !this.hasEnoughBatteryForTarget(state, target)) {
      target = map.chargingStation;
    }

    if (!target) {
      this.clearRoute();
      return ACTIONS.STAY;
    }

    if (samePosition(robot, target)) {
      this.clearRoute();
      return this.getActionAtTarget(state, target);
    }

    if (this.getBatteryLoss(state) > robot.battery && !this.isAtChargingStation(state)) {
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

    const action = this.getActionForRouteStep(route[0], route[1]);

    if (!action || action === ACTIONS.STAY || !this.canMoveTo(state, route[1])) {
      this.clearRoute();
      return ACTIONS.STAY;
    }

    return action;
  }

  chooseWorkTarget(state) {
    const { robot, map } = state;

    if (robot.capacity >= robot.maxCapacity || (map.trashPositions.length === 0 && robot.capacity > 0)) {
      return this.findReachableTarget(state, [map.trashCan]);
    }

    if (map.trashPositions.length > 0) {
      return this.findReachableTarget(state, map.trashPositions);
    }

    return null;
  }

  findReachableTarget(state, positions) {
    const sortedPositions = [...positions].sort((a, b) => {
      return this.manhattanDistance(state.robot, a) - this.manhattanDistance(state.robot, b);
    });

    return sortedPositions.find((position) => {
      const path = this.findPath(state, state.robot, position);
      return Array.isArray(path) && path.length > 0;
    }) ?? null;
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

    const pathToTarget = this.findPath(state, robot, target);

    if (!pathToTarget) {
      return false;
    }

    let safeExitTarget = map.chargingStation;

    if (samePosition(target, map.trashCan)) {
      safeExitTarget = map.chargingStation;
    } else if (map.trashPositions.some((trash) => samePosition(trash, target))) {
      const willBeFull = robot.capacity + 1 >= robot.maxCapacity;
      safeExitTarget = willBeFull ? map.trashCan : map.chargingStation;
    }

    const safeExitPath = this.findPath(state, target, safeExitTarget);

    if (!safeExitPath) {
      return false;
    }

    const distanceToTarget = Math.max(0, pathToTarget.length - 1);
    const safeExitDistance = Math.max(0, safeExitPath.length - 1);
    const requiredBattery = (distanceToTarget + safeExitDistance) * batteryLoss;

    return robot.battery >= requiredBattery-1;
  }

  getRouteToTarget(state, target) {
    const syncedRoute = this.syncCachedRoute(state, target);

    if (syncedRoute && syncedRoute.length > 0) {
      return syncedRoute;
    }

    const route = this.findPath(state, state.robot, target);

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

    if (this.cachedTargetKey !== this.positionKey(target) || this.cachedMapKey !== this.getStaticMapKey(state)) {
      this.clearRoute();
      return null;
    }

    const currentIndex = this.cachedRoute.findIndex((position) => samePosition(position, state.robot));

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

  findPath(state, start, goal) {
    if (samePosition(start, goal)) {
      return [{ x: start.x, y: start.y }];
    }

    const cacheKey = this.getPathCacheKey(state, start, goal);

    if (this.pathCache.has(cacheKey)) {
      return this.pathCache.get(cacheKey);
    }

    const path = this.runIDAStar(state, start, goal);
    const reverseCacheKey = this.getPathCacheKey(state, goal, start);

    if (path) {
      this.pathCache.set(cacheKey, path);
      this.pathCache.set(reverseCacheKey, [...path].reverse());
    } else {
      this.pathCache.set(cacheKey, null);
      this.pathCache.set(reverseCacheKey, null);
    }

    return path;
  }

  runIDAStar(state, start, goal) {
    const maxDepth = state.map.grid_size_x * state.map.grid_size_y;
    let bound = this.manhattanDistance(start, goal);
    const startKey = this.positionKey(start);

    while (bound <= maxDepth) {
      const path = [{ x: start.x, y: start.y }];
      const pathSet = new Set([startKey]);
      const bestDepthByNode = new Map([[startKey, 0]]);
      const result = this.depthLimitedSearch(state, goal, path, pathSet, 0, bound, bestDepthByNode);

      if (result === SEARCH_FOUND) {
        return path;
      }

      if (!Number.isFinite(result)) {
        return null;
      }

      bound = result;
    }

    return null;
  }

  depthLimitedSearch(state, goal, path, pathSet, costSoFar, bound, bestDepthByNode) {
    const current = path[path.length - 1];
    const estimate = costSoFar + this.manhattanDistance(current, goal);

    if (estimate > bound) {
      return estimate;
    }

    if (samePosition(current, goal)) {
      return SEARCH_FOUND;
    }

    let nextBound = Infinity;
    const neighbors = this.getMoveCandidates(current)
      .filter((candidate) => this.canMoveTo(state, candidate.position))
      .sort((a, b) => {
        const distanceDiff = this.manhattanDistance(a.position, goal) - this.manhattanDistance(b.position, goal);

        if (distanceDiff !== 0) {
          return distanceDiff;
        }

        return this.getActionPriority(a.action) - this.getActionPriority(b.action);
      });

    for (const neighbor of neighbors) {
      const neighborKey = this.positionKey(neighbor.position);
      const nextCost = costSoFar + 1;
      const bestSeenDepth = bestDepthByNode.get(neighborKey);

      if (pathSet.has(neighborKey)) {
        continue;
      }

      if (bestSeenDepth !== undefined && bestSeenDepth <= nextCost) {
        continue;
      }

      bestDepthByNode.set(neighborKey, nextCost);
      path.push(neighbor.position);
      pathSet.add(neighborKey);

      const result = this.depthLimitedSearch(state, goal, path, pathSet, nextCost, bound, bestDepthByNode);

      if (result === SEARCH_FOUND) {
        return SEARCH_FOUND;
      }

      if (result < nextBound) {
        nextBound = result;
      }

      path.pop();
      pathSet.delete(neighborKey);
    }

    return nextBound;
  }

  getMoveCandidates(position) {
    return [
      { action: ACTIONS.UP, position: { x: position.x, y: position.y - 1 } },
      { action: ACTIONS.DOWN, position: { x: position.x, y: position.y + 1 } },
      { action: ACTIONS.LEFT, position: { x: position.x - 1, y: position.y } },
      { action: ACTIONS.RIGHT, position: { x: position.x + 1, y: position.y } },
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

  getActionPriority(action) {
    switch (action) {
      case ACTIONS.UP:
        return 0;
      case ACTIONS.RIGHT:
        return 1;
      case ACTIONS.DOWN:
        return 2;
      case ACTIONS.LEFT:
        return 3;
      default:
        return 4;
    }
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

  getPathCacheKey(state, start, goal) {
    return `${this.getStaticMapKey(state)}|${this.positionKey(start)}>${this.positionKey(goal)}`;
  }

  getStaticMapKey(state) {
    const { map } = state;
    const obstacleSignature = [...map.obstaclePositions]
      .sort((a, b) => (a.y - b.y) || (a.x - b.x))
      .map((position) => this.positionKey(position))
      .join(",");

    return `${map.grid_size_x}x${map.grid_size_y}|${obstacleSignature}`;
  }

  positionKey(position) {
    return `${position.x},${position.y}`;
  }

  manhattanDistance(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }
}

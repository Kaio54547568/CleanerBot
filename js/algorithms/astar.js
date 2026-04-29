import { ACTIONS } from "../models.js";
import { samePosition } from "../environment.js";
import { BaseAlgorithm } from "./baseAlgorithm.js";

// A*: f(n) = g(n) + h(n)
export class AStarAlgorithm extends BaseAlgorithm {
  constructor() {
    super();
    this.name = "A*";
    this.reset();
  }

  reset() {
    super.reset();
    // pathCache luu tru tat ca cac con duong ma robot da tung tinh toan thanh cong, tuc la no tinh quang duong AB
    // thanh cong roi thi sau neu can di AB tiep, khong can tinh toan lai ma chi can lay tu cache ra su dung
    this.pathCache = new Map();

    // day la doan duong ma robot dang di luc nay
    this.cachedRoute = null;

    // day la dich den hien tai, gia su neu dich den la cuc rac thi robot se chon thuong la cuc gan nhat va con du pin
    // vi du dich den la thung rac khi robot da day rac
    this.cachedTargetKey = null;

    // dung de nhan dien xem map co bi thay doi hay khong (gia su nhu ta them vat can =)) )
    this.cachedMapKey = null;
  }

  nextAction(state) {
    const { robot, map } = state;

    if (this.isAtTrashCan(state) && robot.capacity > 0) {
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

      return this.getChargingAction(state);
    }

    let target = this.chooseWorkTarget(state);

    if (
      target &&
      !samePosition(target, map.chargingStation) &&
      !this.hasEnoughBatteryForTarget(state, target)
    ) {
      target = this.canFullBatteryHandleTarget(state, target)
        ? map.chargingStation
        : null;
    }

    if (!target) {
      return this.getChargingAction(state);
    }

    if (samePosition(robot, target)) {
      this.clearRoute();
      return this.getActionAtTarget(state, target);
    }

    if (this.getBatteryLoss(state) > robot.battery && !this.isAtChargingStation(state)) {
      this.clearRoute();
      return ACTIONS.STAY;
    }

    const route = this.getRouteToTarget(state, target);

    if (!route || route.length < 2) {
      this.clearRoute();
      return samePosition(target, map.chargingStation) ? ACTIONS.STAY : this.getChargingAction(state);
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
      const trashTarget = this.findReachableTarget(state, map.trashPositions);

      if (trashTarget) {
        return trashTarget;
      }

      return robot.capacity > 0
        ? this.findReachableTarget(state, [map.trashCan])
        : null;
    }

    return null;
  }

  findReachableTarget(state, positions) {
    let bestTarget = null;
    let bestRouteLength = Infinity;

    for (const position of positions) {
      if (!this.canFullBatteryHandleTarget(state, position)) {
        continue;
      }

      const path = this.findPath(state, state.robot, position);

      if (!path || path.length === 0) {
        continue;
      }

      if (path.length < bestRouteLength) {
        bestTarget = position;
        bestRouteLength = path.length;
      }
    }

    return bestTarget;
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

    if (robot.battery >= this.getMaxBattery(state)) {
      return false;
    }

    const workTarget = this.chooseWorkTarget(state);

    return workTarget ? !this.hasEnoughBatteryForTarget(state, workTarget) : false;
  }

  getChargingAction(state) {
    const { robot, map } = state;

    if (this.isAtChargingStation(state)) {
      return robot.battery < this.getMaxBattery(state)
        ? ACTIONS.CHARGE
        : ACTIONS.STAY;
    }

    const route = this.getRouteToTarget(state, map.chargingStation);

    if (!route || route.length < 2) {
      this.clearRoute();
      return ACTIONS.STAY;
    }

    const requiredBattery = this.getPathMoveCost(state, route);

    if (requiredBattery > robot.battery) {
      this.clearRoute();
      return ACTIONS.STAY;
    }

    return this.getActionForRouteStep(route[0], route[1]);
  }

  hasEnoughBatteryForTarget(state, target) {
    const { robot } = state;
    const requiredBattery = this.getRequiredBatteryForTarget(state, robot, target);
    return requiredBattery !== Infinity && robot.battery >= requiredBattery;
  }

  canFullBatteryHandleTarget(state, target) {
    const requiredBattery = this.getRequiredBatteryForTarget(
      state,
      state.map.chargingStation,
      target
    );

    return requiredBattery !== Infinity && this.getMaxBattery(state) >= requiredBattery;
  }

  getRequiredBatteryForTarget(state, fromPosition, target) {
    const { robot, map } = state;
    const actionCost = this.getActionCost(state);
    const pathToTarget = this.findPath(state, fromPosition, target);

    if (!pathToTarget) {
      return Infinity;
    }

    let requiredBattery = this.getPathMoveCost(state, pathToTarget);

    if (samePosition(target, map.chargingStation)) {
      return requiredBattery;
    }

    if (samePosition(target, map.trashCan) && robot.capacity > 0) {
      const pathToCharge = this.findPath(state, target, map.chargingStation);

      if (!pathToCharge) {
        return Infinity;
      }

      return requiredBattery + actionCost + this.getPathMoveCost(state, pathToCharge);
    }

    if (
      map.trashPositions.some((trash) => samePosition(trash, target)) &&
      robot.capacity < robot.maxCapacity
    ) {
      requiredBattery += actionCost;

      const willBeFull = robot.capacity + 1 >= robot.maxCapacity;
      const safeExitTarget = willBeFull ? map.trashCan : map.chargingStation;
      const safeExitPath = this.findPath(state, target, safeExitTarget);

      if (!safeExitPath) {
        return Infinity;
      }

      requiredBattery += this.getPathMoveCost(state, safeExitPath);

      if (willBeFull) {
        const trashCanToChargePath = this.findPath(state, map.trashCan, map.chargingStation);

        if (!trashCanToChargePath) {
          return Infinity;
        }

        requiredBattery += actionCost;
        requiredBattery += this.getPathMoveCost(state, trashCanToChargePath);
      }

      return requiredBattery;
    }

    const pathToCharge = this.findPath(state, target, map.chargingStation);

    if (!pathToCharge) {
      return Infinity;
    }

    return requiredBattery + this.getPathMoveCost(state, pathToCharge);
  }

  getPathMoveCost(state, path) {
    return Math.max(0, path.length - 1) * this.getBatteryLoss(state);
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

    if (
      this.cachedTargetKey !== this.positionKey(target) ||
      this.cachedMapKey !== this.getStaticMapKey(state)
    ) {
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

  findPath(state, start, goal) {
    if (samePosition(start, goal)) {
      return [{ x: start.x, y: start.y }];
    }

    const cacheKey = this.getPathCacheKey(state, start, goal);

    if (this.pathCache.has(cacheKey)) {
      return this.pathCache.get(cacheKey);
    }

    const path = this.runAStar(state, start, goal);
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

  runAStar(state, start, goal) {
    if (!this.canMoveTo(state, goal)) {
      return null;
    }

    const openSet = [{ x: start.x, y: start.y }];
    const openKeys = new Set([this.positionKey(start)]);
    const closedKeys = new Set();
    const cameFrom = new Map();
    const nodeByKey = new Map([[this.positionKey(start), { x: start.x, y: start.y }]]);
    const gScore = new Map([[this.positionKey(start), 0]]);
    const fScore = new Map([[this.positionKey(start), this.manhattanDistance(start, goal)]]);

    while (openSet.length > 0) {
      const currentIndex = this.findLowestScoreIndex(openSet, goal, gScore, fScore);
      const current = openSet.splice(currentIndex, 1)[0];
      const currentKey = this.positionKey(current);
      openKeys.delete(currentKey);

      if (samePosition(current, goal)) {
        return this.reconstructPath(cameFrom, nodeByKey, currentKey);
      }

      closedKeys.add(currentKey);

      for (const neighbor of this.getSortedMoveCandidates(current, goal)) {
        if (!this.canMoveTo(state, neighbor.position)) {
          continue;
        }

        const neighborKey = this.positionKey(neighbor.position);

        if (closedKeys.has(neighborKey)) {
          continue;
        }

        const tentativeGScore = gScore.get(currentKey) + 1;

        if (tentativeGScore >= (gScore.get(neighborKey) ?? Infinity)) {
          continue;
        }

        cameFrom.set(neighborKey, currentKey);
        nodeByKey.set(neighborKey, neighbor.position);
        gScore.set(neighborKey, tentativeGScore);
        fScore.set(
          neighborKey,
          tentativeGScore + this.manhattanDistance(neighbor.position, goal)
        );

        if (!openKeys.has(neighborKey)) {
          openKeys.add(neighborKey);
          openSet.push(neighbor.position);
        }
      }
    }

    return null;
  }

  reconstructPath(cameFrom, nodeByKey, currentKey) {
    const path = [nodeByKey.get(currentKey)];
    let nextKey = currentKey;

    while (cameFrom.has(nextKey)) {
      nextKey = cameFrom.get(nextKey);
      path.unshift(nodeByKey.get(nextKey));
    }

    return path;
  }

  findLowestScoreIndex(openSet, goal, gScore, fScore) {
    let bestIndex = 0;

    for (let index = 1; index < openSet.length; index += 1) {
      const candidate = openSet[index];
      const best = openSet[bestIndex];
      const candidateKey = this.positionKey(candidate);
      const bestKey = this.positionKey(best);
      const scoreDiff = (fScore.get(candidateKey) ?? Infinity) - (fScore.get(bestKey) ?? Infinity);

      if (scoreDiff < 0) {
        bestIndex = index;
        continue;
      }

      if (scoreDiff > 0) {
        continue;
      }

      const heuristicDiff = this.manhattanDistance(candidate, goal) - this.manhattanDistance(best, goal);

      if (heuristicDiff < 0) {
        bestIndex = index;
        continue;
      }

      if (heuristicDiff > 0) {
        continue;
      }

      const costDiff = (gScore.get(candidateKey) ?? Infinity) - (gScore.get(bestKey) ?? Infinity);

      if (costDiff < 0) {
        bestIndex = index;
      }
    }

    return bestIndex;
  }

  getSortedMoveCandidates(position, goal) {
    return this.getMoveCandidates(position).sort((a, b) => {
      const distanceDiff = this.manhattanDistance(a.position, goal) - this.manhattanDistance(b.position, goal);

      if (distanceDiff !== 0) {
        return distanceDiff;
      }

      return this.getActionPriority(a.action) - this.getActionPriority(b.action);
    });
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
}

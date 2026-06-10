import { ACTIONS } from "../models.js";
import { samePosition } from "../environment.js";
import { BaseAlgorithm } from "./baseAlgorithm.js";

const VISIT_PENALTY = 3;
const BACKTRACK_PENALTY = 10;
const EPSILON = 1e-9;

export class GreedyAlgorithm extends BaseAlgorithm {
  constructor() {
    super();
    this.name = "Greedy";
    this.reset();
  }

  reset() {
    super.reset();
    this.visitCounts = new Map();
    this.currentPosition = null;
    this.previousPosition = null;
    this.setHeuristicDescription(
      `Greedy score = Manhattan distance + visits * ${VISIT_PENALTY} + backtrack penalty ${BACKTRACK_PENALTY}.`
    );
  }

  computeNextAction(state) {
    const { robot, map } = state;
    this.rememberPosition(robot);
    this.recordNodeVisit({ position: state.robot });
    this.recordMemoryUsage(1);
    this.setCurrentTarget(null);

    if (this.isAtTrashCan(state) && robot.capacity > 0) {
      this.setCurrentTarget(map.trashCan);
      return this.hasEnoughBatteryForTarget(state, map.trashCan)
        ? ACTIONS.LET_TRASH_OUT
        : this.getChargingAction(state);
    }

    if (this.isAtChargingStation(state) && this.shouldCharge(state)) {
      this.setCurrentTarget(map.chargingStation);
      return ACTIONS.CHARGE;
    }

    if (this.hasTrashAtRobot(state) && robot.capacity < robot.maxCapacity) {
      this.setCurrentTarget(robot);
      return this.hasEnoughBatteryForTarget(state, robot)
        ? ACTIONS.SUCK_TRASH
        : this.getChargingAction(state);
    }

    let target = this.chooseWorkTarget(state);

    if (
      target &&
      !samePosition(target, map.chargingStation) &&
      !this.hasEnoughBatteryForTarget(state, target) &&
      this.canFullBatteryHandleTarget(state, target)
    ) {
      target = map.chargingStation;
    }

    this.setCurrentTarget(target);

    if (
      target &&
      !samePosition(target, map.chargingStation) &&
      !this.hasEnoughBatteryForTarget(state, target)
    ) {
      return this.getChargingAction(state);
    }

    if (!target) {
      return this.getChargingAction(state);
    }

    this.setCurrentTarget(target);

    if (samePosition(robot, target)) {
      return this.getActionAtTarget(state, target);
    }

    if (this.getBatteryLoss(state) > robot.battery && !this.isAtChargingStation(state)) {
      return ACTIONS.STAY;
    }

    return this.chooseMoveTowardTarget(state, target);
  }

  getChargingAction(state) {
    const { robot, map } = state;
    this.setCurrentTarget(map.chargingStation);

    if (this.isAtChargingStation(state)) {
      return robot.battery < this.getMaxBattery(state)
        ? ACTIONS.CHARGE
        : ACTIONS.STAY;
    }

    if (
      this.hasEnoughBatteryForTrip(
        state,
        robot,
        map.chargingStation,
        robot.battery
      )
    ) {
      return this.chooseMoveTowardTarget(state, map.chargingStation);
    }

    return ACTIONS.STAY;
  }

  chooseWorkTarget(state) {
    const { robot, map } = state;

    if (robot.capacity >= robot.maxCapacity || (map.trashPositions.length === 0 && robot.capacity > 0)) {
      return this.canFullBatteryHandleTarget(state, map.trashCan)
        ? map.trashCan
        : null;
    }

    if (map.trashPositions.length > 0) {
      const manageableTrashPositions = map.trashPositions.filter((trash) =>
        this.canFullBatteryHandleTarget(state, trash)
      );

      return this.findNearestPosition(robot, manageableTrashPositions);
    }

    return null;
  }

  getActionAtTarget(state, target) {
    const { robot, map } = state;

    if (samePosition(target, map.chargingStation) && robot.battery < this.getMaxBattery(state)) {
      return ACTIONS.CHARGE;
    }

    if (
      samePosition(target, map.trashCan) &&
      robot.capacity > 0 &&
      this.hasEnoughBatteryForTarget(state, target)
    ) {
      return ACTIONS.LET_TRASH_OUT;
    }

    if (
      this.hasTrashAtRobot(state) &&
      robot.capacity < robot.maxCapacity &&
      this.hasEnoughBatteryForTarget(state, target)
    ) {
      return ACTIONS.SUCK_TRASH;
    }

    return ACTIONS.STAY;
  }

  chooseMoveTowardTarget(state, target) {
    if (samePosition(target, state.map.chargingStation)) {
      return this.chooseShortestPathMoveToTarget(state, target);
    }

    const candidates = this.getMoveCandidates(state.robot)
      .filter((candidate) => this.canMoveTo(state, candidate.position))
      .filter((candidate) =>
        this.canMoveAndKeepChargingReserve(state, candidate.position)
      )
      .map((candidate, index) => {
        const distance = this.manhattanDistance(candidate.position, target);
        const visits = this.getVisitCount(candidate.position);
        const backtrackPenalty =
          this.previousPosition &&
          samePosition(candidate.position, this.previousPosition) &&
          !samePosition(candidate.position, target)
            ? BACKTRACK_PENALTY
            : 0;

        return {
          ...candidate,
          index,
          distance,
          visits,
          score: distance + visits * VISIT_PENALTY + backtrackPenalty,
        };
      });

    if (candidates.length === 0) {
      return ACTIONS.STAY;
    }

    candidates.sort((a, b) => {
      return (
        a.score - b.score ||
        a.distance - b.distance ||
        a.visits - b.visits ||
        a.index - b.index
      );
    });

    return candidates[0].action;
  }

  chooseShortestPathMoveToTarget(state, target) {
    const path = this.findShortestPath(state, state.robot, target);

    if (!path || path.length < 2) {
      return ACTIONS.STAY;
    }

    if (!this.canMoveAndKeepChargingReserve(state, path[1])) {
      return ACTIONS.STAY;
    }

    return this.getActionForStep(path[0], path[1]);
  }

  getActionForStep(fromPosition, toPosition) {
    if (toPosition.x === fromPosition.x && toPosition.y === fromPosition.y - 1) {
      return ACTIONS.UP;
    }

    if (toPosition.x === fromPosition.x && toPosition.y === fromPosition.y + 1) {
      return ACTIONS.DOWN;
    }

    if (toPosition.x === fromPosition.x - 1 && toPosition.y === fromPosition.y) {
      return ACTIONS.LEFT;
    }

    if (toPosition.x === fromPosition.x + 1 && toPosition.y === fromPosition.y) {
      return ACTIONS.RIGHT;
    }

    return ACTIONS.STAY;
  }

  canMoveAndKeepChargingReserve(state, nextPosition) {
    const { robot, map } = state;
    const batteryLoss = this.getBatteryLoss(state);

    if (robot.battery + EPSILON < batteryLoss) {
      return false;
    }

    const batteryAfterMove = robot.battery - batteryLoss;

    if (samePosition(nextPosition, map.chargingStation)) {
      return batteryAfterMove + EPSILON >= 0;
    }

    const distanceToChargingStation = this.getShortestPathDistance(
      state,
      nextPosition,
      map.chargingStation
    );

    if (!Number.isFinite(distanceToChargingStation)) {
      return false;
    }

    return (
      batteryAfterMove + EPSILON >=
      distanceToChargingStation * batteryLoss
    );
  }

  rememberPosition(position) {
    if (this.currentPosition && samePosition(this.currentPosition, position)) {
      return;
    }

    this.previousPosition = this.currentPosition
      ? { ...this.currentPosition }
      : null;
    this.currentPosition = { x: position.x, y: position.y };
    const key = this.positionKey(position);
    this.visitCounts.set(key, this.getVisitCount(position) + 1);
  }

  getVisitCount(position) {
    return this.visitCounts.get(this.positionKey(position)) ?? 0;
  }

  positionKey(position) {
    return `${position.x},${position.y}`;
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
    const { robot } = state;
    return this.hasEnoughBatteryForTrip(state, robot, target, robot.battery);
  }

  canFullBatteryHandleTarget(state, target) {
    const { map } = state;
    return this.hasEnoughBatteryForTrip(
      state,
      map.chargingStation,
      target,
      this.getMaxBattery(state)
    );
  }

  hasEnoughBatteryForTrip(state, fromPosition, target, battery) {
    return battery >= this.getRequiredBatteryForTarget(state, fromPosition, target);
  }

  getRequiredBatteryForTarget(state, fromPosition, target) {
    const { robot, map } = state;
    const batteryLoss = this.getBatteryLoss(state);
    const actionCost = this.getActionCost(state);
    const distanceToTarget = this.getShortestPathDistance(state, fromPosition, target);

    if (!Number.isFinite(distanceToTarget)) {
      return Number.POSITIVE_INFINITY;
    }

    let requiredBattery = distanceToTarget * batteryLoss;

    if (samePosition(target, map.chargingStation)) {
      return requiredBattery;
    }

    if (samePosition(target, map.trashCan) && robot.capacity > 0) {
      const distanceToChargingStation = this.getShortestPathDistance(
        state,
        target,
        map.chargingStation
      );

      if (!Number.isFinite(distanceToChargingStation)) {
        return Number.POSITIVE_INFINITY;
      }

      requiredBattery += actionCost;
      requiredBattery += distanceToChargingStation * batteryLoss;
      return requiredBattery;
    }

    if (
      map.trashPositions.some((trash) => samePosition(trash, target)) &&
      robot.capacity < robot.maxCapacity
    ) {
      requiredBattery += actionCost;

      const willBeFull = robot.capacity + 1 >= robot.maxCapacity;

      if (willBeFull) {
        const distanceToTrashCan = this.getShortestPathDistance(
          state,
          target,
          map.trashCan
        );
        const distanceTrashCanToChargingStation = this.getShortestPathDistance(
          state,
          map.trashCan,
          map.chargingStation
        );

        if (
          !Number.isFinite(distanceToTrashCan) ||
          !Number.isFinite(distanceTrashCanToChargingStation)
        ) {
          return Number.POSITIVE_INFINITY;
        }

        requiredBattery += distanceToTrashCan * batteryLoss;
        requiredBattery += actionCost;
        requiredBattery += distanceTrashCanToChargingStation * batteryLoss;
      } else {
        const distanceToChargingStation = this.getShortestPathDistance(
          state,
          target,
          map.chargingStation
        );

        if (!Number.isFinite(distanceToChargingStation)) {
          return Number.POSITIVE_INFINITY;
        }

        requiredBattery += distanceToChargingStation * batteryLoss;
      }

      return requiredBattery;
    }

    const distanceToChargingStation = this.getShortestPathDistance(
      state,
      target,
      map.chargingStation
    );

    if (!Number.isFinite(distanceToChargingStation)) {
      return Number.POSITIVE_INFINITY;
    }

    requiredBattery += distanceToChargingStation * batteryLoss;
    return requiredBattery;
  }

  getShortestPathDistance(state, fromPosition, target) {
    const path = this.findShortestPath(state, fromPosition, target);

    if (!path) {
      return Number.POSITIVE_INFINITY;
    }

    return Math.max(0, path.length - 1);
  }

  findShortestPath(state, fromPosition, target) {
    if (!fromPosition || !target) {
      return null;
    }

    if (samePosition(fromPosition, target)) {
      return [{ x: fromPosition.x, y: fromPosition.y }];
    }

    const start = { x: fromPosition.x, y: fromPosition.y };
    const queue = [{ position: start, path: [start] }];
    const visited = new Set([this.positionKey(start)]);

    while (queue.length > 0) {
      const currentNode = queue.shift();

      for (const candidate of this.getMoveCandidates(currentNode.position)) {
        const key = this.positionKey(candidate.position);

        if (visited.has(key) || !this.canMoveTo(state, candidate.position)) {
          continue;
        }

        const nextPath = [...currentNode.path, candidate.position];

        if (samePosition(candidate.position, target)) {
          return nextPath;
        }

        visited.add(key);
        queue.push({
          position: candidate.position,
          path: nextPath,
        });
      }
    }

    return null;
  }
}

import { ACTIONS } from "../models.js";
import { samePosition } from "../environment.js";

const DEFAULT_MAX_BATTERY = 100;
const DEFAULT_BATTERY_LOSS = 1;
const DEFAULT_ACTION_COST = 1;

export class BaseAlgorithm {
  constructor() {
    this.name = "BaseAlgorithm";
    this.resetMetrics();
  }

  reset() {
    this.resetMetrics();
  }

  nextAction(state) {
    // Accumulate runtime across all decision steps of the current run.
    const startedAt = getNow();
    const action = this.computeNextAction(state);
    this.metrics.runtimeMs += getNow() - startedAt;
    return action ?? ACTIONS.STAY;
  }

  computeNextAction() {
    return ACTIONS.STAY;
  }

  resetMetrics() {
    this.metrics = {
      runtimeMs: 0,
      visitedNodes: 0,
      peakMemory: 0,
      batteryConsumed: 0,
      trace: [],
      heuristicDescription: `${this.name} does not use heuristic.`,
    };
  }

  getMetrics() {
    return cloneMetrics(this.metrics);
  }

  getMetricsSnapshot() {
    return this.getMetrics();
  }

  restoreMetrics(snapshot) {
    this.metrics = snapshot ? cloneMetrics(snapshot) : {
      runtimeMs: 0,
      visitedNodes: 0,
      peakMemory: 0,
      batteryConsumed: 0,
      trace: [],
      heuristicDescription: `${this.name} does not use heuristic.`,
    };
  }

  setHeuristicDescription(description) {
    this.metrics.heuristicDescription = description;
  }

  recordNodeVisit({ position, goal = null, g = null, h = null, note = null }) {
    if (!position) {
      return;
    }

    const hasCost = Number.isFinite(g);
    const hasHeuristic = Number.isFinite(h);

    // Store raw g/h/f values so the UI can render the traversal trace and formulas.
    this.metrics.visitedNodes += 1;
    this.metrics.trace.push({
      order: this.metrics.trace.length + 1,
      position: { x: position.x, y: position.y },
      label: this.formatCoordinateLabel(position),
      goal: goal ? { x: goal.x, y: goal.y, label: this.formatCoordinateLabel(goal) } : null,
      g: hasCost ? g : null,
      h: hasHeuristic ? h : null,
      f: hasCost && hasHeuristic ? g + h : null,
      note,
    });
  }

  recordMemoryUsage(nodeCount) {
    if (!Number.isFinite(nodeCount)) {
      return;
    }

    this.metrics.peakMemory = Math.max(this.metrics.peakMemory, Math.max(0, Math.floor(nodeCount)));
  }

  addBatteryConsumed(amount) {
    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }

    this.metrics.batteryConsumed += amount;
  }

  formatCoordinateLabel(position) {
    return `${this.getColumnLabel(position.x)}${position.y + 1}`;
  }

  getColumnLabel(index) {
    let current = index;
    let label = "";

    do {
      label = String.fromCharCode(65 + (current % 26)) + label;
      current = Math.floor(current / 26) - 1;
    } while (current >= 0);

    return label;
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

function getNow() {
  if (typeof globalThis.performance?.now === "function") {
    return globalThis.performance.now();
  }

  return Date.now();
}

function cloneMetrics(metrics) {
  return JSON.parse(JSON.stringify(metrics));
}

import { ACTIONS } from "../models.js";
import { samePosition } from "../environment.js";

const DEFAULT_MAX_BATTERY = 100;
const DEFAULT_BATTERY_LOSS = 1;
const DEFAULT_ACTION_COST = 1;
const DEFAULT_TRACE_LIMIT = 1000;

export class BaseAlgorithm {
  constructor() {
    this.name = "BaseAlgorithm";
    this.currentTarget = null;
    this.resetMetrics();
  }

  reset() {
    this.resetMetrics();
    this.clearCurrentTarget();
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
    this.metrics = createEmptyMetrics(this.name);
  }

  setCurrentTarget(target) {
    this.currentTarget = target ? { x: target.x, y: target.y } : null;
  }

  clearCurrentTarget() {
    this.currentTarget = null;
  }

  getCurrentTarget() {
    return this.currentTarget ? { ...this.currentTarget } : null;
  }

  getMetrics() {
    return {
      ...this.getMetricSummary(),
      trace: this.getTraceSlice(),
    };
  }

  getMetricsSnapshot() {
    return cloneMetrics(this.metrics);
  }

  restoreMetrics(snapshot) {
    this.metrics = snapshot
      ? normalizeMetrics(snapshot, this.name)
      : createEmptyMetrics(this.name);
  }

  getMetricSummary() {
    const traceLength = this.metrics.trace.length;

    return {
      runtimeMs: this.metrics.runtimeMs,
      visitedNodes: this.metrics.visitedNodes,
      peakMemory: this.metrics.peakMemory,
      batteryConsumed: this.metrics.batteryConsumed,
      heuristicDescription: this.metrics.heuristicDescription,
      traceLength,
      traceLimit: this.metrics.traceLimit,
      traceDropped: Math.max(0, this.metrics.visitedNodes - traceLength),
    };
  }

  getTraceSlice(limit = this.metrics.traceLimit) {
    const orderedTrace = this.getOrderedTrace();
    const safeLimit = clampTraceLimit(limit, this.metrics.traceLimit);
    const startIndex = Math.max(0, orderedTrace.length - safeLimit);
    return cloneTraceEntries(orderedTrace.slice(startIndex));
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

    // Keep only a bounded trace window while visitedNodes remains exact.
    this.metrics.visitedNodes += 1;

    const entry = {
      order: this.metrics.visitedNodes,
      position: { x: position.x, y: position.y },
      label: this.formatCoordinateLabel(position),
      goal: goal ? { x: goal.x, y: goal.y, label: this.formatCoordinateLabel(goal) } : null,
      g: hasCost ? g : null,
      h: hasHeuristic ? h : null,
      f: hasCost && hasHeuristic ? g + h : null,
      note,
    };

    this.storeTraceEntry(entry);
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

  storeTraceEntry(entry) {
    const limit = this.metrics.traceLimit;

    if (limit <= 0) {
      return;
    }

    if (this.metrics.trace.length < limit) {
      this.metrics.trace.push(entry);
      return;
    }

    this.metrics.trace[this.metrics.traceWriteIndex] = entry;
    this.metrics.traceWriteIndex =
      (this.metrics.traceWriteIndex + 1) % limit;
  }

  getOrderedTrace() {
    const { trace, traceLimit, traceWriteIndex } = this.metrics;

    if (trace.length < traceLimit || traceWriteIndex === 0) {
      return trace;
    }

    return [
      ...trace.slice(traceWriteIndex),
      ...trace.slice(0, traceWriteIndex),
    ];
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

function createEmptyMetrics(name) {
  return {
    runtimeMs: 0,
    visitedNodes: 0,
    peakMemory: 0,
    batteryConsumed: 0,
    trace: [],
    traceLimit: DEFAULT_TRACE_LIMIT,
    traceWriteIndex: 0,
    heuristicDescription: `${name} does not use heuristic.`,
  };
}

function normalizeMetrics(metrics, name) {
  const normalized = {
    ...createEmptyMetrics(name),
    ...cloneMetrics(metrics),
  };

  normalized.traceLimit = clampTraceLimit(
    normalized.traceLimit,
    DEFAULT_TRACE_LIMIT
  );

  if (normalized.traceLimit <= 0) {
    normalized.trace = [];
    normalized.traceWriteIndex = 0;
    return normalized;
  }

  normalized.trace = Array.isArray(normalized.trace)
    ? normalized.trace.slice(-normalized.traceLimit)
    : [];
  normalized.traceWriteIndex = Number.isInteger(normalized.traceWriteIndex)
    ? normalized.traceWriteIndex
    : 0;

  if (normalized.trace.length < normalized.traceLimit) {
    normalized.traceWriteIndex = 0;
  } else {
    normalized.traceWriteIndex %= normalized.traceLimit;
  }

  return normalized;
}

function clampTraceLimit(value, fallback) {
  const numericValue = Number.parseInt(value, 10);

  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.min(fallback, Math.max(0, numericValue));
}

function cloneTraceEntries(entries) {
  return entries.map((entry) => ({
    ...entry,
    position: entry.position ? { ...entry.position } : null,
    goal: entry.goal ? { ...entry.goal } : null,
  }));
}

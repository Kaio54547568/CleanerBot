const MAX_POSITION_HISTORY_ENTRIES = 1000;

export class Simulator {
  constructor({ environment, algorithm, onStateChange, tickMs = 400 }) {
    this.environment = environment;
    this.algorithm = algorithm;
    this.onStateChange = onStateChange;
    this.baseTickMs = tickMs;
    this.tickMs = tickMs;
    this.speedMultiplier = 1;
    this.intervalId = null;
    this.cachedNextAction = undefined;
    this.previousStepSnapshots = [];
    this.positionHistory = [];
    this.positionHistoryTotal = 0;
    this.resetPositionHistory(this.environment.getState());
  }

  setAlgorithm(algorithm) {
    this.stop();
    this.algorithm = algorithm;
    this.algorithm.reset();
    this.clearNextActionCache();
    this.clearHistory();
    this.resetPositionHistory(this.environment.getState());
  }

  generate(config) {
    this.stop();
    this.algorithm.reset();
    this.clearNextActionCache();
    this.clearHistory();
    const state = this.environment.generate(config);
    this.resetPositionHistory(state);
    this.onStateChange(state);
  }

  loadState(state) {
    this.stop();
    this.algorithm.reset();
    this.clearNextActionCache();
    this.clearHistory();
    const loadedState = this.environment.loadState(state);
    this.resetPositionHistory(loadedState, null);
    this.onStateChange(loadedState);
    return loadedState;
  }

  updateConfig(config) {
    this.stop();
    this.algorithm.reset();
    this.clearNextActionCache();
    this.clearHistory();
    const state = this.environment.updateConfig(config);
    this.resetPositionHistory(state);
    this.onStateChange(state);
  }

  reset() {
    this.stop();
    this.algorithm.reset();
    this.clearNextActionCache();
    this.clearHistory();
    const state = this.environment.reset();
    this.resetPositionHistory(state);
    this.onStateChange(state);
  }

  step() {
    const previousState = this.environment.getState();
    const action = this.peekNextAction();
    const previousStepSnapshot = this.createStepSnapshot(previousState);
    this.clearNextActionCache();
    this.previousStepSnapshots.push(previousStepSnapshot);
    const nextState = this.environment.applyAction(action);
    // Battery usage is derived from the real state transition, not estimated by the algorithm.
    this.algorithm.addBatteryConsumed(
      Math.max(0, previousState.robot.battery - nextState.robot.battery)
    );
    this.positionHistory.push(this.createPositionHistoryEntry(nextState));
    this.positionHistoryTotal += 1;
    this.trimPositionHistory();

    if (nextState.map.done) {
      this.stop();
    }

    this.onStateChange(nextState);
  }

  previousStep() {
    const snapshot = this.previousStepSnapshots.pop();

    if (!snapshot) {
      return;
    }

    this.stop();
    this.restoreAlgorithmSnapshot(snapshot.algorithm);
    this.cachedNextAction = snapshot.cachedNextAction;
    this.positionHistory = snapshot.positionHistory.map((entry) => ({ ...entry }));
    this.positionHistoryTotal = snapshot.positionHistoryTotal;
    const restoredState = this.environment.restoreState(snapshot.state);
    this.onStateChange(restoredState);
  }

  peekNextAction() {
    if (this.cachedNextAction === undefined) {
      const state = this.environment.getState();
      this.cachedNextAction = this.algorithm.nextAction(state);
    }

    return this.cachedNextAction;
  }

  clearNextActionCache() {
    this.cachedNextAction = undefined;
  }

  clearHistory() {
    this.previousStepSnapshots = [];
  }

  canStepBack() {
    return this.previousStepSnapshots.length > 0;
  }

  resetPositionHistory(state, action = state.latestAction) {
    this.positionHistory = [
      this.createPositionHistoryEntry({
        ...state,
        latestAction: action,
      }),
    ];
    this.positionHistoryTotal = this.positionHistory.length;
  }

  createPositionHistoryEntry(state) {
    const { robot } = state;

    return {
      step: state.steps,
      action: state.latestAction,
      x: robot.x,
      y: robot.y,
      battery: robot.battery,
      capacity: robot.capacity,
      maxCapacity: robot.maxCapacity,
    };
  }

  getPositionHistory() {
    return this.getPositionHistorySlice(MAX_POSITION_HISTORY_ENTRIES);
  }

  getPositionHistorySlice(limit = MAX_POSITION_HISTORY_ENTRIES) {
    const safeLimit = clampHistoryLimit(limit, MAX_POSITION_HISTORY_ENTRIES);
    const startIndex = Math.max(0, this.positionHistory.length - safeLimit);

    return this.positionHistory
      .slice(startIndex)
      .map((entry) => ({ ...entry }));
  }

  getPositionHistoryCount() {
    return this.positionHistoryTotal;
  }

  getAlgorithmMetricSummary() {
    return this.algorithm?.getMetricSummary() ?? null;
  }

  getAlgorithmTraceSlice(limit) {
    return this.algorithm?.getTraceSlice(limit) ?? [];
  }

  getAlgorithmMetrics() {
    return this.algorithm?.getMetrics() ?? null;
  }

  getCurrentTarget() {
    return this.algorithm?.getCurrentTarget?.() ?? null;
  }

  getCellScores() {
    return this.algorithm?.getCellScores?.(this.environment.getState()) ?? null;
  }

  setSpeedMultiplier(multiplier) {
    this.speedMultiplier = multiplier;
    this.tickMs = this.baseTickMs / multiplier;

    if (this.isRunning()) {
      this.stop();
      this.run();
    }
  }

  run() {
    if (this.intervalId !== null) {
      return;
    }

    this.intervalId = window.setInterval(() => {
      this.step();
    }, this.tickMs);
  }

  stop() {
    if (this.intervalId === null) {
      return;
    }

    window.clearInterval(this.intervalId);
    this.intervalId = null;
  }

  isRunning() {
    return this.intervalId !== null;
  }

  createStepSnapshot(state) {
    return {
      state,
      algorithm: this.createAlgorithmSnapshot(),
      cachedNextAction: this.cachedNextAction,
      positionHistory: this.positionHistory.map((entry) => ({ ...entry })),
      positionHistoryTotal: this.positionHistoryTotal,
    };
  }

  createAlgorithmSnapshot() {
    if (typeof this.algorithm.getStateSnapshot === "function") {
      return {
        type: "state",
        value: this.algorithm.getStateSnapshot(),
      };
    }

    return {
      type: "metrics",
      value: this.algorithm.getMetricsSnapshot?.() ?? null,
    };
  }

  restoreAlgorithmSnapshot(snapshot) {
    if (snapshot?.type === "state" && typeof this.algorithm.restoreStateSnapshot === "function") {
      this.algorithm.restoreStateSnapshot(snapshot.value);
      return;
    }

    this.algorithm.reset?.();
    this.algorithm.restoreMetrics?.(snapshot?.value ?? null);
  }

  trimPositionHistory() {
    if (this.positionHistory.length <= MAX_POSITION_HISTORY_ENTRIES) {
      return;
    }

    this.positionHistory = this.positionHistory.slice(
      this.positionHistory.length - MAX_POSITION_HISTORY_ENTRIES
    );
  }
}

function clampHistoryLimit(value, fallback) {
  const numericValue = Number.parseInt(value, 10);

  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.min(fallback, Math.max(0, numericValue));
}

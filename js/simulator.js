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
    this.previousStates = [];
    this.previousMetricSnapshots = [];
    this.positionHistory = [];
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
    const previousMetrics = this.algorithm.getMetricsSnapshot();
    this.clearNextActionCache();
    this.previousStates.push(previousState);
    this.previousMetricSnapshots.push(previousMetrics);
    const nextState = this.environment.applyAction(action);
    // Battery usage is derived from the real state transition, not estimated by the algorithm.
    this.algorithm.addBatteryConsumed(
      Math.max(0, previousState.robot.battery - nextState.robot.battery)
    );
    this.positionHistory.push(this.createPositionHistoryEntry(nextState));

    if (nextState.map.done) {
      this.stop();
    }

    this.onStateChange(nextState);
  }

  previousStep() {
    const previousState = this.previousStates.pop();
    const previousMetrics = this.previousMetricSnapshots.pop();

    if (!previousState) {
      return;
    }

    this.stop();
    this.algorithm.reset();
    this.algorithm.restoreMetrics(previousMetrics);
    this.clearNextActionCache();
    const restoredState = this.environment.restoreState(previousState);
    if (this.positionHistory.length > 1) {
      this.positionHistory.pop();
    }
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
    this.previousStates = [];
    this.previousMetricSnapshots = [];
  }

  canStepBack() {
    return this.previousStates.length > 0;
  }

  resetPositionHistory(state, action = state.latestAction) {
    this.positionHistory = [
      this.createPositionHistoryEntry({
        ...state,
        latestAction: action,
      }),
    ];
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
    return this.positionHistory.map((entry) => ({ ...entry }));
  }

  getAlgorithmMetrics() {
    return this.algorithm?.getMetrics() ?? null;
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
}

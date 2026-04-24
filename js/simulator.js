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
  }

  setAlgorithm(algorithm) {
    this.stop();
    this.algorithm = algorithm;
    this.algorithm.reset();
    this.clearNextActionCache();
  }

  generate(config) {
    this.stop();
    this.algorithm.reset();
    this.clearNextActionCache();
    const state = this.environment.generate(config);
    this.onStateChange(state);
  }

  reset() {
    this.stop();
    this.algorithm.reset();
    this.clearNextActionCache();
    const state = this.environment.reset();
    this.onStateChange(state);
  }

  step() {
    const action = this.peekNextAction();
    this.clearNextActionCache();
    const nextState = this.environment.applyAction(action);

    if (nextState.map.done) {
      this.stop();
    }

    this.onStateChange(nextState);
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

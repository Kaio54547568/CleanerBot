import { BaseAlgorithm } from "./baseAlgorithm.js";

export class AStarAlgorithm extends BaseAlgorithm {
  constructor() {
    super();
    this.name = "A*";
  }

  reset() {
    super.reset();
    // TODO: Clear A* open set, closed set, cost map, and parent map here.
  }

  // TODO: Implement real A* later. Current behavior is inherited demo logic.
}

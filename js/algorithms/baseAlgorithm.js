import { ACTIONS } from "../models.js";

export class BaseAlgorithm {
  constructor() {
    this.name = "BaseAlgorithm";
  }

  reset() {
    // Child algorithms can clear their queue, stack, visited set, or heuristic cache here.
  }

  nextAction(state) {
    return ACTIONS.STAY;
  }
}

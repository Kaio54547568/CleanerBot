import { BaseAlgorithm } from "./baseAlgorithm.js";

export class IDSAlgorithm extends BaseAlgorithm {
  constructor() {
    super();
    this.name = "IDS";
  }

  reset() {
    super.reset();
    // TODO: Clear IDS depth limit, frontier, and visited states here.
  }

  // TODO: Implement real IDS later. Current behavior is inherited demo logic.
}

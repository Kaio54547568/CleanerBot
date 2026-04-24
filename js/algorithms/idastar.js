import { BaseAlgorithm } from "./baseAlgorithm.js";

export class IDAStarAlgorithm extends BaseAlgorithm {
  constructor() {
    super();
    this.name = "IDA*";
  }

  reset() {
    super.reset();
    // TODO: Clear IDA* threshold, path, and visited states here.
  }

  // TODO: Implement real IDA* later. Current behavior is inherited demo logic.
}

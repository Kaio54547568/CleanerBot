import { AStarAlgorithm } from "./js/algorithms/astar.js";
import { BFSAlgorithm } from "./js/algorithms/bfs.js";
import { IDAStarAlgorithm } from "./js/algorithms/idastar.js";
import { IDSAlgorithm } from "./js/algorithms/ids.js";
import { Environment } from "./js/environment.js";
import { sampleMapRegistry } from "./js/sampleMaps.js";

const algorithms = [BFSAlgorithm, IDSAlgorithm, AStarAlgorithm, IDAStarAlgorithm];

for (const preset of sampleMapRegistry) {
  console.log(`\n######## ${preset.label} ########`);
  console.log(preset.purpose);

  for (const Algorithm of algorithms) {
    const environment = new Environment();
    environment.loadState(preset.createState());
    const algorithm = new Algorithm();
    const trashOrder = [];
    const targetOrder = [];
    let previousTarget = null;

    for (let decision = 1; decision <= 1000; decision += 1) {
      const before = environment.getState();
      const action = algorithm.nextAction(before);
      const target = algorithm.getCurrentTarget();
      const targetLabel = target ? label(target) : null;

      if (targetLabel && targetLabel !== previousTarget) {
        targetOrder.push(targetLabel);
        previousTarget = targetLabel;
      }

      const after = environment.applyAction(action);
      const collected = before.map.trashPositions.find(
        (trash) => !after.map.trashPositions.some((item) => samePosition(item, trash))
      );

      if (collected) {
        trashOrder.push(label(collected));
      }

      if (after.map.done) {
        break;
      }
    }

    const state = environment.getState();
    const metrics = algorithm.getMetricSummary();
    console.log(
      `${algorithm.name}: targets=${targetOrder.slice(0, 8).join(" -> ")}, ` +
      `trash=${trashOrder.join(" -> ")}, steps=${state.steps}, ` +
      `visited=${metrics.visitedNodes}, memory=${metrics.peakMemory}, done=${state.map.done}`
    );
  }
}

function label(value) {
  return `${String.fromCharCode(65 + value.x)}${value.y + 1}`;
}

function samePosition(a, b) {
  return a.x === b.x && a.y === b.y;
}

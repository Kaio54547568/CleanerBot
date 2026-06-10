import { AStarAlgorithm } from "./js/algorithms/astar.js";
import { BFSAlgorithm } from "./js/algorithms/bfs.js";
import { IDAStarAlgorithm } from "./js/algorithms/idastar.js";
import { IDSAlgorithm } from "./js/algorithms/ids.js";
import { Environment } from "./js/environment.js";
import { createAlgorithmComparisonMap10x10 } from "./js/sampleMaps.js";

const algorithms = [
  BFSAlgorithm,
  IDSAlgorithm,
  AStarAlgorithm,
  IDAStarAlgorithm,
];

for (const Algorithm of algorithms) {
  const environment = new Environment();
  environment.loadState(createAlgorithmComparisonMap10x10());
  const algorithm = new Algorithm();
  const trashOrder = [];
  const path = [label(environment.getState().robot)];

  const firstAction = algorithm.nextAction(environment.getState());
  const firstTarget = algorithm.getCurrentTarget();
  const firstMetrics = algorithm.getMetricSummary();

  environment.applyAction(firstAction);
  path.push(label(environment.getState().robot));

  for (let decision = 2; decision <= 1000; decision += 1) {
    const before = environment.getState();
    const action = algorithm.nextAction(before);
    const after = environment.applyAction(action);
    const collected = before.map.trashPositions.find(
      (trash) => !after.map.trashPositions.some((item) => samePosition(item, trash))
    );

    path.push(label(after.robot));

    if (collected) {
      trashOrder.push(label(collected));
    }

    if (after.map.done) {
      break;
    }
  }

  const finalState = environment.getState();
  const finalMetrics = algorithm.getMetricSummary();

  console.log(`\n=== ${algorithm.name} ===`);
  console.log(`First target: ${firstTarget ? label(firstTarget) : "none"}`);
  console.log(`First action: ${firstAction}`);
  console.log(`First-decision visited nodes: ${firstMetrics.visitedNodes}`);
  console.log(`First-decision peak memory: ${firstMetrics.peakMemory}`);
  console.log(`Trash order: ${trashOrder.join(" -> ")}`);
  console.log(`Total steps: ${finalState.steps}`);
  console.log(`Total visited nodes: ${finalMetrics.visitedNodes}`);
  console.log(`Peak memory: ${finalMetrics.peakMemory}`);
  console.log(`Done: ${finalState.map.done}`);
  console.log(`First 30 positions: ${path.slice(0, 30).join(" -> ")}`);
}

function label(value) {
  return `${String.fromCharCode(65 + value.x)}${value.y + 1}`;
}

function samePosition(a, b) {
  return a.x === b.x && a.y === b.y;
}

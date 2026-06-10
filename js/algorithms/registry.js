export const algorithmRegistry = [
  {
    id: "bfs",
    label: "BFS",
    loadClass: () => import("./bfs.js").then((module) => module.BFSAlgorithm),
  },
  {
    id: "ids",
    label: "IDS",
    loadClass: () => import("./ids.js").then((module) => module.IDSAlgorithm),
  },
  {
    id: "astar",
    label: "A*",
    loadClass: () => import("./astar.js").then((module) => module.AStarAlgorithm),
  },
  {
    id: "idastar",
    label: "IDA*",
    loadClass: () => import("./idastar.js").then((module) => module.IDAStarAlgorithm),
  },
  {
    id: "greedy",
    label: "Greedy",
    loadClass: () => import("./greedy.js").then((module) => module.GreedyAlgorithm),
  },
];

export async function createAlgorithm(id) {
  const definition = algorithmRegistry.find((algorithm) => algorithm.id === id) ?? algorithmRegistry[0];
  const AlgorithmClass = await definition.loadClass();
  return new AlgorithmClass();
}

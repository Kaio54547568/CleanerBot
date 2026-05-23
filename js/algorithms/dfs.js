import { samePosition } from "../environment.js";
import { BFSAlgorithm } from "./bfs.js";

export class DFSAlgorithm extends BFSAlgorithm {
  constructor() {
    super();
    this.name = "DFS";
    this.reset();
  }

  reset() {
    super.reset();
    this.setHeuristicDescription("DFS does not use heuristic.");
  }

  findNearestSafeTrashTarget(state) {
    const { robot } = state;

    return this.runDFS(state, robot, (current, path) => {
      if (
        this.isTrashPosition(state, current) &&
        this.hasEnoughBatteryForTarget(state, current)
      ) {
        return {
          target: { x: current.x, y: current.y },
          route: path.map((position) => ({ ...position })),
        };
      }

      return null;
    });
  }

  findPath(state, start, goal, options = {}) {
    if (!start || !goal) {
      return null;
    }

    if (samePosition(start, goal)) {
      return [{ x: start.x, y: start.y }];
    }

    const avoidFirstStepKey = options.avoidFirstStepToPosition
      ? this.positionKey(options.avoidFirstStepToPosition)
      : null;

    if (!avoidFirstStepKey) {
      const cachedPath = this.getCachedPath(state, start, goal);

      if (cachedPath !== undefined) {
        return cachedPath;
      }
    }

    const resultPath = this.runDFS(
      state,
      start,
      (current, path) => {
        if (samePosition(current, goal)) {
          return path.map((position) => ({ ...position }));
        }

        return null;
      },
      avoidFirstStepKey
    );

    if (!avoidFirstStepKey) {
      this.cachePath(state, start, goal, resultPath);
    }

    return resultPath;
  }

  runDFS(state, start, onFound, avoidFirstStepKey = null) {
    const normalizedStart = { x: start.x, y: start.y };
    const startKey = this.positionKey(normalizedStart);
    const stack = [
      {
        position: normalizedStart,
        path: [normalizedStart],
      },
    ];
    const visited = new Set([startKey]);
    const maxVisits = this.getWalkableCellCount(state);

    this.recordMemoryUsage(stack.length + visited.size);

    while (stack.length > 0 && visited.size <= maxVisits) {
      const node = stack.pop();
      const current = node.position;
      this.recordNodeVisit({ position: current });
      this.recordMemoryUsage(stack.length + visited.size);

      const found = onFound(current, node.path);

      if (found) {
        return found;
      }

      const candidates = [...this.getMoveCandidates(current)].reverse();

      for (const candidate of candidates) {
        const key = this.positionKey(candidate.position);

        if (node.path.length === 1 && avoidFirstStepKey && key === avoidFirstStepKey) {
          continue;
        }

        if (visited.has(key) || !this.canMoveTo(state, candidate.position)) {
          continue;
        }

        const nextPosition = {
          x: candidate.position.x,
          y: candidate.position.y,
        };

        visited.add(key);
        stack.push({
          position: nextPosition,
          path: [...node.path, nextPosition],
        });
        this.recordMemoryUsage(stack.length + visited.size);
      }
    }

    return null;
  }

  getWalkableCellCount(state) {
    const { map } = state;
    return Math.max(
      0,
      map.grid_size_x * map.grid_size_y - map.obstaclePositions.length
    );
  }
}

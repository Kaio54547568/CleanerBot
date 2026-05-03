import { samePosition } from "../environment.js";
import { DFSAlgorithm } from "./dfs.js";

export class IDSAlgorithm extends DFSAlgorithm {
  constructor() {
    super();
    this.name = "IDS";
    this.reset();
  }

  reset() {
    super.reset();
    this.setHeuristicDescription("IDS does not use heuristic.");
  }

  findNearestSafeTrashTarget(state) {
    const { robot, map } = state;
    const maxDepth = map.grid_size_x * map.grid_size_y;

    for (let depthLimit = 0; depthLimit <= maxDepth; depthLimit += 1) {
      const result = this.depthLimitedTargetSearch(state, robot, depthLimit);

      if (result) {
        return result;
      }
    }

    return null;
  }

  depthLimitedTargetSearch(state, start, depthLimit) {
    const path = [{ x: start.x, y: start.y }];
    const pathSet = new Set([this.positionKey(start)]);
    const result = this.depthLimitedTraverse(
      state,
      path,
      pathSet,
      depthLimit,
      (currentPath) => {
        const current = currentPath[currentPath.length - 1];

        if (
          this.isTrashPosition(state, current) &&
          this.hasEnoughBatteryForTarget(state, current)
        ) {
          return {
            target: current,
            route: currentPath.map((position) => ({ ...position })),
          };
        }

        return null;
      }
    );

    return result;
  }

  findPath(state, start, goal, options = {}) {
    if (!start || !goal) {
      return null;
    }

    if (samePosition(start, goal)) {
      return [{ x: start.x, y: start.y }];
    }

    const maxDepth = state.map.grid_size_x * state.map.grid_size_y;
    const avoidFirstStepKey = options.avoidFirstStepToPosition
      ? this.positionKey(options.avoidFirstStepToPosition)
      : null;

    for (let depthLimit = 0; depthLimit <= maxDepth; depthLimit += 1) {
      const path = [{ x: start.x, y: start.y }];
      const pathSet = new Set([this.positionKey(start)]);
      const result = this.depthLimitedTraverse(
        state,
        path,
        pathSet,
        depthLimit,
        (currentPath) => {
          const current = currentPath[currentPath.length - 1];

          if (samePosition(current, goal)) {
            return currentPath.map((position) => ({ ...position }));
          }

          return null;
        },
        avoidFirstStepKey
      );

      if (result) {
        return result;
      }
    }

    return null;
  }

  depthLimitedTraverse(state, path, pathSet, remainingDepth, onFound, avoidFirstStepKey = null) {
    const current = path[path.length - 1];
    this.recordNodeVisit({ position: current });
    this.recordMemoryUsage(path.length + pathSet.size);

    const found = onFound(path);

    if (found) {
      return found;
    }

    if (remainingDepth === 0) {
      return null;
    }

    const candidates = [...this.getMoveCandidates(current)].reverse();

    for (const candidate of candidates) {
      const key = this.positionKey(candidate.position);

      if (path.length === 1 && avoidFirstStepKey && key === avoidFirstStepKey) {
        continue;
      }

      if (pathSet.has(key) || !this.canMoveTo(state, candidate.position)) {
        continue;
      }

      path.push(candidate.position);
      pathSet.add(key);
      this.recordMemoryUsage(path.length + pathSet.size);

      const result = this.depthLimitedTraverse(
        state,
        path,
        pathSet,
        remainingDepth - 1,
        onFound,
        avoidFirstStepKey
      );

      if (result) {
        return result;
      }

      path.pop();
      pathSet.delete(key);
    }

    return null;
  }
}

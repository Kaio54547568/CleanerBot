import { samePosition } from "../environment.js";
import { BFSAlgorithm } from "./bfs.js";

const SEARCH_FOUND = Symbol("ida_star_found");

export class IDAStarAlgorithm extends BFSAlgorithm {
  constructor() {
    super();
    this.name = "IDA*";
    this.reset();
  }

  reset() {
    super.reset();
    this.pathCache = new Map();
    this.setHeuristicDescription("Heuristic: h(n) = |x_goal - x_current| + |y_goal - y_current|");
  }

  findNearestSafeTrashTarget(state) {
    const sortedTrashPositions = [...state.map.trashPositions].sort((a, b) => {
      return this.manhattanDistance(state.robot, a) - this.manhattanDistance(state.robot, b);
    });

    let bestRoute = null;
    let bestTarget = null;

    for (const trash of sortedTrashPositions) {
      const route = this.findPath(state, state.robot, trash);

      if (!route) {
        continue;
      }

      if (bestRoute && route.length >= bestRoute.length) {
        continue;
      }

      if (!this.hasEnoughBatteryForTarget(state, trash)) {
        continue;
      }

      bestRoute = route;
      bestTarget = trash;
    }

    return bestTarget ? { target: bestTarget, route: bestRoute } : null;
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

    if (avoidFirstStepKey) {
      return this.runIDAStar(state, start, goal, avoidFirstStepKey);
    }

    const cacheKey = this.getPathCacheKey(state, start, goal);

    if (this.pathCache.has(cacheKey)) {
      return this.pathCache.get(cacheKey);
    }

    const path = this.runIDAStar(state, start, goal, null);
    const reverseCacheKey = this.getPathCacheKey(state, goal, start);

    this.pathCache.set(cacheKey, path);
    this.pathCache.set(reverseCacheKey, path ? [...path].reverse() : null);
    return path;
  }

  runIDAStar(state, start, goal, avoidFirstStepKey) {
    const maxDepth = state.map.grid_size_x * state.map.grid_size_y;
    let bound = this.manhattanDistance(start, goal);
    const startKey = this.positionKey(start);

    while (bound <= maxDepth) {
      const path = [{ x: start.x, y: start.y }];
      const pathSet = new Set([startKey]);
      const bestDepthByNode = new Map([[startKey, 0]]);
      const result = this.depthLimitedSearch(
        state,
        goal,
        path,
        pathSet,
        0,
        bound,
        bestDepthByNode,
        avoidFirstStepKey
      );

      if (result === SEARCH_FOUND) {
        return path;
      }

      if (!Number.isFinite(result)) {
        return null;
      }

      bound = result;
    }

    return null;
  }

  depthLimitedSearch(state, goal, path, pathSet, costSoFar, bound, bestDepthByNode, avoidFirstStepKey) {
    const current = path[path.length - 1];
    const heuristic = this.manhattanDistance(current, goal);
    const estimate = costSoFar + heuristic;

    this.recordNodeVisit({
      position: current,
      goal,
      g: costSoFar,
      h: heuristic,
    });
    this.recordMemoryUsage(path.length + bestDepthByNode.size);

    // IDA* prunes when f(n) crosses the current iterative bound.
    if (estimate > bound) {
      return estimate;
    }

    if (samePosition(current, goal)) {
      return SEARCH_FOUND;
    }

    let nextBound = Infinity;
    const neighbors = this.getMoveCandidates(current)
      .filter((candidate) => this.canMoveTo(state, candidate.position))
      .sort((a, b) => {
        const distanceDiff = this.manhattanDistance(a.position, goal) - this.manhattanDistance(b.position, goal);

        if (distanceDiff !== 0) {
          return distanceDiff;
        }

        return this.getActionPriority(a.action) - this.getActionPriority(b.action);
      });

    for (const neighbor of neighbors) {
      const neighborKey = this.positionKey(neighbor.position);
      const nextCost = costSoFar + 1;
      const bestSeenDepth = bestDepthByNode.get(neighborKey);

      if (path.length === 1 && avoidFirstStepKey && neighborKey === avoidFirstStepKey) {
        continue;
      }

      if (pathSet.has(neighborKey)) {
        continue;
      }

      if (bestSeenDepth !== undefined && bestSeenDepth <= nextCost) {
        continue;
      }

      bestDepthByNode.set(neighborKey, nextCost);
      path.push(neighbor.position);
      pathSet.add(neighborKey);
      this.recordMemoryUsage(path.length + bestDepthByNode.size);

      const result = this.depthLimitedSearch(
        state,
        goal,
        path,
        pathSet,
        nextCost,
        bound,
        bestDepthByNode,
        avoidFirstStepKey
      );

      if (result === SEARCH_FOUND) {
        return SEARCH_FOUND;
      }

      if (result < nextBound) {
        nextBound = result;
      }

      path.pop();
      pathSet.delete(neighborKey);
    }

    return nextBound;
  }

  getActionPriority(action) {
    switch (action) {
      case "up":
        return 0;
      case "right":
        return 1;
      case "down":
        return 2;
      case "left":
        return 3;
      default:
        return 4;
    }
  }

  getPathCacheKey(state, start, goal) {
    return `${this.getStaticMapKey(state)}|${this.positionKey(start)}>${this.positionKey(goal)}`;
  }
}

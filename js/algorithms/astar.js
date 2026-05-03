import { samePosition } from "../environment.js";
import { BFSAlgorithm } from "./bfs.js";

export class AStarAlgorithm extends BFSAlgorithm {
  constructor() {
    super();
    this.name = "A*";
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
      return this.runAStar(state, start, goal, avoidFirstStepKey);
    }

    const cacheKey = this.getPathCacheKey(state, start, goal);

    if (this.pathCache.has(cacheKey)) {
      return this.pathCache.get(cacheKey);
    }

    const path = this.runAStar(state, start, goal, null);
    const reverseCacheKey = this.getPathCacheKey(state, goal, start);

    this.pathCache.set(cacheKey, path);
    this.pathCache.set(reverseCacheKey, path ? [...path].reverse() : null);
    return path;
  }

  runAStar(state, start, goal, avoidFirstStepKey) {
    if (!this.canMoveTo(state, goal)) {
      return null;
    }

    const startKey = this.positionKey(start);
    const openSet = [{ position: { x: start.x, y: start.y }, g: 0 }];
    const openKeys = new Set([startKey]);
    const closedKeys = new Set();
    const cameFrom = new Map();
    const nodeByKey = new Map([[startKey, { x: start.x, y: start.y }]]);
    const gScore = new Map([[startKey, 0]]);
    const fScore = new Map([[startKey, this.manhattanDistance(start, goal)]]);

    this.recordMemoryUsage(openSet.length + closedKeys.size);

    while (openSet.length > 0) {
      const currentIndex = this.findLowestScoreIndex(openSet, goal, gScore, fScore);
      const currentNode = openSet.splice(currentIndex, 1)[0];
      const current = currentNode.position;
      const currentKey = this.positionKey(current);
      openKeys.delete(currentKey);

      // A*: trace the classic f(n) = g(n) + h(n) expansion values.
      this.recordNodeVisit({
        position: current,
        goal,
        g: currentNode.g,
        h: this.manhattanDistance(current, goal),
      });

      if (samePosition(current, goal)) {
        return this.reconstructPath(cameFrom, nodeByKey, currentKey);
      }

      closedKeys.add(currentKey);
      this.recordMemoryUsage(openSet.length + closedKeys.size);

      for (const neighbor of this.getSortedMoveCandidates(current, goal)) {
        if (!this.canMoveTo(state, neighbor.position)) {
          continue;
        }

        const neighborKey = this.positionKey(neighbor.position);

        if (currentNode.g === 0 && avoidFirstStepKey && neighborKey === avoidFirstStepKey) {
          continue;
        }

        if (closedKeys.has(neighborKey)) {
          continue;
        }

        const tentativeGScore = currentNode.g + 1;

        if (tentativeGScore >= (gScore.get(neighborKey) ?? Infinity)) {
          continue;
        }

        cameFrom.set(neighborKey, currentKey);
        nodeByKey.set(neighborKey, neighbor.position);
        gScore.set(neighborKey, tentativeGScore);
        fScore.set(
          neighborKey,
          tentativeGScore + this.manhattanDistance(neighbor.position, goal)
        );

        if (!openKeys.has(neighborKey)) {
          openKeys.add(neighborKey);
          openSet.push({
            position: neighbor.position,
            g: tentativeGScore,
          });
        }

        this.recordMemoryUsage(openSet.length + closedKeys.size);
      }
    }

    return null;
  }

  reconstructPath(cameFrom, nodeByKey, currentKey) {
    const path = [nodeByKey.get(currentKey)];
    let nextKey = currentKey;

    while (cameFrom.has(nextKey)) {
      nextKey = cameFrom.get(nextKey);
      path.unshift(nodeByKey.get(nextKey));
    }

    return path;
  }

  findLowestScoreIndex(openSet, goal, gScore, fScore) {
    let bestIndex = 0;

    for (let index = 1; index < openSet.length; index += 1) {
      const candidate = openSet[index];
      const best = openSet[bestIndex];
      const candidateKey = this.positionKey(candidate.position);
      const bestKey = this.positionKey(best.position);
      const scoreDiff = (fScore.get(candidateKey) ?? Infinity) - (fScore.get(bestKey) ?? Infinity);

      if (scoreDiff < 0) {
        bestIndex = index;
        continue;
      }

      if (scoreDiff > 0) {
        continue;
      }

      const heuristicDiff = this.manhattanDistance(candidate.position, goal) - this.manhattanDistance(best.position, goal);

      if (heuristicDiff < 0) {
        bestIndex = index;
        continue;
      }

      if (heuristicDiff > 0) {
        continue;
      }

      const costDiff = (gScore.get(candidateKey) ?? Infinity) - (gScore.get(bestKey) ?? Infinity);

      if (costDiff < 0) {
        bestIndex = index;
      }
    }

    return bestIndex;
  }

  getSortedMoveCandidates(position, goal) {
    return this.getMoveCandidates(position).sort((a, b) => {
      const distanceDiff = this.manhattanDistance(a.position, goal) - this.manhattanDistance(b.position, goal);

      if (distanceDiff !== 0) {
        return distanceDiff;
      }

      return this.getActionPriority(a.action) - this.getActionPriority(b.action);
    });
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

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
    const start = { x: robot.x, y: robot.y };
    const stack = [
      {
        position: start,
        path: [start],
      },
    ];
    const visited = new Set([this.positionKey(start)]);

    this.recordMemoryUsage(stack.length + visited.size);

    while (stack.length > 0) {
      const node = stack.pop();
      const current = node.position;
      this.recordNodeVisit({ position: current });
      this.recordMemoryUsage(stack.length + visited.size);

      if (
        this.isTrashPosition(state, current) &&
        this.hasEnoughBatteryForTarget(state, current)
      ) {
        return {
          target: current,
          route: node.path,
        };
      }

      const candidates = [...this.getMoveCandidates(current)].reverse();

      for (const candidate of candidates) {
        const key = this.positionKey(candidate.position);

        if (visited.has(key) || !this.canMoveTo(state, candidate.position)) {
          continue;
        }

        visited.add(key);
        stack.push({
          position: candidate.position,
          path: [...node.path, candidate.position],
        });
        this.recordMemoryUsage(stack.length + visited.size);
      }
    }

    return null;
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
    const normalizedStart = { x: start.x, y: start.y };
    const stack = [
      {
        position: normalizedStart,
        path: [normalizedStart],
      },
    ];
    const visited = new Set([this.positionKey(normalizedStart)]);

    this.recordMemoryUsage(stack.length + visited.size);

    while (stack.length > 0) {
      const node = stack.pop();
      const current = node.position;
      this.recordNodeVisit({ position: current });
      this.recordMemoryUsage(stack.length + visited.size);

      if (samePosition(current, goal)) {
        return node.path;
      }

      const candidates = [...this.getMoveCandidates(current)].reverse();

      for (const candidate of candidates) {
        const key = this.positionKey(candidate.position);

        if (visited.has(key) || !this.canMoveTo(state, candidate.position)) {
          continue;
        }

        if (node.path.length === 1 && avoidFirstStepKey && key === avoidFirstStepKey) {
          continue;
        }

        visited.add(key);
        stack.push({
          position: candidate.position,
          path: [...node.path, candidate.position],
        });
        this.recordMemoryUsage(stack.length + visited.size);
      }
    }

    return null;
  }
}

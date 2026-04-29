import { ACTIONS } from "../models.js";
import { samePosition } from "../environment.js";
import { BaseAlgorithm } from "./baseAlgorithm.js";

export class IDSAlgorithm extends BaseAlgorithm {
  constructor() {
    super();
    this.name = "IDS";
    this.actionQueue = []; 
  }

  reset() {
    super.reset();
    this.actionQueue = [];
  }


  nextAction(state) {
    const { robot, map } = state;

    if (this.isAtTrashCan(state) && robot.capacity > 0) {
      this.actionQueue = []; // Hủy kế hoạch cũ vì đã đạt mục tiêu đổ rác
      return ACTIONS.LET_TRASH_OUT;
    }

    if (this.isAtChargingStation(state) && robot.battery < this.getMaxBattery(state)) {
      this.actionQueue = []; 
      return ACTIONS.CHARGE;
    }

    if (this.hasTrashAtRobot(state) && robot.capacity < robot.maxCapacity) {
      if (this.hasEnoughBatteryForTarget(state, robot)) {
        this.actionQueue = [];
        return ACTIONS.SUCK_TRASH;
      }
    }

    if (this.actionQueue.length > 0) {
      const nextMove = this.actionQueue.shift();
      if (this.canMoveTo(state, this.getExpectedPosition(robot, nextMove))) {
        return nextMove;
      }
      this.actionQueue = []; // Lệch kế hoạch, cần tính toán lại
    }

    let target = this.chooseWorkTarget(state);

    if (target && !this.hasEnoughBatteryForTarget(state, target)) {
      target = map.chargingStation;
    }

    if (!target) return this.getChargingAction(state);

    const maxPossibleDepth = map.grid_size_x * map.grid_size_y;
    
    for (let limit = 0; limit <= maxPossibleDepth; limit++) {
      const path = this.dls(state, robot, target, limit, new Set());
      if (path) {
        this.actionQueue = path;
        return this.actionQueue.shift() || ACTIONS.STAY;
      }
    }

    return ACTIONS.STAY;
  }


  dls(state, currentPos, target, limit, visited) {
    if (samePosition(currentPos, target)) return [];
    if (limit <= 0) return null;

    const posKey = `${currentPos.x},${currentPos.y}`;
    visited.add(posKey);


    const candidates = this.getMoveCandidates(currentPos)
      .filter(move => this.canMoveTo(state, move.position))
      .sort((a, b) => this.manhattanDistance(a.position, target) - this.manhattanDistance(b.position, target));

    for (const move of candidates) {
      if (!visited.has(`${move.position.x},${move.position.y}`)) {
        const path = this.dls(state, move.position, target, limit - 1, new Set(visited));
        if (path !== null) {
          return [move.action, ...path];
        }
      }
    }
    return null;
  }

  chooseWorkTarget(state) {
    const { robot, map } = state;

    if (robot.capacity >= robot.maxCapacity || (map.trashPositions.length === 0 && robot.capacity > 0)) {
      return map.trashCan;
    }

    const validTrash = map.trashPositions.filter(trash => {
      return !map.obstaclePositions.some(obs => samePosition(obs, trash));
    });

    return this.findNearestPosition(robot, validTrash);
  }


  getExpectedPosition(robot, action) {
    const pos = { x: robot.x, y: robot.y };
    if (action === ACTIONS.UP) pos.y--;
    if (action === ACTIONS.DOWN) pos.y++;
    if (action === ACTIONS.LEFT) pos.x--;
    if (action === ACTIONS.RIGHT) pos.x++;
    return pos;
  }


  hasEnoughBatteryForTarget(state, target) {
    const { robot, map } = state;
    const batteryLoss = this.getBatteryLoss(state);
    const actionCost = this.getActionCost(state);

    const distToTarget = this.manhattanDistance(robot, target);
    const distTargetToCharger = this.manhattanDistance(target, map.chargingStation);

    const totalEnergyRequired = (distToTarget + distTargetToCharger) * batteryLoss + actionCost;

    return robot.battery > totalEnergyRequired;
  }

  getChargingAction(state) {
    const { robot, map } = state;
    if (this.isAtChargingStation(state)) {
      return robot.battery < this.getMaxBattery(state) ? ACTIONS.CHARGE : ACTIONS.STAY;
    }
    this.actionQueue = []; 
    return this.chooseMoveTowardTarget(state, map.chargingStation);
  }
}
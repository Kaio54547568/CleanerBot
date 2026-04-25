import { ACTIONS } from "../models.js";
import { samePosition } from "../environment.js";
import { BaseAlgorithm } from "./baseAlgorithm.js";

export class GreedyAlgorithm extends BaseAlgorithm {
  constructor() {
    super();
    this.name = "Greedy";
  }

  reset() {
    super.reset();
    // Greedy hien tai khong luu trang thai noi bo.
  }

  nextAction(state) {
    const { robot, map } = state;

    if (this.isAtTrashCan(state) && robot.capacity > 0) {
      return this.hasEnoughBatteryForTarget(state, map.trashCan)
        ? ACTIONS.LET_TRASH_OUT
        : this.getChargingAction(state);
    }

    if (this.isAtChargingStation(state) && this.shouldCharge(state)) {
      return ACTIONS.CHARGE;
    }

    if (this.hasTrashAtRobot(state) && robot.capacity < robot.maxCapacity) {
      return this.hasEnoughBatteryForTarget(state, robot)
        ? ACTIONS.SUCK_TRASH
        : this.getChargingAction(state);
    }

    let target = this.chooseWorkTarget(state);

    if (
      target &&
      !samePosition(target, map.chargingStation) &&
      !this.hasEnoughBatteryForTarget(state, target) &&
      this.canFullBatteryHandleTarget(state, target)
    ) {
      target = map.chargingStation;
    }

    if (
      target &&
      !samePosition(target, map.chargingStation) &&
      !this.hasEnoughBatteryForTarget(state, target)
    ) {
      return this.getChargingAction(state);
    }

    if (!target) {
      return this.getChargingAction(state);
    }

    if (samePosition(robot, target)) {
      return this.getActionAtTarget(state, target);
    }

    if (this.getBatteryLoss(state) > robot.battery && !this.isAtChargingStation(state)) {
      return ACTIONS.STAY;
    }

    return this.chooseMoveTowardTarget(state, target);
  }

  getChargingAction(state) {
    const { robot, map } = state;

    if (this.isAtChargingStation(state)) {
      return robot.battery < this.getMaxBattery(state)
        ? ACTIONS.CHARGE
        : ACTIONS.STAY;
    }

    if (
      this.hasEnoughBatteryForTrip(
        state,
        robot,
        map.chargingStation,
        robot.battery
      )
    ) {
      return this.chooseMoveTowardTarget(state, map.chargingStation);
    }

    return ACTIONS.STAY;
  }

  chooseWorkTarget(state) {
    const { robot, map } = state;

    if (robot.capacity >= robot.maxCapacity || (map.trashPositions.length === 0 && robot.capacity > 0)) {
      return this.canFullBatteryHandleTarget(state, map.trashCan)
        ? map.trashCan
        : null;
    }

    if (map.trashPositions.length > 0) {
      const manageableTrashPositions = map.trashPositions.filter((trash) =>
        this.canFullBatteryHandleTarget(state, trash)
      );

      return this.findNearestPosition(robot, manageableTrashPositions);
    }

    return null;
  }

  getActionAtTarget(state, target) {
    const { robot, map } = state;

    if (samePosition(target, map.chargingStation) && robot.battery < this.getMaxBattery(state)) {
      return ACTIONS.CHARGE;
    }

    if (
      samePosition(target, map.trashCan) &&
      robot.capacity > 0 &&
      this.hasEnoughBatteryForTarget(state, target)
    ) {
      return ACTIONS.LET_TRASH_OUT;
    }

    if (
      this.hasTrashAtRobot(state) &&
      robot.capacity < robot.maxCapacity &&
      this.hasEnoughBatteryForTarget(state, target)
    ) {
      return ACTIONS.SUCK_TRASH;
    }

    return ACTIONS.STAY;
  }

  shouldCharge(state) {
    const { robot } = state;
    const maxBattery = this.getMaxBattery(state);

    if (robot.battery >= maxBattery) {
      return false;
    }

    const workTarget = this.chooseWorkTarget(state);

    if (!workTarget) {
      return false;
    }

    return !this.hasEnoughBatteryForTarget(state, workTarget);
  }

  hasEnoughBatteryForTarget(state, target) {
    const { robot } = state;
    return this.hasEnoughBatteryForTrip(state, robot, target, robot.battery);
  }

  canFullBatteryHandleTarget(state, target) {
    const { map } = state;
    return this.hasEnoughBatteryForTrip(
      state,
      map.chargingStation,
      target,
      this.getMaxBattery(state)
    );
  }

  hasEnoughBatteryForTrip(state, fromPosition, target, battery) {
    return battery >= this.getRequiredBatteryForTarget(state, fromPosition, target);
  }

  getRequiredBatteryForTarget(state, fromPosition, target) {
    const { robot, map } = state;
    const batteryLoss = this.getBatteryLoss(state);
    const actionCost = this.getActionCost(state);

    let requiredBattery =
      this.manhattanDistance(fromPosition, target) * batteryLoss;

    if (samePosition(target, map.chargingStation)) {
      return requiredBattery;
    }

    if (samePosition(target, map.trashCan) && robot.capacity > 0) {
      requiredBattery += actionCost;
      requiredBattery +=
        this.manhattanDistance(target, map.chargingStation) * batteryLoss;
      return requiredBattery;
    }

    if (
      map.trashPositions.some((trash) => samePosition(trash, target)) &&
      robot.capacity < robot.maxCapacity
    ) {
      requiredBattery += actionCost;

      const willBeFull = robot.capacity + 1 >= robot.maxCapacity;

      if (willBeFull) {
        requiredBattery +=
          this.manhattanDistance(target, map.trashCan) * batteryLoss;
        requiredBattery += actionCost;
        requiredBattery +=
          this.manhattanDistance(map.trashCan, map.chargingStation) *
          batteryLoss;
      } else {
        requiredBattery +=
          this.manhattanDistance(target, map.chargingStation) * batteryLoss;
      }

      return requiredBattery;
    }

    requiredBattery +=
      this.manhattanDistance(target, map.chargingStation) * batteryLoss;
    return requiredBattery;
  }
}

export function createAlgorithmComparisonMap10x10() {
  return {
    robot: { x: 0, y: 0, battery: 100, capacity: 0, maxCapacity: 3 },
    map: {
      grid_size_x: 10,
      grid_size_y: 10,
      start_x: 0,
      start_y: 0,
      trashPositions: labels([
        "A5", "E1", "J1", "J5", "E10", "J10",
      ]),
      obstaclePositions: labels([
        "B2", "C2", "D2", "F2", "G2", "H2", "I2",
        "D3", "F3", "I3",
        "B4", "D4", "F4", "G4", "I4",
        "B5", "D5", "G5", "I5",
        "B6", "D6", "F6", "G6", "I6",
        "B7", "F7", "I7",
        "B8", "C8", "D8", "F8", "H8", "I8",
        "D9", "F9",
      ]),
      chargingStation: position("A1"),
      trashCan: position("J10"),
      done: false,
    },
    config: { maxBattery: 100, batteryLoss: 1, actionCost: 1 },
    steps: 0,
    latestAction: null,
    latestLog: "Loaded 10x10 algorithm comparison map.",
  };
}

function labels(values) {
  return values.map(position);
}

function position(value) {
  return {
    x: value.charCodeAt(0) - 65,
    y: Number.parseInt(value.slice(1), 10) - 1,
  };
}

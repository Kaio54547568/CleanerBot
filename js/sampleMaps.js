export const sampleMapRegistry = [
  {
    id: "equal-distance-targets",
    label: "Equal-distance targets",
    purpose: "Compare tie-breaking when two trash cells are equally close.",
    createState: createEqualDistanceTargetsMap,
  },
  {
    id: "long-wall-detour",
    label: "Long wall detour",
    purpose: "Compare visited nodes and memory while finding a path around a long wall.",
    createState: createLongWallDetourMap,
  },
  {
    id: "battery-reserve",
    label: "Battery reserve",
    purpose: "Show the robot returning to charge instead of collecting nearby trash.",
    createState: createBatteryReserveMap,
  },
  {
    id: "capacity-four-of-five-low-battery",
    label: "Capacity 4/5, charge first",
    purpose: "Show a robot carrying 4/5 trash charging before collecting the final item.",
    createState: createCapacityFourOfFiveLowBatteryMap,
  },
  {
    id: "capacity-and-trash-can",
    label: "Capacity and trash can",
    purpose: "Show the robot changing target when its trash capacity becomes full.",
    createState: createCapacityAndTrashCanMap,
  },
];

export function createSampleMap(id) {
  const preset = sampleMapRegistry.find((item) => item.id === id);
  return preset?.createState() ?? null;
}

function createEqualDistanceTargetsMap() {
  return createState({
    robot: { position: "E5", maxCapacity: 3 },
    chargingStation: "E5",
    trashCan: "J10",
    trash: ["H5", "E2", "J5", "E9"],
    obstacles: ["D5", "E6", "F6", "G6", "H6"],
    latestLog: "Demo: equal-distance target tie-breaking.",
  });
}

function createLongWallDetourMap() {
  return createState({
    robot: { position: "A1", maxCapacity: 3 },
    chargingStation: "A1",
    trashCan: "J10",
    trash: ["J1", "J5", "A10"],
    obstacles: [
      "E1", "E2", "E3", "E4", "E5", "E6", "E7", "E8",
      "B3", "C3", "B7", "C7", "G3", "H3", "G7", "H7",
    ],
    latestLog: "Demo: search around a long wall.",
  });
}

function createBatteryReserveMap() {
  return createState({
    robot: { position: "E5", battery: 40, maxCapacity: 5 },
    chargingStation: "A1",
    trashCan: "E1",
    trash: ["E4", "F5", "B7"],
    obstacles: ["H2", "H3", "H4", "C7", "D7", "E7", "F7"],
    batteryLoss: 5,
    latestLog: "Demo: preserve enough battery to return to charging.",
  });
}

function createCapacityAndTrashCanMap() {
  return createState({
    robot: { position: "A1", maxCapacity: 2 },
    chargingStation: "A1",
    trashCan: "J5",
    trash: ["A2", "A3", "A4", "G5", "H5", "I5"],
    obstacles: [
      "C1", "C2", "C3", "C4",
      "E2", "E3", "E4", "E5",
      "G2", "G3", "G4",
    ],
    latestLog: "Demo: capacity limit and trash-can trips.",
  });
}

function createCapacityFourOfFiveLowBatteryMap() {
  return createState({
    robot: { position: "E5", battery: 20, capacity: 4, maxCapacity: 5 },
    chargingStation: "A5",
    trashCan: "E1",
    trash: ["F5"],
    obstacles: [],
    batteryLoss: 5,
    latestLog: "Demo: capacity 4/5, charge before collecting the final trash.",
  });
}

function createState({
  robot,
  chargingStation,
  trashCan,
  trash,
  obstacles,
  batteryLoss = 1,
  latestLog,
}) {
  const robotPosition = position(robot.position);

  return {
    robot: {
      ...robotPosition,
      battery: robot.battery ?? 100,
      capacity: robot.capacity ?? 0,
      maxCapacity: robot.maxCapacity,
    },
    map: {
      grid_size_x: 10,
      grid_size_y: 10,
      start_x: robotPosition.x,
      start_y: robotPosition.y,
      trashPositions: labels(trash),
      obstaclePositions: labels(obstacles),
      chargingStation: position(chargingStation),
      trashCan: position(trashCan),
      done: false,
    },
    config: { maxBattery: 100, batteryLoss, actionCost: 1 },
    steps: 0,
    latestAction: null,
    latestLog,
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

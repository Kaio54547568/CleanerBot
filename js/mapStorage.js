const MAP_FILE_FORMAT = "cleanerbot-map";
const MAP_FILE_VERSION = 1;
export const MAX_MAP_FILE_BYTES = 1_000_000;

export function createMapDocument(name, state, algorithmId = null) {
  const cleanName = normalizeMapName(name);
  const { map, robot, config } = state;

  return {
    format: MAP_FILE_FORMAT,
    version: MAP_FILE_VERSION,
    name: cleanName,
    algorithm: typeof algorithmId === "string" && algorithmId.trim()
      ? algorithmId.trim()
      : null,
    map: {
      width: map.grid_size_x,
      height: map.grid_size_y,
      start: { x: map.start_x, y: map.start_y },
      trash: map.trashPositions.map(clonePosition),
      obstacles: map.obstaclePositions.map(clonePosition),
      chargingStation: clonePosition(map.chargingStation),
      trashCan: clonePosition(map.trashCan),
    },
    robot: {
      x: robot.x,
      y: robot.y,
      battery: robot.battery,
      capacity: robot.capacity,
      maxCapacity: robot.maxCapacity,
    },
    settings: {
      maxCapacity: robot.maxCapacity,
      batteryLoss: config.batteryLoss,
    },
  };
}

export function parseMapDocument(text) {
  if (
    typeof text !== "string" ||
    new TextEncoder().encode(text).byteLength > MAX_MAP_FILE_BYTES
  ) {
    throw new Error("The selected map file is larger than 1 MB.");
  }

  let document;

  try {
    document = JSON.parse(text);
  } catch {
    throw new Error("The selected file is not valid JSON.");
  }

  validateDocumentHeader(document);

  const map = document.map;
  const settings = document.settings;
  validateMapData(map, settings);
  const robot = normalizeRobotData(document.robot, map, settings);
  const state = {
    robot: {
      battery: robot.battery,
      capacity: robot.capacity,
      maxCapacity: robot.maxCapacity,
      x: robot.x,
      y: robot.y,
    },
    map: {
      grid_size_x: map.width,
      grid_size_y: map.height,
      start_x: map.start.x,
      start_y: map.start.y,
      trashPositions: map.trash.map(clonePosition),
      obstaclePositions: map.obstacles.map(clonePosition),
      chargingStation: clonePosition(map.chargingStation),
      trashCan: clonePosition(map.trashCan),
      done: false,
    },
    config: {
      maxBattery: 100,
      batteryLoss: settings.batteryLoss,
      actionCost: 1,
    },
    steps: 0,
    latestAction: null,
    latestLog: "Map loaded.",
  };

  return {
    name: normalizeMapName(document.name),
    algorithmId: normalizeAlgorithmId(document.algorithm),
    state,
  };
}

export function sanitizeMapFilename(name) {
  const sanitized = normalizeMapName(name)
    .replace(/\.json$/i, "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/[.\s]+$/g, "")
    .trim();

  return `${sanitized || "cleanerbot-map"}.json`;
}

function validateDocumentHeader(document) {
  if (!document || typeof document !== "object" || Array.isArray(document)) {
    throw new Error("The map file must contain a JSON object.");
  }

  if (document.format !== MAP_FILE_FORMAT) {
    throw new Error("This file is not a CleanerBot map.");
  }

  if (document.version !== MAP_FILE_VERSION) {
    throw new Error(`Unsupported map version: ${document.version}.`);
  }

  if (
    typeof document.name !== "string" ||
    document.name.trim().length === 0 ||
    document.name.trim().length > 80
  ) {
    throw new Error("The map name must contain 1 to 80 characters.");
  }

  if (!document.map || !document.settings) {
    throw new Error("The map file is missing required data.");
  }
}

function validateMapData(map, settings) {
  assertIntegerInRange(map.width, 4, 20, "Map width");
  assertIntegerInRange(map.height, 4, 20, "Map height");
  assertIntegerInRange(settings.maxCapacity, 1, 20, "Max capacity");
  assertNumberInRange(settings.batteryLoss, 0, 100, "Battery loss");

  if (!Array.isArray(map.trash) || !Array.isArray(map.obstacles)) {
    throw new Error("Trash and obstacles must be arrays.");
  }

  const positions = [
    ["Robot start", map.start],
    ["Charging station", map.chargingStation],
    ["Trash can", map.trashCan],
    ...map.trash.map((position, index) => [`Trash ${index + 1}`, position]),
    ...map.obstacles.map((position, index) => [`Obstacle ${index + 1}`, position]),
  ];

  positions.forEach(([label, position]) => {
    if (
      !position ||
      !Number.isInteger(position.x) ||
      !Number.isInteger(position.y)
    ) {
      throw new Error(`${label} must use integer coordinates.`);
    }

    if (
      position.x < 0 ||
      position.y < 0 ||
      position.x >= map.width ||
      position.y >= map.height
    ) {
      throw new Error(`${label} is outside the map.`);
    }
  });

  const trashKeys = assertUniquePositions(map.trash, "trash");
  const obstacleKeys = assertUniquePositions(map.obstacles, "obstacle");
  const startKey = positionKey(map.start);
  const chargingKey = positionKey(map.chargingStation);
  const trashCanKey = positionKey(map.trashCan);

  if (chargingKey === trashCanKey) {
    throw new Error("Charging station and trash can conflict.");
  }

  if (
    obstacleKeys.has(startKey) ||
    obstacleKeys.has(chargingKey) ||
    obstacleKeys.has(trashCanKey)
  ) {
    throw new Error("An obstacle conflicts with a reserved map cell.");
  }

  if (
    trashKeys.has(chargingKey) ||
    trashKeys.has(trashCanKey) ||
    [...trashKeys].some((key) => obstacleKeys.has(key))
  ) {
    throw new Error("A trash position conflicts with another map item.");
  }
}

function normalizeRobotData(robot, map, settings) {
  if (robot === undefined || robot === null) {
    return {
      x: map.start.x,
      y: map.start.y,
      battery: 100,
      capacity: 0,
      maxCapacity: settings.maxCapacity,
    };
  }

  if (!robot || typeof robot !== "object" || Array.isArray(robot)) {
    throw new Error("Robot data must be an object.");
  }

  assertIntegerInRange(robot.x, 0, map.width - 1, "Robot x");
  assertIntegerInRange(robot.y, 0, map.height - 1, "Robot y");
  assertNumberInRange(robot.battery, 0, 100, "Robot battery");
  assertIntegerInRange(robot.maxCapacity, 1, 20, "Robot max capacity");
  assertIntegerInRange(robot.capacity, 0, robot.maxCapacity, "Robot capacity");

  const robotPosition = { x: robot.x, y: robot.y };

  if (map.obstacles.some((obstacle) => positionKey(obstacle) === positionKey(robotPosition))) {
    throw new Error("Robot position conflicts with an obstacle.");
  }

  return {
    x: robot.x,
    y: robot.y,
    battery: robot.battery,
    capacity: robot.capacity,
    maxCapacity: robot.maxCapacity,
  };
}

function normalizeAlgorithmId(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized || null;
}

function assertIntegerInRange(value, min, max, label) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label} must be an integer from ${min} to ${max}.`);
  }
}

function assertNumberInRange(value, min, max, label) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${label} must be from ${min} to ${max}.`);
  }
}

function assertUniquePositions(positions, label) {
  const keys = new Set();

  positions.forEach((position) => {
    const key = positionKey(position);

    if (keys.has(key)) {
      throw new Error(`The map contains a duplicate ${label} position.`);
    }

    keys.add(key);
  });

  return keys;
}

function positionKey(position) {
  return `${position.x},${position.y}`;
}

function normalizeMapName(name) {
  const normalized = `${name ?? ""}`.trim();
  return normalized || "CleanerBot map";
}

function clonePosition(position) {
  return {
    x: position.x,
    y: position.y,
  };
}

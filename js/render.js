import { samePosition } from "./environment.js";

const CELL_ICONS = Object.freeze({
  robot: "assets/icons/robot.svg",
  trash: "assets/icons/trash.svg",
  obstacle: "assets/icons/obstacle.svg",
  charger: "assets/icons/charger.svg",
  trashCan: "assets/icons/trash-can.svg",
});

export class Renderer {
  constructor({
    gridElement,
    columnLabelsElement = null,
    rowLabelsElement = null,
    batteryElement = null,
    capacityElement = null,
    positionElement = null,
    doneElement = null,
    stepsElement = null,
    latestLogElement = null,
    latestActionElement = null,
    nextActionElement = null,
    statusBadgeElement = null,
  }) {
    this.gridElement = gridElement;
    this.columnLabelsElement = columnLabelsElement;
    this.rowLabelsElement = rowLabelsElement;
    this.batteryElement = batteryElement;
    this.capacityElement = capacityElement;
    this.positionElement = positionElement;
    this.doneElement = doneElement;
    this.stepsElement = stepsElement;
    this.latestLogElement = latestLogElement;
    this.latestActionElement = latestActionElement;
    this.nextActionElement = nextActionElement;
    this.statusBadgeElement = statusBadgeElement;
  }

  render(state, nextAction = null) {
    this.renderCoordinateLabels(state);
    this.renderGrid(state);
    this.renderStats(state, nextAction);
  }

  renderCoordinateLabels(state) {
    const { map } = state;

    if (this.columnLabelsElement) {
      this.columnLabelsElement.innerHTML = "";
      this.columnLabelsElement.style.gridTemplateColumns = `repeat(${map.grid_size_x}, minmax(0, 1fr))`;

      for (let x = 0; x < map.grid_size_x; x += 1) {
        const label = document.createElement("div");
        label.className = "axis-label";
        label.textContent = getColumnLabel(x);
        this.columnLabelsElement.appendChild(label);
      }
    }

    if (this.rowLabelsElement) {
      this.rowLabelsElement.innerHTML = "";
      this.rowLabelsElement.style.gridTemplateRows = `repeat(${map.grid_size_y}, minmax(0, 1fr))`;

      for (let y = 0; y < map.grid_size_y; y += 1) {
        const label = document.createElement("div");
        label.className = "axis-label";
        label.textContent = `${y + 1}`;
        this.rowLabelsElement.appendChild(label);
      }
    }
  }

  renderGrid(state) {
    const { robot, map } = state;
    this.gridElement.innerHTML = "";
    this.gridElement.style.gridTemplateColumns = `repeat(${map.grid_size_x}, minmax(0, 1fr))`;
    this.gridElement.style.gridTemplateRows = `repeat(${map.grid_size_y}, minmax(0, 1fr))`;
    this.gridElement.style.aspectRatio = `${map.grid_size_x} / ${map.grid_size_y}`;

    for (let y = 0; y < map.grid_size_y; y += 1) {
      for (let x = 0; x < map.grid_size_x; x += 1) {
        const position = { x, y };
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.title = `${formatGridCoordinate(position)} (${x}, ${y})`;
        cell.dataset.x = `${x}`;
        cell.dataset.y = `${y}`;

        const hasObstacle = map.obstaclePositions.some((item) => samePosition(item, position));
        const hasTrash = map.trashPositions.some((item) => samePosition(item, position));
        const hasCharger = samePosition(position, map.chargingStation);
        const hasTrashCan = samePosition(position, map.trashCan);
        const hasRobot = samePosition(position, robot);

        if (hasObstacle) {
          cell.classList.add("obstacle");
        }

        if (hasTrash) {
          cell.classList.add("trash");
        }

        if (hasCharger) {
          cell.classList.add("charger");
        }

        if (hasTrashCan) {
          cell.classList.add("trash-can");
        }

        if (hasRobot) {
          cell.classList.add("robot");
        }

        const iconInfo = getCellIcon({ hasRobot, hasObstacle, hasTrash, hasCharger, hasTrashCan });

        if (iconInfo) {
          cell.classList.add("has-icon");
          cell.appendChild(createIconElement(iconInfo));
        }

        this.gridElement.appendChild(cell);
      }
    }
  }

  renderStats(state, nextAction) {
    const { robot, map } = state;
    setText(this.batteryElement, `${formatNumber(robot.battery)}%`);
    setText(this.capacityElement, `${robot.capacity} / ${robot.maxCapacity}`);
    setText(this.positionElement, `${formatGridCoordinate(robot)} (${robot.x}, ${robot.y})`);
    setText(this.doneElement, map.done ? "true" : "false");
    setText(this.stepsElement, `${state.steps}`);
    setText(this.latestActionElement, formatAction(state.latestAction));
    setText(this.nextActionElement, formatAction(nextAction));
    setText(this.latestLogElement, state.latestLog);
    setText(this.statusBadgeElement, map.done ? "Done" : "Ready");
  }
}

export function formatAction(action) {
  return action === null || action === undefined ? "-" : `${action}`;
}

export function formatNumber(value) {
  return Number.isInteger(value) ? `${value}` : `${Number(value.toFixed(2))}`;
}

export function getColumnLabel(index) {
  let current = index;
  let label = "";

  do {
    label = String.fromCharCode(65 + (current % 26)) + label;
    current = Math.floor(current / 26) - 1;
  } while (current >= 0);

  return label;
}

export function formatGridCoordinate(position) {
  return `${getColumnLabel(position.x)}${position.y + 1}`;
}

function getCellIcon({ hasRobot, hasObstacle, hasTrash, hasCharger, hasTrashCan }) {
  if (hasRobot) return { src: CELL_ICONS.robot, alt: "Robot" };
  if (hasObstacle) return { src: CELL_ICONS.obstacle, alt: "Obstacle" };
  if (hasTrash) return { src: CELL_ICONS.trash, alt: "Trash" };
  if (hasCharger) return { src: CELL_ICONS.charger, alt: "Charging station" };
  if (hasTrashCan) return { src: CELL_ICONS.trashCan, alt: "Trash can" };
  return null;
}

function createIconElement({ src, alt }) {
  const icon = document.createElement("img");
  icon.className = "cell-icon";
  icon.src = src;
  icon.alt = alt;
  icon.draggable = false;
  return icon;
}

function setText(element, value) {
  if (element) {
    element.textContent = value;
  }
}

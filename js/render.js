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
    batteryElement,
    capacityElement,
    positionElement,
    doneElement,
    stepsElement,
    latestLogElement,
    latestActionElement,
    nextActionElement,
    statusBadgeElement,
  }) {
    this.gridElement = gridElement;
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
    this.renderGrid(state);
    this.renderStats(state, nextAction);
  }

  renderGrid(state) {
    const { robot, map } = state;
    this.gridElement.innerHTML = "";
    this.gridElement.style.gridTemplateColumns = `repeat(${map.grid_size_x}, minmax(0, 1fr))`;
    this.gridElement.style.gridTemplateRows = `repeat(${map.grid_size_y}, minmax(0, 1fr))`;
    this.gridElement.style.aspectRatio = `${map.grid_size_x} / ${map.grid_size_y}`;

    for (let y = 0; y < map.grid_size_y; y += 1) {
      for (let x = 0; x < map.grid_size_x; x += 1) {
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.title = `(${x}, ${y})`;
        cell.dataset.x = `${x}`;
        cell.dataset.y = `${y}`;

        const hasObstacle = map.obstaclePositions.some((position) => position.x === x && position.y === y);
        const hasTrash = map.trashPositions.some((position) => position.x === x && position.y === y);
        const hasCharger = samePosition({ x, y }, map.chargingStation);
        const hasTrashCan = samePosition({ x, y }, map.trashCan);
        const hasRobot = samePosition({ x, y }, robot);

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
    this.batteryElement.textContent = `${formatNumber(robot.battery)}%`;
    this.capacityElement.textContent = `${robot.capacity} / ${robot.maxCapacity}`;
    this.positionElement.textContent = `(${robot.x}, ${robot.y})`;
    this.doneElement.textContent = map.done ? "true" : "false";
    this.stepsElement.textContent = `${state.steps}`;
    this.latestActionElement.textContent = formatAction(state.latestAction);
    this.nextActionElement.textContent = formatAction(nextAction);
    this.latestLogElement.textContent = state.latestLog;
    this.statusBadgeElement.textContent = map.done ? "Done" : "Ready";
  }
}

function formatAction(action) {
  return action === null || action === undefined ? "-" : `${action}`;
}

function formatNumber(value) {
  return Number.isInteger(value) ? `${value}` : `${Number(value.toFixed(2))}`;
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

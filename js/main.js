import { Environment } from "./environment.js";
import { Simulator } from "./simulator.js";
import { Renderer } from "./render.js";
import { algorithmRegistry, createAlgorithm } from "./algorithms/registry.js";

document.body.classList.add("js-ready");

const elements = {
  gridMap: document.getElementById("gridMap"),
  algorithmSelect: document.getElementById("algorithmSelect"),
  editToolSelect: document.getElementById("editToolSelect"),
  mapWidthInput: document.getElementById("mapWidthInput"),
  mapHeightInput: document.getElementById("mapHeightInput"),
  trashCountInput: document.getElementById("trashCountInput"),
  obstacleCountInput: document.getElementById("obstacleCountInput"),
  maxCapacityInput: document.getElementById("maxCapacityInput"),
  batteryLossInput: document.getElementById("batteryLossInput"),
  generateButton: document.getElementById("generateButton"),
  resetButton: document.getElementById("resetButton"),
  previousStepButton: document.getElementById("previousStepButton"),
  nextStepButton: document.getElementById("nextStepButton"),
  runButton: document.getElementById("runButton"),
  stopButton: document.getElementById("stopButton"),
  speedButtons: document.querySelectorAll(".speed-button"),
  batteryValue: document.getElementById("batteryValue"),
  capacityValue: document.getElementById("capacityValue"),
  positionValue: document.getElementById("positionValue"),
  doneValue: document.getElementById("doneValue"),
  stepsValue: document.getElementById("stepsValue"),
  latestLog: document.getElementById("latestLog"),
  latestActionValue: document.getElementById("latestActionValue"),
  nextActionValue: document.getElementById("nextActionValue"),
  positionHistoryBody: document.getElementById("positionHistoryBody"),
  statusBadge: document.getElementById("statusBadge"),
};

const environment = new Environment();
const renderer = new Renderer({
  gridElement: elements.gridMap,
  batteryElement: elements.batteryValue,
  capacityElement: elements.capacityValue,
  positionElement: elements.positionValue,
  doneElement: elements.doneValue,
  stepsElement: elements.stepsValue,
  latestLogElement: elements.latestLog,
  latestActionElement: elements.latestActionValue,
  nextActionElement: elements.nextActionValue,
  statusBadgeElement: elements.statusBadge,
});

let simulator = null;

function getMapConfigFromInputs() {
  updateCountLimitsFromInputs();

  return {
    gridSizeX: elements.mapWidthInput.value,
    gridSizeY: elements.mapHeightInput.value,
    trashCount: elements.trashCountInput.value,
    obstacleCount: elements.obstacleCountInput.value,
    maxCapacity: elements.maxCapacityInput.value,
    batteryLoss: elements.batteryLossInput.value,
  };
}

function renderAlgorithmOptions() {
  elements.algorithmSelect.innerHTML = "";

  algorithmRegistry.forEach((algorithm) => {
    const option = document.createElement("option");
    option.value = algorithm.id;
    option.textContent = algorithm.label;
    elements.algorithmSelect.appendChild(option);
  });
}

async function createSelectedAlgorithm() {
  return createAlgorithm(elements.algorithmSelect.value);
}

function updateButtonState() {
  const isReady = simulator !== null;
  const isRunning = isReady && simulator.isRunning();

  elements.runButton.disabled = !isReady || isRunning;
  elements.previousStepButton.disabled = !isReady || isRunning || !simulator.canStepBack();
  elements.nextStepButton.disabled = !isReady || isRunning;
  elements.generateButton.disabled = !isReady || isRunning;
  elements.resetButton.disabled = !isReady;
  elements.algorithmSelect.disabled = !isReady || isRunning;
  elements.editToolSelect.disabled = !isReady || isRunning;
  elements.mapWidthInput.disabled = !isReady || isRunning;
  elements.mapHeightInput.disabled = !isReady || isRunning;
  elements.trashCountInput.disabled = !isReady || isRunning;
  elements.obstacleCountInput.disabled = !isReady || isRunning;
  elements.maxCapacityInput.disabled = !isReady || isRunning;
  elements.batteryLossInput.disabled = !isReady || isRunning;
  elements.stopButton.disabled = !isRunning;
}

function syncConfigFromInputs() {
  if (!simulator || simulator.isRunning()) {
    return;
  }

  updateCountLimitsFromInputs();
  simulator.updateConfig(getMapConfigFromInputs());
  updateInputsFromState(environment.getState());
}

function handleStateChange(state) {
  const nextAction = simulator && !state.map.done ? simulator.peekNextAction() : null;
  renderer.render(state, nextAction);
  renderPositionHistory();
  updateButtonState();
}

async function bindEvents() {
  elements.algorithmSelect.addEventListener("change", async () => {
    simulator.setAlgorithm(await createSelectedAlgorithm());
    handleStateChange(environment.getState());
    updateButtonState();
  });

  elements.generateButton.addEventListener("click", () => {
    simulator.generate(getMapConfigFromInputs());
    updateInputsFromState(environment.getState());
    updateButtonState();
  });

  elements.resetButton.addEventListener("click", () => {
    simulator.reset();
    updateButtonState();
  });

  elements.previousStepButton.addEventListener("click", () => {
    simulator.previousStep();
    updateButtonState();
  });

  elements.nextStepButton.addEventListener("click", () => {
    simulator.step();
    updateButtonState();
  });

  elements.runButton.addEventListener("click", () => {
    syncConfigFromInputs();
    simulator.run();
    updateButtonState();
  });

  elements.stopButton.addEventListener("click", () => {
    simulator.stop();
    updateButtonState();
  });

  elements.speedButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const speed = Number.parseInt(button.dataset.speed, 10);
      simulator.setSpeedMultiplier(speed);
      setActiveSpeedButton(button);
      updateButtonState();
    });
  });

  elements.gridMap.addEventListener("click", (event) => {
    const cell = event.target.closest(".cell");

    if (!cell || simulator.isRunning()) {
      return;
    }

    const x = Number.parseInt(cell.dataset.x, 10);
    const y = Number.parseInt(cell.dataset.y, 10);
    const nextState = environment.applyMapEdit(elements.editToolSelect.value, x, y);
    environment.saveCurrentAsInitialState();
    simulator.algorithm.reset();
    simulator.clearNextActionCache();
    simulator.clearHistory();
    simulator.resetPositionHistory(nextState);
    renderer.render(nextState, simulator.peekNextAction());
    renderPositionHistory();
    updateCountInputs(nextState);
    updateButtonState();
  });

  elements.gridMap.addEventListener("mouseover", (event) => {
    const cell = event.target.closest(".cell");

    if (!cell || elements.editToolSelect.value !== "inspect" || simulator.isRunning()) {
      return;
    }

    renderCellInspection(cell);
  });

  elements.gridMap.addEventListener("mouseleave", () => {
    if (elements.editToolSelect.value !== "inspect" || simulator.isRunning()) {
      return;
    }

    elements.latestLog.textContent = environment.getState().latestLog;
  });

  [
    elements.mapWidthInput,
    elements.mapHeightInput,
    elements.trashCountInput,
    elements.obstacleCountInput,
    elements.maxCapacityInput,
    elements.batteryLossInput,
  ].forEach((input) => {
    input.addEventListener("change", syncConfigFromInputs);
  });
}

function renderCellInspection(cell) {
  const x = Number.parseInt(cell.dataset.x, 10);
  const y = Number.parseInt(cell.dataset.y, 10);
  elements.latestLog.textContent = environment.getCellInfo(x, y);
}

function renderPositionHistory() {
  const history = simulator ? simulator.getPositionHistory() : [];
  elements.positionHistoryBody.innerHTML = "";

  if (history.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.textContent = "No history yet.";
    row.appendChild(cell);
    elements.positionHistoryBody.appendChild(row);
    return;
  }

  history.forEach((entry) => {
    const row = document.createElement("tr");
    [
      `${entry.step}`,
      formatAction(entry.action),
      `(${entry.x}, ${entry.y})`,
      `${formatNumber(entry.battery)}%`,
      `${entry.capacity}/${entry.maxCapacity}`,
    ].forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.appendChild(cell);
    });
    elements.positionHistoryBody.appendChild(row);
  });
}

function setActiveSpeedButton(activeButton) {
  elements.speedButtons.forEach((button) => {
    button.classList.toggle("active", button === activeButton);
  });
}

function updateCountInputs(state) {
  elements.trashCountInput.value = `${state.map.trashPositions.length}`;
  elements.obstacleCountInput.value = `${state.map.obstaclePositions.length}`;
  updateCountLimitsFromInputs();
}

function updateInputsFromState(state) {
  elements.mapWidthInput.value = `${state.map.grid_size_x}`;
  elements.mapHeightInput.value = `${state.map.grid_size_y}`;
  elements.trashCountInput.value = `${state.map.trashPositions.length}`;
  elements.obstacleCountInput.value = `${state.map.obstaclePositions.length}`;
  elements.maxCapacityInput.value = `${state.robot.maxCapacity}`;
  elements.batteryLossInput.value = `${state.config.batteryLoss}`;
  updateCountLimitsFromInputs();
}

function updateCountLimitsFromInputs() {
  const gridSizeX = clampInteger(
    elements.mapWidthInput.value,
    Number.parseInt(elements.mapWidthInput.min, 10),
    Number.parseInt(elements.mapWidthInput.max, 10)
  );
  const gridSizeY = clampInteger(
    elements.mapHeightInput.value,
    Number.parseInt(elements.mapHeightInput.min, 10),
    Number.parseInt(elements.mapHeightInput.max, 10)
  );
  const usableCellCount = Math.max(0, gridSizeX * gridSizeY - 2);
  const obstacleCount = clampInteger(
    elements.obstacleCountInput.value,
    0,
    usableCellCount
  );
  const maxTrashCount = Math.max(0, usableCellCount - obstacleCount);
  const trashCount = clampInteger(
    elements.trashCountInput.value,
    0,
    maxTrashCount
  );

  elements.mapWidthInput.value = `${gridSizeX}`;
  elements.mapHeightInput.value = `${gridSizeY}`;
  elements.obstacleCountInput.max = `${usableCellCount}`;
  elements.obstacleCountInput.value = `${obstacleCount}`;
  elements.trashCountInput.max = `${maxTrashCount}`;
  elements.trashCountInput.value = `${trashCount}`;
}

function formatAction(action) {
  return action === null || action === undefined ? "-" : `${action}`;
}

function formatNumber(value) {
  return Number.isInteger(value) ? `${value}` : `${Number(value.toFixed(2))}`;
}

function clampInteger(value, min, max) {
  const numberValue = Number.parseInt(value, 10);

  if (Number.isNaN(numberValue)) {
    return min;
  }

  return Math.min(max, Math.max(min, numberValue));
}

async function init() {
  renderAlgorithmOptions();
  updateButtonState();

  simulator = new Simulator({
    environment,
    algorithm: await createSelectedAlgorithm(),
    onStateChange: handleStateChange,
  });

  bindEvents();
  handleStateChange(environment.getState());
  updateInputsFromState(environment.getState());
  updateButtonState();
}

init().catch((error) => {
  console.error(error);
  elements.statusBadge.textContent = "Error";
  elements.latestLog.textContent = "Cannot start simulator. Check Console for module import errors.";
  updateButtonState();
});

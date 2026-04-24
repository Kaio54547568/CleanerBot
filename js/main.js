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
  stepButton: document.getElementById("stepButton"),
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
  elements.stepButton.disabled = !isReady || isRunning;
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

function handleStateChange(state) {
  const nextAction = simulator && !state.map.done ? simulator.peekNextAction() : null;
  renderer.render(state, nextAction);
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
    updateButtonState();
  });

  elements.resetButton.addEventListener("click", () => {
    simulator.reset();
    updateButtonState();
  });

  elements.stepButton.addEventListener("click", () => {
    simulator.step();
    updateButtonState();
  });

  elements.nextStepButton.addEventListener("click", () => {
    simulator.step();
    updateButtonState();
  });

  elements.runButton.addEventListener("click", () => {
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
    renderer.render(nextState, simulator.peekNextAction());
    updateCountInputs(nextState);
    updateButtonState();
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
  updateButtonState();
}

init().catch((error) => {
  console.error(error);
  elements.statusBadge.textContent = "Error";
  elements.latestLog.textContent = "Cannot start simulator. Check Console for module import errors.";
  updateButtonState();
});

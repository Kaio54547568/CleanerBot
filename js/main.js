import { Environment } from "./environment.js";
import { simulationStateToPlain } from "./models.js";
import { Simulator } from "./simulator.js";
import { Renderer, formatAction, formatGridCoordinate, formatNumber } from "./render.js";
import { algorithmRegistry, createAlgorithm } from "./algorithms/registry.js";

const COMPARE_STATE_STORAGE_KEY = "cleanerbot.compare.initialState";

document.body.classList.add("js-ready");

const elements = {
  gridMap: document.getElementById("gridMap"),
  gridColumnLabels: document.getElementById("gridColumnLabels"),
  gridRowLabels: document.getElementById("gridRowLabels"),
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
  compareButton: document.getElementById("compareButton"),
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
  runtimeValue: document.getElementById("runtimeValue"),
  visitedNodesValue: document.getElementById("visitedNodesValue"),
  requiredMemoryValue: document.getElementById("requiredMemoryValue"),
  batteryConsumedValue: document.getElementById("batteryConsumedValue"),
  heuristicDescription: document.getElementById("heuristicDescription"),
  algorithmTrace: document.getElementById("algorithmTrace"),
  statusBadge: document.getElementById("statusBadge"),
};

const environment = new Environment();
const renderer = new Renderer({
  gridElement: elements.gridMap,
  columnLabelsElement: elements.gridColumnLabels,
  rowLabelsElement: elements.gridRowLabels,
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
let renderedTraceCount = 0;
let renderedHeuristicDescription = "";
let renderedTraceSignature = "";

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
  elements.compareButton.disabled = !isReady || isRunning;
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
  updateInputsFromState(environment.getInitialState());
}

function handleStateChange(state) {
  const nextAction = simulator && !state.map.done ? simulator.peekNextAction() : null;
  renderer.render(state, nextAction);
  renderPositionHistory();
  renderAlgorithmMetrics();
  renderAlgorithmTrace();
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
    updateInputsFromState(environment.getInitialState());
    updateButtonState();
  });

  elements.resetButton.addEventListener("click", () => {
    simulator.reset();
    updateInputsFromState(environment.getInitialState());
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

  elements.compareButton.addEventListener("click", () => {
    saveCompareState();
    window.location.href = "compare.html";
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
    simulator.resetPositionHistory(nextState, null);
    renderer.render(nextState, simulator.peekNextAction());
    renderPositionHistory();
    renderAlgorithmMetrics();
    renderAlgorithmTrace();
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
      `${formatGridCoordinate(entry)} (${entry.x}, ${entry.y})`,
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

function renderAlgorithmMetrics() {
  const metrics = simulator?.getAlgorithmMetrics();

  if (!metrics) {
    elements.runtimeValue.textContent = "0 ms";
    elements.visitedNodesValue.textContent = "0";
    elements.requiredMemoryValue.textContent = "0 nodes";
    elements.batteryConsumedValue.textContent = "0";
    return;
  }

  elements.runtimeValue.textContent = `${formatNumber(metrics.runtimeMs)} ms`;
  elements.visitedNodesValue.textContent = `${metrics.visitedNodes}`;
  elements.requiredMemoryValue.textContent = `${metrics.peakMemory} nodes`;
  elements.batteryConsumedValue.textContent = `${formatNumber(metrics.batteryConsumed)}`;
}

function renderAlgorithmTrace() {
  const metrics = simulator?.getAlgorithmMetrics();
  const trace = metrics?.trace ?? [];
  const heuristicDescription = metrics?.heuristicDescription ?? "Heuristic: not available.";
  const traceSignature = getTraceSignature(trace, heuristicDescription);

  if (
    trace.length < renderedTraceCount ||
    heuristicDescription !== renderedHeuristicDescription ||
    (trace.length === renderedTraceCount && traceSignature !== renderedTraceSignature)
  ) {
    elements.algorithmTrace.innerHTML = "";
    renderedTraceCount = 0;
  }

  elements.heuristicDescription.textContent = heuristicDescription;
  renderedHeuristicDescription = heuristicDescription;

  if (trace.length === 0) {
    elements.algorithmTrace.innerHTML = "";
    const empty = document.createElement("p");
    empty.className = "trace-empty";
    empty.textContent = "No trace yet.";
    elements.algorithmTrace.appendChild(empty);
    renderedTraceCount = 0;
    renderedTraceSignature = "";
    return;
  }

  if (renderedTraceCount === 0) {
    elements.algorithmTrace.innerHTML = "";
  }

  trace.slice(renderedTraceCount).forEach((entry) => {
    elements.algorithmTrace.appendChild(createTraceEntry(entry));
  });

  renderedTraceCount = trace.length;
  renderedTraceSignature = traceSignature;
}

function createTraceEntry(entry) {
  const wrapper = document.createElement("article");
  wrapper.className = "trace-entry";

  const title = document.createElement("p");
  title.className = "trace-title";
  title.textContent = `Step ${entry.order}: Visit ${entry.label}`;
  wrapper.appendChild(title);

  if (entry.g !== null && entry.h !== null && entry.f !== null && entry.goal) {
    wrapper.appendChild(createTraceLine(`g(${entry.label}) = ${entry.g}`));
    wrapper.appendChild(createTraceLine(
      `h(${entry.label}) = |${entry.goal.x} - ${entry.position.x}| + |${entry.goal.y} - ${entry.position.y}| = ${entry.h}`
    ));
    wrapper.appendChild(createTraceLine(
      `f(${entry.label}) = g(${entry.label}) + h(${entry.label}) = ${entry.g} + ${entry.h} = ${entry.f}`
    ));
  }

  if (entry.note) {
    wrapper.appendChild(createTraceLine(entry.note));
  }

  return wrapper;
}

function createTraceLine(text) {
  const line = document.createElement("p");
  line.className = "trace-line";
  line.textContent = text;
  return line;
}

function saveCompareState() {
  window.sessionStorage.setItem(
    COMPARE_STATE_STORAGE_KEY,
    JSON.stringify(simulationStateToPlain(environment.getInitialState()))
  );
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

function clampInteger(value, min, max) {
  const numberValue = Number.parseInt(value, 10);

  if (Number.isNaN(numberValue)) {
    return min;
  }

  return Math.min(max, Math.max(min, numberValue));
}

function getTraceSignature(trace, heuristicDescription) {
  const firstEntry = trace[0];
  const lastEntry = trace[trace.length - 1];

  return [
    heuristicDescription,
    trace.length,
    firstEntry?.label ?? "",
    lastEntry?.label ?? "",
    lastEntry?.g ?? "",
    lastEntry?.h ?? "",
    lastEntry?.f ?? "",
  ].join("|");
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
  updateInputsFromState(environment.getInitialState());
  updateButtonState();
}

init().catch((error) => {
  console.error(error);
  elements.statusBadge.textContent = "Error";
  elements.latestLog.textContent = "Cannot start simulator. Check Console for module import errors.";
  updateButtonState();
});

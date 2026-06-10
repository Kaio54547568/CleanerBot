import { Environment } from "./environment.js";
import { simulationStateToPlain } from "./models.js";
import { Simulator } from "./simulator.js";
import { Renderer, formatAction, formatGridCoordinate, formatNumber } from "./render.js";
import { algorithmRegistry, createAlgorithm } from "./algorithms/registry.js";
import { createAlgorithmComparisonMap10x10 } from "./sampleMaps.js";
import {
  createTemplateRecord,
  loadBuiltinTemplates,
  readUserTemplates,
  sanitizeTemplateName,
  writeUserTemplates,
} from "./templates.js";

const COMPARE_STATE_STORAGE_KEY = "cleanerbot.compare.initialState";
const EDITOR_STATE_STORAGE_KEY = "cleanerbot.editor.state";
const HIDDEN_BUILTIN_TEMPLATES_STORAGE_KEY = "cleanerbot.templates.hiddenBuiltins.v1";
const HISTORY_RENDER_LIMIT = 20;
const TRACE_RENDER_LIMIT = 20;

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
  templatesButton: document.getElementById("templatesButton"),
  loadDemoMapButton: document.getElementById("loadDemoMapButton"),
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
  positionHistoryWrap: document.getElementById("positionHistoryWrap"),
  positionHistorySummary: document.getElementById("positionHistorySummary"),
  positionHistoryBody: document.getElementById("positionHistoryBody"),
  runtimeValue: document.getElementById("runtimeValue"),
  visitedNodesValue: document.getElementById("visitedNodesValue"),
  requiredMemoryValue: document.getElementById("requiredMemoryValue"),
  batteryConsumedValue: document.getElementById("batteryConsumedValue"),
  heuristicDescription: document.getElementById("heuristicDescription"),
  algorithmTrace: document.getElementById("algorithmTrace"),
  tracePopup: document.getElementById("tracePopup"),
  traceToggleButton: document.getElementById("traceToggleButton"),
  statusBadge: document.getElementById("statusBadge"),
  templatesDialog: document.getElementById("templatesDialog"),
  templatesList: document.getElementById("templatesList"),
  closeTemplatesButton: document.getElementById("closeTemplatesButton"),
  addTemplateButton: document.getElementById("addTemplateButton"),
  saveTemplateDialog: document.getElementById("saveTemplateDialog"),
  closeSaveTemplateButton: document.getElementById("closeSaveTemplateButton"),
  templateNameInput: document.getElementById("templateNameInput"),
  templateCapacityInput: document.getElementById("templateCapacityInput"),
  templateBatteryInput: document.getElementById("templateBatteryInput"),
  saveTemplateMessage: document.getElementById("saveTemplateMessage"),
  confirmSaveTemplateButton: document.getElementById("confirmSaveTemplateButton"),
  deleteTemplateDialog: document.getElementById("deleteTemplateDialog"),
  closeDeleteTemplateButton: document.getElementById("closeDeleteTemplateButton"),
  cancelDeleteTemplateButton: document.getElementById("cancelDeleteTemplateButton"),
  confirmDeleteTemplateButton: document.getElementById("confirmDeleteTemplateButton"),
  deleteTemplateMessage: document.getElementById("deleteTemplateMessage"),
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
let renderedTraceSignature = "";
let builtinTemplates = [];
let pendingDeleteTemplate = null;

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
  elements.loadDemoMapButton.disabled = !isReady || isRunning;
  elements.templatesButton.disabled = !isReady || isRunning;
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
  renderer.render(state, nextAction, simulator?.getCurrentTarget());
  renderPositionHistory();
  renderAlgorithmMetrics();
  renderAlgorithmTrace();
  updateButtonState();
  saveEditorState();
}

async function bindEvents() {
  elements.traceToggleButton.addEventListener("click", () => {
    setTracePopupOpen(elements.tracePopup.hidden);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || elements.tracePopup.hidden) {
      return;
    }

    setTracePopupOpen(false);
    elements.traceToggleButton.focus();
  });

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

  elements.loadDemoMapButton.addEventListener("click", () => {
    simulator.loadState(createAlgorithmComparisonMap10x10());
    updateInputsFromState(environment.getInitialState());
    updateButtonState();
  });

  elements.templatesButton.addEventListener("click", () => {
    renderTemplatesList();
    openDialog(elements.templatesDialog);
  });

  elements.closeTemplatesButton.addEventListener("click", () => {
    elements.templatesDialog.close();
  });

  elements.addTemplateButton.addEventListener("click", () => {
    openSaveTemplateDialog();
  });

  elements.closeSaveTemplateButton.addEventListener("click", () => {
    elements.saveTemplateDialog.close();
  });

  elements.confirmSaveTemplateButton.addEventListener("click", () => {
    saveCurrentMapAsTemplate();
  });

  elements.closeDeleteTemplateButton.addEventListener("click", () => {
    closeDeleteTemplateDialog();
  });

  elements.cancelDeleteTemplateButton.addEventListener("click", () => {
    closeDeleteTemplateDialog();
  });

  elements.confirmDeleteTemplateButton.addEventListener("click", () => {
    deletePendingTemplate();
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
    renderer.render(nextState, simulator.peekNextAction(), simulator.getCurrentTarget());
    renderPositionHistory();
    renderAlgorithmMetrics();
    renderAlgorithmTrace();
    updateCountInputs(nextState);
    updateButtonState();
    saveEditorState();
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
  const history = simulator
    ? simulator.getPositionHistorySlice(HISTORY_RENDER_LIMIT)
    : [];
  const totalHistoryEntries = simulator ? simulator.getPositionHistoryCount() : 0;
  elements.positionHistoryBody.innerHTML = "";
  elements.positionHistorySummary.textContent = "";

  if (history.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.textContent = "No history yet.";
    row.appendChild(cell);
    elements.positionHistoryBody.appendChild(row);
    return;
  }

  if (totalHistoryEntries > history.length) {
    elements.positionHistorySummary.textContent =
      `Showing latest ${history.length} of ${totalHistoryEntries} positions.`;
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

  scrollToBottom(elements.positionHistoryWrap);
}

function renderAlgorithmMetrics() {
  const metrics = simulator?.getAlgorithmMetricSummary();

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
  const metrics = simulator?.getAlgorithmMetricSummary();
  const trace = simulator?.getAlgorithmTraceSlice(TRACE_RENDER_LIMIT) ?? [];
  const heuristicDescription = metrics?.heuristicDescription ?? "Heuristic: not available.";
  const traceSignature = getTraceSignature(trace, heuristicDescription, metrics);

  if (traceSignature === renderedTraceSignature) {
    return;
  }

  elements.heuristicDescription.textContent = heuristicDescription;
  elements.algorithmTrace.innerHTML = "";

  if (trace.length === 0) {
    const empty = document.createElement("p");
    empty.className = "trace-empty";
    empty.textContent = "No trace yet.";
    elements.algorithmTrace.appendChild(empty);
    renderedTraceSignature = traceSignature;
    return;
  }

  const fragment = document.createDocumentFragment();

  if (metrics && metrics.visitedNodes > trace.length) {
    const summary = document.createElement("p");
    summary.className = "trace-empty";
    summary.textContent = `Showing latest ${trace.length} of ${metrics.visitedNodes} visits.`;
    fragment.appendChild(summary);
  }

  trace.forEach((entry) => {
    fragment.appendChild(createTraceEntry(entry));
  });

  elements.algorithmTrace.appendChild(fragment);
  renderedTraceSignature = traceSignature;
  scrollToBottom(elements.algorithmTrace);
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

function scrollToBottom(element) {
  if (!element) {
    return;
  }

  element.scrollTop = element.scrollHeight;
}

function setTracePopupOpen(isOpen) {
  elements.tracePopup.hidden = !isOpen;
  elements.traceToggleButton.textContent = isOpen ? "Close" : "Expand";
  elements.traceToggleButton.setAttribute("aria-expanded", `${isOpen}`);
}

function saveCompareState() {
  const state = environment.getInitialState();
  const stateJson = JSON.stringify(simulationStateToPlain(state));
  window.sessionStorage.setItem(COMPARE_STATE_STORAGE_KEY, stateJson);
  window.sessionStorage.setItem(EDITOR_STATE_STORAGE_KEY, stateJson);
}

function saveEditorState(state = environment.getInitialState()) {
  window.sessionStorage.setItem(
    EDITOR_STATE_STORAGE_KEY,
    JSON.stringify(simulationStateToPlain(state))
  );
}

function loadSavedEditorState() {
  const storedState = window.sessionStorage.getItem(EDITOR_STATE_STORAGE_KEY);

  if (!storedState) {
    return false;
  }

  try {
    environment.loadState(JSON.parse(storedState));
    return true;
  } catch (error) {
    console.warn("Cannot restore editor state.", error);
    return false;
  }
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

function getTraceSignature(trace, heuristicDescription, metrics = null) {
  const firstEntry = trace[0];
  const lastEntry = trace[trace.length - 1];

  return [
    heuristicDescription,
    metrics?.visitedNodes ?? 0,
    trace.length,
    firstEntry?.order ?? "",
    lastEntry?.order ?? "",
    lastEntry?.g ?? "",
    lastEntry?.h ?? "",
    lastEntry?.f ?? "",
  ].join("|");
}

async function refreshTemplates() {
  const hiddenBuiltinIds = readHiddenBuiltinTemplateIds();
  builtinTemplates = (await loadBuiltinTemplates()).filter((template) => {
    return !hiddenBuiltinIds.includes(template.id);
  });
  renderTemplatesList();
}

function getAvailableTemplates() {
  return [...builtinTemplates, ...readUserTemplates()];
}

function renderTemplatesList() {
  const templates = getAvailableTemplates();
  elements.templatesList.innerHTML = "";

  if (templates.length === 0) {
    const empty = document.createElement("p");
    empty.className = "templates-empty";
    empty.textContent = "No templates saved yet.";
    elements.templatesList.appendChild(empty);
    return;
  }

  templates.forEach((template) => {
    const item = document.createElement("article");
    item.className = "template-tab";

    const title = document.createElement("p");
    title.className = "template-tab-title";
    title.textContent = template.name;
    item.appendChild(title);

    const actions = document.createElement("div");
    actions.className = "template-tab-actions";

    const playButton = document.createElement("button");
    playButton.className = "icon-button play-template-button";
    playButton.type = "button";
    playButton.textContent = "Play";
    playButton.setAttribute("aria-label", `Load ${template.name}`);
    playButton.addEventListener("click", () => {
      loadTemplate(template);
    });
    actions.appendChild(playButton);

    const deleteButton = document.createElement("button");
    deleteButton.className = "icon-button delete-template-button";
    deleteButton.type = "button";
    deleteButton.textContent = "X";
    deleteButton.setAttribute("aria-label", `Delete ${template.name}`);
    deleteButton.addEventListener("click", () => {
      openDeleteTemplateDialog(template);
    });
    actions.appendChild(deleteButton);

    item.appendChild(actions);
    elements.templatesList.appendChild(item);
  });
}

function loadTemplate(template) {
  const state = simulationStateToPlain(template.state);
  state.latestLog = `Loaded template "${template.name}".`;
  simulator.loadState(state);
  updateInputsFromState(environment.getInitialState());
  saveEditorState(environment.getInitialState());
  elements.templatesDialog.close();
}

function openSaveTemplateDialog() {
  const state = environment.getState();
  elements.templateNameInput.value = "";
  elements.templateCapacityInput.value = `${state.robot.maxCapacity}`;
  elements.templateBatteryInput.value = `${Math.round(state.robot.battery)}`;
  elements.saveTemplateMessage.textContent = "";
  openDialog(elements.saveTemplateDialog);
  elements.templateNameInput.focus();
}

function saveCurrentMapAsTemplate() {
  const name = sanitizeTemplateName(elements.templateNameInput.value);

  if (!name) {
    elements.saveTemplateMessage.textContent = "Please enter a template name.";
    elements.templateNameInput.focus();
    return;
  }

  const templates = readUserTemplates();
  templates.push(createTemplateRecord({
    name,
    state: environment.getState(),
    maxCapacity: elements.templateCapacityInput.value,
    battery: elements.templateBatteryInput.value,
  }));
  writeUserTemplates(templates);
  elements.saveTemplateDialog.close();
  renderTemplatesList();
}

function openDeleteTemplateDialog(template) {
  pendingDeleteTemplate = template;
  elements.deleteTemplateMessage.textContent =
    `Are you sure you want to delete "${template.name}"?`;
  openDialog(elements.deleteTemplateDialog);
}

function closeDeleteTemplateDialog() {
  pendingDeleteTemplate = null;
  elements.deleteTemplateDialog.close();
}

function deletePendingTemplate() {
  if (!pendingDeleteTemplate) {
    return;
  }

  if (pendingDeleteTemplate.readonly) {
    const hiddenIds = readHiddenBuiltinTemplateIds();
    writeHiddenBuiltinTemplateIds([...new Set([...hiddenIds, pendingDeleteTemplate.id])]);
    builtinTemplates = builtinTemplates.filter((template) => template.id !== pendingDeleteTemplate.id);
  } else {
    writeUserTemplates(
      readUserTemplates().filter((template) => template.id !== pendingDeleteTemplate.id)
    );
  }

  closeDeleteTemplateDialog();
  renderTemplatesList();
}

function readHiddenBuiltinTemplateIds() {
  try {
    const parsedValue = JSON.parse(
      window.localStorage.getItem(HIDDEN_BUILTIN_TEMPLATES_STORAGE_KEY) ?? "[]"
    );

    return Array.isArray(parsedValue) ? parsedValue.map(String) : [];
  } catch (error) {
    console.warn("Cannot read hidden built-in template ids.", error);
    return [];
  }
}

function writeHiddenBuiltinTemplateIds(ids) {
  window.localStorage.setItem(
    HIDDEN_BUILTIN_TEMPLATES_STORAGE_KEY,
    JSON.stringify(ids)
  );
}

function openDialog(dialog) {
  if (dialog.open) {
    return;
  }

  dialog.showModal();
}

async function init() {
  renderAlgorithmOptions();
  updateButtonState();
  loadSavedEditorState();

  simulator = new Simulator({
    environment,
    algorithm: await createSelectedAlgorithm(),
    onStateChange: handleStateChange,
  });

  await refreshTemplates();
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

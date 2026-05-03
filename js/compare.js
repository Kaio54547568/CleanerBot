import { Environment } from "./environment.js";
import { simulationStateFromPlain } from "./models.js";
import { Simulator } from "./simulator.js";
import { Renderer, formatNumber } from "./render.js";
import { createAlgorithm } from "./algorithms/registry.js";

const COMPARE_STATE_STORAGE_KEY = "cleanerbot.compare.initialState";
const COMPARE_ALGORITHMS = [
  { id: "bfs", label: "BFS" },
  { id: "dfs", label: "DFS" },
  { id: "astar", label: "A*" },
  { id: "idastar", label: "IDA*" },
];

document.body.classList.add("js-ready");

const elements = {
  compareGrid: document.getElementById("compareGrid"),
  runCompareButton: document.getElementById("runCompareButton"),
  resetCompareButton: document.getElementById("resetCompareButton"),
  backButton: document.getElementById("backButton"),
};

const compareSlots = [];

function loadSharedInitialState() {
  const storedState = window.sessionStorage.getItem(COMPARE_STATE_STORAGE_KEY);

  if (storedState) {
    try {
      return simulationStateFromPlain(JSON.parse(storedState));
    } catch (error) {
      console.warn("Cannot parse compare state from sessionStorage.", error);
    }
  }

  return new Environment().getInitialState();
}

function createCompareCard({ id, label }) {
  const article = document.createElement("article");
  article.className = "compare-card";
  article.innerHTML = `
    <div class="section-header">
      <div>
        <h2>${label}</h2>
        <p class="compare-card-subtitle">Independent run on the shared initial map.</p>
      </div>
      <div id="${id}StatusBadge" class="status-badge">Ready</div>
    </div>

    <div class="map-layout" aria-label="${label} map">
      <div class="map-corner-label" aria-hidden="true"></div>
      <div id="${id}ColumnLabels" class="map-axis map-axis-columns" aria-hidden="true"></div>
      <div id="${id}RowLabels" class="map-axis map-axis-rows" aria-hidden="true"></div>
      <div id="${id}GridMap" class="grid-map"></div>
    </div>

    <dl class="stats-list compare-metrics">
      <div>
        <dt>Runtime</dt>
        <dd id="${id}RuntimeValue">0 ms</dd>
      </div>
      <div>
        <dt>Visited nodes</dt>
        <dd id="${id}VisitedNodesValue">0</dd>
      </div>
      <div>
        <dt>Required memory</dt>
        <dd id="${id}RequiredMemoryValue">0 nodes</dd>
      </div>
      <div>
        <dt>Battery consumed</dt>
        <dd id="${id}BatteryConsumedValue">0</dd>
      </div>
      <div>
        <dt>Robot position</dt>
        <dd id="${id}PositionValue">-</dd>
      </div>
      <div>
        <dt>Steps</dt>
        <dd id="${id}StepsValue">0</dd>
      </div>
    </dl>

    <p id="${id}LatestLog" class="mini-log">No action yet.</p>
  `;

  elements.compareGrid.appendChild(article);

  return {
    article,
    gridMap: article.querySelector(`#${id}GridMap`),
    gridColumnLabels: article.querySelector(`#${id}ColumnLabels`),
    gridRowLabels: article.querySelector(`#${id}RowLabels`),
    runtimeValue: article.querySelector(`#${id}RuntimeValue`),
    visitedNodesValue: article.querySelector(`#${id}VisitedNodesValue`),
    requiredMemoryValue: article.querySelector(`#${id}RequiredMemoryValue`),
    batteryConsumedValue: article.querySelector(`#${id}BatteryConsumedValue`),
    positionValue: article.querySelector(`#${id}PositionValue`),
    stepsValue: article.querySelector(`#${id}StepsValue`),
    latestLog: article.querySelector(`#${id}LatestLog`),
    statusBadge: article.querySelector(`#${id}StatusBadge`),
  };
}

function renderCompareMetrics(slot) {
  const metrics = slot.simulator.getAlgorithmMetrics();

  slot.elements.runtimeValue.textContent = `${formatNumber(metrics.runtimeMs)} ms`;
  slot.elements.visitedNodesValue.textContent = `${metrics.visitedNodes}`;
  slot.elements.requiredMemoryValue.textContent = `${metrics.peakMemory} nodes`;
  slot.elements.batteryConsumedValue.textContent = `${formatNumber(metrics.batteryConsumed)}`;
}

function createCompareSlot(sharedInitialState, definition, cardElements) {
  const environment = new Environment();
  environment.loadState(sharedInitialState);

  return createAlgorithm(definition.id).then((algorithm) => {
    const renderer = new Renderer({
      gridElement: cardElements.gridMap,
      columnLabelsElement: cardElements.gridColumnLabels,
      rowLabelsElement: cardElements.gridRowLabels,
      positionElement: cardElements.positionValue,
      stepsElement: cardElements.stepsValue,
      latestLogElement: cardElements.latestLog,
      statusBadgeElement: cardElements.statusBadge,
    });

    const slot = {
      id: definition.id,
      label: definition.label,
      environment,
      renderer,
      algorithm,
      simulator: null,
      elements: cardElements,
    };

    slot.simulator = new Simulator({
      environment,
      algorithm,
      onStateChange: (state) => {
        const nextAction = !state.map.done ? slot.simulator.peekNextAction() : null;
        slot.renderer.render(state, nextAction);
        renderCompareMetrics(slot);
      },
      tickMs: 300,
    });

    const initialState = environment.getState();
    slot.renderer.render(initialState, slot.simulator.peekNextAction());
    renderCompareMetrics(slot);
    return slot;
  });
}

function runCompare() {
  compareSlots.forEach((slot) => {
    slot.simulator.reset();
    slot.simulator.run();
  });
}

function resetCompare() {
  compareSlots.forEach((slot) => {
    slot.simulator.reset();
  });
}

async function init() {
  const sharedInitialState = loadSharedInitialState();

  for (const definition of COMPARE_ALGORITHMS) {
    const cardElements = createCompareCard(definition);
    const slot = await createCompareSlot(sharedInitialState, definition, cardElements);
    compareSlots.push(slot);
  }

  elements.runCompareButton.addEventListener("click", runCompare);
  elements.resetCompareButton.addEventListener("click", resetCompare);
  elements.backButton.addEventListener("click", () => {
    window.location.href = "index.html";
  });
}

init().catch((error) => {
  console.error(error);
  elements.compareGrid.innerHTML = `
    <article class="compare-card">
      <h2>Cannot start compare screen</h2>
      <p class="compare-card-subtitle">Check Console for module import errors.</p>
    </article>
  `;
});

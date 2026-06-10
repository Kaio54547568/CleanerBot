import { simulationStateFromPlain, simulationStateToPlain } from "./models.js";

export const USER_TEMPLATES_STORAGE_KEY = "cleanerbot.templates.v1";
export const BUILTIN_TEMPLATES_MANIFEST_URL = "templates/manifest.json";

export async function loadBuiltinTemplates(fetchImpl = globalThis.fetch) {
  if (!fetchImpl) {
    return [];
  }

  try {
    const manifestResponse = await fetchImpl(BUILTIN_TEMPLATES_MANIFEST_URL);

    if (!manifestResponse.ok) {
      return [];
    }

    const manifest = await manifestResponse.json();
    const entries = Array.isArray(manifest?.templates) ? manifest.templates : [];
    const templates = await Promise.all(
      entries.map(async (entry) => {
        const response = await fetchImpl(entry.file);

        if (!response.ok) {
          return null;
        }

        const state = simulationStateToPlain(await response.json());
        return {
          id: `builtin:${entry.id}`,
          name: sanitizeTemplateName(entry.name) || entry.id,
          state,
          readonly: true,
        };
      })
    );

    return templates.filter(Boolean);
  } catch (error) {
    console.warn("Cannot load built-in templates.", error);
    return [];
  }
}

export function readUserTemplates(storage = globalThis.localStorage) {
  if (!storage) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(storage.getItem(USER_TEMPLATES_STORAGE_KEY) ?? "[]");

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue
      .map(normalizeTemplateRecord)
      .filter(Boolean);
  } catch (error) {
    console.warn("Cannot read saved templates.", error);
    return [];
  }
}

export function writeUserTemplates(templates, storage = globalThis.localStorage) {
  if (!storage) {
    return;
  }

  storage.setItem(
    USER_TEMPLATES_STORAGE_KEY,
    JSON.stringify(templates.map(normalizeTemplateRecord).filter(Boolean))
  );
}

export function createTemplateRecord({
  name,
  state,
  maxCapacity,
  battery,
  id = createTemplateId(name),
}) {
  const stateSnapshot = simulationStateToPlain(simulationStateFromPlain(state));
  const safeMaxCapacity = clampInteger(maxCapacity, 1, 20, stateSnapshot.robot.maxCapacity);
  const safeBattery = clampNumber(battery, 0, 100, stateSnapshot.robot.battery);

  stateSnapshot.robot.maxCapacity = safeMaxCapacity;
  stateSnapshot.robot.capacity = Math.min(stateSnapshot.robot.capacity, safeMaxCapacity);
  stateSnapshot.robot.battery = safeBattery;
  stateSnapshot.steps = 0;
  stateSnapshot.latestAction = null;
  stateSnapshot.latestLog = "Loaded template.";

  return {
    id,
    name: sanitizeTemplateName(name) || "Untitled template",
    state: stateSnapshot,
  };
}

export function sanitizeTemplateName(value) {
  return `${value ?? ""}`.trim().replace(/\s+/g, " ");
}

function normalizeTemplateRecord(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const name = sanitizeTemplateName(value.name);

  if (!name || !value.state) {
    return null;
  }

  return {
    id: `${value.id || createTemplateId(name)}`,
    name,
    state: simulationStateToPlain(value.state),
    readonly: value.readonly === true,
  };
}

function createTemplateId(name) {
  const slug = sanitizeTemplateName(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "template";
  const suffix = Math.random().toString(36).slice(2, 8);

  return `user:${slug}-${suffix}`;
}

function clampInteger(value, min, max, fallback) {
  const numberValue = Number.parseInt(value, 10);

  if (Number.isNaN(numberValue)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, numberValue));
}

function clampNumber(value, min, max, fallback) {
  const numberValue = Number.parseFloat(value);

  if (Number.isNaN(numberValue)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, numberValue));
}

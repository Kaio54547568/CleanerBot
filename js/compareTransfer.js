const COMPARE_STORAGE_PREFIX = "cleanerbot.compare.";

export function storeCompareState(storage, state, key = createCompareStateKey()) {
  storage.setItem(key, JSON.stringify(state));
  return key;
}

export function consumeCompareState(storage, key) {
  if (!key) {
    return null;
  }

  const storedState = storage.getItem(key);

  if (storedState === null) {
    return null;
  }

  storage.removeItem(key);

  try {
    return JSON.parse(storedState);
  } catch {
    return null;
  }
}

function createCompareStateKey() {
  const uniquePart = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `${COMPARE_STORAGE_PREFIX}${uniquePart}`;
}

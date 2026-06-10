import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

test("Compare uses a native new-tab form without window.open", async () => {
  const [indexHtml, mainScript] = await Promise.all([
    readFile(new URL("index.html", projectRoot), "utf8"),
    readFile(new URL("js/main.js", projectRoot), "utf8"),
  ]);

  assert.match(indexHtml, /<form[^>]+id="compareForm"[^>]+target="_blank"/);
  assert.match(indexHtml, /<input[^>]+name="stateKey"/);
  assert.doesNotMatch(mainScript, /window\.open\s*\(/);
});

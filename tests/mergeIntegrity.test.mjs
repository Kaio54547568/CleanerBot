import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);
const runtimeFiles = [
  "index.html",
  "js/main.js",
  "js/render.js",
  "js/compare.js",
  "js/simulator.js",
  "js/algorithms/baseAlgorithm.js",
];

test("merged browser files contain no conflict markers and keep the demo-map control", async () => {
  const contents = await Promise.all(
    runtimeFiles.map((path) => readFile(new URL(path, projectRoot), "utf8"))
  );

  contents.forEach((content, index) => {
    assert.doesNotMatch(
      content,
      /^(<<<<<<<|=======|>>>>>>>)/m,
      `${runtimeFiles[index]} still contains a merge conflict marker`
    );
  });

  assert.match(contents[0], /id="demoMapSelect"/);
});

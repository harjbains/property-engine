const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const html = fs.readFileSync("index.html", "utf8");
const app = fs.readFileSync("app.js", "utf8");

test("every direct DOM id used by app.js exists in index.html", () => {
  const htmlIds = new Set([...html.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]));
  const selectors = new Set([...app.matchAll(/\bby\(["']#([A-Za-z][\w:-]*)["']\)/g)].map(match => match[1]));
  const missing = [...selectors].filter(id => !htmlIds.has(id)).sort();
  assert.deepEqual(missing, []);
});

test("domain APIs load before the UI orchestrator", () => {
  const scripts = [...html.matchAll(/<script src=["']([^"']+)["']/g)].map(match => match[1].split("?")[0]);
  const appIndex = scripts.indexOf("app.js");
  for (const dependency of ["tax-engine.js", "financial-controls.js", "property-records.js", "abratax-export.js"]) {
    assert.ok(scripts.indexOf(dependency) >= 0, `${dependency} is missing`);
    assert.ok(scripts.indexOf(dependency) < appIndex, `${dependency} must load before app.js`);
  }
  assert.ok(scripts.indexOf("supabase-sync.js") > appIndex, "persistence adapter must load after app.js");
});

test("removed legacy dashboard controls are not referenced", () => {
  for (const id of ["scenario", "scenarioSummary", "effectiveRate", "effectiveBar", "incomeMix", "taxBridge"]) {
    assert.doesNotMatch(app, new RegExp(`#${id}\\b`));
  }
});


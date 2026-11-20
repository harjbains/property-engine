const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

test("properties section has 4 logical tabs and corresponding panels", () => {
  const html = fs.readFileSync("index.html", "utf8");

  // Tab buttons
  const tabs = [...html.matchAll(/data-property-tab=["']([^"']+)["']/g)].map(m => m[1]);
  assert.deepEqual(tabs, ["ledgers", "arrears", "tenancies", "annual"]);

  // Panels
  const panels = [...html.matchAll(/data-property-panel=["']([^"']+)["']/g)].map(m => m[1]);
  assert.deepEqual(panels, ["ledgers", "arrears", "tenancies", "annual"]);

  // Default active tab
  assert.ok(html.includes('data-property-tab="ledgers"') && html.includes('class="active" data-property-tab="ledgers"'));

  // Critical IDs preserved in ledgers panel
  assert.ok(html.includes('id="propertyIncomeTable"'), "propertyIncomeTable exists");
  assert.ok(html.includes('id="propertyExpenseTable"'), "propertyExpenseTable exists");
  assert.ok(html.includes('id="propertyIncomeFilter"'), "propertyIncomeFilter exists");
  assert.ok(html.includes('id="propertyIncomeDateFilter"'), "propertyIncomeDateFilter exists");
  assert.ok(html.includes('id="propertyExpenseDateFilter"'), "propertyExpenseDateFilter exists");
  assert.ok(html.includes('id="propertyLedgerMonthControls"'), "propertyLedgerMonthControls exists");

  // Critical IDs preserved in arrears panel
  assert.ok(html.includes('id="arrearsTable"'), "arrearsTable exists");
  assert.ok(html.includes('id="arrearsMetrics"'), "arrearsMetrics exists");
  assert.ok(html.includes('id="arrearsPropertyFilter"'), "arrearsPropertyFilter exists");

  // Critical IDs preserved in tenancies panel
  assert.ok(html.includes('id="propertyMetrics"'), "propertyMetrics exists");
  assert.ok(html.includes('id="propertyTable"'), "propertyTable exists");
  assert.ok(html.includes('id="rentHistoryTable"'), "rentHistoryTable exists");

  // Critical IDs preserved in annual panel
  assert.ok(html.includes('id="propertySummaryTable"'), "propertySummaryTable exists");
  assert.ok(html.includes('id="propertySummaryMetrics"'), "propertySummaryMetrics exists");
  assert.ok(html.includes('id="propertySummaryYear"'), "propertySummaryYear exists");
  assert.ok(html.includes('id="propertySummaryFilter"'), "propertySummaryFilter exists");
});

test("app.js exports setPropertyTab and wires tab switching", () => {
  const app = fs.readFileSync("app.js", "utf8");
  assert.ok(app.includes("function setPropertyTab"), "setPropertyTab function defined");
  assert.ok(app.includes("data-property-tab"), "listens for data-property-tab clicks");
  assert.ok(app.includes("data-property-panel"), "manages data-property-panel elements");
});

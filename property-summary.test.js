const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const crypto = require("node:crypto");

test("property monthly breakdown classifies categories and aggregates 12 months", () => {
  const store = {};
  const mockLocalStorage = {
    getItem: (k) => store[k] || null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => {}
  };

  const dummyEl = {
    value: "",
    textContent: "",
    innerHTML: "",
    hidden: false,
    options: [],
    dataset: { panel: "dashboard" },
    style: { setProperty: () => {} },
    classList: { toggle: () => {}, add: () => {}, remove: () => {} },
    querySelector: () => dummyEl,
    querySelectorAll: () => [],
    closest: () => null,
    insertBefore: () => {},
    insertAdjacentHTML: () => {},
    addEventListener: () => {}
  };

  const sandbox = {
    localStorage: mockLocalStorage,
    crypto,
    console,
    Math,
    Date,
    JSON,
    Number,
    String,
    Set,
    Map,
    Array,
    Object,
    Intl,
    document: {
      getElementById: () => dummyEl,
      querySelector: () => dummyEl,
      querySelectorAll: () => [],
      createElement: () => dummyEl,
      addEventListener: () => {}
    },
    window: {}
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;

  // Load dependency scripts
  const taxEngineCode = fs.readFileSync("tax-engine.js", "utf8");
  vm.runInNewContext(taxEngineCode, sandbox);

  const financialControlsCode = fs.readFileSync("financial-controls.js", "utf8");
  vm.runInNewContext(financialControlsCode, sandbox);

  const propertyRecordsCode = fs.readFileSync("property-records.js", "utf8");
  vm.runInNewContext(propertyRecordsCode, sandbox);

  const abrataxCode = fs.readFileSync("abratax-export.js", "utf8");
  vm.runInNewContext(abrataxCode, sandbox);

  const appCode = fs.readFileSync("app.js", "utf8");
  vm.runInNewContext(appCode, sandbox);

  // 1. Test classifyPropertyExpense
  const fn = sandbox.classifyPropertyExpense;
  assert.equal(fn({ category: "Mortgage interest", description: "Accord" }), "mortgage");
  assert.equal(fn({ description: "Topaz Mortgages" }), "mortgage");
  assert.equal(fn({ description: "UCB Home Loans" }), "mortgage");
  assert.equal(fn({ description: "Wolverhampton Council Tax" }), "councilTax");
  assert.equal(fn({ description: "Severn Trent" }), "councilTax");
  assert.equal(fn({ description: "EON Next" }), "councilTax");
  assert.equal(fn({ description: "Directline BuytoLet" }), "insurance");
  assert.equal(fn({ description: "Policy Expert Brenton Road" }), "insurance");
  assert.equal(fn({ description: "Screwfix - Tap replacement" }), "repairs");
  assert.equal(fn({ category: "Property Management" }), "legal");
  assert.equal(fn({ description: "Abratax accountancy" }), "legal");

  // 2. Test getPropertyMonthlyBreakdown for 2026-27
  const breakdown = sandbox.getPropertyMonthlyBreakdown("2026-27");
  assert.equal(breakdown.rows.length, 12);
  assert.equal(breakdown.rows[0].month, "2026-04");
  assert.equal(breakdown.rows[11].month, "2027-03");

  // Verify total calculation integrity: totalCosts = sum of categories
  const t = breakdown.totals;
  const expectedCosts = t.mortgage + t.repairs + t.legal + t.councilTax + t.insurance + t.other;
  assert.equal(Math.round(t.totalCosts * 100), Math.round(expectedCosts * 100));
  assert.equal(Math.round(t.netProfit * 100), Math.round((t.rent - t.totalCosts) * 100));

  // 3. Test renderPropertySummary doesn't throw
  sandbox.renderPropertySummary();
});

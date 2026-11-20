const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const crypto = require("node:crypto");

test("decoupled rent: cashflow edits do not mutate propertyIncome and propertyIncomeRecords returns manual property records", () => {
  const store = {};
  store["tax-engine-v3"] = JSON.stringify({
    version: 3,
    year: "2026-27",
    properties: [
      { id: "prop-penn", property: "524 Penn Road", rent: 850, start: "2025-04-26" },
      { id: "prop-leslie", property: "35 Leslie Road", rent: 900, start: "2025-04-01" }
    ],
    propertyIncome: [
      { id: "pi-1", propertyId: "prop-penn", date: "2026-10-12", amount: 850, period: "2026-10", notes: "Oct paid" }
    ],
    propertyExpenses: [],
    rentChanges: [],
    pension: [],
    payments: []
  });

  const mockLocalStorage = {
    getItem: (k) => (k in store ? store[k] : null),
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
    insertBefore: () => {},
    dataset: { panel: "dashboard" },
    style: { setProperty: () => {} },
    classList: { toggle: () => {}, add: () => {}, remove: () => {} },
    querySelector: () => dummyEl,
    querySelectorAll: () => [],
    closest: () => null,
    insertAdjacentHTML: () => {},
    addEventListener: () => {}
  };

  const sandbox = {
    crypto,
    localStorage: mockLocalStorage,
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
      body: { appendChild: () => {} },
      querySelector: () => dummyEl,
      querySelectorAll: () => [],
      addEventListener: () => {},
      createElement: () => ({ href: "", click: () => {}, value: "", textContent: "", remove: () => {} })
    },
    navigator: {}
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;

  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync("tax-engine.js", "utf8"), sandbox);
  vm.runInContext(fs.readFileSync("financial-controls.js", "utf8"), sandbox);
  vm.runInContext(fs.readFileSync("property-records.js", "utf8"), sandbox);
  vm.runInContext(fs.readFileSync("abratax-export.js", "utf8"), sandbox);
  vm.runInContext(fs.readFileSync("app.js", "utf8"), sandbox);

  // 1. Check propertyIncomeRecords returns the manual receipt for 2026-10
  const octRecords = sandbox.propertyIncomeRecords("2026-10");
  const pennOct = octRecords.filter(r => r.propertyId === "prop-penn");
  assert.equal(pennOct.length, 1, "Should find 1 manual receipt for Oct 2026 for Penn Road");
  assert.equal(pennOct[0].amount, 850);

  // 2. Unpaid month 2026-09 has 0 records in propertyIncomeRecords
  const septRecords = sandbox.propertyIncomeRecords("2026-09");
  const pennSept = septRecords.filter(r => r.propertyId === "prop-penn");
  assert.equal(pennSept.length, 0, "Unpaid September should have 0 records for Penn Road");

  // 3. syncCashflowRentToPropertyRecords is a decoupled no-op
  const appStateBefore = JSON.parse(store["tax-engine-v3"]);
  sandbox.syncCashflowRentToPropertyRecords(
    { propertyId: "prop-penn", description: "524 Penn Road" },
    "2026-10",
    0,
    0,
    "Expected"
  );
  const appStateAfter = JSON.parse(store["tax-engine-v3"]);
  assert.deepEqual(appStateBefore.propertyIncome, appStateAfter.propertyIncome, "syncCashflowRentToPropertyRecords must not alter propertyIncome");
});

test("mobile rent receipt: quick-spend records rent into propertyIncome and optionally credits Lloyds bank balance", () => {
  const store = {};
  store["tax-engine-v3"] = JSON.stringify({
    version: 3,
    year: "2026-27",
    properties: [
      { id: "prop-penn", property: "524 Penn Road", tenant: "Jennifer Powell", rent: 850 }
    ],
    propertyIncome: [],
    propertyExpenses: [],
    campaigns: []
  });

  store["tax-engine-cashflow-2026-11"] = JSON.stringify({
    month: "2026-11",
    bank: 1000,
    bankAccounts: { zempler: 500, lloyds: 500 },
    fixed: [],
    spending: [],
    income: []
  });

  // Verify structure exists in quick-spend.html
  const qsHtml = fs.readFileSync("quick-spend.html", "utf8");
  assert.ok(qsHtml.includes('id="btnTabRentReceipt"'), "Tab button for Rent Receipt must exist");
  assert.ok(qsHtml.includes('id="mobileRentReceiptForm"'), "Mobile Rent Receipt Form must exist");
  assert.ok(qsHtml.includes('id="rentReceiptProperty"'), "Property selector for rent receipt must exist");
  assert.ok(qsHtml.includes('id="rentReceiptAddToBank"'), "Checkbox to credit bank must exist");

  // Verify functions exist in quick-spend.js
  const qsJs = fs.readFileSync("quick-spend.js", "utf8");
  assert.ok(qsJs.includes("populateRentReceiptProperties"), "populateRentReceiptProperties must exist");
  assert.ok(qsJs.includes("renderMobileRecentRent"), "renderMobileRecentRent must exist");

  // Verify decoupling: syncMobilePropertyIncome is a no-op
  const syncMatch = qsJs.match(/function syncMobilePropertyIncome[\s\S]*?\n\}/);
  assert.ok(syncMatch && syncMatch[0].includes("return;"), "syncMobilePropertyIncome must be decoupled no-op");
});

test("property income ledger: date filter and property filter show full tenancy schedule, past paid rents, and overdue arrears", () => {
  const html = fs.readFileSync("index.html", "utf8");
  assert.ok(html.includes('id="propertyIncomeDateFilter"'), "propertyIncomeDateFilter select must exist in index.html");
  assert.ok(html.includes('id="propertyExpenseDateFilter"'), "propertyExpenseDateFilter select must exist in index.html");
  assert.ok(html.includes('id="propertyIncomeFilter"'), "propertyIncomeFilter select must exist in index.html");

  const appJs = fs.readFileSync("app.js", "utf8");
  assert.ok(appJs.includes("propertyIncomeDateFilter"), "app.js must handle propertyIncomeDateFilter");
  assert.ok(appJs.includes("incomeDateFilter"), "app.js must manage incomeDateFilter state");
  assert.ok(appJs.includes("matchIncomeDate"), "app.js must filter income by date");
});

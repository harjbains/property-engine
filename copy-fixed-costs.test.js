const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const crypto = require("node:crypto");

function createSandbox(store, targetMonth, initialProperties = [], initialPension = []) {
  if (initialProperties.length || initialPension.length) {
    store["tax-engine-v3"] = JSON.stringify({
      version: 3,
      year: "2026-27",
      settingsByYear: {},
      employment: [],
      uber: [],
      properties: initialProperties,
      propertyIncome: [],
      propertyExpenses: [],
      rentChanges: [],
      pension: initialPension,
      payments: []
    });
  }

  const mockLocalStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); }
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
    RegExp,
    Boolean,
    Intl,
    setTimeout: (fn) => fn(),
    clearTimeout: () => {},
    document: {
      body: { appendChild: () => {} },
      querySelector: () => dummyEl,
      querySelectorAll: () => [],
      addEventListener: () => {},
      createElement: () => ({ href: "", click: () => {}, value: "", textContent: "", remove: () => {} })
    },
    navigator: {},
    dashboardMonth: targetMonth,
    logToUI: () => {},
    renderDashboardSurface: () => {},
    dashboardDates: () => ({ cutoff: `${targetMonth}-15` })
  };

  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;

  const taxEngineJs = fs.readFileSync("tax-engine.js", "utf8");
  const financialControlsJs = fs.readFileSync("financial-controls.js", "utf8");
  const propertyRecordsJs = fs.readFileSync("property-records.js", "utf8");
  const abrataxExportJs = fs.readFileSync("abratax-export.js", "utf8");
  const appJs = fs.readFileSync("app.js", "utf8");

  vm.createContext(sandbox);
  vm.runInContext(taxEngineJs, sandbox);
  vm.runInContext(financialControlsJs, sandbox);
  vm.runInContext(propertyRecordsJs, sandbox);
  vm.runInContext(abrataxExportJs, sandbox);
  vm.runInContext(appJs, sandbox);

  return sandbox;
}

test("copyPreviousFixedCosts: copies fixed costs, property rents, rooms income, and pension into section='fixed'", () => {
  const store = {};
  const priorMonth = "2026-04";
  const targetMonth = "2026-05";

  store[`tax-engine-cashflow-${priorMonth}`] = JSON.stringify({
    month: priorMonth,
    bank: 3500,
    bankAccounts: { zempler: 3500, lloyds: 0 },
    fixed: [
      { id: "c1", due: "1 Apr", payment: "Home mortgage", expected: 833, actual: 833, status: "Paid" },
      { id: "c2", due: "2 Apr", payment: "Council tax", expected: 134, actual: 134, status: "Paid" },
      { id: "c3", due: "3 Apr", payment: "Tesla finance", expected: 450, actual: null, status: "Expected" }
    ],
    spending: [],
    income: [
      { id: "r1", date: "1 Apr", description: "35 Leslie Road", expected: 900, actual: 900, status: "Received", treatment: "property_income", section: "fixed" },
      { id: "r2", date: "1 Apr", description: "Rooms", expected: 700, actual: 700, status: "Received", treatment: "room_rent", section: "fixed" },
      { id: "r3", date: "1 Apr", description: "BT Pension", expected: 691.25, actual: 691.25, status: "Received", treatment: "pension_income", section: "fixed" }
    ]
  });

  store[`tax-engine-cashflow-${targetMonth}`] = JSON.stringify({
    month: targetMonth,
    bank: 3500,
    bankAccounts: { zempler: 3500, lloyds: 0 },
    fixed: [],
    spending: [],
    income: []
  });

  const properties = [
    { id: "prop-leslie", property: "35 Leslie Road", rent: 900 },
    { id: "prop-ranelagh-5a", property: "5a Ranelagh Road", rent: 550 },
    { id: "prop-penn", property: "524 Penn Road", rent: 850 }
  ];
  const pension = [
    { id: "pen-1", provider: "BT Pension", amount: 8295 }
  ];

  const sandbox = createSandbox(store, targetMonth, properties, pension);

  // Invoke copyPreviousFixedCosts
  sandbox.copyPreviousFixedCosts();

  const updatedMonth = JSON.parse(store[`tax-engine-cashflow-${targetMonth}`]);

  // 1. Verify fixed costs copied
  assert.equal(updatedMonth.fixed.length, 3, "All 3 fixed costs should be copied");
  assert.equal(updatedMonth.fixed[0].payment, "Home mortgage");
  assert.equal(updatedMonth.fixed[0].status, "Expected");
  assert.equal(updatedMonth.fixed[0].actual, null);
  assert.equal(updatedMonth.fixed[0].due, "1 May");

  // 2. Verify regular incomes copied into section='fixed'
  const fixedIncomes = (updatedMonth.income || []).filter(i => i.section === "fixed");
  assert.ok(fixedIncomes.length >= 3, `Expected at least 3 fixed incomes, got ${fixedIncomes.length}`);

  const descriptions = fixedIncomes.map(i => i.description);
  assert.ok(descriptions.some(d => /leslie/i.test(d)), "35 Leslie Road rent must be present");
  assert.ok(descriptions.some(d => /room/i.test(d)), "Rooms income must be present");
  assert.ok(descriptions.some(d => /pension/i.test(d)), "BT Pension must be present");

  for (const inc of fixedIncomes) {
    assert.equal(inc.status, "Expected", `Income ${inc.description} should have status 'Expected'`);
    assert.equal(inc.actual, null, `Income ${inc.description} should have actual null`);
    assert.equal(inc.section, "fixed", `Income ${inc.description} must have section 'fixed'`);
    assert.ok(inc.date.includes("May"), `Income ${inc.description} date must be formatted for target month May`);
  }

  // 3. Re-run copyPreviousFixedCosts to verify deduplication
  const initialFixedCount = updatedMonth.fixed.length;
  const initialIncomeCount = updatedMonth.income.length;

  sandbox.copyPreviousFixedCosts();
  const reUpdatedMonth = JSON.parse(store[`tax-engine-cashflow-${targetMonth}`]);

  assert.equal(reUpdatedMonth.fixed.length, initialFixedCount, "Re-running should not duplicate fixed costs");
  assert.equal(reUpdatedMonth.income.length, initialIncomeCount, "Re-running should not duplicate incomes");
});

test("copyPreviousFixedCosts: populates property rents and pension from state when prior month income was empty", () => {
  const store = {};
  const priorMonth = "2026-04";
  const targetMonth = "2026-05";

  store[`tax-engine-cashflow-${priorMonth}`] = JSON.stringify({
    month: priorMonth,
    bank: 3000,
    bankAccounts: { zempler: 3000, lloyds: 0 },
    fixed: [
      { id: "c1", due: "1 Apr", payment: "Home mortgage", expected: 833, actual: 833, status: "Paid" }
    ],
    spending: [],
    income: []
  });

  store[`tax-engine-cashflow-${targetMonth}`] = JSON.stringify({
    month: targetMonth,
    bank: 3000,
    bankAccounts: { zempler: 3000, lloyds: 0 },
    fixed: [],
    spending: [],
    income: []
  });

  const properties = [
    { id: "prop-leslie", property: "35 Leslie Road", rent: 900 },
    { id: "prop-ranelagh-5a", property: "5a Ranelagh Road", rent: 550 },
    { id: "prop-penn", property: "524 Penn Road", rent: 850 }
  ];
  const pension = [
    { id: "pen-1", provider: "BT Pension", amount: 8295 }
  ];

  const sandbox = createSandbox(store, targetMonth, properties, pension);

  sandbox.copyPreviousFixedCosts();

  const updatedMonth = JSON.parse(store[`tax-engine-cashflow-${targetMonth}`]);
  const fixedIncomes = (updatedMonth.income || []).filter(i => i.section === "fixed");

  assert.ok(fixedIncomes.length >= 4, `Expected at least 4 items from properties & pension, got ${fixedIncomes.length}`);
  const descriptions = fixedIncomes.map(i => i.description);
  assert.ok(descriptions.some(d => /35 leslie/i.test(d)), "35 Leslie Road rent created");
  assert.ok(descriptions.some(d => /5a ranelagh/i.test(d)), "5a Ranelagh Road rent created");
  assert.ok(descriptions.some(d => /524 penn/i.test(d)), "524 Penn Road rent created");
  assert.ok(descriptions.some(d => /pension/i.test(d)), "Pension created");
});

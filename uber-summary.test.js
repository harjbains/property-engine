const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const crypto = require("node:crypto");

test("uber monthly breakdown aggregates 12 months, calculates 25% tax pot, and tracks mileage", () => {
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
    dataset: { panel: "uber" },
    style: { setProperty: () => {}, display: "" },
    classList: { toggle: () => {}, add: () => {}, remove: () => {} },
    querySelector: () => dummyEl,
    querySelectorAll: () => [],
    closest: () => null,
    insertBefore: () => {},
    insertAdjacentHTML: () => {},
    addEventListener: () => {},
    scrollIntoView: () => {}
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

  // 1. Verify getUberMonthlyBreakdown returns 12 months
  const breakdownEmpty = sandbox.getUberMonthlyBreakdown("2026-27");
  assert.equal(breakdownEmpty.rows.length, 12);
  assert.equal(breakdownEmpty.rows[0].month, "2026-04");
  assert.equal(breakdownEmpty.rows[11].month, "2027-03");
  assert.equal(breakdownEmpty.totals.taxPot, 0);

  // 2. Add realistic weekly Uber statements via localStorage and reload
  const uberData = [
    {
      id: "u1",
      date: "2026-10-12",
      weekStart: "2026-10-05",
      weekEnd: "2026-10-12",
      customerPayments: 640.97,
      governmentThirdPartyFees: 8.00,
      uberServiceFee: 121.29,
      tips: 2.00,
      otherAdjustments: 0.00,
      netUberPayment: 513.59,
      businessMiles: 515,
      uberBreakdownStatus: "complete"
    },
    {
      id: "u2",
      date: "2026-10-05",
      weekStart: "2026-09-28",
      weekEnd: "2026-10-05",
      customerPayments: 1149.09,
      governmentThirdPartyFees: 20.80,
      uberServiceFee: 199.70,
      tips: 14.00,
      otherAdjustments: 0.00,
      netUberPayment: 941.59,
      businessMiles: 1053,
      uberBreakdownStatus: "complete"
    },
    {
      id: "u3",
      date: "2026-05-18",
      weekStart: "2026-05-11",
      weekEnd: "2026-05-18",
      customerPayments: 800.00,
      governmentThirdPartyFees: 15.00,
      uberServiceFee: 150.00,
      tips: 10.00,
      otherAdjustments: 0.00,
      netUberPayment: 645.00,
      businessMiles: 600,
      uberBreakdownStatus: "complete"
    }
  ];

  const existingState = JSON.parse(mockLocalStorage.getItem("tax-engine-v3") || "{}");
  existingState.uber = uberData;
  mockLocalStorage.setItem("tax-engine-v3", JSON.stringify(existingState));
  sandbox.TaxEngineReloadFromStorage();

  const breakdown = sandbox.getUberMonthlyBreakdown("2026-27");
  assert.equal(breakdown.rows.length, 12);

  // Check May 2026 (2026-05)
  const mayRow = breakdown.rows.find(r => r.month === "2026-05");
  assert.ok(mayRow);
  assert.equal(mayRow.count, 1);
  assert.equal(mayRow.turnover, 800.00);
  assert.equal(mayRow.thirdParty, 15.00);
  assert.equal(mayRow.uberFee, 150.00);
  assert.equal(mayRow.tips, 10.00);
  assert.equal(mayRow.netPayout, 645.00);
  // Tax pot must be exactly 25% of net payout
  assert.equal(mayRow.taxPot, 161.25);
  assert.equal(mayRow.miles, 600);
  // 600 miles @ 55p in 2026-27 = £330.00
  assert.equal(mayRow.mileageAllowance, 330.00);
  assert.equal(mayRow.netProfit, 645.00 - 330.00);

  // Check Oct 2026 (2026-10)
  const octRow = breakdown.rows.find(r => r.month === "2026-10");
  assert.ok(octRow);
  assert.equal(octRow.count, 2);
  assert.equal(octRow.turnover, 640.97 + 1149.09);
  assert.equal(octRow.thirdParty, 8.00 + 20.80);
  assert.equal(octRow.uberFee, 121.29 + 199.70);
  assert.equal(octRow.tips, 2.00 + 14.00);
  assert.equal(octRow.netPayout, 513.59 + 941.59); // 1455.18
  // 25% of 1455.18 = 363.80
  assert.equal(octRow.taxPot, Math.round(1455.18 * 0.25 * 100) / 100);
  assert.equal(octRow.miles, 515 + 1053); // 1568

  // Check Totals
  const t = breakdown.totals;
  assert.equal(t.netPayout, 645.00 + 1455.18); // 2100.18
  assert.equal(t.taxPot, 525.05); // 525.05 (25% of total net payout)
  assert.equal(t.miles, 600 + 1568); // 2168 miles
  // Total mileage allowance: 2168 @ 55p = 1192.40
  assert.equal(t.mileageAllowance, 1192.40);
  assert.equal(t.netProfit, Math.round((t.netPayout - t.mileageAllowance) * 100) / 100);

  // 3. Test renderUberSummary executes properly
  sandbox.renderUberSummary();

  // 4. Test renderUberTable executes properly
  sandbox.renderUberTable();
});

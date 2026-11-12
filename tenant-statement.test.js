const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const crypto = require("node:crypto");

test("tenant statement generates Jan to Dec statement, tracks cumulative balance, and formats email", () => {
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
    className: "",
    hidden: false,
    options: [],
    dataset: { panel: "properties" },
    style: { setProperty: () => {}, display: "" },
    classList: { toggle: () => {}, add: () => {}, remove: () => {} },
    querySelector: () => dummyEl,
    querySelectorAll: () => [],
    closest: () => null,
    insertBefore: () => {},
    insertAdjacentHTML: () => {},
    addEventListener: () => {},
    scrollIntoView: () => {},
    showModal: () => {},
    close: () => {},
    focus: () => {}
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

  // 1. Verify getTenantAnnualStatement for 524 Penn Road in 2026
  const pennRoad = sandbox.state.properties.find(p => p.property === "524 Penn Road");
  assert.ok(pennRoad, "524 Penn Road property should exist");
  assert.ok(pennRoad.tenantEmail, "tenantEmail should be defined on property");

  const statement = sandbox.getTenantAnnualStatement(pennRoad.id, 2026);
  assert.ok(statement);
  assert.equal(statement.year, 2026);
  assert.equal(statement.rows.length, 12, "Statement must have 12 rows (Jan to Dec)");
  assert.equal(statement.rows[0].month, "2026-01", "First row is Jan");
  assert.equal(statement.rows[11].month, "2026-12", "Last row is Dec");

  // May 2026 is paid up
  const mayRow = statement.rows.find(r => r.month === "2026-05");
  assert.ok(mayRow);
  assert.equal(mayRow.rentDue, 850);
  assert.equal(mayRow.amountPaid, 850);
  assert.equal(mayRow.cumulativeBalance, 0);

  // June 2026 was missed (unpaid)
  const juneRow = statement.rows.find(r => r.month === "2026-06");
  assert.ok(juneRow);
  assert.equal(juneRow.rentDue, 850);
  assert.equal(juneRow.amountPaid, 0);
  assert.equal(juneRow.status, "Unpaid");
  assert.equal(juneRow.cumulativeBalance, 850, "Cumulative balance after missed June rent must be £850 arrears");

  // July 2026 is paid, so cumulative balance remains £850 arrears
  const julyRow = statement.rows.find(r => r.month === "2026-07");
  assert.ok(julyRow);
  assert.equal(julyRow.rentDue, 850);
  assert.equal(julyRow.amountPaid, 850);
  assert.equal(julyRow.cumulativeBalance, 850, "July cumulative balance remains £850 arrears");

  // August 2026 is paid
  const augRow = statement.rows.find(r => r.month === "2026-08");
  assert.ok(augRow);
  assert.equal(augRow.rentDue, 850);
  assert.equal(augRow.amountPaid, 850);
  assert.equal(augRow.cumulativeBalance, 850);

  // September 2026 was paid late on 12/10/2026
  const sepRow = statement.rows.find(r => r.month === "2026-09");
  assert.ok(sepRow);
  assert.equal(sepRow.rentDue, 850);
  assert.equal(sepRow.amountPaid, 850, "September rent was receipted on 12/10/2026 and must clear September");
  assert.equal(sepRow.status, "Paid");
  assert.equal(sepRow.cumulativeBalance, 850);

  // October 2026 remains unpaid
  const octRow = statement.rows.find(r => r.month === "2026-10");
  assert.ok(octRow);
  assert.equal(octRow.rentDue, 850);
  assert.equal(octRow.amountPaid, 0, "October rent remains unpaid");
  assert.equal(octRow.status, "Unpaid");
  assert.equal(octRow.cumulativeBalance, 1700, "Cumulative balance after unpaid October must be £1,700 arrears");

  // November and December 2026 are upcoming and must NOT accrue arrears in right col
  const novRow = statement.rows.find(r => r.month === "2026-11");
  assert.ok(novRow);
  assert.equal(novRow.status, "Upcoming");
  assert.equal(novRow.cumulativeBalance, null, "Upcoming month must not show arrears in right col");

  const decRow = statement.rows.find(r => r.month === "2026-12");
  assert.ok(decRow);
  assert.equal(decRow.status, "Upcoming");
  assert.equal(decRow.cumulativeBalance, null, "Upcoming month must not show arrears in right col");

  // Current arrears total must be exactly £1,700 (June £850 + October £850)
  assert.equal(statement.totals.currentOutstanding, 1700, "Current arrears must be £1,700");

  // 2. Test formatTenantStatementEmail
  const emailText = sandbox.formatTenantStatementEmail(statement);
  assert.ok(emailText.includes("524 Penn Road"));
  assert.ok(emailText.includes("Jennifer Powell"));
  assert.ok(emailText.includes("OVERDUE BALANCE NOTICE: £1700.00"));
  assert.ok(emailText.includes("— (Upcoming)"));
  assert.ok(emailText.includes("Lloyds Bank"));

  // 3. Test arrearsSchedule
  const pennSchedule = sandbox.arrearsSchedule().filter(x => x.propertyId === pennRoad.id);
  const overdueInstalments = pennSchedule.filter(x => x.status === "Overdue" || x.status === "Part-paid");
  assert.equal(overdueInstalments.length, 2, "Must have exactly 2 overdue instalments (June and October)");
  const totalOverdue = overdueInstalments.reduce((sum, x) => sum + x.outstanding, 0);
  assert.equal(totalOverdue, 1700, "Arrears schedule total overdue must be £1,700");

  // 4. Test renderTenantStatement doesn't throw
  sandbox.renderTenantStatement(pennRoad.id, 2026);
});

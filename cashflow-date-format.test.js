const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

// Test app.js date functions in a sandbox
test("app.js: cashDay and formatCashflowDisplayDate handle ISO and display formats", () => {
  const code = fs.readFileSync("app.js", "utf8");

  // Extract functions using VM context with minimal mocks
  const context = {
    workspaceMonth: () => "2026-10",
    DEFAULT_BANK_ACCOUNT: "zempler",
    uid: () => "id-123",
    isRoomRentIncome: () => false,
    isPropertyRentIncome: () => false,
    isPensionIncome: () => false,
    resolvePropertyId: () => "",
    num: Number,
    Math,
    Date,
    String,
    Number
  };
  vm.createContext(context);

  // Run formatCashflowDisplayDate, normaliseCashItem, and cashDay definitions from code
  vm.runInContext(`
    function workspaceMonth(){ return "2026-10"; }
    ${code.match(/function formatCashflowDisplayDate[\s\S]*?return s;\}/)[0]}
    ${code.match(/function cashDay\(value\)[\s\S]*?return m\?Math\.max\(1,Math\.min\(31,Number\(m\[0\]\)\)\):"";\}/)[0]}
    ${code.match(/function normaliseCashItem\(i\)[\s\S]*?return i;\}/)[0]}
  `, context);

  // Assert cashDay extracts the actual day, not the first 2 digits of the year 2026!
  assert.equal(context.cashDay("2026-10-12"), 12);
  assert.equal(context.cashDay("2026-10-05"), 5);
  assert.equal(context.cashDay("14 Oct"), 14);
  assert.equal(context.cashDay("7"), 7);
  assert.equal(context.cashDay(""), "");

  // Assert formatCashflowDisplayDate converts ISO to UK short format
  assert.equal(context.formatCashflowDisplayDate("2026-10-12"), "12 Oct");
  assert.equal(context.formatCashflowDisplayDate("2026-10-05"), "5 Oct");
  assert.equal(context.formatCashflowDisplayDate("2026-04-14"), "14 Apr");
  assert.equal(context.formatCashflowDisplayDate("14 Oct"), "14 Oct");
  assert.equal(context.formatCashflowDisplayDate(""), "");

  // Assert normaliseCashItem normalizes ISO dates to UK short display format
  const item1 = { id: "1", date: "2026-10-12", description: "Tesco" };
  context.normaliseCashItem(item1);
  assert.equal(item1.date, "12 Oct");

  const item2 = { id: "2", due: "2026-10-05", payment: "Council Tax" };
  context.normaliseCashItem(item2);
  assert.equal(item2.due, "5 Oct");
});

test("quick-spend.js: formatCashDate, extractDayNumber, and loadCashflow normalize dates", () => {
  const code = fs.readFileSync("quick-spend.js", "utf8");

  const mockStorage = {
    "tax-engine-2026-10-cashflow": JSON.stringify({
      month: "2026-10",
      bank: 1000,
      bankAccounts: { zempler: 500, lloyds: 500 },
      spending: [
        { id: "s1", date: "2026-10-12", description: "Mobile spend 1" },
        { id: "s2", date: "14 Oct", description: "Mobile spend 2" }
      ],
      fixed: [
        { id: "f1", due: "2026-10-08", payment: "Fixed bill 1" }
      ],
      income: [
        { id: "i1", date: "2026-10-01", description: "Income 1" }
      ]
    })
  };

  const context = {
    CASHFLOW_KEY_PREFIX: "tax-engine-",
    TAX_WORKSPACE_MONTH: "2026-04",
    currentMonth: "2026-10",
    localStorage: {
      getItem: (k) => mockStorage[k] || null,
      setItem: (k, v) => { mockStorage[k] = v; }
    },
    num: (v) => Number(v) || 0,
    JSON,
    Date,
    String,
    Number,
    parseInt,
    Math,
    Array
  };
  vm.createContext(context);

  vm.runInContext(`
    function cashflowKey(month){return "tax-engine-" + month + "-cashflow";}
    function emptyCashflow(month){return{bank:0,bankAccounts:{zempler:0,lloyds:0},fixed:[],spending:[],income:[],month};}
    ${code.match(/function formatCashDate[\s\S]*?return s;\s*\}/)[0]}
    ${code.match(/function loadCashflow\(month\)[\s\S]*?return base;\s*\}/)[0]}
    ${code.match(/function extractDayNumber\(item\)[\s\S]*?return 99;\s*\}/)[0]}
  `, context);

  // Assert formatCashDate
  assert.equal(context.formatCashDate("2026-10-12"), "12 Oct");
  assert.equal(context.formatCashDate("2026-10-05"), "5 Oct");
  assert.equal(context.formatCashDate("14 Oct"), "14 Oct");

  // Assert extractDayNumber
  assert.equal(context.extractDayNumber({ date: "2026-10-12" }), 12);
  assert.equal(context.extractDayNumber({ date: "14 Oct" }), 14);
  assert.equal(context.extractDayNumber({ due: "2026-10-08" }), 8);

  // Assert loadCashflow normalizes dates stored in ISO format
  const loaded = context.loadCashflow("2026-10");
  assert.equal(loaded.spending[0].date, "12 Oct");
  assert.equal(loaded.spending[1].date, "14 Oct");
  assert.equal(loaded.fixed[0].due, "8 Oct");
  assert.equal(loaded.income[0].date, "1 Oct");
});

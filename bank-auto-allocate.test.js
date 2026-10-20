const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

test("bank-auto-allocate: parseBankStatementText parses Lloyds app screenshot text accurately", () => {
  const code = fs.readFileSync("quick-spend.js", "utf8");

  const context = {
    currentMonth: "2026-10",
    Date,
    String,
    Number,
    parseInt,
    parseFloat,
    Math,
    Array
  };
  vm.createContext(context);

  // Extract parseBankStatementText and cleanMerchantDesc from quick-spend.js
  const cleanMatch = code.match(/function cleanMerchantDesc[\s\S]*?return String[\s\S]*?\}/);
  const parseMatch = code.match(/function parseBankStatementText[\s\S]*?return\s*\{[\s\S]*?\};\s*\}/);

  assert.ok(cleanMatch, "cleanMerchantDesc function must exist in quick-spend.js");
  assert.ok(parseMatch, "parseBankStatementText function must exist in quick-spend.js");

  vm.runInContext(`
    ${cleanMatch[0]}
    ${parseMatch[0]}
  `, context);

  // Sample matching the exact Lloyds Bank app screenshot provided by user
  const sampleScreenshotOcr = `
12:40
Lloyds Basic Acct
£3,071.28
October All
In Out
Yesterday
Tesla Inc.
- £12.36
£3,071.28
Tesla Inc.
- £7.75
£3,083.64
Tesla Inc.
- £5.11
£3,091.39
FASTHOSTS
- £0.24
£3,096.50
Fri 16 October
ARGOS PAY
- £100.00
£3,096.74
SCREWFIX
- £17.89
£3,196.74
Thu 15 October
ABRATAX
- £6.00
£3,214.63
`;

  const parsed = context.parseBankStatementText(sampleScreenshotOcr, "2026-10");

  // 1. Detect balance
  assert.equal(parsed.detectedBalance, 3071.28);

  // 2. Count of parsed transactions
  assert.equal(parsed.transactions.length, 7);

  // 3. Transactions details
  assert.equal(parsed.transactions[0].description, "Tesla Inc.");
  assert.equal(parsed.transactions[0].amount, 12.36);
  assert.equal(parsed.transactions[0].category, "Living");
  assert.equal(parsed.transactions[0].propertyId, "");
  assert.equal(parsed.transactions[0].campaignId, "");

  assert.equal(parsed.transactions[1].description, "Tesla Inc.");
  assert.equal(parsed.transactions[1].amount, 7.75);

  assert.equal(parsed.transactions[2].description, "Tesla Inc.");
  assert.equal(parsed.transactions[2].amount, 5.11);

  assert.equal(parsed.transactions[3].description, "FASTHOSTS");
  assert.equal(parsed.transactions[3].amount, 0.24);

  assert.equal(parsed.transactions[4].description, "ARGOS PAY");
  assert.equal(parsed.transactions[4].amount, 100);
  assert.equal(parsed.transactions[4].date, "16 Oct");

  assert.equal(parsed.transactions[5].description, "SCREWFIX");
  assert.equal(parsed.transactions[5].amount, 17.89);
  assert.equal(parsed.transactions[5].date, "16 Oct");

  assert.equal(parsed.transactions[6].description, "ABRATAX");
  assert.equal(parsed.transactions[6].amount, 6);
  assert.equal(parsed.transactions[6].date, "15 Oct");
});

test("bank-auto-allocate: handles single line statement entries with noise", () => {
  const code = fs.readFileSync("quick-spend.js", "utf8");

  const context = {
    currentMonth: "2026-10",
    Date,
    String,
    Number,
    parseInt,
    parseFloat,
    Math,
    Array
  };
  vm.createContext(context);

  const cleanMatch = code.match(/function cleanMerchantDesc[\s\S]*?return String[\s\S]*?\}/);
  const parseMatch = code.match(/function parseBankStatementText[\s\S]*?return\s*\{[\s\S]*?\};\s*\}/);

  vm.runInContext(`
    ${cleanMatch[0]}
    ${parseMatch[0]}
  `, context);

  const singleLineSample = `
Fri 16 October
ARGOS PAY - £100.00 >
£3,096.74
SCREWFIX - £17.89 >
£3,196.74
`;

  const parsed = context.parseBankStatementText(singleLineSample, "2026-10");
  assert.equal(parsed.transactions.length, 2);
  assert.equal(parsed.transactions[0].description, "ARGOS PAY");
  assert.equal(parsed.transactions[0].amount, 100);
  assert.equal(parsed.transactions[1].description, "SCREWFIX");
  assert.equal(parsed.transactions[1].amount, 17.89);
});

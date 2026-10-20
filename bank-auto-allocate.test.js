const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

test("bank-auto-allocate: parseBankStatementText parses Lloyds app screenshot OCR text accurately", () => {
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

  const cleanMatch = code.match(/function cleanMerchantDesc[\s\S]*?\.trim\(\);\s*\}/);
  const extractMatch = code.match(/function extractDebitAmount[\s\S]*?return null;\s*\}/);
  const parseMatch = code.match(/function parseBankStatementText[\s\S]*?return\s*\{[\s\S]*?\};\s*\}/);

  assert.ok(cleanMatch, "cleanMerchantDesc function must exist in quick-spend.js");
  assert.ok(extractMatch, "extractDebitAmount function must exist in quick-spend.js");
  assert.ok(parseMatch, "parseBankStatementText function must exist in quick-spend.js");

  vm.runInContext(`
    ${cleanMatch[0]}
    ${extractMatch[0]}
    ${parseMatch[0]}
  `, context);

  // Exact OCR text produced by Tesseract on the user's screenshot
  const actualOcrText = `
12:40 w Ta
Lloyds Basic Acct ee
<< £3,071.28 0
October All
mn || ou Q
Yesterday
(J Teslalnc. (£12.36 >
[J Teslainc. £30 £7.75 >
-£5.11
[J Teslalnc. (3.00139
(J FASTHOSTS E024,
Fri 16 October
a - £100.00
AX ARGOS PAY 5.00674
$7 SCREwrFIX -£17.89
SCREW 1 £3,196.74
Thu 15 October
FO ABRATAX : £6.00 >
[qm]
A § Ny QQ od
Home Apply Payments Search Cards
`;

  const parsed = context.parseBankStatementText(actualOcrText, "2026-10");

  // 1. Detect balance
  assert.equal(parsed.detectedBalance, 3071.28);

  // 2. Count of parsed transactions (all 7)
  assert.equal(parsed.transactions.length, 7);

  // 3. Transactions details
  assert.match(parsed.transactions[0].description, /Tesla/i);
  assert.equal(parsed.transactions[0].amount, 12.36);
  assert.equal(parsed.transactions[0].category, "Living");

  assert.match(parsed.transactions[1].description, /Tesla/i);
  assert.equal(parsed.transactions[1].amount, 7.75);

  assert.match(parsed.transactions[2].description, /Tesla/i);
  assert.equal(parsed.transactions[2].amount, 5.11);

  assert.match(parsed.transactions[3].description, /FASTHOSTS/i);
  assert.equal(parsed.transactions[3].amount, 0.24);

  assert.match(parsed.transactions[4].description, /ARGOS PAY/i);
  assert.equal(parsed.transactions[4].amount, 100);
  assert.equal(parsed.transactions[4].date, "16 Oct");

  assert.match(parsed.transactions[5].description, /SCREWFIX/i);
  assert.equal(parsed.transactions[5].amount, 17.89);
  assert.equal(parsed.transactions[5].date, "16 Oct");

  assert.match(parsed.transactions[6].description, /ABRATAX/i);
  assert.equal(parsed.transactions[6].amount, 6);
  assert.equal(parsed.transactions[6].date, "15 Oct");
});

test("bank-auto-allocate: handles clean line-by-line statement format", () => {
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

  const cleanMatch = code.match(/function cleanMerchantDesc[\s\S]*?\.trim\(\);\s*\}/);
  const extractMatch = code.match(/function extractDebitAmount[\s\S]*?return null;\s*\}/);
  const parseMatch = code.match(/function parseBankStatementText[\s\S]*?return\s*\{[\s\S]*?\};\s*\}/);

  vm.runInContext(`
    ${cleanMatch[0]}
    ${extractMatch[0]}
    ${parseMatch[0]}
  `, context);

  const cleanSample = `
Lloyds Basic Acct £3,071.28
Fri 16 October
ARGOS PAY - £100.00
SCREWFIX - £17.89
Thu 15 October
ABRATAX - £6.00
`;

  const parsed = context.parseBankStatementText(cleanSample, "2026-10");
  assert.equal(parsed.detectedBalance, 3071.28);
  assert.equal(parsed.transactions.length, 3);
  assert.equal(parsed.transactions[0].description, "ARGOS PAY");
  assert.equal(parsed.transactions[0].amount, 100);
  assert.equal(parsed.transactions[1].description, "SCREWFIX");
  assert.equal(parsed.transactions[1].amount, 17.89);
  assert.equal(parsed.transactions[2].description, "ABRATAX");
  assert.equal(parsed.transactions[2].amount, 6);
});

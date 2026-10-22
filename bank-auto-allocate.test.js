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

test("bank-auto-allocate: two-column OCR parser parses mobile screenshots accurately", () => {
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
  const debitLineMatch = code.match(/function parseDebitLine[\s\S]*?return null;\s*\}/);
  const amtMatch = code.match(/function parseAmountsColumn[\s\S]*?return\s*\{debits,\s*balances\};\s*\}/);
  const merchMatch = code.match(/function parseMerchantsColumn[\s\S]*?return items;\s*\}/);

  assert.ok(cleanMatch, "cleanMerchantDesc function must exist");
  assert.ok(debitLineMatch, "parseDebitLine function must exist");
  assert.ok(amtMatch, "parseAmountsColumn function must exist");
  assert.ok(merchMatch, "parseMerchantsColumn function must exist");

  vm.runInContext(`
    ${cleanMatch[0]}
    function cleanMerchantName(str){ return cleanMerchantDesc(str); }
    ${debitLineMatch[0]}
    ${amtMatch[0]}
    ${merchMatch[0]}
  `, context);

  const amountsOcr = `
Q
-£12.36
£3,071.28
-€7.75
£3,083.64
- £5.11
£3,091.39 ?
-£0.24
£3,096.50
-£100.00
£3,096.74
-£17.89
£3,196.74
-£6.00
£3,214.63
`;

  const merchantsOcr = `
October All
Yesterday
[2 Teslalnec.
[J Tesla Inc.
| Tesla Inc.
[FJ FASTHOSTS
Fri 16 October
AQ ARGOS PAY
SF SCREWFIX
Thu 15 October
[2 ABRATAX
`;

  const { debits, balances } = context.parseAmountsColumn(amountsOcr);
  assert.deepEqual([...debits], [12.36, 7.75, 5.11, 0.24, 100, 17.89, 6]);
  assert.equal(balances[0], 3071.28);

  const merchants = context.parseMerchantsColumn(merchantsOcr, "2026-10");
  assert.equal(merchants.length, 7);
  assert.equal(merchants[0].description, "Tesla Inc");
  assert.equal(merchants[3].description, "FASTHOSTS");
  assert.equal(merchants[4].description, "ARGOS PAY");
  assert.equal(merchants[5].description, "SCREWFIX");
  assert.equal(merchants[6].description, "ABRATAX");
});

test("bank-auto-allocate: matchDebitsWithMerchants correctly matches by vertical Y proximity and avoids index shift", () => {
  const code = fs.readFileSync("quick-spend.js", "utf8");

  const context = {
    Set,
    Math,
    Array
  };
  vm.createContext(context);

  const matchFn = code.match(/function matchDebitsWithMerchants[\s\S]*?return transactions;\s*\}/);
  assert.ok(matchFn, "matchDebitsWithMerchants function must exist");
  vm.runInContext(matchFn[0], context);

  // Scenario 1: All 7 debits and 7 merchants present
  const debits = [
    { amt: 12.36, y: 514 },
    { amt: 7.75, y: 660 },
    { amt: 5.11, y: 803 },
    { amt: 0.24, y: 953 },
    { amt: 100.00, y: 1199 },
    { amt: 17.89, y: 1346 },
    { amt: 6.00, y: 1593 }
  ];

  const fullMerchants = [
    { desc: "Tesla Inc", date: "19 Oct", y: 525 },
    { desc: "Tesla Inc", date: "19 Oct", y: 671 },
    { desc: "Tesla Inc", date: "19 Oct", y: 816 },
    { desc: "FASTHOSTS", date: "19 Oct", y: 963 },
    { desc: "ARGOS PAY", date: "16 Oct", y: 1203 },
    { desc: "SCREWFIX", date: "16 Oct", y: 1348 },
    { desc: "ABRATAX", date: "15 Oct", y: 1603 }
  ];

  const tx1 = context.matchDebitsWithMerchants(debits, fullMerchants, "19 Oct");
  assert.equal(tx1.length, 7);
  assert.equal(tx1[0].description, "Tesla Inc");
  assert.equal(tx1[0].amount, 12.36);
  assert.equal(tx1[3].description, "FASTHOSTS");
  assert.equal(tx1[3].amount, 0.24);
  assert.equal(tx1[4].description, "ARGOS PAY");
  assert.equal(tx1[4].amount, 100.00);
  assert.equal(tx1[5].description, "SCREWFIX");
  assert.equal(tx1[5].amount, 17.89);
  assert.equal(tx1[6].description, "ABRATAX");
  assert.equal(tx1[6].amount, 6.00);

  // Scenario 2: 2 Tesla rows dropped by OCR (5 merchants, 7 debits)
  // CRITICAL: FastHosts must NOT take £7.75, Argos must NOT take £5.11!
  const droppedMerchants = [
    { desc: "Tesla Inc", date: "19 Oct", y: 525 },
    { desc: "FASTHOSTS", date: "19 Oct", y: 963 },
    { desc: "ARGOS PAY", date: "16 Oct", y: 1203 },
    { desc: "SCREWFIX", date: "16 Oct", y: 1348 },
    { desc: "ABRATAX", date: "15 Oct", y: 1603 }
  ];

  const tx2 = context.matchDebitsWithMerchants(debits, droppedMerchants, "19 Oct");
  assert.equal(tx2.length, 7);
  assert.equal(tx2[0].description, "Tesla Inc");
  assert.equal(tx2[0].amount, 12.36);

  // Dropped merchant debits become "Bank Spend" with correct date, NOT shifted into FastHosts!
  assert.equal(tx2[1].description, "Bank Spend");
  assert.equal(tx2[1].amount, 7.75);
  assert.equal(tx2[2].description, "Bank Spend");
  assert.equal(tx2[2].amount, 5.11);

  // Remaining merchants correctly match their actual debits:
  assert.equal(tx2[3].description, "FASTHOSTS");
  assert.equal(tx2[3].amount, 0.24);
  assert.equal(tx2[4].description, "ARGOS PAY");
  assert.equal(tx2[4].amount, 100.00);
  assert.equal(tx2[5].description, "SCREWFIX");
  assert.equal(tx2[5].amount, 17.89);
  assert.equal(tx2[6].description, "ABRATAX");
  assert.equal(tx2[6].amount, 6.00);
});

test("supabase-sync: mergeCashflowPayload preserves both local and remote transactions without deletion", () => {
  const { mergeCashflowPayload, mergeAppStatePayload } = require("./supabase-sync.js");

  const localCashflow = JSON.stringify({
    month: "2026-10",
    bank: 3071.28,
    bankAccounts: { zempler: 0, lloyds: 3071.28 },
    fixed: [
      { id: "fix-1", due: "1 Oct", payment: "Rent", actual: 500, status: "Paid" }
    ],
    spending: [
      { id: "tx-1", date: "19 Oct", description: "Tesla Inc.", actual: 12.36, status: "Paid" },
      { id: "tx-2", date: "19 Oct", description: "Tesla Inc.", actual: 7.75, status: "Paid" }
    ],
    income: []
  });

  const remoteCashflow = JSON.stringify({
    month: "2026-10",
    bank: 0,
    bankAccounts: { zempler: 0, lloyds: 0 },
    fixed: [
      { id: "fix-1", due: "1 Oct", payment: "Rent", actual: 500, status: "Paid" }
    ],
    spending: [
      { id: "tx-3", date: "21 Oct", description: "Tesla Inc. Supercharge", actual: 18.50, status: "Paid" }
    ],
    income: [
      { id: "inc-1", date: "1 Oct", description: "Salary", actual: 2000, status: "Received" }
    ]
  });

  const mergedStr = mergeCashflowPayload(localCashflow, remoteCashflow);
  const merged = JSON.parse(mergedStr);

  assert.equal(merged.month, "2026-10");
  // Both local Tesla items (tx-1, tx-2) and remote Tesla item (tx-3) must exist
  assert.equal(merged.spending.length, 3);
  const ids = merged.spending.map(s => s.id);
  assert.ok(ids.includes("tx-1"));
  assert.ok(ids.includes("tx-2"));
  assert.ok(ids.includes("tx-3"));

  // Remote income is preserved
  assert.equal(merged.income.length, 1);
  assert.equal(merged.income[0].id, "inc-1");

  // Non-zero bank balance is preserved
  assert.equal(merged.bankAccounts.lloyds, 3071.28);
  assert.equal(merged.bank, 3071.28);
});

test("supabase-sync: mergeAppStatePayload preserves campaignTransactions and properties without deletion", () => {
  const { mergeAppStatePayload } = require("./supabase-sync.js");

  const localState = JSON.stringify({
    version: 3,
    campaignTransactions: [
      { id: "camp-tx-1", campaignId: "c1", amount: 100 }
    ],
    properties: [
      { id: "p1", property: "5a Ranelagh Road" }
    ]
  });

  const remoteState = JSON.stringify({
    version: 3,
    campaignTransactions: [
      { id: "camp-tx-2", campaignId: "c2", amount: 200 }
    ],
    properties: [
      { id: "p1", property: "5a Ranelagh Road" },
      { id: "p2", property: "35 Leslie Road" }
    ]
  });

  const merged = JSON.parse(mergeAppStatePayload(localState, remoteState));
  assert.equal(merged.campaignTransactions.length, 2);
  assert.equal(merged.properties.length, 2);
});


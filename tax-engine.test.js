const assert = require("assert");
const tax = require("./tax-engine");

assert.equal(tax.mileageAllowance(52000, "2025-26"), 15000);
assert.equal(tax.mileageAllowance(52000, "2026-27"), 16000);
assert.equal(tax.personalAllowance(100000, 12570), 12570);
assert.equal(tax.personalAllowance(110000, 12570), 7570);
assert.equal(tax.personalAllowance(125140, 12570), 0);
assert.equal(tax.class4NI(39000, "2026-27"), 1585.8);

const base = {year:"2026-27", pensionIncome:8600, propertyIncome:32000, propertyExpenses:3000, financeCosts:3700, businessMiles:52000, monthsRemaining:12};
const expected = new Map([[42000,12937.8],[55000,18917.8],[70000,25668.6]]);
for (const [uberIncome, liability] of expected) {
  const result = tax.calculate({...base, uberIncome});
  assert.equal(result.propertyProfit, 29000);
  assert.equal(result.financeCostCredit, 740);
  assert.equal(result.liability, liability);
  assert(result.outstanding >= 0);
}
const paid = tax.calculate({...base, uberIncome:55000, hmrcPaid:20000});
assert.equal(paid.outstanding, 0);
assert.equal(paid.monthlyPayment, 0);

const disabled = tax.calculate({...base, uberIncome:55000, modules:{uber:false,property:false,pension:false}});
assert.equal(disabled.totalIncome, 0);
assert.equal(disabled.liability, 0);

const paye = tax.calculate({year:"2026-27", modules:{employment:true,uber:false,property:false,pension:false}, employmentIncome:40000, employmentTaxCode:"1257L", payeTax:5000, payeTaxProvided:true});
assert.equal(paye.employment, 40000);
assert.equal(paye.taxAtSource, 5000);
assert.equal(paye.liability, 486);
assert.equal(tax.parseTaxCode("1257L").allowance,12570);
assert.equal(tax.estimatePayeTax(40000,"1257L","2026-27"),5486);
assert.equal(tax.estimatePayeTax(10000,"BR","2026-27"),2000);
assert.equal(tax.estimatePayeTax(10000,"NT","2026-27"),0);
const codedPension=tax.calculate({year:"2026-27",modules:{employment:false,uber:false,property:false,pension:true},pensionIncome:20000,pensionTaxCode:"BR"});
assert.equal(codedPension.expectedPensionTax,4000);
assert.equal(codedPension.taxAtSource,4000);
const poa=tax.calculate({...base,uberIncome:55000});
assert.equal(poa.firstPaymentOnAccount,9458.9);
assert.equal(poa.secondPaymentOnAccount,9458.9);
assert.equal(poa.totalCashDue,28376.7);
const noPoa=tax.calculate({year:"2025-26",modules:{employment:true,uber:false,property:false,pension:false},employmentIncome:20000,payeTax:1486,payeTaxProvided:true});
assert.equal(noPoa.firstPaymentOnAccount,0);

const paymentPlan = tax.calculate({...base, uberIncome:55000, hmrcReserve:1000, catchupShortfall:500, catchupMonths:10, minimumPayment:100, roundPaymentTo:50});
assert.equal(paymentPlan.outstanding, 18417.8);
assert.equal(paymentPlan.monthlyPayment, 1850);

const savings = tax.calculate({year:"2026-27", modules:{savings:true,uber:false,property:false,pension:false}, savingsIncome:4000, startingSavingsRateEnabled:true});
assert.equal(savings.savingsTax, 0);
const uberStatement = tax.calculate({year:"2026-27",modules:{uber:true,property:false,pension:false},uberIncome:1114.13,uberPlatformExpenses:229.05,simplifiedMileage:false});
assert.equal(uberStatement.uberIncome,1114.13);
assert.equal(uberStatement.uberPlatformExpenses,229.05);
assert.equal(uberStatement.uberProfit,885.08);
const hmrc2526=tax.calculate({year:"2025-26",modules:{employment:true,uber:false,property:true,pension:true,savings:false,dividends:false,other:false},employmentIncome:21773,payeTax:4355,payeTaxProvided:true,pensionIncome:8295,pensionTaxDeducted:692,pensionTaxProvided:true,propertyIncome:30800,propertyExpenses:5799,financeCosts:11925,financeRestrictionEnabled:true,hmrcPaid:832.40});
assert.equal(hmrc2526.totalIncome,55069);
assert.equal(hmrc2526.taxableIncome,42499);
assert.equal(hmrc2526.financeCostCredit,2385);
assert.equal(hmrc2526.liability,2027.60);
assert.equal(hmrc2526.outstanding,1195.20);
assert.equal(hmrc2526.firstPaymentOnAccount,1013.80);
assert.equal(hmrc2526.secondPaymentOnAccount,1013.80);
console.log("Tax Engine: all calculation tests passed.");

const assert=require("assert");
const controls=require("./financial-controls");

const rents=[
  {id:"a",propertyId:"penn",date:"2026-08-01",period:"2026-08",amount:850},
  {id:"b",propertyId:"penn",date:"2026-08-24",period:"2026-08",amount:850},
  {id:"c",propertyId:"penn",date:"2026-09-01",period:"2026-09",amount:850}
];
assert.equal(controls.propertyRentDuplicates(rents).length,1);
assert.equal(controls.propertyRentDuplicates(rents)[0].count,2);

const weeks=[
  {id:"a",weekStart:"2026-07-27",weekEnd:"2026-08-02"},
  {id:"b",weekStart:"2026-07-27",weekEnd:"2026-08-02"},
  {id:"c",weekStart:"2026-08-03",weekEnd:"2026-08-09"}
];
assert.equal(controls.uberWeekDuplicates(weeks).length,1);

const statement={customerPayments:682.87,governmentThirdPartyFees:14,uberServiceFee:99.04,tips:4,otherAdjustments:0,netUberPayment:573.83,uberBreakdownStatus:"complete"};
assert.equal(controls.uberReconciliation(statement).calculated,573.83);
assert.equal(controls.uberReconciliation(statement).reconciled,true);
assert.equal(controls.unreconciledUber([statement,{...statement,id:"bad",netUberPayment:570}]).length,1);

const cash=[
  {month:"2026-08",date:"1 Aug",description:"Bank charges",actual:0.99},
  {month:"2026-08",date:"1 Aug",description:"Bank charges",actual:0.99},
  {month:"2026-08",date:"2 Aug",description:"Bank charges",actual:0.99}
];
assert.equal(controls.cashflowDuplicates(cash).length,1);
console.log("Financial controls: all tests passed.");

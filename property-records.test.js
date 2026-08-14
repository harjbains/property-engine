const assert=require("node:assert/strict");
const PropertyRecords=require("./property-records.js");

const properties=[{id:"p1",property:"524 Penn Road"},{id:"p2",property:"5 Ranelagh Road"}];
const existing=[{id:"e1",propertyId:"p1",date:"2026-04-28",category:"Mortgage interest",amount:277.8}];
const payload={source:"Verified recovery",propertyExpenses:[
  {id:"same",property:"524 Penn Road",date:"2026-04-28",category:"Mortgage interest",amount:277.8},
  {id:"conflict",property:"5 Ranelagh Road",date:"2026-04-28",category:"Mortgage interest",amount:277.8},
  {id:"new",property:"5 Ranelagh Road",date:"2026-05-05",category:"Mortgage interest",amount:428.42},
  {id:"unknown",property:"Unknown",date:"2026-05-05",category:"Insurance",amount:10},
  {id:"invalid",property:"524 Penn Road",date:"bad-date",category:"Insurance",amount:10}
]};
const preview=PropertyRecords.previewRecovery({payload,properties,records:existing});
assert.deepEqual({added:preview.added,skipped:preview.skipped,conflicts:preview.conflicts,unmatched:preview.unmatched,invalid:preview.invalid},{added:1,skipped:1,conflicts:1,unmatched:1,invalid:1});
const recovered=PropertyRecords.recoveredRecords(preview,{createId:()=>"generated",now:()=>"2026-08-14T12:00:00.000Z",source:payload.source});
assert.deepEqual(recovered,[{id:"new",propertyId:"p2",date:"2026-05-05",category:"Mortgage interest",amount:428.42,notes:"Recovered from verified source",recoverySource:"Verified recovery",recoveredAt:"2026-08-14T12:00:00.000Z"}]);
assert.equal(PropertyRecords.expenseCategory("Property Management"),"agent fees");
console.log("Property records API: all tests passed.");

const assert=require("assert");
const exporter=require("./abratax-export");

const self=exporter.selfEmploymentRows({turnover:1000.129,otherIncome:20,carTravel:123.456,admin:80,otherExpenses:15});
assert.equal(self.length,32);
assert.equal(self[1][0],"Template version: SE-1.0.0 (read only - must be present)");
assert.equal(self[4][1],1000.13);
assert.equal(self[5][1],20);
assert.equal(self[20][1],123.46);
assert.equal(self[23][1],80);
assert.equal(self[31][1],15);
assert.equal(self[31][5],0);

const property=exporter.propertyRows({rentalIncome:5000,repairs:200,premises:300,services:40,professional:100,travel:25,other:15,residentialFinance:600,carriedResidentialFinance:50});
assert.equal(property.length,30);
assert.equal(property[1][0],"Template version: UKP-1.1.0 (read only - must be present)");
assert.equal(property[4][1],5000);
assert.equal(property[13][1],"");
assert.equal(property[14][1],"");
assert.equal(property[20][1],200);
assert.equal(property[21][1],300);
assert.equal(property[22][1],40);
assert.equal(property[23][1],100);
assert.equal(property[24][1],25);
assert.equal(property[25][1],15);
assert.equal(property[27][1],600);
assert(exporter.selfEmploymentCsv({turnover:1}).startsWith("\uFEFFSELF EMPLOYMENT"));
assert(exporter.propertyCsv({rentalIncome:1}).includes("UKP-1.1.0"));
console.log("AbraTax export: all template mapping tests passed.");

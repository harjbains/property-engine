const fs=require("fs");
const crypto=require("crypto");

const [backupPath,statementPath,outputPath]=process.argv.slice(2);
if(!backupPath||!statementPath||!outputPath){
  console.error("Usage: node tools/build-property-expense-recovery.js <backup.json> <statement.csv> <output.json>");
  process.exit(1);
}

function csvRows(text){
  text=text.replace(/^\uFEFF/,"");
  const rows=[];let row=[],field="",quoted=false;
  for(let i=0;i<text.length;i++){
    const char=text[i],next=text[i+1];
    if(char==='"'&&quoted&&next==='"'){field+='"';i++;}
    else if(char==='"')quoted=!quoted;
    else if(char===","&&!quoted){row.push(field);field="";}
    else if((char==="\n"||char==="\r")&&!quoted){if(char==="\r"&&next==="\n")i++;row.push(field);if(row.some(Boolean))rows.push(row);row=[];field="";}
    else field+=char;
  }
  if(field||row.length){row.push(field);rows.push(row);}
  const headers=rows.shift();return rows.map(values=>Object.fromEntries(headers.map((h,i)=>[h,values[i]||""])));
}
function isoUk(date){const [day,month,year]=date.split("/");return `${year}-${month}-${day}`;}
function inTaxYear(date){return date>="2025-04-06"&&date<="2026-04-05";}

const exported=JSON.parse(fs.readFileSync(backupPath,"utf8"));
const state=JSON.parse(exported.storage?.["tax-engine-v3"]||"null");
if(!state)throw new Error("Backup does not contain tax-engine-v3");
const propertyNames=new Map((state.properties||[]).map(property=>[property.id,property.property]));
const expenses=[];
for(const row of state.propertyExpenses||[]){
  if(row.category!=="Property Management"||!inTaxYear(row.date))continue;
  expenses.push({id:crypto.randomUUID(),property:propertyNames.get(row.propertyId),date:row.date,category:"Agent fees",amount:Number(row.amount),notes:`Recovered letting-agent fee from 26 July backup (${row.notes||row.date})`,recoverySource:"Tax Engine export 2026-07-26"});
}
const mappings=[
  [/UCB HOMELOANS/i,"524 Penn Road","Mortgage interest"],
  [/ACCORD MORTGAGES/i,"35 Leslie Road","Mortgage interest"],
  [/Topaz Finance/i,"5a Ranelagh Road","Mortgage interest"],
  [/UKI T\/A Direct Line/i,"5a Ranelagh Road","Insurance"]
];
for(const row of csvRows(fs.readFileSync(statementPath,"utf8"))){
  const date=isoUk(row.Date||"");if(!inTaxYear(date))continue;
  const mapping=mappings.find(([pattern])=>pattern.test(row.Description||""));if(!mapping)continue;
  const amount=Math.abs(Number(String(row.Debit||"").replace(/[^0-9.-]/g,""))||0);if(!amount)continue;
  expenses.push({id:crypto.randomUUID(),property:mapping[1],date,category:mapping[2],amount,notes:`Recovered from bank statement: ${row.Description}${mapping[2]==="Mortgage interest"?" (interest-only mortgage confirmed by owner)":""}`,recoverySource:row["Source Statement"]||"Merged bank statements"});
}
const seen=new Set(),deduped=expenses.filter(row=>{const key=`${row.property}|${row.date}|${row.amount.toFixed(2)}|${row.category}`;if(seen.has(key))return false;seen.add(key);return true;});
const payload={kind:"tax-engine-property-expense-recovery",version:1,taxYear:"2025-26",createdAt:new Date().toISOString(),source:"26 July Tax Engine backup and consolidated bank statements; mortgages confirmed interest-only by owner on 5 August 2026",confirmedInterestOnly:true,propertyExpenses:deduped};
fs.writeFileSync(outputPath,JSON.stringify(payload,null,2));
const totals=Object.groupBy(deduped,row=>row.category);
console.log(`Created ${outputPath}`);
for(const [category,rows] of Object.entries(totals))console.log(`${category}: ${rows.length} rows / £${rows.reduce((sum,row)=>sum+row.amount,0).toFixed(2)}`);

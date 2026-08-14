(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;else root.PropertyRecords=api;})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const number=value=>Number(value)||0;
  const propertyName=value=>String(value||"").trim().toLowerCase();
  function expenseCategory(category){const value=String(category||"").trim().toLowerCase();return value==="agent fees"||value==="property management"?"agent fees":value;}
  function expenseKey(propertyId,date,amount,category){return`${propertyId||""}|${date||""}|${number(amount).toFixed(2)}|${expenseCategory(category)}`;}
  function looseExpenseKey(date,amount,category){return`${date||""}|${number(amount).toFixed(2)}|${expenseCategory(category)}`;}
  function previewRecovery({payload,properties=[],records=[]}={}){
    const rows=Array.isArray(payload?.propertyExpenses)?payload.propertyExpenses:[],propertyByName=new Map(properties.map(property=>[propertyName(property.property),property])),existing=new Set(records.map(record=>expenseKey(record.propertyId,record.date,record.amount,record.category))),existingLoose=new Map(),pending=[],seen=new Set(existing);
    for(const record of records){const key=looseExpenseKey(record.date,record.amount,record.category);if(!existingLoose.has(key))existingLoose.set(key,new Set());existingLoose.get(key).add(record.propertyId||"");}
    let skipped=0,unmatched=0,invalid=0,conflicts=0;
    for(const row of rows){const property=propertyByName.get(propertyName(row.property||row.propertyName));if(!property){unmatched++;continue;}const date=String(row.date||"").slice(0,10),amount=number(row.amount),category=String(row.category||"Other").trim();if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||amount<=0){invalid++;continue;}const key=expenseKey(property.id,date,amount,category);if(seen.has(key)){skipped++;continue;}const otherProperties=existingLoose.get(looseExpenseKey(date,amount,category));if(otherProperties&&[...otherProperties].some(propertyId=>propertyId&&propertyId!==property.id)){conflicts++;continue;}seen.add(key);pending.push({row,property,date,amount,category});}
    return{pending,added:pending.length,skipped,unmatched,invalid,conflicts};
  }
  function recoveredRecords(preview,{createId=()=>crypto.randomUUID(),now=()=>new Date().toISOString(),source="Property expense recovery"}={}){return(preview?.pending||[]).map(({row,property,date,amount,category})=>({id:row.id||createId(),propertyId:property.id,date,category,amount,notes:row.notes||"Recovered from verified source",recoverySource:row.recoverySource||source,recoveredAt:now()}));}
  return{expenseCategory,expenseKey,looseExpenseKey,previewRecovery,recoveredRecords};
});

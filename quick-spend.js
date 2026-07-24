(()=>{"use strict";
const KEY="tax-engine-v3",CASHFLOW_KEY_PREFIX="tax-engine-cashflow-",TAX_WORKSPACE_MONTH="2026-04",CASHFLOW_KEY="tax-engine-april-2026-cashflow",DEFAULT_BANK_ACCOUNT="zempler",money=new Intl.NumberFormat("en-GB",{style:"currency",currency:"GBP"});
const by=s=>document.querySelector(s),num=v=>Math.max(0,Number(v)||0),uid=()=>crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(16).slice(2)}`;
const todayIso=()=>new Date().toISOString().slice(0,10),monthIso=d=>String(d||todayIso()).slice(0,7),monthName=m=>new Date(`${m}-01T00:00:00`).toLocaleString("en-GB",{month:"short"});
function cashflowKey(month){return`${CASHFLOW_KEY_PREFIX}${month}`;}
function emptyCashflow(month){return{bank:0,bankAccounts:{zempler:0,lloyds:0},fixed:[],spending:[],income:[],month,lock:{status:"open",lockDay:null,lockedAt:""}};}
function displayDate(iso){const d=new Date(`${iso}T00:00:00`);return`${d.getDate()} ${monthName(iso.slice(0,7))}`;}
function loadCashflow(month){
  const saved=JSON.parse(localStorage.getItem(cashflowKey(month))||localStorage.getItem(month===TAX_WORKSPACE_MONTH?CASHFLOW_KEY:"null")||"null");
  const base=saved&&typeof saved==="object"?{...emptyCashflow(month),...saved,month}:emptyCashflow(month);
  base.fixed=Array.isArray(base.fixed)?base.fixed:[];base.spending=Array.isArray(base.spending)?base.spending:[];base.income=Array.isArray(base.income)?base.income:[];
  base.bankAccounts=base.bankAccounts||{zempler:num(base.bank),lloyds:0};
  base.bankAccounts.zempler=num(base.bankAccounts.zempler);base.bankAccounts.lloyds=num(base.bankAccounts.lloyds);base.bank=num(base.bankAccounts.zempler)+num(base.bankAccounts.lloyds);
  return base;
}
function saveCashflow(x){x.bank=num(x.bankAccounts?.zempler)+num(x.bankAccounts?.lloyds);localStorage.setItem(cashflowKey(x.month),JSON.stringify(x));}
function spendImpact(item){return item.status==="Paid"||item.status==="Part-paid"||item.actual!=null?-num(item.actual):0;}
function cashflowMonths(){
  const months=Object.keys(localStorage).filter(k=>k.startsWith(CASHFLOW_KEY_PREFIX)).map(k=>k.slice(CASHFLOW_KEY_PREFIX.length));
  if(localStorage.getItem(CASHFLOW_KEY)&&!months.includes(TAX_WORKSPACE_MONTH))months.push(TAX_WORKSPACE_MONTH);
  return months.sort();
}
function exportAllLocalData(){
  const payload={exportedAt:new Date().toISOString(),app:"tax-engine",storage:Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith("tax-engine-")).sort().map(k=>[k,localStorage.getItem(k)]))};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}),a=document.createElement("a");
  a.href=URL.createObjectURL(blob);a.download=`tax-engine-all-data-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);
}
function importAllLocalData(file){
  if(!file)return;
  const reader=new FileReader();
  reader.onload=()=>{try{const payload=JSON.parse(reader.result),storage=payload.storage||payload;if(!storage||typeof storage!=="object")throw new Error("No storage object found");const keys=Object.keys(storage).filter(k=>k.startsWith("tax-engine-"));if(!keys.length)throw new Error("No Tax Engine records found");if(!confirm(`Import ${keys.length} Tax Engine records into this browser?`))return;keys.forEach(k=>localStorage.setItem(k,String(storage[k])));by("#quickProperty").innerHTML=propertyOptions();renderRecent();by("#quickStatus").textContent=`Imported ${keys.length} data records.`;}catch(err){by("#quickStatus").textContent=`Import failed: ${err.message}`;}};
  reader.readAsText(file);
}
function propertyOptions(){
  let properties=[];
  try{properties=JSON.parse(localStorage.getItem(KEY)||"{}").properties||[];}catch{}
  return `<option value="">No property link</option>${properties.map(p=>`<option value="${p.id}">${p.property||p.property_name||"Property"}</option>`).join("")}`;
}
function propertyName(id){
  if(!id)return"";
  try{const p=(JSON.parse(localStorage.getItem(KEY)||"{}").properties||[]).find(x=>x.id===id);return p?.property||p?.property_name||"";}catch{return"";}
}
function addSpend(data){
  const x=loadCashflow(data.month),amount=num(data.amount),status=data.status||"Paid",account=data.account||DEFAULT_BANK_ACCOUNT;
  const propertyId=data.propertyId||"",treatment=propertyId?"property_expense":"cashflow";
  const item={id:uid(),createdAt:new Date().toISOString(),date:displayDate(data.date),description:data.description.trim(),category:data.category||"Other",planned:status==="Planned"?amount:null,actual:status==="Planned"?null:amount,status,treatment,propertyId,notes:data.notes.trim(),account};
  x.spending.push(item);
  x.bankAccounts=x.bankAccounts||{zempler:0,lloyds:0};
  x.bankAccounts[account]=num(x.bankAccounts[account])+spendImpact(item);
  saveCashflow(x);
  return item;
}
function renderRecent(){
  const rows=cashflowMonths().flatMap(month=>{
    const x=loadCashflow(month);
    return(x.spending||[]).map(i=>({...i,month}));
  }).sort((a,b)=>String(b.createdAt||b.id||"").localeCompare(String(a.createdAt||a.id||""))).slice(0,10);
  by("#quickRecent").innerHTML=rows.length?rows.map(i=>{const p=propertyName(i.propertyId);return`<div class="quick-row"><span><strong>${i.description}</strong><small>${i.date} - ${i.month}${p?` - ${p}`:""} - ${i.category} - ${i.status}</small></span><em>${money.format(num(i.actual??i.planned))}</em></div>`;}).join(""):`<div class="quick-empty">No spending recorded yet.</div>`;
}
function init(){
  by("#quickDate").value=todayIso();by("#quickMonth").value=monthIso();
  by("#quickProperty").innerHTML=propertyOptions();
  renderRecent();
  by("#quickExportButton").addEventListener("click",exportAllLocalData);
  by("#quickImportButton").addEventListener("click",()=>by("#quickImportFile").click());
  by("#quickImportFile").addEventListener("change",event=>{importAllLocalData(event.target.files?.[0]);event.target.value="";});
  by("#quickMonth").addEventListener("change",renderRecent);
  by("#quickDate").addEventListener("change",event=>{by("#quickMonth").value=monthIso(event.target.value);renderRecent();});
  by("#quickSpendForm").addEventListener("submit",event=>{
    event.preventDefault();
    const form=new FormData(event.currentTarget),item=addSpend(Object.fromEntries(form.entries()));
    by("#quickStatus").textContent=`Added ${money.format(num(item.actual??item.planned))} to ${form.get("month")}.`;
    event.currentTarget.description.value="";event.currentTarget.amount.value="";event.currentTarget.notes.value="";
    event.currentTarget.description.focus();renderRecent();
  });
}
init();
})();

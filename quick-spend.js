(function(){
const CASHFLOW_KEY_PREFIX="tax-engine-cashflow-", KEY="tax-engine-april-2026", TAX_WORKSPACE_MONTH="2026-04", DEFAULT_BANK_ACCOUNT="zempler";
const by=s=>document.querySelector(s),num=v=>Math.max(0,Number(v)||0),uid=()=>crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(16).slice(2)}`;
const money=new Intl.NumberFormat("en-GB",{style:"currency",currency:"GBP"});
const todayIso=()=>new Date().toISOString().slice(0,10),monthIso=d=>String(d||todayIso()).slice(0,7);

function cashflowKey(month){return`${CASHFLOW_KEY_PREFIX}${month}`;}
function emptyCashflow(month){return{bank:0,bankAccounts:{zempler:0,lloyds:0},fixed:[],spending:[],income:[],month,lock:{status:"open",lockDay:null,lockedAt:""}};}

function loadCashflow(month){
  const saved=JSON.parse(localStorage.getItem(cashflowKey(month))||localStorage.getItem(month===TAX_WORKSPACE_MONTH?"tax-engine-april-2026-cashflow":"null")||"null");
  const base=saved&&typeof saved==="object"?{...emptyCashflow(month),...saved,month}:emptyCashflow(month);
  base.fixed=Array.isArray(base.fixed)?base.fixed:[];base.spending=Array.isArray(base.spending)?base.spending:[];base.income=Array.isArray(base.income)?base.income:[];
  base.bankAccounts=base.bankAccounts||{zempler:num(base.bank),lloyds:0};
  base.bankAccounts.zempler=num(base.bankAccounts.zempler);base.bankAccounts.lloyds=num(base.bankAccounts.lloyds);
  return base;
}
function saveCashflow(x){
  x.bank=num(x.bankAccounts?.zempler)+num(x.bankAccounts?.lloyds);
  localStorage.setItem(cashflowKey(x.month),JSON.stringify(x));
}

function propertyOptions(){
  let properties=[];
  try{properties=JSON.parse(localStorage.getItem(KEY)||"{}").properties||[];}catch{}
  return `<option value="">None</option>${properties.map(p=>`<option value="${p.id}">${p.property||p.property_name||"Property"}</option>`).join("")}`;
}
function propertyName(id){
  if(!id)return"";
  try{const p=(JSON.parse(localStorage.getItem(KEY)||"{}").properties||[]).find(x=>x.id===id);return p?.property||p?.property_name||"";}catch{return"";}
}
function dateLabel(dateStr){
  if(!dateStr)return "";
  if(/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return new Date(dateStr).toLocaleDateString("en-GB",{day:"2-digit",month:"short"});
  return dateStr;
}

let currentMonth = monthIso();

function render(){
  const x = loadCashflow(currentMonth);
  
  // Render Balances
  by("#balZempler").textContent = money.format(x.bankAccounts.zempler);
  by("#balLloyds").textContent = money.format(x.bankAccounts.lloyds);
  
  // Aggregate all items
  const allItems = [
    ...x.fixed.map(i=>({...i, _type: 'cost'})),
    ...x.spending.map(i=>({...i, _type: 'cost'})),
    ...x.income.map(i=>({...i, _type: 'income'}))
  ];
  
  // Sort items
  allItems.sort((a,b) => {
    const da = a.due||a.date||"", db = b.due||b.date||"";
    return da.localeCompare(db) || String(a.createdAt||a.id).localeCompare(String(b.createdAt||b.id));
  });
  
  const pending = allItems.filter(i => /Expected|Planned|Part-paid|Unplanned/i.test(i.status));
  const recent = allItems.filter(i => /Paid|Received/i.test(i.status)).reverse().slice(0, 15);
  
  function renderItem(i, isPending) {
    const isIncome = i._type === 'income';
    const amount = num(i.actual ?? i.expected ?? i.payment ?? i.planned);
    const title = i.description || i.payment || i.notes || "Item";
    const prop = propertyName(i.propertyId);
    const meta = [dateLabel(i.due||i.date), prop?prop:i.category||"Fixed", `<span class="mobile-badge ${i.account||DEFAULT_BANK_ACCOUNT}">${i.account||DEFAULT_BANK_ACCOUNT}</span>`].filter(Boolean).join(" &middot; ");
    
    let btnHtml = '';
    if (isPending) {
      const actionTxt = isIncome ? "Receive" : "Pay";
      btnHtml = `<button class="mobile-action-btn" onclick="checkOff('${i.id}', '${i._type}')">${actionTxt}</button>`;
    } else {
      btnHtml = `<span style="font-size: 0.8rem; color: #6b7280; text-transform: uppercase; font-weight: 600;">${i.status}</span>`;
    }
    
    return `
      <div class="mobile-item">
        <div class="mobile-item-info">
          <div class="mobile-item-title">${title}</div>
          <div class="mobile-item-meta">${meta}</div>
        </div>
        <div class="mobile-item-amount ${isIncome?'income':''}">${isIncome?'+':''}${money.format(amount)}</div>
        ${btnHtml}
      </div>
    `;
  }
  
  by("#mobileChecklist").innerHTML = pending.length ? pending.map(i => renderItem(i, true)).join("") : `<div style="padding: 1rem; color: #6b7280; font-size: 0.875rem; text-align: center;">All caught up!</div>`;
  by("#mobileRecent").innerHTML = recent.length ? recent.map(i => renderItem(i, false)).join("") : `<div style="padding: 1rem; color: #6b7280; font-size: 0.875rem; text-align: center;">No recent activity.</div>`;
}

window.checkOff = function(id, type) {
  const x = loadCashflow(currentMonth);
  let item = null;
  
  if (type === 'cost') {
    item = x.fixed.find(i=>i.id===id);
    if (!item) item = x.spending.find(i=>i.id===id);
  } else {
    item = x.income.find(i=>i.id===id);
  }
  
  if (!item) return;
  
  const amount = num(item.actual ?? item.expected ?? item.payment ?? item.planned);
  const account = item.account || DEFAULT_BANK_ACCOUNT;
  
  const oldImpact = type === "income" 
    ? ((item.status === "Received" || item.actual != null) ? num(item.actual) : 0)
    : ((item.status === "Paid" || item.status === "Part-paid" || item.actual != null) ? -num(item.actual) : 0);
    
  const newImpact = type === "income" ? amount : -amount;
  
  item.actual = amount;
  item.status = type === 'income' ? 'Received' : 'Paid';
  
  x.bankAccounts[account] = num(x.bankAccounts[account]) - oldImpact + newImpact;
  
  saveCashflow(x);
  render();
};

function init(){
  by("#mobileMonth").value = currentMonth;
  by("#spendDay").value = todayIso();
  by("#spendProperty").innerHTML = propertyOptions();
  
  render();
  
  by("#mobileMonth").addEventListener("change", e => {
    currentMonth = e.target.value;
    render();
  });
  
  by("#mobileSpendForm").addEventListener("submit", event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const amount = num(form.get("amount"));
    const account = form.get("account") || DEFAULT_BANK_ACCOUNT;
    const propertyId = form.get("propertyId") || "";
    
    const x = loadCashflow(currentMonth);
    const item = {
      id: uid(),
      createdAt: new Date().toISOString(),
      date: form.get("date"),
      description: form.get("description").trim(),
      category: form.get("category") || "Other",
      planned: null,
      actual: amount,
      status: "Paid",
      treatment: propertyId ? "property_expense" : "cashflow",
      propertyId,
      notes: "",
      account
    };
    
    x.spending.push(item);
    x.bankAccounts[account] = num(x.bankAccounts[account]) - amount;
    saveCashflow(x);
    
    event.currentTarget.reset();
    by("#spendDay").value = todayIso();
    render();
  });
  
  window.addEventListener("pageshow", render);
  window.addEventListener("focus", render);
}

init();
})();

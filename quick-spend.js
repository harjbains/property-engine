(function(){
const CASHFLOW_KEY_PREFIX="tax-engine-cashflow-", KEY="tax-engine-april-2026", TAX_WORKSPACE_MONTH="2026-04", DEFAULT_BANK_ACCOUNT="zempler";
const by=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)],num=v=>Math.max(0,Number(v)||0),uid=()=>crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(16).slice(2)}`;
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

function extractDayNumber(item) {
  const val = String(item.due || item.date || "").trim();
  if (/^\d{4}-\d{2}-(\d{2})/.test(val)) {
    return parseInt(val.match(/^\d{4}-\d{2}-(\d{2})/)[1], 10);
  }
  const m = val.match(/\b\d{1,2}\b/);
  if (m) {
    return parseInt(m[0], 10);
  }
  return 99;
}

function itemDateSort(a, b) {
  const dayA = extractDayNumber(a);
  const dayB = extractDayNumber(b);
  if (dayA !== dayB) return dayA - dayB;
  return String(a.due || a.date || "").localeCompare(String(b.due || b.date || ""))
    || String(a.createdAt || a.id || "").localeCompare(String(b.createdAt || b.id || ""));
}

function isPendingStatus(status) {
  const s = String(status || "").trim().toLowerCase();
  return s !== "paid" && s !== "received";
}

let currentMonth = monthIso();
let activeTypeFilter = "all";
let pastSortOrder = "desc";

function completedDateSort(a, b) {
  const dayA = extractDayNumber(a);
  const dayB = extractDayNumber(b);
  if (dayA !== dayB) {
    return pastSortOrder === "desc" ? dayB - dayA : dayA - dayB;
  }
  return pastSortOrder === "desc"
    ? String(b.due || b.date || "").localeCompare(String(a.due || a.date || "")) || String(b.createdAt || b.id || "").localeCompare(String(a.createdAt || a.id || ""))
    : String(a.due || a.date || "").localeCompare(String(b.due || b.date || "")) || String(a.createdAt || a.id || "").localeCompare(String(b.createdAt || b.id || ""));
}

function renderItem(i, isPending) {
  const isIncome = i._type === 'income';
  const amount = num(i.actual ?? i.expected ?? i.payment ?? i.planned);
  const title = i.description || i.payment || i.notes || "Item";
  const prop = propertyName(i.propertyId);
  const dateStr = dateLabel(i.due || i.date);
  const meta = [
    dateStr ? `<span class="date-chip">📅 ${dateStr}</span>` : "",
    prop ? `<span>🏠 ${prop}</span>` : (i.category ? `<span>${i.category}</span>` : ""),
    `<span class="mobile-badge ${i.account||DEFAULT_BANK_ACCOUNT}">${i.account||DEFAULT_BANK_ACCOUNT}</span>`
  ].filter(Boolean).join(" &middot; ");

  let btnHtml = '';
  if (isPending) {
    if (isIncome) {
      btnHtml = `<button class="mobile-action-btn btn-receive" onclick="checkOff('${i.id}', 'income')">Receive</button>`;
    } else {
      btnHtml = `<button class="mobile-action-btn btn-pay" onclick="checkOff('${i.id}', 'cost')">Pay</button>`;
    }
  } else {
    btnHtml = `<span style="font-size: 0.75rem; color: #6b7280; text-transform: uppercase; font-weight: 700;">${i.status}</span>`;
  }

  return `
    <div class="mobile-item">
      <div class="mobile-item-info">
        <div class="mobile-item-title">${title}</div>
        <div class="mobile-item-meta">${meta}</div>
      </div>
      <div class="mobile-item-amount ${isIncome?'income':'expense'}">${isIncome?'+':'-'}${money.format(amount)}</div>
      ${btnHtml}
    </div>
  `;
}

function render(){
  const x = loadCashflow(currentMonth);

  // Render Account Balances
  by("#balZempler").textContent = money.format(x.bankAccounts.zempler);
  by("#balLloyds").textContent = money.format(x.bankAccounts.lloyds);

  // Separate Expenses and Income
  const allCosts = [
    ...x.fixed.map(i=>({...i, _type: 'cost'})),
    ...x.spending.map(i=>({...i, _type: 'cost'}))
  ];
  const allIncome = [
    ...x.income.map(i=>({...i, _type: 'income'}))
  ];

  // Filter and sort Pending items by date
  const pendingCosts = allCosts.filter(i => isPendingStatus(i.status)).sort(itemDateSort);
  const pendingIncome = allIncome.filter(i => isPendingStatus(i.status)).sort(itemDateSort);

  // Totals
  const totalPendingCostsAmount = pendingCosts.reduce((sum, i) => sum + num(i.expected ?? i.payment ?? i.planned ?? i.actual), 0);
  const totalPendingIncomeAmount = pendingIncome.reduce((sum, i) => sum + num(i.expected ?? i.actual), 0);

  // Update Summary Containers
  by("#totalPendingExpenses").textContent = money.format(totalPendingCostsAmount);
  by("#countPendingExpenses").textContent = `${pendingCosts.length} item${pendingCosts.length === 1 ? '' : 's'} pending`;
  by("#subtotalPendingExpenses").textContent = money.format(totalPendingCostsAmount);

  by("#totalPendingIncome").textContent = money.format(totalPendingIncomeAmount);
  by("#countPendingIncome").textContent = `${pendingIncome.length} item${pendingIncome.length === 1 ? '' : 's'} pending`;
  by("#subtotalPendingIncome").textContent = money.format(totalPendingIncomeAmount);

  // Render Pending Containers based on Filter
  const containerIncome = by("#containerPendingIncome");
  const containerExpenses = by("#containerPendingExpenses");

  if (activeTypeFilter === "all") {
    containerIncome.style.display = "";
    containerExpenses.style.display = "";
  } else if (activeTypeFilter === "income") {
    containerIncome.style.display = "";
    containerExpenses.style.display = "none";
  } else {
    containerIncome.style.display = "none";
    containerExpenses.style.display = "";
  }

  // Render Lists
  by("#listPendingIncome").innerHTML = pendingIncome.length
    ? pendingIncome.map(i => renderItem(i, true)).join("")
    : `<div style="padding: 0.85rem; color: #9ca3af; font-size: 0.825rem; text-align: center; background: white; border-radius: 0.5rem;">No pending income for this month.</div>`;

  by("#listPendingExpenses").innerHTML = pendingCosts.length
    ? pendingCosts.map(i => renderItem(i, true)).join("")
    : `<div style="padding: 0.85rem; color: #9ca3af; font-size: 0.825rem; text-align: center; background: white; border-radius: 0.5rem;">No pending expenses for this month.</div>`;

  // Completed Transactions (Sorted by date, showing ALL items)
  const allItems = [...allCosts, ...allIncome];
  const completed = allItems.filter(i => !isPendingStatus(i.status)).sort(completedDateSort);

  const totalCompletedCost = completed.filter(i => i._type === 'cost').reduce((sum, i) => sum + num(i.actual ?? i.expected ?? i.payment ?? i.planned), 0);
  const totalCompletedIncome = completed.filter(i => i._type === 'income').reduce((sum, i) => sum + num(i.actual ?? i.expected), 0);

  const pastSub = by("#pastTransactionsSub");
  if (pastSub) pastSub.textContent = `${completed.length} item${completed.length === 1 ? '' : 's'} (${money.format(totalCompletedIncome)} in, ${money.format(totalCompletedCost)} out)`;
  const pastTotal = by("#pastTransactionsTotal");
  if (pastTotal) {
    pastTotal.textContent = money.format(totalCompletedIncome - totalCompletedCost);
    pastTotal.style.color = (totalCompletedIncome - totalCompletedCost) >= 0 ? "#059669" : "#374151";
  }

  by("#mobileRecent").innerHTML = completed.length
    ? completed.map(i => renderItem(i, false)).join("")
    : `<div style="padding: 0.85rem; color: #9ca3af; font-size: 0.825rem; text-align: center; background: white; border-radius: 0.5rem;">No completed items yet for this month.</div>`;
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

  all(".filter-pill").forEach(btn => {
    btn.addEventListener("click", e => {
      all(".filter-pill").forEach(b => b.classList.remove("active"));
      e.target.classList.add("active");
      activeTypeFilter = e.target.dataset.typeFilter;
      render();
    });
  });

  by("#btnSortPast")?.addEventListener("click", e => {
    pastSortOrder = pastSortOrder === "desc" ? "asc" : "desc";
    e.target.textContent = pastSortOrder === "desc" ? "Date ↓" : "Date ↑";
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

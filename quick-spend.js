(function(){
const CASHFLOW_KEY_PREFIX="tax-engine-cashflow-", KEY="tax-engine-april-2026", TAX_WORKSPACE_MONTH="2026-04", DEFAULT_BANK_ACCOUNT="lloyds";
const by=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)],num=v=>Math.max(0,Number(v)||0),uid=()=>crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(16).slice(2)}`;
const money=new Intl.NumberFormat("en-GB",{style:"currency",currency:"GBP"});
const escapeHtml=s=>String(s||"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const todayIso=()=>new Date().toISOString().slice(0,10),monthIso=d=>String(d||todayIso()).slice(0,7);

function cashflowKey(month){return`${CASHFLOW_KEY_PREFIX}${month}`;}
function emptyCashflow(month){return{bank:0,bankAccounts:{zempler:0,lloyds:0},fixed:[],spending:[],income:[],month,lock:{status:"open",lockDay:null,lockedAt:""}};}

function formatCashDate(dateStr, month=currentMonth){
  const s=String(dateStr||"").trim();
  if(!s)return"";
  const isoMatch=s.match(/^(\d{4})-(\d{2})-(\d{1,2})/);
  if(isoMatch){
    const y=Number(isoMatch[1]),m=Number(isoMatch[2]),d=Number(isoMatch[3]);
    const mStr=new Date(Date.UTC(y,m-1,1)).toLocaleString("en-GB",{month:"short",timeZone:"UTC"});
    return `${d} ${mStr}`;
  }
  return s;
}

function loadCashflow(month){
  const saved=JSON.parse(localStorage.getItem(cashflowKey(month))||localStorage.getItem(month===TAX_WORKSPACE_MONTH?"tax-engine-april-2026-cashflow":"null")||"null");
  const base=saved&&typeof saved==="object"?{...emptyCashflow(month),...saved,month}:emptyCashflow(month);
  base.fixed=Array.isArray(base.fixed)?base.fixed:[];base.spending=Array.isArray(base.spending)?base.spending:[];base.income=Array.isArray(base.income)?base.income:[];
  base.bankAccounts=base.bankAccounts||{zempler:0,lloyds:num(base.bank)};
  if(base.bankAccounts.zempler){base.bankAccounts.lloyds=num(base.bankAccounts.lloyds)+num(base.bankAccounts.zempler);base.bankAccounts.zempler=0;}
  base.bankAccounts.lloyds=num(base.bankAccounts.lloyds);base.bankAccounts.zempler=0;base.bank=base.bankAccounts.lloyds;
  const normDate=item=>{
    if(!item)return item;
    if(item.date&&/^\d{4}-\d{2}-\d{1,2}/.test(String(item.date).trim()))item.date=formatCashDate(item.date,month);
    if(item.due&&/^\d{4}-\d{2}-\d{1,2}/.test(String(item.due).trim()))item.due=formatCashDate(item.due,month);
    return item;
  };
  base.fixed.forEach(normDate);
  base.spending.forEach(normDate);
  base.income.forEach(normDate);
  return base;
}

function getBankBalance(x){
  if(x.bankAccounts){
    return num(x.bankAccounts.lloyds);
  }
  return num(x.bank);
}

function saveCashflow(x){
  x.bankAccounts=x.bankAccounts||{zempler:0,lloyds:0};
  if(x.bankAccounts.zempler){
    x.bankAccounts.lloyds=num(x.bankAccounts.lloyds)+num(x.bankAccounts.zempler);
    x.bankAccounts.zempler=0;
  }
  x.bankAccounts.lloyds=num(x.bankAccounts.lloyds);
  x.bankAccounts.zempler=0;
  x.bank=x.bankAccounts.lloyds;
  x.bankUpdatedAt=x.bankUpdatedAt||new Date().toISOString();
  localStorage.setItem(cashflowKey(x.month),JSON.stringify(x));
}

function monthName(m){
  try{
    return new Date(`${m}-01T00:00:00`).toLocaleString("en-GB",{month:"short"});
  }catch(e){
    return"Apr";
  }
}

function cleanMerchantDesc(str){
  return String(str||"")
    .replace(/^[^a-zA-Z0-9]+/, "")
    .replace(/^([A-Z]{1,2}|3D|\$?\d)\s+/i, "")
    .replace(/\bTeslalnec\b/gi, "Tesla Inc.")
    .replace(/\bTeslalnc\b/gi, "Tesla Inc.")
    .replace(/\bTeslainc\b/gi, "Tesla Inc.")
    .replace(/\bTestaine\b/gi, "Tesla Inc.")
    .replace(/\bTestalnc\b/gi, "Tesla Inc.")
    .replace(/\bSCREwrFIX\b/gi, "SCREWFIX")
    .replace(/\bScrRewrix\b/gi, "SCREWFIX")
    .replace(/\bScrewfix\b/gi, "SCREWFIX")
    .replace(/[,:.\(\)>›»~]+$/, "")
    .replace(/^[^a-zA-Z]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanMerchantName(str){
  return cleanMerchantDesc(str);
}

function extractDebitAmount(str){
  const cleaned=str.replace(/[£$€]?\s*[35][,.][0-9]{3,5}/g, "");
  const m1=cleaned.match(/(?:[-–—~]\s*[£$€EFL]?|[£$€EFL]\s*[-–—~]|\b[-–—]\s*)(\d{1,4}(?:\.\d{1,2})?)/);
  if(m1){
    return {amt:parseFloat(m1[1]),rawMatch:m1[0]};
  }
  const m2=cleaned.match(/[\(£$€EFL]\s*(\d{1,4}\.\d{2})\s*(?:>|$)/);
  if(m2){
    return {amt:parseFloat(m2[1]),rawMatch:m2[0]};
  }
  const m3=cleaned.match(/\bE(024)\b/i);
  if(m3){
    return {amt:0.24,rawMatch:m3[0]};
  }
  return null;
}

function parseDebitLine(str){
  const mDebit=str.match(/[-–—~]\s*[£$€EFLe]?\s*(\d{1,4}(?:[.,]\d{1,2})?)/i)||
               str.match(/[£$€EFLe]\s*[-–—~]\s*(\d{1,4}(?:[.,]\d{1,2})?)/i);
  if(mDebit){
    let raw=mDebit[1].replace(",", ".");
    if(!raw.includes(".") && raw.length===3){
      raw=raw[0]+"."+raw.slice(1);
    }
    const val=parseFloat(raw);
    if(val>0 && val<2000) return val;
  }
  return null;
}

function parseAmountsColumn(text){
  const lines=String(text||"").split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  const debits=[];
  const balances=[];

  for(const l of lines){
    const amt=parseDebitLine(l);
    if(amt!=null){
      debits.push(amt);
      continue;
    }

    const mBal=l.match(/[£$€]?\s*([0-9]{1,3}(?:,[0-9]{3})*\.[0-9]{2})/);
    if(mBal){
      balances.push(parseFloat(mBal[1].replace(/,/g,"")));
    }
  }

  return {debits, balances};
}

function parseMerchantsColumn(text, baseMonth=currentMonth){
  const lines=String(text||"").split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  const items=[];
  const now=new Date();
  let currentDate=`${now.getDate()} ${now.toLocaleString("en-GB",{month:"short"})}`;

  function parseDateHeader(l){
    const s=l.toLowerCase();
    if(s.includes("yesterday")){
      const d=new Date();
      d.setDate(d.getDate()-1);
      return `${d.getDate()} ${d.toLocaleString("en-GB",{month:"short"})}`;
    }
    if(s.includes("today")){
      const d=new Date();
      return `${d.getDate()} ${d.toLocaleString("en-GB",{month:"short"})}`;
    }
    const m=s.match(/(?:mon|tue|wed|thu|fri|sat|sun)?\s*([0-9]{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/);
    if(m){
      const day=parseInt(m[1],10);
      const mon=m[2].charAt(0).toUpperCase()+m[2].slice(1,3).toLowerCase();
      return `${day} ${mon}`;
    }
    return null;
  }

  for(let i=0;i<lines.length;i++){
    const l=lines[i];
    if(/^(october|all|in|out|search|home|apply|payments|cards)\b/i.test(l))continue;
    const dh=parseDateHeader(l);
    if(dh){
      currentDate=dh;
      continue;
    }
    if(/^screw\b/i.test(l)&&items.length&&items[items.length-1].description.includes("SCREWFIX")){
      continue;
    }
    const cleaned=cleanMerchantName(l);
    if(cleaned.length>=3&&!/^[0-9£$.,-]+$/.test(cleaned)){
      items.push({date:currentDate,description:cleaned});
    }
  }

  return items;
}

function matchDebitsWithMerchants(debits, merchants, defaultDate=""){
  const transactions=[];
  const usedMerchants=new Set();

  for(const d of debits){
    let closest=null;
    let minDiff=70;

    for(let i=0;i<merchants.length;i++){
      if(usedMerchants.has(i))continue;
      const diff=Math.abs(d.y-merchants[i].y);
      if(diff<minDiff){
        minDiff=diff;
        closest={idx:i,item:merchants[i]};
      }
    }

    if(closest){
      usedMerchants.add(closest.idx);
      transactions.push({
        date:closest.item.date,
        description:closest.item.desc||closest.item.description,
        amount:d.amt??d.amount,
        category:"Living",
        propertyId:"",
        campaignId:""
      });
    }else{
      let dDate=defaultDate;
      for(const m of merchants){
        if(m.y<=d.y)dDate=m.date;
      }
      transactions.push({
        date:dDate,
        description:"Bank Spend",
        amount:d.amt??d.amount,
        category:"Living",
        propertyId:"",
        campaignId:""
      });
    }
  }

  return transactions;
}

function sliceImageToBlob(img, xPct, yPct, wPct, hPct, scale=3.0){
  return new Promise(resolve=>{
    try{
      const canvas=document.createElement("canvas");
      const sx=Math.round(img.naturalWidth*xPct);
      const sy=Math.round(img.naturalHeight*yPct);
      const sw=Math.round(img.naturalWidth*wPct);
      const sh=Math.round(img.naturalHeight*hPct);
      canvas.width=Math.round(sw*scale);
      canvas.height=Math.round(sh*scale);
      const ctx=canvas.getContext("2d");
      ctx.imageSmoothingEnabled=true;
      ctx.imageSmoothingQuality="high";
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob=>resolve(blob),"image/png");
    }catch(err){
      resolve(null);
    }
  });
}

function parseBankStatementText(rawText, baseMonth=currentMonth){
  const lines=String(rawText||"").split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  let detectedBalance=null;
  const now=new Date();
  let currentDate=`${now.getDate()} ${now.toLocaleString("en-GB",{month:"short"})}`;
  const transactions=[];

  function parseDateHeader(line){
    const l=line.toLowerCase();
    if(/^yesterday\b/.test(l)){
      const d=new Date();
      d.setDate(d.getDate()-1);
      return `${d.getDate()} ${d.toLocaleString("en-GB",{month:"short"})}`;
    }
    if(/^today\b/.test(l)){
      const d=new Date();
      return `${d.getDate()} ${d.toLocaleString("en-GB",{month:"short"})}`;
    }
    const m=line.match(/(?:mon|tue|wed|thu|fri|sat|sun)?[a-z]*\s*(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/i);
    if(m){
      const day=parseInt(m[1],10);
      const mon=m[2].slice(0,3);
      const capMon=mon.charAt(0).toUpperCase()+mon.slice(1).toLowerCase();
      return `${day} ${capMon}`;
    }
    const numDate=line.match(/^(\d{1,2})[\/\.-](\d{1,2})(?:[\/\.-](\d{2,4}))?$/);
    if(numDate){
      const day=parseInt(numDate[1],10);
      const moNum=parseInt(numDate[2],10);
      const dObj=new Date(Date.UTC(2026,moNum-1,day));
      const mStr=dObj.toLocaleString("en-GB",{month:"short",timeZone:"UTC"});
      return `${day} ${mStr}`;
    }
    return null;
  }

  for(let i=0;i<Math.min(8,lines.length);i++){
    const l=lines[i];
    if(/(?:lloyds|basic|acct|account|balance)/i.test(l)){
      const combined=[l,lines[i+1]||"",lines[i+2]||""].join(" ");
      const match=combined.match(/[£$€]?\s*([0-9]{1,3}(?:,[0-9]{3})*\.[0-9]{2})/);
      if(match){
        detectedBalance=parseFloat(match[1].replace(/,/g,""));
        break;
      }
    }
  }

  const isNav=l=>/^(home|apply|payments|search|cards|october|all|in|out|lloyds)\b/i.test(l)||/^[0-9:]+\s+(w|wl)/i.test(l);
  let pendingAmount=null;
  let pendingDesc=null;

  for(let i=0;i<lines.length;i++){
    const l=lines[i];
    if(isNav(l))continue;

    const dh=parseDateHeader(l);
    if(dh){
      currentDate=dh;
      pendingAmount=null;
      pendingDesc=null;
      continue;
    }

    if(/^[£$€]?\s*3[,.]?\d{3}/.test(l)&&!/[-–—~]/.test(l)){
      continue;
    }

    const debit=extractDebitAmount(l);

    if(debit&&/[a-zA-Z]{3,}/.test(l)){
      const descOnly=l.replace(debit.rawMatch,"").replace(/[£$€]?\s*[0-9]{1,4}[,.]\d{2,5}/g,"");
      const desc=cleanMerchantDesc(descOnly);
      if(desc.length>=2){
        transactions.push({
          date:currentDate,
          description:desc,
          amount:debit.amt,
          category:"Living",
          propertyId:"",
          campaignId:""
        });
        pendingAmount=null;
        pendingDesc=null;
        continue;
      }
    }

    if(debit&&!/[a-zA-Z]{4,}/.test(l)){
      if(pendingDesc){
        transactions.push({
          date:currentDate,
          description:pendingDesc,
          amount:debit.amt,
          category:"Living",
          propertyId:"",
          campaignId:""
        });
        pendingDesc=null;
        pendingAmount=null;
      }else{
        pendingAmount=debit.amt;
      }
      continue;
    }

    if(/[a-zA-Z]{3,}/.test(l)){
      const desc=cleanMerchantDesc(l.replace(/[£$€]?\s*[0-9]{1,4}[,.]\d{2,5}/g,""));
      if(desc.length>=2){
        if(pendingAmount){
          transactions.push({
            date:currentDate,
            description:desc,
            amount:pendingAmount,
            category:"Living",
            propertyId:"",
            campaignId:""
          });
          pendingAmount=null;
          pendingDesc=null;
        }else{
          pendingDesc=desc;
        }
      }
    }
  }

  return {detectedBalance,transactions};
}

function loadAppState(){
  try{
    return JSON.parse(localStorage.getItem("tax-engine-v3")||localStorage.getItem(KEY)||"{}");
  }catch{
    return {};
  }
}

function getCampaigns(){
  const s=loadAppState();
  return (s.campaigns||[]).filter(c=>c&&c.status!=='archived');
}

function getPrimaryCampaign(){
  const camps=getCampaigns();
  return camps.find(c=>c.isPrimary)||camps[0]||null;
}

function getSafetyBuffer(){
  const direct=localStorage.getItem("tax-engine-safety-buffer");
  if(direct!==null&&direct.trim()!==""&&!isNaN(Number(direct))){
    return Math.max(0,Number(direct));
  }
  try{
    const s=loadAppState();
    const yr=s.settingsByYear?.[s.year]||s.settingsByYear?.["2026-27"]||{};
    if(yr.banking?.safetyBuffer!=null&&!isNaN(Number(yr.banking.safetyBuffer))){
      return Math.max(0,Number(yr.banking.safetyBuffer));
    }
    if(s.banking?.safetyBuffer!=null&&!isNaN(Number(s.banking.safetyBuffer))){
      return Math.max(0,Number(s.banking.safetyBuffer));
    }
  }catch{}
  return 2000;
}

function propertyOptions(){
  let properties=[];
  try{properties=loadAppState().properties||[];}catch{}
  return `<option value="">None</option>${properties.map(p=>`<option value="${p.id}">${p.property||p.property_name||"Property"}</option>`).join("")}`;
}

function propertyName(id){
  if(!id)return"";
  try{const p=(loadAppState().properties||[]).find(x=>x.id===id);return p?.property||p?.property_name||"";}catch{return"";}
}

function campaignOptions(selected=""){
  let campaigns=[];
  try{campaigns=getCampaigns()||[];}catch{}
  return `<option value="">None</option>${campaigns.map(c=>`<option value="${c.id}" ${c.id===selected?"selected":""}>${c.name}</option>`).join("")}`;
}

function campaignName(id){
  if(!id)return"";
  try{const c=getCampaigns().find(x=>x.id===id);return c?.name||"";}catch{return"";}
}

function syncMobileCampaignTx(item, isDeleted=false){
  if(!item) return;
  try{
    const s = loadAppState();
    s.campaignTransactions = s.campaignTransactions || [];
    const txId = `expense-${item.id}`;
    const shouldHaveTx = !isDeleted && Boolean(item.campaignId) && (item.status === "Paid" || item.status === "Part-paid");
    const existingIdx = s.campaignTransactions.findIndex(t => t.sourceExpenseId === item.id || t.id === txId);

    if(shouldHaveTx){
      const amount = num(item.actual ?? item.expected ?? item.payment ?? item.planned);
      const dateVal = toInputDate(item.due || item.date, currentMonth);
      const noteVal = (item.description || item.payment || "Expense payment").trim();

      if(existingIdx >= 0){
        s.campaignTransactions[existingIdx] = {
          ...s.campaignTransactions[existingIdx],
          campaignId: item.campaignId,
          amount: amount,
          date: dateVal,
          direction: 'add',
          note: noteVal,
          sourceExpenseId: item.id
        };
      }else{
        s.campaignTransactions.push({
          id: txId,
          campaignId: item.campaignId,
          date: dateVal,
          amount: amount,
          direction: 'add',
          note: noteVal,
          sourceExpenseId: item.id,
          createdAt: new Date().toISOString()
        });
      }
    }else{
      if(existingIdx >= 0){
        s.campaignTransactions.splice(existingIdx, 1);
      }
    }
    localStorage.setItem("tax-engine-v3", JSON.stringify(s));
  }catch(e){
    console.error("Failed to sync mobile campaign transaction:", e);
  }
}

function dateLabel(dateStr){
  if(!dateStr)return "";
  return formatCashDate(dateStr, currentMonth);
}

function extractDayNumber(item){
  const val=String(item?.due||item?.date||"").trim();
  const isoMatch=val.match(/^\d{4}-\d{2}-(\d{1,2})/);
  if(isoMatch)return parseInt(isoMatch[1],10);
  const m=val.match(/\b\d{1,2}\b/);
  if(m)return parseInt(m[0],10);
  return 99;
}

function toInputDate(val,month){
  const s=String(val||"").trim();
  if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
  const m=s.match(/\b\d{1,2}\b/);
  const day=m?Math.max(1,Math.min(31,Number(m[0]))):1;
  return `${month}-${String(day).padStart(2,"0")}`;
}

function itemDateSort(a,b){
  const dayA=extractDayNumber(a);
  const dayB=extractDayNumber(b);
  if(dayA!==dayB)return dayA-dayB;
  return String(a.due||a.date||"").localeCompare(String(b.due||b.date||""))
    || String(a.createdAt||a.id||"").localeCompare(String(b.createdAt||b.id||""));
}

function isPendingStatus(status){
  const s=String(status||"").trim().toLowerCase();
  return s!=="paid"&&s!=="received";
}

let currentMonth=monthIso();
let activeTypeFilter="all";
let pastSortOrder="desc";

function completedDateSort(a,b){
  const dayA=extractDayNumber(a);
  const dayB=extractDayNumber(b);
  if(dayA!==dayB){
    return pastSortOrder==="desc"?dayB-dayA:dayA-dayB;
  }
  return pastSortOrder==="desc"
    ? String(b.due||b.date||"").localeCompare(String(a.due||a.date||""))||String(b.createdAt||b.id||"").localeCompare(String(a.createdAt||a.id||""))
    : String(a.due||a.date||"").localeCompare(String(b.due||b.date||""))||String(a.createdAt||a.id||"").localeCompare(String(b.createdAt||b.id||""));
}

function renderItem(i,isPending){
  const isIncome=i._type==='income';
  const amount=num(i.actual??i.expected??i.payment??i.planned);
  const title=i.description||i.payment||i.notes||"Item";
  const prop=propertyName(i.propertyId);
  const camp=campaignName(i.campaignId);
  const dateStr=dateLabel(i.due||i.date);
  const meta=[
    dateStr?`<span class="date-chip">📅 ${dateStr}</span>`:"",
    prop?`<span>🏠 ${prop}</span>`:(i.category?`<span>${i.category}</span>`:""),
    camp?`<span style="color:#7e22ce;font-weight:600;">🎯 ${camp}</span>`:"",
    `<button type="button" class="mobile-edit-btn" onclick="event.stopPropagation(); openEditModal('${i.id}', '${i._type}')">✏️ Edit</button>`
  ].filter(Boolean).join(" &middot; ");

  let btnHtml='';
  if(isPending){
    if(isIncome){
      btnHtml=`<button class="mobile-action-btn btn-receive" onclick="event.stopPropagation(); checkOff('${i.id}', 'income')">Receive</button>`;
    }else{
      btnHtml=`<button class="mobile-action-btn btn-pay" onclick="event.stopPropagation(); checkOff('${i.id}', 'cost')">Pay</button>`;
    }
  }else{
    btnHtml=`<span style="font-size: 0.75rem; color: #6b7280; text-transform: uppercase; font-weight: 700;">${i.status}</span>`;
  }

  return `
    <div class="mobile-item">
      <div class="mobile-item-info">
        <div class="mobile-item-title" onclick="openEditModal('${i.id}', '${i._type}')" title="Tap to edit">${title}</div>
        <div class="mobile-item-meta">${meta}</div>
      </div>
      <div class="mobile-item-amount ${isIncome?'income':'expense'}">${isIncome?'+':'-'}${money.format(amount)}</div>
      ${btnHtml}
    </div>
  `;
}

function render(){
  const x=loadCashflow(currentMonth);

  // Render Single Bank Balance (Lloyds in back-end)
  const bankCard=by("#balBank");
  if(bankCard)bankCard.textContent=money.format(getBankBalance(x));

  // Separate Expenses and Income
  const allCosts=[
    ...x.fixed.map(i=>({...i,_type:'cost'})),
    ...x.spending.map(i=>({...i,_type:'cost'}))
  ];
  const allIncome=[
    ...x.income.map(i=>({...i,_type:'income'}))
  ];

  // Filter and sort Pending items by date
  const pendingCosts=allCosts.filter(i=>isPendingStatus(i.status)&&!i.isTransfer).sort(itemDateSort);
  const pendingIncome=allIncome.filter(i=>isPendingStatus(i.status)).sort(itemDateSort);

  // Totals
  const totalPendingCostsAmount=pendingCosts.reduce((sum,i)=>{
    const full=num(i.planned??i.expected??i.payment??i.actual);
    const paidPart=/part/i.test(i.status)?num(i.actual):0;
    return sum+Math.max(0,full-paidPart);
  },0);
  const totalPendingIncomeAmount=pendingIncome.reduce((sum,i)=>{
    const exp=num(i.expected);
    const act=num(i.actual);
    return sum+(exp>0?Math.max(0,exp-act):num(i.expected??i.actual));
  },0);

  // Update Summary Containers
  by("#totalPendingExpenses").textContent=money.format(totalPendingCostsAmount);
  by("#countPendingExpenses").textContent=`${pendingCosts.length} item${pendingCosts.length===1?'':'s'} pending`;
  by("#subtotalPendingExpenses").textContent=money.format(totalPendingCostsAmount);

  by("#totalPendingIncome").textContent=money.format(totalPendingIncomeAmount);
  by("#countPendingIncome").textContent=`${pendingIncome.length} item${pendingIncome.length===1?'':'s'} pending`;
  by("#subtotalPendingIncome").textContent=money.format(totalPendingIncomeAmount);

  // Campaign Fund calculation: Current Balance + remaining income - remaining expenses - safety buffer
  const currentBank=getBankBalance(x);
  const remainingIncome=totalPendingIncomeAmount;
  const remainingExpenses=totalPendingCostsAmount;
  const safetyBuffer=getSafetyBuffer();
  const forecastEndBalance=currentBank+remainingIncome-remainingExpenses;
  const campaignSurplus=forecastEndBalance-safetyBuffer;

  const surplusEl=by("#balCampaignSurplus");
  if(surplusEl){
    surplusEl.textContent=money.format(campaignSurplus);
    surplusEl.style.color=campaignSurplus>=0?"#7e22ce":"#b91c1c";
  }

  const subEl=by("#campaignFundSub");
  if(subEl){
    subEl.textContent=`Reserve: ${money.format(safetyBuffer)} · Forecast: ${money.format(forecastEndBalance)}`;
    subEl.title=`Forecast Balance: ${money.format(forecastEndBalance)} (Bank ${money.format(currentBank)} + remaining income ${money.format(remainingIncome)} - remaining expenses ${money.format(remainingExpenses)}) minus Reserve ${money.format(safetyBuffer)} = Campaign surplus ${money.format(campaignSurplus)}. Tap to edit.`;
  }

  const primaryCamp=getPrimaryCampaign();
  const primaryNameEl=by("#primaryCampaignName");
  if(primaryNameEl){
    primaryNameEl.textContent=primaryCamp?primaryCamp.name:"Primary";
    primaryNameEl.title=primaryCamp?`Primary Campaign: ${primaryCamp.name}`:"Primary Campaign";
  }

  // Render Pending Containers based on Filter
  const containerIncome=by("#containerPendingIncome");
  const containerExpenses=by("#containerPendingExpenses");

  if(activeTypeFilter==="all"){
    containerIncome.style.display="";
    containerExpenses.style.display="";
  }else if(activeTypeFilter==="income"){
    containerIncome.style.display="";
    containerExpenses.style.display="none";
  }else{
    containerIncome.style.display="none";
    containerExpenses.style.display="";
  }

  // Render Lists
  by("#listPendingIncome").innerHTML=pendingIncome.length
    ? pendingIncome.map(i=>renderItem(i,true)).join("")
    : `<div style="padding: 0.85rem; color: #9ca3af; font-size: 0.825rem; text-align: center; background: white; border-radius: 0.5rem;">No pending income for this month.</div>`;

  by("#listPendingExpenses").innerHTML=pendingCosts.length
    ? pendingCosts.map(i=>renderItem(i,true)).join("")
    : `<div style="padding: 0.85rem; color: #9ca3af; font-size: 0.825rem; text-align: center; background: white; border-radius: 0.5rem;">No pending expenses for this month.</div>`;

  // Completed Transactions (Sorted by date, showing ALL items)
  const allItems=[...allCosts,...allIncome];
  const completed=allItems.filter(i=>!isPendingStatus(i.status)).sort(completedDateSort);

  const totalCompletedCost=completed.filter(i=>i._type==='cost').reduce((sum,i)=>sum+num(i.actual??i.expected??i.payment??i.planned),0);
  const totalCompletedIncome=completed.filter(i=>i._type==='income').reduce((sum,i)=>sum+num(i.actual??i.expected),0);

  const pastSub=by("#pastTransactionsSub");
  if(pastSub)pastSub.textContent=`${completed.length} item${completed.length===1?'':'s'} (${money.format(totalCompletedIncome)} in, ${money.format(totalCompletedCost)} out)`;
  const pastTotal=by("#pastTransactionsTotal");
  if(pastTotal){
    pastTotal.textContent=money.format(totalCompletedIncome-totalCompletedCost);
    pastTotal.style.color=(totalCompletedIncome-totalCompletedCost)>=0?"#059669":"#374151";
  }

  by("#mobileRecent").innerHTML=completed.length
    ? completed.map(i=>renderItem(i,false)).join("")
    : `<div style="padding: 0.85rem; color: #9ca3af; font-size: 0.825rem; text-align: center; background: white; border-radius: 0.5rem;">No completed items yet for this month.</div>`;

  const spendCamp=by("#spendCampaign");
  if(spendCamp){
    const curVal=spendCamp.value;
    spendCamp.innerHTML=campaignOptions(curVal);
  }
}

window.checkOff=function(id,type){
  const x=loadCashflow(currentMonth);
  let item=null;

  if(type==='cost'){
    item=x.fixed.find(i=>i.id===id);
    if(!item)item=x.spending.find(i=>i.id===id);
  }else{
    item=x.income.find(i=>i.id===id);
  }

  if(!item)return;

  const amount=num(item.actual??item.expected??item.payment??item.planned);

  const oldImpact=type==="income"
    ? ((item.status==="Received"||item.actual!=null)?num(item.actual):0)
    : ((item.status==="Paid"||item.status==="Part-paid"||item.actual!=null)?-num(item.actual):0);

  const newImpact=type==="income"?amount:-amount;

  item.actual=amount;
  item.status=type==='income'?'Received':'Paid';
  item.account=DEFAULT_BANK_ACCOUNT;

  x.bankAccounts=x.bankAccounts||{zempler:0,lloyds:0};
  x.bankAccounts.lloyds=num(x.bankAccounts.lloyds)-oldImpact+newImpact;
  x.bankUpdatedAt=new Date().toISOString();

  saveCashflow(x);
  if(type==='cost') syncMobileCampaignTx(item, false);
  render();
};

window.openEditModal=function(id,type){
  const x=loadCashflow(currentMonth);
  let item=null;
  let collection='spending';

  if(type==='cost'){
    item=x.fixed.find(i=>i.id===id);
    if(item){
      collection='fixed';
    }else{
      item=x.spending.find(i=>i.id===id);
      collection='spending';
    }
  }else{
    item=x.income.find(i=>i.id===id);
    collection='income';
  }

  if(!item)return;

  by("#editItemId").value=item.id;
  by("#editItemType").value=collection;
  by("#editDescription").value=item.description||item.payment||"";
  by("#editAmount").value=num(item.actual??item.expected??item.payment??item.planned)||"";
  by("#editDate").value=toInputDate(item.due||item.date,currentMonth);

  // Status options
  const statusSelect=by("#editStatus");
  if(collection==='income'){
    statusSelect.innerHTML=`<option value="Expected">Expected</option><option value="Received">Received</option>`;
  }else if(collection==='fixed'){
    statusSelect.innerHTML=`<option value="Expected">Expected</option><option value="Paid">Paid</option>`;
  }else{
    statusSelect.innerHTML=`<option value="Planned">Planned</option><option value="Paid">Paid</option><option value="Part-paid">Part-paid</option><option value="Unplanned">Unplanned</option>`;
  }
  statusSelect.value=item.status||(collection==='income'?"Expected":collection==='fixed'?"Expected":"Planned");

  // Category
  const catSelect=by("#editCategory");
  const currentCat=item.category||(collection==='fixed'?"Fixed":collection==='income'?"Income":"Living");
  let catFound=false;
  for(let opt of catSelect.options){
    if(opt.value.toLowerCase()===currentCat.toLowerCase()){
      opt.selected=true;
      catFound=true;
      break;
    }
  }
  if(!catFound){
    const opt=document.createElement("option");
    opt.value=currentCat;
    opt.textContent=currentCat;
    opt.selected=true;
    catSelect.appendChild(opt);
  }

  // Property
  const propSelect=by("#editProperty");
  propSelect.innerHTML=propertyOptions();
  propSelect.value=item.propertyId||"";

  // Campaign
  const campSelect=by("#editCampaign");
  if(campSelect){
    campSelect.innerHTML=campaignOptions(item.campaignId);
    campSelect.value=item.campaignId||"";
  }
  const campGroup=by("#editCampaignGroup");
  if(campGroup){
    campGroup.style.display=collection==='income'?'none':'';
  }

  // Notes
  by("#editNotes").value=item.notes||"";

  const dialog=by("#mobileEditDialog");
  if(dialog&&typeof dialog.showModal==="function"){
    dialog.showModal();
  }
};

function init(){
  by("#mobileMonth").value=currentMonth;
  by("#spendDay").value=todayIso();
  by("#spendProperty").innerHTML=propertyOptions();
  if(by("#spendCampaign")) by("#spendCampaign").innerHTML=campaignOptions();
  const spendCat=by("#spendCategory");
  if(spendCat)spendCat.value="Living";

  render();

  by("#mobileMonth").addEventListener("change",e=>{
    currentMonth=e.target.value;
    render();
  });

  all(".filter-pill").forEach(btn=>{
    btn.addEventListener("click",e=>{
      all(".filter-pill").forEach(b=>b.classList.remove("active"));
      e.target.classList.add("active");
      activeTypeFilter=e.target.dataset.typeFilter;
      render();
    });
  });

  by("#btnSortPast")?.addEventListener("click",e=>{
    pastSortOrder=pastSortOrder==="desc"?"asc":"desc";
    e.target.textContent=pastSortOrder==="desc"?"Date ↓":"Date ↑";
    render();
  });

  // Add Spend Form (defaults category to Living, account to Lloyds)
  by("#mobileSpendForm").addEventListener("submit",event=>{
    event.preventDefault();
    const form=new FormData(event.currentTarget);
    const amount=num(form.get("amount"));
    const category=form.get("category")||"Living";
    const propertyId=form.get("propertyId")||"";
    const campaignId=form.get("campaignId")||"";
    const isTaxReserve=/tax reserve|tax provision/i.test(category);

    const x=loadCashflow(currentMonth);
    const item={
      id:uid(),
      createdAt:new Date().toISOString(),
      date:formatCashDate(form.get("date"), currentMonth),
      description:form.get("description").trim(),
      category:category,
      planned:null,
      actual:amount,
      status:"Paid",
      treatment:isTaxReserve?"cashflow":(propertyId?"property_expense":"cashflow"),
      propertyId:isTaxReserve?"":propertyId,
      campaignId:isTaxReserve?"":campaignId,
      isTransfer:isTaxReserve?true:false,
      reason:isTaxReserve?"tax_provision":"general",
      notes:isTaxReserve?"Tax Reserve transfer":"",
      account:DEFAULT_BANK_ACCOUNT
    };

    x.spending.push(item);
    x.bankAccounts=x.bankAccounts||{zempler:0,lloyds:0};
    x.bankAccounts.lloyds=num(x.bankAccounts.lloyds)-amount;
    x.bankUpdatedAt=new Date().toISOString();
    saveCashflow(x);
    syncMobileCampaignTx(item, false);

    event.currentTarget.reset();
    by("#spendDay").value=todayIso();
    if(by("#spendCategory"))by("#spendCategory").value="Living";
    if(by("#spendProperty"))by("#spendProperty").value="";
    if(by("#spendCampaign"))by("#spendCampaign").value="";
    render();
  });

  // Edit Modal Form Submit
  by("#mobileEditForm")?.addEventListener("submit",event=>{
    event.preventDefault();
    const id=by("#editItemId").value;
    const collection=by("#editItemType").value;
    const x=loadCashflow(currentMonth);

    let item=null;
    if(collection==='fixed')item=x.fixed.find(i=>i.id===id);
    else if(collection==='spending')item=x.spending.find(i=>i.id===id);
    else if(collection==='income')item=x.income.find(i=>i.id===id);

    if(!item)return;

    const newDesc=by("#editDescription").value.trim();
    const newAmount=num(by("#editAmount").value);
    const newDate=by("#editDate").value;
    const newStatus=by("#editStatus").value;
    const newCat=by("#editCategory").value;
    const newProp=by("#editProperty").value;
    const newCampaign=by("#editCampaign")?by("#editCampaign").value:"";
    const newNotes=by("#editNotes").value.trim();
    const isTaxReserve=/tax reserve|tax provision/i.test(newCat);

    const isIncome=collection==='income';
    const oldImpact=isIncome
      ? ((item.status==="Received"||item.actual!=null)?num(item.actual):0)
      : ((item.status==="Paid"||item.status==="Part-paid"||item.actual!=null)?-num(item.actual):0);

    let newActual=null;
    let newPlannedOrExpected=newAmount;

    if(isIncome){
      if(newStatus==="Received"){
        newActual=newAmount;
      }
    }else{
      if(newStatus==="Paid"||newStatus==="Part-paid"){
        newActual=newAmount;
        newPlannedOrExpected=(newStatus==="Part-paid")?newAmount:null;
      }else{
        newActual=null;
        newPlannedOrExpected=newAmount;
      }
    }

    const newImpact=isIncome
      ?(newActual!=null?newActual:0)
      :(newActual!=null?-newActual:0);

    if(collection==='fixed'){
      item.payment=newDesc;
      item.due=formatCashDate(newDate, currentMonth);
      item.expected=newAmount;
      item.actual=newActual;
    }else{
      item.description=newDesc;
      item.date=formatCashDate(newDate, currentMonth);
      if(isIncome){
        item.expected=newAmount;
        item.actual=newActual;
      }else{
        item.planned=newPlannedOrExpected;
        item.actual=newActual;
      }
      item.category=newCat;
    }

    item.status=newStatus;
    item.propertyId=isTaxReserve?"":newProp;
    item.campaignId=isTaxReserve?"":newCampaign;
    item.treatment=isTaxReserve?"cashflow":(newProp?(isIncome?"property_income":"property_expense"):"cashflow");
    if(isTaxReserve){
      item.isTransfer=true;
      item.reason="tax_provision";
    }else if(item.reason==="tax_provision"){
      delete item.isTransfer;
      delete item.reason;
    }
    item.notes=newNotes;
    item.account=DEFAULT_BANK_ACCOUNT;

    x.bankAccounts=x.bankAccounts||{zempler:0,lloyds:0};
    x.bankAccounts.lloyds=num(x.bankAccounts.lloyds)-oldImpact+newImpact;
    x.bankUpdatedAt=new Date().toISOString();

    saveCashflow(x);
    if(collection!=='income') syncMobileCampaignTx(item, false);
    by("#mobileEditDialog")?.close();
    render();
  });

  // Edit Modal Delete Button
  by("#btnDeleteTransaction")?.addEventListener("click",()=>{
    const id=by("#editItemId").value;
    const collection=by("#editItemType").value;
    const x=loadCashflow(currentMonth);

    let item=null;
    if(collection==='fixed')item=x.fixed.find(i=>i.id===id);
    else if(collection==='spending')item=x.spending.find(i=>i.id===id);
    else if(collection==='income')item=x.income.find(i=>i.id===id);

    if(!item)return;

    const title=item.description||item.payment||"this transaction";
    if(!confirm(`Delete ${title}?`))return;

    const isIncome=collection==='income';
    const oldImpact=isIncome
      ? ((item.status==="Received"||item.actual!=null)?num(item.actual):0)
      : ((item.status==="Paid"||item.status==="Part-paid"||item.actual!=null)?-num(item.actual):0);

    if(collection!=='income') syncMobileCampaignTx(item, true);

    if(collection==='fixed')x.fixed=x.fixed.filter(i=>i.id!==id);
    else if(collection==='spending')x.spending=x.spending.filter(i=>i.id!==id);
    else if(collection==='income')x.income=x.income.filter(i=>i.id!==id);

    x.bankAccounts=x.bankAccounts||{zempler:0,lloyds:0};
    x.bankAccounts.lloyds=num(x.bankAccounts.lloyds)-oldImpact;
    x.bankUpdatedAt=new Date().toISOString();

    saveCashflow(x);
    by("#mobileEditDialog")?.close();
    render();
  });

  // Close Edit Modal
  by("#closeEditDialog")?.addEventListener("click",()=>{
    by("#mobileEditDialog")?.close();
  });

  by("#campaignFundSub")?.addEventListener("click",()=>{
    const currentBuffer=getSafetyBuffer();
    const input=window.prompt(`Safety Buffer:\nEnter safety buffer amount in £ (default £2,000.00):`,String(currentBuffer));
    if(input!==null){
      const val=input.trim().replace(/[^0-9.-]/g,"");
      if(val===""||isNaN(Number(val))){
        localStorage.removeItem("tax-engine-safety-buffer");
      }else{
        const numVal=Math.max(0,Number(val));
        localStorage.setItem("tax-engine-safety-buffer",String(numVal));
        try{
          const s=loadAppState();
          s.banking=s.banking||{};
          s.banking.safetyBuffer=numVal;
          const yr=s.settingsByYear?.[s.year]||s.settingsByYear?.["2026-27"];
          if(yr){ yr.banking=yr.banking||{}; yr.banking.safetyBuffer=numVal; }
          localStorage.setItem("tax-engine-v3",JSON.stringify(s));
        }catch{}
      }
      render();
    }
  });

  // Bank Scan Modal Logic
  let currentScanData=null;

  function openScanModal(){
    const dialog=by("#bankScanDialog");
    if(!dialog)return;
    currentScanData=null;
    if(by("#scanResultsContainer"))by("#scanResultsContainer").style.display="none";
    if(by("#scanStatus"))by("#scanStatus").style.display="none";
    if(by("#bankScreenshotInput"))by("#bankScreenshotInput").value="";
    if(by("#bankRawTextInput"))by("#bankRawTextInput").value="";
    switchScanTab("image");
    dialog.showModal();
  }

  function closeScanModal(){
    const dialog=by("#bankScanDialog");
    if(dialog)dialog.close();
    currentScanData=null;
  }

  function switchScanTab(tab){
    const tabImg=by("#tabScanImage"),tabTxt=by("#tabScanText"),panelImg=by("#panelScanImage"),panelTxt=by("#panelScanText");
    if(tab==="image"){
      if(tabImg){tabImg.classList.add("active");tabImg.style.background="#111827";tabImg.style.color="white";}
      if(tabTxt){tabTxt.classList.remove("active");tabTxt.style.background="white";tabTxt.style.color="#374151";}
      if(panelImg)panelImg.style.display="block";
      if(panelTxt)panelTxt.style.display="none";
    }else{
      if(tabTxt){tabTxt.classList.add("active");tabTxt.style.background="#111827";tabTxt.style.color="white";}
      if(tabImg){tabImg.classList.remove("active");tabImg.style.background="white";tabImg.style.color="#374151";}
      if(panelImg)panelImg.style.display="none";
      if(panelTxt)panelTxt.style.display="block";
    }
  }

  function renderScanResults(parsed){
    currentScanData=parsed;
    const container=by("#scanResultsContainer"),countSpan=by("#scanTxCount"),listEl=by("#scanTxList"),balCard=by("#scanBalanceCard"),balText=by("#scanDetectedBalance"),chkSync=by("#chkSyncBankBalance");
    if(!container||!listEl)return;

    if(parsed.detectedBalance!=null&&parsed.detectedBalance>0){
      if(balCard)balCard.style.display="block";
      if(balText)balText.textContent=money.format(parsed.detectedBalance);
      if(chkSync)chkSync.checked=true;
    }else{
      if(balCard)balCard.style.display="none";
      if(chkSync)chkSync.checked=false;
    }

    if(countSpan)countSpan.textContent=String(parsed.transactions.length);

    if(!parsed.transactions.length){
      listEl.innerHTML=`<div style="text-align:center; padding:1.5rem; color:#6b7280; font-size:0.85rem;">No debit transactions found. Check the text or try again.</div>`;
      container.style.display="block";
      return;
    }

    listEl.innerHTML=parsed.transactions.map((tx,idx)=>`
      <div class="scan-tx-row" data-idx="${idx}" style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:0.5rem; padding:0.65rem 0.75rem; display:flex; flex-direction:column; gap:0.35rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem;">
          <div style="display:flex; align-items:center; gap:0.5rem; flex:1; min-width:0;">
            <input type="checkbox" class="scan-tx-check" data-idx="${idx}" checked style="accent-color:#059669; width:16px; height:16px; cursor:pointer; flex-shrink:0;">
            <input type="text" class="scan-tx-desc" value="${escapeHtml(tx.description)}" style="font-weight:600; font-size:0.9rem; color:#111827; border:1px solid #e5e7eb; background:white; padding:0.25rem 0.4rem; border-radius:0.25rem; width:100%; min-width:110px;">
          </div>
          <div style="display:flex; align-items:center; gap:0.35rem; flex-shrink:0;">
            <span style="font-weight:700; color:#dc2626; font-size:0.95rem;">-£</span>
            <input type="number" step="0.01" class="scan-tx-amount" value="${Number(tx.amount).toFixed(2)}" style="font-weight:700; color:#dc2626; font-size:0.95rem; width:72px; text-align:right; border:1px solid #e5e7eb; background:white; padding:0.25rem 0.35rem; border-radius:0.25rem;">
            <button type="button" class="scan-remove-btn" onclick="removeScanTx(${idx})" style="background:none; border:none; color:#9ca3af; font-size:1.15rem; cursor:pointer; padding:0 0.2rem;" title="Remove item">&times;</button>
          </div>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; color:#6b7280;">
          <span class="date-chip">📅 ${tx.date}</span>
          <div style="display:flex; gap:0.35rem; align-items:center;">
            <select class="scan-tx-category" data-idx="${idx}" style="font-size:0.75rem; padding:0.15rem 0.35rem; border:1px solid #d1d5db; border-radius:0.25rem; background:white;">
              <option value="Living" ${tx.category==="Living"?"selected":""}>Living</option>
              <option value="Fuel" ${tx.category==="Fuel"?"selected":""}>Fuel</option>
              <option value="Property" ${tx.category==="Property"?"selected":""}>Property</option>
              <option value="Vehicle" ${tx.category==="Vehicle"?"selected":""}>Vehicle</option>
              <option value="Tax Reserve" ${tx.category==="Tax Reserve"?"selected":""}>Tax Reserve</option>
              <option value="Legal" ${tx.category==="Legal"?"selected":""}>Legal</option>
              <option value="Other" ${tx.category==="Other"?"selected":""}>Other</option>
            </select>
          </div>
        </div>
      </div>
    `).join("");

    container.style.display="block";
  }

  window.removeScanTx=function(idx){
    if(currentScanData&&currentScanData.transactions){
      currentScanData.transactions.splice(idx,1);
      renderScanResults(currentScanData);
    }
  };

  async function scanBankScreenshot(file){
    if(!file)return;
    const statusEl=by("#scanStatus"),textEl=by("#scanStatusText"),barEl=by("#scanProgressBar");
    if(statusEl)statusEl.style.display="block";
    if(textEl)textEl.textContent="Preparing image for OCR...";
    if(barEl)barEl.style.width="10%";

    try{
      if(typeof Tesseract==="undefined"){
        throw new Error("OCR library not loaded yet. Check your connection or use 'Paste Text' tab.");
      }

      const img=await new Promise((resolve,reject)=>{
        const image=new Image();
        const url=URL.createObjectURL(file);
        image.onload=()=>{ URL.revokeObjectURL(url); resolve(image); };
        image.onerror=()=>{ URL.revokeObjectURL(url); reject(new Error("Could not load image")); };
        image.src=url;
      });

      const isMobileScreenshot=(img.naturalHeight/img.naturalWidth)>=1.2;

      if(isMobileScreenshot){
        const worker=await Tesseract.createWorker("eng");

        try{
          // Step 1: Scan account balance header (top 14%)
          if(textEl)textEl.textContent="Scanning account balance (1/3)...";
          if(barEl)barEl.style.width="25%";
          const blobH=await sliceImageToBlob(img,0.04,0.03,0.92,0.14,3.0);
          const resH=blobH?await worker.recognize(blobH):null;
          const mBal=resH?.data?.text?.match(/[£$€]?\s*([0-9]{1,3}(?:,[0-9]{3})*\.[0-9]{2})/);
          let detectedBalance=mBal?parseFloat(mBal[1].replace(/,/g,"")):null;

          // Step 2: Scan debit amounts column (right 50%)
          if(textEl)textEl.textContent="Scanning debit amounts (2/3)...";
          if(barEl)barEl.style.width="55%";
          const blobA=await sliceImageToBlob(img,0.50,0.12,0.50,0.80,3.0);
          const resA=blobA?await worker.recognize(blobA,{},{blocks:true}):null;
          const debitItems=[];
          const runningBalances=[];

          for(const b of (resA?.data?.blocks||[])){
            for(const p of b.paragraphs){
              for(const l of p.lines){
                const t=l.text.trim();
                const amt=parseDebitLine(t);
                if(amt!=null){
                  debitItems.push({amt,y:l.bbox.y0,text:t});
                }else{
                  const mb=t.match(/[£$€]?\s*([0-9]{1,3}(?:,[0-9]{3})*\.[0-9]{2})/);
                  if(mb){
                    const v=parseFloat(mb[1].replace(/,/g,""));
                    if(v>500)runningBalances.push({val:v,y:l.bbox.y0});
                  }
                }
              }
            }
          }

          if(detectedBalance==null&&runningBalances.length){
            detectedBalance=runningBalances[0].val;
          }

          // Step 3: Scan merchants & dates column (left 65%)
          if(textEl)textEl.textContent="Scanning merchants & dates (3/3)...";
          if(barEl)barEl.style.width="85%";
          const blobM=await sliceImageToBlob(img,0.0,0.12,0.65,0.80,3.0);
          const resM=blobM?await worker.recognize(blobM,{},{blocks:true}):null;
          const merchantItems=[];
          const now=new Date();
          let curDate=`${now.getDate()} ${now.toLocaleString("en-GB",{month:"short"})}`;

          function parseDate(s){
            const low=s.toLowerCase();
            if(low.includes("yesterday")){
              const d=new Date();d.setDate(d.getDate()-1);
              return `${d.getDate()} ${d.toLocaleString("en-GB",{month:"short"})}`;
            }
            if(low.includes("today")){
              const d=new Date();
              return `${d.getDate()} ${d.toLocaleString("en-GB",{month:"short"})}`;
            }
            const m=s.match(/(?:mon|tue|wed|thu|fri|sat|sun)?\s*([0-9]{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i);
            if(m){
              const day=parseInt(m[1],10);
              const mon=m[2].charAt(0).toUpperCase()+m[2].slice(1,3).toLowerCase();
              return `${day} ${mon}`;
            }
            return null;
          }

          for(const b of (resM?.data?.blocks||[])){
            for(const p of b.paragraphs){
              for(const l of p.lines){
                const t=l.text.trim();
                if(/^(october|all|in|out|search|home|apply|payments|cards)\b/i.test(t))continue;
                const dh=parseDate(t);
                if(dh){curDate=dh;continue;}
                if(/^screw\b/i.test(t)&&merchantItems.length&&merchantItems[merchantItems.length-1].desc.includes("SCREWFIX"))continue;
                const cleaned=cleanMerchantDesc(t);
                if(cleaned.length>=3&&!/^[0-9£$.,-]+$/.test(cleaned)){
                  merchantItems.push({desc:cleaned,date:curDate,y:l.bbox.y0});
                }
              }
            }
          }

          await worker.terminate();

          if(debitItems.length>0){
            const transactions=matchDebitsWithMerchants(debitItems,merchantItems,curDate);
            let structuredText=detectedBalance?`Account Balance: £${detectedBalance.toFixed(2)}\n\n`:"";
            let lastDate="";
            for(const tx of transactions){
              if(tx.date!==lastDate){
                lastDate=tx.date;
                structuredText+=`${lastDate}\n`;
              }
              structuredText+=`${tx.description} - £${tx.amount.toFixed(2)}\n`;
            }

            if(by("#bankRawTextInput"))by("#bankRawTextInput").value=structuredText.trim();
            if(statusEl)statusEl.style.display="none";
            renderScanResults({detectedBalance,transactions});
            return;
          }
        }catch(subErr){
          try{await worker.terminate();}catch(e){}
          console.warn("Mobile column scan failed, falling back to full-image OCR:",subErr);
        }
      }

      // Fallback for non-mobile or when column scan returned 0
      if(textEl)textEl.textContent="Scanning full statement text...";
      if(barEl)barEl.style.width="70%";
      const fullBlob=await sliceImageToBlob(img,0,0,1,1,2.5);
      const resFull=await Tesseract.recognize(fullBlob||file,"eng");
      const raw=resFull?.data?.text||"";
      if(by("#bankRawTextInput"))by("#bankRawTextInput").value=raw;
      const parsed=parseBankStatementText(raw,currentMonth);
      if(statusEl)statusEl.style.display="none";
      renderScanResults(parsed);
    }catch(err){
      console.error("OCR Error:",err);
      if(statusEl)statusEl.style.display="block";
      if(textEl)textEl.innerHTML=`<span style="color:#dc2626;">Scan failed: ${err.message}. Switch to 'Paste Text' tab to paste manually.</span>`;
    }
  }

  function confirmBankAllocation(){
    if(!currentScanData||!currentScanData.transactions.length)return;
    const x=loadCashflow(currentMonth);
    const rows=all(".scan-tx-row");
    let allocatedCount=0;
    let totalAllocatedAmount=0;

    rows.forEach(row=>{
      const idx=parseInt(row.dataset.idx,10);
      const chk=row.querySelector(".scan-tx-check");
      if(!chk||!chk.checked)return;

      const tx=currentScanData.transactions[idx];
      if(!tx)return;

      const descInput=row.querySelector(".scan-tx-desc");
      const amtInput=row.querySelector(".scan-tx-amount");
      const chosenDesc=(descInput?.value?.trim())||tx.description||"Bank Spend";
      const parsedAmt=amtInput?parseFloat(amtInput.value):tx.amount;
      const chosenAmt=(!isNaN(parsedAmt)&&parsedAmt>0)?parsedAmt:tx.amount;

      const catSelect=row.querySelector(".scan-tx-category");
      const chosenCat=catSelect?catSelect.value:(tx.category||"Living");
      const isTaxReserve=/tax reserve|tax provision/i.test(chosenCat);

      const item={
        id:uid(),
        createdAt:new Date().toISOString(),
        date:formatCashDate(tx.date,currentMonth),
        description:chosenDesc,
        category:chosenCat,
        planned:null,
        actual:chosenAmt,
        status:"Paid",
        treatment:isTaxReserve?"cashflow":(tx.propertyId?"property_expense":"cashflow"),
        propertyId:isTaxReserve?"":(tx.propertyId||""),
        campaignId:isTaxReserve?"":(tx.campaignId||""),
        isTransfer:isTaxReserve?true:false,
        reason:isTaxReserve?"tax_provision":"general",
        notes:isTaxReserve?"Tax Reserve transfer":"Auto-allocated from bank activity",
        account:DEFAULT_BANK_ACCOUNT
      };

      x.spending.push(item);
      allocatedCount++;
      totalAllocatedAmount+=chosenAmt;
      if(item.campaignId)syncMobileCampaignTx(item,false);
    });

    if(!allocatedCount){
      alert("No transactions were selected to allocate.");
      return;
    }

    const chkSync=by("#chkSyncBankBalance");
    if(chkSync&&chkSync.checked&&currentScanData.detectedBalance!=null){
      x.bankAccounts=x.bankAccounts||{zempler:0,lloyds:0};
      x.bankAccounts.lloyds=currentScanData.detectedBalance;
    }else{
      x.bankAccounts=x.bankAccounts||{zempler:0,lloyds:0};
      x.bankAccounts.lloyds=num(x.bankAccounts.lloyds)-totalAllocatedAmount;
    }
    x.bankUpdatedAt=new Date().toISOString();

    saveCashflow(x);
    closeScanModal();
    render();

    const balMsg=chkSync&&chkSync.checked&&currentScanData.detectedBalance!=null
      ?` and Lloyds balance updated to ${money.format(currentScanData.detectedBalance)}`
      :"";
    alert(`✓ Allocated ${allocatedCount} expenditure item(s) into cashflow${balMsg}.`);
  }

  by("#btnOpenScanModal")?.addEventListener("click",openScanModal);
  by("#closeScanDialog")?.addEventListener("click",closeScanModal);
  by("#tabScanImage")?.addEventListener("click",()=>switchScanTab("image"));
  by("#tabScanText")?.addEventListener("click",()=>switchScanTab("text"));
  by("#bankScreenshotInput")?.addEventListener("change",e=>{
    const file=e.target.files?.[0];
    if(file)scanBankScreenshot(file);
  });
  by("#btnParseText")?.addEventListener("click",()=>{
    const raw=by("#bankRawTextInput")?.value||"";
    const parsed=parseBankStatementText(raw,currentMonth);
    renderScanResults(parsed);
  });
  by("#btnLoadSample")?.addEventListener("click",()=>{
    const sample=`Lloyds Basic Acct\n£3,071.28\nYesterday\nTesla Inc.\n- £12.36\n£3,071.28\nTesla Inc.\n- £7.75\n£3,083.64\nTesla Inc.\n- £5.11\n£3,091.39\nFASTHOSTS\n- £0.24\n£3,096.50\nFri 16 October\nARGOS PAY\n- £100.00\n£3,096.74\nSCREWFIX\n- £17.89\n£3,196.74\nThu 15 October\nABRATAX\n- £6.00\n£3,214.63`;
    if(by("#bankRawTextInput"))by("#bankRawTextInput").value=sample;
    const parsed=parseBankStatementText(sample,currentMonth);
    renderScanResults(parsed);
  });
  function openBankBalanceModal(){
    const x=loadCashflow(currentMonth);
    const lloyds=x.bankAccounts?.lloyds??(x.bank??0);
    if(by("#editLloydsBalance"))by("#editLloydsBalance").value=lloyds;
    by("#mobileBankBalanceDialog")?.showModal();
  }

  by(".card-bank")?.addEventListener("click",openBankBalanceModal);
  by("#closeBankBalanceDialog")?.addEventListener("click",()=>by("#mobileBankBalanceDialog")?.close());
  by("#cancelBankBalanceDialog")?.addEventListener("click",()=>by("#mobileBankBalanceDialog")?.close());
  by("#mobileBankBalanceForm")?.addEventListener("submit",e=>{
    e.preventDefault();
    const x=loadCashflow(currentMonth);
    const lloydsVal=parseFloat(by("#editLloydsBalance")?.value)||0;
    x.bankAccounts={
      zempler: 0,
      lloyds: Math.max(0, lloydsVal)
    };
    x.bank=x.bankAccounts.lloyds;
    x.bankUpdatedAt=new Date().toISOString();
    saveCashflow(x);
    by("#mobileBankBalanceDialog")?.close();
    render();
  });

  window.TaxEngineReloadFromStorage=render;
  window.addEventListener("storage",render);
  window.addEventListener("pageshow",render);
  window.addEventListener("focus",render);
}

init();
})();

(()=>{"use strict";
const READ_ONLY_MODE = false; const SUPABASE_URL="https://ixhxsylbdscfapmsjhlb.supabase.co";
const SUPABASE_KEY="sb_publishable_JBlVdOh59UhN0MNbvvibAg_So1n4Myz";
const SESSION_KEY="tax-engine-supabase-session",SYNC_PREFIX="tax-engine-";
const by=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)];
let applyingRemote=false,pushTimer=null,lastPushAt=0,lastPullAt=0,lastLocalWriteAt=0;
const cloudAudit={checkedAt:"",localOnly:[],cloudOnly:[],different:[],matched:0,prePull:{localOnly:0,cloudOnly:0,different:0}};
if(typeof window !== "undefined") window.TaxEngineCloudAudit=cloudAudit;

function logToUI(msg) {
  if (typeof document === 'undefined') return;
  const div = document.createElement('div');
  div.style = 'position:fixed; top:10px; right:10px; background:rgba(0,0,0,0.8); color:white; padding:10px; z-index:9999; border-radius:5px; font-family:monospace; max-width:400px; word-wrap:break-word; margin-bottom:5px;';
  div.textContent = msg; console.log(msg); console.log(msg); console.log(msg);
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 10000);
}


function logToUI(msg) {
  const div = document.createElement("div");
  div.style = "position:fixed; top:10px; right:10px; background:rgba(0,0,0,0.8); color:white; padding:10px; z-index:9999; border-radius:5px; font-family:monospace; max-width:400px; word-wrap:break-word; margin-bottom:5px;";
  div.textContent = msg; console.log(msg);
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 10000);
}


function logToUI(msg) {
  const div = document.createElement("div");
  div.style = "position:fixed; top:10px; right:10px; background:rgba(0,0,0,0.8); color:white; padding:10px; z-index:9999; border-radius:5px; font-family:monospace; max-width:400px; word-wrap:break-word; margin-bottom:5px;";
  div.textContent = msg;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 10000);
}

const nativeSetItem=typeof Storage !== "undefined" ? Storage.prototype.setItem : null;
const status=text=>{all("[data-sync-status]").forEach(x=>x.textContent=text);};
function session(){try{return JSON.parse(localStorage.getItem(SESSION_KEY)||"null");}catch{return null;}}
function saveSession(s){nativeSetItem.call(localStorage,SESSION_KEY,JSON.stringify(s));}
function clearSession(){localStorage.removeItem(SESSION_KEY);}
function userIdFromToken(token){try{return JSON.parse(atob(token.split(".")[1].replace(/-/g,"+").replace(/_/g,"/"))).sub||"";}catch{return"";}}
function headers(token){return{apikey:SUPABASE_KEY,Authorization:`Bearer ${token}`,"Content-Type":"application/json"};}
function localRecords(){return Object.keys(localStorage).filter(k=>k.startsWith(SYNC_PREFIX)&&k!==SESSION_KEY).sort().map(k=>({record_key:k,payload:{value:localStorage.getItem(k)}}));}
async function auth(path,body){
  const res=await fetch(`${SUPABASE_URL}/auth/v1/${path}`,{method:"POST",headers:{apikey:SUPABASE_KEY,"Content-Type":"application/json"},body:JSON.stringify(body)});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(data.error_description||data.msg||data.message||"Supabase auth failed");
  return data;
}
async function ensureSession(){
  const s=session();if(!s?.access_token)return null;
  const issued=s.signedInAt?new Date(s.signedInAt).getTime():0,age=Date.now()-issued;
  if(age<45*60*1000)return s;
  if(!s.refresh_token)return s;
  const data=await auth("token?grant_type=refresh_token",{refresh_token:s.refresh_token});
  const next={...s,access_token:data.access_token||s.access_token,refresh_token:data.refresh_token||s.refresh_token,signedInAt:new Date().toISOString()};
  saveSession(next);return next;
}
async function signIn(create=false){
  const email=by("#syncEmail")?.value?.trim(),password=by("#syncPassword")?.value;
  if(!email||!password){status("Enter email and password first.");return;}
  status(create?"Creating sync account...":"Signing in...");
  const data=await auth(create?"signup":"token?grant_type=password",{email,password});
  const token=data.access_token,refresh=data.refresh_token,userId=data.user?.id||userIdFromToken(token);
  if(!token||!userId)throw new Error("No Supabase session returned");
  saveSession({access_token:token,refresh_token:refresh,user:{id:userId,email},signedInAt:new Date().toISOString()});
  renderAuthState();
  await initialCloudSync();
}
async function pushAll(reason="saved"){ if(READ_ONLY_MODE){ status("Read-only mode: local changes not pushed."); return; }
  const s=await ensureSession();if(!s?.access_token)return;
  const records=localRecords().map(r=>({...r,user_id:s.user.id}));
  if(!records.length)return;
  clearTimeout(pushTimer);pushTimer=null;
  status(`Auto-syncing ${records.length} record(s)...`);
  const res=await fetch(`${SUPABASE_URL}/rest/v1/tax_engine_records?on_conflict=user_id,record_key`,{method:"POST",headers:{...headers(s.access_token),Prefer:"resolution=merge-duplicates"},body:JSON.stringify(records)});
  if(!res.ok)throw new Error(await res.text());
  lastPushAt=Date.now();
  lastLocalWriteAt=0;
  status(`Synced ${new Date(lastPushAt).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}.`);
}
function schedulePush(){ if(READ_ONLY_MODE) return;
  if(applyingRemote||!session()?.access_token)return;
  lastLocalWriteAt=Date.now();
  clearTimeout(pushTimer);
  pushTimer=setTimeout(()=>pushAll().catch(e => {
      status(`Sync failed: ${e.message}`);
      logToUI(`Cloud Sync Failed! Error: ${e.message}`);
    }),900);
}
function mergeCashflowPayload(localStr, remoteStr){
  if(!localStr) return remoteStr;
  if(!remoteStr) return localStr;
  try{
    const local = JSON.parse(localStr);
    const remote = JSON.parse(remoteStr);
    if(!local || typeof local !== 'object') return remoteStr;
    if(!remote || typeof remote !== 'object') return localStr;

    const mergeList = (localList, remoteList) => {
      const map = new Map();
      (Array.isArray(remoteList) ? remoteList : []).forEach(item => {
        if(item && (item.id || item.description || item.payment)) {
          const k = item.id || `${item.due||item.date}:${item.description||item.payment}:${item.actual||item.expected||item.planned}`;
          map.set(k, item);
        }
      });
      (Array.isArray(localList) ? localList : []).forEach(item => {
        if(item && (item.id || item.description || item.payment)) {
          const k = item.id || `${item.due||item.date}:${item.description||item.payment}:${item.actual||item.expected||item.planned}`;
          map.set(k, item);
        }
      });
      return [...map.values()];
    };

    const lloydsLocal = Number(local.bankAccounts?.lloyds || 0);
    const lloydsRemote = Number(remote.bankAccounts?.lloyds || 0);
    const zemplerLocal = Number(local.bankAccounts?.zempler || 0);
    const zemplerRemote = Number(remote.bankAccounts?.zempler || 0);
    const zemplerFinal = Math.max(zemplerLocal, zemplerRemote);
    const lloydsFinal = lloydsLocal > 0 ? lloydsLocal : (lloydsRemote > 0 ? lloydsRemote : 0);

    const merged = {
      ...remote,
      ...local,
      fixed: mergeList(local.fixed, remote.fixed),
      spending: mergeList(local.spending, remote.spending),
      income: mergeList(local.income, remote.income),
      bankAccounts: {
        zempler: zemplerFinal,
        lloyds: lloydsFinal
      },
      bank: zemplerFinal + lloydsFinal
    };
    return JSON.stringify(merged);
  }catch(e){
    return remoteStr;
  }
}

function mergeAppStatePayload(localStr, remoteStr){
  if(!localStr) return remoteStr;
  if(!remoteStr) return localStr;
  try{
    const local = JSON.parse(localStr);
    const remote = JSON.parse(remoteStr);
    if(!local || typeof local !== 'object') return remoteStr;
    if(!remote || typeof remote !== 'object') return localStr;

    const mergeListById = (localList, remoteList) => {
      const map = new Map();
      (Array.isArray(remoteList) ? remoteList : []).forEach(item => {
        if(item && (item.id || item.sourceExpenseId)) {
          const k = item.id || item.sourceExpenseId;
          map.set(k, item);
        }
      });
      (Array.isArray(localList) ? localList : []).forEach(item => {
        if(item && (item.id || item.sourceExpenseId)) {
          const k = item.id || item.sourceExpenseId;
          map.set(k, item);
        }
      });
      return [...map.values()];
    };

    return JSON.stringify({
      ...remote,
      ...local,
      properties: mergeListById(local.properties, remote.properties),
      propertyIncome: mergeListById(local.propertyIncome, remote.propertyIncome),
      propertyExpenses: mergeListById(local.propertyExpenses, remote.propertyExpenses),
      campaigns: mergeListById(local.campaigns, remote.campaigns),
      campaignTransactions: mergeListById(local.campaignTransactions, remote.campaignTransactions),
      payments: mergeListById(local.payments, remote.payments),
      pension: mergeListById(local.pension, remote.pension)
    });
  }catch(e){
    return remoteStr;
  }
}

async function pullAll({reload=true}={}){
  const s=await ensureSession();if(!s?.access_token)return 0;
  if(pushTimer||Date.now()-lastLocalWriteAt<10000){status("Local changes pending sync...");return 0;}
  lastPullAt=Date.now();
  status("Loading cloud records...");
  const res=await fetch(`${SUPABASE_URL}/rest/v1/tax_engine_records?select=record_key,payload,updated_at&order=record_key.asc`,{headers:headers(s.access_token)});
  const rows=await res.json().catch(()=>[]);
  if(!res.ok)throw new Error(Array.isArray(rows)?await res.text():rows.message||"Supabase pull failed");
  const localBefore=new Map(localRecords().map(r=>[r.record_key,String(r.payload?.value??"")])),cloudBefore=new Map(rows.map(r=>[r.record_key,String(r.payload?.value??"")]));
  const beforeLocalOnly=[...localBefore.keys()].filter(k=>!cloudBefore.has(k)),beforeCloudOnly=[...cloudBefore.keys()].filter(k=>!localBefore.has(k)),beforeDifferent=[...cloudBefore.keys()].filter(k=>localBefore.has(k)&&localBefore.get(k)!==cloudBefore.get(k));cloudAudit.checkedAt=new Date().toISOString();cloudAudit.prePull={localOnly:beforeLocalOnly.length,cloudOnly:beforeCloudOnly.length,different:beforeDifferent.length};
  let changed=0;applyingRemote=true;
  try{
    rows.forEach(r=>{
      const remoteVal=String(r.payload?.value??"");
      let nextVal=remoteVal;
      if((r.record_key.startsWith(SYNC_PREFIX+"cashflow-") || r.record_key==="tax-engine-april-2026-cashflow") && localStorage.getItem(r.record_key)){
        nextVal=mergeCashflowPayload(localStorage.getItem(r.record_key), remoteVal);
      } else if(r.record_key==="tax-engine-v3" && localStorage.getItem(r.record_key)){
        nextVal=mergeAppStatePayload(localStorage.getItem(r.record_key), remoteVal);
      }
      if(localStorage.getItem(r.record_key)!==nextVal){
        nativeSetItem.call(localStorage,r.record_key,nextVal); 
        changed++;
      }
    });
    const localAfter=new Map(localRecords().map(r=>[r.record_key,String(r.payload?.value??"")]));cloudAudit.localOnly=[...localAfter.keys()].filter(k=>!cloudBefore.has(k));cloudAudit.cloudOnly=[...cloudBefore.keys()].filter(k=>!localAfter.has(k));cloudAudit.different=[...cloudBefore.keys()].filter(k=>localAfter.has(k)&&localAfter.get(k)!==cloudBefore.get(k));cloudAudit.matched=[...cloudBefore.keys()].filter(k=>localAfter.get(k)===cloudBefore.get(k)).length;
    if(changed&&reload)window.TaxEngineReloadFromStorage?.();
  }
  finally{applyingRemote=false;}
  status(changed?`Loaded ${changed} cloud update(s).`:`Cloud records are up to date.`);
  if(changed&&reload)await pushAll("remote-normalised");
  return rows.length;
}
async function initialCloudSync(){
  const count=await pullAll({reload:true});
  if(!count)await pushAll("initial");
}
function signOut(){clearSession();status("Signed out of Supabase sync.");renderAuthState();}
function renderAuthState(){
  const s=session(),signed=!!s?.access_token;
  all("[data-sync-signed-in]").forEach(x=>x.hidden=!signed);
  all("[data-sync-signed-out]").forEach(x=>x.hidden=signed);
  all("[data-sync-section]").forEach(x=>{ x.hidden=signed; });
  const badge=by("#syncStatusBadge"), badgeText=by("#syncBadgeText"), badgeDot=by(".sync-dot");
  if(badge){
    badge.style.display="inline-flex";
    if(signed){
      badge.style.background="#064e3b";
      badge.style.color="#a7f3d0";
      if(badgeDot)badgeDot.style.background="#34d399";
      if(badgeText)badgeText.textContent="Synced";
    }else{
      badge.style.background="#78350f";
      badge.style.color="#fde68a";
      if(badgeDot)badgeDot.style.background="#f59e0b";
      if(badgeText)badgeText.textContent="Not Synced";
    }
  }
  if(signed)status(`Auto sync on as ${s.user?.email||"user"}.`);
}
function installAutoPush(){
  if(Storage.prototype.setItem.__taxEngineSyncWrapped)return;
  Storage.prototype.setItem=function(key,value){
    const result=nativeSetItem.call(this,key,value);
    if(this===localStorage&&String(key).startsWith(SYNC_PREFIX)&&key!==SESSION_KEY)schedulePush();
    return result;
  };
  Storage.prototype.setItem.__taxEngineSyncWrapped=true;
}
function bind(){
  installAutoPush();
  by("#syncSignIn")?.addEventListener("click",()=>signIn(false).catch(e=>status(`Sign in failed: ${e.message}`)));
  by("#syncCreateAccount")?.addEventListener("click",()=>signIn(true).catch(e=>status(`Create account failed: ${e.message}`)));
  all("[data-sync-signout]").forEach(b=>b.addEventListener("click",signOut));
  by("#syncStatusBadge")?.addEventListener("click",()=>{
    all("[data-sync-section]").forEach(x=>x.hidden=!x.hidden);
  });
  renderAuthState();
  if(session()?.access_token)initialCloudSync().catch(e=>status(`Sync failed: ${e.message}`));
  document.addEventListener("visibilitychange",()=>{if(!document.hidden&&session()?.access_token&&Date.now()-lastPullAt>5000)pullAll({reload:true}).catch(e=>status(`Sync failed: ${e.message}`));});
  window.addEventListener("focus",()=>{if(session()?.access_token&&Date.now()-lastPullAt>5000)pullAll({reload:true}).catch(e=>status(`Sync failed: ${e.message}`));});
  setInterval(()=>{if(!document.hidden&&session()?.access_token&&Date.now()-lastPullAt>30000)pullAll({reload:true}).catch(e=>status(`Sync failed: ${e.message}`));},30000);
}
if(typeof window !== "undefined") window.TaxEngineSync = { pushAll, pullAll, schedulePush, mergeCashflowPayload, mergeAppStatePayload };
if(typeof module !== "undefined" && module.exports) module.exports = { mergeCashflowPayload, mergeAppStatePayload };
if(typeof document !== "undefined"){
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind);else bind();
}
})();

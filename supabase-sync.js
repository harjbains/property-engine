(()=>{"use strict";
const SUPABASE_URL="https://ixhxsylbdscfapmsjhlb.supabase.co";
const SUPABASE_KEY="sb_publishable_JBlVdOh59UhN0MNbvvibAg_So1n4Myz";
const SESSION_KEY="tax-engine-supabase-session",SYNC_PREFIX="tax-engine-";
const by=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)];
let applyingRemote=false,pushTimer=null,lastPushAt=0,lastPullAt=0;
const nativeSetItem=Storage.prototype.setItem;
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
async function pushAll(reason="saved"){
  const s=await ensureSession();if(!s?.access_token)return;
  const records=localRecords().map(r=>({...r,user_id:s.user.id}));
  if(!records.length)return;
  status(`Auto-syncing ${records.length} record(s)...`);
  const res=await fetch(`${SUPABASE_URL}/rest/v1/tax_engine_records?on_conflict=user_id,record_key`,{method:"POST",headers:{...headers(s.access_token),Prefer:"resolution=merge-duplicates"},body:JSON.stringify(records)});
  if(!res.ok)throw new Error(await res.text());
  lastPushAt=Date.now();
  status(`Synced ${new Date(lastPushAt).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}.`);
}
function schedulePush(){
  if(applyingRemote||!session()?.access_token)return;
  clearTimeout(pushTimer);
  pushTimer=setTimeout(()=>pushAll().catch(e=>status(`Sync failed: ${e.message}`)),900);
}
async function pullAll({reload=true}={}){
  const s=await ensureSession();if(!s?.access_token)return 0;
  lastPullAt=Date.now();
  status("Loading cloud records...");
  const res=await fetch(`${SUPABASE_URL}/rest/v1/tax_engine_records?select=record_key,payload,updated_at&order=record_key.asc`,{headers:headers(s.access_token)});
  const rows=await res.json().catch(()=>[]);
  if(!res.ok)throw new Error(Array.isArray(rows)?await res.text():rows.message||"Supabase pull failed");
  let changed=0;applyingRemote=true;
  try{rows.forEach(r=>{const value=String(r.payload?.value??"");if(localStorage.getItem(r.record_key)!==value){nativeSetItem.call(localStorage,r.record_key,value);changed++;}});}
  finally{applyingRemote=false;}
  status(changed?`Loaded ${changed} cloud update(s).`:`Cloud records are up to date.`);
  if(changed&&reload)setTimeout(()=>location.reload(),650);
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
  renderAuthState();
  if(session()?.access_token)initialCloudSync().catch(e=>status(`Sync failed: ${e.message}`));
  document.addEventListener("visibilitychange",()=>{if(!document.hidden&&session()?.access_token&&Date.now()-lastPullAt>5000)pullAll({reload:true}).catch(e=>status(`Sync failed: ${e.message}`));});
  window.addEventListener("focus",()=>{if(session()?.access_token&&Date.now()-lastPullAt>5000)pullAll({reload:true}).catch(e=>status(`Sync failed: ${e.message}`));});
  setInterval(()=>{if(!document.hidden&&session()?.access_token&&Date.now()-lastPullAt>30000)pullAll({reload:true}).catch(e=>status(`Sync failed: ${e.message}`));},30000);
}
window.TaxEngineSync={pushAll,pullAll,schedulePush};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind);else bind();
})();

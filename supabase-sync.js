(()=>{"use strict";
const SUPABASE_URL="https://ixhxsylbdscfapmsjhlb.supabase.co";
const SUPABASE_KEY="sb_publishable_JBlVdOh59UhN0MNbvvibAg_So1n4Myz";
const SESSION_KEY="tax-engine-supabase-session",SYNC_PREFIX="tax-engine-";
const by=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)];
const status=text=>{all("[data-sync-status]").forEach(x=>x.textContent=text);};
function session(){try{return JSON.parse(localStorage.getItem(SESSION_KEY)||"null");}catch{return null;}}
function saveSession(s){localStorage.setItem(SESSION_KEY,JSON.stringify(s));}
function clearSession(){localStorage.removeItem(SESSION_KEY);}
function userIdFromToken(token){try{return JSON.parse(atob(token.split(".")[1].replace(/-/g,"+").replace(/_/g,"/"))).sub||"";}catch{return"";}}
function headers(token){return{apikey:SUPABASE_KEY,Authorization:`Bearer ${token}`, "Content-Type":"application/json"};}
async function auth(path,body){
  const res=await fetch(`${SUPABASE_URL}/auth/v1/${path}`,{method:"POST",headers:{apikey:SUPABASE_KEY,"Content-Type":"application/json"},body:JSON.stringify(body)});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(data.error_description||data.msg||data.message||"Supabase auth failed");
  return data;
}
async function signIn(create=false){
  const email=by("#syncEmail")?.value?.trim(),password=by("#syncPassword")?.value;
  if(!email||!password){status("Enter email and password first.");return;}
  status(create?"Creating account...":"Signing in...");
  const data=await auth(create?"signup":"token?grant_type=password",{email,password});
  const token=data.access_token,refresh=data.refresh_token,userId=data.user?.id||userIdFromToken(token);
  if(!token||!userId)throw new Error("No Supabase session returned");
  saveSession({access_token:token,refresh_token:refresh,user:{id:userId,email},signedInAt:new Date().toISOString()});
  status(`Signed in as ${email}`);
  renderAuthState();
}
function localRecords(){return Object.keys(localStorage).filter(k=>k.startsWith(SYNC_PREFIX)&&k!==SESSION_KEY).sort().map(k=>({record_key:k,payload:{value:localStorage.getItem(k)}}));}
async function pushAll(){
  const s=session();if(!s?.access_token){status("Sign in before syncing.");return;}
  const records=localRecords().map(r=>({...r,user_id:s.user.id}));
  if(!records.length){status("No local Tax Engine records to push.");return;}
  status(`Pushing ${records.length} record(s)...`);
  const res=await fetch(`${SUPABASE_URL}/rest/v1/tax_engine_records?on_conflict=user_id,record_key`,{method:"POST",headers:{...headers(s.access_token),Prefer:"resolution=merge-duplicates"},body:JSON.stringify(records)});
  if(!res.ok)throw new Error(await res.text());
  status(`Pushed ${records.length} record(s) to Supabase.`);
}
async function pullAll(){
  const s=session();if(!s?.access_token){status("Sign in before syncing.");return;}
  if(!confirm("Pull cloud records into this browser? Matching local Tax Engine records will be replaced."))return;
  status("Pulling records from Supabase...");
  const res=await fetch(`${SUPABASE_URL}/rest/v1/tax_engine_records?select=record_key,payload,updated_at&order=record_key.asc`,{headers:headers(s.access_token)});
  const rows=await res.json().catch(()=>[]);
  if(!res.ok)throw new Error(Array.isArray(rows)?await res.text():rows.message||"Supabase pull failed");
  rows.forEach(r=>localStorage.setItem(r.record_key,String(r.payload?.value??"")));
  status(`Pulled ${rows.length} record(s). Reloading...`);
  setTimeout(()=>location.reload(),700);
}
function signOut(){clearSession();status("Signed out of Supabase sync.");renderAuthState();}
function renderAuthState(){
  const s=session(),signed=!!s?.access_token;
  all("[data-sync-signed-in]").forEach(x=>x.hidden=!signed);
  all("[data-sync-signed-out]").forEach(x=>x.hidden=signed);
  if(signed)status(`Supabase sync signed in as ${s.user?.email||"user"}.`);
}
function bind(){
  by("#syncSignIn")?.addEventListener("click",()=>signIn(false).catch(e=>status(`Sign in failed: ${e.message}`)));
  by("#syncCreateAccount")?.addEventListener("click",()=>signIn(true).catch(e=>status(`Create account failed: ${e.message}`)));
  all("[data-sync-push]").forEach(b=>b.addEventListener("click",()=>pushAll().catch(e=>status(`Push failed: ${e.message}`))));
  all("[data-sync-pull]").forEach(b=>b.addEventListener("click",()=>pullAll().catch(e=>status(`Pull failed: ${e.message}`))));
  all("[data-sync-signout]").forEach(b=>b.addEventListener("click",signOut));
  renderAuthState();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind);else bind();
})();

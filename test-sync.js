const fs = require('fs');
let sync = fs.readFileSync('supabase-sync.js', 'utf8');

const oldPushAll = `async function pushAll(reason="saved"){ if(READ_ONLY_MODE){ status("Read-only mode: local changes not pushed."); return; }
  const s=await ensureSession();if(!s?.access_token)return;
  const records=localRecords().map(r=>({...r,user_id:s.user.id}));
  if(!records.length)return;
  clearTimeout(pushTimer);pushTimer=null;
  status(\`Auto-syncing \${records.length} record(s)...\`);
  const res=await fetch(\`\${SUPABASE_URL}/rest/v1/tax_engine_records?on_conflict=user_id,record_key\`,{method:"POST",headers:{...headers(s.access_token),Prefer:"resolution=merge-duplicates"},body:JSON.stringify(records)});
  if(!res.ok)throw new Error(await res.text());
  lastPushAt=Date.now();
  lastLocalWriteAt=0;
  status(\`Synced \${new Date(lastPushAt).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}.\`);
}`;

const newPushAll = `async function pushAll(reason="saved"){ 
  try {
    alert("TEST: pushAll triggered. Reason: " + reason);
    if(READ_ONLY_MODE){ alert("TEST: Aborting, READ_ONLY_MODE is true"); status("Read-only mode: local changes not pushed."); return; }
    const s=await ensureSession();
    if(!s?.access_token) { alert("TEST: No access token!"); return; }
    const records=localRecords().map(r=>({...r,user_id:s.user.id}));
    alert("TEST: Found " + records.length + " records to push.");
    if(!records.length)return;
    clearTimeout(pushTimer);pushTimer=null;
    status(\`Auto-syncing \${records.length} record(s)...\`);
    alert("TEST: Sending fetch request to Supabase...");
    const res=await fetch(\`\${SUPABASE_URL}/rest/v1/tax_engine_records?on_conflict=user_id,record_key\`,{method:"POST",headers:{...headers(s.access_token),Prefer:"resolution=merge-duplicates"},body:JSON.stringify(records)});
    alert("TEST: Fetch complete. res.ok: " + res.ok);
    if(!res.ok) {
      const errText = await res.text();
      alert("TEST: Fetch failed! " + errText);
      throw new Error(errText);
    }
    lastPushAt=Date.now();
    lastLocalWriteAt=0;
    alert("TEST: Sync successful!");
    status(\`Synced \${new Date(lastPushAt).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}.\`);
  } catch (e) {
    alert("TEST EXCEPTION: " + e.message);
    throw e;
  }
}`;

sync = sync.replace(oldPushAll, newPushAll);
fs.writeFileSync('supabase-sync.js', sync, 'utf8');

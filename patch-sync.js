const fs = require('fs');
let sync = fs.readFileSync('supabase-sync.js', 'utf8');

// Patch pullAll
sync = sync.replace(
  /if\(localStorage\.getItem\(r\.record_key\)!==value\)\{[\s\S]*?changed\+\+;\s*\}/,
  `if(localStorage.getItem(r.record_key)!==value){
      nativeSetItem.call(localStorage,r.record_key,value);
      changed++;
    }
    // Always store the updated_at so we have a reliable baseline for optimistic concurrency
    nativeSetItem.call(localStorage, r.record_key + "_last_updated_at", r.updated_at);`
);

// Patch pushAll
const oldPushLoop = `const req={record_key:k,payload:{value:v},updated_at:new Date().toISOString()};
    const {error}=await _supabase.from("tax_engine_records").upsert(req,{onConflict:"record_key"});
    if(!error){
      by("[data-sync-status]").textContent="Synced to cloud "+new Date().toLocaleTimeString();`;

const newPushLoop = `
    const lastKnown = localStorage.getItem(k + "_last_updated_at");
    if (lastKnown) {
      const {data: cloudRecord} = await _supabase.from("tax_engine_records").select("updated_at").eq("record_key", k).maybeSingle();
      if (cloudRecord && cloudRecord.updated_at !== lastKnown) {
        alert("Warning: Another device has updated your data! Your local changes were blocked to prevent overwriting it. The page will now pull the latest data.");
        await pullAll({reload: true});
        return;
      }
    }

    const req={record_key:k,payload:{value:v},updated_at:new Date().toISOString()};
    const {data: newRecord, error}=await _supabase.from("tax_engine_records").upsert(req,{onConflict:"record_key"}).select().single();
    if(!error){
      if (newRecord) nativeSetItem.call(localStorage, k + "_last_updated_at", newRecord.updated_at);
      by("[data-sync-status]").textContent="Synced to cloud "+new Date().toLocaleTimeString();`;

sync = sync.replace(oldPushLoop, newPushLoop);

fs.writeFileSync('supabase-sync.js', sync, 'utf8');

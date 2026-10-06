const fs = require('fs');
let sync = fs.readFileSync('supabase-sync.js', 'utf8');

const oldFetch = `const res=await fetch(\`\${SUPABASE_URL}/rest/v1/tax_engine_records?on_conflict=user_id,record_key\`,{method:"POST",headers:{...headers(s.access_token),Prefer:"resolution=merge-duplicates"},body:JSON.stringify(records)});
    if(!res.ok)throw new Error(await res.text());`;

const newFetch = `const res=await fetch(\`\${SUPABASE_URL}/rest/v1/tax_engine_records?on_conflict=user_id,record_key\`,{method:"POST",headers:{...headers(s.access_token),Prefer:"return=representation,resolution=merge-duplicates"},body:JSON.stringify(records)});
    if(!res.ok)throw new Error(await res.text());
    const savedRows = await res.json();
    savedRows.forEach(r => nativeSetItem.call(localStorage, r.record_key + "_last_updated_at", r.updated_at));`;

sync = sync.replace(oldFetch, newFetch);
fs.writeFileSync('supabase-sync.js', sync, 'utf8');

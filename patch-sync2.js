const fs = require('fs');
let sync = fs.readFileSync('supabase-sync.js', 'utf8');

// We need to implement a pre-check in pushAll
const oldPushAll = `const records=localRecords().map(r=>({...r,user_id:s.user.id}));
    if(!records.length)return;
    clearTimeout(pushTimer);pushTimer=null;
    status(\`Auto-syncing \${records.length} record(s)...\`);`;

const newPushAll = `const records=localRecords().map(r=>({...r,user_id:s.user.id}));
    if(!records.length)return;

    // Optimistic Concurrency Pre-check
    const keys = records.map(r => r.record_key);
    const checkRes = await fetch(\`\${SUPABASE_URL}/rest/v1/tax_engine_records?select=record_key,updated_at&record_key=in.(\${keys.join(',')})\`, {
      headers: headers(s.access_token)
    });
    if (checkRes.ok) {
      const cloudRows = await checkRes.json();
      for (const row of cloudRows) {
        const localUpdated = localStorage.getItem(row.record_key + "_last_updated_at");
        if (localUpdated && row.updated_at && localUpdated !== row.updated_at) {
          alert("Warning: Another device has updated your data! Your local changes were blocked to prevent overwriting. The page will now pull the latest data.");
          await pullAll({reload: true});
          return;
        }
      }
    }

    clearTimeout(pushTimer);pushTimer=null;
    status(\`Auto-syncing \${records.length} record(s)...\`);`;

sync = sync.replace(oldPushAll, newPushAll);

// And we need to store updated_at during pullAll and pushAll
// pullAll uses:
const oldPull = `nativeSetItem.call(localStorage,r.record_key,value);`;
const newPull = `nativeSetItem.call(localStorage,r.record_key,value); nativeSetItem.call(localStorage, r.record_key + "_last_updated_at", r.updated_at);`;
sync = sync.replace(oldPull, newPull);

fs.writeFileSync('supabase-sync.js', sync, 'utf8');

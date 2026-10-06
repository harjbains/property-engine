const fs = require('fs');
let sync = fs.readFileSync('supabase-sync.js', 'utf8');

// Replace schedulePush to alert on error so we can see it
const oldSched = `pushTimer=setTimeout(()=>pushAll().catch(e=>status(\`Sync failed: \${e.message}\`)),900);`;
const newSched = `pushTimer=setTimeout(()=>pushAll().catch(e => {
      status(\`Sync failed: \${e.message}\`);
      alert(\`Cloud Sync Failed! Error: \${e.message}\`);
    }),900);`;
sync = sync.replace(oldSched, newSched);

// Fix the checkRes to use proper quotes for PostgREST
const oldCheck = `const checkRes = await fetch(\`\${SUPABASE_URL}/rest/v1/tax_engine_records?select=record_key,updated_at&record_key=in.(\${keys.join(',')})\``;
const newCheck = `const quotedKeys = keys.map(k => '"' + k + '"').join(',');
    const checkRes = await fetch(\`\${SUPABASE_URL}/rest/v1/tax_engine_records?select=record_key,updated_at&record_key=in.(\${quotedKeys})\``;
sync = sync.replace(oldCheck, newCheck);

// Wrap res.json() in a try-catch so it doesn't crash if body is empty
const oldJson = `const savedRows = await res.json();
    savedRows.forEach(r => nativeSetItem.call(localStorage, r.record_key + "_last_updated_at", r.updated_at));`;
const newJson = `try {
      const savedRows = await res.json();
      if (Array.isArray(savedRows)) {
        savedRows.forEach(r => nativeSetItem.call(localStorage, r.record_key + "_last_updated_at", r.updated_at));
      }
    } catch(err) {
      console.error("Failed to parse representation", err);
    }`;
sync = sync.replace(oldJson, newJson);

fs.writeFileSync('supabase-sync.js', sync, 'utf8');

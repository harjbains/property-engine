const fs = require('fs');
let sync = fs.readFileSync('supabase-sync.js', 'utf8');

const oldAlert = `pushTimer=setTimeout(()=>pushAll().catch(e => {
      status(\`Sync failed: \${e.message}\`);
      alert(\`Cloud Sync Failed! Error: \${e.message}\`);
    }),900);`;
const newAlert = `pushTimer=setTimeout(()=>pushAll().catch(e=>status(\`Sync failed: \${e.message}\`)),900);`;
sync = sync.replace(oldAlert, newAlert);

// Clean up any other remnants just in case
sync = sync.replace(/nativeSetItem\.call\(localStorage, r\.record_key \+ "_last_updated_at", r\.updated_at\);/g, '');

fs.writeFileSync('supabase-sync.js', sync, 'utf8');

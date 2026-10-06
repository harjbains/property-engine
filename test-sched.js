const fs = require('fs');
let sync = fs.readFileSync('supabase-sync.js', 'utf8');

const oldSched = `function schedulePush(){ if(READ_ONLY_MODE) return;
  if(applyingRemote||!session()?.access_token)return;
  lastLocalWriteAt=Date.now();
  clearTimeout(pushTimer);`;
const newSched = `function schedulePush(){ 
  alert("TEST: schedulePush called!");
  if(READ_ONLY_MODE) { alert("TEST: schedulePush blocked by READ_ONLY_MODE"); return; }
  if(applyingRemote) { alert("TEST: schedulePush blocked by applyingRemote"); return; }
  if(!session()?.access_token) { alert("TEST: schedulePush blocked by missing session"); return; }
  alert("TEST: schedulePush timer starting...");
  lastLocalWriteAt=Date.now();
  clearTimeout(pushTimer);`;
sync = sync.replace(oldSched, newSched);
fs.writeFileSync('supabase-sync.js', sync, 'utf8');

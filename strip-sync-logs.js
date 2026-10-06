const fs = require('fs');
let sync = fs.readFileSync('supabase-sync.js', 'utf8');

sync = sync.replace('alert("TEST: schedulePush called!");', '');
sync = sync.replace('logToUI("TEST: schedulePush called!");', '');
sync = sync.replace('logToUI("TEST: schedulePush blocked by applyingRemote");', '');
sync = sync.replace('logToUI("TEST: schedulePush blocked by missing session");', '');
sync = sync.replace('logToUI("TEST: schedulePush timer starting...");', '');
sync = sync.replace('logToUI("TEST: schedulePush blocked by READ_ONLY_MODE");', '');

fs.writeFileSync('supabase-sync.js', sync, 'utf8');

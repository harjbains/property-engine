const fs = require('fs');

function addConsole(file) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/div\.textContent = msg;/g, 'div.textContent = msg; console.log(msg);');
  fs.writeFileSync(file, content, 'utf8');
}

addConsole('app.js');
addConsole('supabase-sync.js');

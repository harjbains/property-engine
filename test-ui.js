const fs = require('fs');
let sync = fs.readFileSync('supabase-sync.js', 'utf8');

// Replace alerts with UI log
const injectLog = `
function logToUI(msg) {
  const div = document.createElement("div");
  div.style = "position:fixed; top:10px; right:10px; background:rgba(0,0,0,0.8); color:white; padding:10px; z-index:9999; border-radius:5px; font-family:monospace; max-width:400px; word-wrap:break-word; margin-bottom:5px;";
  div.textContent = msg;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 10000);
}
`;

sync = sync.replace('const nativeSetItem', injectLog + '\nconst nativeSetItem');
sync = sync.replace(/alert\(/g, 'logToUI(');

fs.writeFileSync('supabase-sync.js', sync, 'utf8');

let app = fs.readFileSync('app.js', 'utf8');

const injectAppLog = `
function logToUI(msg) {
  const div = document.createElement("div");
  div.style = "position:fixed; top:10px; right:10px; background:rgba(0,0,0,0.8); color:white; padding:10px; z-index:9999; border-radius:5px; font-family:monospace; max-width:400px; word-wrap:break-word; margin-bottom:5px;";
  div.textContent = msg;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 10000);
}
`;

app = app.replace('const by=', injectAppLog + '\nconst by=');
app = app.replace(/alert\(/g, 'logToUI(');

// Also add a log immediately on submit
const oldSubmit = `document.addEventListener("submit", (e) => { if (e.target.id === "campaignForm") {
      e.preventDefault();`;
const newSubmit = `document.addEventListener("submit", (e) => { if (e.target.id === "campaignForm") {
      e.preventDefault();
      logToUI("TEST: Campaign form submitted!");`;
app = app.replace(oldSubmit, newSubmit);

fs.writeFileSync('app.js', app, 'utf8');

const fs = require('fs');
let app = fs.readFileSync('app.js', 'utf8');

const regex1 = /by\("#campaignForm"\)\?\.addEventListener\("submit",\s*\(e\)\s*=>\s*\{([\s\S]*?render\(\);\s*\/\/\s*Update dashboard\s*\}\);)/;
const match1 = app.match(regex1);
if(match1) {
  const inner = match1[1].replace(/\}\);$/, '}');
  app = app.replace(regex1, `document.addEventListener("submit", (e) => { if (e.target.id === "campaignForm") {${inner}});`);
}

const regex2 = /by\("#campaignTransactionForm"\)\?\.addEventListener\("submit",\s*\(e\)\s*=>\s*\{([\s\S]*?render\(\);\s*\/\/\s*Update dashboard\s*\}\);)/;
const match2 = app.match(regex2);
if(match2) {
  const inner = match2[1].replace(/\}\);$/, '}');
  app = app.replace(regex2, `document.addEventListener("submit", (e) => { if (e.target.id === "campaignTransactionForm") {${inner}});`);
}

fs.writeFileSync('app.js', app, 'utf8');

const fs = require('fs');
let app = fs.readFileSync('app.js', 'utf8');

const startIdx = app.indexOf('document.addEventListener("submit", (e) => { if (e.target.id === "campaignForm") {');
if (startIdx !== -1) {
  const endIdx = app.indexOf('// removed DOMContentLoaded', startIdx);
  if (endIdx !== -1) {
    app = app.substring(0, startIdx) + app.substring(endIdx);
  } else {
    // maybe end of file
    app = app.substring(0, startIdx);
  }
}

fs.writeFileSync('app.js', app, 'utf8');

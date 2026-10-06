const fs = require('fs');
let app = fs.readFileSync('app.js', 'utf8');
const camp = fs.readFileSync('campaigns.js', 'utf8');

if (!app.includes('function initCampaignsState')) {
  app = app.replace(/\}\)\(\);\s*$/, camp + "\n})();");
  fs.writeFileSync('app.js', app, 'utf8');
  console.log("Injected campaigns into app.js");
} else {
  console.log("Already injected");
}

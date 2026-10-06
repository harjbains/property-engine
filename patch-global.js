const fs = require('fs');
let app = fs.readFileSync('app.js', 'utf8');

// Expose renderCampaignDetail globally if it isn't already
if (!app.includes('window.renderCampaignDetail = renderCampaignDetail')) {
  app = app.replace(/function renderCampaignDetail\(id\) \{/, 'window.renderCampaignDetail = renderCampaignDetail;\nfunction renderCampaignDetail(id) {');
  fs.writeFileSync('app.js', app, 'utf8');
  console.log("Exposed renderCampaignDetail globally");
} else {
  console.log("Already exposed");
}

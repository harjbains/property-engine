const fs = require('fs');
let app = fs.readFileSync('app.js', 'utf8');

app = app.replace('window.currentCampaignIndex = (window.currentCampaignIndex + 1) % visibleCampaigns.length;\n        render();', 'window.currentCampaignIndex = (window.currentCampaignIndex + 1) % visibleCampaigns.length;\n        renderDashboardSurface();');

fs.writeFileSync('app.js', app, 'utf8');

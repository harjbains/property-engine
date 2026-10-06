const fs = require('fs');
let app = fs.readFileSync('app.js', 'utf8');

const oldSaveCampaign = `window.saveCampaign = () => {
    initCampaignsState();
    const form = by("#campaignForm");
    if (!form.reportValidity()) return;`;

const newSaveCampaign = `window.saveCampaign = () => {
    logToUI("saveCampaign started");
    initCampaignsState();
    const form = by("#campaignForm");
    if (!form.reportValidity()) {
      logToUI("Form validation failed");
      return;
    }`;

app = app.replace(oldSaveCampaign, newSaveCampaign);
fs.writeFileSync('app.js', app, 'utf8');

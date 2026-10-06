const fs = require('fs');
let app = fs.readFileSync('app.js', 'utf8');

const oldBlock = `document.addEventListener("submit", (e) => { if (e.target.id === "campaignForm") {
      e.preventDefault();
      logToUI("TEST: Campaign form submitted!");
      initCampaignsState();
      const form = e.target;`;

const newBlock = `window.saveCampaign = () => {
      initCampaignsState();
      const form = by("#campaignForm");
      if (!form.reportValidity()) return;`;

app = app.replace(oldBlock, newBlock);

const oldBlockTx = `document.addEventListener("submit", (e) => { if (e.target.id === "campaignTransactionForm") {
      e.preventDefault();
      logToUI("TEST: Campaign TX form submitted!");
      initCampaignsState();
      const form = e.target;`;

const newBlockTx = `window.saveCampaignTx = () => {
      initCampaignsState();
      const form = by("#campaignTransactionForm");
      if (!form.reportValidity()) return;`;

app = app.replace(oldBlockTx, newBlockTx);

// Strip the dangling closing braces
app = app.replace(/render\(\);\s*\/\/ Update dashboard\s*\}\}\);/g, 'render(); // Update dashboard\n    };');

fs.writeFileSync('app.js', app, 'utf8');

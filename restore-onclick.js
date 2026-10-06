const fs = require('fs');

// 1. Modify index.html to add onclick to the save buttons
let html = fs.readFileSync('index.html', 'utf8');
html = html.replace('<button value="default" class="primary">Save campaign</button>', '<button value="default" class="primary" onclick="saveCampaign()">Save campaign</button>');
html = html.replace('<button value="default" class="primary">Save transaction</button>', '<button value="default" class="primary" onclick="saveCampaignTx()">Save transaction</button>');
fs.writeFileSync('index.html', html, 'utf8');

// 2. Modify app.js to define saveCampaign and saveCampaignTx globally
let app = fs.readFileSync('app.js', 'utf8');

// Strip out the broken document submit delegation
const startStr = 'document.addEventListener("submit", (e) => { if (e.target.id === "campaignForm") {';
const startIdx = app.indexOf(startStr);
if (startIdx !== -1) {
  // Find the end of this block. It ends right before `function initCampaignsState()`
  const endIdx = app.indexOf('function initCampaignsState()', startIdx);
  app = app.substring(0, startIdx) + app.substring(endIdx);
}

// Add global save functions
const globalFns = `
  window.saveCampaign = () => {
    logToUI("saveCampaign clicked!");
    initCampaignsState();
    const form = by("#campaignForm");
    if (!form.reportValidity()) {
      logToUI("Validation failed!");
      return;
    }
    if (form.isPrimary.checked) {
      state.campaigns.forEach(c => c.isPrimary = false);
    }
    const c = {
      id: form.id.value || crypto.randomUUID(),
      name: form.name.value,
      type: form.type.value,
      target: num(form.target.value),
      startingBalance: num(form.startingBalance.value),
      targetDate: form.targetDate.value,
      status: form.status.value,
      isPrimary: form.isPrimary.checked,
      note: form.note.value,
      createdAt: new Date().toISOString()
    };
    if (form.id.value) {
      Object.assign(state.campaigns.find(x => x.id === c.id), c);
    } else {
      state.campaigns.push(c);
    }
    by("#campaignDialog").close();
    save();
    logToUI("Campaign saved successfully!");
    render();
  };

  window.saveCampaignTx = () => {
    logToUI("saveCampaignTx clicked!");
    initCampaignsState();
    const form = by("#campaignTransactionForm");
    if (!form.reportValidity()) {
      logToUI("Validation failed!");
      return;
    }
    const cid = form.campaignId.value;
    state.campaignTransactions.push({
      id: crypto.randomUUID(),
      campaignId: cid,
      date: form.date.value,
      amount: num(form.amount.value),
      direction: form.direction.value,
      note: form.note.value,
      createdAt: new Date().toISOString()
    });
    by("#campaignTransactionDialog").close();
    save();
    logToUI("Transaction saved successfully!");
    render();
  };
`;

app = app.replace('// Global functions for inline HTML event handlers', globalFns + '\n  // Global functions for inline HTML event handlers');

fs.writeFileSync('app.js', app, 'utf8');

const fs = require('fs');
let app = fs.readFileSync('app.js', 'utf8');

// The first block
const block1Start = 'document.addEventListener("submit", (e) => { if (e.target.id === "campaignForm") {';
const block1End = 'render(); // Update dashboard\n  }});';

const i1 = app.indexOf(block1Start);
const e1 = app.indexOf(block1End, i1);
if (i1 !== -1 && e1 !== -1) {
  app = app.substring(0, i1) + app.substring(e1 + block1End.length);
}

// The second block
const block2Start = 'document.addEventListener("submit", (e) => { if (e.target.id === "campaignTransactionForm") {';
const block2End = 'render(); // Update dashboard\n  }});';

const i2 = app.indexOf(block2Start);
const e2 = app.indexOf(block2End, i2);
if (i2 !== -1 && e2 !== -1) {
  app = app.substring(0, i2) + app.substring(e2 + block2End.length);
}

// Add the global save functions
const globalFns = `
  window.saveCampaign = () => {
    initCampaignsState();
    const form = by("#campaignForm");
    if (!form.reportValidity()) return;
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
    renderCampaignsList();
    if(!by("#campaignDetailOutput").hidden) renderCampaignDetail(c.id);
    render();
  };

  window.saveCampaignTx = () => {
    initCampaignsState();
    const form = by("#campaignTransactionForm");
    if (!form.reportValidity()) return;
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
    renderCampaignDetail(cid);
    render();
  };
`;

app = app.replace('// Global functions for inline HTML event handlers', globalFns + '\n  // Global functions for inline HTML event handlers');

fs.writeFileSync('app.js', app, 'utf8');

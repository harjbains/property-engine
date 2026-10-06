const fs = require('fs');
let app = fs.readFileSync('app.js', 'utf8');

// Remove the document submit delegation for campaigns
const regex = /document\.addEventListener\("submit",\s*\(e\)\s*=>\s*\{\s*if\s*\(e\.target\.id\s*===\s*"campaignForm"\)[\s\S]*?by\("#campaignTransactionDialog"\)\.close\(\);\s*save\(\);\s*\}\s*\}\);/;
app = app.replace(regex, '');

// Append direct event listeners to the forms instead!
const directListeners = `
  const cForm = by("#campaignForm");
  if (cForm) {
    cForm.addEventListener("submit", (e) => {
      e.preventDefault();
      logToUI("Campaign form submitted successfully!");
      initCampaignsState();
      const form = e.target;
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
      logToUI("Campaign saved to local memory!");
      render();
    });
  }

  const tForm = by("#campaignTransactionForm");
  if (tForm) {
    tForm.addEventListener("submit", (e) => {
      e.preventDefault();
      logToUI("Transaction form submitted successfully!");
      initCampaignsState();
      const form = e.target;
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
      logToUI("Transaction saved to local memory!");
      render();
    });
  }
`;

app = app.replace('// Global functions for inline HTML event handlers', directListeners + '\n  // Global functions for inline HTML event handlers');

fs.writeFileSync('app.js', app, 'utf8');

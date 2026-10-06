const fs = require('fs');

const code = `
// Campaigns logic
function initCampaignsState() {
  if (!state.campaigns) state.campaigns = [];
  if (!state.campaignTransactions) state.campaignTransactions = [];
}

function calculateCampaign(c) {
  const txs = state.campaignTransactions.filter(t => t.campaignId === c.id).sort((a,b) => a.date.localeCompare(b.date));
  let balance = num(c.startingBalance);
  
  txs.forEach(t => {
    if (c.type === 'build_up') {
      balance += t.direction === 'add' ? num(t.amount) : -num(t.amount);
    } else {
      balance += t.direction === 'add' ? -num(t.amount) : num(t.amount);
    }
  });

  const target = num(c.target);
  let progress = 0;
  let remaining = 0;
  
  if (c.type === 'build_up') {
    remaining = Math.max(0, target - balance);
    progress = target > 0 ? Math.min(100, Math.max(0, (balance / target) * 100)) : 0;
  } else {
    remaining = Math.max(0, balance - target);
    const start = num(c.startingBalance);
    if (start > target) {
      progress = Math.min(100, Math.max(0, ((start - balance) / (start - target)) * 100));
    } else {
      progress = balance <= target ? 100 : 0;
    }
  }

  // Calculate monthly requirement and estimate
  let requiredMonthly = null;
  let estimatedCompletion = null;

  if (c.targetDate && remaining > 0) {
    const today = new Date();
    const targetD = new Date(c.targetDate);
    let months = (targetD.getFullYear() - today.getFullYear()) * 12 + (targetD.getMonth() - today.getMonth());
    if (months <= 0) months = 1;
    requiredMonthly = remaining / months;
  }

  if (txs.length > 0 && remaining > 0) {
    const firstDate = new Date(txs[0].date);
    const today = new Date();
    const days = (today - firstDate) / (1000 * 60 * 60 * 24);
    if (days > 14) {
      const progressAmount = (c.type === 'build_up') ? (balance - num(c.startingBalance)) : (num(c.startingBalance) - balance);
      if (progressAmount > 0) {
        const ratePerDay = progressAmount / days;
        const daysLeft = remaining / ratePerDay;
        const estDate = new Date(today.getTime() + daysLeft * 24 * 60 * 60 * 1000);
        estimatedCompletion = estDate.toISOString().slice(0, 10);
      }
    }
  }

  return { ...c, balance, txs, remaining, progress, requiredMonthly, estimatedCompletion };
}

function renderCampaignsList() {
  const out = by("#campaignsListOutput");
  if (!out) return;
  initCampaignsState();
  
  if (!state.campaigns.length) {
    out.innerHTML = \`<div style="grid-column: 1/-1; text-align:center; padding: 40px; color: var(--muted); border: 1px dashed var(--line); border-radius: 10px;">No campaigns created yet. Click "Create campaign" to start tracking a financial goal.</div>\`;
    return;
  }

  const html = state.campaigns.map(c => {
    const data = calculateCampaign(c);
    const badges = [];
    if (data.isPrimary) badges.push('<span class="badge primary">Primary</span>');
    if (data.status === 'completed') badges.push('<span class="badge" style="background:#dcfce7;color:#047857;">Completed</span>');
    else if (data.status === 'paused') badges.push('<span class="badge" style="background:#fef9c3;color:#854d0e;">Paused</span>');

    return \`
      <div class="campaign-card" data-campaign-id="\${data.id}">
        <div class="campaign-card-head">
          <h3>\${auditEscape(data.name)}</h3>
          <div style="display:flex;gap:4px;">\${badges.join('')}</div>
        </div>
        <div class="campaign-metrics">
          <div class="campaign-metric">
            <span>Current Balance</span>
            <strong>\${money.format(data.balance)}</strong>
          </div>
          <div class="campaign-metric">
            <span>Target</span>
            <strong>\${money.format(data.target)}</strong>
          </div>
        </div>
        <div class="campaign-progress-bar">
          <div class="campaign-progress-fill \${data.type.replace('_','-')}" style="width: \${data.progress}%"></div>
        </div>
        <div class="campaign-progress-text">
          <span>\${Math.round(data.progress)}%</span>
          <span>\${money.format(data.remaining)} left</span>
        </div>
      </div>
    \`;
  }).join('');
  out.innerHTML = html;
}

function renderCampaignDetail(id) {
  const out = by("#campaignDetailOutput");
  const list = by("#campaignsListOutput");
  const intro = by(".view[data-panel='campaigns'] .section-intro");
  
  if (!id) {
    out.hidden = true;
    list.hidden = false;
    intro.hidden = false;
    return;
  }

  const raw = state.campaigns.find(c => c.id === id);
  if (!raw) { renderCampaignsList(); renderCampaignDetail(null); return; }
  
  const data = calculateCampaign(raw);
  
  out.hidden = false;
  list.hidden = true;
  intro.hidden = true;

  // Build basic chart data (balance over time)
  let currentBal = num(data.startingBalance);
  const chartPoints = [{ label: 'Start', bal: currentBal }];
  
  // Group by month
  const monthGroups = {};
  data.txs.forEach(t => {
    const m = t.date.slice(0, 7);
    if (!monthGroups[m]) monthGroups[m] = [];
    monthGroups[m].push(t);
  });
  
  Object.keys(monthGroups).sort().forEach(m => {
    monthGroups[m].forEach(t => {
      if (data.type === 'build_up') {
        currentBal += t.direction === 'add' ? num(t.amount) : -num(t.amount);
      } else {
        currentBal += t.direction === 'add' ? -num(t.amount) : num(t.amount);
      }
    });
    const d = new Date(m + "-01");
    chartPoints.push({ label: d.toLocaleDateString('en-GB', { month:'short', year:'2-digit' }), bal: currentBal });
  });

  const maxBal = Math.max(num(data.startingBalance), num(data.target), ...chartPoints.map(p => p.bal));
  const minBal = Math.min(num(data.startingBalance), num(data.target), ...chartPoints.map(p => p.bal), 0);
  const range = (maxBal - minBal) || 1;

  const chartHtml = chartPoints.map(p => {
    const pct = Math.max(2, ((p.bal - minBal) / range) * 100);
    return \`
      <div class="campaign-chart-bar-wrap">
        <div class="campaign-chart-bar" style="height: \${pct}%" title="\${p.label}: \${money.format(p.bal)}"></div>
        <div class="campaign-chart-label">\${p.label}</div>
      </div>
    \`;
  }).join('');

  const estHtml = data.estimatedCompletion ? new Date(data.estimatedCompletion).toLocaleDateString('en-GB', {month:'short', year:'numeric'}) : 'Need more data';
  const reqHtml = data.requiredMonthly ? money.format(data.requiredMonthly) + '/mo' : 'N/A';
  const targetDateHtml = data.targetDate ? new Date(data.targetDate).toLocaleDateString('en-GB', {month:'short', year:'numeric'}) : 'None';

  out.innerHTML = \`
    <div class="campaign-detail-header">
      <div class="campaign-detail-title">
        <button class="ghost" onclick="renderCampaignDetail(null)" style="padding:0; margin-bottom:10px; font-weight:700;">&larr; Back to Campaigns</button>
        <h2>\${auditEscape(data.name)}</h2>
        <p>\${data.type === 'build_up' ? 'Build up goal' : 'Pay down goal'} \${data.isPrimary ? ' · Primary Campaign' : ''}</p>
      </div>
      <div class="campaign-detail-actions">
        <button class="ghost" onclick="editCampaign('\${data.id}')">Edit settings</button>
      </div>
    </div>

    <div class="campaign-stats-grid">
      <div class="campaign-stat-box"><span>Current Balance</span><strong>\${money.format(data.balance)}</strong></div>
      <div class="campaign-stat-box"><span>Target Amount</span><strong>\${money.format(data.target)}</strong></div>
      <div class="campaign-stat-box"><span>Remaining</span><strong>\${money.format(data.remaining)}</strong></div>
      <div class="campaign-stat-box"><span>Progress</span><strong>\${Math.round(data.progress)}%</strong></div>
      <div class="campaign-stat-box"><span>Target Date</span><strong>\${targetDateHtml}</strong></div>
      <div class="campaign-stat-box"><span>Required Rate</span><strong>\${reqHtml}</strong></div>
      <div class="campaign-stat-box"><span>Est. Completion</span><strong>\${estHtml}</strong></div>
    </div>

    <div class="campaign-chart-container">
      <p class="eyebrow" style="margin-top:0;">PROGRESS HISTORY</p>
      <div class="campaign-chart">\${chartHtml}</div>
    </div>

    <div class="campaign-ledger">
      <div class="pane-head" style="padding: 16px 16px 0;">
        <h3>Transaction ledger</h3>
        <div class="cashflow-actions">
          <button class="ghost" onclick="openCampaignTx('\${data.id}', 'remove')">Remove money</button>
          <button class="primary" onclick="openCampaignTx('\${data.id}', 'add')">Add money</button>
        </div>
      </div>
      <div class="tax-workspace-table spending-table" style="max-height: 400px; border:none; border-top:1px solid var(--line); border-radius:0; margin-top:16px;">
        <div class="tax-workspace-row header" style="grid-template-columns: 100px 1fr 100px 80px;">
          <span>Date</span><span>Note</span><span>Amount</span><span>Actions</span>
        </div>
        \${data.txs.length ? data.txs.map(t => \`
          <div class="tax-workspace-row" style="grid-template-columns: 100px 1fr 100px 80px;">
            <span>\${new Date(t.date).toLocaleDateString('en-GB')}</span>
            <span>\${auditEscape(t.note) || (t.direction === 'add' ? 'Added funds' : 'Removed funds')}</span>
            <strong class="\${t.direction === 'add' ? 'positive' : 'negative'}">\${t.direction === 'add' ? '+' : '-'}\${money.format(t.amount)}</strong>
            <span class="cash-row-actions"><button class="ghost danger" onclick="deleteCampaignTx('\${t.id}')">Delete</button></span>
          </div>
        \`).reverse().join('') : '<div style="padding:20px; text-align:center; color:var(--muted); font-size:12px;">No transactions recorded.</div>'}
      </div>
    </div>
  \`;
}

// Global functions for inline HTML event handlers
window.editCampaign = (id) => {
  const c = state.campaigns.find(x => x.id === id);
  if (!c) return;
  const form = by("#campaignForm");
  form.id.value = c.id;
  form.name.value = c.name;
  form.type.value = c.type;
  form.target.value = c.target;
  form.startingBalance.value = c.startingBalance;
  form.targetDate.value = c.targetDate || '';
  form.status.value = c.status;
  form.isPrimary.checked = c.isPrimary;
  form.note.value = c.note || '';
  by("#campaignDialogTitle").textContent = "Edit campaign";
  by("#campaignDialog").showModal();
};

window.openCampaignTx = (id, defaultDir) => {
  const form = by("#campaignTransactionForm");
  form.reset();
  form.campaignId.value = id;
  form.date.value = new Date().toISOString().slice(0, 10);
  form.direction.value = defaultDir;
  by("#campaignTransactionDialog").showModal();
};

window.deleteCampaignTx = (id) => {
  if (!confirm("Delete this transaction?")) return;
  state.campaignTransactions = state.campaignTransactions.filter(t => t.id !== id);
  save();
  const c = state.campaigns.find(x => x.id === by("#campaignTransactionForm").campaignId.value) || state.campaigns[0];
  if(by("#campaignDetailOutput").hidden === false && by("#campaignDetailOutput").innerHTML.includes("campaign-detail-header")) {
     // Re-render detail if open
     const activeId = state.campaignTransactions.find(t => t.id === id)?.campaignId; // Actually we just deleted it so we can't find it.
     renderCampaignDetail(state.campaigns.find(c => by("#campaignDetailOutput").innerHTML.includes(auditEscape(c.name)))?.id);
  }
};

document.addEventListener("DOMContentLoaded", () => {
  by("#createCampaignBtn")?.addEventListener("click", () => {
    by("#campaignForm").reset();
    by("#campaignForm").id.value = "";
    by("#campaignDialogTitle").textContent = "Create campaign";
    by("#campaignDialog").showModal();
  });

  by("#campaignForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
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
    renderCampaignsList();
    if(!by("#campaignDetailOutput").hidden) renderCampaignDetail(c.id);
    render(); // Update dashboard
  });

  by("#campaignTransactionForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
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
    renderCampaignDetail(cid);
    render(); // Update dashboard
  });

  by("#campaignsListOutput")?.addEventListener("click", e => {
    const card = e.target.closest(".campaign-card");
    if (card) renderCampaignDetail(card.dataset.campaignId);
  });
});
`;

fs.writeFileSync('campaigns.js', code, 'utf8');

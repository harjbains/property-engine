const fs = require('fs');
let app = fs.readFileSync('app.js', 'utf8');

const regex = /let campCard = "";[\s\S]*?return renderTaxWorkspaceBase\(\)\.replace\('<div class="cashflow-cards">', '<div class="cashflow-cards">'\ \+\ campCard\)/;

const newLogic = `
  let campCard = "";
  if (state.campaigns && state.campaigns.length > 0) {
    if (typeof window.currentCampaignIndex === "undefined") {
      const pIdx = state.campaigns.findIndex(c => c.isPrimary);
      window.currentCampaignIndex = pIdx >= 0 ? pIdx : 0;
    }
    if (window.currentCampaignIndex >= state.campaigns.length) window.currentCampaignIndex = 0;
    
    const pc = state.campaigns[window.currentCampaignIndex];
    const pcd = calculateCampaign(pc);
    const estCompletion = pcd.estimatedCompletion ? new Date(pcd.estimatedCompletion).toLocaleDateString("en-GB", {month:"short", year:"numeric"}) : "N/A";
    
    const cycleFn = state.campaigns.length > 1 
      ? "window.currentCampaignIndex = (window.currentCampaignIndex + 1) % " + state.campaigns.length + "; render();"
      : "show('campaigns'); renderCampaignDetail('" + pcd.id + "');";
      
    campCard = '<div class="campaign-summary-card" style="border:1px solid #c084fc; background:#faf5ff; border-radius:10px; padding:14px; cursor:pointer; user-select:none; transition: background 0.2s;" onmousedown="this.style.background=\\'#f3e8ff\\'" onmouseup="this.style.background=\\'#faf5ff\\'" onmouseleave="this.style.background=\\'#faf5ff\\'" onclick="' + cycleFn + '"><span>Campaign ' + (window.currentCampaignIndex + 1) + ' of ' + state.campaigns.length + ' &mdash; ' + auditEscape(pcd.name) + '</span><strong style="color:#7e22ce;">' + money.format(pcd.balance) + '</strong><small style="display:flex; justify-content:space-between; margin-top:5px; color:#9333ea; font-size:10px; font-weight:700;"><span>Target: ' + money.format(pcd.target) + '</span><span>Prog: ' + Math.round(pcd.progress) + '%</span><span>Est: ' + estCompletion + '</span></small></div>';
  }
  return renderTaxWorkspaceBase().replace('<div class="cashflow-cards">', '<div class="cashflow-cards">' + campCard)
`.trim();

app = app.replace(regex, newLogic);
fs.writeFileSync('app.js', app, 'utf8');

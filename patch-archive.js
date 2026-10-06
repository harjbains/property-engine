const fs = require('fs');
let app = fs.readFileSync('app.js', 'utf8');

// Add Archived badge
app = app.replace(
  "else if (data.status === 'paused') badges.push('<span class=\"badge\" style=\"background:#fef9c3;color:#854d0e;\">Paused</span>');",
  "else if (data.status === 'paused') badges.push('<span class=\"badge\" style=\"background:#fef9c3;color:#854d0e;\">Paused</span>');\n    else if (data.status === 'archived') badges.push('<span class=\"badge\" style=\"background:#fee2e2;color:#991b1b;\">Archived</span>');"
);

// Update Dashboard Card Cycler to filter out archived
const cycleRegex = /let campCard = "";\s*if \(state\.campaigns && state\.campaigns\.length > 0\) \{[\s\S]*?return renderTaxWorkspaceBase\(\)\.replace\('<div class="cashflow-cards">', '<div class="cashflow-cards">'\ \+\ campCard\)/;

const newCycle = `
  let campCard = "";
  const visibleCampaigns = (state.campaigns || []).filter(c => c.status !== 'archived');
  if (visibleCampaigns.length > 0) {
    if (typeof window.currentCampaignIndex === "undefined") {
      const pIdx = visibleCampaigns.findIndex(c => c.isPrimary);
      window.currentCampaignIndex = pIdx >= 0 ? pIdx : 0;
    }
    if (window.currentCampaignIndex >= visibleCampaigns.length) window.currentCampaignIndex = 0;
    
    const pc = visibleCampaigns[window.currentCampaignIndex];
    const pcd = calculateCampaign(pc);
    const estCompletion = pcd.estimatedCompletion ? new Date(pcd.estimatedCompletion).toLocaleDateString("en-GB", {month:"short", year:"numeric"}) : "N/A";
    
    const cycleFn = visibleCampaigns.length > 1 
      ? "window.currentCampaignIndex = (window.currentCampaignIndex + 1) % " + visibleCampaigns.length + "; render();"
      : "show('campaigns'); renderCampaignDetail('" + pcd.id + "');";
      
    campCard = '<div class="campaign-summary-card" style="border:1px solid #c084fc; background:#faf5ff; border-radius:10px; padding:14px; cursor:pointer; user-select:none; transition: background 0.2s;" onmousedown="this.style.background=\\'#f3e8ff\\'" onmouseup="this.style.background=\\'#faf5ff\\'" onmouseleave="this.style.background=\\'#faf5ff\\'" onclick="' + cycleFn + '"><span>Campaign ' + (window.currentCampaignIndex + 1) + ' of ' + visibleCampaigns.length + ' &mdash; ' + auditEscape(pcd.name) + '</span><strong style="color:#7e22ce;">' + money.format(pcd.balance) + '</strong><small style="display:flex; justify-content:space-between; margin-top:5px; color:#9333ea; font-size:10px; font-weight:700;"><span>Target: ' + money.format(pcd.target) + '</span><span>Prog: ' + Math.round(pcd.progress) + '%</span><span>Est: ' + estCompletion + '</span></small></div>';
  }
  return renderTaxWorkspaceBase().replace('<div class="cashflow-cards">', '<div class="cashflow-cards">' + campCard)
`.trim();

app = app.replace(cycleRegex, newCycle);
fs.writeFileSync('app.js', app, 'utf8');

const fs = require('fs');

// 1. Add script to index.html
let html = fs.readFileSync('index.html', 'utf8');
html = html.replace('<script src="supabase-sync.js?v=8"></script>', '<script src="campaigns.js?v=1"></script><script src="supabase-sync.js?v=8"></script>');
fs.writeFileSync('index.html', html, 'utf8');

// 2. Patch app.js to render primary campaign on dashboard
let app = fs.readFileSync('app.js', 'utf8');
const overrideRegex = /const renderTaxWorkspaceBase=renderTaxWorkspace;renderTaxWorkspace=function\(\)\{.*?;return renderTaxWorkspaceBase\(\)\.replace\(.*?\);};/;

// Extract existing override to re-apply it properly, then inject campaign card logic
let match = app.match(overrideRegex);
if(match) {
  let oldOverride = match[0];
  let newOverride = oldOverride.replace('return renderTaxWorkspaceBase()', `
  let campCard = "";
  if (state.campaigns) {
    const pc = state.campaigns.find(c => c.isPrimary);
    if (pc) {
      const pcd = calculateCampaign(pc);
      const estCompletion = pcd.estimatedCompletion ? new Date(pcd.estimatedCompletion).toLocaleDateString('en-GB', {month:'short', year:'numeric'}) : 'N/A';
      campCard = \`<div class="campaign-summary-card" style="border:1px solid #c084fc; background:#faf5ff; border-radius:10px; padding:14px; cursor:pointer;" onclick="show('campaigns'); renderCampaignDetail('\${pcd.id}');"><span>Current Campaign &mdash; \${auditEscape(pcd.name)}</span><strong style="color:#7e22ce;">\${money.format(pcd.balance)}</strong><small style="display:flex; justify-content:space-between; margin-top:5px; color:#9333ea; font-size:10px; font-weight:700;"><span>Target: \${money.format(pcd.target)}</span><span>Prog: \${Math.round(pcd.progress)}%</span><span>Est: \${estCompletion}</span></small></div>\`;
    }
  }
  return renderTaxWorkspaceBase().replace('<div class="cashflow-cards">', '<div class="cashflow-cards">' + campCard)
  `);
  app = app.replace(overrideRegex, newOverride);
}

// 3. Patch the show() function router to handle "campaigns"
app = app.replace(/campaigns:"Campaigns",/, ''); // remove if exists
app = app.replace(/dashboard:"Banking",/, 'dashboard:"Banking",campaigns:"Campaigns",');
app = app.replace(/function show\(n\)\{/, 'function show(n){ if(n==="campaigns") { typeof renderCampaignsList !== "undefined" && renderCampaignsList(); }');

fs.writeFileSync('app.js', app, 'utf8');

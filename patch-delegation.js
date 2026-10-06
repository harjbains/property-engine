const fs = require('fs');
let app = fs.readFileSync('app.js', 'utf8');

// Replace inline handlers
app = app.replace(/onclick="renderCampaignDetail\(null\)"/g, 'data-campaign-action="back"');
app = app.replace(/onclick="editCampaign\('([^']+)'\)"/g, 'data-campaign-action="edit" data-id="$1"');
app = app.replace(/onclick="openCampaignTx\('([^']+)', 'remove'\)"/g, 'data-campaign-action="remove-tx" data-id="$1"');
app = app.replace(/onclick="openCampaignTx\('([^']+)', 'add'\)"/g, 'data-campaign-action="add-tx" data-id="$1"');
app = app.replace(/onclick="deleteCampaignTx\('([^']+)'\)"/g, 'data-campaign-action="delete-tx" data-id="$1"');

// Inject the delegation listener right before the end
const listener = `
document.addEventListener("click", e => {
  const btn = e.target.closest("[data-campaign-action]");
  if (!btn) return;
  const action = btn.dataset.campaignAction;
  const id = btn.dataset.id;
  
  if (action === "back") {
    renderCampaignDetail(null);
  } else if (action === "edit") {
    if (typeof window.editCampaign === "function") window.editCampaign(id);
  } else if (action === "remove-tx") {
    if (typeof window.openCampaignTx === "function") window.openCampaignTx(id, 'remove');
  } else if (action === "add-tx") {
    if (typeof window.openCampaignTx === "function") window.openCampaignTx(id, 'add');
  } else if (action === "delete-tx") {
    if (typeof window.deleteCampaignTx === "function") window.deleteCampaignTx(id);
  }
});
`;

if (!app.includes('data-campaign-action')) {
  app = app.replace(/\n\)\(\);\s*$/, '\n' + listener + '\n})();');
  fs.writeFileSync('app.js', app, 'utf8');
  console.log("Patched inline handlers with delegation.");
} else {
  console.log("Already patched.");
}

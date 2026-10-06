const fs = require('fs');
let app = fs.readFileSync('app.js', 'utf8');

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

if (!app.includes('action === "back"')) {
  app = app.replace(/\}\)\(\);[\s\r\n]*$/, '\n' + listener + '\n})();\n');
  fs.writeFileSync('app.js', app, 'utf8');
  console.log("Appended listener successfully.");
} else {
  console.log("Already appended.");
}

const fs = require('fs');
let app = fs.readFileSync('app.js', 'utf8');

// 1. Change the campCard HTML to use data-campaign-action="cycle" instead of onclick
app = app.replace(
  /'\ \+\ cycleFn\ \+\ '"/g, // This matches onclick="' + cycleFn + '"
  'cycle"'
);
app = app.replace(/onclick="cycle"/g, 'data-campaign-action="cycle"');

// 2. Add the cycle logic to the event delegation listener
const oldListener = `  if (action === "back") {`;
const newListener = `  if (action === "cycle") {
    const visibleCampaigns = (state.campaigns || []).filter(c => c.status !== 'archived');
    if (visibleCampaigns.length > 1) {
      window.currentCampaignIndex = (window.currentCampaignIndex + 1) % visibleCampaigns.length;
      render();
    } else if (visibleCampaigns.length === 1) {
      show('campaigns');
      renderCampaignDetail(visibleCampaigns[0].id);
    }
  } else if (action === "back") {`;

if (app.includes(oldListener)) {
  app = app.replace(oldListener, newListener);
  fs.writeFileSync('app.js', app, 'utf8');
  console.log("Patched cycler with event delegation.");
} else {
  console.log("Could not find listener to patch.");
}

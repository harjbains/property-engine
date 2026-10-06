const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');
// Fix campaignForm
html = html.replace('<form method="dialog" id="campaignForm">', '<form id="campaignForm" onsubmit="event.preventDefault(); saveCampaign();">');
html = html.replace('<button value="default" class="primary" onclick="saveCampaign()">Save campaign</button>', '<button type="submit" class="primary">Save campaign</button>');

// Fix campaignTransactionForm
html = html.replace('<form method="dialog" id="campaignTransactionForm">', '<form id="campaignTransactionForm" onsubmit="event.preventDefault(); saveCampaignTx();">');
html = html.replace('<button value="default" class="primary" onclick="saveCampaignTx()">Save transaction</button>', '<button type="submit" class="primary">Save transaction</button>');

fs.writeFileSync('index.html', html, 'utf8');

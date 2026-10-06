const fs = require('fs');
let app = fs.readFileSync('app.js', 'utf8');

// Replace standard attach with document delegation
const oldFormHandler = `by("#campaignForm")?.addEventListener("submit", (e) => {`;
const newFormHandler = `document.addEventListener("submit", (e) => { if (e.target.id === "campaignForm") {`;
app = app.replace(oldFormHandler, newFormHandler);

const oldTxHandler = `by("#campaignTransactionForm")?.addEventListener("submit", (e) => {`;
const newTxHandler = `} if (e.target.id === "campaignTransactionForm") {`;
app = app.replace(oldTxHandler, newTxHandler);

// Close the if blocks properly. 
// We know where they end because they are followed by other things.
// Wait, it's safer to just replace the whole block.

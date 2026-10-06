const fs = require('fs');
let app = fs.readFileSync('app.js', 'utf8');

const target = 'for(const k of["employment","uber","properties","propertyIncome","propertyExpenses","rentChanges","pension","payments"])base[k]=saved[k]||[];';
const replacement = 'for(const k of["employment","uber","properties","propertyIncome","propertyExpenses","rentChanges","pension","payments","campaigns","campaignTransactions"])base[k]=saved[k]||[];';

app = app.replace(target, replacement);

fs.writeFileSync('app.js', app, 'utf8');

const fs = require('fs');
let app = fs.readFileSync('app.js', 'utf8');

const oldSave = `function save(){localStorage.setItem(KEY,JSON.stringify(state));}`;
const newSave = `function save(){alert("TEST: app.js save() called!");localStorage.setItem(KEY,JSON.stringify(state));}`;
app = app.replace(oldSave, newSave);

fs.writeFileSync('app.js', app, 'utf8');

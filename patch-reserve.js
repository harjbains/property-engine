const fs = require('fs');
let app = fs.readFileSync('app.js', 'utf8');

app = app.replace('fundedStart=num(s.hmrc.reserve),', 'fundedStart=currentYearProvisionHeld(),');

fs.writeFileSync('app.js', app, 'utf8');

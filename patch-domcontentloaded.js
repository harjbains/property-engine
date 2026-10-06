const fs = require('fs');
let app = fs.readFileSync('app.js', 'utf8');

if (app.includes('document.addEventListener("DOMContentLoaded", () => {')) {
  app = app.replace('document.addEventListener("DOMContentLoaded", () => {', '// removed DOMContentLoaded');
  
  // Find the closing });
  // It's right before `\n})();` at the end of the file
  app = app.replace(/\}\);\s*\}\)\(\);\s*$/, '\n})();');
  
  fs.writeFileSync('app.js', app, 'utf8');
  console.log("Removed DOMContentLoaded wrapper");
} else {
  console.log("Not found");
}

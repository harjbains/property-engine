const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

// 1. Rename "Tax Provision" to "Banking" and force "cashflow" tab
code = code.replace(/dashboard:"Tax Provision"/g, 'dashboard:"Banking"');
code = code.replace(/taxWorkspaceTab="payslip"/g, 'taxWorkspaceTab="cashflow"');
code = code.replace(/render\(\);\s*\}\)\(\);/g, 'dashboardView = "actual"; taxWorkspaceTab = "cashflow"; render();})();');

// 2. Remove funding UI
code = code.replace(/function renderCurrentAccruedTaxPosition\(\)\{.*?\}/g, 'function renderCurrentAccruedTaxPosition(){}');

// 3. Rename Zempler to Lloyds, remove old Lloyds card
code = code.replace(/<span>Zempler balance<\/span>/g, '<span>Lloyds balance</span>');
code = code.replace(/<div class="lloyds"><span>Lloyds balance<\/span><strong>\$\{money\.format\(s\.lloyds\)\}<\/strong><\/div>/g, '');

// 4. Update the renderTaxWorkspaceBase override
const overrideRegex = /const renderTaxWorkspaceBase=renderTaxWorkspace;renderTaxWorkspace=function\(\)\{const x=cashflowState.*?;\};/;

const newOverride = `
const renderTaxWorkspaceBase=renderTaxWorkspace;renderTaxWorkspace=function(){const x=cashflowState(),s=cashflowSummary(x),source=s.taxDueOverridden?"Manual":workspaceMonthLabel(previousCashflowMonth(x.month)).split(" ")[0],outDue=s.fixedUnpaid+s.plannedUnpaid,netDue=s.incomeExpected-outDue,dueCard=\`<div class="transactions-due"><span>Transactions due</span><strong class="\${netDue<0?"negative":"positive"}">\${netDue>=0?"+":"-"}\${money.format(Math.abs(netDue))}</strong><small class="due-card-meta"><span><em>In</em><b>+\${money.format(s.incomeExpected)}</b></span><span><em>Out</em><b>-\${money.format(outDue)}</b></span></small></div>\`,clearedCount=s.cleared+(x.income||[]).filter(i=>i.section==="fixed"&&i.status==="Received").length,totalCount=x.fixed.length+(x.income||[]).filter(i=>i.section==="fixed").length,fixedProgressCard=\`<div class="fixed-progress"><span>Fixed outgoings</span><strong>\${clearedCount}/\${totalCount} cleared</strong><small class="due-card-meta" style="margin-top:4px;display:flex;gap:10px;"><span><em>Paid</em><b>\${money.format(s.fixedPaid)}</b></span><span><em>Left</em><b>\${money.format(s.fixedUnpaid)}</b></span></small></div>\`;return renderTaxWorkspaceBase().replace(\`<div><span>Fixed costs still to leave</span><strong>\${money.format(s.fixedUnpaid)}</strong></div>\`,\`\${fixedProgressCard}\${dueCard}\`).replace(\`<div><span>Planned spend left</span><strong>\${money.format(s.plannedUnpaid)}</strong></div>\`,"").replace(/<button class="ghost" data-cash-action="add-planned"[^>]*>Add planned expenditure<\\/button>/,"").replace("Fixed-cost checklist","Fixed outgoings").replace(/<p>\\d+ of \\d+ items cleared - [^<]+ paid - [^<]+ still to leave<\\/p>/,"").replace('<button class="ghost" data-cash-action="add-fixed"','<button class="ghost" data-cash-action="copy-previous-fixed">Copy prior costs &amp; rents</button><button class="ghost" data-cash-action="add-fixed"');};
`.trim();

code = code.replace(overrideRegex, newOverride);

fs.writeFileSync('app.js', code, 'utf8');

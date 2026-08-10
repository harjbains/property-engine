(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;else root.AbraTaxExport=api;})(typeof globalThis!=="undefined"?globalThis:this,function(){
  const round=value=>Math.round((Number(value)||0)*100)/100;
  const blank=length=>Array(length).fill("");
  const row=(length,...values)=>{const result=blank(length);for(let index=0;index<values.length;index+=2)result[values[index]]=values[index+1];return result;};
  const csvCell=value=>{const text=String(value??"");return /[",\r\n]/.test(text)?`"${text.replaceAll('"','""')}"`:text;};
  const toCsv=rows=>`\uFEFF${rows.map(columns=>columns.map(csvCell).join(",")).join("\r\n")}`;

  function selfEmploymentRows(values={}){
    const v={turnover:0,otherIncome:0,taxTakenOff:0,carTravel:0,admin:0,otherExpenses:0,...values},rows=[];
    rows.push(row(10,0,"SELF EMPLOYMENT MTD BRIDGING TEMPLATE - ABRATAX ",8,"INSTRUCTIONS"));
    rows.push(row(10,0,"Template version: SE-1.0.0 (read only - must be present)"));
    rows.push(row(10,8,"1)",9,"Add this tab to your excel business working file (your digital records)"));
    rows.push(row(10,0,"INCOME",1,"AMOUNT (£)",8,"2)\n",9,"For each of the coloured boxes, create a formula link to the corresponding business box in your working file. Any nil values should be populated with a 0, or the cell left blank."));
    rows.push(row(10,0,"Turnover / sales income",1,round(v.turnover),3,"Cumulative income for the period being submitted"));
    rows.push(row(10,0,"Other business income",1,round(v.otherIncome),8,"3)",9,'Once complete, right click on the "abratax_mtd_import" tab at the bottom of this sheet and select "Move or Copy..."'));
    rows.push(row(10,0,"Tax taken off trading income",1,round(v.taxTakenOff),8,"4)",9,'Under the "To Book" dropdown, select "(new book)", press OK.'));
    rows.push(row(10,8,"5)",9,"This tab will move to a new worksheet. Save this new worksheet as a CSV file (File -> Save as, file format = CSV ) and import it to AbraTax"));
    rows.push(row(10,0,"SUMMARY EXPENSES"));rows.push(row(10,1,"AMOUNT (£)"));
    rows.push(row(10,0,"Consolidated expenses",3,"If eligible for consolidated expenses, ignore full detail expense boxes below and fill in this single box"));
    rows.push(blank(10));rows.push(row(10,0,"OR"));rows.push(blank(10));
    rows.push(row(10,0,"DETAILED EXPENSES"));rows.push(row(10,1,"ALLOWABLE EXPENSE",5,"DISALLOWABLE EXPENSE "));rows.push(row(10,1,"AMOUNT (£)",5,"AMOUNT (£)"));
    const expenseRows=[
      ["Cost of goods",0,"Direct costs of goods or materials bought and sold as part of your business.","The non-allowable portion of goods or materials costs (for example private use)."],
      ["Payments to subcontractors",0,"Amounts paid to subcontractors (for example under CIS), before tax deductions.","Any subcontractor costs that are not allowable for tax purposes."],
      ["Wages and staff costs",0,"Gross wages, salaries, bonuses, employer NICs and pension contributions.","Staff costs that are not wholly and exclusively for business use."],
      ["Car, van, travel expenses",v.carTravel,"Business mileage, fuel, vehicle running costs, public transport and accommodation for business travel.","Private or non-business portion of travel and vehicle costs."],
      ["Premises running costs",0,"Rent, utilities, business rates, insurance and other running costs for business premises.","Private or non-business use element of premises costs."],
      ["Repairs and maintenance costs",0,"Repairs and maintenance of business premises, vehicles or equipment (not improvements).","Repairs that relate to private use or capital improvements."],
      ["Office, stationery and admin costs",v.admin,"Telephone, internet, stationery, software subscriptions and general office costs.","Office or admin costs not wholly for business use."],
      ["Advertising and marketing",0,"Advertising, website costs, listings and promotional expenses.","Advertising or promotion that is not allowable for tax purposes."],
      ["Business entertainment",0,"Client entertainment costs (note: normally not allowable for tax).","Client entertainment costs (normally fully disallowed)."],
      ["Interest on bank and other loans",0,"Interest on business loans, overdrafts or credit used for the business.","Interest relating to private or non-business borrowing."],
      ["Finance charges",0,"Bank charges, credit card fees and similar finance costs.","Bank or finance charges not incurred wholly for business use."],
      ["Bad debts written off",0,"Trade debts that you do not expect to recover and have written off in this period.","Bad debts that do not meet HMRC conditions for relief."],
      ["Professional fees",0,"Accountancy, legal and other professional fees relating to the business.","Professional fees relating to private or capital matters."],
      ["Depreciation",0,"Accounting depreciation of assets (note: not allowable for tax).","Depreciation is not allowable for tax (capital allowances are used instead)."],
      ["Other business expenses",v.otherExpenses,"Any other allowable business expenses not included above.","Any other expenses that are not allowable for tax purposes."],
    ];
    for(const[label,amount,help,disallowedHelp]of expenseRows)rows.push(row(10,0,label,1,round(amount),3,help,5,0,7,disallowedHelp));
    return rows;
  }

  function propertyRows(values={}){
    const v={rentalIncome:0,rentARoomIncome:0,otherRentalIncome:0,leasePremiums:0,reversePremiums:0,taxDeducted:0,residentialFinance:0,carriedResidentialFinance:0,rentARoomClaim:0,repairs:0,premises:0,services:0,professional:0,travel:0,other:0,financial:0,...values},rows=[];
    rows.push(row(7,0,"UK PROPERTY MTD BRIDGING TEMPLATE - ABRATAX",5,"INSTRUCTIONS"));
    rows.push(row(7,0,"Template version: UKP-1.1.0 (read only - must be present)",5,"1)",6,"Add this tab to your excel property business working file (your digital records)"));
    rows.push(row(7,5,"2)\n",6,"For each of the coloured boxes, create a formula link to the corresponding box in your property business working file. Any nil values can be populated with a 0, or the cell left blank."));
    rows.push(row(7,0,"INCOME",1,"AMOUNT (£)"));
    const income=[
      ["Total rental income for the period",v.rentalIncome,"Include all rents and rental receipts before expenses, not including rent-a-room income."],
      ["Rent-a-Room income (if applicable)",v.rentARoomIncome,"Only complete if you are claiming Rent-a-Room relief."],
      ["Other rental income",v.otherRentalIncome,"Any other income for services provided to tenants. "],
      ["Premiums received for granting a lease",v.leasePremiums,"Lump sums received for granting a lease."],
      ["Reverse premiums paid",v.reversePremiums,"Amount paid by a landlord or outgoing tenant to induce a new tenant to enter into a leasehold agreement. "],
      ["Tax deducted at source",v.taxDeducted,"For example, tax deducted by letting agents or under withholding schemes."],
    ];
    income.forEach(([label,amount,help],index)=>rows.push(row(7,0,label,1,round(amount),3,help,...(index<3?[5,String(index+3)+")",6,index===0?'Once complete, right click on the "abratax_mtd_import" tab at the bottom of this sheet and select "Move or Copy..."':index===1?'Under the "To Book" dropdown, select "(new book)", press OK.':"This tab will move to a new worksheet. Save this new worksheet as a CSV file (File -> Save as, file format = CSV ) and import it to AbraTax"]:[]))));
    rows.push(blank(7));rows.push(row(7,0,"SUMMARY EXPENSES",1,"AMOUNT (£)"));
    rows.push(row(7,0,"Consolidated expenses",3,"If eligible for consolidated expenses, ignore full expense boxes below (under detailed expenses) and fill in this single box"));
    rows.push(row(7,0,"Residential finance costs",3,"The residential financial cost deductible from rental income (tax relief)"));
    rows.push(row(7,0,"Residential financial costs carried forward",3,"Amount of residential financial costs carried forward."));
    rows.push(row(7,0,"Rent-a-room / amounts claimed",3,"The amount of UK Furnished Holiday Lettings rent claimed."));
    rows.push(blank(7));rows.push(row(7,0,"OR"));rows.push(blank(7));rows.push(row(7,0,"DETAILED EXPENSES",1,"AMOUNT (£)"));
    const detail=[
      ["Repairs and maintenance",v.repairs,"Property repairs and maintenance."],["Premises running costs",v.premises,"Rent, rates, insurance, ground rents and other costs."],["Cost of services",v.services,"Cost of services provided, including wages."],["Professional fees",v.professional,"Legal, management and other professional fees. "],["Travel costs",v.travel,"Car, van and travel costs incurred in running a property business."],["Other allowable property expenses",v.other,"Other allowable property expenses."],["Financial cost",v.financial,"Loan interest and other financial costs."],["Residential finance costs",v.residentialFinance,"The residential financial cost deductible from rental income (tax relief)."],["Residential financial costs carried forward",v.carriedResidentialFinance,"Amount of residential financial costs carried forward."],["Rent-a-room / amounts claimed",v.rentARoomClaim,"The amount of UK Furnished Holiday Lettings rent claimed."],
    ];
    for(const[label,amount,help]of detail)rows.push(row(7,0,label,1,round(amount),3,help));
    return rows;
  }
  return{selfEmploymentRows,propertyRows,selfEmploymentCsv:values=>toCsv(selfEmploymentRows(values)),propertyCsv:values=>toCsv(propertyRows(values)),toCsv};
});

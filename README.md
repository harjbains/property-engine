# Tax Engine

Desktop-first UK tax forecasting and MTD-ready digital records for combined sole-trader Uber income, residential property income and pension income.

## Run locally

Serve this folder over HTTP, for example with `python -m http.server 5510`, then open `http://127.0.0.1:5510/`.

The app seeds the requested Wolverhampton planning profile: £8,600 pension income, £32,000 property income, £3,000 property expenses, £3,700 residential finance costs, 52,000 annual Uber business miles and low/mid/high Uber turnover scenarios of £42,000/£55,000/£70,000.

## Calculation model

- Tax-year-aware mileage: 45p/25p for 2025/26 and 55p/25p for 2026/27.
- England and Wales Income Tax bands, Personal Allowance taper and Class 4 NI.
- Residential finance costs handled as a basic-rate tax reduction, not a property-profit deduction.
- HMRC payments reduce the forecast outstanding balance.
- Property and tenancy records store tenant, monthly rent, tenancy dates and deposit separately from transactions.
- Separate ledgers record rent income, rent changes and property expenses; mortgage interest is classified automatically as a finance cost.
- Per-tax-year statutory rule sets can be reset to defaults or copied from the previous year.
- Income modules can be enabled independently; disabled modules retain data while disappearing from calculations, navigation and reports.
- Optional Employment/PAYE, savings, dividends and other-income calculations sit alongside the focused Uber, property and pension defaults.
- HMRC planning supports reserves, catch-up shortfalls, minimum provisions, preferred payment day and configurable rounding.

Run calculation tests with `node tax-engine.test.js`.

This is a planning tool, not tax advice or an HMRC filing product. Payments on account and less-common adjustments are not yet included.

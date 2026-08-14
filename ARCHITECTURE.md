# Tax Engine code boundaries

The browser UI is deliberately separated from calculation, validation, record-processing, export and persistence code.

## Stable internal APIs

- `tax-engine.js` — pure tax and mileage calculations.
- `financial-controls.js` — duplicate and reconciliation checks.
- `property-records.js` — property-expense category normalisation, deduplication and recovery preview/import.
- `abratax-export.js` — pure MTD workbook/export mapping.
- `supabase-sync.js` — persistence adapter; it synchronises application state but does not calculate tax.
- `app.js` — UI orchestration only. It supplies plain records to the APIs and renders their results.

Domain modules must not access the DOM, local storage or Supabase. This keeps their behaviour testable and prevents a UI change from silently changing a financial calculation.

## Change rules

1. Add or change financial behaviour in the relevant domain module first.
2. Add a fixed-answer test for the behaviour.
3. Keep `app.js` responsible for forms and rendering, not duplicate business formulas.
4. Keep Supabase field mapping in the persistence adapter.
5. Run all `*.test.js` files and `app-contract.test.js` before deployment.


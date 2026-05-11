# Uber Property

Uber Property is a lightweight, mobile-first landlord accounting app for small UK portfolios. It focuses on rental income, recurring costs, expense capture, receipt retention, tax-year summaries, and accountant-friendly exports.

## Run locally

Open `index.html` in a browser. The app works immediately with local browser storage and seeded demo data.

## Supabase setup

1. Create a Supabase project.
2. Run `supabase-schema.sql` in the SQL editor.
3. Open the app, go to Settings, and paste your Supabase project URL and anon key.
4. Enable email OTP in Supabase Auth.
5. Review row-level security policies before production use.

Receipts are uploaded to the `receipts` storage bucket when Supabase credentials are configured. Without Supabase, uploaded files are attached as temporary local object URLs for the current browser session.

## v1 scope

- Property setup with rent, tenant, mortgage interest, insurance, and management fee fields.
- Classic Property view with rent ledger, compliance data, tenancy start, rent and deposit details.
- Classic Tenant/Tenancy view with contact details and tenant ledger.
- Recurring monthly and yearly expense generation.
- Recurring transaction management from Add New, including edit and delete controls.
- Settings for default lettings commission as a percentage or fixed monthly fee.
- Rent due generation with property balances for unpaid rent, part payments, arrears, and credits.
- Payment records include received date, rent period, and related rent due date.
- Expense and income capture.
- Mobile camera/PDF receipt upload input.
- Compliance diary for gas safety certificates, electrical certificates, EPCs, renewals, and other expiries.
- Dashboard summary for monthly rent, recurring costs, cashflow, and current tax year.
- Tax-year report using the UK 6 April to 5 April tax year.
- CSV export and printable PDF summary.

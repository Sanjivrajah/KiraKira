# Realistic eight-month demo data

`realistic-eight-month-demo.sql` creates a synthetic but internally consistent
dataset for **Orchid Moon Kitchen Enterprise**, a contemporary Chinese-inspired
catering and meal-prep business. It is intended for product demos, development,
and visual testing;
it must never be applied to a production customer account.

## What it creates

The fixed reporting period is **1 November 2025 through 30 June 2026**. The
seed contains roughly 500 confirmed transactions, 81 invoices, 17 Malaysian
counterparties, seven products/services, and invoice payment allocations. The
data has normal operating variation: weekday ingredient purchases, rent,
utilities, delivery/fuel, packaging, payroll, cash sales, invoices, and a mix
of paid, partially paid, and outstanding receivables.

All people, companies, contacts, and registration values are fictional.

## Import it

1. Create the intended account through the normal Supabase Auth sign-up flow.
2. In `realistic-eight-month-demo.sql`, replace the one occurrence of
   `__OWNER_EMAIL__` with that account's email address.
3. Run the file as a database administrator against the intended **local or
   disposable development** project. For a local project, Supabase Studio's
   SQL editor is a convenient option.
4. Sign in as that account and select the new **Orchid Moon Kitchen Enterprise**
   business.

The script is idempotent for this demo business: re-running it does not add a
second copy of its invoices, transactions, or payments. It intentionally does
not delete or alter any existing record. To remove the fixture, delete the
business named `Orchid Moon Kitchen Enterprise` using an approved development-data
cleanup process.

Do not add this file to `supabase/seed.sql`: `supabase db reset` has no real
auth user to attach it to, and the placeholder guard should remain active.

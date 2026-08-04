# Farm Manager

A multi-farm operations dashboard for managing farms, plots, workers, contracts, finances, harvests, sales and inventory.

Built with Next.js (App Router) and Tailwind CSS. Data is stored in the browser's `localStorage`, so everything works offline with no backend. A sample dataset loads on first run; use **Reset sample data** at the bottom of the sidebar to restore it.

> ### ⚠️ Where real data belongs
>
> All names, ID numbers, phone numbers and figures in `lib/seed.ts` are **invented demo data**.
>
> **Enter your real workers, landlords and lenders through the app**, not in `lib/seed.ts`.
> Records added in the app are saved to your browser's local storage on that device and never
> leave it. Anything written into `lib/seed.ts` is committed to git and published with this
> repository — and once pushed, it stays in git history permanently, even if you delete it
> in a later commit. Real passport numbers, phone numbers and salaries must never go in there.

## Getting started

```bash
npm run dev
```

Then open http://localhost:3000

## What each page solves

| Page | Problem it addresses |
|---|---|
| **Overview** | One "action needed" list: missed rent, missed loan installments, expiring contracts, overdue collector payments, low stock, unclaimed receipts, delayed contractors |
| **Farms & Plots** | Multiple farms of different sizes, each with plots, crops, partners and the worker managing each plot |
| **Rental Contracts** | Landlord, monthly rent, contract period, deposit. Month-by-month payment tracker with missed months flagged red, plus expiry/renewal warnings |
| **Loans** | Bank, relative and friend loans with interest rate, installment, tenure, running balance and missed-installment tracking |
| **Setup Projects** | Third-party contractor jobs (land clearing, fencing, tilling) with quoted charges, amount paid, deadlines and days-late tracking |
| **Workers** | Worker records (ID/passport, phone, nationality, join date, salary) plus a ledger of groceries, phone top-ups, cigarettes, cash advances and other expenses, each flagged as deductible or not |
| **Payroll & Commission** | Commission calculated automatically from harvest records × per-crop rate per kg, minus that month's deductible worker expenses. Printable payslip per worker |
| **Schedule** | Daily work plan filterable by worker, farm, plot and date range, in calendar / by-worker / list views |
| **Sales & Collectors** | Graded sales (Grade A/B/C at different prices) to multiple collectors, payment due dates from each collector's term, overdue flags, and yearly average selling price by crop, grade and collector |
| **Purchases & Inventory** | Upload a receipt image, and one save files the reimbursement claim *and* updates stock. Supplier invoice names are mapped to your standard item names, so the same product from different suppliers hits the same stock item. Low-stock and out-of-stock warnings |
| **Spray Applications** | Cost per application round: tank mix products, dose rate per 100 L, water volume (small crops use less water and cost less), giving cost per round, per acre and per 100 L |

## Key calculations

- **Worker commission** — for each harvest record: `quantity kg × crop commission rate/kg`, summed per crop per month.
- **Net pay** — `base salary + commission − deductible expenses for that month`.
- **Payment due date** — sale date + the collector's payment term in days; anything past that is flagged overdue.
- **Average selling price** — total revenue ÷ total kg, broken down by crop, by grade and by collector for the year.
- **Application cost** — sum of `quantity used × unit cost` for every product in the tank mix. Entering a dose rate per 100 L auto-calculates the quantity from the water volume.

## Notes

- Receipt images are downscaled to 900px wide and stored as JPEG data URLs to stay within `localStorage` limits.
- Adding a purchase line with an invoice name not yet mapped will save that name as an alias for the linked item, so the match is automatic next time.
- Recording a spray application deducts the mixed quantities from stock.

## Project structure

```
app/
  page.tsx            Overview dashboard
  farms/              Farms & plots
  contracts/          Rental contracts
  loans/              Loans & repayments
  projects/           Contractor setup projects
  workers/            Worker records & expenses
  payroll/            Payroll, commission, payslips, harvest records
  schedule/           Work schedule
  sales/              Sales, collectors, average price
  inventory/          Purchases, claims, stock, supplier name mapping
  applications/       Spray application costing
components/
  ui.tsx              Shared UI kit (cards, tables, modals, badges, forms)
  Sidebar.tsx         Navigation
  BarChart.tsx        Bar chart with hover tooltip
lib/
  types.ts            Data model for every entity
  seed.ts             Sample dataset
  store.tsx           localStorage-backed store
  utils.ts            Formatting plus payroll, contract, loan and sales calculations
```

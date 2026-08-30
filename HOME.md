# FinancialWebApp — Home View

The Home view is the landing page of the app. It gives an at-a-glance picture of financial health without requiring any interaction. All data here is read-only — entries originate in the Dashboard. The view recalculates and re-renders every time it is opened.

---

## KPI Row

**Balance** — a panel styled like the ones below it (icon + title header, e.g. Expense Breakdown), sized to sit in the KPI row. The header reads "Balance" with a **Details** link on the right, mirroring Expense Breakdown's "Expand". The body shows a two-line breakdown stack on the left and an independent result value on the right: **Available** (top) — the all-time spendable balance, `Opening Balance + Income − Savings (Flow type only) − Expenses`; your running pool of liquid money after everything you moved into the reserve (Savings → Flow) and everything you spent (reserve withdrawals and *Savings → Other* deposits do not affect it). It's the same figure the Dashboard used to show as "Flow", computed from the shared `recalculateTotals()`. And **Potential** (bottom) — the all-time net of Potential Income minus Potential Expenses, a partner's money stream reconciled monthly rather than tracked daily (see DASHBOARD.md). Potential reads `0.00` when no Potential entries exist, rather than being hidden, so the panel's shape never changes between solo and partnered use. The result, on the right, is their sum — `Available + Potential` — red when negative; in solo use (Potential always zero) it's simply equal to Available. The stack is always shown at full height, even when its rows are zero, so the panel never resizes.

Clicking **Details** doesn't stretch the panel in place — it grows a floating overlay out from the panel, over a blurred backdrop, the exact same grow-and-blur principle as the Expense Breakdown panel's Expand overlay (just at a smaller, content-sized footprint, since there's no chart involved). The overlay repeats the same Available/Potential/Balance breakdown shown in the panel, then appends **Runway** underneath: this calendar month's `Income − Expenses`, nothing else. Deliberately ignores Starting Funds and every prior month, so it reads as a pure in-month drift, independent of the Balance above — not meant to reconcile against it via subtraction. Always the true current calendar month — never falls back to a past month, even before this month has any income recorded. The backdrop (or the link, now reading Close) dismisses it.

Total Saved is not a standalone card — see **Savings Holdings** below, where it lives as that panel's bottom-line total.

Beside the Balance panel, the row's second slot is a placeholder reserved for upcoming quick-add shortcuts (Income/Expense/Savings) that will open the same entry-editor modal used for editing transactions.

---

## Savings Holdings

A sheet summarising where savings sit, grouped by currency and holding type. Columns are **Amount | Currency | Type**, one row per unique `(currency, holding type)` combination found across all savings entries.

Amounts are gross savings deposits — the sum of every *Savings*-type entry in that group. This is a visual representation only: there is no currency conversion, and reserve withdrawals (the *Savings* expense category) are **not** netted out in this phase. Rows are sorted by currency, then by amount descending. If no savings have been recorded, the panel shows a no-data state.

The currency shown on each entry comes from the Dashboard entry form; the regional currency is applied by default, with foreign currencies possible on *Savings → Other* entries. Holding types (Cash, Card, Bank, Other) are also set on the Dashboard when the entry type is Savings.

**Total Saved** — a bottom-line total beneath the sheet (shown even with no data recorded yet). Unlike the gross per-row amounts above, this is the **net** all-time reserve balance: cumulative savings across every category and period, minus any *Savings* withdrawals (Expenses type, Savings category). Because savings can sit in foreign currencies, this figure is an **approximate total converted into the regional currency** and is prefixed with `≈`. Conversion uses the exchange rates managed in Settings (live rates with optional manual overrides); currencies without a known rate are counted at face value.

---

## Recent Transactions

The same transaction-history component as the Dashboard (see DASHBOARD.md), embedded here at a smaller footprint rather than a separate read-only summary — type/category filters, the Full History expand-to-overlay, and the per-entry pencil editor all work identically. Saving an edit here recalculates totals, persists, pushes to any connected sync, and refreshes the whole Home view immediately, the same as it does from the Dashboard.

---

## Expense Breakdown

A donut chart of the current month's expenses by category, showing each category's share of total spending for that month. Only categories with non-zero spend appear. If there are no expenses this month, the panel shows a no-data state. This donut is never hidden or replaced by the controls below — it always sits in the panel exactly as described here.

**Expand** pulls the full Expenses by Category chart — the same component formerly on the Dashboard (see DASHBOARD.md) — out into a floating window over the page, following the identical principle as Recent Transactions' **Full History** overlay: it grows out from its card to fill the same `.content-container`-sized, vertically-centered footprint, with a dimmed backdrop behind it that dismisses it on click. Inside: a bar chart across all 12 expense categories for a selected date range, sorted descending by spend, with an always-visible legend and period-scoped export/import. It defaults to the current calendar month, independent of the donut's fixed month scope. **Collapse** (or the backdrop) shrinks it back down. It stays open across an in-Home refresh (e.g. after editing an entry) but always starts closed on a fresh visit to Home.

---

## Financial Health

Three ratio bars measuring the current calendar month's numbers against common financial health thresholds — the same current-month scope as the Runway card, with no fallback to a past month. Each bar fills relative to its ceiling or target, and is colour-coded by status.

**Savings Rate** — income-funded savings (Flow-category only) as a percentage of income. *Savings → Other* deposits (external money entering the reserve) and reserve withdrawals are deliberately excluded, so the rate reflects how much of your income you set aside and cannot exceed 100% or go negative. Target: ≥ 20%. Green at or above target, amber between 10–20%, red below 10%.

**Expense Ratio** — total expenses as a percentage of income. Ceiling: 80%. Green when comfortably below (under ~68%), amber when approaching, red at or above the ceiling.

**Rent Burden** — rent specifically as a percentage of income. Ceiling: 30%. Same colour logic as Expense Ratio.

When the current month has no income yet all three bars show `--` and remain empty, since ratios against zero income are meaningless. The panel header always shows which month the ratios are calculated against.

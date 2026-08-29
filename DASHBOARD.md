# FinancialWebApp — Features Overview

---

## Dashboard

### New Entry

The entry form is where all financial data originates. Every record in the app starts here before it touches any chart or calculation.

**Fields:**
- **Date** — defaults to today, can be set to any past date. This allows backfilling historical data (e.g. from a banking app) without being tied to when you're actually sitting at the app.
- **Amount** — numeric, no currency symbol.
- **Type** — four options: Income, Savings, Expenses, Potential. The type selection drives what categories are available.
- **Category** — changes depending on type:
  - *Income:* Starting Funds, Salary, Other
  - *Savings:* Flow, Other
  - *Expenses:* Groceries, Deliveries, Pets, Medical, Household, Subscriptions, Rent, Gaming, Shopping, Gifts, Transport, Personal, Savings
  - *Potential:* Income, Expenses
- **Currency** — sits between Category and Note. Defaults to the regional currency (set in Settings) and is **locked** for every entry, with one exception: a *Savings → Other* entry — money entering the reserve from outside the Flow — unlocks the selector so a foreign currency can be chosen. This is a visual attribute only in this phase; no conversion or cross-currency math is performed.
- **Holding** — shown only when the type is *Savings*. Records where the money sits (Cash, Card, Bank, Other). Used to group the Home Savings Holdings sheet.
- **Note** — optional free-text field, visible in the transaction list.

**Starting Funds** is a special income category. It can only be added once and represents the opening balance before any income or expenses are tracked. Once set, it disappears from the category list.

Although it is entered through the Income type, Starting Funds is **not treated as earned income**. It is the opening balance, so counting it as income would spike every income analytic (forecast projection, earnings heatmap, trends) with a one-time sum that no future month will match. Instead it is folded into a separate opening-balance bucket that still contributes to **Flow** (the money is genuinely available), but is **excluded from the Overview Income card and all income analytics**. It still appears in the transaction list.

**Savings** is a special *expense* category representing a **withdrawal from the reserve** — money taken out of savings in a critical situation (think of it as pulling cash off a savings/credit card). It is not consumption of income, so it behaves differently from every other expense category:
- It **reduces the Savings total** (net reserve balance = deposits − withdrawals) rather than adding to Total Expenses.
- It **does not affect Flow**, since the money comes from the reserve, not from income cash flow.
- It is **excluded from all expense analytics** — the Expenses by Category chart, the Home expense breakdown and spending trend, and the Behavior Analytics trends/heatmap/forecast — which stay focused on income-funded spending.

It still appears in the transaction list (as an outflow) so the withdrawal is on record.

**Potential** is a separate *type* for a partner's money — funds that are "potentially" available to the household but that you don't control on a daily basis, only reconcile once a month (a partner's earnings and spending). It is deliberately isolated from every controlled total and analytic:
- Its two categories, **Income** and **Expenses**, record only the direction of each entry. The net of the two (income − expenses) accumulates into a single **growing potential pool**.
- It **never touches Flow / Available**, the Home **Runway** card, or any Behavior Analytics view (trends, heatmaps, forecast) — those all operate on the Income/Savings/Expenses types and ignore Potential entirely.
- It surfaces in exactly one place: as a breakdown row on the Home **Together** card (see HOME.md), where it is added to Available to show the couple's combined pool.

Like every other type it appears in the transaction list (tagged *potential*), and currency is locked to the regional currency.

**Backup (file operations)** — accessible via the file icon button, this panel slides open with three controls: a filename field, Export, and Import. Export saves the entire dataset as a `.json` file. Import replaces the current dataset with a file. Both operate on the full history, not a specific period.

---

### Staged Entries

Entries added via the form go into a staging area before they are committed. This is intentional — it lets you prepare a batch of entries (for example, an entire month of backfilled data) and review them before they affect any numbers.

Each staged entry shows date, amount, type, and category. Individual entries can be deleted from staging before committing. The **Apply** button commits all staged entries at once and updates every view in the app immediately. Until Apply is pressed, all analytics remain unchanged.

The Dashboard no longer carries an Overview card row — the at-a-glance totals live on the **Home** view (**Runway**, this month's Income − Expenses; and **Together**, built on Available — the all-time spendable balance that was previously the Dashboard's "Flow" card; see HOME.md). The Dashboard is focused on entry, the expense breakdown, and the transaction record.

---

### Expenses by Category

A bar chart breaking down spending across all 12 expense categories for a selected time period. Categories are sorted descending by spend — the highest category always appears first, so the most impactful expenses are immediately visible without scanning.

Each bar is colour-coded and topped with the category icon rendered directly onto the chart canvas. Zero-spend categories are still shown at zero height, keeping the layout consistent regardless of which categories are active in a given period.

**Period picker** — two date inputs (start and end) that default to the current calendar month. Changing either date instantly re-renders the chart. The period selection is also used by the period-level export and import controls.

**Legend** — a toggleable panel listing all 12 categories with their icon and colour. Useful for reference when the chart bars are too narrow to read the icons clearly.

**Period file operations** — a secondary file panel (separate from the global backup) scoped to the selected period:
- *Export period* — saves only the entries within the selected date range as a `.json` file, with the period dates included in the filename automatically.
- *Import period* — imports a period file and merges it into the existing dataset. Entries within the period are replaced; entries outside the period are untouched. This allows updating a specific month without disturbing the rest of the history.

---

### Recent Transactions

A reverse-chronological list of all committed entries, displayed below the expenses chart. Shows date, amount, type, category, and note (if present) for each entry.

**Filters** — two dropdowns at the top of the section: type (Income / Savings / Expenses / All) and category. The category dropdown is context-aware — it only shows categories that actually appear in the entries matching the current type filter, not the full static list.

**Full History** — by default the list shows a compact view. Clicking *Full History* expands it into an overlay panel that covers the page, with a backdrop click to dismiss. This keeps the dashboard uncluttered day-to-day while still providing access to the complete record when needed.

**Editing entries** — each row (in both the compact and expanded states) has a pencil button that opens an editor modal for that committed entry. All fields are editable — date, amount, type, category, currency, holding, and note — following the same rules as the New Entry form (category list depends on type; currency locks to the regional currency except for *Savings → Other*; holding shows only for Savings). Saving recalculates all totals, persists, pushes to any connected sync, and re-renders every view immediately. This replaces the previous export-edit-reimport workaround for fixing mistakes such as a wrong date.

This whole component (list, filters, Full History, editor) is shared — Home embeds the identical component at a smaller size in its own Recent Transactions panel (see HOME.md), rather than a separate implementation.

---

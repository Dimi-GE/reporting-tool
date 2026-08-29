## v0.0.2b.4 — August 2026

- `improvement` Home — KPI row rebuilt from four cards down to two, both a shared split layout (icon, a two-line breakdown stack, and an independent result value). **Runway** replaces the Monthly Income/Monthly Expenses cards: the stack shows this calendar month's Income and Expenses, the result is their difference — a pure in-month drift figure that deliberately ignores Starting Funds and every prior month, so it never overlaps with Available. **Together** replaces the old Available card: the stack shows **Available** (the same all-time spendable balance as before) and **Potential** as its two components, with their sum — the couple's combined pool — as the result; Potential now always reads `0.00` rather than being hidden for solo use, so the card's shape never changes. **Total Saved** is no longer a standalone card — its figure moved to a new bottom-line total on the **Savings Holdings** panel
- `improvement` Home — Monthly Income/Monthly Expenses (now Runway) and the Financial Health panel no longer fall back to the most recent past month with income; both always reflect the true current calendar month, even before it has any income recorded yet
- `feature` Home — **Recent Transactions** now embeds the full Dashboard transaction-history component (type/category filters, the Full History overlay, the per-entry edit modal) at the panel's smaller footprint, replacing the old read-only 5-row list
- `improvement` The entry-editor modal (date/amount/type/category/currency/holding/note fields, opened by the pencil button on any committed row) is extracted out of `dashboard.js` into a shared `components/entry-editor` module, so it now works identically whether opened from Home or the Dashboard, regardless of which view loaded first this session. `ENTRY_CATEGORIES` (category options per type) and `commitEntries()` (recalculate + persist + Gist push) move to `app.js` as shared helpers so Home's embedded list and the Dashboard's own Apply flow can never drift
- `fix` Transaction history — the "Full History" expand grew the list in place via a hard-coded `margin-top: -400px`, tuned to look right at exactly one scroll position on the Dashboard page; embedding the same component on Home (a different position on a different page) exposed it. Expanding now opens a fixed, viewport-centered overlay sized from `.content-container`'s actual on-screen bounds (15px inset each side) instead, so it renders identically from either view at any screen size or sidebar state
- `improvement` Transaction history — the expand/collapse is now an actual grow/shrink animation (a FLIP: the card snaps to its own collapsed rect with no transition active, then glides to the overlay's target rect, and reverses symmetrically on collapse) rather than an instant snap. Its speed is defined once, as a `--tx-anim-duration` CSS variable that both the transition and the JS cleanup timer read back — previously the transition duration and a separate JS constant could be edited independently and silently fall out of sync, cutting the collapse animation off mid-way
- `docs` DASHBOARD.md and HOME.md updated for the Runway/Together KPI cards, the current-month-only Financial Health scope, the shared transaction-history component, and the shared entry-editor module

## v0.0.2b.3 — July 2026

- `fix` Remote backup — a fresh device could **wipe the remote Gist on connect**: because opening the app writes `currency_rates` (live FX), the old `hasLocalData()` saw a non-null key and treated an entry-less device as having data, so with no local freshness stamp `reconcile()` pushed an empty snapshot over a Gist full of real entries. `hasLocalData()` now means *actual budget entries*, so a device with no entries always **pulls** the remote instead of overwriting it — newest-wins is preserved for devices that do have entries
- `improvement` Remote backup consolidated — the separate **Gist Sync** and **Full Snapshot Backup** are now one backend: a single access **token** unlocks a single full-snapshot **Gist**. Token and Gist are independent latches (the token is verified against the GitHub API before the Gist field unlocks; disconnecting the token cascades and clears the Gist too), and the Dashboard **Apply** now backs up the whole snapshot — entries, currencies, rates, and preferences — rather than only dashboard data. Since the app tracks only a budget now, there was nothing left to split across two Gists; a one-time migration adopts the old dedicated backup Gist as the single Gist, and `gist-sync.js` is retired
- `feature` Settings — **currency entries are now editable**: a pencil on each row opens an inline edit form (code, symbol, name) with Save/Cancel, so a typo no longer means delete-and-re-add — crucially this also works on the **regional** currency, which cannot be removed. Renaming a currency's code follows through everywhere: the regional pointer stays attached, existing transactions tagged with the old code are rewritten so none are orphaned, a duplicate code is rejected, and a regional-code rename refetches live rates keyed to the new base
- `fix` Analytics — chart tooltips, axis labels, and the Forecasting summary figures showed a hard-coded **`$`** regardless of the regional currency; they now use the regional currency's symbol (falling back to its code, e.g. `PLN`, when no symbol is set) across Trends, Forecasting, and the earnings/spending heatmaps, via a shared `regionalCurrencySymbol()` helper
- `docs` Removed stale "time tracking records" mentions from the Settings Backup All Data and Reset All Data descriptions (time tracking was discontinued in v0.0.2b.2), and rewrote roadmap.md's Remote Backup section for the consolidated single token + single Gist model (dropping the two-Gist / "time tracking" wording)

## v0.0.2b.2 — July 2026

- `feature` Dashboard — new **Potential** entry type for a partner's money stream that is reconciled once a month rather than tracked daily: two direction categories (Income, Expenses) whose net accumulates into a growing "potential" pool. It is kept entirely out of Flow/Available, the Home Monthly cards, and every analytic (Trends, heatmaps, Forecasting) — all of which operate on the Income/Savings/Expenses types — so partner money can never contaminate the controlled numbers; `isPotential()` helper and a `potential` bucket added to `recalculateTotals()` so the rule is defined once
- `feature` Home — the **Available** card grows a two-line sub-value when any Potential entries exist: **potential** (all-time net of Potential Income − Expenses) and **together** (Available + potential), mirroring the Forecasting card's actual → total presentation; hidden entirely for solo use so the card is unchanged without partner data. Potential rows also appear in Recent Transactions (signed by direction with a tag) and the Transactions type filter
- `improvement` Expense categories renamed — **Online → Gaming** and **Media → Household** (furniture, bed linen, homeware), each with a new icon; a one-time idempotent migration rewrites existing entries' category slug and label on load so historical records keep their colour and grouping
- `improvement` Expense categories consolidated into a single `EXPENSE_CATEGORIES` source of truth (app.js, loaded globally); the colour map, entry-form list, Expenses-by-Category chart and legend, and the Home donut all derive from it, removing four duplicated definitions so a future rename/recolour/re-icon is a one-line edit
- `fix` Expenses by Category — category icons drawn on the chart canvas came from a hand-maintained name→codepoint table, so newly added icons rendered as `?`; replaced with a resolver that reads each glyph's codepoint from the loaded Tabler webfont at runtime, so any valid icon works without a lookup table
- `removed` Hours Reports (time-tracking) fully discontinued — view files and HOURS.md deleted, sidebar entry removed, and the `tt_entries`/`tt_sessions`/`tt_settings` keys dropped from both the local and Gist backup snapshots; a one-time purge clears those keys from localStorage on load, and a stale-view guard falls back to Home if a saved session still points at the removed view
- `docs` DASHBOARD.md and HOME.md updated for the Potential type, the Available sub-value, and the renamed categories; roadmap.md Hours Reports sections removed

## v0.0.2b.1 — July 2026

- `improvement` Starting Funds no longer counts as income: the opening balance is folded into a separate `funds` bucket that still feeds Flow (so the Flow figure is unchanged), but is excluded from the income total, Home's Monthly Income, and every income analytic — forecast weighted-average, earnings heatmap, and the Trends income line — so a one-time opening sum no longer spikes projections or crushes the heatmap's relative scale; `isOpeningBalance()` helper added to app.js so the rule is defined once
- `fix` Cash flow now consistently subtracts only Flow-category savings across Trends and Forecasting, matching the Home rule; a Savings → Other deposit (reserve money from outside the Flow) no longer drags the cash-flow line down, while the Savings line still shows net reserve movement
- `improvement` Dashboard — the Overview card row (Income / Savings / Total Expenses / Flow) is removed; those insights now live on Home, leaving the Dashboard focused on entry, the expense breakdown, and the transaction record. The core `recalculateTotals()` is now loaded globally (index.html) so any view shares the one canonical Flow formula
- `improvement` Home — the monthly "Cash Flow" card is replaced by **Available**, the all-time spendable balance (opening balance + earned income − Flow-category savings − expenses); it reads as a running pool of liquid money and pairs with Total Saved as the two all-time balances
- `fix` Home Financial Health — Savings Rate now uses income-funded (Flow-category) savings instead of net reserve movement, so a Savings → Other deposit can no longer push it over 100% and a withdrawal can no longer drive it negative; all three ratios are computed against earned income (Starting Funds excluded), so a reference month that holds the opening balance reports true income-relative ratios
- `improvement` Analytics — Trends re-framed as a 12-month budget-year chart with its own start-month/year picker (saved across sessions), replacing the Week/Month/Quarter toggle anchored to today; it now shares Forecasting's `buildForecast()` engine (actuals only — future months are left off instead of projected), so the two charts can never drift. Trends keeps a picker independent of Forecasting's
- `docs` DASHBOARD.md, HOME.md, ANALYTICS.md, and roadmap.md updated for the Starting Funds / income split, the Available card, the removed Dashboard Overview, the Flow-only cash-flow rule, the Savings Rate change, and the re-framed Trends

## v0.0.2b.0 — July 2026

- `feature` Dashboard — multi-currency (visual): each entry carries a currency, chosen between Category and Note; it defaults to and locks on the regional currency, unlocking only for a Savings → Other entry (reserve money from outside the Flow)
- `feature` Dashboard — holding type (Cash, Card, Bank, Other) captured on Savings entries, recording where a balance physically sits
- `feature` Settings — Currencies section: add or remove currencies (code, symbol, name) and mark one as the regional default (starred); the list and regional choice sync through both local backup and the Gist bundle
- `feature` Home — Savings Holdings sheet replaces the Spending Trend panel: savings grouped by currency and holding type as an Amount | Currency | Type table
- `feature` Currency calculator — Home Total Saved and Dashboard Savings cards show an approximate total converted into the regional currency (prefixed ≈); Flow and analytics stay regional for now
- `feature` Settings — Exchange Rates section: live rates from a free no-key API (open.er-api.com) keyed to the regional currency, cached and refreshed per session (at most ~twice daily), with a per-currency manual override that wins; changing the regional currency refetches
- `feature` Settings — Full Snapshot Backup: connect a dedicated Gist (same token, separate Gist ID) holding every data key; Connect establishes a newest-wins baseline and each app open reconciles per session, while manual Backup / Restore force a push / pull and are available only while connected; credentials are never written into the snapshot
- `feature` Dashboard — edit committed entries: a pencil button on every Recent Transactions row (compact and Full History) opens a modal to change any field (date, amount, type, category, currency, holding, note), then recalculates totals, persists, pushes to sync, and re-renders every view — replacing the export-edit-reimport workaround
- `improvement` Remote backup — local freshness (`gist_local_mtime`) is stamped on every commit and currency change regardless of sync connection, so both Gist Sync and the full backup compare ages correctly
- `improvement` Home — Recent Transactions ordering fixed so entries sharing a date show the most-recently-committed first; category labels are now plain white and amounts are green for income and savings, red for expenses
- `fix` Settings — Exchange Rates "updated" line used an unreadable dark colour on the dark theme; now matches the muted description text
- `docs` DASHBOARD.md and HOME.md updated for the currency field, holding type, savings conversion, and entry editing

## v0.0.2b — July 2026
- `feature` Settings — GitHub Gist Sync: connect a personal access token (gist scope) and a Gist ID to back up dashboard data to a remote JSON file; the token is stored only in this browser's localStorage
- `feature` Settings — Connect/Disconnect toggle verifies the token and Gist against GitHub before saving; on connect the fields lock and a status line confirms the link, on disconnect the token is cleared from both the field and localStorage
- `feature` Remote backup — smart connect establishes a baseline on first link: seeds an empty Gist with local data, adopts the remote copy when it is newer, or pushes local when it is newer; ties and un-comparable timestamps keep local (least destructive)
- `feature` Remote backup — dashboard Apply pushes committed data to the Gist, and the app pulls once on open and adopts the remote copy when newer (newest-wins via `_meta.date`)
- `feature` Remote backup — synced JSON is a bundle of `committed` plus `currency_config` wrapped with a `_meta.date`; pull stays backward-compatible with the earlier top-level `entries` shape so existing Gists keep working, and the file remains interchangeable with manual backups
- `feature` Dashboard — Savings expense category: a withdrawal from the reserve, available only when Type is Expenses; it nets down the Savings balance instead of counting as an expense and leaves Flow untouched
- `improvement` Savings withdrawals excluded from all expense analytics — Expenses by Category chart, Home expense breakdown and spending trend, and Behavior Analytics trends, spending heatmap, and forecast — keeping those focused on income-funded spending
- `improvement` Savings totals now net of withdrawals across the Overview Savings card and Home Total Saved; `isSavingsWithdrawal()` helper added to app.js so the rule is defined once and applied consistently
- `fix` Dashboard export — global and period exports now write only `entries` (the source of truth); derived totals were removed from the file since import recalculates them, so hand-editing a top-level total no longer silently has no effect
- `parked` Hours Reports (time-tracking) unwired from the UI — hidden from sidebar navigation and blocked from session restore via a disabled-views guard; the view code is retained pending migration to a standalone project

## v0.0.1b — June 2026

- `fix` Loading — per-view spinner replaces the former full-screen overlay; spinner appears inside the content area on first visit to each view and lifts only when the view signals it is fully rendered, preventing content flash across all views
- `fix` Loading — `window.viewReady()` callback introduced; each view's init function calls it at the natural end of its async work (after charts render, sub-components load, and markdown fetches complete) so the spinner duration is tied to actual content readiness rather than a fixed timeout
- `fix` Loading — 350ms fallback timeout added to force-remove the overlay when `transitionend` does not fire; prevents the invisible overlay from blocking pointer events on synchronously-initialised views such as Hours Reports
- `improvement` Loading — load time logged to console per view (`[viewName] ready in Xms`) to aid performance profiling
- `improvement` Loading — 8-second safety timeout auto-dismisses the spinner if a view's init never signals ready, preventing the overlay from hanging indefinitely
- `improvement` Hours Reports — view renamed from Time Tracking across all user-facing labels, navigation, view title, changelog, and roadmap entries; internal file paths unchanged
- `improvement` Hours Reports — Today and This Week sections removed; view now focuses on the monthly calendar and timer only
- `docs` HOME.md added covering KPI row, reference month logic, Spending Trend, Recent Transactions, Expense Breakdown, and Financial Health panels
- `docs` HOURS.md added covering Timesheet Settings, Timer, Calendar, Day Entry Modal, and File Operations

## v0.0.1c.7 — June 2026

- `feature` Settings — Backup All Data action downloads a full snapshot of all dashboard entries, time tracking records, and preferences as a single dated JSON file
- `feature` Settings — Restore from Backup action reads a backup JSON file and replaces all current data; requires a file-picker confirm step before overwriting
- `feature` Hours Reports — month total row added below the calendar showing cumulative hours for the displayed month; updates on every render including month navigation
- `feature` Hours Reports — calendar Export JSON and Import JSON actions for sharing data across devices; export covers all entries and sessions, import does a full replace then re-renders
- `improvement` Hours Reports — Export JSON, Import JSON, and Export PDF buttons consolidated into a collapsible file-ops panel behind a single toggle button, matching the dashboard pattern and fixing overflow on narrow mobile screens
- `improvement` Settings — Backup, Restore, and Reset share a single STORAGE_KEYS array so adding new views keeps all three actions in sync automatically
- `fix` Mobile — `100dvh` added alongside `100vh` on body, window wrapper, and mobile drawer to correct content clipping caused by browser chrome on iOS Safari and Android
- `fix` Loading — full-screen overlay with spinner shown on initial page load, fades out after 2 seconds, preventing section-by-section flash of unstyled content on first paint
- `fix` View transitions — `loadCSS()` converted to return a Promise; HTML is now injected only after the view stylesheet has fully loaded, eliminating per-view flash of unstyled content on first visit

## v0.0.1c.6 — June 2026

- `feature` Mobile navigation — sidebar hidden on touch devices; hamburger button (fixed, top-right) opens a slide-in drawer with full nav labels; backdrop tap closes it
- `feature` Settings view — new view with a Reset All Data action; requires inline confirmation before clearing all localStorage keys and reloading to Home
- `improvement` Recent Transactions — note moved to a second line below the date/amount/type/category row
- `improvement` Recent Transactions — filters hidden when collapsed; "Full History" link hidden when expanded; collapse via backdrop tap only
- `fix` Dashboard inputs — font-size forced to 16px on touch devices to prevent iOS Safari auto-zoom on focus

## v0.0.1c.5 — June 2026

- `feature` Home view — KPI row with Total Saved, Monthly Income, Monthly Expenses, and Cash Flow cards populated from committed data
- `feature` Home view — Spending Trend panel: mini line chart of expenses across the last 6 months
- `feature` Home view — Recent Transactions panel: 5 most recent committed entries with category colours matching the dashboard palette
- `feature` Home view — Expense Breakdown panel: donut chart of current month expenses by category
- `feature` Home view — Financial Health panel replacing Savings Goals: three ratio bars (Savings Rate, Expense Ratio, Rent Burden) with colour-coded status and threshold hints
- `improvement` Financial Health — bars fall back to the most recent month with income when the current month has none yet; panel header shows the reference period
- `improvement` TX_CATEGORY_COLORS, getCategoryColor, TX_TYPE_ICONS, and TX_TYPE_COLORS moved to app.js so they are globally available regardless of which view is active first

## v0.0.1c.4 — June 2026

- `improvement` Recent Transactions — date, type, amount, and category columns are fixed-width for consistent spreadsheet-like alignment
- `improvement` Recent Transactions — notes rendered inline on the same row as the transaction, offset from the category badge
- `improvement` Recent Transactions — category badges coloured to match the Expenses by Category chart palette; income and savings categories have their own distinct colours
- `improvement` Recent Transactions — transaction type shows a coloured icon (trending-up for Income, coin for Savings, trending-down for Expenses)
- `parked` Transactions view hidden from sidebar navigation pending future development

## v0.0.1c.3 — June 2026

- `feature` Hours Reports — Submit button wires timer to the calendar: submitting a session adds hours and task label to today's calendar entry, the Today list, and the This Week bars
- `feature` Hours Reports — Today sessions rendered as a scrollable list capped at 4 visible entries, wrapped in a surface card
- `feature` Hours Reports — This Week bars now reflect real data from committed entries, scaling relative to the busiest day
- `improvement` Hours Reports — Settings and Timer placed side by side in a responsive flex row that stacks on narrow screens
- `improvement` Hours Reports — Timer counter reduced to 28px; tag dropdown removed as unused
- `improvement` Hours Reports — Submit button styled with orange border and text; both buttons compacted
- `improvement` Hours Reports — View no longer capped at 900px; fills the full content frame like other views
- `improvement` PDF export — other-month days (overflow weeks) now styled the same as weekends — lighter salmon fill
- `improvement` PDF export — row height tightened: font reduced to 8.5pt, cell padding halved to 1.5mm
- `improvement` Analytics — heatmap intensity row made responsive; columns wrap on narrow screens

## v0.0.1c.2 — June 2026

- `feature` Roadmap entries rendered as rows with horizontal card layout — each category (Planned, In Progress, Ideas, Done) is a labelled row with cards flowing inline
- `improvement` Roadmap category order standardised: Planned → In Progress → Ideas → Done
- `improvement` Roadmap categories styled with per-status background tint and coloured border
- `improvement` Roadmap card lists capped at ~4 visible entries with vertical scroll
- `feature` Hours Reports — monthly timesheet calendar with day-level entry (hours + tasks per day)
- `feature` Hours Reports — freelancer name and company settings persisted to localStorage
- `feature` Hours Reports — PDF export via jsPDF generating a weekly timesheet matching the standard spreadsheet format
- `improvement` PDF timesheet uses Excel-matched salmon fills, violet label column, black grid lines, and grey fill on logged days

## v0.0.1c.1 — June 2026

- `feature` Forecasting mechanism with 12-month rolling budget year, weighted average projection, and three-value summary cards (to date / projected / year-end)
- `feature` Roadmap and Hours Reports view shells added to sidebar navigation
- `feature` Markdown engine for rendering .md files as styled HTML or structured cards
- `feature` Roadmap and Changelog views powered by content/roadmap.md and content/changelog.md
- `fix` Chart.js race condition causing forecasting chart to not render on first Analytics tab load
- `fix` Section title labels rendering black when Dashboard had not been visited first in a session
- `improvement` Documentation split into per-view files: FEATURES.md and ANALYTICS.md
- `improvement` Budget year start picker persisted to localStorage and restored across sessions

## v0.0.1c.0 — June 2026

- `feature` Analytics view with lazy-loaded component architecture
- `feature` Spending and Earnings heatmaps with day-level activity intensity
- `feature` Quartile-based colour scaling on heatmaps
- `feature` Quarter and year navigation on heatmaps
- `feature` Sync toggle keeping both heatmaps on the same period
- `feature` Trends chart with income, expenses, savings, and cash flow lines
- `feature` Week, month, and quarter granularity on Trends

## v0.0.1d — June 2026

- `feature` Dashboard with staged entries workflow — stage, review, then commit
- `feature` Starting Funds as a one-time income entry
- `feature` Expenses by Category bar chart with period picker and legend
- `feature` Period-scoped export and import for the expenses chart
- `feature` Recent Transactions list with type and category filters
- `feature` Full History overlay mode for transaction list
- `feature` Overview cards: Income, Savings, Total Expenses, Flow
- `feature` Global backup export and import via JSON file
- `feature` Data persisted to localStorage across sessions

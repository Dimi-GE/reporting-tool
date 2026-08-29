// ── Expense categories — single source of truth ──────────────────────────
// The 12 spending categories, defined once and consumed everywhere: the entry
// form (Dashboard), the Expenses-by-Category chart + legend, the Home donut,
// and the colour map below. Loaded globally in index.html so every view sees it.
// To add, rename, recolour, or re-icon a category, edit ONLY this array. (The
// special "Savings" reserve-withdrawal category and the Potential-type
// directions live outside this list — they are not ordinary spend categories.)
const EXPENSE_CATEGORIES = [
    { key: 'groceries',     label: 'Groceries',     icon: 'ti-shopping-cart',    color: '#4caf7d' },
    { key: 'deliveries',    label: 'Deliveries',    icon: 'ti-bike',             color: '#f5a800' },
    { key: 'pets',          label: 'Pets',          icon: 'ti-paw',              color: '#e05c5c' },
    { key: 'medical',       label: 'Medical',       icon: 'ti-heart-plus',       color: '#e57373' },
    { key: 'household',     label: 'Household',      icon: 'ti-sofa',             color: '#ba68c8' },
    { key: 'subscriptions', label: 'Subscriptions', icon: 'ti-repeat',           color: '#4fc3f7' },
    { key: 'rent',          label: 'Rent',          icon: 'ti-home',             color: '#ff8a65' },
    { key: 'gaming',        label: 'Gaming',         icon: 'ti-device-gamepad-2', color: '#a1887f' },
    { key: 'shopping',      label: 'Shopping',       icon: 'ti-shopping-bag',     color: '#f06292' },
    { key: 'gifts',         label: 'Gifts',          icon: 'ti-gift',             color: '#ce93d8' },
    { key: 'transport',     label: 'Transport',      icon: 'ti-car',              color: '#80cbc4' },
    { key: 'personal',      label: 'Personal',       icon: 'ti-user',             color: '#fff176' },
];

const TX_CATEGORY_COLORS = {
    // Income
    starting_funds: '#ffd54f',
    salary:         '#66bb6a',
    // Savings
    flow:           '#42a5f5',
    // Expenses — colours derived from the shared EXPENSE_CATEGORIES definition
    ...Object.fromEntries(EXPENSE_CATEGORIES.map(c => [c.key, c.color])),
    // Expenses — reserve drawdown (Expenses type, "Savings" category)
    savings:        '#5c6bc0',
    // Potential — partner stream (Potential type). Category is the direction:
    // 'income' (money in) or 'expenses' (money out). See isPotential().
    income:         '#26a69a',
    expenses:       '#c97b7b',
    // Fallback
    other:          '#90a4ae',
};

function getCategoryColor(category) {
    return TX_CATEGORY_COLORS[category] || TX_CATEGORY_COLORS.other;
}

// A "Savings" expense is a withdrawal from the reserve — it nets down the
// Savings balance and is NOT consumption of income. Every aggregation of
// expenses/savings across the app routes through this so the semantics stay
// consistent. See DASHBOARD.md / HOME.md.
function isSavingsWithdrawal(entry) {
    return entry.type === 'expenses' && entry.category === 'savings';
}

// Starting Funds is the opening balance — money you had before tracking began.
// It is stored as an income entry (category 'starting_funds') so the form flow
// stays unchanged, but it is NOT earned income: counting it would spike every
// income aggregation (forecast weighted-average, earnings heatmap, trends).
// So every income aggregation routes through this helper to exclude it, and it
// is folded into Flow via a separate `funds` bucket instead. See calculator.js.
// NOTE: this is coupled to the category slug 'starting_funds' — if that slug is
// ever renamed, update here too.
function isOpeningBalance(entry) {
    return entry.type === 'income' && entry.category === 'starting_funds';
}

// Potential is a partner's money stream, reconciled once a month rather than
// tracked daily — funds that are "potentially" available but not fully under
// your control. It is deliberately kept out of every controlled total and
// analytic (those all filter on the income/savings/expenses types), and
// accumulates in its own net `potential` bucket that surfaces only as the Home
// "Available" sub-value. The category records direction: 'income' or 'expenses'.
// See recalculateTotals() in calculator.js.
function isPotential(entry) {
    return entry.type === 'potential';
}

// ── Currency configuration ───────────────────────────────────────────────
// The list of tracked currencies and which one is "regional" (the default
// applied to every transaction that isn't an explicit foreign holding). Kept
// separate from entries so Settings can edit it and the Gist bundle can sync
// it. Phase 1 is visual only — no conversion or cross-currency math.
const CURRENCY_CONFIG_KEY = 'currency_config';
const DEFAULT_CURRENCY_CONFIG = {
    regional: 'USD',
    list: [{ code: 'USD', symbol: '$', name: 'US Dollar' }],
};

// Where a savings balance physically sits. A visual-only grouping dimension
// for the Home savings sheet; captured on Savings entries in the Dashboard.
const HOLDING_TYPES = [
    { key: 'cash', label: 'Cash' },
    { key: 'card', label: 'Card' },
    { key: 'bank', label: 'Bank' },
    { key: 'other', label: 'Other' },
];

function getCurrencyConfig() {
    try {
        const cfg = JSON.parse(localStorage.getItem(CURRENCY_CONFIG_KEY));
        if (cfg && Array.isArray(cfg.list) && cfg.list.length && cfg.regional) return cfg;
    } catch (e) {}
    return structuredClone(DEFAULT_CURRENCY_CONFIG);
}

function saveCurrencyConfig(cfg) {
    localStorage.setItem(CURRENCY_CONFIG_KEY, JSON.stringify(cfg));
}

function getRegionalCurrency() {
    return getCurrencyConfig().regional;
}

function getCurrencyMeta(code) {
    return getCurrencyConfig().list.find(c => c.code === code)
        || { code: code || '', symbol: '', name: code || '' };
}

// Display prefix for amounts in charts/tooltips: the regional currency's symbol,
// falling back to its code (e.g. "PLN ") when no symbol is set, so figures are
// never rendered bare or, worse, under a hard-coded "$". Used by the Analytics
// charts (trends, forecasting, heatmaps).
function regionalCurrencySymbol() {
    const meta = getCurrencyMeta(getRegionalCurrency());
    return meta.symbol || (meta.code ? meta.code + ' ' : '');
}

function getHoldingLabel(key) {
    const h = HOLDING_TYPES.find(h => h.key === key);
    return h ? h.label : (key ? capitalize(key) : '—');
}

// Renamed expense categories. Historical entries store the category as a slug
// plus a frozen categoryLabel, so a rename must rewrite existing records or they
// would drop to the "other" colour and keep their old label. migrateCategories()
// runs once per load (after any Gist pull, before views render) and is
// idempotent — the new slugs are not keys here, so re-running is a no-op.
const CATEGORY_RENAMES = {
    online: { category: 'gaming',    label: 'Gaming' },
    media:  { category: 'household', label: 'Household' },
};

function migrateCategories() {
    try {
        const raw = localStorage.getItem('dashboard_committed');
        if (!raw) return;
        const data = JSON.parse(raw);
        if (!data || !Array.isArray(data.entries)) return;
        let changed = false;
        data.entries.forEach(e => {
            const rename = e.type === 'expenses' && CATEGORY_RENAMES[e.category];
            if (rename) {
                e.category      = rename.category;
                e.categoryLabel = rename.label;
                changed = true;
            }
        });
        if (changed) {
            localStorage.setItem('dashboard_committed', JSON.stringify(data));
            console.log('[migrate] renamed legacy expense categories');
        }
    } catch (e) { console.warn('[migrate] category rename skipped:', e.message); }
}

// Hours Reports (time-tracking) has been discontinued and its view removed.
// Purge its orphaned localStorage keys once on load so they stop lingering
// locally and drop out of the next full backup snapshot (they are no longer in
// the backup key lists). Idempotent — a no-op once the keys are gone.
const LEGACY_TIME_TRACKING_KEYS = ['tt_entries', 'tt_sessions', 'tt_settings'];

function purgeLegacyTimeTracking() {
    let removed = false;
    LEGACY_TIME_TRACKING_KEYS.forEach(k => {
        if (localStorage.getItem(k) !== null) { localStorage.removeItem(k); removed = true; }
    });
    if (removed) console.log('[migrate] purged discontinued time-tracking data');
}

// Category options per entry type — shared by the Dashboard New Entry form
// and the entry-editor modal (components/entry-editor), so both stay in sync
// with EXPENSE_CATEGORIES without maintaining two separate lists.
const ENTRY_CATEGORIES = {
    income:    ['Starting Funds', 'Salary', 'Other'],
    savings:   ['Flow', 'Other'],
    expenses:  [
        ...EXPENSE_CATEGORIES.map(c => c.label),
        'Savings',   // withdrawal from the reserve (nets down Savings, not an expense)
    ],
    potential: ['Income', 'Expenses'],   // partner stream, direction only; see isPotential()
};

// Recalculates totals, persists the full committed snapshot, and pushes to a
// connected Gist. Shared by the Dashboard's Apply flow and any other view
// that commits an edited entry (e.g. Home's embedded transaction list), so
// the recalc/persist/sync step is defined once. Callers still own their own
// view-specific re-render afterward — this only writes storage.
function commitEntries(entries) {
    const committed = recalculateTotals(entries);
    try { localStorage.setItem('dashboard_committed', JSON.stringify(committed)); }
    catch (e) { console.warn('Could not save:', e); }
    window.GistBackup?.markLocalModified?.();
    if (window.GistBackup?.isConnected()) {
        GistBackup.backupNow()
            .then(date => console.log('[gist] pushed at', date))
            .catch(e => console.warn('[gist] push failed:', e.message));
    }
    return committed;
}

const TX_TYPE_ICONS = {
    income:    'ti-trending-up',
    savings:   'ti-coin',
    expenses:  'ti-trending-down',
    potential: 'ti-users',
};

const TX_TYPE_COLORS = {
    income:    '#4caf7d',
    savings:   '#f5a800',
    expenses:  '#e05c5c',
    potential: '#7e88c9',
};

const loadedViews = {};
let currentView = null;

function loadView(viewName) {
    const contentContainer = document.getElementById('content');

    if (loadedViews[viewName]) {
        contentContainer.innerHTML = loadedViews[viewName].html;
        if (loadedViews[viewName].init) {
            loadedViews[viewName].init();
        }
        currentView = viewName;
        sessionStorage.setItem('activeView', viewName);
        return;
    }

    contentContainer.innerHTML = '<div style="height:calc(100dvh - var(--header-height) - 40px);display:flex;align-items:center;justify-content:center;"><div class="loader-ring"></div></div>';

    fetch(`views/${viewName}/${viewName}.html`)
        .then(response => {
            if (!response.ok) throw new Error(`Failed to load view: ${viewName}`);
            return response.text();
        })
        .then(html => {
            loadedViews[viewName] = { html };
            return loadCSS(`views/${viewName}/${viewName}.css`).then(() => {
                contentContainer.innerHTML = html;
                return loadScript(`views/${viewName}/${viewName}.js`);
            });
        })
        .then(() => {
            const initFn = `init${capitalize(viewName)}`;
            if (typeof window[initFn] === 'function') {
                const overlay = document.createElement('div');
                overlay.className = 'view-loader-overlay';
                overlay.innerHTML = '<div class="loader-ring"></div>';
                contentContainer.appendChild(overlay);

                const t0 = performance.now();
                const safetyTimer = setTimeout(() => window.viewReady?.(), 8000);
                window.viewReady = () => {
                    clearTimeout(safetyTimer);
                    console.log(`[${viewName}] ready in ${Math.round(performance.now() - t0)}ms`);
                    if (!overlay.isConnected) return;
                    overlay.style.opacity = '0';
                    overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
                    setTimeout(() => { if (overlay.isConnected) overlay.remove(); }, 350);
                    window.viewReady = null;
                };

                loadedViews[viewName].init = window[initFn];
                window[initFn]();
            }
            currentView = viewName;
            sessionStorage.setItem('activeView', viewName);
        })
        .catch(error => {
            contentContainer.innerHTML = `
                <div style="text-align:center;padding:50px;color:red;">
                    <h2>Error Loading View</h2>
                    <p>${error.message}</p>
                </div>`;
        });
}

function loadCSS(href) {
    return new Promise((resolve) => {
        if (document.querySelector(`link[href="${href}"]`)) { resolve(); return; }
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.onload  = resolve;
        link.onerror = resolve;
        document.head.appendChild(link);
    });
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.body.appendChild(script);
    });
}

function capitalize(str) {
    return str.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
}

document.addEventListener('DOMContentLoaded', async () => {
    // Full-snapshot backup: per-session reconcile (pull or push by newest),
    // so the newest copy wins before any view renders.
    if (window.GistBackup?.isConnected()) {
        try {
            const { action } = await GistBackup.reconcileOnOpen();
            if (action && action !== 'none' && action !== 'insync') {
                console.log('[gist-backup] session reconcile:', action);
            }
        } catch (e) { console.warn('[gist-backup] reconcile skipped:', e.message); }
    }
    // Refresh FX rates if stale, but never let a slow rates service block the
    // UI — cap the wait and fall back to cached rates (totals are approximate).
    if (window.FxRates) {
        const cap = new Promise(res => setTimeout(res, 2500));
        try { await Promise.race([FxRates.maybeRefresh(), cap]); }
        catch (e) { console.warn('[fx] rate refresh skipped:', e.message); }
    }
    // Bring any legacy category slugs up to date before a view reads the store.
    // Runs after the Gist pulls above so freshly-pulled remote data is migrated
    // too; the corrected set is pushed back on the next commit.
    migrateCategories();
    purgeLegacyTimeTracking();

    // Guard against a stale sessionStorage pointing at a view that no longer
    // exists (e.g. the removed time-tracking view) — fall back to Home so a
    // restore can never 404 into the error state.
    const REMOVED_VIEWS = ['time-tracking'];
    const saved = sessionStorage.getItem('activeView');
    loadView(saved && !REMOVED_VIEWS.includes(saved) ? saved : 'home');
});

let homeDonutChart = null;

function initHome() {
    const STORAGE_KEY = 'dashboard_committed';

    // Shared category definition from app.js (loaded globally). The donut only
    // needs key/label/colour; the icon field is simply unused here.
    const EXPENSE_CATS = EXPENSE_CATEGORIES;

    // --- Load committed entries ---
    let entries = [];
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) entries = JSON.parse(raw).entries || [];
    } catch (e) {}

    // --- All-time total saved (deposits minus reserve withdrawals) ---
    // Approximate, converted into the regional currency when FX rates are
    // available (savings may sit in foreign currencies via Savings → Other).
    let totalSaved = 0;
    if (window.FxRates) {
        totalSaved = FxRates.netSavingsRegional(entries);
    } else {
        entries.forEach(e => {
            if (e.type === 'savings') totalSaved += e.amount;
            else if (isSavingsWithdrawal(e)) totalSaved -= e.amount;
        });
    }

    // --- Current month bounds/aggregation helpers ---
    function getMonthBounds(year, month) {
        const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
        const last  = new Date(year, month + 1, 0).getDate();
        const end   = `${year}-${String(month + 1).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
        return { start, end };
    }

    function sumMonth(start, end) {
        const me = entries.filter(e => e.date >= start && e.date <= end);
        let income = 0, expenses = 0, savings = 0, savingsFlow = 0, rent = 0;
        me.forEach(e => {
            if (e.type === 'income') {
                if (!isOpeningBalance(e)) income += e.amount;   // opening balance is not earned income
            } else if (isSavingsWithdrawal(e)) {
                savings -= e.amount;              // reserve drawdown, not an expense
            } else if (e.type === 'expenses') {
                expenses += e.amount;
                if (e.category === 'rent') rent += e.amount;
            } else if (e.type === 'savings') {
                savings += e.amount;
                if (e.category === 'flow') savingsFlow += e.amount;
            }
        });
        return { entries: me, income, expenses, savings, savingsFlow, rent };
    }

    // Always the true current calendar month — no fallback to a past month,
    // even if it has no income recorded yet. Monthly Income/Expenses, Runway,
    // and Financial Health all read this directly.
    const now = new Date();
    const refYear = now.getFullYear();
    const refMonth = now.getMonth();
    const ref = sumMonth(...Object.values(getMonthBounds(refYear, refMonth)));

    const { start: monthStart, end: monthEnd } = getMonthBounds(refYear, refMonth);
    const periodLabel = new Date(refYear, refMonth, 1)
        .toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    const periodEl = document.getElementById('home-health-period');
    if (periodEl) periodEl.textContent = periodLabel;
    const runwayPeriodEl = document.getElementById('home-runway-period');
    if (runwayPeriodEl) runwayPeriodEl.textContent = periodLabel;
    const monthEntries     = ref.entries;
    const monthIncome      = ref.income;
    const monthExpenses    = ref.expenses;
    // Savings Rate measures income-funded saving, so it uses Flow-category
    // savings only — not net reserve movement. Otherwise a Savings → Other
    // deposit (external money) could push the rate over 100%, and a reserve
    // withdrawal could drive it negative.
    const monthSavingsFlow = ref.savingsFlow;
    const monthRent        = ref.rent;

    // All-time spendable balance: opening balance + earned income − Flow-category
    // savings − expenses. Uses the canonical Flow formula from calculator.js
    // (loaded globally in index.html) so it can never drift from the Overview.
    // `potential` is the partner's growing net pool (Potential type), kept out of
    // Flow and shown only as a sub-value here. See isPotential() / calculator.js.
    const totals    = recalculateTotals(entries);
    const available = totals.flow;
    const potential = totals.potential;

    // --- Balance panel ---
    // Available and Potential are the two stacked components; Balance
    // (Available + potential) is the panel's headline result, on the right —
    // always shown (zero Potential when no Potential entries exist) so the
    // panel keeps a fixed layout regardless of solo/partnered use. Each value
    // is mirrored into the Details overlay (the "-overlay" ids), which shows
    // this same breakdown alongside Runway rather than replacing it.
    function setValue(id, text, negClass, negative) {
        [id, id + '-overlay'].forEach(elId => {
            const el = document.getElementById(elId);
            if (!el) return;
            el.textContent = text;
            if (negClass) el.classList.toggle(negClass, negative);
        });
    }

    setValue('home-available', available.toFixed(2), 'home-card__stack-value--negative', available < 0);

    const together = available + potential;
    setValue('home-potential', (potential >= 0 ? '+ ' : '− ') + Math.abs(potential).toFixed(2),
        'home-card__stack-value--negative', potential < 0);
    setValue('home-together', together.toFixed(2), 'home-card__value--negative', together < 0);

    // Runway: this month's income vs expenses only — the in-month drift in
    // funds. Deliberately ignores Starting Funds and all prior months, so it
    // reads independently of the Balance above. Shown in the Balance panel's
    // Details overlay (setupBalanceDetails()) rather than its own card.
    const runway = monthIncome - monthExpenses;
    document.getElementById('home-runway-income').textContent   = monthIncome.toFixed(2);
    document.getElementById('home-runway-expenses').textContent = monthExpenses.toFixed(2);
    const runwayEl = document.getElementById('home-runway');
    runwayEl.textContent = runway.toFixed(2);
    runwayEl.classList.toggle('home-card__value--negative', runway < 0);

    setupBalanceDetails();

    // --- Recent Transactions ---
    // Full tx-history component (shared with Dashboard) fitted into this
    // panel via .home-tx-embed (home.css) — same filters, Full History
    // overlay, and per-entry edit button as the Dashboard.
    const txHistoryReady = renderHomeTxHistory(entries);

    // --- Financial Health bars ---
    function setBar(fillId, valId, ratio, threshold, higherIsGood) {
        const fillEl = document.getElementById(fillId);
        const valEl  = document.getElementById(valId);
        if (!fillEl || !valEl) return;

        if (monthIncome === 0) {
            valEl.textContent    = '--';
            fillEl.style.width   = '0%';
            fillEl.dataset.status = '';
            return;
        }

        valEl.textContent  = (ratio * 100).toFixed(1) + '%';
        fillEl.style.width = Math.min(ratio / threshold, 1) * 100 + '%';

        let status;
        if (higherIsGood) {
            status = ratio >= threshold ? 'good' : ratio >= threshold * 0.5 ? 'warn' : 'bad';
        } else {
            status = ratio <= threshold * 0.85 ? 'good' : ratio <= threshold ? 'warn' : 'bad';
        }
        fillEl.dataset.status = status;
    }

    setBar('home-savings-rate-fill',  'home-savings-rate-val',  monthIncome > 0 ? monthSavingsFlow / monthIncome : 0, 0.20, true);
    setBar('home-expense-ratio-fill', 'home-expense-ratio-val', monthIncome > 0 ? monthExpenses / monthIncome : 0, 0.80, false);
    setBar('home-rent-burden-fill',   'home-rent-burden-val',   monthIncome > 0 ? monthRent / monthIncome     : 0, 0.30, false);

    // --- Savings Holdings sheet ---
    // Gross savings deposits grouped by currency + holding type (visual only,
    // no conversion). Withdrawals (reserve drawdowns) are not netted here. The
    // bottom-line total is the net, regional-converted figure that used to be
    // the standalone "Total Saved" KPI card.
    renderHomeHoldings(entries, totalSaved);

    // --- Charts ---
    if (homeDonutChart) { homeDonutChart.destroy(); homeDonutChart = null; }

    const chartsReady = loadScript('https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js')
        .then(() => {
            homeDonutChart = renderHomeDonut(monthEntries, EXPENSE_CATS);
            return setupExpenseBreakdown(entries);
        });

    Promise.all([chartsReady, txHistoryReady]).then(() => window.viewReady?.());
}

// Embeds the Dashboard's own tx-history component (filters, Full History
// overlay, edit-pencil modal) into this panel, sized down via .home-tx-embed
// (home.css) instead of a separate read-only 5-item list. Loaded on demand,
// same as Dashboard does for its own copy — reusing the identical HTML/CSS/JS
// keeps behaviour in one place; only the surrounding CSS differs per view.
function renderHomeTxHistory(entries) {
    const slot = document.getElementById('home-tx-history-slot');
    if (!slot) return Promise.resolve();

    // The shared entry-editor modal mutates the edited entry in place, then
    // calls this hook so Home can recalc/persist/re-render exactly as it
    // would on a fresh load. Reassigned every call so it always closes over
    // the current `entries` array.
    window.onEntryCommitted = () => { commitEntries(entries); initHome(); };

    if (slot.dataset.loaded) {
        // Already embedded earlier during this Home visit (e.g. re-rendering
        // after an edit) — just refresh the rows, which preserves the Full
        // History expand/collapse state instead of resetting it.
        renderTxList(entries);
        return Promise.resolve();
    }

    return loadScript('components/entry-editor/entry-editor.js')
        .then(() => {
            loadCSS('components/entry-editor/entry-editor.css');
            return fetch('views/dashboard/tx-history/tx-history.html');
        })
        .then(r => r.text())
        .then(html => {
            slot.innerHTML = html;
            loadCSS('views/dashboard/tx-history/tx-history.css');
            return loadScript('views/dashboard/tx-history/tx-history.js');
        })
        .then(() => {
            initTxHistory();
            renderTxList(entries);
            slot.dataset.loaded = 'true';
        });
}

// Wires the Balance card's "Details" toggle. Rather than stretching the card
// in place, this follows setupExpenseBreakdown()'s exact principle: a FLIP
// animation grows a fixed-position overlay from the card's own rect to a
// centered footprint, with a blurred backdrop that dismisses it on click. The
// one difference is the overlay's content is static markup already in
// home.html (the same Available/Potential/Balance breakdown plus this
// month's Runway), so there's no async component to load — expand()/
// collapse() run synchronously.
function setupBalanceDetails() {
    const card     = document.getElementById('home-balance-card');
    const toggle   = document.getElementById('home-balance-toggle');
    const overlay  = document.getElementById('home-balance-overlay');
    const backdrop = document.getElementById('home-balance-backdrop');
    if (!card || !toggle || !overlay || !backdrop) return;

    let animToken = 0;

    function getAnimMs() {
        const raw = getComputedStyle(document.documentElement)
            .getPropertyValue('--home-expand-anim-duration').trim();
        const value = parseFloat(raw);
        if (!value) return 500;
        return raw.endsWith('ms') ? value : value * 1000;
    }

    // A small content-sized box, horizontally centered within
    // .content-container (same bounds the chart overlay uses) rather than
    // the full window — unlike the chart, it doesn't need that full width,
    // just to stay inside the same reading column instead of the whole page.
    function computeExpandedRect() {
        const content = document.querySelector('.content-container');
        const contentRect = content
            ? content.getBoundingClientRect()
            : { left: 20, width: window.innerWidth - 40 };
        const width  = Math.min(360, contentRect.width - 40);
        const height = Math.min(320, window.innerHeight - 96);
        return {
            top:  (window.innerHeight - height) / 2,
            left: contentRect.left + (contentRect.width - width) / 2,
            width,
            height,
        };
    }

    function applyRect(rect) {
        overlay.style.top    = rect.top + 'px';
        overlay.style.left   = rect.left + 'px';
        overlay.style.width  = rect.width + 'px';
        overlay.style.height = rect.height + 'px';
    }

    function positionOverlay() {
        if (!overlay.classList.contains('expanded')) return;
        applyRect(computeExpandedRect());
    }

    function expand() {
        animToken++;
        const startRect = card.getBoundingClientRect();

        overlay.classList.add('expanded');
        backdrop.classList.add('active');
        toggle.textContent = 'Close';

        applyRect(startRect);
        void overlay.offsetHeight;   // force reflow before enabling the transition
        overlay.classList.add('home-balance-anim');
        applyRect(computeExpandedRect());

        window.addEventListener('resize', positionOverlay);
    }

    function collapse() {
        const myToken = ++animToken;
        window.removeEventListener('resize', positionOverlay);

        backdrop.classList.remove('active');
        toggle.textContent = 'Details';
        applyRect(card.getBoundingClientRect());

        setTimeout(() => {
            if (myToken !== animToken) return;   // a new expand()/collapse() has since started
            overlay.classList.remove('expanded', 'home-balance-anim');
            overlay.style.top = overlay.style.left = overlay.style.width = overlay.style.height = '';
        }, getAnimMs());
    }

    toggle.onclick = () => {
        overlay.classList.contains('expanded') ? collapse() : expand();
    };
    backdrop.onclick = collapse;

    // If Home is re-rendering in place (e.g. after committing an edited
    // entry) while the overlay is already open, just keep it positioned —
    // its content (Balance breakdown + Runway) was already re-rendered above.
    if (overlay.classList.contains('expanded')) {
        positionOverlay();
    }
}

function renderHomeHoldings(entries, totalSaved) {
    const el = document.getElementById('home-holdings');
    if (!el) return;

    const totalEl = document.getElementById('home-holdings-total');
    if (totalEl) {
        totalEl.textContent = '≈ ' + totalSaved.toFixed(2);
        totalEl.title = 'Approximate total in ' + getRegionalCurrency();
    }

    const regional = getRegionalCurrency();
    const groups = {};
    entries.forEach(e => {
        if (e.type !== 'savings') return;
        const currency = e.currency || regional;
        const holding  = e.holding || 'other';
        const key = `${currency}|${holding}`;
        if (!groups[key]) groups[key] = { currency, holding, amount: 0 };
        groups[key].amount += e.amount;
    });

    const rows = Object.values(groups).sort((a, b) =>
        a.currency.localeCompare(b.currency) || b.amount - a.amount
    );

    if (rows.length === 0) {
        el.innerHTML = '<div class="home-no-data">No savings recorded yet</div>';
        return;
    }

    el.innerHTML = `
        <table class="holdings-table">
            <thead>
                <tr>
                    <th class="holdings-amount">Amount</th>
                    <th>Currency</th>
                    <th>Type</th>
                </tr>
            </thead>
            <tbody>
                ${rows.map(r => {
                    const meta = getCurrencyMeta(r.currency);
                    const sym  = meta.symbol ? `${meta.symbol} ` : '';
                    return `<tr>
                        <td class="holdings-amount">${sym}${r.amount.toFixed(2)}</td>
                        <td><span class="holdings-currency">${r.currency}</span></td>
                        <td class="holdings-type">${getHoldingLabel(r.holding)}</td>
                    </tr>`;
                }).join('')}
            </tbody>
        </table>`;
}

// Wires the Expense Breakdown panel's Expand toggle. The donut panel itself
// is never touched — Expand instead pulls the Dashboard's own
// expenses-chart component (period picker, legend, period file ops) out into
// a fixed overlay, following the exact same principle as Recent
// Transactions' "Full History" overlay (tx-history.js): a FLIP animation
// that grows a fixed-position element from a start rect to a target rect
// sized like .content-container, plus a backdrop. The one difference is the
// start rect — tx-history animates its own already-visible compact list,
// but this overlay has no compact on-page form of its own, so it grows from
// the Expense Breakdown card's rect instead, which reads as "pulling the
// window out of this card" while leaving the donut inside undisturbed.
function setupExpenseBreakdown(entries) {
    const panel    = document.getElementById('home-expenses-panel');
    const toggle   = document.getElementById('home-expenses-toggle');
    const overlay  = document.getElementById('home-expenses-overlay');
    const backdrop = document.getElementById('home-expenses-backdrop');
    if (!panel || !toggle || !overlay || !backdrop) return Promise.resolve();

    // The chart's period-import feature (like tx-history's editor) needs a
    // hook to commit the merged entries and refresh the whole view.
    window.applyPeriodImport = (updatedEntries) => { commitEntries(updatedEntries); initHome(); };

    let animToken = 0;

    function getAnimMs() {
        const raw = getComputedStyle(document.documentElement)
            .getPropertyValue('--home-expand-anim-duration').trim();
        const value = parseFloat(raw);
        if (!value) return 500;
        return raw.endsWith('ms') ? value : value * 1000;
    }

    // Same target rect Full History uses: the current .content-container
    // bounds (inset 15px each side), vertically centered in the viewport.
    function computeExpandedRect() {
        const content = document.querySelector('.content-container');
        const inset = 15;
        const contentRect = content
            ? content.getBoundingClientRect()
            : { left: inset, width: window.innerWidth - inset * 2 };
        const height = Math.min(640, window.innerHeight - 96);
        return {
            top:    (window.innerHeight - height) / 2,
            left:   contentRect.left + inset,
            width:  contentRect.width - inset * 2,
            height,
        };
    }

    function applyRect(rect) {
        overlay.style.top    = rect.top + 'px';
        overlay.style.left   = rect.left + 'px';
        overlay.style.width  = rect.width + 'px';
        overlay.style.height = rect.height + 'px';
    }

    function positionOverlay() {
        if (!overlay.classList.contains('expanded')) return;
        applyRect(computeExpandedRect());
    }

    function ensureChartLoaded() {
        if (overlay.dataset.loaded) return Promise.resolve();
        return loadScript('engine/periods.js')
            .then(() => fetch('views/dashboard/expenses-chart/expenses-chart.html'))
            .then(r => r.text())
            .then(html => {
                overlay.innerHTML = html;
                loadCSS('views/dashboard/expenses-chart/expenses-chart.css');
                return loadScript('views/dashboard/expenses-chart/expenses-chart.js');
            })
            .then(() => {
                initExpensesChart();
                overlay.dataset.loaded = 'true';
            });
    }

    function expand() {
        animToken++;
        const startRect = panel.getBoundingClientRect();

        return ensureChartLoaded().then(() => {
            renderExpensesChart(entries);

            overlay.classList.add('expanded');
            backdrop.classList.add('active');
            toggle.textContent = 'Collapse';

            applyRect(startRect);
            void overlay.offsetHeight;   // force reflow before enabling the transition
            overlay.classList.add('home-expenses-anim');
            applyRect(computeExpandedRect());

            window.addEventListener('resize', positionOverlay);
        });
    }

    function collapse() {
        const myToken = ++animToken;
        window.removeEventListener('resize', positionOverlay);

        backdrop.classList.remove('active');
        toggle.textContent = 'Expand';
        applyRect(panel.getBoundingClientRect());

        setTimeout(() => {
            if (myToken !== animToken) return;   // a new expand()/collapse() has since started
            overlay.classList.remove('expanded', 'home-expenses-anim');
            overlay.style.top = overlay.style.left = overlay.style.width = overlay.style.height = '';
        }, getAnimMs());
    }

    toggle.onclick = () => {
        overlay.classList.contains('expanded') ? collapse() : expand();
    };
    backdrop.onclick = collapse;

    // If Home is re-rendering in place (e.g. after committing an edited
    // entry) while the overlay is already open, just refresh its data —
    // don't replay the open animation.
    if (overlay.classList.contains('expanded')) {
        return ensureChartLoaded().then(() => renderExpensesChart(entries));
    }
    return Promise.resolve();
}

function renderHomeDonut(monthEntries, EXPENSE_CATS) {
    const canvas = document.getElementById('home-donut-chart');
    if (!canvas) return null;

    const totals = {};
    monthEntries.filter(e => e.type === 'expenses' && !isSavingsWithdrawal(e)).forEach(e => {
        totals[e.category] = (totals[e.category] || 0) + e.amount;
    });

    const active = EXPENSE_CATS.filter(c => totals[c.key] > 0);
    if (active.length === 0) {
        canvas.parentElement.innerHTML = '<div class="home-no-data">No expenses this month</div>';
        return null;
    }

    return new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: active.map(c => c.label),
            datasets: [{
                data: active.map(c => totals[c.key]),
                backgroundColor: active.map(c => c.color + '99'),
                borderColor:     active.map(c => c.color),
                borderWidth: 1,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: { label: item => ` ${item.label}: ${item.parsed.toFixed(2)}` }
                }
            }
        }
    });
}

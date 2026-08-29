function initDashboard() {
    console.log('Dashboard view initialized');

    const STORAGE_KEY = 'dashboard_committed';

    // Category options per type come from the shared ENTRY_CATEGORIES (app.js),
    // used identically by the entry editor modal (components/entry-editor).
    const categories = ENTRY_CATEGORIES;

    let committed = {
        income: 0, savings: 0, savingsFromFlow: 0,
        expenses: 0, flow: 0, entries: [],
    };
    let staged = [];
    let startingFundsLocked = false;

    // --- Elements ---
    const selectType    = document.getElementById('select-type');
    const selectCategory= document.getElementById('select-category');
    const selectCurrency= document.getElementById('select-currency');
    const selectHolding = document.getElementById('select-holding');
    const inputDate     = document.getElementById('input-date');
    const inputAmount   = document.getElementById('input-amount');
    const btnAdd        = document.getElementById('btn-add');
    const btnApply      = document.getElementById('btn-apply');
    const historyEl     = document.getElementById('entries-history');
    const inputNote     = document.getElementById('input-note');
    const btnExport     = document.getElementById('btn-export');
    const inputImport   = document.getElementById('input-import');
    const inputFilename = document.getElementById('input-filename');
    const btnFileToggle = document.getElementById('btn-file-toggle');
    const fileOpsPanel  = document.getElementById('file-ops-panel');

    inputDate.value     = new Date().toISOString().split('T')[0];
    inputFilename.value = `dashboard-${new Date().toISOString().split('T')[0]}`;

    // --- File ops toggle ---
    btnFileToggle.addEventListener('click', () => {
        const isOpen = fileOpsPanel.classList.toggle('open');
        btnFileToggle.classList.toggle('active', isOpen);
    });

    document.addEventListener('click', (e) => {
        if (fileOpsPanel.classList.contains('open') &&
            !fileOpsPanel.contains(e.target) &&
            e.target !== btnFileToggle) {
            fileOpsPanel.classList.remove('open');
            btnFileToggle.classList.remove('active');
        }
    });

    // --- localStorage ---
    function loadFromStorage() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                committed = JSON.parse(raw);
                startingFundsLocked = committed.entries.some(e => e.category === 'starting_funds');
                populateCategories();
                renderTxList(committed.entries);
            }
        } catch(e) { console.warn('Could not load:', e); }
        renderExpensesChart(committed.entries);
    }

    // --- Categories ---
    function populateCategories() {
        const type = selectType.value;
        selectCategory.innerHTML = '';
        categories[type].forEach(cat => {
            if (cat === 'Starting Funds' && startingFundsLocked) return;
            const opt = document.createElement('option');
            opt.value = cat.toLowerCase().replace(/ /g, '_');
            opt.textContent = cat;
            selectCategory.appendChild(opt);
        });
    }

    // --- Currency & holding ---
    // Currency defaults to the regional currency and stays locked, except for a
    // Savings → Other entry (money entering the reserve from outside the Flow),
    // which may be in a foreign currency. Holding type only applies to Savings.
    function populateCurrency() {
        const cfg = getCurrencyConfig();
        selectCurrency.innerHTML = '';
        cfg.list.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.code;
            opt.textContent = c.symbol ? `${c.code} ${c.symbol}` : c.code;
            selectCurrency.appendChild(opt);
        });
        selectHolding.innerHTML = '';
        HOLDING_TYPES.forEach(h => {
            const opt = document.createElement('option');
            opt.value = h.key;
            opt.textContent = h.label;
            selectHolding.appendChild(opt);
        });
    }

    function updateCurrencyHoldingState() {
        const type     = selectType.value;
        const category = selectCategory.value;
        const regional = getRegionalCurrency();
        const foreignAllowed = type === 'savings' && category === 'other';

        selectHolding.style.display = type === 'savings' ? '' : 'none';

        if (foreignAllowed) {
            selectCurrency.disabled = false;
        } else {
            selectCurrency.value = regional;
            selectCurrency.disabled = true;
        }
    }

    populateCurrency();

    selectType.addEventListener('change', () => { populateCategories(); updateCurrencyHoldingState(); });
    selectCategory.addEventListener('change', updateCurrencyHoldingState);
    populateCategories();
    updateCurrencyHoldingState();

    // --- Staged entries ---
    function renderHistory() {
        if (staged.length === 0) {
            historyEl.innerHTML = '<div class="entries-empty">No staged entries yet</div>';
            btnApply.disabled = true;
            return;
        }
        historyEl.innerHTML = '';
        staged.forEach((entry, index) => {
            const item = document.createElement('div');
            item.className = 'entry-item';
            item.innerHTML = `
                <div class="entry-body">
                    <div class="entry-meta">
                        <span class="entry-date">${entry.date}</span>
                        <span class="entry-amount">${entry.amount.toFixed(2)}</span>
                        <span class="entry-type">${capitalize(entry.type)}</span>
                        <span class="entry-category">${entry.categoryLabel}</span>
                        <span class="entry-currency">${entry.currency || getRegionalCurrency()}</span>
                        ${entry.holding ? `<span class="entry-holding">${getHoldingLabel(entry.holding)}</span>` : ''}
                    </div>
                    ${entry.note ? `<div class="entry-note">${entry.note}</div>` : ''}
                </div>
                <button class="entry-delete" data-index="${index}">🗑</button>
            `;
            historyEl.appendChild(item);
        });
        btnApply.disabled = false;
        historyEl.querySelectorAll('.entry-delete').forEach(btn => {
            btn.addEventListener('click', () => {
                const i = parseInt(btn.dataset.index);
                if (staged[i].category === 'starting_funds') {
                    startingFundsLocked = false;
                    populateCategories();
                }
                staged.splice(i, 1);
                renderHistory();
            });
        });
    }

    // --- Add ---
    btnAdd.addEventListener('click', () => {
        const amount = parseFloat(inputAmount.value);
        if (isNaN(amount)) return;
        const type          = selectType.value;
        const category      = selectCategory.value;
        const categoryLabel = selectCategory.options[selectCategory.selectedIndex].text;
        const date          = inputDate.value;
        if (category === 'starting_funds') { startingFundsLocked = true; populateCategories(); }
        const note = inputNote.value.trim();
        const currency = selectCurrency.disabled ? getRegionalCurrency() : selectCurrency.value;
        const holding  = type === 'savings' ? selectHolding.value : undefined;
        staged.push({
            date, amount, type, category, categoryLabel, currency,
            ...(holding && { holding }),
            ...(note && { note }),
        });
        renderHistory();
        inputAmount.value = '';
        inputNote.value   = '';
    });

    // --- Apply ---
    btnApply.addEventListener('click', () => {
        applyCommitted([...committed.entries, ...staged]);
        staged = [];
        renderHistory();
    });

    // --- Commit a new set of entries and refresh all views ---
    // commitEntries() (app.js) handles recalc + persist + Gist push, shared
    // with any other view that commits an edit (e.g. Home's embedded list).
    function applyCommitted(entries) {
        committed = commitEntries(entries);
        startingFundsLocked = committed.entries.some(e => e.category === 'starting_funds');
        populateCategories();
        renderTxList(committed.entries);
        renderExpensesChart(committed.entries);
    }
    window.applyPeriodImport = applyCommitted;

    // The entry editor (components/entry-editor) is shared across views; it
    // mutates the given entry in place and calls this hook to let Dashboard
    // recalc/persist/re-render in its own way (keeping `staged` untouched).
    window.onEntryCommitted = () => applyCommitted([...committed.entries]);

    // --- Export ---
    btnExport.addEventListener('click', () => {
        const filename = (inputFilename.value.trim() || 'dashboard-backup') + '.json';
        // Export only `entries` — the source of truth. Totals are derived on
        // import via recalculateTotals(), so writing them here would be
        // misleading (hand-editing them has no effect).
        const blob = new Blob([JSON.stringify({ entries: committed.entries }, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
    });

    // --- Import ---
    inputImport.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = JSON.parse(ev.target.result);
                applyCommitted(data.entries || []);
            } catch(err) { console.error('Import failed:', err); }
        };
        reader.readAsText(file);
        inputImport.value = '';
    });

    function capitalize(str) { return str.charAt(0).toUpperCase() + str.slice(1); }

    // --- Load Chart.js then components ---
    const chartSlot = document.getElementById('expenses-chart-slot');
    const txSlot    = document.getElementById('tx-history-slot');

    loadScript('https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js')
        .then(() => loadScript('engine/periods.js'))
        .then(() => loadScript('engine/calculator.js'))
        .then(() => fetch('views/dashboard/expenses-chart/expenses-chart.html'))
        .then(r => r.text())
        .then(html => {
            chartSlot.innerHTML = html;
            loadCSS('views/dashboard/expenses-chart/expenses-chart.css');
            return loadScript('views/dashboard/expenses-chart/expenses-chart.js');
        })
        .then(() => {
            initExpensesChart();
            loadCSS('components/entry-editor/entry-editor.css');
            return loadScript('components/entry-editor/entry-editor.js');
        })
        .then(() => fetch('views/dashboard/tx-history/tx-history.html'))
        .then(r => r.text())
        .then(html => {
            txSlot.innerHTML = html;
            loadCSS('views/dashboard/tx-history/tx-history.css');
            return loadScript('views/dashboard/tx-history/tx-history.js');
        })
        .then(() => {
            initTxHistory();
            loadFromStorage();
            window.viewReady?.();
        });
}

// EXPENSE_CATEGORIES is the shared definition from app.js (loaded globally).

let expensesChartInstance = null;
let currentEntries = [];

function initExpensesChart() {
    const legendGrid  = document.getElementById('legend-grid');
    const periodStart = document.getElementById('period-start');
    const periodEnd   = document.getElementById('period-end');

    // --- Period picker ---
    const defaultPeriod = getDefaultPeriod();
    periodStart.value = defaultPeriod.start;
    periodEnd.value   = defaultPeriod.end;

    // --- Period file ops ---
    const btnPeriodFileToggle  = document.getElementById('btn-period-file-toggle');
    const periodFileOpsPanel   = document.getElementById('period-file-ops-panel');
    const periodInputFilename  = document.getElementById('period-input-filename');
    const periodInputImport    = document.getElementById('period-input-import');
    const btnExportPeriod      = document.getElementById('btn-export-period');

    function updatePeriodFilename() {
        const period = getSelectedPeriod();
        periodInputFilename.value = `dashboard-${period.start}_to_${period.end}`;
    }
    updatePeriodFilename();

    [periodStart, periodEnd].forEach(input => {
        input.addEventListener('change', () => {
            renderExpensesChart(currentEntries);
            updatePeriodFilename();
        });
    });

    btnPeriodFileToggle.addEventListener('click', () => {
        const isOpen = periodFileOpsPanel.classList.toggle('open');
        btnPeriodFileToggle.classList.toggle('active', isOpen);
    });

    document.addEventListener('click', (e) => {
        if (periodFileOpsPanel.classList.contains('open') &&
            !periodFileOpsPanel.contains(e.target) &&
            e.target !== btnPeriodFileToggle) {
            periodFileOpsPanel.classList.remove('open');
            btnPeriodFileToggle.classList.remove('active');
        }
    });

    // --- Export selected period ---
    btnExportPeriod.addEventListener('click', () => {
        const period       = getSelectedPeriod();
        const periodEntries = filterEntriesByPeriod(currentEntries, period);
        // Only `entries` are exported — totals are derived on import.
        const data         = { entries: periodEntries, period };
        const filename     = (periodInputFilename.value.trim() || `dashboard-${period.start}_to_${period.end}`) + '.json';

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
    });

    // --- Import into selected period (replaces existing entries within the period) ---
    periodInputImport.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data       = JSON.parse(ev.target.result);
                const imported   = data.entries || [];
                const period     = getSelectedPeriod();
                const remaining  = currentEntries.filter(entry => !isEntryInPeriod(entry, period));
                window.applyPeriodImport([...remaining, ...imported]);
            } catch(err) { console.error('Period import failed:', err); }
        };
        reader.readAsText(file);
        periodInputImport.value = '';
    });

    // --- Build legend ---
    EXPENSE_CATEGORIES.forEach(cat => {
        const item = document.createElement('div');
        item.className = 'legend-item';
        item.innerHTML = `
            <div class="legend-icon" style="background-color: ${cat.color}22;" title="${cat.label}">
                <i class="ti ${cat.icon}" style="color: ${cat.color}; font-size: 14px;"></i>
            </div>
            <span>${cat.label}</span>
        `;
        legendGrid.appendChild(item);
    });
}

// Reads the period from the date pickers, falling back to (and writing back) the default period if empty/invalid
function getSelectedPeriod() {
    const periodStart = document.getElementById('period-start');
    const periodEnd   = document.getElementById('period-end');

    let period = { start: periodStart.value, end: periodEnd.value };
    if (!period.start || !period.end || period.start > period.end) {
        period = getDefaultPeriod();
        periodStart.value = period.start;
        periodEnd.value   = period.end;
    }
    return period;
}

function renderExpensesChart(entries) {
    currentEntries = entries;

    const period = getSelectedPeriod();

    // Filter expenses within the selected period
    const periodEntries = filterEntriesByPeriod(entries, period)
        .filter(e => e.type === 'expenses');

    // Sum per category
    const totals = {};
    periodEntries.forEach(e => {
        totals[e.category] = (totals[e.category] || 0) + e.amount;
    });

    // All categories, sorted descending by spend
    const active = EXPENSE_CATEGORIES
        .slice()
        .sort((a, b) => (totals[b.key] || 0) - (totals[a.key] || 0));

    const canvas  = document.getElementById('expenses-chart');

    if (!canvas) return;

    const labels   = active.map(c => '');
    const data     = active.map(c => totals[c.key] || 0);
    const colors   = active.map(c => c.color);
    const icons    = active.map(c => c.icon);

    // Y-axis max snaps to the next 500; if spending reaches the top of the
    // range exactly, project into the next 500 range for headroom.
    const maxSpending = Math.max(...data);
    let yMax = Math.ceil(maxSpending / 500) * 500;
    if (yMax === maxSpending) yMax += 500;
    yMax = Math.max(500, yMax);

    if (expensesChartInstance) expensesChartInstance.destroy();

    expensesChartInstance = new Chart(canvas, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: colors.map(c => c + '99'),
                borderColor: colors,
                borderWidth: 1,
                borderRadius: 4,
                borderSkipped: false,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: { top: 34 } // reserve space for the category icon + background above the tallest bar
            },
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    yAlign: 'bottom',
                    caretPadding: 38, // clear the category icon background box (max 30px) drawn above the bar
                    callbacks: {
                        title: (items) => active[items[0].dataIndex].label,
                        label: (item) => ` ${item.parsed.y.toFixed(2)}`,
                    }
                }
            },
            scales: {
                x: {
                    ticks: { display: false },
                    grid: { color: '#1e1e2e' },
                    border: { color: '#1e1e2e' },
                },
                y: {
                    max: yMax,
                    ticks: {
                        color: '#888',
                        font: { size: 11 },
                        callback: v => v.toFixed(0),
                    },
                    grid: { color: '#1e1e2e' },
                    border: { color: '#1e1e2e' },
                }
            }
        },
        plugins: [{
            id: 'iconPlugin',
            afterDraw(chart) {
                const ctx  = chart.ctx;
                const meta = chart.getDatasetMeta(0);
                meta.data.forEach((bar, i) => {
                    const cat      = active[i];
                    const centerX  = bar.x;
                    const barTop   = bar.y;
                    const iconSize = Math.min(bar.width * 0.6, 20);
                    const boxSize  = iconSize + 10;
                    const boxRadius = boxSize / 6;
                    const boxBottom = barTop - 4;
                    const boxCenterY = boxBottom - boxSize / 2;

                    // Icon background, matching legend's tinted swatch
                    ctx.save();
                    ctx.fillStyle = cat.color + '22';
                    ctx.beginPath();
                    ctx.roundRect(centerX - boxSize / 2, boxBottom - boxSize, boxSize, boxSize, boxRadius);
                    ctx.fill();
                    ctx.restore();

                    ctx.save();
                    ctx.font        = `${iconSize}px tabler-icons`;
                    ctx.fillStyle   = cat.color;
                    ctx.textAlign   = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(
                        String.fromCodePoint(getTablerCodepoint(cat.icon)),
                        centerX,
                        boxCenterY
                    );
                    ctx.restore();
                });
            }
        }]
    });
}

// Resolve a Tabler icon class to its glyph codepoint by reading the loaded
// webfont's own CSS (`.ti-xxx::before { content: "\eXXX" }`), so the canvas
// draws the same glyph the CSS `<i class="ti ...">` elements do. This works for
// any valid icon without a hand-maintained codepoint table; unknown classes
// resolve to '?' (0x003F). Results are cached — one probe per distinct icon.
const _tablerCodepointCache = {};
function getTablerCodepoint(iconClass) {
    if (iconClass in _tablerCodepointCache) return _tablerCodepointCache[iconClass];

    let cp = 0x003F;
    const probe = document.createElement('i');
    probe.className = 'ti ' + iconClass;
    probe.style.cssText = 'position:absolute;left:-9999px;visibility:hidden;';
    document.body.appendChild(probe);
    const content = getComputedStyle(probe, '::before').content;
    probe.remove();

    if (content && content !== 'none' && content !== 'normal') {
        const glyph = content.replace(/^["']|["']$/g, '');
        if (glyph) cp = glyph.codePointAt(0);
    }
    _tablerCodepointCache[iconClass] = cp;
    return cp;
}

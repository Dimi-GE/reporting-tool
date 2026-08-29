// entry-editor.js — shared "edit committed entry" modal.
// Loaded on demand by any view whose transaction list needs the pencil-button
// editor (Dashboard's own Recent Transactions and Home's embedded copy), so
// editing works regardless of which view initialized first. tx-history.js
// calls window.openEntryEditor(entry) directly; this module mutates that
// entry object in place (the caller's own array holds the same reference)
// and, on save, calls window.onEntryCommitted() — a hook each host view sets
// during its own init — so every view can recalc/persist/refresh in whatever
// way is right for it. This module never touches storage itself.
//
// Loaded once for the life of the page (loadScript() skips re-injecting an
// already-present <script src>), so the modal DOM is built exactly once no
// matter how many views load it or how many times a view is revisited.

let editorEls    = null;
let editingEntry = null;

function escHandlerEntryEditor(e) { if (e.key === 'Escape') closeEntryEditor(); }

function buildEntryEditor() {
    const wrap = document.createElement('div');
    wrap.innerHTML = `
        <div class="entry-editor-backdrop" id="entry-editor-backdrop"></div>
        <div class="entry-editor" id="entry-editor" role="dialog" aria-modal="true" aria-label="Edit entry">
            <div class="entry-editor__title">Edit Entry</div>
            <div class="entry-editor__grid">
                <label class="entry-editor__field"><span>Date</span><input type="date" id="edit-date"></label>
                <label class="entry-editor__field"><span>Amount</span><input type="number" id="edit-amount" step="0.01"></label>
                <label class="entry-editor__field"><span>Type</span>
                    <select id="edit-type">
                        <option value="income">Income</option>
                        <option value="savings">Savings</option>
                        <option value="expenses">Expenses</option>
                        <option value="potential">Potential</option>
                    </select>
                </label>
                <label class="entry-editor__field"><span>Category</span><select id="edit-category"></select></label>
                <label class="entry-editor__field" id="edit-currency-field"><span>Currency</span><select id="edit-currency"></select></label>
                <label class="entry-editor__field" id="edit-holding-field"><span>Holding</span><select id="edit-holding"></select></label>
                <label class="entry-editor__field entry-editor__field--full"><span>Note</span><input type="text" id="edit-note" placeholder="Note (optional)"></label>
            </div>
            <div class="entry-editor__actions">
                <button class="entry-editor__cancel" id="edit-cancel">Cancel</button>
                <button class="entry-editor__save" id="edit-save">Save</button>
            </div>
        </div>`;
    document.body.appendChild(wrap);

    editorEls = {
        backdrop:      wrap.querySelector('#entry-editor-backdrop'),
        modal:         wrap.querySelector('#entry-editor'),
        date:          wrap.querySelector('#edit-date'),
        amount:        wrap.querySelector('#edit-amount'),
        type:          wrap.querySelector('#edit-type'),
        category:      wrap.querySelector('#edit-category'),
        currency:      wrap.querySelector('#edit-currency'),
        holding:       wrap.querySelector('#edit-holding'),
        currencyField: wrap.querySelector('#edit-currency-field'),
        holdingField:  wrap.querySelector('#edit-holding-field'),
        note:          wrap.querySelector('#edit-note'),
        save:          wrap.querySelector('#edit-save'),
        cancel:        wrap.querySelector('#edit-cancel'),
    };

    editorEls.holding.innerHTML = HOLDING_TYPES
        .map(h => `<option value="${h.key}">${h.label}</option>`).join('');

    editorEls.type.addEventListener('change', () => {
        populateEditCategories();
        updateEditCurrencyHolding();
    });
    editorEls.category.addEventListener('change', updateEditCurrencyHolding);
    editorEls.cancel.addEventListener('click', closeEntryEditor);
    editorEls.backdrop.addEventListener('click', closeEntryEditor);
    editorEls.save.addEventListener('click', saveEntryEditor);
}

// Options mirror the New Entry form (ENTRY_CATEGORIES, app.js), minus Starting
// Funds when some other committed entry already holds it. Read fresh from
// storage each time rather than a view's own in-memory lock flag, since this
// modal may be opened from a view that never tracked one.
function populateEditCategories(selected) {
    let startingFundsLocked = false;
    try {
        const raw = localStorage.getItem('dashboard_committed');
        const allEntries = (JSON.parse(raw) || {}).entries || [];
        startingFundsLocked = allEntries.some(e => e.category === 'starting_funds');
    } catch (e) {}

    editorEls.category.innerHTML = '';
    ENTRY_CATEGORIES[editorEls.type.value].forEach(cat => {
        const value = cat.toLowerCase().replace(/ /g, '_');
        if (value === 'starting_funds' && startingFundsLocked && selected !== 'starting_funds') return;
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = cat;
        editorEls.category.appendChild(opt);
    });
    if (selected) editorEls.category.value = selected;
}

function updateEditCurrencyHolding() {
    const type     = editorEls.type.value;
    const category = editorEls.category.value;
    const regional = getRegionalCurrency();
    editorEls.holdingField.style.display = type === 'savings' ? '' : 'none';
    if (type === 'savings' && category === 'other') {
        editorEls.currency.disabled = false;
    } else {
        editorEls.currency.value = regional;
        editorEls.currency.disabled = true;
    }
}

function openEntryEditor(entry) {
    if (!editorEls) buildEntryEditor();
    editingEntry = entry;

    editorEls.currency.innerHTML = getCurrencyConfig().list
        .map(c => `<option value="${c.code}">${c.symbol ? c.code + ' ' + c.symbol : c.code}</option>`).join('');

    editorEls.date.value   = entry.date;
    editorEls.amount.value = entry.amount;
    editorEls.type.value   = entry.type;
    populateEditCategories(entry.category);
    editorEls.holding.value = entry.holding || HOLDING_TYPES[0].key;
    editorEls.note.value    = entry.note || '';
    updateEditCurrencyHolding();
    // Restore the entry's currency where the field is editable (Savings → Other).
    editorEls.currency.value = editorEls.currency.disabled
        ? getRegionalCurrency()
        : (entry.currency || getRegionalCurrency());

    editorEls.backdrop.classList.add('open');
    editorEls.modal.classList.add('open');
    document.addEventListener('keydown', escHandlerEntryEditor);
}
window.openEntryEditor = openEntryEditor;

function closeEntryEditor() {
    document.removeEventListener('keydown', escHandlerEntryEditor);
    if (!editorEls) return;
    editorEls.backdrop.classList.remove('open');
    editorEls.modal.classList.remove('open');
    editingEntry = null;
}

function saveEntryEditor() {
    if (!editingEntry) return;
    const amount = parseFloat(editorEls.amount.value);
    if (isNaN(amount)) { editorEls.amount.focus(); return; }
    const type          = editorEls.type.value;
    const category      = editorEls.category.value;
    const categoryLabel = editorEls.category.options[editorEls.category.selectedIndex]?.text || category;
    const note          = editorEls.note.value.trim();
    const currency      = editorEls.currency.disabled ? getRegionalCurrency() : editorEls.currency.value;

    editingEntry.date          = editorEls.date.value;
    editingEntry.amount        = amount;
    editingEntry.type          = type;
    editingEntry.category      = category;
    editingEntry.categoryLabel = categoryLabel;
    editingEntry.currency      = currency;
    if (type === 'savings') editingEntry.holding = editorEls.holding.value;
    else delete editingEntry.holding;
    if (note) editingEntry.note = note; else delete editingEntry.note;

    closeEntryEditor();
    window.onEntryCommitted?.();
}

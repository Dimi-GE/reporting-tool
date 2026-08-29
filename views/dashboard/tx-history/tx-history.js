let allTxEntries = [];

function initTxHistory() {
    const txContainer   = document.getElementById('tx-container');
    const txList        = document.getElementById('tx-list');
    const btnTxToggle   = document.getElementById('btn-tx-toggle');
    const txBackdrop    = document.getElementById('tx-backdrop');
    const filterType    = document.getElementById('tx-filter-type');
    const filterCat     = document.getElementById('tx-filter-category');

    let expanded = false;
    let contentResizeObserver = null;
    let placeholder = null;
    let animToken = 0;

    // Reads the SAME --tx-anim-duration the CSS transition uses (declared on
    // :root, tx-history.css) so the JS cleanup timer can never drift out of
    // sync with how long the animation actually takes to visually finish —
    // change the duration in one place (the CSS variable) and both follow.
    function getAnimMs() {
        const raw = getComputedStyle(document.documentElement)
            .getPropertyValue('--tx-anim-duration').trim();
        const value = parseFloat(raw);
        if (!value) return 500;
        return raw.endsWith('ms') ? value : value * 1000;
    }

    // Target rect for the expanded overlay: width/left match the current
    // .content-container bounds (inset 15px each side), height/top centre it
    // vertically in the viewport. Computed fresh each call since both shift
    // with the sidebar's collapsed state, window size, and the page's own
    // centering — none of which a static CSS value can track.
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
        txContainer.style.top    = rect.top + 'px';
        txContainer.style.left   = rect.left + 'px';
        txContainer.style.width  = rect.width + 'px';
        txContainer.style.height = rect.height + 'px';
    }

    // Re-applies the target rect while expanded (resize / sidebar toggle).
    // .tx-animating is already on by then, so this glides rather than jumps.
    function positionExpandedOverlay() {
        if (!expanded) return;
        applyRect(computeExpandedRect());
    }

    // FLIP animation: measure the collapsed card's exact on-screen rect,
    // snap the (now fixed-position) element to that same rect with no
    // transition active so nothing visibly moves yet, then turn the
    // transition on and apply the real target rect so the browser animates
    // the grow smoothly instead of jumping straight to the overlay size.
    function expand() {
        if (expanded) return;
        expanded = true;
        animToken++;

        const startRect = txContainer.getBoundingClientRect();

        // If a collapse was still animating (its cleanup hasn't fired yet —
        // animToken++ above already invalidated it), drop its placeholder
        // rather than leaking a second one into the layout.
        if (placeholder) placeholder.remove();

        // Holds this spot in the surrounding layout while the real element
        // becomes position:fixed and stops occupying flow space.
        placeholder = document.createElement('div');
        placeholder.style.height = startRect.height + 'px';
        txContainer.parentNode.insertBefore(placeholder, txContainer);

        txContainer.classList.add('expanded');
        txBackdrop.classList.add('active');
        btnTxToggle.textContent = 'Collapse';

        applyRect(startRect);
        void txContainer.offsetHeight;   // force reflow before enabling the transition
        txContainer.classList.add('tx-animating');
        applyRect(computeExpandedRect());
        txList.classList.add('expanded');

        window.addEventListener('resize', positionExpandedOverlay);
        const content = document.querySelector('.content-container');
        if (content && window.ResizeObserver) {
            contentResizeObserver = new ResizeObserver(positionExpandedOverlay);
            contentResizeObserver.observe(content);
        }
    }

    // Reverse FLIP: glide back to the rect the placeholder is holding (its
    // exact original spot, even if the page scrolled/resized meanwhile),
    // then — once the transition has had time to finish — drop back to a
    // normal in-flow element and remove the placeholder.
    function collapse() {
        if (!expanded) return;
        expanded = false;
        const myToken = ++animToken;

        window.removeEventListener('resize', positionExpandedOverlay);
        if (contentResizeObserver) { contentResizeObserver.disconnect(); contentResizeObserver = null; }

        txList.classList.remove('expanded');
        txBackdrop.classList.remove('active');
        btnTxToggle.textContent = 'Full History';

        if (placeholder) applyRect(placeholder.getBoundingClientRect());

        setTimeout(() => {
            if (myToken !== animToken) return;   // a new expand()/collapse() has since started
            txContainer.classList.remove('expanded', 'tx-animating');
            txContainer.style.top = txContainer.style.left = txContainer.style.width = txContainer.style.height = '';
            if (placeholder) { placeholder.remove(); placeholder = null; }
        }, getAnimMs());
    }

    btnTxToggle.addEventListener('click', () => expanded ? collapse() : expand());
    txBackdrop.addEventListener('click', collapse);

    // Rebuild category options from entries matching the selected type
    function repopulateCategories() {
        const type = filterType.value;
        const entries = type ? allTxEntries.filter(e => e.type === type) : allTxEntries;

        const seen = new Map();
        entries.forEach(e => {
            if (!seen.has(e.category)) seen.set(e.category, e.categoryLabel);
        });

        filterCat.innerHTML = '<option value="">All categories</option>';
        seen.forEach((label, value) => {
            const opt = document.createElement('option');
            opt.value = value;
            opt.textContent = label;
            filterCat.appendChild(opt);
        });
    }

    filterType.addEventListener('change', () => {
        repopulateCategories();
        applyFilters();
    });

    filterCat.addEventListener('change', applyFilters);

    function applyFilters() {
        const type = filterType.value;
        const cat  = filterCat.value;
        const filtered = allTxEntries.filter(e =>
            (!type || e.type === type) &&
            (!cat  || e.category === cat)
        );
        renderTxRows(filtered);
    }

    // Expose so renderTxList can trigger a re-filter after data update
    window._txApplyFilters = applyFilters;
    window._txRepopulateCategories = repopulateCategories;
}

function renderTxList(entries) {
    allTxEntries = [...entries].reverse();

    if (window._txRepopulateCategories) window._txRepopulateCategories();
    if (window._txApplyFilters) {
        window._txApplyFilters();
    } else {
        renderTxRows(allTxEntries);
    }
}

function renderTxRows(entries) {
    const txList = document.getElementById('tx-list');
    if (!txList) return;

    if (entries.length === 0) {
        txList.innerHTML = '<div class="entries-empty">No transactions yet</div>';
        return;
    }

    txList.innerHTML = '';
    entries.forEach(entry => {
        const item = document.createElement('div');
        item.className = 'tx-item';
        item.innerHTML = `
            <div class="tx-body">
                <div class="tx-meta">
                    <span class="tx-date">${entry.date}</span>
                    <span class="tx-amount">${entry.amount.toFixed(2)}</span>
                    <span class="tx-type"><i class="ti ${TX_TYPE_ICONS[entry.type]}" style="color:${TX_TYPE_COLORS[entry.type]};"></i> ${entry.type.charAt(0).toUpperCase() + entry.type.slice(1)}</span>
                    <span class="tx-category" style="background-color:${getCategoryColor(entry.category)}22;color:${getCategoryColor(entry.category)};">${entry.categoryLabel}</span>
                </div>
                ${entry.note ? `<div class="tx-note">${entry.note}</div>` : ''}
            </div>
            <button class="tx-edit" title="Edit entry"><i class="ti ti-pencil"></i></button>
        `;
        // The entry object is shared with committed.entries, so the editor can
        // mutate it in place and have the Dashboard re-commit.
        const editBtn = item.querySelector('.tx-edit');
        editBtn.addEventListener('click', () => window.openEntryEditor?.(entry));
        txList.appendChild(item);
    });
}
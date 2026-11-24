// Keep the full search card in normal flow; only dock its essential controls.
// The slot preserves the expanded height so docking never moves the results.
const slot = document.getElementById('publicSearchSlot');
const card = slot?.querySelector('.sa-home-search-card');
const shell = slot?.closest('.sa-home-shell');
const toggle = document.getElementById('searchToolsToggle');
const tools = document.getElementById('publicSearchTools');
const refresh = document.getElementById('refreshBtn');
const refreshSlot = document.getElementById('compactRefreshSlot');

if (card && shell && toggle && tools && refresh && refreshSlot) {
  const refreshHome = document.createComment('search refresh position');
  refresh.before(refreshHome);
  let docked = false;
  let open = false;
  let frame = 0;
  let disposed = false;
  let remeasure = false;

  function showTools(value, restoreFocus = false) {
    open = docked && value;
    tools.hidden = docked && !open;
    toggle.setAttribute('aria-expanded', String(open));
    card.classList.toggle('search-tools-open', open);
    if (restoreFocus) toggle.focus({ preventScroll: true });
  }

  function placeRefresh() {
    const target = docked && window.matchMedia('(max-width: 600px)').matches
      ? refreshSlot : refreshHome.parentElement;
    if (refresh.parentElement === target) return;
    const focused = document.activeElement === refresh;
    if (target === refreshSlot) target.append(refresh);
    else refreshHome.after(refresh);
    if (focused) {
      (docked && !open ? toggle : refresh).focus({ preventScroll: true });
    }
  }

  function undock() {
    const focusedToggle = document.activeElement === toggle;
    docked = false;
    showTools(false);
    card.classList.remove('is-search-docked');
    card.style.removeProperty('left');
    card.style.removeProperty('width');
    slot.style.removeProperty('height');
    toggle.hidden = true;
    placeRefresh();
    if (focusedToggle) document.getElementById('characterName')?.focus({ preventScroll: true });
  }

  function update() {
    frame = 0;
    if (disposed) return;
    if (!shell.classList.contains('results-active')) {
      undock();
      return;
    }
    // Reflow once on a viewport resize, without painting an expanded fixed card.
    if (remeasure && docked) undock();
    remeasure = false;
    const rect = slot.getBoundingClientRect();
    const top = Number.parseFloat(getComputedStyle(card).top) || 78;
    const shouldDock = rect.top < top - (docked ? 36 : 52);
    if (!shouldDock) {
      if (docked) undock();
      return;
    }
    if (!docked) {
      slot.style.height = `${rect.height}px`;
      docked = true;
      toggle.hidden = false;
      if (tools.contains(document.activeElement)) toggle.focus({ preventScroll: true });
      showTools(false);
      card.classList.add('is-search-docked');
    }
    card.style.left = `${rect.left}px`;
    card.style.width = `${rect.width}px`;
    placeRefresh();
  }

  function schedule() {
    if (!disposed && !frame) frame = window.requestAnimationFrame(update);
  }
  function resize() { remeasure = true; schedule(); }
  function toggleTools() { showTools(!open); }
  function outside(event) {
    if (open && !card.contains(event.target)) showTools(false, tools.contains(document.activeElement));
  }
  function escape(event) {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      showTools(false, true);
    }
  }
  function action(event) {
    if (event.target.closest?.('.chip-label, .chip-compare, #compareBtn, #refreshBtn, #resetSearchBtn')) {
      // The existing handlers own search and dialog focus; do not steal it.
      showTools(false);
    }
  }
  const observer = new MutationObserver(schedule);
  observer.observe(shell, { attributes: true, attributeFilter: ['class'] });
  toggle.addEventListener('click', toggleTools);
  card.addEventListener('click', action);
  document.addEventListener('pointerdown', outside);
  document.addEventListener('keydown', escape);
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', resize);
  window.addEventListener('pageshow', resize);
  window.addEventListener('pagehide', event => {
    if (event.persisted) return;
    disposed = true;
    if (frame) window.cancelAnimationFrame(frame);
    observer.disconnect();
    toggle.removeEventListener('click', toggleTools);
    card.removeEventListener('click', action);
    document.removeEventListener('pointerdown', outside);
    document.removeEventListener('keydown', escape);
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', resize);
    window.removeEventListener('pageshow', resize);
  }, { once: false });
  schedule();
}

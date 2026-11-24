// Page-lifetime controller; switching modes retains each analysis panel's state.
export function mountReplayWorkspace(root, { onCompare }) {
  const replayHelp = [...root.querySelectorAll('[data-replay-help]')];
  const setHelpExpanded = open => { for (const panel of replayHelp) panel.open = open; };
  const modeTabs = [...root.querySelectorAll('[data-replay-mode]')];
  function setReplayMode(tab, focus = false) {
    for (const button of modeTabs) {
      const selected = button === tab;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
      root.getElementById(button.getAttribute('aria-controls')).hidden = !selected;
    }
    if (tab.dataset.replayMode === 'compare') onCompare();
    setHelpExpanded(false);
    if (focus) tab.focus({ preventScroll: true });
  }
  for (const [index, tab] of modeTabs.entries()) {
    tab.addEventListener('click', () => setReplayMode(tab));
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % modeTabs.length;
      else if (event.key === 'ArrowLeft') next = (index + modeTabs.length - 1) % modeTabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = modeTabs.length - 1;
      else return;
      event.preventDefault();setReplayMode(modeTabs[next], true);
    });
  }
  return { setHelpExpanded, selectMode(mode) {
    const tab = modeTabs.find(button => button.dataset.replayMode === mode);
    if (tab) setReplayMode(tab);
  } };
}

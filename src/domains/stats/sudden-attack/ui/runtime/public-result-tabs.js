/** Coordinates existing result components without re-querying a player on tab changes. */
export function createPublicResultTabs({ navigation, content, statsSection, historySection, activitySection }) {
  if (!navigation || !content || !activitySection) return null;
  const buttons = [...navigation.querySelectorAll('[data-result-tab]')];
  let selected = 'overview';
  let playerCard = null;
  let playerData = null;
  let statsComponent = null;

  function select(next, focus = false) {
    const active = buttons.find(button => button.dataset.resultTab === next);
    if (!active) return;
    selected = next;
    for (const button of buttons) {
      const isSelected = button === active;
      button.setAttribute('aria-selected', String(isSelected));
      button.tabIndex = isSelected ? 0 : -1;
    }
    content.setAttribute('role', 'tabpanel');
    content.setAttribute('aria-labelledby', active.id);
    if (statsComponent) statsComponent.dataset.resultView = selected;
    statsSection.classList.toggle('hidden', selected === 'activity');
    historySection.classList.toggle('hidden', selected !== 'overview');
    activitySection.hidden = selected !== 'activity';
    // The component owns its loaded/pending cache, retries and selected date.
    if (selected === 'activity') playerCard?.loadActivity(playerData);
    if (focus) active.focus();
  }

  navigation.addEventListener('click', event => {
    const button = event.target.closest('[data-result-tab]');
    if (button && navigation.contains(button)) select(button.dataset.resultTab);
  });
  navigation.addEventListener('keydown', event => {
    const index = buttons.indexOf(event.target);
    if (index < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
      : (index + (event.key === 'ArrowRight' ? 1 : buttons.length - 1)) % buttons.length;
    select(buttons[next].dataset.resultTab, true);
  });

  return {
    render({ card, data, stats }) {
      if (card !== playerCard) card.mountActivityPanel(activitySection);
      playerCard = card;
      playerData = data;
      statsComponent = stats;
      navigation.hidden = false;
      select(selected);
    },
    reset() {
      selected = 'overview';
      playerCard = null;
      playerData = null;
      statsComponent = null;
      navigation.hidden = true;
      activitySection.hidden = true;
      activitySection.replaceChildren();
      content.removeAttribute('role');
      content.removeAttribute('aria-labelledby');
    }
  };
}

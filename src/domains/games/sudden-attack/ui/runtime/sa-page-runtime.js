export function initSaPageRuntime({
  handleSearch,
  refreshRankings,
  onRankingsUpdated = null,
  profileSection,
  statsSection,
  historySection,
  crewRankingSection,
  searchInput
}) {
  const params = new URLSearchParams(window.location.search);
  const nameFromUrl = params.get('n');
  if (nameFromUrl) handleSearch(nameFromUrl, true);

  window.addEventListener('popstate', (e) => {
    if (e.state && e.state.name) {
      handleSearch(e.state.name, true);
      return;
    }
    const urlParams = new URLSearchParams(window.location.search);
    const name = urlParams.get('n');
    if (name) {
      handleSearch(name, true);
      return;
    }
    profileSection.classList.add('hidden');
    statsSection.classList.add('hidden');
    historySection.classList.add('hidden');
    crewRankingSection.classList.remove('hidden');
    searchInput.value = '';
  });

  window.addEventListener('sa-rankings-updated', () => {
    if (typeof onRankingsUpdated === 'function') onRankingsUpdated();
    else refreshRankings();
  });
  window.addEventListener('sa-request-search', (e) => {
    if (e.detail && e.detail.name) {
      handleSearch(e.detail.name);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });
}

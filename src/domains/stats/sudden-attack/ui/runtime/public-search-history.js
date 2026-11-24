export function initPublicSearchHistory({ handleSearch, resetSearchState }) {
  const params = new URLSearchParams(window.location.search);
  const nameFromUrl = params.get('n');
  if (nameFromUrl) handleSearch(nameFromUrl, true, false, 'direct_link');

  window.addEventListener('popstate', (e) => {
    if (e.state && e.state.name) {
      handleSearch(e.state.name, true, false, 'history');
      return;
    }
    const urlParams = new URLSearchParams(window.location.search);
    const name = urlParams.get('n');
    if (name) {
      handleSearch(name, true, false, 'history');
      return;
    }
    resetSearchState(false);
  });

  window.addEventListener('sa-request-search', (e) => {
    if (e.detail && e.detail.name) {
      handleSearch(e.detail.name, false, false, 'in_page');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });
}

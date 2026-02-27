const PAGE_SIZE = 12;

function setupPagination() {
  const grid = document.querySelector(".news-grid");
  const pagination = document.getElementById("news-pagination");
  if (!grid || !pagination) return;

  const cards = Array.from(grid.querySelectorAll(".news-card-premium"));
  if (cards.length <= PAGE_SIZE) {
    pagination.hidden = true;
    return;
  }

  let currentPage = 1;
  const totalPages = Math.ceil(cards.length / PAGE_SIZE);
  const prevBtn = document.getElementById("prev-page");
  const nextBtn = document.getElementById("next-page");
  const indicator = document.getElementById("page-indicator");

  const renderPage = (page) => {
    currentPage = Math.max(1, Math.min(totalPages, page));
    const start = (currentPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;

    cards.forEach((card, index) => {
      card.style.display = index >= start && index < end ? "flex" : "none";
    });

    if (indicator) {
      indicator.textContent = `${currentPage} / ${totalPages}`;
    }
    if (prevBtn) prevBtn.disabled = currentPage === 1;
    if (nextBtn) nextBtn.disabled = currentPage === totalPages;
  };

  if (prevBtn) prevBtn.addEventListener("click", () => renderPage(currentPage - 1));
  if (nextBtn) nextBtn.addEventListener("click", () => renderPage(currentPage + 1));

  pagination.hidden = false;
  renderPage(1);
}

export { setupPagination };

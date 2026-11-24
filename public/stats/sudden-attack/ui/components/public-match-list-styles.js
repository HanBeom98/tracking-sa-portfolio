/** Compact summaries apply to public matches only; league settlement cards stay intact. */
export const PUBLIC_MATCH_LIST_STYLES = String.raw`
  .public-match-heading, .match-item.public-match-row {
    display: grid;
    grid-template-columns: 52px minmax(160px, 1fr) 128px 66px 84px 94px 14px;
    gap: 14px;
    align-items: center;
  }
  .public-match-heading {
    padding: 10px 16px 10px 19px;
    color: var(--sa-text-muted);
    font-size: 11px;
  }
  .public-match-heading > span:nth-child(n+3) { text-align: right; }
  .public-match-list {
    border: 1px solid var(--sa-line-soft);
    border-radius: 14px;
    background: var(--bg-card);
    overflow: hidden;
  }
  .public-match-list > .match-container { margin: 0; border-bottom: 1px solid var(--sa-line-soft); }
  .public-match-list > .match-container:last-child { border-bottom: 0; }
  .match-item.public-match-row {
    width: 100%;
    min-height: 74px;
    margin: 0;
    padding: 13px 16px;
    border: 0;
    border-left: 3px solid var(--sa-line-strong);
    border-radius: 0;
    box-shadow: none;
    background: transparent;
    color: var(--sa-text-strong);
    font: inherit;
    text-align: left;
    transform: none;
    transition: background-color .15s ease;
  }
  .match-item.public-match-row:hover { transform: none; box-shadow: none; background: var(--sa-surface-2); }
  .match-item.public-match-row[aria-expanded="true"] { background: var(--sa-surface-2); }
  .match-item.public-match-row:focus-visible { outline: 2px solid var(--primary); outline-offset: -3px; }
  .match-item.public-match-row.win { border-left-color: var(--primary); }
  .match-item.public-match-row.lose { border-left-color: var(--red); }
  .match-item.public-match-row.draw { border-left-color: var(--gold); }
  .match-item.public-match-row.abandon { border-left-color: #ff9b52; }
  .public-match-row .result-badge { font-size: 13px; font-weight: 800; word-break: keep-all; }
  .public-match-row.win .result-badge { color: var(--primary); }
  .public-match-row.lose .result-badge { color: var(--red); }
  .public-match-row.draw .result-badge { color: var(--gold); }
  .public-match-row.abandon .result-badge { color: #ff9b52; }
  .public-match-map { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .public-map-thumbnail { flex: 0 0 54px; height: 36px; overflow: hidden; border-radius: 6px; background: var(--sa-surface-2); }
  .public-map-thumbnail img { display: block; width: 100%; height: 100%; object-fit: cover; }
  .public-match-name { display: grid; gap: 4px; min-width: 0; }
  .public-match-row .map { color: var(--sa-text-strong); font-size: 14px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .public-match-row .type-tag { display: block; font-size: 11px; color: var(--sa-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .public-match-combat { display: grid; gap: 4px; min-width: 0; text-align: right; }
  .public-match-row .kda { font-family: inherit; font-size: 15px; font-weight: 700; line-height: 1.4; color: var(--sa-text-strong); white-space: nowrap; text-align: right; font-variant-numeric: tabular-nums; }
  .public-match-kd { color: var(--sa-text-muted); font-size: 11px; font-variant-numeric: tabular-nums; }
  .public-match-metric { font-size: 14px; font-weight: 650; text-align: right; font-variant-numeric: tabular-nums; }
  .public-match-date { display: grid; gap: 4px; font-size: 11px; color: var(--sa-text-muted); text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .public-match-row .expand-arrow { margin: 0; text-align: center; font-size: 10px; }
  .public-match-label { position: absolute !important; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  .public-match-extra { display: none; }
  .public-match-list .match-detail-view { padding: 0 16px 12px; }
  .public-match-list .public-match-close {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    width: 100%; min-height: 44px; margin-top: 12px; padding: 10px 14px;
    border: 1px solid var(--sa-line-strong); border-radius: 8px;
    background: var(--sa-surface-1); color: var(--sa-text-strong);
    font: inherit; font-size: 13px; font-weight: 600; cursor: pointer;
  }
  .public-match-list .public-match-close:hover { background: var(--sa-surface-2); }
  .public-match-list .public-match-close:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
  body:not(.dark-mode) .public-match-row.draw .result-badge { color: #815600; }
  body:not(.dark-mode) .public-match-row.lose .result-badge { color: #b72e45; }
  body:not(.dark-mode) .public-match-row.abandon .result-badge { color: #925000; }
  @media (max-width: 800px) {
    .public-match-heading { display: none; }
    .match-item.public-match-row {
      grid-template-columns: 42px minmax(0, 1fr) 100px 12px;
      grid-template-rows: auto auto;
      gap: 5px 8px;
      min-height: 72px;
      padding: 12px 10px;
    }
    .public-match-row .result-badge { grid-column: 1; grid-row: 1 / 3; font-size: 12px; }
    .public-match-map, .public-match-name { display: contents; }
    .public-map-thumbnail { display: none; }
    .public-match-row .map { grid-column: 2; grid-row: 1; font-size: 13px; }
    .public-match-row .type-tag { grid-column: 2; grid-row: 2; font-size: 11px; }
    .public-match-combat { grid-column: 3; grid-row: 2; display: block; }
    .public-match-row .kda { font-size: 13px; }
    .public-match-kd, .public-match-metric { display: none; }
    .public-match-date { grid-column: 3; grid-row: 1; display: flex; justify-content: flex-end; gap: 5px; font-size: 11px; }
    .public-match-row .expand-arrow { grid-column: 4; grid-row: 1 / 3; }
    .public-match-extra { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; padding: 14px 0 8px; border-top: 1px solid var(--sa-line-soft); }
    .public-match-extra span { display: block; font-size: 11px; color: var(--sa-text-muted); }
    .public-match-extra strong { display: block; margin-top: 4px; font-size: 15px; color: var(--sa-text-strong); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
    .public-match-list .match-detail-view { padding: 0 10px 10px; }
  }
  @media (max-width: 560px) {
    .public-match-list .score-team-head, .public-match-list .score-player {
      grid-template-columns: minmax(0, 1fr) 42px 78px 40px;
      gap: 4px;
      padding-left: 8px;
      padding-right: 8px;
    }
    .public-match-list .scoreboard-meta { overflow-wrap: anywhere; }
  }
  @media (prefers-reduced-motion: reduce) { .match-item.public-match-row { transition: none; } }
`;

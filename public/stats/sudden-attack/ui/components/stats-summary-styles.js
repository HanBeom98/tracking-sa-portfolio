export function getStatsSummaryBaseStyles() {
  return `
    <style>
      .stats-summary-card {
        background: var(--sa-surface-1); border: 1px solid var(--border); border-radius: 16px; padding: 24px; margin: 12px 0 18px; box-shadow: none;
      }
      .playstyle-banner {
        display: flex; align-items: center; background: var(--sa-accent-soft); border: 1px solid color-mix(in srgb, var(--primary) 18%, transparent);
        border-radius: 10px; padding: 15px 20px; margin-bottom: 25px;
      }
      .playstyle-icon { font-size: 32px; margin-right: 15px; }
      .playstyle-info { flex: 1 1 auto; min-width: 0; }
      .playstyle-label { font-size: 11px; color: var(--text-dim); display: block; }
      .playstyle-title { font-size: 18px; font-weight: bold; color: var(--sa-text-strong); }
      .playstyle-description { display: block; margin-top: 4px; color: var(--sa-text-muted); font-size: 11px; line-height: 1.45; }
      .stats-summary-header { display: flex; gap: 32px; margin-bottom: 24px; align-items: center; }
      .radar-section { flex: 0 0 220px; }
      .text-stats-section { flex: 1; }
      .public-compact-analysis {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 14px;
        align-items: stretch;
        margin-bottom: 24px;
      }
      .public-radar-card,
      .public-breakdown-card {
        min-width: 0;
        border: 1px solid var(--sa-line-soft);
        border-radius: 14px;
        background: var(--sa-surface-2);
      }
      .public-radar-card {
        grid-column: 3;
        display: grid;
        place-items: center;
        min-height: 210px;
        padding: 12px;
      }
      .public-radar-card sa-radar-chart {
        display: block;
        width: min(100%, 190px);
        aspect-ratio: 1;
      }
      .public-breakdown-card {
        grid-column: 4;
        display: flex;
        flex-direction: column;
        padding: 14px;
      }
      .public-breakdown-card .header-row {
        align-items: flex-start;
        margin-bottom: 12px;
        padding-bottom: 10px;
      }
      .public-breakdown-card .analysis-heading-title { font-size: 14px; }
      .public-breakdown-card .analysis-heading-meta { margin-top: 6px; }
      .public-breakdown-card .stats-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
        margin-top: auto;
      }
      .public-breakdown-card .stat-box { padding: 10px 8px; }
      .public-breakdown-card .stat-box .value { font-size: 16px; }
      .header-row {
        display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 20px;
        border-bottom: 1px solid var(--sa-line-soft); padding-bottom: 12px;
      }
      .header-row h3 { margin: 0; font-size: 20px; color: var(--sa-text-strong); font-weight: 800; }
      .season-label {
        display: inline-flex; align-items: center; margin-right: 8px; padding: 3px 9px;
        border-radius: 999px; font-size: 11px; color: var(--primary); background: var(--sa-accent-soft);
        border: 1px solid color-mix(in srgb, var(--primary) 30%, transparent); vertical-align: middle;
      }
      .most-played-map { font-size: 13px; color: var(--text-dim); background: var(--sa-line-soft); padding: 4px 12px; border-radius: 4px; }
      .most-played-map strong { color: #ffcc00; }
      .confidence-badge { margin-left: 8px; display: inline-flex; align-items: center; border-radius: 999px; padding: 3px 10px; font-size: 11px; font-weight: 800; letter-spacing: 0.01em; vertical-align: middle; }
      .confidence-badge.low { color: #ff7f7f; background: rgba(255,77,77,0.14); border: 1px solid rgba(255,77,77,0.35); }
      .confidence-badge.mid { color: #ffd580; background: rgba(255,204,0,0.12); border: 1px solid rgba(255,204,0,0.28); }
      .confidence-badge.high { color: #79e3ff; background: rgba(0,210,255,0.12); border: 1px solid rgba(0,210,255,0.28); }
      .confidence-badge.full { color: #98f5d5; background: rgba(46,204,113,0.14); border: 1px solid rgba(46,204,113,0.33); }
      .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; }
      .stat-box {
        background: var(--sa-surface-2); padding: 15px; border-radius: 8px; border: 1px solid var(--sa-line-soft); text-align: center;
      }
      .stat-box label { font-size: 12px; color: var(--text-dim); display: block; margin-bottom: 5px; }
      .stat-box .value { font-size: 20px; font-weight: bold; color: var(--sa-text-strong); font-family: 'Roboto Mono', monospace; }
      .value.highlight { color: var(--primary); }
      .public-summary-heading { display: none; }
      .quick-kpi-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 14px;
        margin-bottom: 22px;
      }
      .quick-kpi {
        background: linear-gradient(180deg, var(--sa-surface-2), var(--sa-surface-1));
        border: 1px solid var(--sa-line-soft);
        border-radius: 14px;
        padding: 16px;
      }
      .quick-kpi label {
        display: block;
        color: var(--sa-text-soft);
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        margin-bottom: 8px;
      }
      .quick-kpi-label-with-help {
        display: flex !important;
        align-items: center;
        gap: 5px;
      }
      .metric-scope-help {
        position: relative;
        display: inline-grid;
        place-items: center;
        width: 15px;
        height: 15px;
        flex: 0 0 15px;
        padding: 0;
        border: 1px solid var(--sa-line-strong);
        border-radius: 50%;
        background: transparent;
        color: var(--sa-text-muted);
        font: 800 10px/1 system-ui, sans-serif;
        cursor: help;
      }
      .metric-scope-help::after {
        content: attr(data-tooltip);
        position: absolute;
        z-index: 20;
        top: calc(100% + 8px);
        left: 0;
        width: min(310px, calc(100vw - 72px));
        padding: 9px 11px;
        border: 1px solid var(--sa-line-strong);
        border-radius: 8px;
        background: var(--sa-surface-1);
        box-shadow: 0 8px 24px rgba(0, 0, 0, .28);
        color: var(--sa-text-soft);
        font: 500 11px/1.5 system-ui, sans-serif;
        text-align: left;
        text-transform: none;
        letter-spacing: 0;
        white-space: normal;
        opacity: 0;
        visibility: hidden;
        transform: translateY(-2px);
        transition: opacity .15s ease, transform .15s ease, visibility .15s;
        pointer-events: none;
      }
      .metric-scope-help:hover::after,
      .metric-scope-help:focus-visible::after {
        opacity: 1;
        visibility: visible;
        transform: translateY(0);
      }
      .quick-kpi strong {
        display: block;
        color: var(--sa-text-strong);
        font-size: 28px;
        line-height: 1;
        font-weight: 900;
        letter-spacing: -0.04em;
      }
      .quick-kpi span {
        display: block;
        margin-top: 8px;
        color: var(--sa-text-muted);
        font-size: 12px;
      }
      .quick-kpi.preferred-map {
        position: relative;
        min-height: 112px;
        overflow: hidden;
        padding: 0;
        background: var(--sa-surface-2);
      }
      .preferred-map img {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .preferred-map-copy {
        position: relative;
        z-index: 1;
        display: flex;
        min-height: 112px;
        flex-direction: column;
        justify-content: flex-end;
        padding: 16px;
        background: linear-gradient(180deg, transparent 12%, rgba(5, 10, 18, .92) 100%);
      }
      .preferred-map-copy label,
      .preferred-map-copy strong,
      .preferred-map-copy span { text-shadow: 0 1px 8px rgba(0,0,0,.85); }
      .preferred-map-copy strong {
        overflow-wrap: anywhere;
        color: #fff;
        font-size: 20px;
        line-height: 1.12;
      }
      .analysis-heading {
        display: flex;
        min-width: 0;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      .analysis-heading-title {
        color: var(--sa-text-strong);
        font-size: 16px;
        font-weight: 850;
      }
      .analysis-heading-meta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin-top: 8px;
        color: var(--text-dim);
        font-size: 11px;
      }
      .stats-detail-grid {
        display: grid; grid-template-columns: 1.2fr 1fr; gap: 25px; margin-top: 30px; align-items: start;
      }
      .stats-detail-grid > * { margin-top: 0 !important; }
      .relationship-container {
        display: grid; grid-template-columns: 1fr 1fr; gap: 25px;
        margin-top: 35px; padding-top: 25px; border-top: 1px dashed var(--border);
      }
      .crew-stats-card {
        margin-top: 30px; background: var(--sa-gold-soft); border: 1px solid color-mix(in srgb, var(--gold) 18%, transparent); border-radius: 12px; padding: 20px;
      }
      .crew-stats-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
      .crew-stats-header h3 { margin: 0; font-size: 16px; color: #ffcc00; }
      .match-count { font-size: 12px; color: var(--text-dim); }
      .crew-grid { grid-template-columns: repeat(4, 1fr); }
      .crew-grid .stat-box { border-color: rgba(255, 204, 0, 0.1); }
      .gold-highlight { color: #ffcc00 !important; }
      .vs-summary-banner {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        padding: 16px 18px;
        margin-bottom: 18px;
        border-radius: 14px;
        background: var(--sa-line-soft);
        border: 1px solid var(--sa-line-strong);
      }
      .vs-summary-banner.primary {
        border-color: rgba(0, 210, 255, 0.28);
        background: linear-gradient(135deg, var(--sa-accent-soft), var(--sa-surface-1));
      }
      .vs-summary-banner.target {
        border-color: rgba(188, 0, 255, 0.28);
        background: linear-gradient(135deg, var(--sa-secondary-soft), var(--sa-surface-1));
      }
      .vs-summary-copy strong {
        display: block;
        color: var(--sa-text-strong);
        font-size: 22px;
        font-weight: 900;
        letter-spacing: -0.03em;
      }
      .vs-summary-copy span {
        display: block;
        margin-top: 6px;
        color: #aab5d7;
        font-size: 13px;
        line-height: 1.55;
      }
      .vs-summary-score {
        min-width: 92px;
        text-align: right;
      }
      .vs-summary-score label {
        display: block;
        color: #7f8ab1;
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
        margin-bottom: 6px;
      }
      .vs-summary-score strong {
        display: block;
        color: var(--sa-text-strong);
        font-size: 30px;
        line-height: 1;
        font-weight: 900;
      }
      .vs-mode-card .vs-grid-container {
        display: grid;
        grid-template-columns: 220px minmax(280px, 1fr) minmax(320px, 380px);
        gap: 24px;
        align-items: start;
        margin-top: 15px;
      }
      .vs-left,
      .vs-center,
      .vs-right {
        min-width: 0;
      }
      .vs-left {
        display: flex;
        justify-content: center;
        padding-top: 10px;
      }
      .vs-center {
        align-self: center;
      }
      .vs-right {
        align-self: stretch;
      }
      .vs-comparison-scope { margin:8px 0 12px; color:var(--sa-text-muted); font-size:12px; line-height:1.7; overflow-wrap:anywhere; }
      .vs-comparison-table { width: 100%; border-collapse: collapse; }
      .vs-comparison-table th { padding: 8px; color: var(--text-dim); font-size: 12px; text-transform: uppercase; border-bottom: 1px solid var(--border); }
      .vs-comparison-table td { text-align: center; padding: 14px 6px; font-size: 18px; font-weight: 800; color: var(--sa-text-strong); }
      .vs-comparison-table td.lbl { font-size: 11px; color: var(--text-dim); font-weight: 400; width: 80px; }
      .vs-comparison-table td.primary-win { color: #79e3ff; }
      .vs-comparison-table td.target-win { color: #df9cff; }
      .vs-comparison-table td.draw { color: #d8dcef; }
      .vs-delta {
        display: block;
        margin-top: 5px;
        font-size: 11px;
        font-weight: 700;
        color: #7f8ab1;
      }
      .vs-mode-card sa-mmr-trend-chart { display: block; margin-top: 0; }
      @media (max-width: 1100px) {
        .vs-summary-banner { flex-direction: column; }
        .vs-summary-score { text-align: left; }
        .vs-mode-card .vs-grid-container { grid-template-columns: 1fr; }
        .vs-left { padding-top: 0; }
        .vs-right { margin-top: 6px; }
      }
      @media (max-width: 900px) {
        .stats-detail-grid { grid-template-columns: 1fr; }
        .stats-summary-header { flex-direction: column; }
        .radar-section { margin: 0 auto; }
        .stats-grid { grid-template-columns: repeat(2, 1fr); }
        .quick-kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .public-compact-analysis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .public-radar-card,
        .public-breakdown-card { grid-column: auto; }
        .relationship-container { grid-template-columns: 1fr; }
      }
      @container (max-width: 720px) {
        .stats-summary-header { flex-direction: column; }
        .radar-section { margin: 0 auto; }
        .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .quick-kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .public-compact-analysis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .public-radar-card,
        .public-breakdown-card { grid-column: auto; }
        .relationship-container { grid-template-columns: 1fr; }
        .quick-kpi strong { font-size: 21px; }
        .quick-kpi span { font-size: 11px; }
        .preferred-map-copy strong { font-size: 18px; }
        .stat-box { padding: 12px 10px; }
        .stat-box label { font-size: 11px; }
        .stat-box .value { font-size: 17px; }
        .header-row { align-items: stretch; }
        .analysis-heading-meta { align-items: flex-start; flex-direction: column; }
      }
      @media (max-width: 650px) {
        .vs-mode-card .vs-grid-container { gap: 18px; }
      }
      @media (max-width: 560px) {
        .stats-summary-card { padding: 18px; }
        .playstyle-banner {
          flex-direction: column;
          align-items: flex-start;
          gap: 12px;
          padding: 14px 16px;
        }
        .status-divider { display: none; }
        .header-row {
          flex-direction: column;
          align-items: flex-start;
          gap: 10px;
        }
        .header-row h3 { font-size: 18px; line-height: 1.4; }
        .stats-grid { grid-template-columns: 1fr; }
        .quick-kpi-grid { grid-template-columns: 1fr; }
        .public-compact-analysis { grid-template-columns: 1fr; }
        .public-radar-card,
        .public-breakdown-card { grid-column: auto; }
      }
    </style>
  `;
}

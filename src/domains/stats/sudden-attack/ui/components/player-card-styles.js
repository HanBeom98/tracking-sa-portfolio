/** Styles scoped to the <sa-player-card> custom element. */
export const PLAYER_CARD_STYLES = String.raw`
        .sa-card {
          background:
            radial-gradient(circle at top right, var(--sa-accent-soft), transparent 30%),
            linear-gradient(180deg, var(--sa-surface-1) 0%, var(--sa-surface-2) 100%);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 24px;
          margin: 16px 0 12px;
          box-shadow: none;
          position: relative;
          overflow: hidden;
          container-type: inline-size;
        }
        .sa-card.is-crew-card {
          border-color: color-mix(in srgb, var(--gold) 45%, transparent);
          box-shadow: var(--sa-shadow), 0 0 0 1px color-mix(in srgb, var(--gold) 14%, transparent);
        }
        .summary-topline {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 16px;
        }
        .identity-chip {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          border-radius: 999px;
          background: var(--sa-line-soft);
          border: 1px solid var(--sa-line-strong);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.04em;
          color: var(--sa-text-muted);
          text-transform: uppercase;
        }
        .identity-chip.crew {
          color: #ffcc00;
          background: var(--sa-gold-soft);
          border-color: color-mix(in srgb, var(--gold) 20%, transparent);
        }
        .profile-view-menu { position: relative; }
        .profile-view-menu summary {
          position: relative;
          overflow: hidden;
          list-style: none;
          min-width: 116px;
          cursor: pointer;
          text-align: center;
          user-select: none;
          transition: border-color .2s ease, background-color .2s ease, box-shadow .2s ease;
        }
        .profile-view-menu.activity-menu-hint summary {
          animation: activity-menu-glow 4.2s ease-in-out infinite;
        }
        .profile-view-menu.activity-menu-hint summary::before {
          content: '';
          position: absolute;
          top: -70%;
          left: -42%;
          width: 26%;
          height: 240%;
          pointer-events: none;
          opacity: 0;
          transform: rotate(18deg);
          background: linear-gradient(90deg, transparent, rgba(255,255,255,.82), transparent);
          animation: activity-menu-shine 4.2s ease-in-out infinite;
        }
        @keyframes activity-menu-glow {
          0%, 24%, 100% {
            border-color: var(--sa-line-strong);
            box-shadow: 0 0 0 0 transparent;
          }
          10% {
            border-color: color-mix(in srgb, var(--primary) 78%, #fff 22%);
            background: color-mix(in srgb, var(--primary) 16%, var(--sa-line-soft));
            box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 22%, transparent), 0 0 18px color-mix(in srgb, var(--primary) 42%, transparent);
          }
        }
        @keyframes activity-menu-shine {
          0%, 6%, 30%, 100% { left: -42%; opacity: 0; }
          10% { opacity: .92; }
          22% { left: 116%; opacity: .2; }
        }
        .profile-view-menu[open] summary {
          animation-play-state: paused;
          border-color: color-mix(in srgb, var(--primary) 75%, #fff 25%);
          background: color-mix(in srgb, var(--primary) 14%, var(--sa-line-soft));
          box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary) 18%, transparent);
        }
        @media (prefers-reduced-motion: reduce) {
          .profile-view-menu.activity-menu-hint summary {
            animation: none;
            border-color: color-mix(in srgb, var(--primary) 68%, var(--sa-line-strong));
          }
          .profile-view-menu.activity-menu-hint summary::before {
            display: none;
            animation: none;
          }
        }
        .profile-view-menu summary::-webkit-details-marker { display: none; }
        .profile-view-menu summary::after { content: ' ▾'; color: var(--sa-text-soft); }
        .profile-view-menu[open] summary::after { content: ' ▴'; }
        .profile-view-options {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          z-index: 10;
          min-width: 132px;
          padding: 6px;
          border: 1px solid var(--sa-line-strong);
          border-radius: 12px;
          background: var(--sa-surface-1);
          box-shadow: var(--sa-shadow);
        }
        .profile-view-options button {
          width: 100%;
          padding: 9px 10px;
          border: 0;
          border-radius: 8px;
          background: transparent;
          color: var(--sa-text-muted);
          cursor: pointer;
          text-align: left;
          font: inherit;
          font-size: 12px;
          font-weight: 800;
        }
        .profile-view-options button:hover,
        .profile-view-options button:focus-visible,
        .profile-view-options button.active {
          color: var(--sa-text-strong);
          background: var(--sa-accent-soft);
          outline: none;
        }
        .profile-panel.hidden { display: none; }
        .public-profile-facts {
          display: flex;
          align-items: center;
          gap: 14px;
          margin: 0 0 16px;
          color: var(--sa-text-muted);
          font-size: 13px;
        }
        .public-profile-facts span {
          display: inline-flex;
          align-items: baseline;
          gap: 7px;
          min-width: 0;
        }
        .public-profile-facts small {
          color: var(--sa-text-soft);
          font-size: 12px;
          font-weight: 700;
        }
        .public-profile-facts strong {
          color: var(--sa-text-strong);
          font-size: 14px;
          overflow-wrap: anywhere;
        }
        .public-profile-facts i {
          width: 1px;
          height: 14px;
          flex: 0 0 1px;
          background: var(--sa-line-strong);
        }
        .profile-main {
          display: grid;
          grid-template-columns: auto 1fr auto;
          gap: 16px;
          align-items: center;
          margin-bottom: 22px;
        }
        .rank-icon-wrapper {
          width: 52px;
          height: 52px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 14px;
          background: var(--sa-line-soft);
          border: 1px solid var(--sa-line-strong);
        }
        .rank-icon { max-width: 34px; max-height: 34px; object-fit: contain; }
        .name-area {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .nickname-row {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .nickname {
          font-size: clamp(26px, 5cqw, 32px);
          line-height: 1.05;
          font-weight: 900;
          color: var(--sa-text-strong);
          letter-spacing: -0.03em;
          overflow-wrap: anywhere;
          word-break: break-word;
        }
        .clan-name {
          color: #ffcc00;
          font-size: clamp(13px, 2.8cqw, 15px);
          font-weight: 700;
          overflow-wrap: anywhere;
        }
        .profile-sub {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          color: var(--sa-text-muted);
          font-size: 14px;
        }
        .sub-dot {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: var(--sa-line-strong);
        }
        .rank-summary {
          display: flex;
          gap: 12px;
          align-items: stretch;
        }
        .rank-pill {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 138px;
          padding: 12px 14px;
          border-radius: 14px;
          background: var(--sa-line-soft);
          border: 1px solid var(--sa-line-strong);
        }
        .rank-tier-image {
          width: 38px;
          height: 38px;
          flex: 0 0 38px;
          object-fit: contain;
        }
        .rank-pill-copy {
          display: block;
          min-width: 0;
        }
        .rank-pill-label {
          display: block;
          color: var(--sa-text-soft);
          font-size: 11px;
          margin-bottom: 6px;
          font-weight: 700;
          text-transform: uppercase;
        }
        .rank-pill-value {
          display: block;
          color: var(--sa-text-strong);
          font-size: 15px;
          font-weight: 800;
        }
        .rank-pill-score {
          display: block;
          color: var(--primary);
          font-size: 13px;
          margin-top: 4px;
          font-weight: 700;
        }
        .summary-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          align-items: stretch;
        }
        .summary-card {
          padding: 16px 16px 14px;
          border-radius: 16px;
          background: var(--sa-surface-3);
          border: 1px solid var(--sa-line-soft);
          display: flex;
          flex-direction: column;
          min-height: 122px;
        }
        .summary-card label {
          display: block;
          margin-bottom: 8px;
          font-size: 11px;
          color: var(--sa-text-soft);
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .summary-card strong {
          display: block;
          color: var(--sa-text-strong);
          font-size: 20px;
          line-height: 1.15;
          font-weight: 900;
          letter-spacing: -0.03em;
          overflow-wrap: anywhere;
          word-break: break-word;
        }
        .summary-card span {
          display: block;
          margin-top: 6px;
          color: var(--sa-text-muted);
          font-size: 12px;
          line-height: 1.5;
        }
        .summary-card.emphasis strong { color: var(--primary); }
        .summary-card.crew strong { color: #ffcc00; }
        .summary-card.compact-number strong {
          font-size: clamp(17px, 4.4cqw, 20px);
          line-height: 1.1;
        }
        .summary-card.trend strong {
          font-size: clamp(17px, 4.4cqw, 19px);
          line-height: 1.25;
          min-height: 48px;
        }
        .summary-card.trend span {
          margin-top: auto;
        }
        .official-metrics-grid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 10px;
        }
        .official-metric {
          padding: 14px 10px;
          border-radius: 14px;
          background: var(--sa-surface-3);
          border: 1px solid var(--sa-line-soft);
          text-align: center;
        }
        .official-metric label,
        .activity-stat label {
          display: block;
          margin-bottom: 7px;
          color: var(--sa-text-soft);
          font-size: 11px;
          font-weight: 700;
        }
        .official-metric strong {
          color: var(--sa-text-strong);
          font-size: 18px;
          font-weight: 900;
        }
        .official-metric.primary strong { color: var(--primary); }
        .activity-overview {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 14px;
        }
        .activity-stat {
          padding: 14px;
          border-radius: 14px;
          background: var(--sa-surface-3);
          border: 1px solid var(--sa-line-soft);
        }
        .activity-stat strong {
          color: var(--sa-text-strong);
          font-size: 16px;
          font-weight: 900;
        }
        .activity-slots { display: grid; gap: 9px; }
        .activity-slot-head {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 5px;
          color: var(--sa-text-muted);
          font-size: 12px;
        }
        .activity-bar {
          height: 8px;
          overflow: hidden;
          border-radius: 999px;
          background: var(--sa-surface-3);
        }
        .activity-bar span {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, var(--primary), var(--secondary));
        }
        .activity-note {
          margin: 12px 0 0;
          color: var(--sa-text-soft);
          font-size: 11px;
          line-height: 1.5;
        }
        .activity-heatmap-wrap { margin: 4px 0 18px; padding: 14px; border: 1px solid var(--sa-line-soft); border-radius: 14px; background: var(--sa-surface-3); }
        .activity-section-head { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; margin-bottom:12px; color:var(--sa-text-muted); font-size:11px; }
        .activity-section-head > div { display:grid; gap:4px; }
        .activity-section-head strong { color:var(--sa-text-strong); font-size:13px; }
        .activity-section-head small { color:var(--sa-text-soft); font-size:10px; font-weight:700; }
        .activity-heatmap { display:grid; grid-template-columns:repeat(7, minmax(12px, 1fr)); gap:6px; max-width:420px; }
        .activity-day { display:block; aspect-ratio:1; min-width:10px; border-radius:4px; background:var(--sa-line-soft); border:1px solid color-mix(in srgb, var(--border) 75%, transparent); }
        .activity-day.level-1 { background:color-mix(in srgb, var(--primary) 28%, var(--sa-surface-3)); }
        .activity-day.level-2 { background:color-mix(in srgb, var(--primary) 48%, var(--sa-surface-3)); }
        .activity-day.level-3 { background:color-mix(in srgb, var(--primary) 72%, var(--sa-surface-3)); }
        .activity-day.level-4 { background:var(--primary); box-shadow:0 0 10px color-mix(in srgb, var(--primary) 30%, transparent); }
        .activity-loading { display:grid; gap:10px; padding:24px; border:1px solid var(--sa-line-soft); border-radius:14px; background:var(--sa-surface-3); color:var(--sa-text-muted); }
        .activity-loading strong { color:var(--sa-text-strong); }
        .activity-progress { height:8px; overflow:hidden; border-radius:999px; background:var(--sa-line-soft); }
        .activity-progress i { display:block; height:100%; border-radius:inherit; background:linear-gradient(90deg,var(--primary),var(--secondary)); transition:width .2s ease; }
        .activity-retry,.activity-day-retry { min-height:44px; padding:8px 14px; border:1px solid var(--sa-line-strong); border-radius:10px; background:var(--bg-card); color:var(--sa-text-strong); font:inherit; font-weight:700; cursor:pointer; }
        .activity-day-retry { display:block; margin-top:10px; }
        .activity-retry:focus-visible,.activity-day-retry:focus-visible { outline:2px solid var(--primary); outline-offset:3px; }
        .activity-error { border-color:color-mix(in srgb, var(--red) 35%, transparent); }
        .activity-day { padding:0; cursor:pointer; }
        .activity-day:disabled { cursor:not-allowed; opacity:.55; }
        .activity-day.selected { outline:2px solid var(--secondary); outline-offset:2px; }
        .activity-day-tools { display:flex; align-items:end; justify-content:space-between; gap:14px; flex-wrap:wrap; margin:20px 0 12px; }
        .activity-day-tools label { display:grid; gap:6px; color:var(--sa-text-muted); font-size:11px; font-weight:800; }
        .activity-date-input { min-height:38px; padding:7px 10px; border:1px solid var(--sa-line-strong); border-radius:10px; background:var(--sa-surface-3); color:var(--sa-text-strong); color-scheme:dark; }
        .activity-mode-tabs { display:flex; gap:6px; flex-wrap:wrap; }
        .activity-mode-tabs button { padding:8px 11px; border:1px solid var(--sa-line-strong); border-radius:999px; background:var(--sa-surface-3); color:var(--sa-text-muted); font:inherit; font-size:11px; font-weight:800; cursor:pointer; }
        .activity-mode-tabs button.active { border-color:var(--primary); background:var(--primary); color:#fff; }
        .activity-day-analysis { padding:16px; border:1px solid var(--sa-line-soft); border-radius:14px; background:var(--sa-surface-3); }
        .activity-day-heading { display:flex; justify-content:space-between; gap:12px; margin-bottom:14px; }
        .activity-day-heading div { display:grid; gap:3px; }
        .activity-day-heading span,.activity-day-heading small { color:var(--sa-text-soft); font-size:11px; }
        .activity-day-heading strong { color:var(--sa-text-strong); }
        .activity-comparison-guide { margin:0 0 12px; padding:10px 12px; border-radius:10px; background:var(--sa-accent-soft); color:var(--sa-text-muted); font-size:11px; font-weight:750; line-height:1.5; }
        .activity-day-metrics { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:8px; }
        .activity-day-metrics > div { display:grid; gap:5px; padding:12px; border:1px solid var(--sa-line-soft); border-radius:11px; }
        .activity-day-metrics label,.activity-day-metrics span { color:var(--sa-text-soft); font-size:10px; }
        .activity-day-metrics strong { color:var(--sa-text-strong); font-size:17px; }
        .activity-compare-metric { grid-template-rows:auto auto auto auto; }
        .activity-baseline { display:flex; align-items:center; justify-content:space-between; gap:8px; padding-top:7px; border-top:1px solid var(--sa-line-soft); }
        .activity-baseline b { color:var(--sa-text-strong); font-size:12px; }
        .activity-day-metrics .up { color:var(--primary); }.activity-day-metrics .down { color:var(--red); }
        .activity-day-empty,.activity-day-loading { margin:0; color:var(--sa-text-muted); font-size:12px; }
        @container (max-width: 620px) {
          .profile-main {
            grid-template-columns: auto minmax(0, 1fr);
            align-items: flex-start;
          }
          .rank-summary {
            grid-column: 1 / -1;
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .rank-pill {
            min-width: 0;
          }
          .summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .official-metrics-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .summary-card {
            min-height: 112px;
          }
        }
        @container (max-width: 440px) {
          .summary-topline {
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
          }
          .profile-main {
            grid-template-columns: 1fr;
          }
          .rank-summary {
            grid-template-columns: 1fr;
          }
          .summary-grid {
            grid-template-columns: 1fr;
          }
          .official-metrics-grid,
          .activity-overview { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .activity-day-metrics { grid-template-columns:repeat(2,minmax(0,1fr)); }
          .summary-card strong {
            font-size: 18px;
          }
        }
        @media (max-width: 980px) {
          .profile-main { grid-template-columns: auto 1fr; }
          .rank-summary { grid-column: 1 / -1; }
          .summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 640px) {
          .sa-card { padding: 22px; }
          .summary-topline {
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
          }
          .nickname { font-size: 28px; }
          .profile-main { grid-template-columns: 1fr; }
          .rank-summary { flex-direction: column; }
          .rank-pill {
            min-width: 0;
          }
          .summary-grid { grid-template-columns: 1fr; }
          .official-metrics-grid,
          .activity-overview { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 420px) {
          .sa-card {
            padding: 18px;
            border-radius: 18px;
          }
          .rank-icon-wrapper {
            width: 46px;
            height: 46px;
          }
          .rank-icon {
            max-width: 30px;
            max-height: 30px;
          }
          .nickname {
            font-size: 24px;
          }
          .clan-name,
          .profile-sub {
            font-size: 13px;
          }
          .summary-card {
            padding: 14px;
          }
          .summary-card strong {
            font-size: 20px;
          }
          .summary-card span {
            line-height: 1.45;
          }
        }
        .official-metrics-grid.public-official-grid {
          grid-template-columns: repeat(5, minmax(0, 1fr));
        }
        @container (max-width: 760px) {
          .official-metrics-grid.public-official-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
        @container (max-width: 440px) {
          .official-metrics-grid.public-official-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .public-profile-facts {
            align-items: flex-start;
            gap: 8px 12px;
            flex-wrap: wrap;
          }
          .public-profile-facts span {
            flex: 1 1 130px;
            justify-content: space-between;
          }
          .public-profile-facts i {
            display: none;
          }
        }
`;

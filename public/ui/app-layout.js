class AppLayout extends HTMLElement {
  static get observedAttributes() {
    return ['page-title', 'page-description'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    if (this.isConnected) {
      this.render();
    }
  }

  render() {
    const title = this.getAttribute('page-title') || 'Tracking SA';
    const description = this.getAttribute('page-description') || '';

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          min-height: 100dvh;
          background: var(--bg-main, #f8fafc);
          color: var(--text-main, #1e293b);
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans KR", "Malgun Gothic", sans-serif;
        }
        .layout-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 40px 20px;
        }
        .page-header {
          margin-bottom: 40px;
          text-align: center;
        }
        .page-title {
          font-size: 2.5rem;
          font-weight: 900;
          color: var(--link-color, #0052cc);
          margin-bottom: 10px;
          letter-spacing: -1px;
        }
        .page-description {
          font-size: 1.1rem;
          color: var(--text-sub, #64748b);
          max-width: 600px;
          margin: 0 auto;
          line-height: 1.6;
        }
        .content-card {
          background: var(--surface-card, white);
          border-radius: 24px;
          padding: 40px;
          box-shadow: 0 10px 30px rgba(0, 82, 204, 0.05);
          border: 1px solid var(--surface-border, rgba(0, 0, 0, 0.02));
        }
        :host-context(body.dark-mode) {
          --surface-card: #111827;
          --surface-border: #334155;
        }
        :host-context(body.dark-mode) .page-description {
          color: #cbd5e1;
        }
        :host-context(body.dark-mode) .content-card {
          box-shadow: 0 14px 34px rgba(0, 0, 0, 0.24);
        }
      </style>
      <div class="layout-container">
        <header class="page-header">
          <h1 class="page-title">${title}</h1>
          ${description ? `<p class="page-description">${description}</p>` : ''}
        </header>
        <main class="content-card">
          <slot></slot>
        </main>
      </div>
    `;
  }
}

customElements.define('app-layout', AppLayout);

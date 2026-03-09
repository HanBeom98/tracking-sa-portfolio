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
          font-family: 'Pretendard', system-ui, sans-serif;
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
          color: #0052cc;
          margin-bottom: 10px;
          letter-spacing: -1px;
        }
        .page-description {
          font-size: 1.1rem;
          color: #64748b;
          max-width: 600px;
          margin: 0 auto;
          line-height: 1.6;
        }
        .content-card {
          background: white;
          border-radius: 24px;
          padding: 40px;
          box-shadow: 0 10px 30px rgba(0, 82, 204, 0.05);
          border: 1px solid rgba(0, 0, 0, 0.02);
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

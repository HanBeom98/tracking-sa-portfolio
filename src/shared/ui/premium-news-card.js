<!-- web-components/premium-news-card.js -->
class PremiumNewsCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  render() {
    const title = this.getAttribute('title') || 'No Title';
    const content = this.getAttribute('content') || 'No Content';
    const imageUrl = this.getAttribute('image') || '';
    const linkUrl = this.getAttribute('link') || '#';

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          background: linear-gradient(to right, oklch(65%, 0.12, 250), oklch(55%, 0.15, 250));
          color: white;
          border-radius: 16px;
          padding: 2rem;
          margin-bottom: 2rem;
          box-shadow:
            0 4px 6px oklch(0%, 0, 0, 0.2),
            0 1px 3px oklch(0%, 0, 0, 0.3);
          transition: transform 0.3s ease-in-out, box-shadow 0.3s ease-in-out;
          cursor: pointer;
        }

        :host(:hover) {
          transform: translateY(-6px);
          box-shadow:
            0 8px 12px oklch(0%, 0, 0, 0.3),
            0 2px 6px oklch(0%, 0, 0, 0.4);
        }

        h2 {
          margin-top: 0;
          margin-bottom: 0.75rem;
          font-size: 1.5rem;
          color: white;
          text-shadow: 0 1px 2px oklch(0%, 0, 0, 0.4);
        }

        p {
          margin-bottom: 1rem;
          color: oklch(95%, 0.01, 20);
          text-shadow: 0 1px 2px oklch(0%, 0, 0, 0.4);
        }

        a {
          color: oklch(80%, 0.1, 60); /* A vibrant yellow */
          text-decoration: none;
          font-weight: 600;
        }

        a:hover {
          text-decoration: underline;
        }

        .image-container {
            width: 100%;
            margin-bottom: 1rem;
        }

        img {
            width: 100%;
            height: auto;
            border-radius: 8px;
            object-fit: cover;
        }
      </style>

      <a href="${linkUrl}" target="_blank">
          ${imageUrl ? `<div class="image-container"><img src="${imageUrl}" alt="${title}"></div>` : ''}
          <h2>${title}</h2>
          <p>${content}</p>
      </a>
    `;
  }
}

customElements.define('premium-news-card', PremiumNewsCard);
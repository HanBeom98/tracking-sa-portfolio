// premium-tag.js
class PremiumTag extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  render() {
    this.shadow.innerHTML = `
      <style>
        .premium-tag {
          display: inline-block;
          padding: 0.5em 1em;
          background: linear-gradient(to right, oklch(50%, 0.2, 60), oklch(60%, 0.25, 30)); /* Oklch Gradient */
          color: oklch(95%, 0.05, 270); /* Light text */
          border-radius: 0.25em;
          font-weight: bold;
          box-shadow: 0 2px 5px oklch(0%, 0, 0, 0.3); /* Multiple Shadows */
          -webkit-font-smoothing: antialiased;
          word-break: keep-all;
          line-height: 1.6;
        }
      </style>
      <span class="premium-tag">Premium</span>
    `;
  }
}

customElements.define('premium-tag', PremiumTag);
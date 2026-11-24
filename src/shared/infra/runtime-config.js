/**
 * Tracking SA Runtime Configuration
 * Centralized settings for API endpoints and environment variables.
 */
window.runtimeConfig = {
    // Public API handlers run on the same Cloudflare Pages deployment.
    apiBaseUrl: "/api",
    soopLiveMode: "paged",
    // Enable after the AdSense site status is ready. No manual ad requests while false.
    guideAdEnabled: false,
    // Versioning for cache busting
    version: "1.0.0_" + Date.now()
};

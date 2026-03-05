/**
 * Tracking SA Runtime Configuration
 * Centralized settings for API endpoints and environment variables.
 */
window.runtimeConfig = {
    // API Endpoints (Vercel bypass for Cloudflare location restrictions)
    apiBaseUrl: "https://tracking-sa.vercel.app/api",
    fortuneApi: "https://tracking-sa.vercel.app/api/fortune",
    luckyApi: "https://tracking-sa.vercel.app/api/lucky",
    
    // Versioning for cache busting
    version: "1.0.0_" + Date.now()
};

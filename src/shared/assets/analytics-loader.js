import { getProductAnalytics, getPublicMeasurementContext, getMeasurementScope, MEASUREMENT_VERSION } from './product-analytics.js';

const initialized = new WeakMap();
export function initializeAnalytics(windowRef, documentRef) {
  if (initialized.has(windowRef)) return initialized.get(windowRef);
  const client = getProductAnalytics(windowRef, documentRef);
  const publicContext = getPublicMeasurementContext(windowRef, documentRef);
  const verification = publicContext && getMeasurementScope(windowRef) === 'verification';
  initialized.set(windowRef, client);
  // Inject this client into page runtimes without importing a second module URL.
  try { windowRef.trackingSaProductAnalytics = client; } catch { /* Optional page bridge. */ }
  let started = false;
  let delayTimer = null;
  let readyTimer = null;
  const interactions = ['pointerdown', 'keydown', 'touchstart'];

  function appendScript(src, id) {
    if (documentRef.getElementById(id)) return null;
    const script = documentRef.createElement('script');
    script.id = id;
    script.src = src;
    script.async = true;
    return script;
  }

  function startAnalytics() {
    if (started) return;
    started = true;
    if (delayTimer) windowRef.clearTimeout(delayTimer);
    interactions.forEach((name) => windowRef.removeEventListener(name, startAnalytics));
    try {
      windowRef.dataLayer = windowRef.dataLayer || [];
      windowRef.gtag = windowRef.gtag || function gtag() { windowRef.dataLayer.push(arguments); };
      windowRef.gtag('js', new Date());
      windowRef.gtag('config', 'G-PORTFOLIO', {
        ...(publicContext || {}),
        ...(verification ? { debug_mode: true, traffic_scope: 'verification', measurement_version: MEASUREMENT_VERSION } : {}),
      });
      const script = appendScript('https://www.googletagmanager.com/gtag/js?id=G-PORTFOLIO', 'tracking-sa-google-analytics');
      if (script) {
        const failed = () => { windowRef.clearTimeout(readyTimer); client.disable(); };
        script.onload = () => {
          windowRef.clearTimeout(readyTimer);
          client.setTransport((name, fields) => windowRef.gtag('event', name, { ...fields, send_to: 'G-PORTFOLIO' }));
        };
        script.onerror = failed;
        readyTimer = windowRef.setTimeout(failed, 10_000);
        documentRef.head.appendChild(script);
      } else client.disable();
    } catch { client?.disable(); }

    try {
      windowRef.clarity = windowRef.clarity || function clarity() { (windowRef.clarity.q = windowRef.clarity.q || []).push(arguments); };
      const script = appendScript('https://www.clarity.ms/tag/vb9q33ggpa', 'tracking-sa-microsoft-clarity');
      if (script) documentRef.head.appendChild(script);
    } catch { /* Analytics must not block the service or other providers. */ }
  }

  interactions.forEach((name) => windowRef.addEventListener(name, startAnalytics, { once: true, passive: true }));
  if (documentRef.readyState === 'complete') delayTimer = windowRef.setTimeout(startAnalytics, 4000);
  else windowRef.addEventListener('load', () => { delayTimer = windowRef.setTimeout(startAnalytics, 4000); }, { once: true });
  return client;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') initializeAnalytics(window, document);

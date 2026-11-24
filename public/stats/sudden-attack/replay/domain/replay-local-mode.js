// Keep preview access identical while leaving the mock engine out of normal loads.
export function isLocalCoachingTest(location) {
  return location.origin === 'http://127.0.0.1:4173'
    && new URLSearchParams(location.search).get('coaching') === 'mock';
}

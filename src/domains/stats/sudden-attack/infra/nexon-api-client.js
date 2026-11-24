/**
 * Nexon Open API Client for Sudden Attack (Proxy Version)
 * Now routes all requests through our secure /api/sa-proxy to hide the API Key.
 */
import { requestJson, RequestFailure, requestFailureCode, recordOperation } from '../../../shared/http-request.js';

import { readMatchList } from '../domain/match-query.js';

const MATCH_LIST_TTL_MS = 30_000;
const MATCH_LIST_CACHE_LIMIT = 32;

export class NexonApiClient {
  constructor(apiKey = "", { timeoutMs = 15000, fetchImpl, now = () => Date.now() } = {}) {
    // API Key is no longer strictly needed here as it's handled by the proxy,
    // but we keep the parameter for compatibility.
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
    this.fetchImpl = fetchImpl;
    this.now = now;
    this.matchListCache = new Map();
    this.pendingMatchLists = new Map();
    const apiBaseUrl = typeof window !== 'undefined'
      ? String(window.runtimeConfig?.apiBaseUrl || '').replace(/\/$/, '')
      : '';
    this.proxyUrl = apiBaseUrl ? `${apiBaseUrl}/sa-proxy` : '/api/sa-proxy';
  }

  async fetch(endpoint, params = {}) {
    // If endpoint doesn't start with /static or /suddenattack, prepend the SA API prefix
    const nexonPath = (endpoint.startsWith('/static') || endpoint.startsWith('/suddenattack'))
      ? endpoint
      : `/suddenattack/v1${endpoint}`;

    // Build URL pointing to OUR proxy
    const url = new URL(this.proxyUrl, window.location.origin);
    url.searchParams.append('path', nexonPath);

    // Append additional parameters
    Object.keys(params).forEach(key => {
      const value = params[key];
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.append(key, value);
      }
    });

    const startedAt = Date.now();
    let status = 0, requestId = '';
    try {
      const { response, data: errorData } = await requestJson(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      }, { timeoutMs: this.timeoutMs, fetchImpl: this.fetchImpl || globalThis.fetch });
      status = response.status;
      requestId = response.headers?.get?.('X-Request-ID') || '';

      if (!response.ok) {
        const message = errorData?.error?.message || "";

        const isNotFound = response.status === 400 && message.includes("valid parameter");

        if (isNotFound) {
          // Since we don't know if the key is test or live at the client level now,
          // we'll check the error message or default to PLAYER_NOT_FOUND.
          throw new RequestFailure('PLAYER_NOT_FOUND', { status, requestId });
        }
        const code = status === 504 || errorData?.code === 'REQUEST_TIMEOUT' ? 'REQUEST_TIMEOUT'
          : status === 429 ? 'RATE_LIMITED' : 'HTTP_ERROR';
        throw new RequestFailure(code, { status, requestId });
      }
      recordOperation('nexon_request', { status, requestId, durationMs: Date.now() - startedAt });
      return errorData;
    } catch (error) {
      recordOperation('nexon_request', { code: requestFailureCode(error), status, requestId, durationMs: Date.now() - startedAt });
      throw error;
    }
  }

  /**
   * Get ouid from character name
   */
  async getOuid(characterName) {
    const candidates = buildNicknameCandidates(characterName);
    let lastError = null;

    for (const candidate of candidates) {
      try {
        const data = await this.fetch('/id', { user_name: candidate });
        return data.ouid;
      } catch (error) {
        lastError = error;
        if (error?.message !== 'PLAYER_NOT_FOUND') throw error;
      }
    }

    throw lastError || new Error('PLAYER_NOT_FOUND');
  }

  /**
   * Get basic player info
   */
  async getPlayerBasic(ouid) {
    return this.fetch('/user/basic', { ouid });
  }

  /**
   * Get player rank/tier info
   */
  async getPlayerRank(ouid) {
    return this.fetch('/user/rank', { ouid });
  }

  /**
   * Get player competitive tier info
   */
  async getPlayerTier(ouid) {
    return this.fetch('/user/tier', { ouid });
  }

  /**
   * Get static metadata
   */
  async getStaticMeta(type) {
    const path = `/static/suddenattack/meta/${type}`;
    return this.fetch(path);
  }

  /**
   * Get match list
   */
  async getMatchList(ouid, matchType, matchMode) {
    // Nexon provides recent lists (up to 1,000 rows), not dated snapshots.
    const key = JSON.stringify([String(ouid), matchType || '', matchMode || '']);
    const now = this.now();
    for (const [cachedKey, entry] of this.matchListCache) {
      if (entry.expiresAt <= now) this.matchListCache.delete(cachedKey);
    }
    const cached = this.matchListCache.get(key);
    if (cached) {
      this.matchListCache.delete(key);
      this.matchListCache.set(key, cached);
      return cached.data;
    }
    if (this.pendingMatchLists.has(key)) return this.pendingMatchLists.get(key);

    const request = this.fetch('/match', { ouid, match_type: matchType, match_mode: matchMode })
      .then(data => {
        readMatchList(data);
        // An invalidated request may finish, but cannot restore an old cache.
        if (this.pendingMatchLists.get(key) === request
          && Array.isArray(data?.match) && data.match.length <= 1000) {
          while (this.matchListCache.size >= MATCH_LIST_CACHE_LIMIT) {
            this.matchListCache.delete(this.matchListCache.keys().next().value);
          }
          this.matchListCache.set(key, { data, expiresAt: this.now() + MATCH_LIST_TTL_MS });
        }
        return data;
      })
      .finally(() => {
        if (this.pendingMatchLists.get(key) === request) this.pendingMatchLists.delete(key);
      });
    this.pendingMatchLists.set(key, request);
    return request;
  }

  invalidateMatchLists(ouid) {
    for (const cache of [this.matchListCache, this.pendingMatchLists]) {
      for (const key of cache.keys()) {
        if (ouid === undefined || JSON.parse(key)[0] === String(ouid)) cache.delete(key);
      }
    }
  }

  /**
   * Get match details
   */
  async getMatchDetail(matchId) {
    return this.fetch('/match-detail', { match_id: matchId });
  }

  /**
   * Get recent stats trend
   */
  async getRecentInfo(ouid) {
    return this.fetch('/user/recent-info', { ouid });
  }
}

export function buildNicknameCandidates(characterName) {
  const original = String(characterName || '').trim();
  if (!original) return [original];

  // Nexon's nickname lookup currently treats Latin letter casing as exact even
  // though Sudden Attack nicknames are effectively case-insensitive in-game.
  if (!/^[A-Za-z0-9_-]+$/.test(original) || !/[A-Za-z]/.test(original)) {
    return [original];
  }

  const lower = original.toLowerCase();
  const commonCandidates = [
    original,
    lower.charAt(0).toUpperCase() + lower.slice(1),
    lower,
    original.toUpperCase()
  ];

  const latinLetterCount = (original.match(/[A-Za-z]/g) || []).length;
  if (latinLetterCount > 5) return [...new Set(commonCandidates)];

  // Short Latin nicknames commonly use mixed casing. Nexon's OUID endpoint
  // requires the exact casing, unlike the in-game barracks search, so try all
  // casing combinations while keeping the request count bounded (max 32).
  let variants = [''];
  for (const character of lower) {
    variants = /[a-z]/.test(character)
      ? variants.flatMap((prefix) => [prefix + character, prefix + character.toUpperCase()])
      : variants.map((prefix) => prefix + character);
  }

  return [...new Set([...commonCandidates, ...variants])];
}

/**
 * Nexon Open API Client for Sudden Attack (Proxy Version)
 * Now routes all requests through our secure /api/sa-proxy to hide the API Key.
 */
export class NexonApiClient {
  constructor(apiKey = "") {
    // API Key is no longer strictly needed here as it's handled by the proxy,
    // but we keep the parameter for compatibility.
    this.apiKey = apiKey;
    this.proxyUrl = '/api/sa-proxy'; 
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

    console.log(`[Proxy Request]: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = errorData.error?.message || "";
      
      const isNotFound = response.status === 400 && message.includes("valid parameter");
      
      if (!isNotFound) {
        console.error(`[Proxy Error] Status: ${response.status}`, JSON.stringify(errorData, null, 2));
      }
      
      if (isNotFound) {
        // Since we don't know if the key is test or live at the client level now,
        // we'll check the error message or default to PLAYER_NOT_FOUND.
        throw new Error('PLAYER_NOT_FOUND');
      }
      
      throw new Error(message || `Proxy/Nexon Error: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get ouid from character name
   */
  async getOuid(characterName) {
    const data = await this.fetch('/id', { user_name: characterName });
    return data.ouid;
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
  async getMatchList(ouid, matchType, matchMode, date = "") {
    const params = { ouid, match_type: matchType, match_mode: matchMode };
    if (date) params.date = date;
    return this.fetch('/match', params);
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

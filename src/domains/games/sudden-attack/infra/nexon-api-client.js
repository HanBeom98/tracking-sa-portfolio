/**
 * Nexon Open API Client for Sudden Attack
 * Handles authentication and base request logic.
 */
export class NexonApiClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://open.api.nexon.com/suddenattack/v1';
  }

  async fetch(endpoint, params = {}) {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

    console.log(`[NexonAPI Request]: ${url.toString()}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-nxopen-api-key': this.apiKey,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`[NexonAPI Error Response] Status: ${response.status}`, JSON.stringify(errorData, null, 2));
      
      const message = errorData.error?.message || "";
      const isTestKey = this.apiKey.startsWith('test_');
      
      // Nexon API returns 400 for non-existent characters OR 
      // characters outside the test account's scope when using a Test Key.
      if (response.status === 400 && message.includes("valid parameter")) {
        if (isTestKey) {
          throw new Error('TEST_KEY_LIMITATION');
        }
        throw new Error('PLAYER_NOT_FOUND');
      }
      
      throw new Error(message || `Nexon API Error: ${response.status}`);
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

import { Player, MatchRecord, RecentStats } from '../domain/models.js';

/**
 * Sudden Attack Data Repository (Infrastructure Layer)
 * Bridges the gap between the Nexon API and the Domain models.
 */
export class SaRepository {
  constructor(apiClient) {
    this.apiClient = apiClient;
    this.crewMembers = []; // Dynamic crew members list
    this.meta = {
      grade: [],
      season_grade: [],
      tier: []
    };
  }

  setCrewMembers(list) {
    this.crewMembers = list || [];
  }

  /**
   * Pre-load metadata for image mapping
   */
  async initMeta() {
    if (this.meta.grade && this.meta.grade.length > 0) return;
    try {
      // Use Absolute Path to ensure file is found regardless of page depth
      const baseUrl = '/games/sudden-attack/infra/meta';
      const [grade, season, tier, logo] = await Promise.all([
        fetch(`${baseUrl}/grade.json`).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
        fetch(`${baseUrl}/season_grade.json`).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
        fetch(`${baseUrl}/tier.json`).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
        fetch(`${baseUrl}/logo.json`).then(r => r.json()).catch(() => null)
      ]);
      
      this.meta.grade = grade;
      this.meta.season_grade = season;
      this.meta.tier = tier;
      this.meta.logo = logo;

      console.log('[Repository] Local meta data loaded successfully');
    } catch (err) {
      console.warn('[Repository] Failed to load local meta, using direct API fetch (No Auth Header):', err);
      
      // Fallback: Fetch directly from Nexon API WITHOUT headers to avoid Preflight/CORS issues
      // Based on investigation, Nexon Static API works via CORS ONLY if no custom headers are sent.
      const apiBase = 'https://open.api.nexon.com/static/suddenattack/meta';
      try {
        const [grade, season, tier] = await Promise.all([
          fetch(`${apiBase}/grade`).then(r => r.json()),
          fetch(`${apiBase}/season_grade`).then(r => r.json()),
          fetch(`${apiBase}/tier`).then(r => r.json())
        ]);
        this.meta.grade = grade;
        this.meta.season_grade = season;
        this.meta.tier = tier;
      } catch (apiErr) {
        console.error('[Repository] All meta load attempts failed:', apiErr);
        this.meta.grade = [];
        this.meta.season_grade = [];
        this.meta.tier = [];
      }
    }
  }

  _getGradeImage(name) {
    return this.meta.grade.find(m => m.grade === name)?.grade_image || "";
  }

  _getSeasonGradeImage(name) {
    return this.meta.season_grade.find(m => m.season_grade === name)?.season_grade_image || "";
  }

  _getTierImage(name) {
    return this.meta.tier.find(m => m.tier === name)?.tier_image || "";
  }

  /**
   * Resolve a player by character name
   */
  async getPlayer(characterName) {
    await this.initMeta();
    const ouid = await this.apiClient.getOuid(characterName);
    const [basic, rank, tier] = await Promise.all([
      this.apiClient.getPlayerBasic(ouid),
      this.apiClient.getPlayerRank(ouid),
      this.apiClient.getPlayerTier(ouid)
    ]);

    // Map Images
    basic.grade_image = this._getGradeImage(rank.grade);
    basic.season_grade_image = this._getSeasonGradeImage(rank.season_grade);
    if (tier) {
      tier.solo_image = this._getTierImage(tier.solo_rank_match_tier);
      tier.party_image = this._getTierImage(tier.party_rank_match_tier);
    }
    
    return new Player(ouid, basic, rank, tier);
  }

  /**
   * Fetch recent trend stats (K/D, Win Rate)
   */
  async getPlayerStats(ouid) {
    try {
      const data = await this.apiClient.getRecentInfo(ouid);
      console.log('[Repository] Player Recent Info:', JSON.stringify(data, null, 2));
      return new RecentStats(data);
    } catch (error) {
      console.warn('[Repository] Failed to get recent stats:', error.message);
      return null;
    }
  }

  /**
   * Fetch recent matches for a player (Resilient Sequential Scan)
   */
  async getRecentMatches(ouid, limit = 5, nickname = "") {
    // Verified working modes that cover most player activities
    const modes = ["폭파미션", "데스매치", "개인전"];

    const combinedMatches = [];
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // Get Today and Yesterday in KST (YYYY-MM-DD)
    const now = new Date();
    const kstFormatter = new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });

    const formatDateParts = (date) => {
      const parts = kstFormatter.formatToParts(date);
      const y = parts.find(p => p.type === 'year').value;
      const m = parts.find(p => p.type === 'month').value;
      const d = parts.find(p => p.type === 'day').value;
      return `${y}-${m}-${d}`;
    };

    const dates = [formatDateParts(now), ""]; // Try today then latest

    try {
      console.log(`[Repository] Starting deep scan for OUID: ${ouid}`);
      
      for (const date of dates) {
        for (const mode of modes) {
          try {
            await delay(400); // 0.4s delay
            // We omit match_type to get all (Rank, Clan, General)
            const data = await this.apiClient.getMatchList(ouid, "", mode, date);
            
            const matches = (data.match || []).map(m => ({ 
              ...m, 
              typeName: mode, // Just mode name
              match_date: m.date_match
            }));
            
            for (const m of matches) {
              if (!combinedMatches.find(cm => cm.match_id === m.match_id)) {
                combinedMatches.push(m);
              }
            }

            if (matches.length > 0) {
              console.log(`[Repository] Found ${matches.length} matches for mode: ${mode}`);
            }
          } catch (err) {
            // Silence common 400s
          }
        }
        if (combinedMatches.length >= limit) break;
      }

      // Sort by date (descending)
      const sortedMatches = combinedMatches
        .sort((a, b) => new Date(b.match_date) - new Date(a.match_date))
        .slice(0, limit);
      
      const details = [];
      for (const m of sortedMatches) {
        try {
          await delay(100);
          const detail = await this.apiClient.getMatchDetail(m.match_id);
          details.push(new MatchRecord(detail, m.typeName, nickname));
        } catch (err) {
          // If match-detail fails, fallback to basic data from list
          details.push(new MatchRecord({
            match_result: m.match_result,
            match_date: m.match_date,
            kill: m.kill,
            death: m.death,
            assist: m.assist,
            map_name: m.match_mode // Fallback map name
          }, m.typeName, nickname));
        }
      }
      
      return details;
    } catch (error) {
      console.error('[Repository] Fatal error during match scanning:', error);
      throw error;
    }
  }
}

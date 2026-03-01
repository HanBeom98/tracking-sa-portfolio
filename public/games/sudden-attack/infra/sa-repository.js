import { Player, MatchRecord, RecentStats } from '../domain/models.js';
import { SA_META } from './meta-data.js';

/**
 * Sudden Attack Data Repository (Infrastructure Layer)
 * Bridges the gap between the Nexon API and the Domain models.
 */
export class SaRepository {
  constructor(apiClient) {
    this.apiClient = apiClient;
    this.crewMembers = []; 
    this.crewOuids = [];   
    this.meta = {
      grade: [],
      season_grade: [],
      tier: [],
      logo: null
    };
  }

  setCrewMembers(names, ouids = []) {
    this.crewMembers = names || [];
    this.crewOuids = ouids || [];
  }

  /**
   * Pre-load metadata for image mapping
   * Refactored to use static JS import instead of network fetch for 100% reliability.
   */
  async initMeta() {
    if (this.meta.grade && this.meta.grade.length > 0) return;
    
    this.meta.grade = SA_META.grade || [];
    this.meta.season_grade = SA_META.season_grade || [];
    this.meta.tier = SA_META.tier || [];
    this.meta.logo = SA_META.logo || null;
    
    console.log('[Repository] Meta data loaded instantly from bundled JS');
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
    
    // Pass both lists to Player model
    return new Player(ouid, basic, rank, tier, { names: this.crewMembers, ouids: this.crewOuids });
  }

  /**
   * Fetch recent trend stats (K/D, Win Rate)
   */
  async getPlayerStats(ouid) {
    try {
      const data = await this.apiClient.getRecentInfo(ouid);
      return new RecentStats(data);
    } catch (error) {
      console.warn('[Repository] Failed to get recent stats:', error.message);
      return null;
    }
  }

  /**
   * Fetch recent matches for a player (Optimized: Single call for all modes)
   */
  async getRecentMatches(ouid, limit = 20, nickname = "") {
    const combinedMatches = [];
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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

    // Scan today and past (empty date) to ensure we get matches
    const dates = [formatDateParts(now), ""]; 

    try {
      for (const date of dates) {
        try {
          await delay(100); 
          // Fetch ALL matches (No string filter to avoid 400 error)
          const data = await this.apiClient.getMatchList(ouid, "", "", date);
          const matches = (data.match || []).map(m => ({ 
            ...m, 
            typeName: m.match_mode,
            match_date: m.date_match
          }));
          
          for (const m of matches) {
            // STRICT CLAN MATCH FILTER:
            // Nexon SA API: match_visual_type or match_type identifies the category.
            // Usually "클랜전" matches have a specific indicator. 
            // We'll check both the mode name and the internal type if available.
            const isClanMatch = (m.match_mode && m.match_mode.includes("클랜")) || 
                                (m.match_type === "클랜") || 
                                (m.match_visual_type && m.match_visual_type.includes("클랜"));

            if (isClanMatch && !combinedMatches.find(cm => cm.match_id === m.match_id)) {
              combinedMatches.push(m);
            }
          }
        } catch (err) {}
        
        if (combinedMatches.length >= limit) break;
      }

      // Filter for Clan Matches ONLY if that's what we want for settlement
      // or keep all and let isCustomMatch logic handle it.
      const sortedMatches = combinedMatches
        .sort((a, b) => new Date(b.match_date) - new Date(a.match_date))
        .slice(0, limit);
      
      const details = [];
      const crewData = { names: this.crewMembers, ouids: this.crewOuids };

      for (const m of sortedMatches) {
        try {
          await delay(50);
          const detail = await this.apiClient.getMatchDetail(m.match_id);
          
          const subjectInfo = {
            ouid: ouid,
            kill: m.kill,
            death: m.death,
            result: m.match_result
          };

          details.push(new MatchRecord(detail, m.typeName, nickname, crewData, subjectInfo));
        } catch (err) {
          details.push(new MatchRecord({
            match_id: m.match_id,
            match_result: m.match_result,
            match_date: m.match_date,
            kill: m.kill,
            death: m.death,
            assist: m.assist,
            map_name: m.match_mode || "알 수 없음"
          }, m.typeName, nickname, crewData));
        }
      }
      return details;
    } catch (error) {
      console.error('[Repository] Fatal error during match scanning:', error);
      throw error;
    }
  }
}

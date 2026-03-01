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
   * Fetch recent matches for a player (Resilient Sequential Scan)
   */
  async getRecentMatches(ouid, limit = 20, nickname = "") {
    const modes = ["폭파미션", "데스매치", "개인전"];
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

    const dates = [formatDateParts(now), ""]; 

    try {
      for (const date of dates) {
        for (const mode of modes) {
          try {
            await delay(400); 
            const data = await this.apiClient.getMatchList(ouid, "", mode, date);
            const matches = (data.match || []).map(m => ({ 
              ...m, 
              typeName: mode,
              match_date: m.date_match
            }));
            for (const m of matches) {
              if (!combinedMatches.find(cm => cm.match_id === m.match_id)) {
                combinedMatches.push(m);
              }
            }
          } catch (err) {}
        }
        if (combinedMatches.length >= limit) break;
      }

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
          details.push(new MatchRecord({
            match_result: m.match_result,
            match_date: m.match_date,
            kill: m.kill,
            death: m.death,
            assist: m.assist,
            map_name: m.match_mode 
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

import { Player } from '../domain/player.js';
import { MatchRecord } from '../domain/match.js';
import { RecentStats } from '../domain/stats.js';
import { SA_META } from './meta-data.js';

/**
 * Sudden Attack Data Repository (Infrastructure Layer)
 * Bridges the gap between the Nexon API and the Domain models.
 */
export class SaRepository {
  constructor(apiClient, crewRepository = null) {
    this.apiClient = apiClient;
    this.crewRepository = crewRepository;
    this.crewMembers = []; 
    this.crewOuids = [];   
    this.discoveredNicknames = {}; // Session cache for name history sync: { ouid: Set<names> }
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
    let ouid = null;

    try {
      ouid = await this.apiClient.getOuid(characterName);
    } catch (error) {
      if (error.message === 'PLAYER_NOT_FOUND' && this.crewRepository) {
        console.warn(`[Repository] ${characterName} not found in Nexon. Searching in DB...`);
        ouid = await this.crewRepository.findOuidByNickname(characterName);
        if (ouid) {
          console.log(`[Repository] Recovered OUID from DB: ${ouid}`);
        }
      }
      
      if (!ouid) throw error;
    }

    const [basic, rank, tier] = await Promise.all([
      this.apiClient.getPlayerBasic(ouid),
      this.apiClient.getPlayerRank(ouid),
      this.apiClient.getPlayerTier(ouid)
    ]);

    // AUTO-SYNC NICKNAME: If name in Nexon differs from DB, update DB and store old name in history
    if (this.crewRepository && basic.character_name !== characterName) {
      console.log(`[Repository] Nickname sync detected: ${characterName} -> ${basic.character_name}`);
      this.crewRepository.updateNickname(ouid, basic.character_name).catch(() => {});
    }

    // Map Images
    basic.grade_image = this._getGradeImage(rank.grade);
    basic.season_grade_image = this._getSeasonGradeImage(rank.season_grade);
    if (tier) {
      tier.solo_image = this._getTierImage(tier.solo_rank_match_tier);
      tier.party_image = this._getTierImage(tier.party_rank_match_tier);
    }
    
    return new Player(ouid, basic, rank, tier, { names: this.crewMembers, ouids: this.crewOuids });
  }

  /**
   * Fetch recent trend stats (K/D, Win Rate)
   * Enhanced: Merges Nexon API stats with Firestore Crew stats.
   */
  async getPlayerStats(ouid) {
    try {
      const nxData = await this.apiClient.getRecentInfo(ouid);
      let dbData = null;

      if (this.crewRepository) {
        dbData = await this.crewRepository.findMemberByOuid(ouid);
      }

      return new RecentStats(nxData, [], dbData);
    } catch (error) {
      console.warn('[Repository] Failed to get recent stats:', error.message);
      return null;
    }
  }

  /**
   * Fetch recent matches and AUTO-DISCOVER previous nicknames
   */
  async getRecentMatches(ouid, limit = 20, nickname = "") {
    const combinedMatches = [];
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    const discoveredNames = new Set();

    // Verified working parameters
    const matchTypes = ["퀵매치 클랜전", "클랜전"];
    const matchMode = "폭파미션";
    const now = new Date();
    const kstFormatter = new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit'
    });
    const formatDateParts = (date) => {
      const parts = kstFormatter.formatToParts(date);
      return `${parts.find(p => p.type === 'year').value}-${parts.find(p => p.type === 'month').value}-${parts.find(p => p.type === 'day').value}`;
    };

    const dates = [formatDateParts(now), ""]; 

    try {
      for (const date of dates) {
        for (const type of matchTypes) {
          try {
            await delay(150); 
            const data = await this.apiClient.getMatchList(ouid, type, matchMode, date);
            const matches = (data.match || []).map(m => ({ 
              ...m, typeName: m.match_type || type, match_date: m.date_match
            }));
            for (const m of matches) {
              if (!combinedMatches.find(cm => cm.match_id === m.match_id)) combinedMatches.push(m);
            }
          } catch (err) {}
        }
        if (combinedMatches.length >= limit) break;
      }

      const sortedMatches = combinedMatches
        .sort((a, b) => new Date(b.match_date) - new Date(a.match_date))
        .slice(0, limit);
      
      const details = [];
      const crewData = { names: this.crewMembers, ouids: this.crewOuids };

      for (const m of sortedMatches) {
        try {
          await delay(50);
          const detail = await this.apiClient.getMatchDetail(m.match_id);
          
          // --- AUTO-DISCOVERY LOGIC ---
          const playerInMatch = detail.match_member?.find(mm => mm.ouid === ouid);
          if (playerInMatch && playerInMatch.character_name !== nickname) {
            discoveredNames.add(playerInMatch.character_name);
          }

          const subjectInfo = { ouid: ouid, kill: m.kill, death: m.death, result: m.match_result };
          details.push(new MatchRecord(detail, m.typeName, nickname, crewData, subjectInfo));
        } catch (err) {
          details.push(new MatchRecord({
            match_id: m.match_id, match_result: m.match_result, match_date: m.match_date,
            kill: m.kill, death: m.death, assist: m.assist, map_name: m.match_mode || "알 수 없음"
          }, m.typeName, nickname, crewData));
        }
      }

      // Sync discovered names to database via session cache
      if (discoveredNames.size > 0) {
        if (!this.discoveredNicknames[ouid]) this.discoveredNicknames[ouid] = new Set();
        discoveredNames.forEach(name => this.discoveredNicknames[ouid].add(name));
        
        // Attempt immediate sync (may fail due to permissions, which is fine)
        if (this.crewRepository) {
          for (const oldName of discoveredNames) {
            this.crewRepository.addNicknameToHistory(ouid, oldName).catch(() => {});
          }
        }
      }

      return details;
    } catch (error) {
      console.error('[Repository] Fatal error during match scanning:', error);
      throw error;
    }
  }
}

import { Player } from '../domain/player.js?v=43ee812f0dc0';
import { MatchRecord, normalizeMatchResult, toNexonMatchResult } from '../domain/match.js?v=b6d4e024b925';
import { RecentStats } from '../domain/stats.js?v=1139df4a1a8d';
import { SA_META } from './meta-data.js?v=2d46bbdd7b85';
import { MatchQueryError, readMatchList } from '../domain/match-query.js?v=092583cd1cf6';

const MATCH_DETAIL_CONCURRENCY = 6;
const MATCH_LIST_CONCURRENCY = 8;
const DAY_MS = 24 * 60 * 60 * 1000;

function clearLegacyActivityCaches(ouid, matchMode) {
  const keys = ['v1', 'v2', 'v3'].flatMap(version => [
    `sa_activity_days:${version}:${ouid}:${encodeURIComponent(matchMode)}`,
    `sa_activity_31:${version}:${ouid}`
  ]);
  for (const name of ['localStorage', 'sessionStorage']) {
    try {
      const storage = globalThis[name];
      for (const key of keys) storage?.removeItem(key);
    } catch { /* Unavailable storage must not prevent an API lookup. */ }
  }
}

function toMatchSummary(match) {
  return {
    matchId: match.match_id,
    matchDate: match.match_date,
    matchTypeName: match.typeName,
    matchResult: normalizeMatchResult(match.match_result ?? match.result),
    kill: Number(match.kill || 0),
    death: Number(match.death || 0),
    assist: Number(match.assist || 0),
    headshot: Number(match.headshot || 0)
  };
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  const workerCount = Math.min(Math.max(1, concurrency), items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

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

  invalidateMatchLists(ouid) {
    this.apiClient.invalidateMatchLists?.(ouid);
  }

  async getMatchLists(ouid, matchTypes, matchMode, onProgress = null) {
    const types = [...new Set(matchTypes)];
    let completed = 0;
    const failures = [];
    const lists = await mapWithConcurrency(types, MATCH_LIST_CONCURRENCY, async type => {
      try {
        const data = await this.apiClient.getMatchList(ouid, type, matchMode);
        return readMatchList(data).map(match => ({
          ...match, typeName: match.match_type || type, match_date: match.date_match || match.match_date
        }));
      } catch (error) {
        failures.push(error);
        return [];
      } finally {
        completed += 1;
        try { onProgress?.({ completed, total: types.length, percent: Math.round(completed / types.length * 100) }); }
        catch { /* Progress observers must not change query results. */ }
      }
    });
    if (failures.length) throw new MatchQueryError(failures, types.length);
    const unique = new Map();
    for (const match of lists.flat()) {
      if (match.match_id && !unique.has(match.match_id)) unique.set(match.match_id, match);
    }
    return [...unique.values()].sort((a, b) => new Date(b.match_date) - new Date(a.match_date));
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
  async getRecentMatches(ouid, limit = 20, nickname = "", options = {}) {
    const discoveredNames = new Set();
    const scope = options.scope || 'league';
    const publicMatchTypes = Array.isArray(options.matchTypes) && options.matchTypes.length > 0
      ? options.matchTypes
      : ["랭크전 솔로", "랭크전 파티"];
    const matchTypes = scope === 'public'
      ? publicMatchTypes
      : ["퀵매치 클랜전", "클랜전"];
    const matchMode = "폭파미션";
    try {
      const sortedMatches = (await this.getMatchLists(ouid, matchTypes, matchMode)).slice(0, limit);

      const crewData = { names: this.crewMembers, ouids: this.crewOuids };

      // --- 크루 점수 히스토리 조회 및 매칭 로직 ---
      const scoreHistory = this.crewRepository
        ? await this.crewRepository.getMemberMmrHistory(ouid)
        : [];

      const details = await mapWithConcurrency(sortedMatches, MATCH_DETAIL_CONCURRENCY, async (m) => {
        try {
          const detail = await this.apiClient.getMatchDetail(m.match_id);
          
          // --- AUTO-DISCOVERY LOGIC ---
          const playerInMatch = detail.match_member?.find(mm => mm.ouid === ouid);
          if (playerInMatch && playerInMatch.character_name !== nickname) {
            discoveredNames.add(playerInMatch.character_name);
          }

          // 해당 매치 날짜와 일치하는 정산 기록 찾기
          const matchedEntryIdx = scoreHistory.findIndex(h => h.date === m.match_date);
          let mmrChange = 0;
          let hsrChange = 0;

          if (matchedEntryIdx !== -1) {
            const currentEntry = scoreHistory[matchedEntryIdx];
            const prevEntry = matchedEntryIdx > 0 ? scoreHistory[matchedEntryIdx - 1] : null;
            
            if (prevEntry) {
              mmrChange = currentEntry.mmr - prevEntry.mmr;
              hsrChange = (currentEntry.hsr || currentEntry.mmr) - (prevEntry.hsr || prevEntry.mmr);
            } else {
              // 첫 기록인 경우 기본점수(1200)와의 차이
              mmrChange = currentEntry.mmr - 1200;
              hsrChange = (currentEntry.hsr || currentEntry.mmr) - 1200;
            }
          }

          const subjectInfo = { 
            ouid: ouid, 
            kill: m.kill, 
            death: m.death, 
            assist: m.assist,
            result: m.match_result,
            mmrChange: mmrChange,
            hsrChange: hsrChange
          };
          return new MatchRecord({
            match_id: m.match_id, date_match: m.match_date, match_result: m.match_result,
            kill: m.kill, death: m.death, assist: m.assist, ...detail
          }, m.typeName, nickname, crewData, subjectInfo);
        } catch (err) {
          return new MatchRecord({
            match_id: m.match_id, match_result: m.match_result, match_date: m.match_date,
            kill: m.kill, death: m.death, assist: m.assist, map_name: m.match_mode || "알 수 없음"
          }, m.typeName, nickname, crewData);
        }
      });

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

  async getPlayerActivityMatches(ouid, days = 31, options = {}) {
    const safeDays = Math.max(1, Math.min(31, Number(days || 31)));
    const matchTypes = Array.isArray(options.matchTypes) ? options.matchTypes : [];
    const matchMode = options.matchMode || '폭파미션';
    const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
    clearLegacyActivityCaches(ouid, matchMode);
    // Preserve the completed-days policy: today is not part of the daily cache.
    if (safeDays === 1 || matchTypes.length === 0) return [];
    const todayKey = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date(Date.now()));
    const todayStart = Date.parse(`${todayKey}T00:00:00+09:00`);
    const rangeStart = todayStart - (safeDays - 1) * DAY_MS;
    const matches = await this.getMatchLists(ouid, matchTypes, matchMode, onProgress);
    return matches.filter(match => {
      const timestamp = new Date(match.match_date).getTime();
      return timestamp >= rangeStart && timestamp < todayStart;
    }).map(toMatchSummary);
  }

  async getOlderPublicMatches(ouid, beforeDate, limit = 20, options = {}) {
    const cursor = new Date(beforeDate);
    if (!ouid || Number.isNaN(cursor.getTime())) return { matches: [], hasMore: false };
    const matchTypes = Array.isArray(options.matchTypes) ? options.matchTypes : [];
    const matchMode = options.matchMode || '폭파미션';
    const lists = await this.getMatchLists(ouid, matchTypes, matchMode);
    // The cursor pages the supplied list; dates cannot extend Nexon's 1,000-row range.
    const ordered = lists.filter(match => new Date(match.match_date).getTime() < cursor.getTime());
    const selected = ordered.slice(0, limit).map(toMatchSummary);
    const matches = await this.getActivityMatchDetails(selected, options.player || {});
    return { matches, hasMore: ordered.length > selected.length };
  }

  async getActivityMatchDetails(matches = [], player = {}) {
    return mapWithConcurrency(matches, MATCH_DETAIL_CONCURRENCY, async (match) => {
      try {
        const detail = await this.apiClient.getMatchDetail(match.matchId);
        const participants = detail?.match_detail || detail?.match_member;
        if (!Array.isArray(participants) || participants.length === 0) throw new Error('INVALID_MATCH_DETAIL');
        const detailWithListFallbacks = {
          match_id: match.matchId,
          date_match: match.matchDate,
          match_result: toNexonMatchResult(match.matchResult),
          kill: match.kill,
          death: match.death,
          assist: match.assist,
          ...detail
        };
        return new MatchRecord(detailWithListFallbacks, match.matchTypeName, player.nickname, { names: [], ouids: [] }, {
          ouid: player.ouid,
          kill: match.kill,
          death: match.death,
          assist: match.assist,
          result: toNexonMatchResult(match.matchResult)
        });
      } catch (error) {
        return {
          ...match,
          detailUnavailable: true,
          detailFailureCode: ['RATE_LIMITED', 'REQUEST_TIMEOUT'].includes(error?.code) ? error.code : 'QUERY_FAILED',
          damage: Number(match.damage || 0),
          headshot: Number(match.headshot || 0)
        };
      }
    });
  }
}

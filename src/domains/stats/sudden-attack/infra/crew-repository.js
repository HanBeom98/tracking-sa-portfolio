import { CREW_SETTLEMENT_POLICY } from '../domain/crew-settlement.js';
import { settleCrewMatches } from './crew-settlement-store.js';
import { applyCrewSeasonMethods } from './crew-season-methods.js';
import { applyCrewMemberMethods } from './crew-member-methods.js';
import { applyCrewMatchMethods } from './crew-match-methods.js';
import { applyCrewApplicationMethods } from './crew-application-methods.js';
import { getCurrentUser } from '../../../auth/infra/auth-gateway.js';
import { SA_STAFF_EMAILS } from '../../../auth/domain/access-policy.js';
import { recordOperation, requestFailureCode } from '../../../shared/http-request.js';

/**
 * Crew Repository (Infrastructure Layer) - MMR Enhanced
 * Manages Crew member lists, applications, and MMR Rating System.
 */
export class CrewRepository {
  constructor(apiClient) {
    this.apiClient = apiClient;
    this.MEMBERS_COLLECTION = 'sa_crew_members';
    this.APPLICATIONS_COLLECTION = 'sa_crew_applications';
    this.HISTORY_COLLECTION = 'sa_crew_history'; 
    this.SETTINGS_COLLECTION = 'sa_crew_settings';
    this.MATCH_SESSIONS_COLLECTION = 'sa_crew_match_sessions';
    this.MANUAL_ABANDONS_COLLECTION = 'sa_crew_manual_abandons';
    this.SEASON_ARCHIVE_DOC = 'season_archive_latest';
    this.SEASON_ARCHIVE_PREFIX = 'season_archive_';
    this.SEASON_ARCHIVE_INDEX_DOC = 'season_archives_index';
    this.MANUAL_SEED_TIERS = [
      'BRONZE',
      'SILVER',
      'GOLD',
      'MASTER',
      'GRANDMASTER',
      'LEGEND',
      'BLACK_LEGEND',
      'STAR_LEGEND'
    ];
    this.MANUAL_SEED_TIER_LABELS = {
      BRONZE: '브론즈',
      SILVER: '실버',
      GOLD: '골드',
      MASTER: '마스터',
      GRANDMASTER: '그랜드마스터',
      LEGEND: '레전드',
      BLACK_LEGEND: '불레전드 (in300)',
      STAR_LEGEND: '별레전 (in100)'
    };
    this.MANUAL_SEED_TIER_HSR = {
      BRONZE: 1080,
      SILVER: 1160,
      GOLD: 1240,
      MASTER: 1320,
      GRANDMASTER: 1400,
      LEGEND: 1480,
      BLACK_LEGEND: 1540,
      STAR_LEGEND: 1600
    };
    this.HISTORY_LIMIT = CREW_SETTLEMENT_POLICY.historyLimit; // Max match history points to store for trend
    this.MATCH_SESSION_LOOKBACK_MS = CREW_SETTLEMENT_POLICY.sessionLookbackMs;
    this.MIN_SESSION_OVERLAP = CREW_SETTLEMENT_POLICY.minSessionOverlap;
    this.ABANDON_MMR_PENALTY = CREW_SETTLEMENT_POLICY.abandonMmrPenalty;
    this.ABANDON_HSR_PENALTY = CREW_SETTLEMENT_POLICY.abandonHsrPenalty;
    
    // List of Administrators and Moderators (Staff)
    this.STAFF_EMAILS = SA_STAFF_EMAILS;
  }

  get settlementPolicy() {
    return {
      historyLimit: this.HISTORY_LIMIT,
      sessionLookbackMs: this.MATCH_SESSION_LOOKBACK_MS,
      minSessionOverlap: this.MIN_SESSION_OVERLAP,
      abandonMmrPenalty: this.ABANDON_MMR_PENALTY,
      abandonHsrPenalty: this.ABANDON_HSR_PENALTY
    };
  }

  get db() {
    if (typeof window !== 'undefined' && window.db) return window.db;
    return null;
  }

  /**
   * Settle MMR for a list of matches
   * Returns reports for Discord notifications
   */
  async settleMatches(matches) {
    const startedAt = Date.now();
    try {
      const reports = await settleCrewMatches(this, matches);
      recordOperation('crew_settlement', { durationMs: Date.now() - startedAt });
      return reports;
    } catch (error) {
      recordOperation('crew_settlement', { code: requestFailureCode(error), durationMs: Date.now() - startedAt });
      throw error;
    }
  }

  isStaff(currentUser = getCurrentUser()) {
    const user = currentUser;
    return user && this.STAFF_EMAILS.includes(user.email);
  }

  getHsrConfidence(matchCount = 0) {
    const count = Number(matchCount || 0);
    if (count >= 20) return 0.90;
    if (count >= 10) return 0.75;
    if (count >= 5) return 0.55;
    return 0.35;
  }

  getEffectiveHsr(member = {}) {
    const rawHsr = Number(member.hsr || member.mmr || 1200);
    const wins = Number(member.wins || 0);
    const loses = Number(member.loses || 0);
    const matchCount = Number(member.totalMatches || (wins + loses));
    const confidence = this.getHsrConfidence(matchCount);
    return Math.round(1200 + ((rawHsr - 1200) * confidence));
  }

  balanceTeams(selectedMembers) {
    if (selectedMembers.length < 2) return null;
    const snipers = selectedMembers.filter(m => m.position === 'sniper');
    const riflers = selectedMembers.filter(m => m.position === 'rifler');
    const teamSize = Math.floor(selectedMembers.length / 2);
    let bestSplit = { red: [], blue: [], diff: Infinity };

    const combinations = (array, size) => {
      if (size === 0) return [[]];
      const results = [];
      const f = (prefix, chars) => {
        for (let i = 0; i < chars.length; i++) {
          const nextPrefix = prefix.concat([chars[i]]);
          if (nextPrefix.length === size) results.push(nextPrefix);
          else f(nextPrefix, chars.slice(i + 1));
        }
      };
      f([], array);
      return results;
    };

    const redSniperCount = Math.floor(snipers.length / 2);
    const sniperCombos = combinations(snipers, redSniperCount);

    for (const redSnipers of sniperCombos) {
      const blueSnipers = snipers.filter(s => !redSnipers.includes(s));
      const riflersNeededForRed = teamSize - redSnipers.length;
      if (riflersNeededForRed < 0 || riflersNeededForRed > riflers.length) continue;
      for (const redRiflers of combinations(riflers, riflersNeededForRed)) {
        const blueRiflers = riflers.filter(r => !redRiflers.includes(r));
        const redTeam = [...redSnipers, ...redRiflers].map((member) => ({
          ...member,
          effectiveHsr: this.getEffectiveHsr(member),
          hsrConfidence: this.getHsrConfidence(Number(member.totalMatches || (Number(member.wins || 0) + Number(member.loses || 0))))
        }));
        const blueTeam = [...blueSnipers, ...blueRiflers].map((member) => ({
          ...member,
          effectiveHsr: this.getEffectiveHsr(member),
          hsrConfidence: this.getHsrConfidence(Number(member.totalMatches || (Number(member.wins || 0) + Number(member.loses || 0))))
        }));
        const redHSR = redTeam.reduce((sum, m) => sum + (m.effectiveHsr || m.hsr || m.mmr || 1200), 0);
        const blueHSR = blueTeam.reduce((sum, m) => sum + (m.effectiveHsr || m.hsr || m.mmr || 1200), 0);
        const diff = Math.abs(redHSR - blueHSR);
        const redMMR = redTeam.reduce((sum, m) => sum + (m.mmr || 1200), 0);
        const blueMMR = blueTeam.reduce((sum, m) => sum + (m.mmr || 1200), 0);
        if (diff < bestSplit.diff) {
          bestSplit = {
            red: redTeam,
            blue: blueTeam,
            diff,
            redAvg: redMMR / redTeam.length,
            blueAvg: blueMMR / blueTeam.length,
            redHsrAvg: redHSR / redTeam.length,
            blueHsrAvg: blueHSR / blueTeam.length
          };
        }
      }
    }
    return bestSplit;
  }
}

applyCrewMemberMethods(CrewRepository);
applyCrewMatchMethods(CrewRepository);
applyCrewApplicationMethods(CrewRepository);
applyCrewSeasonMethods(CrewRepository);

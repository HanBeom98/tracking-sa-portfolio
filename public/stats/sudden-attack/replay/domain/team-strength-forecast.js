import { MatchQueryError, readMatchList } from '../../domain/match-query.js?v=092583cd1cf6';
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
import { getPublicMatchCategory } from '../../domain/public-match-categories.js?v=356988f6edaf';
import { RecentStats } from '../../domain/stats.js?v=1139df4a1a8d';
import { normalizeMatchResult } from '../../domain/match.js?v=b6d4e024b925';

const TIER_STRENGTH = Object.freeze({
  UNRANK: 35,
  'BRONZE I': 40, 'BRONZE II': 43, 'BRONZE III': 46,
  'SILVER I': 49, 'SILVER II': 52, 'SILVER III': 55,
  'GOLD I': 58, 'GOLD II': 61, 'GOLD III': 64,
  'MASTER I': 68, 'MASTER II': 72, 'MASTER III': 76,
  'GRAND MASTER I': 80, 'GRAND MASTER II': 84, 'GRAND MASTER III': 88,
  LEGEND: 92, RANKER: 96, 'HIGH RANKER': 100
});
const FORECAST_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function parseReplayDate(value) {
  const text = String(value || '').trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(AM|PM))?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/i);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  let hour = Number(match[5]);
  const minute = Number(match[6]);
  const second = Number(match[7] || 0);
  const meridiem = match[4]?.toUpperCase();
  if (hour <= 12 && meridiem === 'AM') hour %= 12;
  if (hour <= 12 && meridiem === 'PM') hour = (hour % 12) + 12;
  const lastDay = month >= 1 && month <= 12 ? new Date(Date.UTC(year, month, 0)).getUTCDate() : 0;
  if (day < 1 || day > lastDay || hour > 23 || minute > 59 || second > 59) return null;
  const date = new Date(Date.UTC(year, month - 1, day, hour - 9, minute, second));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getReplayForecastWindow(parsed, now = new Date()) {
  const summary = parsed?.replay_info?.replayMatchSummaryInfo || {};
  const matchDate = parseReplayDate(summary.matchDate || summary.dateMatch || summary.date);
  if (!matchDate) return { matchDate: null, eligible: false, reason: 'invalid-date' };
  const age = now.getTime() - matchDate.getTime();
  if (age < -5 * 60 * 1000) return { matchDate, eligible: false, reason: 'future-date' };
  return {
    matchDate,
    eligible: age <= FORECAST_MAX_AGE_MS,
    reason: age <= FORECAST_MAX_AGE_MS ? '' : 'expired'
  };
}

export function detectReplayCategory(parsed) {
  const summary = parsed?.replay_info?.replayMatchSummaryInfo || {};
  const searchable = Object.entries(summary)
    .filter(([key]) => /type|mode|game|match|rank/i.test(key))
    .map(([, value]) => String(value || '').toLocaleLowerCase('ko-KR'))
    .join(' ');
  if (/솔로|solo/.test(searchable)) return 'solo';
  if (/파티|party/.test(searchable)) return 'party';
  if (/클랜|clan/.test(searchable)) return 'clan';
  if (/토너먼트|tournament/.test(searchable)) return 'tournament';
  return '';
}

function categoryFromMatchType(matchType) {
  const normalized = String(matchType || '').trim();
  for (const category of ['solo', 'party', 'clan', 'tournament']) {
    if (getPublicMatchCategory(category).matchTypes.includes(normalized)) return category;
  }
  return '';
}

export async function resolveReplayCategory(parsed, apiClient, fileName = '') {
  const embedded = detectReplayCategory(parsed);
  if (embedded) return embedded;
  const fileMatchId = String(fileName).match(/(\d{18})/)?.[1] || '';
  if (!fileMatchId || !apiClient?.getMatchDetail) return '';
  try {
    const detail = await apiClient.getMatchDetail(fileMatchId);
    return categoryFromMatchType(detail?.match_type);
  } catch {
    return '';
  }
}

function categoryTier(tier = {}, category = 'solo') {
  if (category === 'clan' || category === 'tournament') return { name: '티어 미반영', strength: null };
  const prefix = category === 'party' ? 'party' : 'solo';
  const name = tier[`${prefix}_rank_match_tier`];
  if (!name) return { name: '티어 정보 없음', strength: null };
  return { name, strength: TIER_STRENGTH[String(name).toUpperCase()] ?? null };
}

export function scorePlayerStrength({ matches = [], tier = {}, category = 'solo' } = {}) {
  const sampleSize = matches.length;
  if (!sampleSize) return { score: 50, metricCount: 0, sampleSize: 0, winRate: null, killDeathRate: null, tier: '정보 없음' };
  const trackingStats = new RecentStats({}, matches, null, { forceMatchMetrics: true, abandonCount: 0 });
  const winRate = Number(trackingStats.winRate || 0);
  const killDeathRate = Number(trackingStats.kdPercent || 0);
  const selectedTier = categoryTier(tier, category);
  const metrics = [
    { value: winRate, weight: 0.5 },
    { value: killDeathRate, weight: 0.35 },
    { value: selectedTier.strength, weight: 0.15 }
  ].filter(({ value }) => Number.isFinite(value));
  const totalWeight = metrics.reduce((sum, metric) => sum + metric.weight, 0);
  const rawScore = metrics.reduce((sum, metric) => sum + clamp(metric.value, 0, 100) * metric.weight, 0) / totalWeight;
  const sampleConfidence = Math.min(1, sampleSize / (category === 'tournament' ? 10 : 14));
  return {
    score: 50 + ((rawScore - 50) * sampleConfidence),
    metricCount: metrics.length,
    sampleSize,
    winRate,
    killDeathRate,
    tier: selectedTier.name
  };
}

function teamSummary(players, teamNo) {
  const members = players.filter((player) => player.teamNo === teamNo);
  const available = members.filter((player) => player.profile);
  const average = available.length
    ? available.reduce((sum, player) => sum + player.profile.score, 0) / available.length
    : 50;
  return { teamNo, members, available: available.length, average };
}

export function buildTeamStrengthForecast(players = [], winTeam, category = 'solo') {
  const teamNumbers = [...new Set(players.map((player) => player.teamNo))];
  if (teamNumbers.length !== 2) return null;
  const teams = teamNumbers.map((teamNo) => teamSummary(players, teamNo));
  const difference = teams[0].average - teams[1].average;
  const firstProbability = Math.round(clamp(50 + difference * 0.8, 25, 75));
  teams[0].probability = firstProbability;
  teams[1].probability = 100 - firstProbability;
  teams.forEach((team) => { team.won = Number(team.teamNo) === Number(winTeam); });

  const winner = teams.find((team) => team.won);
  const loser = teams.find((team) => !team.won);
  const resolved = teams.reduce((sum, team) => sum + team.available, 0);
  const total = players.length;
  const confidence = total ? resolved / total : 0;
  let verdict = '정보가 부족해 전력을 충분히 비교하지 못했습니다.';
  let tone = 'neutral';
  if (confidence >= 0.5 && winner) {
    if (winner.probability <= 42) {
      verdict = '스탯만 보면 질 경기였는데 뒤집었습니다.';
      tone = 'upset';
    } else if (winner.probability >= 58) {
      verdict = '최근 스탯의 우세가 실제 승리로 이어졌습니다.';
      tone = 'expected';
    } else {
      verdict = '사실상 반반이었던 승부를 가져왔습니다.';
      tone = 'close';
    }
  }
  const config = getPublicMatchCategory(category);
  const matchLimit = category === 'tournament' ? 10 : 20;
  return {
    teams, winner, loser, resolved, total, confidence, verdict, tone,
    category: config.key,
    categoryLabel: config.label,
    basis: `${config.label} 경기 직전 최대 ${matchLimit}경기 승률·K/D 기준`
  };
}

async function loadRecentMatchSummaries(apiClient, ouid, category, cutoffDate = null) {
  const config = getPublicMatchCategory(category);
  const matchLimit = category === 'tournament' ? 10 : 20;
  const failures = [];
  const lists = await Promise.all(config.matchTypes.map(async matchType => {
    try {
      const data = await apiClient.getMatchList(ouid, matchType, '폭파미션');
      return readMatchList(data).map(match => ({
        matchId: match.match_id,
        matchDate: match.date_match || match.match_date,
        matchResult: normalizeMatchResult(match.match_result ?? match.result),
        kill: Number(match.kill || 0),
        death: Number(match.death || 0)
      }));
    } catch (error) {
      failures.push(error);
      return [];
    }
  }));
  if (failures.length) throw new MatchQueryError(failures, config.matchTypes.length);
  const unique = new Map();
  for (const match of lists.flat()) {
    if (match.matchId && (!cutoffDate || new Date(match.matchDate).getTime() < cutoffDate.getTime())) {
      unique.set(match.matchId, match);
    }
  }
  return [...unique.values()].sort((a, b) => new Date(b.matchDate) - new Date(a.matchDate)).slice(0, matchLimit);
}

export async function loadTeamStrengthProfiles(players, apiClient, category, options = {}) {
  const { cache = new Map(), concurrency = 3, cutoffDate = null, onProgress = null, isCurrent = () => true } = options;
  const queue = players.map((player, index) => ({ player, index }));
  const results = new Array(players.length);
  let completed = 0;
  let successful = 0;
  const notifyProgress = () => {
    if (!isCurrent()) return;
    try { onProgress?.({ completed, total: players.length, successful }); } catch {}
  };
  notifyProgress();
  async function worker() {
    // An in-flight request may finish; obsolete work must not schedule the rest.
    while (queue.length && isCurrent()) {
      const { player, index } = queue.shift();
      const key = `${category}:${cutoffDate?.toISOString() || 'latest'}:${player.nickName.trim().toLocaleLowerCase('ko-KR')}`;
      let pending = cache.get(key);
      if (!pending) {
        pending = (async () => {
          try {
            const ouid = await apiClient.getOuid(player.nickName);
            if (!isCurrent()) return null;
            const matches = await loadRecentMatchSummaries(apiClient, ouid, category, cutoffDate);
            return { profile: matches.length ? scorePlayerStrength({ matches, tier: {}, category }) : null,
              lookupStatus: matches.length ? 'complete' : 'empty' };
          } catch (error) {
            return { profile: null, lookupStatus: error?.code === 'MATCH_QUERY_PARTIAL' ? 'partial' : 'failed' };
          }
        })();
        cache.set(key, pending);
      }
      const outcome = await pending;
      if (!isCurrent()) return;
      const profile = outcome.profile;
      if (!profile && cache.get(key) === pending) cache.delete(key);
      results[index] = { ...player, ...outcome };
      completed += 1;
      if (profile) successful += 1;
      notifyProgress();
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, () => worker()));
  return results.filter(Boolean);
}

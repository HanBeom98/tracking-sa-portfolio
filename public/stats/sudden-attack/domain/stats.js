import { getMatchTeamPlayers } from './match.js?v=b6d4e024b925';

const PLAYSTYLE_METRICS = Object.freeze({
  combat: '여포력',
  survival: '생존력',
  teamwork: '팀워크',
  precision: '정밀도',
  victory: '승률'
});

const PLAYSTYLE_ICONS = Object.freeze({
  combat: '⚔️',
  survival: '🛡️',
  teamwork: '🤝',
  precision: '🎯',
  victory: '🏆'
});

// 20 ordered primary/secondary combinations × 2 strength bands = 40 titles.
const PLAYSTYLE_PAIR_TITLES = Object.freeze({
  'combat-survival': ['끈질긴 추격자', '불굴의 선봉장'],
  'combat-teamwork': ['돌격 지원가', '돌파의 선봉'],
  'combat-precision': ['교전 설계자', '정밀 돌격대장'],
  'combat-victory': ['타고난 승부사', '최전선의 지배자'],
  'survival-combat': ['신중한 해결사', '철벽 돌격수'],
  'survival-teamwork': ['든든한 후방 지원', '전선 유지자'],
  'survival-precision': ['침착한 사냥꾼', '냉정한 생존가'],
  'survival-victory': ['역전의 명수', '철벽의 수호자'],
  'teamwork-combat': ['화력 지원가', '전장의 돌격 조율사'],
  'teamwork-survival': ['수비 조율사', '팀을 살리는 플레이어'],
  'teamwork-precision': ['정밀 지원가', '전술 사격 지원가'],
  'teamwork-victory': ['흐름을 바꾸는 조력자', '승리 설계자'],
  'precision-combat': ['정밀 교전가', '한 발의 해결사'],
  'precision-survival': ['신중한 저격수', '안정적인 명사수'],
  'precision-teamwork': ['팀의 연결고리', '전술 사격수'],
  'precision-victory': ['기회를 놓치지 않는 자', '승부를 겨누는 자'],
  'victory-combat': ['과감한 승부사', '전장의 해결사'],
  'victory-survival': ['위기관리 전문가', '승부의 수호자'],
  'victory-teamwork': ['승리의 조율사', '전장의 지휘자'],
  'victory-precision': ['효율적인 승리형', '집중력의 달인']
});

const PLAYSTYLE_SPECIAL_TITLES = Object.freeze([
  '분석 준비 중',
  '완성형 올라운더',
  '균형 잡힌 전투원',
  '유리대포',
  '고독한 에이스',
  '보이지 않는 공헌자',
  '인간 에임봇',
  '불사조',
  '팀플레이 메이커',
  '승리 제조기'
]);

export function getPlaystyleCatalog() {
  return [...PLAYSTYLE_SPECIAL_TITLES, ...Object.values(PLAYSTYLE_PAIR_TITLES).flat()];
}

export function classifyPlaystyle(radar = {}, matchCount = 0) {
  const values = Object.fromEntries(
    Object.keys(PLAYSTYLE_METRICS).map((key) => [key, Math.max(0, Math.min(100, Number(radar[key] || 0)))])
  );
  const ranked = Object.entries(values).sort((a, b) => b[1] - a[1]);
  const [primary, secondary] = ranked;
  const scores = Object.values(values);
  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const spread = Math.max(...scores) - Math.min(...scores);
  const result = (title, icon, description) => ({ title, icon, description });

  if (matchCount < 7) {
    return result('분석 준비 중', '📊', `현재 ${matchCount}경기 표본으로, 7경기부터 플레이스타일 칭호가 부여됩니다.`);
  }
  if (scores.every((score) => score >= 70)) {
    return result('완성형 올라운더', '🌟', '다섯 가지 경쟁 지표가 모두 높은 수준을 유지하고 있습니다.');
  }
  if (spread <= 8) {
    return result('균형 잡힌 전투원', '⚖️', '특정 지표에 치우치지 않고 전반적으로 고른 경기력을 보입니다.');
  }
  if (values.combat >= 75 && values.survival < 45) {
    return result('유리대포', '💥', '강한 교전 능력을 앞세워 위험을 감수하는 공격적인 성향입니다.');
  }
  if (values.combat >= 70 && values.victory < 40) {
    return result('고독한 에이스', '🔥', '개인 교전 기여는 높지만 아직 승리로 연결되는 비율은 낮습니다.');
  }
  if (values.victory >= 65 && values.combat < 50) {
    return result('보이지 않는 공헌자', '🧩', '화려한 교전보다 안정적인 운영으로 승리에 기여합니다.');
  }
  if (values.precision >= 85) {
    return result('인간 에임봇', '🤖', '헤드샷·킬뎃·생존력이 결합된 정밀도 지표가 매우 높습니다.');
  }
  if (values.survival >= 85) {
    return result('불사조', '🧘', '팀 내 데스 비중이 낮고 불리한 교전에서도 생존력이 돋보입니다.');
  }
  if (values.teamwork >= 80) {
    return result('팀플레이 메이커', '🤝', '팀 내 어시스트와 교전 참여를 통해 전투에 크게 기여합니다.');
  }
  if (values.victory >= 75) {
    return result('승리 제조기', '🏆', '최근 경쟁 모드에서 높은 승률을 꾸준히 기록하고 있습니다.');
  }

  const pairKey = `${primary[0]}-${secondary[0]}`;
  const pairTitles = PLAYSTYLE_PAIR_TITLES[pairKey];
  const isElite = average >= 65 || primary[1] >= 80;
  const title = pairTitles?.[isElite ? 1 : 0] || '균형 잡힌 전투원';
  return result(
    title,
    PLAYSTYLE_ICONS[primary[0]],
    `${PLAYSTYLE_METRICS[primary[0]]}을 중심으로 ${PLAYSTYLE_METRICS[secondary[0]]} 강점이 함께 나타나는 플레이스타일입니다.`
  );
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Number(value || 0)));
}

function weightedScore(parts, fallback = 50) {
  const available = parts.filter((part) => part.available !== false && Number.isFinite(Number(part.value)));
  const totalWeight = available.reduce((sum, part) => sum + Number(part.weight || 0), 0);
  if (totalWeight <= 0) return fallback;
  return available.reduce((sum, part) => sum + (clampScore(part.value) * Number(part.weight || 0)), 0) / totalWeight;
}

function normalizedTeamShare(value, total, teamSize) {
  if (total <= 0 || teamSize <= 0) return 50;
  return clampScore(50 * (Number(value || 0) / total) * teamSize);
}

function relativeEfficiency(playerValue, teamValue, fallback = 50) {
  if (!Number.isFinite(playerValue) || !Number.isFinite(teamValue) || teamValue <= 0) return fallback;
  return clampScore(50 * (playerValue / teamValue));
}

export function calculateMatchContributionRadar(match = {}) {
  const kill = Number(match.kill || 0);
  const death = Number(match.death || 0);
  const assist = Number(match.assist || 0);
  const damage = Number(match.damage || 0);
  const headshot = Number(match.headshot || 0);
  const result = match.matchResult;
  const team = getMatchTeamPlayers(match);
  const hasTeam = team.length >= 2;
  const teamSize = hasTeam ? team.length : 0;
  const sumTeam = (field) => team.reduce((sum, player) => sum + Number(player?.[field] || 0), 0);
  const teamKills = sumTeam('kill');
  const teamDeaths = sumTeam('death');
  const teamAssists = sumTeam('assist');
  const teamDamage = sumTeam('damage');
  const teamHeadshots = sumTeam('headshot');
  const duelEfficiency = (kill + death) > 0 ? (kill / (kill + death)) * 100 : 50;
  const killShare = normalizedTeamShare(kill, teamKills, teamSize);
  const damageShare = normalizedTeamShare(damage, teamDamage, teamSize);
  const deathShare = normalizedTeamShare(death, teamDeaths, teamSize);
  const deathAvoidance = 100 - deathShare;
  const assistShare = normalizedTeamShare(assist, teamAssists, teamSize);
  const participationShare = normalizedTeamShare(kill + assist, teamKills + teamAssists, teamSize);
  const playerDamagePerDeath = damage / Math.max(1, death);
  const teamDamagePerDeath = teamDamage / Math.max(1, teamDeaths);
  const playerDamagePerKill = damage / Math.max(1, kill);
  const teamDamagePerKill = teamDamage / Math.max(1, teamKills);
  const playerHeadshotRate = headshot / Math.max(1, kill);
  const teamHeadshotRate = teamHeadshots / Math.max(1, teamKills);
  const won = result === 'WIN' ? 100 : result === 'LOSE' ? 0 : 50;

  return {
    combat: weightedScore([
      { value: duelEfficiency, weight: 35 },
      { value: killShare, weight: 35, available: hasTeam && teamKills > 0 },
      { value: damageShare, weight: 30, available: hasTeam && teamDamage > 0 }
    ]),
    survival: weightedScore([
      { value: deathAvoidance, weight: 55, available: hasTeam && teamDeaths > 0 },
      { value: duelEfficiency, weight: 25 },
      {
        value: relativeEfficiency(playerDamagePerDeath, teamDamagePerDeath),
        weight: 20,
        available: hasTeam && teamDamage > 0 && teamDeaths > 0
      }
    ]),
    teamwork: weightedScore([
      { value: assistShare, weight: 60, available: hasTeam && teamAssists > 0 },
      { value: participationShare, weight: 25, available: hasTeam && (teamKills + teamAssists) > 0 },
      { value: won, weight: 15 }
    ]),
    precision: weightedScore([
      {
        value: relativeEfficiency(playerHeadshotRate, teamHeadshotRate),
        weight: 50,
        available: hasTeam && teamHeadshots > 0 && teamKills > 0
      },
      {
        value: relativeEfficiency(playerDamagePerKill, teamDamagePerKill),
        weight: 30,
        available: hasTeam && teamDamage > 0 && teamKills > 0
      },
      { value: duelEfficiency, weight: 20 }
    ]),
    victory: won
  };
}

export function calculateCompetitiveRadar(matches = []) {
  const safeMatches = Array.isArray(matches) ? matches.filter(Boolean) : [];
  if (safeMatches.length === 0) {
    return { combat: 0, survival: 0, teamwork: 0, precision: 0, victory: 0 };
  }
  const matchScores = safeMatches.map(calculateMatchContributionRadar);
  const averageOf = (key, list = matchScores) => list.reduce((sum, score) => sum + score[key], 0) / list.length;
  const recentScores = matchScores.slice(0, Math.min(5, matchScores.length));
  const rawRadar = {
    combat: averageOf('combat'),
    survival: averageOf('survival'),
    teamwork: averageOf('teamwork'),
    precision: averageOf('precision'),
    victory: (averageOf('victory') * 0.8) + (averageOf('victory', recentScores) * 0.2)
  };
  const confidence = Math.min(1, safeMatches.length / 14);
  return Object.fromEntries(
    Object.entries(rawRadar).map(([key, value]) => [
      key,
      Number((50 + ((value - 50) * confidence)).toFixed(1))
    ])
  );
}

export class RecentStats {
  constructor(info, matches = [], crewData = null, options = {}) {
    const forceMatchMetrics = !!options.forceMatchMetrics;
    const abandonCount = Number(options.abandonCount || 0);
    const rawKd = info.recent_kill_death_rate || 0;
    this.officialRecentKd = Number(rawKd || 0);
    this.officialRecentWinRate = Number(info.recent_win_rate || 0);
    this.officialRecentHeadshotRate = Number(info.recent_headshot_rate || info.recent_head_shot_rate || 0);
    this.kd = parseFloat(rawKd.toFixed(1));
    this.kdPercent = Math.round(rawKd);
    this.winRate = info.recent_win_rate ? parseFloat(info.recent_win_rate.toFixed(1)) : 0;
    this.recentAssaultRate = Number(info.recent_assault_rate || 0);
    this.recentSniperRate = Number(info.recent_sniper_rate || 0);
    this.recentSpecialRate = Number(info.recent_special_rate || 0);

    this.radar = { combat: 0, survival: 0, teamwork: 0, precision: 0, victory: 0 };
    this.streakCount = 0;
    this.streakType = "NONE"; 
    this.trollMatches = 0;
    this.crewTrollMatches = 0;
    this.crewAbandonCount = abandonCount;
    this.playstyleTitle = "데이터 수집 중";
    this.playstyleIcon = "🕵️";
    this.playstyleDescription = "경쟁 모드 기록을 불러오고 있습니다.";
    this.mmrTrend = []; 

    this.bestPartner = null;
    this.worstPartner = null;
    this.nemesis = null; // 나를 가장 많이 이긴 적
    this.prey = null;    // 내가 가장 많이 이긴 적
    this.mapStats = [];

    // --- 내전 데이터 초기화 ---
    this.isCrew = false; // 기본값: 비크루원
    this.crewMatchCount = 0;
    this.crewKills = 0;
    this.crewDeaths = 0;
    this.crewHeadshots = 0;
    this.crewHeadshotRate = 0;
    this.crewWinRate = 0;
    this.crewMmr = 1200;
    this.crewStatusTitle = "일반 유저";
    this.crewStatusIcon = "👤";

    if (crewData) {
      this.isCrew = true; // 크루 데이터가 있으면 크루원임
      this.crewMatchCount = (Number(crewData.wins || 0)) + (Number(crewData.loses || 0));
      this.crewKills = Number(crewData.crewKills || 0);
      this.crewDeaths = Number(crewData.crewDeaths || 0);
      this.crewWinRate = this.crewMatchCount > 0 ? Math.round((Number(crewData.wins || 0) / this.crewMatchCount) * 100) : 0;
      this.crewMmr = Number(crewData.mmr || 1200);
      this.crewHsr = Number(crewData.hsr || this.crewMmr);
      this.mmrHistory = crewData.mmrHistory || [];
      this.mmrTrend = this.mmrHistory;
      this.calculateCrewStatus();
    }

    if (matches.length > 0) {
      this.totalMatchesCount = matches.length; 
      const totalK = matches.reduce((sum, m) => sum + m.kill, 0);
      const totalD = matches.reduce((sum, m) => sum + m.death, 0);
      const totalA = matches.reduce((sum, m) => sum + m.assist, 0);
      const totalHs = matches.reduce((sum, m) => sum + Number(m.headshot || 0), 0);
      const totalDamage = matches.reduce((sum, m) => sum + Number(m.damage || 0), 0);
      const winCount = matches.filter((m) => m.matchResult === 'WIN').length;
      
      this.avgK = (totalK / matches.length).toFixed(1);
      this.avgD = (totalD / matches.length).toFixed(1);
      this.avgA = (totalA / matches.length).toFixed(1);
      this.avgDamage = Math.round(totalDamage / matches.length);
      
      this.totalKills = totalK; 
      this.totalDeaths = totalD;
      this.totalAssists = totalA;

      if (forceMatchMetrics) {
        const ratio = totalD > 0 ? (totalK / totalD) : (totalK > 0 ? totalK : 0);
        this.kd = parseFloat(ratio.toFixed(2));
        this.kdPercent = (totalK + totalD) > 0 ? Math.round((totalK / (totalK + totalD)) * 100) : 0;
        this.winRate = matches.length > 0 ? parseFloat(((winCount / matches.length) * 100).toFixed(1)) : 0;
        this.seasonPrecisionRate = totalK > 0 ? (totalHs / totalK) : 0;
      }
      
      const maps = matches.map(m => m.mapName);
      this.mostPlayedMap = maps.sort((a,b) =>
          maps.filter(v => v===a).length - maps.filter(v => v===b).length
      ).pop();

      this.calculateSynergy(matches, info.user_name);
      this.calculateRivalry(matches, info.user_name);
      
      // --- 맵 숙련도: 내전(isCustomMatch) 기록으로만 한정 ---
      const customMatches = matches.filter(m => m.isCustomMatch);
      this.calculateMapStats(customMatches);

      // --- 연승/연패(Streak) ---
      const firstResult = matches[0].matchResult;
      this.streakType = firstResult === 'WIN' || firstResult === 'LOSE' ? firstResult : 'NONE';
      let count = 0;
      for (const m of matches) {
        if (this.streakType !== 'NONE' && m.matchResult === firstResult) { count++; }
        else { break; }
      }
      this.streakCount = count;

      this.trollMatches = matches.filter(m => {
        const kdVal = parseFloat(m.kd);
        return kdVal < 0.5 && m.death >= 5;
      }).length;

      // --- 내전 부진 경기 ---
      this.crewTrollMatches = matches.filter(m => {
        if (!m.isCustomMatch) return false;
        const kdVal = parseFloat(m.kd);
        return kdVal < 0.5 && m.death >= 5;
      }).length;

      const crewMatches = matches.filter((m) => m.isCustomMatch);
      if (crewMatches.length > 0) {
        const crewKillsFromMatches = crewMatches.reduce((sum, m) => sum + Number(m.kill || 0), 0);
        const crewHeadshotsFromMatches = crewMatches.reduce((sum, m) => sum + Number(m.headshot || 0), 0);
        this.crewHeadshots = crewHeadshotsFromMatches;
        this.crewHeadshotRate = crewKillsFromMatches > 0
          ? Math.round((crewHeadshotsFromMatches / crewKillsFromMatches) * 100)
          : 0;
      }

      this.radar = calculateCompetitiveRadar(matches);

      this.assignPlaystyle();
    } else {
      this.totalMatchesCount = 0;
      this.avgK = 0; this.avgD = 0; this.avgA = 0; this.avgDamage = 0;
      this.totalKills = 0; this.totalDeaths = 0; this.totalAssists = 0; 
      this.mostPlayedMap = "데이터 없음";
      if (forceMatchMetrics) {
        this.kd = 0;
        this.kdPercent = 0;
        this.winRate = 0;
      }
    }
  }

  assignPlaystyle() {
    const playstyle = classifyPlaystyle(this.radar, this.totalMatchesCount);
    this.playstyleTitle = playstyle.title;
    this.playstyleIcon = playstyle.icon;
    this.playstyleDescription = playstyle.description;
  }

  calculateMapStats(matches) {
    const stats = {};
    matches.forEach(m => {
      if (!stats[m.mapName]) stats[m.mapName] = { name: m.mapName, total: 0, wins: 0, loses: 0, draws: 0 };
      stats[m.mapName].total += 1;
      if (m.matchResult === 'WIN') stats[m.mapName].wins += 1;
      else if (m.matchResult === 'LOSE') stats[m.mapName].loses += 1;
      else if (m.matchResult === 'DRAW') stats[m.mapName].draws += 1;
    });

    const PREFERRED_ORDER = ['드래곤로드', '프로방스', '시티캣', '크로스포트', '올드타운'];

    this.mapStats = Object.values(stats)
      .map(s => ({
        ...s,
        winRate: Math.round((s.wins / s.total) * 100)
      }))
      .sort((a, b) => {
        const idxA = PREFERRED_ORDER.indexOf(a.name);
        const idxB = PREFERRED_ORDER.indexOf(b.name);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return b.winRate - a.winRate || b.total - a.total;
      });
  }

  calculateSynergy(matches, myNickname) {
    const teammates = {}; 
    const normalizedMe = (myNickname || "").toLowerCase().trim();

    matches.forEach(match => {
      if (!match.allPlayerStats) return;
      const isWin = match.matchResult === 'WIN';
      getMatchTeamPlayers(match, { nickname: myNickname }).forEach(p => {
        const normalizedName = p.nickname.toLowerCase().trim();
        if (p.isSubject || normalizedName === normalizedMe) return;
        if (!teammates[p.nickname]) teammates[p.nickname] = { total: 0, wins: 0 };
        teammates[p.nickname].total += 1;
        if (isWin) teammates[p.nickname].wins += 1;
      });
    });

    const synergyList = Object.entries(teammates)
      .map(([nickname, stats]) => ({
        nickname,
        total: stats.total,
        winRate: Math.round((stats.wins / stats.total) * 100)
      }))
      .filter(s => s.total >= 3) 
      .sort((a, b) => b.winRate - a.winRate || b.total - a.total);

    if (synergyList.length > 0) {
      this.bestPartner = synergyList[0];
      const reversed = [...synergyList].sort((a, b) => a.winRate - b.winRate || b.total - a.total);
      if (reversed[0].winRate < 50) this.worstPartner = reversed[0];
    }
  }

  calculateRivalry(matches, myNickname) {
    const enemies = {}; 
    const normalizedMe = (myNickname || "").toLowerCase().trim();

    matches.forEach(match => {
      if (!match.allPlayerStats) return;
      const myResult = match.matchResult;
      const isWin = myResult === 'WIN';

      getMatchTeamPlayers(match, { nickname: myNickname, opponents: true }).forEach(p => {
        const normalizedName = p.nickname.toLowerCase().trim();
        if (p.isSubject || normalizedName === normalizedMe) return;

        if (!enemies[p.nickname]) enemies[p.nickname] = { total: 0, myWins: 0, myLoses: 0 };
        enemies[p.nickname].total += 1;
        if (isWin) enemies[p.nickname].myWins += 1;
        else if (myResult === 'LOSE') enemies[p.nickname].myLoses += 1;
      });
    });

    const rivalryList = Object.entries(enemies)
      .map(([nickname, stats]) => ({
        nickname,
        total: stats.total,
        myWinRate: Math.round((stats.myWins / stats.total) * 100),
        rivalWinRate: Math.round((stats.myLoses / stats.total) * 100)
      }))
      .filter(r => r.total >= 2); // 최소 2번은 마주쳐야 라이벌로 인정

    if (rivalryList.length > 0) {
      // Nemesis: 상대팀일 때 나를 가장 많이 이긴 사람 (나의 승률이 가장 낮음)
      const sortedByMyLoss = [...rivalryList].sort((a, b) => a.myWinRate - b.myWinRate || b.total - a.total);
      if (sortedByMyLoss[0].myWinRate < 50) {
        this.nemesis = sortedByMyLoss[0];
      }

      // Prey: 상대팀일 때 내가 가장 많이 이긴 사람 (나의 승률이 가장 높음)
      const sortedByMyWin = [...rivalryList].sort((a, b) => b.myWinRate - a.myWinRate || b.total - a.total);
      if (sortedByMyWin[0].myWinRate > 50) {
        this.prey = sortedByMyWin[0];
      }
    }
  }

  calculateCrewStatus() {
    const mmr = this.crewMmr;
    const count = this.crewMatchCount;
    const wr = this.crewWinRate;
    if (mmr >= 1800) { this.crewStatusTitle = "크루의 전설 (Legend)"; this.crewStatusIcon = "👑"; } 
    else if (mmr >= 1500) { this.crewStatusTitle = "팀의 에이스 (Ace)"; this.crewStatusIcon = "💎"; } 
    else if (count >= 20 && wr >= 65) { this.crewStatusTitle = "무적의 지휘관"; this.crewStatusIcon = "🎖️"; } 
    else if (count >= 50) { this.crewStatusTitle = "노련한 베테랑"; this.crewStatusIcon = "⚔️"; } 
    else if (count < 15 && wr >= 60) { this.crewStatusTitle = "무서운 라이징 스타"; this.crewStatusIcon = "✨"; } 
    else if (count < 5) { this.crewStatusTitle = "설레는 뉴페이스"; this.crewStatusIcon = "🌱"; } 
    else { this.crewStatusTitle = "믿음직한 정회원"; this.crewStatusIcon = "👤"; }
  }
}

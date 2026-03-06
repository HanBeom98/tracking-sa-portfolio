export class RecentStats {
  constructor(info, matches = [], crewData = null, options = {}) {
    const forceMatchMetrics = !!options.forceMatchMetrics;
    const rawKd = info.recent_kill_death_rate || 0;
    this.kd = parseFloat(rawKd.toFixed(1));
    this.kdPercent = Math.round(rawKd);
    this.winRate = info.recent_win_rate ? parseFloat(info.recent_win_rate.toFixed(1)) : 0;

    this.radar = { combat: 0, survival: 0, teamwork: 0, precision: 0, victory: 0 };
    this.streakCount = 0;
    this.streakType = "NONE"; 
    this.trollMatches = 0;
    this.crewTrollMatches = 0;
    this.playstyleTitle = "데이터 수집 중";
    this.playstyleIcon = "🕵️";
    this.mmrTrend = []; 

    this.bestPartner = null;
    this.worstPartner = null;
    this.nemesis = null; // 나를 가장 많이 이긴 적
    this.prey = null;    // 내가 가장 많이 이긴 적
    this.mapStats = [];
    this.totalEstimatedRounds = 0;
    this.avgKillPerRound = 0;
    this.avgDeathPerRound = 0;
    this.avgAssistPerRound = 0;

    // --- 내전 데이터 초기화 ---
    this.isCrew = false; // 기본값: 비크루원
    this.crewMatchCount = 0;
    this.crewKills = 0;
    this.crewDeaths = 0;
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
      const winCount = matches.filter((m) => m.matchResult === 'WIN').length;
      const totalEstimatedRounds = matches.reduce((sum, m) => sum + this.estimateMatchRounds(m), 0);
      const safeRounds = Math.max(1, totalEstimatedRounds);
      
      this.avgK = (totalK / matches.length).toFixed(1);
      this.avgD = (totalD / matches.length).toFixed(1);
      this.avgA = (totalA / matches.length).toFixed(1);
      
      this.totalKills = totalK; 
      this.totalDeaths = totalD;
      this.totalAssists = totalA;
      this.totalEstimatedRounds = totalEstimatedRounds;
      this.avgKillPerRound = totalK / safeRounds;
      this.avgDeathPerRound = totalD / safeRounds;
      this.avgAssistPerRound = totalA / safeRounds;

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
      this.streakType = firstResult;
      let count = 0;
      for (const m of matches) {
        if (m.matchResult === firstResult) { count++; }
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

      const radarKd = this.kdPercent;
      let combatScore = 0;
      if (radarKd <= 40) { combatScore = radarKd * 1.0; } 
      else if (radarKd <= 55) { combatScore = 40 + (radarKd - 40) * 2.0; } 
      else { combatScore = 70 + (radarKd - 55) * 1.5; }
      const combatByRound = Math.min(100, Math.max(0, (this.avgKillPerRound / 1.2) * 100));
      this.radar.combat = Math.min(100, Math.max(0, (combatScore * 0.7) + (combatByRound * 0.3)));

      // 라운드당 데스 기반 생존력 점수 (6~10라운드 편차 보정)
      const baseSurvival = 100 - (this.avgDeathPerRound * 45);
      const kdBonus = Math.max(0, (this.kdPercent - 50) * 0.4);
      this.radar.survival = Math.min(100, Math.max(0, baseSurvival + kdBonus));

      this.radar.teamwork = Math.min(100, Math.max(0, this.avgAssistPerRound * 120));
      if (forceMatchMetrics) {
        const hsPercent = (this.seasonPrecisionRate || 0) * 100;
        // Balanced precision model: headshot skill + duel efficiency + survival quality.
        const weightedPrecision = (hsPercent * 0.45) + (this.kdPercent * 0.35) + (this.radar.survival * 0.20);
        this.radar.precision = Math.min(100, Math.max(0, weightedPrecision));
      } else {
        this.radar.precision = Math.min(100, Math.max(0, (info.recent_assault_rate || 0) * 1.5));
      }
      this.radar.victory = this.winRate;

      this.assignPlaystyle();
    } else {
      this.totalMatchesCount = 0;
      this.avgK = 0; this.avgD = 0; this.avgA = 0; 
      this.totalKills = 0; this.totalDeaths = 0; this.totalAssists = 0; 
      this.mostPlayedMap = "데이터 없음";
      this.totalEstimatedRounds = 0;
      this.avgKillPerRound = 0;
      this.avgDeathPerRound = 0;
      this.avgAssistPerRound = 0;
      if (forceMatchMetrics) {
        this.kd = 0;
        this.kdPercent = 0;
        this.winRate = 0;
      }
    }
  }

  estimateMatchRounds(match) {
    const players = Array.isArray(match?.allPlayerStats) ? match.allPlayerStats : [];
    if (players.length === 0) return 10;
    const totalDeaths = players.reduce((sum, p) => sum + Number(p.death || 0), 0);
    if (totalDeaths <= 0) return 10;
    // Nexon API does not provide round count directly. Estimate by death volume and clamp to bomb mode range.
    return Math.max(6, Math.min(10, Math.round(totalDeaths / 8)));
  }

  assignPlaystyle() {
    const r = this.radar;
    if (r.combat >= 85 && r.precision >= 85) { this.playstyleTitle = "전술 핵병기"; this.playstyleIcon = "☢️"; }
    else if (r.precision >= 90) { this.playstyleTitle = "인간 에임봇"; this.playstyleIcon = "🤖"; }
    else if (r.survival >= 90) { this.playstyleTitle = "불사신"; this.playstyleIcon = "🧘"; }
    else { this.playstyleTitle = "정밀 사격수"; this.playstyleIcon = "🎯"; }
  }

  calculateMapStats(matches) {
    const stats = {};
    matches.forEach(m => {
      if (!stats[m.mapName]) stats[m.mapName] = { name: m.mapName, total: 0, wins: 0, loses: 0 };
      stats[m.mapName].total += 1;
      if (m.matchResult === 'WIN') stats[m.mapName].wins += 1;
      else stats[m.mapName].loses += 1;
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
      match.allPlayerStats.forEach(p => {
        const normalizedName = p.nickname.toLowerCase().trim();
        if (normalizedName === normalizedMe) return; 
        if (p.result === match.matchResult) {
          if (!teammates[p.nickname]) teammates[p.nickname] = { total: 0, wins: 0 };
          teammates[p.nickname].total += 1;
          if (isWin) teammates[p.nickname].wins += 1;
        }
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

      match.allPlayerStats.forEach(p => {
        const normalizedName = p.nickname.toLowerCase().trim();
        if (normalizedName === normalizedMe) return; 

        // 내 팀과 다른 팀 결과인 경우 (즉, 상대팀)
        if (p.result !== myResult) {
          if (!enemies[p.nickname]) enemies[p.nickname] = { total: 0, myWins: 0, myLoses: 0 };
          enemies[p.nickname].total += 1;
          if (isWin) enemies[p.nickname].myWins += 1;
          else enemies[p.nickname].myLoses += 1;
        }
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

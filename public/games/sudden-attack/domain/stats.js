export class RecentStats {
  constructor(info, matches = [], crewData = null) {
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
    this.mapStats = [];

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
      
      this.avgK = (totalK / matches.length).toFixed(1);
      this.avgD = (totalD / matches.length).toFixed(1);
      this.avgA = (totalA / matches.length).toFixed(1);
      
      this.totalKills = totalK; 
      this.totalDeaths = totalD;
      this.totalAssists = totalA;
      
      const maps = matches.map(m => m.mapName);
      this.mostPlayedMap = maps.sort((a,b) =>
          maps.filter(v => v===a).length - maps.filter(v => v===b).length
      ).pop();

      this.calculateSynergy(matches, info.user_name);
      
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
      this.radar.combat = Math.min(100, Math.max(0, combatScore));
      this.radar.survival = Math.min(100, Math.max(0, 100 - (parseFloat(this.avgD) * 12)));
      this.radar.teamwork = Math.min(100, Math.max(0, parseFloat(this.avgA) * 15));
      this.radar.precision = Math.min(100, Math.max(0, (info.recent_assault_rate || 0) * 1.5));
      this.radar.victory = this.winRate;

      this.assignPlaystyle();
    } else {
      this.totalMatchesCount = 0;
      this.avgK = 0; this.avgD = 0; this.avgA = 0; 
      this.totalKills = 0; this.totalDeaths = 0; this.totalAssists = 0; 
      this.mostPlayedMap = "데이터 없음";
    }
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

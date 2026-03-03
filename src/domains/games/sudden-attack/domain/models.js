export class Player {
  constructor(ouid, basic, rank, tier, crewData = { names: [], ouids: [] }) {
    this.ouid = ouid;
    this.nickname = basic.user_name;
    this.level = basic.title_name || ""; 
    this.clanName = basic.clan_name || "None";
    this.rankName = rank.grade || "Unknown";
    this.ranking = rank.grade_ranking || 0;
    this.totalExp = rank.grade_exp || 0;
    this.seasonRank = rank.season_grade || "";

    const normalizedName = (this.nickname || "").toLowerCase().trim();
    this.isCrew = (crewData.ouids || []).includes(this.ouid) || 
                  (crewData.names || []).some(c => (c || "").toLowerCase().trim() === normalizedName);

    this.rankImage = basic.grade_image || "";
    this.seasonRankImage = basic.season_grade_image || "";

    if (tier) {
      this.soloTier = tier.solo_rank_match_tier || "UNRANK";
      this.soloScore = tier.solo_rank_match_score || 0;
      this.soloImage = tier.solo_image || "";
      this.partyTier = tier.party_rank_match_tier || "UNRANK";
      this.partyScore = tier.party_rank_match_score || 0;
      this.partyImage = tier.party_image || "";
    } else {
      this.soloTier = "UNRANK";
      this.soloScore = 0;
      this.soloImage = "";
      this.partyTier = "UNRANK";
      this.partyScore = 0;
      this.partyImage = "";
    }
  }
}

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
    this.playstyleTitle = "데이터 수집 중";
    this.playstyleIcon = "🕵️";
    this.mmrTrend = []; 

    this.bestPartner = null;
    this.worstPartner = null;
    this.mapStats = [];

    // --- 내전 데이터 초기화 (항상 존재하도록 보장) ---
    this.crewMatchCount = 0;
    this.crewKills = 0;
    this.crewDeaths = 0;
    this.crewWinRate = 0;
    this.crewMmr = 1200;
    this.crewStatusTitle = "일반 유저";
    this.crewStatusIcon = "👤";

    if (crewData) {
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
      this.calculateMapStats(matches);

      this.trollMatches = matches.filter(m => {
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

    // 사용자 정의 선호 순서 (드래곤로드, 프로방스, 시티캣, 크로스포트, 올드타운)
    const PREFERRED_ORDER = ['드래곤로드', '프로방스', '시티캣', '크로스포트', '올드타운'];

    this.mapStats = Object.values(stats)
      .map(s => ({
        ...s,
        winRate: Math.round((s.wins / s.total) * 100)
      }))
      .sort((a, b) => {
        const idxA = PREFERRED_ORDER.indexOf(a.name);
        const idxB = PREFERRED_ORDER.indexOf(b.name);

        // 둘 다 선호 리스트에 있는 경우
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        // 하나만 선호 리스트에 있는 경우 (선호 맵을 앞으로)
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;

        // 리스트에 없는 맵들은 기존처럼 승률 내림차순 정렬
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

export class MatchRecord {
  constructor(detail, typeName = "", targetUserName = "", crewData = { names: [], ouids: [] }, subjectInfo = null) {
    this.matchId = detail.match_id;
    this.matchTypeName = typeName;
    this.mapName = detail.match_map || detail.map_name || "Unknown Map";
    this.matchDate = detail.date_match || detail.match_date;
    this.participants = [];
    this.crewParticipants = [];
    this.isCustomMatch = false;
    this.allPlayerStats = []; 

    const statsArray = detail.match_detail || detail.match_member || [];

    if (Array.isArray(statsArray)) {
      let subjectFound = false;
      const crewNamesSet = new Set((crewData.names || []).map(n => (n || "").toLowerCase().trim()));
      
      this.allPlayerStats = statsArray.map(p => {
        const nickname = p.user_name || p.character_name || "";
        const normalizedName = nickname.toLowerCase().trim();
        const killValue = parseInt(p.kill || p.kill_count || p.cnt_kill || 0);
        const deathValue = parseInt(p.death || p.death_count || p.cnt_death || 0);
        const assistValue = parseInt(p.assist || p.assist_count || p.cnt_assist || 0);
        const resultValue = String(p.match_result || p.result || "0");
        
        const damageValue = parseInt(p.damage || p.cnt_damage || 0);
        const headshotValue = parseInt(p.headshot || p.cnt_headshot || 0);

        let isSubject = false;
        if (subjectInfo && !subjectFound) {
          const nameMatches = targetUserName && normalizedName === targetUserName.toLowerCase().trim();
          const statsMatch = killValue === parseInt(subjectInfo.kill) && deathValue === parseInt(subjectInfo.death) && String(resultValue) === String(subjectInfo.result);
          if (nameMatches || statsMatch) { isSubject = true; subjectFound = true; }
        }
        const isCrew = isSubject || crewNamesSet.has(normalizedName) || (p.ouid && (crewData.ouids || []).includes(p.ouid));
        const totalEngagements = killValue + deathValue;
        const kdPercent = totalEngagements > 0 ? Math.round((killValue / totalEngagements) * 100) : 0;
        const hsPercent = killValue > 0 ? Math.round((headshotValue / killValue) * 100) : 0;
        
        return {
          nickname: nickname, 
          kill: killValue, 
          death: deathValue, 
          assist: assistValue,
          damage: damageValue,
          headshot: headshotValue,
          hsPercent: hsPercent,
          kd: deathValue > 0 ? (killValue / deathValue).toFixed(2) : (killValue > 0 ? killValue.toFixed(2) : "0.00"),
          kdPercent: kdPercent,
          result: resultValue === "1" ? "WIN" : (resultValue === "2" ? "LOSE" : "UNKNOWN"),
          isCrew: isCrew, ouid: isSubject ? subjectInfo.ouid : (p.ouid || null)
        };
      });

      let bestScore = -1;
      let mvp = null;
      this.allPlayerStats.forEach(p => {
        const score = (p.kill * 100) + p.damage + (p.headshot * 150);
        if (p.kill >= 5 && score > bestScore) {
          bestScore = score;
          mvp = p.nickname;
        }
      });
      this.allPlayerStats.forEach(p => { if (p.nickname === mvp) p.isMvp = true; });

      this.participants = statsArray.map(p => p.user_name || p.character_name);
      this.crewParticipants = this.allPlayerStats.filter(p => p.isCrew).map(p => p.nickname);
      if (this.crewParticipants.length >= 8) this.isCustomMatch = true;
      
      const target = targetUserName ? targetUserName.toLowerCase().trim() : "";
      const playerStat = target 
        ? (statsArray.find(p => (p.user_name || p.character_name || "").toLowerCase().trim() === target) || statsArray[0])
        : statsArray[0];

      this.matchResult = String(playerStat.match_result || playerStat.result) === "1" ? "WIN" : "LOSE";
      this.kill = parseInt(playerStat.kill || 0);
      this.death = parseInt(playerStat.death || 0);
      this.assist = parseInt(playerStat.assist || 0);
      this.damage = parseInt(playerStat.damage || 0);
      this.headshot = parseInt(playerStat.headshot || 0);
      this.kdPercent = (this.kill + this.death > 0) ? Math.round((this.kill / (this.kill + this.death)) * 100) : 0;
    }

    const winTeam = this.allPlayerStats.filter(p => p.result === 'WIN');
    const loseTeam = this.allPlayerStats.filter(p => p.result === 'LOSE');
    const winTeamMissing = Math.max(0, loseTeam.reduce((s, p) => s + p.kill, 0) - winTeam.reduce((s, p) => s + p.death, 0));
    const loseTeamMissing = Math.max(0, winTeam.reduce((s, p) => s + p.kill, 0) - loseTeam.reduce((s, p) => s + p.death, 0));
    this.laundryInfo = { isWashed: winTeamMissing > 0 || loseTeamMissing > 0, totalMissing: winTeamMissing + loseTeamMissing, winTeamMissing, loseTeamMissing };
  }
}

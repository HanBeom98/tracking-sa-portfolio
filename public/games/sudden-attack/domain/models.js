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

    if (crewData) {
      this.crewMatchCount = (crewData.wins || 0) + (crewData.loses || 0);
      this.crewKills = crewData.crewKills || 0;
      this.crewDeaths = crewData.crewDeaths || 0;
      this.crewWinRate = this.crewMatchCount > 0 ? Math.round((crewData.wins / this.crewMatchCount) * 100) : 0;
      this.crewMmr = crewData.mmr || 1200;
      this.crewHsr = crewData.hsr || this.crewMmr;
      this.mmrHistory = crewData.mmrHistory || [];
      this.mmrTrend = this.mmrHistory;
      this.calculateCrewStatus();
    } else {
      this.crewMatchCount = 0;
      this.crewKd = "0.00";
      this.crewWinRate = 0;
      this.crewMmr = 1200;
      this.crewStatusTitle = "일반 유저";
      this.crewStatusIcon = "👤";
    }

    if (matches.length > 0) {
      const nxTotalK = matches.reduce((sum, m) => sum + m.kill, 0);
      const nxTotalD = matches.reduce((sum, m) => sum + m.death, 0);
      const nxTotalA = matches.reduce((sum, m) => sum + m.assist, 0);
      
      this.avgK = (nxTotalK / matches.length).toFixed(1);
      this.avgD = (nxTotalD / matches.length).toFixed(1);
      this.nxTotalKills = nxTotalK;
      this.totalAssists = nxTotalA;
      
      const maps = matches.map(m => m.mapName);
      this.mostPlayedMap = maps.sort((a,b) =>
          maps.filter(v => v===a).length - maps.filter(v => v===b).length
      ).pop();

      this.calculateSynergy(matches, info.user_name);

      this.trollMatches = matches.filter(m => {
        const kdVal = parseFloat(m.kd);
        return kdVal < 0.5 && m.death >= 5;
      }).length;

      const kdVal = this.kd;
      let combatScore = 0;
      if (kdVal <= 100) { combatScore = kdVal * 0.4; } 
      else if (kdVal <= 150) { combatScore = 40 + (kdVal - 100) * 0.6; } 
      else if (kdVal <= 200) { combatScore = 70 + (kdVal - 150) * 0.4; } 
      else { combatScore = 90 + (kdVal - 200) * 0.1; }
      this.radar.combat = Math.min(100, Math.max(0, combatScore));
      this.radar.survival = Math.min(100, Math.max(0, 100 - (this.avgD * 18)));
      
      const avgAssists = this.totalAssists / matches.length;
      let teamworkScore = 0;
      if (avgAssists <= 2.5) { teamworkScore = avgAssists * 28; } 
      else if (avgAssists <= 4.0) { teamworkScore = 70 + (avgAssists - 2.5) * 10; } 
      else { teamworkScore = 85 + (avgAssists - 4.0) * 10; }
      this.radar.teamwork = Math.min(100, Math.max(0, teamworkScore));

      const hsr = info.recent_assault_rate || 0;
      let precisionScore = 0;
      if (hsr <= 30) { precisionScore = hsr * 1.67; } 
      else if (hsr <= 50) { precisionScore = 50 + (hsr - 30) * 1.75; } 
      else { precisionScore = 85 + (hsr - 50) * 1; }
      this.radar.precision = Math.min(100, Math.max(0, precisionScore));
      this.radar.victory = this.winRate;

      const r = this.radar;
      if (this.trollMatches >= Math.ceil(matches.length * 0.6)) {
        this.playstyleTitle = "아낌없이 주는 나무 (우리팀의 재앙)";
        this.playstyleIcon = "🚨";
      } else if (r.combat >= 85 && r.precision >= 85) {
        this.playstyleTitle = "전술 핵병기 (압도적 무력)";
        this.playstyleIcon = "☢️";
      } else if (r.combat >= 85 && r.survival <= 35) {
        this.playstyleTitle = "광전사 (너 죽고 나 죽자)";
        this.playstyleIcon = "🪓";
      } else if (r.precision >= 92) {
        this.playstyleTitle = "인간 에임봇 (헤드헌터)";
        this.playstyleIcon = "🤖";
      } else if (r.survival >= 90 && r.teamwork >= 70) {
        this.playstyleTitle = "전장의 유령 (은둔 고수)";
        this.playstyleIcon = "👻";
      } else if (r.victory >= 80 && r.survival >= 80) {
        this.playstyleTitle = "승리 요정 (팀의 수호신)";
        this.playstyleIcon = "🛡️";
      } else if (r.teamwork >= 90) {
        this.playstyleTitle = "전장의 조율자 (살림꾼)";
        this.playstyleIcon = "🤝";
      } else if (r.combat >= 92) {
        this.playstyleTitle = "무자비한 정복자 (여포)";
        this.playstyleIcon = "👑";
      } else if (r.survival >= 92) {
        this.playstyleTitle = "불사신 (생존 끝판왕)";
        this.playstyleIcon = "🧘";
      } else if (r.combat >= 60 && r.survival >= 60 && r.teamwork >= 60 && r.precision >= 60 && r.victory >= 60) {
        this.playstyleTitle = "다재다능한 육각형 전사";
        this.playstyleIcon = "💠";
      } else {
        const maxStat = Object.keys(r).reduce((a, b) => r[a] > r[b] ? a : b);
        const titles = {
          combat: { t: "전장의 지배자 (여포)", i: "⚔️" },
          survival: { t: "생존 마스터", i: "🥷" },
          teamwork: { t: "어시스트 장인", i: "🤝" },
          precision: { t: "정밀 사격수", i: "🎯" },
          victory: { t: "승리 견인차", i: "🧚" }
        };
        this.playstyleTitle = titles[maxStat].t;
        this.playstyleIcon = titles[maxStat].i;
      }
    } else {
      this.avgK = 0; this.avgD = 0; this.nxTotalKills = 0; this.totalAssists = 0; this.mostPlayedMap = "데이터 없음";
    }
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
      .filter(s => s.total >= 2) 
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
        
        // --- PERFORMANCE DATA EXTRACTION ---
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

      // MVP 선정 로직: (킬 * 100) + 데미지 합산 점수 기준
      let bestScore = -1;
      let mvp = null;
      this.allPlayerStats.forEach(p => {
        const score = (p.kill * 100) + p.damage;
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

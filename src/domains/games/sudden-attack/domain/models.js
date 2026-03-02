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

    // Check if this player is part of the crew (Priority: OUID, Fallback: Name)
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
  constructor(info, matches = []) {
    // Basic API stats
    this.kd = info.recent_kill_death_rate ? parseFloat(info.recent_kill_death_rate.toFixed(1)) : 0;
    this.winRate = info.recent_win_rate ? parseFloat(info.recent_win_rate.toFixed(1)) : 0;
    this.headshotRate = info.recent_assault_rate ? parseFloat(info.recent_assault_rate.toFixed(1)) : 0;

    // Advanced Stats for Radar Chart (0-100 scale)
    this.radar = { combat: 0, survival: 0, teamwork: 0, precision: 0, victory: 0 };
    this.streakCount = 0;
    this.streakType = "NONE"; // WIN, LOSE, NONE
    this.trollMatches = 0;
    this.playstyleTitle = "데이터 수집 중";
    this.playstyleIcon = "🕵️";

    // Crew Match (내전) Stats
    this.crewMatchCount = 0;
    this.crewKd = "0.00";
    this.crewWinRate = 0;
    this.crewMmr = 1200;

    // Calculate real stats from the last matches
    if (matches.length > 0) {
      const totalK = matches.reduce((sum, m) => sum + m.kill, 0);
      const totalD = matches.reduce((sum, m) => sum + m.death, 0);
      const totalA = matches.reduce((sum, m) => sum + m.assist, 0);
      
      this.avgK = (totalK / matches.length).toFixed(1);
      this.avgD = (totalD / matches.length).toFixed(1);
      this.totalKills = totalK;
      this.totalDeaths = totalD;
      this.totalAssists = totalA;
      
      // Calculate Most Played Map
      const maps = matches.map(m => m.mapName);
      this.mostPlayedMap = maps.sort((a,b) =>
          maps.filter(v => v===a).length - maps.filter(v => v===b).length
      ).pop();

      // 1. Calculate Streak
      let currentStreak = 0;
      let isWinStreak = null;
      for (const m of matches) {
        const isWin = m.matchResult.toUpperCase() === 'WIN';
        if (isWinStreak === null) {
          isWinStreak = isWin;
          currentStreak = 1;
        } else if (isWinStreak === isWin) {
          currentStreak++;
        } else {
          break;
        }
      }
      if (currentStreak >= 2) {
        this.streakType = isWinStreak ? "WIN" : "LOSE";
        this.streakCount = currentStreak;
      }

      // 2. Troll Meter
      this.trollMatches = matches.filter(m => {
        const kd = parseFloat(m.kd);
        return kd < 0.5 && m.death >= 5;
      }).length;

      // 3. Crew Specific Stats (Filtering only isCustomMatch)
      const crewMatches = matches.filter(m => m.isCustomMatch);
      this.crewMatchCount = crewMatches.length;
      if (this.crewMatchCount > 0) {
        const ck = crewMatches.reduce((s, m) => s + m.kill, 0);
        const cd = crewMatches.reduce((s, m) => s + m.death, 0);
        const cw = crewMatches.filter(m => m.matchResult === 'WIN').length;
        this.crewKd = cd > 0 ? (ck / cd).toFixed(2) : ck.toFixed(2);
        this.crewWinRate = Math.round((cw / this.crewMatchCount) * 100);
      }

      // 4. Radar Chart Scaling (Mastery Curve Applied)
      const kdScore = this.kd;
      let combatScore = 0;
      if (kdScore <= 100) { combatScore = kdScore * 0.5; } 
      else if (kdScore <= 160) { combatScore = 50 + (kdScore - 100) * 0.583; } 
      else { combatScore = 85 + (kdScore - 160) * 0.375; }
      this.radar.combat = Math.min(100, Math.max(0, combatScore));

      this.radar.survival = Math.min(100, Math.max(0, 100 - (this.avgD * 15)));
      
      const avgAssists = this.totalAssists / matches.length;
      let teamworkScore = 0;
      if (avgAssists <= 1) { teamworkScore = avgAssists * 50; } 
      else if (avgAssists <= 2) { teamworkScore = 50 + (avgAssists - 1) * 35; } 
      else { teamworkScore = 85 + (avgAssists - 2) * 15; }
      this.radar.teamwork = Math.min(100, Math.max(0, teamworkScore));

      const hsr = this.headshotRate;
      let precisionScore = 0;
      if (hsr <= 20) { precisionScore = hsr * 2.5; } 
      else if (hsr <= 35) { precisionScore = 50 + (hsr - 20) * 2.33; } 
      else { precisionScore = 85 + (hsr - 35) * 1; }
      this.radar.precision = Math.min(100, Math.max(0, precisionScore));
      
      this.radar.victory = this.winRate;

      // 5. Advanced Playstyle Analysis (Multi-factor)
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
        this.playstyleTitle = "전장의 조율자 (빛과 소금)";
        this.playstyleIcon = "🎼";
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
        // Fallback to highest stat if no special combo is met
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
      this.avgK = 0; this.avgD = 0; this.totalKills = 0; this.totalDeaths = 0;
      this.totalAssists = 0; this.mostPlayedMap = "데이터 없음";
    }
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

    let playerStat = detail;
    
    if (detail.match_detail && Array.isArray(detail.match_detail)) {
      this.allPlayerStats = detail.match_detail.map(p => {
        const nickname = p.user_name || p.character_name || "";
        const normalizedName = nickname.toLowerCase().trim();
        
        const killValue = parseInt(p.kill || p.kill_count || p.cnt_kill || 0);
        const deathValue = parseInt(p.death || p.death_count || p.cnt_death || 0);
        const assistValue = parseInt(p.assist || p.assist_count || p.cnt_assist || 0);
        const resultValue = String(p.match_result || p.result || "0");

        let isSubject = false;
        if (subjectInfo) {
          if (killValue === parseInt(subjectInfo.kill) && 
              deathValue === parseInt(subjectInfo.death) && 
              String(resultValue) === String(subjectInfo.result)) {
            isSubject = true;
          }
        }

        // isCrew판별 시 하드코딩 명단(CREW_MEMBERS) 제거
        const isCrew = isSubject || 
                       (crewData.names || []).some(c => (c || "").toLowerCase().trim() === normalizedName);

        return {
          nickname: nickname,
          kill: killValue,
          death: deathValue,
          assist: assistValue,
          kd: deathValue > 0 ? (killValue / deathValue).toFixed(2) : (killValue > 0 ? killValue.toFixed(2) : "0.00"),
          result: resultValue === "1" ? "WIN" : (resultValue === "2" ? "LOSE" : "UNKNOWN"),
          isCrew: isCrew,
          ouid: isSubject ? subjectInfo.ouid : null
        };
      });

      this.participants = detail.match_detail.map(p => p.user_name || p.character_name);
      this.crewParticipants = this.allPlayerStats
        .filter(p => p.isCrew)
        .map(p => p.nickname);
      
      if (this.crewParticipants.length >= 8) {
        this.isCustomMatch = true;
      }

      const target = targetUserName ? targetUserName.toLowerCase().trim() : "";
      if (target) {
        playerStat = detail.match_detail.find(p => {
          const n = (p.user_name || p.character_name || "").toLowerCase().trim();
          return n === target;
        }) || detail.match_detail[0];
      } else {
        playerStat = detail.match_detail[0];
      }
    }

    this.matchResult = String(playerStat.match_result || playerStat.result) === "1" ? "WIN" : "LOSE";
    this.kill = parseInt(playerStat.kill || playerStat.kill_count || playerStat.cnt_kill || 0);
    this.death = parseInt(playerStat.death || playerStat.death_count || playerStat.cnt_death || 0);
    this.assist = parseInt(playerStat.assist || playerStat.assist_count || playerStat.cnt_assist || 0);
    
    if (this.death === 0) {
      this.kd = this.kill > 0 ? this.kill.toFixed(2) : "0.00";
    } else {
      this.kd = (this.kill / this.death).toFixed(2);
    }
  }
}

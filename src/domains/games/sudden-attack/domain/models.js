// Official Crew Members for Custom Match Detection
export const CREW_MEMBERS = [
  'Tracking', '결승', 'alt', '마미', '공대누비', 
  'xion', '김성식', '이쪼룽', '맞고사망한대성', 'SinYang'
];

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
                  (crewData.names || []).some(c => (c || "").toLowerCase().trim() === normalizedName) ||
                  CREW_MEMBERS.some(c => (c || "").toLowerCase().trim() === normalizedName);

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

      // 4. Radar Chart Scaling
      this.radar.combat = Math.min(100, Math.max(0, (this.kd / 2.0) * 100));
      this.radar.survival = Math.min(100, Math.max(0, 100 - (this.avgD * 10)));
      this.radar.teamwork = Math.min(100, Math.max(0, (this.totalAssists / matches.length) / 3 * 100));

      this.radar.precision = Math.min(100, Math.max(0, (this.headshotRate / 50) * 100));
      this.radar.victory = this.winRate;

      // 5. Determine Playstyle Title
      const maxStat = Object.keys(this.radar).reduce((a, b) => this.radar[a] > this.radar[b] ? a : b);
      if (this.trollMatches >= Math.ceil(matches.length / 2)) {
        this.playstyleTitle = "아낌없이 주는 나무 (상대팀 국밥)";
        this.playstyleIcon = "🚨";
      } else {
        const titles = {
          combat: { t: "여포 (전장의 지배자)", i: "⚔️" },
          survival: { t: "불사신 (생존왕)", i: "🥷" },
          teamwork: { t: "빛과 소금 (어시스트 마스터)", i: "🤝" },
          precision: { t: "헤드헌터 (인간 에임봇)", i: "🎯" },
          victory: { t: "승리 요정 (캐리 머신)", i: "🧚" }
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
    this.allPlayerStats = []; // Store full scoreboard data

    let playerStat = detail;
    
    if (detail.match_detail && Array.isArray(detail.match_detail)) {
      // 1. Process Scoreboard Data
      this.allPlayerStats = detail.match_detail.map(p => {
        const nickname = p.user_name || "";
        const normalizedName = nickname.toLowerCase().trim();
        
        // Subject Detection: More resilient comparison (string vs number)
        let isSubject = false;
        if (subjectInfo) {
          const pKill = parseInt(p.kill || p.kill_count || 0);
          const pDeath = parseInt(p.death || p.death_count || 0);
          const sKill = parseInt(subjectInfo.kill || 0);
          const sDeath = parseInt(subjectInfo.death || 0);
          
          if (pKill === sKill && pDeath === sDeath && String(p.match_result) === String(subjectInfo.result)) {
            isSubject = true;
          }
        }

        // Dynamic detection: Is Crew? (By current Name OR if it's the subject we are scanning for)
        const isCrew = isSubject || 
                       (crewData.names || []).some(c => (c || "").toLowerCase().trim() === normalizedName) ||
                       CREW_MEMBERS.some(c => (c || "").toLowerCase().trim() === normalizedName);

        return {
          nickname: nickname,
          kill: p.kill || p.kill_count || 0,
          death: p.death || p.death_count || 0,
          assist: p.assist || p.assist_count || 0,
          kd: p.death > 0 ? (p.kill / p.death).toFixed(2) : (p.kill > 0 ? p.kill.toFixed(2) : "0.00"),
          result: p.match_result === "1" ? "WIN" : (p.match_result === "2" ? "LOSE" : p.match_result),
          isCrew: isCrew,
          ouid: isSubject ? subjectInfo.ouid : null
        };
      });

      // 2. Identify Crew and Custom Match
      this.participants = detail.match_detail.map(p => p.user_name);
      this.crewParticipants = this.allPlayerStats
        .filter(p => p.isCrew)
        .map(p => p.nickname);
      
      if (this.crewParticipants.length >= 8) {
        this.isCustomMatch = true;
      }

      // 3. Set Target Player Stat
      const target = targetUserName ? targetUserName.toLowerCase().trim() : "";
      if (target) {
        playerStat = detail.match_detail.find(p => 
          p.user_name && p.user_name.toLowerCase().trim() === target
        ) || detail.match_detail[0];
      } else {
        playerStat = detail.match_detail[0];
      }
    }

    this.matchResult = String(playerStat.match_result) === "1" ? "WIN" : (String(playerStat.match_result) === "2" ? "LOSE" : "UNKNOWN");
    this.kill = playerStat.kill !== undefined ? playerStat.kill : (playerStat.kill_count || 0);
    this.death = playerStat.death !== undefined ? playerStat.death : (playerStat.death_count || 0);
    this.assist = playerStat.assist !== undefined ? playerStat.assist : (playerStat.assist_count || 0);
    
    if (this.death === 0) {
      this.kd = this.kill > 0 ? this.kill.toFixed(2) : "0.00";
    } else {
      this.kd = (this.kill / this.death).toFixed(2);
    }
  }
}

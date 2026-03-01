// Official Crew Members for Custom Match Detection
export const CREW_MEMBERS = [
  'Tracking', '결승', 'alt', '마미', '공대누비', 
  'xion', '김성식', '이쪼룽', '맞고사망한대성', 'SinYang'
];

export class Player {
  constructor(ouid, basic, rank, tier) {
    this.ouid = ouid;
    this.nickname = basic.user_name;
    this.level = basic.title_name || ""; 
    this.clanName = basic.clan_name || "None";
    this.rankName = rank.grade || "Unknown";
    this.ranking = rank.grade_ranking || 0;
    this.totalExp = rank.grade_exp || 0;
    this.seasonRank = rank.season_grade || "";
    
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
        // Assume matches are sorted by date descending (latest first)
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

      // 2. Troll Meter (Matches with < 0.5 KD & > 5 Deaths)
      this.trollMatches = matches.filter(m => {
        const kd = parseFloat(m.kd);
        return kd < 0.5 && m.death >= 5;
      }).length;

      // 3. Radar Chart Scaling (0-100)
      // Combat: K/D 2.0+ is 100
      this.radar.combat = Math.min(100, Math.max(0, (this.kd / 2.0) * 100));
      // Survival: 0 avg deaths is 100, 10 avg deaths is 0
      this.radar.survival = Math.min(100, Math.max(0, 100 - (this.avgD * 10)));
      // Teamwork: 3 avg assists is 100
      this.radar.teamwork = Math.min(100, Math.max(0, (this.totalAssists / matches.length) / 3 * 100));
      // Precision: Headshot rate 50%+ is 100
      this.radar.precision = Math.min(100, Math.max(0, (this.headshotRate / 50) * 100));
      // Victory: Win rate 100% is 100
      this.radar.victory = this.winRate;

      // 4. Determine Playstyle Title
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
      this.avgK = 0;
      this.avgD = 0;
      this.totalKills = 0;
      this.totalDeaths = 0;
      this.totalAssists = 0;
      this.mostPlayedMap = "데이터 없음";
    }
  }
}

export class MatchRecord {
  constructor(detail, typeName = "", targetUserName = "") {
    this.matchId = detail.match_id;
    this.matchTypeName = typeName;
    this.mapName = detail.match_map || detail.map_name || "Unknown Map";
    this.matchDate = detail.date_match || detail.match_date;
    this.participants = [];
    this.crewParticipants = [];
    this.isCustomMatch = false;

    let playerStat = detail;
    
    // Analyze Match Detail for Crew Members
    if (detail.match_detail && Array.isArray(detail.match_detail)) {
      this.participants = detail.match_detail.map(p => p.user_name);
      
      // Filter crew members who participated in this match
      this.crewParticipants = this.participants.filter(name => 
        CREW_MEMBERS.some(crew => crew.toLowerCase() === (name || "").toLowerCase())
      );
      
      // If 2 or more crew members are in the same match, it's a Custom Match (내전)
      if (this.crewParticipants.length >= 2) {
        this.isCustomMatch = true;
      }

      const target = targetUserName ? targetUserName.toLowerCase().trim() : "";
      if (target) {
        playerStat = detail.match_detail.find(p => 
          p.user_name && p.user_name.toLowerCase().trim() === target
        ) || detail.match_detail[0];
      } else {
        playerStat = detail.match_detail[0];
      }
    }

    const rawResult = String(playerStat.match_result || "UNKNOWN");
    if (rawResult === "1") {
      this.matchResult = "WIN";
    } else if (rawResult === "2") {
      this.matchResult = "LOSE";
    } else {
      this.matchResult = rawResult.toUpperCase();
    }
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

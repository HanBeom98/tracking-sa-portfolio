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

    // Calculate real stats from the last 5 matches
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

    let playerStat = detail;
    if (detail.match_detail && Array.isArray(detail.match_detail)) {
      const target = targetUserName ? targetUserName.toLowerCase().trim() : "";
      if (target) {
        playerStat = detail.match_detail.find(p => 
          p.user_name && p.user_name.toLowerCase().trim() === target
        ) || detail.match_detail[0];
      } else {
        playerStat = detail.match_detail[0];
      }
    }

    this.matchResult = playerStat.match_result || "UNKNOWN";
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

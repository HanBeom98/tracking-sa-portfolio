export class Player {
  constructor(ouid, basic, rank) {
    this.ouid = ouid;
    this.nickname = basic.user_name;
    this.level = basic.title_name || ""; // Level alternative in SA
    this.clanName = basic.clan_name || "None";
    this.rankName = rank.grade || "Unknown";
    this.ranking = rank.grade_ranking || 0;
    this.totalExp = rank.grade_exp || 0;
    this.seasonRank = rank.season_grade || "";
  }
}

export class RecentStats {
  constructor(info) {
    this.kd = info.recent_kill_death_rate ? parseFloat(info.recent_kill_death_rate.toFixed(1)) : 0;
    this.winRate = info.recent_win_rate ? parseFloat(info.recent_win_rate.toFixed(1)) : 0;
    
    // Recent Info API doesn't provide total count directly, but we show the rates
    // totalKills and totalDeaths are used in SaStatsSummary UI
    this.totalKills = info.recent_kill_death_rate ? info.recent_kill_death_rate.toFixed(0) : "0";
    this.totalDeaths = "100"; // Placeholder denominator to show the scale
    
    this.headshotRate = info.recent_assault_rate ? parseFloat(info.recent_assault_rate.toFixed(1)) : 0;
  }
}

export class MatchRecord {
  constructor(detail, typeName = "", targetUserName = "") {
    this.matchId = detail.match_id;
    this.matchTypeName = typeName;
    
    // API returns map name in 'match_map'
    this.mapName = detail.match_map || detail.map_name || "Unknown Map";
    this.matchDate = detail.date_match || detail.match_date;

    let playerStat = detail;
    if (detail.match_detail && Array.isArray(detail.match_detail)) {
      // Find the specific player by nickname (case-insensitive & trimmed)
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
    
    // Strictly check for undefined to allow 0 value
    this.kill = playerStat.kill !== undefined ? playerStat.kill : (playerStat.kill_count || 0);
    this.death = playerStat.death !== undefined ? playerStat.death : (playerStat.death_count || 0);
    this.assist = playerStat.assist !== undefined ? playerStat.assist : (playerStat.assist_count || 0);
    
    // Calculate KD ratio string
    if (this.death === 0) {
      this.kd = this.kill > 0 ? this.kill.toFixed(2) : "0.00";
    } else {
      this.kd = (this.kill / this.death).toFixed(2);
    }
  }
}

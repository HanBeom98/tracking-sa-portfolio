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
    this.totalKills = 0; // Not directly provided in this specific API object
    this.totalDeaths = 0;
    this.headshotRate = info.recent_assault_rate ? parseFloat(info.recent_assault_rate.toFixed(1)) : 0; // Using assault rate as placeholder if headshot not found
  }
}

export class MatchRecord {
  constructor(detail, typeName = "", targetUserName = "") {
    this.matchId = detail.match_id;
    this.matchTypeName = typeName;
    
    // API returns map name in 'match_map' instead of 'map_name'
    this.mapName = detail.match_map || detail.map_name || "Unknown Map";
    this.matchDate = detail.date_match || detail.match_date;

    // If API returns a 'match_detail' array, extract the specific player's stat
    let playerStat = detail;
    if (detail.match_detail && Array.isArray(detail.match_detail)) {
      if (targetUserName) {
        playerStat = detail.match_detail.find(p => p.user_name === targetUserName) || detail.match_detail[0];
      } else {
        playerStat = detail.match_detail[0];
      }
    }

    this.matchResult = playerStat.match_result || "UNKNOWN";
    this.kill = playerStat.kill !== undefined ? playerStat.kill : (playerStat.kill_count || 0);
    this.death = playerStat.death !== undefined ? playerStat.death : (playerStat.death_count || 0);
    this.assist = playerStat.assist !== undefined ? playerStat.assist : (playerStat.assist_count || 0);
    this.kd = this.death === 0 ? this.kill : parseFloat((this.kill / this.death).toFixed(2));
  }
}

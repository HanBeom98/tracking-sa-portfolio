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
  constructor(detail, typeName = "") {
    this.matchId = detail.match_id;
    this.matchTypeName = typeName;
    this.mapName = detail.map_name || "Unknown Map";
    this.matchResult = detail.match_result || "UNKNOWN"; // e.g., "WIN", "LOSE"
    this.kill = detail.kill_count || 0;
    this.death = detail.death_count || 0;
    this.assist = detail.assist_count || 0;
    this.kd = this.death === 0 ? this.kill : parseFloat((this.kill / this.death).toFixed(2));
    this.matchDate = detail.match_date;
  }
}

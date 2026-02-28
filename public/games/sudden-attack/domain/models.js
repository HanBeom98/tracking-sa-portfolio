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

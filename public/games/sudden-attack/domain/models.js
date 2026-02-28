export class Player {
  constructor(ouid, basic, rank) {
    this.ouid = ouid;
    this.nickname = basic.character_name;
    this.level = basic.level;
    this.rankName = rank.rank_name || "Unknown";
    this.ranking = rank.ranking || 0;
    this.totalExp = rank.exp || 0;
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

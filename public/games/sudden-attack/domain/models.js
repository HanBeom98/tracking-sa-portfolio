export class Player {
  constructor(basic, rank) {
    this.ouid = basic.ouid;
    this.nickname = basic.character_name;
    this.level = basic.level;
    this.rankName = rank.rank_name;
    this.ranking = rank.ranking;
    this.totalExp = rank.exp;
  }
}

export class MatchRecord {
  constructor(detail) {
    this.matchId = detail.match_id;
    this.mapName = detail.map_name;
    this.matchResult = detail.match_result; // e.g., "WIN", "LOSE"
    this.kill = detail.kill_count || 0;
    this.death = detail.death_count || 0;
    this.assist = detail.assist_count || 0;
    this.kd = this.death === 0 ? this.kill : parseFloat((this.kill / this.death).toFixed(2));
    this.matchDate = detail.match_date;
  }
}

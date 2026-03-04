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

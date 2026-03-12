export class CrewSeasonUseCases {
  constructor(crewRepo) {
    this.crewRepo = crewRepo;
  }

  async getSeasonStartDate() {
    return this.crewRepo.getSeasonStartDate();
  }

  async getSeasonHistory(limit = 140) {
    const seasonStart = await this.crewRepo.getSeasonStartDate();
    const history = await this.crewRepo.getHistory(300);
    return history
      .filter((item) => item.matchDate && new Date(item.matchDate) >= seasonStart)
      .sort((a, b) => new Date(b.matchDate) - new Date(a.matchDate))
      .slice(0, limit);
  }
}

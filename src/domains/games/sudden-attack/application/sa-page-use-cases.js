export class SaPageUseCases {
  constructor({ service, crewRepo, repository, highlightsService, crewSeasonUseCases }) {
    this.service = service;
    this.crewRepo = crewRepo;
    this.repository = repository;
    this.highlightsService = highlightsService;
    this.crewSeasonUseCases = crewSeasonUseCases;
  }

  async loadPlayerProfile(name, currentRankings = [], onFreshData = null) {
    return this.service.getFullPlayerProfile(name, currentRankings, onFreshData);
  }

  async loadCrewDashboard() {
    const rankings = await this.crewRepo.getRankings();
    const seasonStart = this.crewSeasonUseCases
      ? await this.crewSeasonUseCases.getSeasonStartDate()
      : await this.crewRepo.getSeasonStartDate();
    const seasonHistory = this.crewSeasonUseCases
      ? await this.crewSeasonUseCases.getSeasonHistory(140)
      : [];
    const formattedDate = seasonStart.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const { memberNames, memberOuids } = this.buildCrewMemberIndex(rankings);
    const highlights = this.highlightsService.build(rankings, seasonHistory, seasonStart);

    this.repository.setCrewMembers(memberNames, memberOuids);
    return { rankings, seasonStart, seasonHistory, formattedDate, highlights };
  }

  buildCrewMemberIndex(rankings) {
    const membersSet = new Set();
    const ouids = [];
    rankings.forEach((r) => {
      if (r.characterName) membersSet.add(r.characterName);
      if (r.migratedFrom) membersSet.add(r.migratedFrom);
      if (r.previousNames) r.previousNames.forEach((name) => membersSet.add(name));
      ouids.push(r.id);
    });
    return { memberNames: Array.from(membersSet), memberOuids: ouids };
  }
}

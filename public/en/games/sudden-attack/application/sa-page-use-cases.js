export class SaPageUseCases {
  constructor({ service, profileQueryService, crewRepo, repository, highlightsService, crewSeasonUseCases }) {
    this.service = service;
    this.profileQueryService = profileQueryService;
    this.crewRepo = crewRepo;
    this.repository = repository;
    this.highlightsService = highlightsService;
    this.crewSeasonUseCases = crewSeasonUseCases;
    this.dashboardCache = null;
    this.dashboardCacheTtlMs = 60 * 1000;
  }

  async loadPlayerProfile(name, currentRankings = [], onFreshData = null) {
    return this.profileQueryService.getFullPlayerProfile(name, currentRankings, onFreshData);
  }

  async loadCrewDashboard(forceRefresh = false) {
    if (!forceRefresh && this.dashboardCache) {
      const age = Date.now() - this.dashboardCache.timestamp;
      if (age < this.dashboardCacheTtlMs) {
        return this.dashboardCache.data;
      }
    }

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
    const data = { rankings, seasonStart, seasonHistory, formattedDate, highlights };
    this.dashboardCache = { timestamp: Date.now(), data };
    return data;
  }

  invalidateCrewDashboardCache() {
    this.dashboardCache = null;
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

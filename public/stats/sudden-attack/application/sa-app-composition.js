import { NexonApiClient } from '../infra/nexon-api-client.js?v=04b8ade22090';
import { SaRepository } from '../infra/sa-repository.js?v=60becccb1cf6';
import { CrewRepository } from '../infra/crew-repository.js?v=2bcebf3ee8d1';
import { SaService } from './sa-service.js?v=fdf712c4a292';
import { ProfileQueryService } from './profile-query-service.js?v=8f85dbd25539';
import { CrewHighlightsService } from './crew-highlights-service.js?v=d6f99a80daae';
import { CrewSeasonUseCases } from './crew-season-use-cases.js?v=9288b9289af2';
import { SaPageUseCases } from './sa-page-use-cases.js?v=c8acd5d0617f';

const defaultConstructors = Object.freeze({
  NexonApiClient,
  SaRepository,
  CrewRepository,
  SaService,
  ProfileQueryService,
  CrewHighlightsService,
  CrewSeasonUseCases,
  SaPageUseCases,
});

export function createSaApplication({ apiKey = '', constructors = defaultConstructors } = {}) {
  const client = new constructors.NexonApiClient(apiKey);
  const crewRepo = new constructors.CrewRepository(client);
  const repository = new constructors.SaRepository(client, crewRepo);
  const service = new constructors.SaService(repository, crewRepo);
  const profileQueryService = new constructors.ProfileQueryService(service);
  const crewHighlightsService = new constructors.CrewHighlightsService();
  const crewSeasonUseCases = new constructors.CrewSeasonUseCases(crewRepo);
  const pageUseCases = new constructors.SaPageUseCases({
    service,
    profileQueryService,
    crewRepo,
    repository,
    highlightsService: crewHighlightsService,
    crewSeasonUseCases,
  });

  return {
    client,
    crewRepo,
    repository,
    service,
    profileQueryService,
    crewHighlightsService,
    crewSeasonUseCases,
    pageUseCases,
  };
}

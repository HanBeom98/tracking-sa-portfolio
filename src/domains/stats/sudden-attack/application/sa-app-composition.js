import { NexonApiClient } from '../infra/nexon-api-client.js';
import { SaRepository } from '../infra/sa-repository.js';
import { CrewRepository } from '../infra/crew-repository.js';
import { SaService } from './sa-service.js';
import { ProfileQueryService } from './profile-query-service.js';
import { CrewHighlightsService } from './crew-highlights-service.js';
import { CrewSeasonUseCases } from './crew-season-use-cases.js';
import { SaPageUseCases } from './sa-page-use-cases.js';

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

import test from 'node:test';
import assert from 'node:assert/strict';
import { createSaApplication } from '../../src/domains/stats/sudden-attack/application/sa-app-composition.js';

function createFakeConstructors(calls) {
  return {
    NexonApiClient: class { constructor(apiKey) { this.apiKey = apiKey; calls.push(['client', apiKey]); } },
    CrewRepository: class { constructor(client) { this.client = client; calls.push(['crewRepo', client]); } },
    SaRepository: class { constructor(client, crewRepo) { this.client = client; this.crewRepo = crewRepo; calls.push(['repository', client, crewRepo]); } },
    SaService: class { constructor(repository, crewRepo) { this.repository = repository; this.crewRepo = crewRepo; calls.push(['service', repository, crewRepo]); } },
    ProfileQueryService: class { constructor(service) { this.service = service; calls.push(['profileQueryService', service]); } },
    CrewHighlightsService: class { constructor() { calls.push(['highlights']); } },
    CrewSeasonUseCases: class { constructor(crewRepo) { this.crewRepo = crewRepo; calls.push(['season', crewRepo]); } },
    SaPageUseCases: class { constructor(dependencies) { this.dependencies = dependencies; calls.push(['page', dependencies]); } },
  };
}

test('SA application composition wires shared public and league dependencies once', () => {
  const calls = [];
  const app = createSaApplication({ apiKey: 'test-key', constructors: createFakeConstructors(calls) });

  assert.equal(app.client.apiKey, 'test-key');
  assert.equal(app.crewRepo.client, app.client);
  assert.equal(app.repository.crewRepo, app.crewRepo);
  assert.equal(app.service.repository, app.repository);
  assert.equal(app.profileQueryService.service, app.service);
  assert.equal(app.crewSeasonUseCases.crewRepo, app.crewRepo);
  assert.equal(app.pageUseCases.dependencies.service, app.service);
  assert.equal(app.pageUseCases.dependencies.highlightsService, app.crewHighlightsService);
  assert.deepEqual(calls.map(([name]) => name), [
    'client', 'crewRepo', 'repository', 'service', 'profileQueryService', 'highlights', 'season', 'page'
  ]);
});

import { createFirestorePostRepository } from '../../board/infra/firestorePostRepository.js?v=cf90e0c82e04';
import { CrewRepository } from '../../stats/sudden-attack/infra/crew-repository.js?v=2bcebf3ee8d1';
import { ADMIN_LIST_LIMIT, parseBuildInfo } from '../domain/dashboard-policy.js?v=9b3b3d260aa2';

export function createDashboardRepository({ db, firebaseApp }) {
  const posts = createFirestorePostRepository({ db, firebaseApp });
  const crew = new CrewRepository(null);
  Object.defineProperty(crew, 'db', { get: () => db });
  return {
    async listNotices() {
      return (await posts.list({ category: 'notice', limit: ADMIN_LIST_LIMIT + 1 })).map(p => ({ id: p.id, title: String(p.title || ''), createdAt: p.createdAt }));
    },
    async listApplications() {
      return (await crew.getPendingApplications({ limit: ADMIN_LIST_LIMIT + 1 })).map(a => ({ id: a.id,
        characterName: String(a.characterName || ''), ouid: String(a.ouid || ''), status: a.status, appliedAt: a.appliedAt }));
    },
    decideApplication(id, decision) { return decision === 'APPROVED' ? crew.approveApplication(id) : crew.rejectApplication(id); },
  };
}
export async function readBuildInfo(fetcher = fetch) {
  const response = await fetcher('/build.txt', { cache: 'no-store', credentials: 'same-origin' });
  if (!response.ok) throw new Error('BUILD_INFO_UNAVAILABLE');
  return parseBuildInfo(await response.text());
}

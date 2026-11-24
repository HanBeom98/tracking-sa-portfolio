import test from 'node:test';
import assert from 'node:assert/strict';
import { decidePendingCrewApplication, applyCrewApplicationMethods } from '../../src/domains/stats/sudden-attack/infra/crew-application-methods.js';
import { createTransactionalFirestore } from '../helpers/transactional-firestore.js';

const path = 'sa_crew_applications/person';
const application = { applicantUid: 'person', characterName: 'Disguise', ouid: 'same-person', status: 'PENDING' };
const store = extra => createTransactionalFirestore({ [path]: application, ...extra });
test('approval uses the canonical application and preserves all existing member identity and scores', async () => {
  const member = { characterName: 'Original', previousNames: ['Disguise'], mmr: 1500, hsr: 1330, wins: 8, loses: 5, mmrHistory: [1] };
  const db = store({ 'sa_crew_members/same-person': member });
  const result = await decidePendingCrewApplication(db, 'person', 'APPROVED');
  assert.equal(result.existingMember, true); assert.deepEqual(db.read('sa_crew_members/same-person'), member);
  assert.equal(db.read(path).status, 'APPROVED');
});
test('new member creation and pending decision commit together', async () => {
  const db = store();
  await decidePendingCrewApplication(db, 'person', 'APPROVED', () => 'timestamp');
  assert.deepEqual(db.read('sa_crew_members/same-person'), { characterName: 'Disguise', mmr: 1200, hsr: 1200, wins: 0, loses: 0, mmrHistory: [], approvedAt: 'timestamp' });
  const failed = store(); failed.failNextCommit = true;
  await assert.rejects(decidePendingCrewApplication(failed, 'person', 'APPROVED'));
  assert.equal(failed.read(path).status, 'PENDING'); assert.equal(failed.read('sa_crew_members/same-person'), undefined);
});
test('competing approve and reject attempts cannot both process one application', async () => {
  const db = store();
  const results = await Promise.allSettled([decidePendingCrewApplication(db, 'person', 'APPROVED'), decidePendingCrewApplication(db, 'person', 'REJECTED')]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.match(results.find(r => r.status === 'rejected').reason.message, /ALREADY_PROCESSED/);
  assert.equal(db.commits, 1);
});
test('stale, missing, malformed and mismatched applications fail without writes', async () => {
  for (const data of [{ ...application, status: 'APPROVED' }, { ...application, applicantUid: 'other' }, { ...application, ouid: 'invalid/path' }, { ...application, characterName: '' }]) {
    const db = store({ [path]: data }); await assert.rejects(decidePendingCrewApplication(db, 'person', 'APPROVED')); assert.equal(db.commits, 0);
  }
  const db = store(); await assert.rejects(decidePendingCrewApplication(db, 'absent', 'APPROVED'), /NOT_FOUND/);
  for (const id of ['', '..', 'a/b']) await assert.rejects(decidePendingCrewApplication(db, id, 'APPROVED'), /INVALID/);
  await assert.rejects(decidePendingCrewApplication(db, 'person', 'DELETE'), /INVALID/);
});
test('legacy caller arguments cannot select a different nickname or member', async () => {
  class Repo {} applyCrewApplicationMethods(Repo);
  const repo = new Repo(); repo.db = store();
  const original = globalThis.window; globalThis.window = { firebase: { firestore: { FieldValue: { serverTimestamp: () => 'now' } } } };
  try { await repo.approveApplication('person', 'wrong-name', 'wrong-ouid'); }
  finally { if (original === undefined) delete globalThis.window; else globalThis.window = original; }
  assert.equal(repo.db.read('sa_crew_members/wrong-ouid'), undefined);
  assert.equal(repo.db.read('sa_crew_members/same-person').characterName, 'Disguise');
});

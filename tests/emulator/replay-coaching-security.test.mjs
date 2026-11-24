import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { initializeTestEnvironment, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

const root = process.env.TRACKING_SA_RULES_ROOT || process.cwd();
const { default: service } = await import(pathToFileURL(resolve(root, 'cloud-functions/replay-coaching-service.js')));
const { default: quota } = await import(pathToFileURL(resolve(root, 'cloud-functions/replay-coaching-quota.js')));
const { default: budget } = await import(pathToFileURL(resolve(root, 'cloud-functions/replay-coaching-preflight.js')));
const { default: cost } = await import(pathToFileURL(resolve(root, 'cloud-functions/replay-coaching-cost.js')));
const { default: runner } = await import(pathToFileURL(resolve(root, 'cloud-functions/replay-coaching-runner.js')));
const { default: paidService } = await import(pathToFileURL(resolve(root, 'cloud-functions/replay-coaching-review-service.js')));
const { default: credits } = await import(pathToFileURL(resolve(root, 'cloud-functions/replay-coaching-credits.js')));
const { default: creditOrders } = await import(pathToFileURL(resolve(root, 'cloud-functions/replay-coaching-credit-orders.js')));
const { creditFixtureEntries } = await import(pathToFileURL(resolve(root, 'tests/helpers/coaching-credit-fixture.js')));
const { default: reviewCatalog } = await import(pathToFileURL(resolve(root, 'cloud-functions/replay-coaching-review-catalog.js')));
const { buildReplayCoachingReview } = await import(pathToFileURL(resolve(root, 'src/domains/stats/sudden-attack/replay/domain/replay-coaching-review.js')));
const { openAIEnvelope, coachingResponse } = await import(pathToFileURL(resolve(root, 'tests/helpers/coaching-openai-fixture.js')));
const { analyzeReplay } = await import(pathToFileURL(resolve(root, 'src/domains/stats/sudden-attack/replay/domain/replay-analyzer.js')));
const { contextFixture } = await import(pathToFileURL(resolve(root, 'tests/fixtures/replay-context.js')));
const { testAccess, testAccessEnv } = await import(pathToFileURL(resolve(root, 'tests/helpers/coaching-test-access.js')));
let env;
before(async () => { env = await initializeTestEnvironment({ projectId: 'demo-trackingsa-ownership',
  firestore: { host: '127.0.0.1', port: 8085, rules: readFileSync(resolve(root, 'firestore.rules'), 'utf8') } }); });
after(async () => { await env?.cleanup(); });
const evidence = analyzeReplay(contextFixture(), 'focus').coachingEvidence;
const config = { REPLAY_COACHING_MODE: 'mock', REPLAY_COACHING_TEST_UIDS: 'tester,second',
  ...testAccessEnv(), REPLAY_COACHING_GLOBAL_MONTHLY: '1',
  REPLAY_COACHING_GLOBAL_UNITS: '5', REPLAY_COACHING_UNITS_PER_REQUEST: '5' };

async function paidFixture(db, suffix, quantity=2) {
  const now=Date.parse('2026-12-10T00:00:00Z'),uid=`paid-owner-${suffix}`,review=buildReplayCoachingReview(analyzeReplay(contextFixture(),'focus'));
  const access=testAccess({id:`paid-dec-${suffix}`,startsAt:Date.parse('2026-12-01T00:00:00Z'),endsAt:Date.parse('2027-01-01T00:00:00Z')});
  const profile={uid,email:'paid@example.test',displayName:'tester',photoURL:'',nickname:'',role:'free',createdAt:new Date(now),
    subscription:{status:'active',replayCoaching:{schemaVersion:1,product:'replay_ai_monthly_v1',billingState:'paid',status:'active',access}}};
  await setDoc(doc(db,'users',uid),profile);
  for(const [path,value] of creditFixtureEntries(uid,{quantity,now})) if(path!==`users/${uid}`)await setDoc(doc(db,path),value);
  await setDoc(doc(db,cost.controlRef(db).path),{schemaVersion:1,enabled:true,period:'202612',allocatedMicros:100000,rateVersion:cost.POLICY.rateVersion});
  await deleteDoc(doc(db,'_replay_coaching_months','usd_micro_v1_202612'));
  const f=reviewCatalog.createReviewCatalog(review).facts[0],selection={schemaVersion:2,cards:[{kind:'practice',factId:f.id,questionId:f.questions[0],practiceId:f.practices[0]}]};
  let counts=0,generations=0;
  const options={db,enabled:true,verifyToken:async token=>({uid:token}),now:()=>now,
    config:{userMicros:cost.POLICY.maxUserMicros,globalMonthly:100},countTokens:async()=>{counts++;return 1000;},
    generate:async(_request,q)=>{generations++;return openAIEnvelope(q,selection);}};
  const invoke=async(action='generate',token=uid,overrides={},requestId=`202612-paid_http_${suffix}_request`)=>{
    const result={status:200,body:null},res={set:()=>res,status:n=>{result.status=n;return res;},json:v=>{result.body=v;return res;},send:()=>res};
    await paidService.createReplayReviewHandler({...options,...overrides})({method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json',origin:'https://trackingsa.com'},
      rawBody:Buffer.from(JSON.stringify({action,requestId,evidence:review}))},res);return result;
  };
  return {uid,profile,invoke,options,calls:()=>({counts,generations}),userPath:credits.walletRef(db,uid).path,requestPath:credits.refsFor(db,uid,`202612-paid_http_${suffix}_request`,'202612').requestRef.path};
}

test('AI grant is readable by its owner but cannot be self-granted or edited, including by a site admin',async()=>{
  await env.withSecurityRulesDisabled(async ctx=>{
    const db=ctx.firestore(),f=await paidFixture(db,'rules');
    const owner=env.authenticatedContext(f.uid).firestore();assert.equal((await getDoc(doc(owner,'users',f.uid))).data().subscription.replayCoaching.billingState,'paid');
    await assertFails(updateDoc(doc(owner,'users',f.uid),{'subscription.replayCoaching.access.successLimit':50}));
    await assertFails(getDoc(doc(owner,f.userPath)));
    await assertFails(setDoc(doc(owner,f.userPath),{available:999}));
    await assertFails(getDoc(doc(owner,credits.orderRef(db,f.uid,'fixture_order').path)));
    await assertFails(setDoc(doc(owner,f.requestPath),{status:'completed'}));
    const newUid='paid-self-create';await assertFails(setDoc(doc(env.authenticatedContext(newUid).firestore(),'users',newUid),{...f.profile,uid:newUid}));
    const adminUid='paid-site-admin';await setDoc(doc(db,'users',adminUid),{...f.profile,uid:adminUid,role:'admin'});
    await assertFails(getDoc(doc(env.authenticatedContext(adminUid,{role:'admin'}).firestore(),f.userPath)));
    await assertFails(setDoc(doc(env.authenticatedContext(adminUid,{role:'admin'}).firestore(),credits.paymentRef(db,'fake_bank').path),{paid:true}));
    await assertFails(updateDoc(doc(env.authenticatedContext(adminUid,{role:'admin'}).firestore(),'users',adminUid),{'subscription.replayCoaching.billingState':'paid','subscription.replayCoaching.access.successLimit':50}));
  });
});

test('paid HTTP owner lookup and simultaneous duplicates preserve one expense in real Firestore',async()=>{
  await env.withSecurityRulesDisabled(async ctx=>{
    const db=ctx.firestore(),f=await paidFixture(db,'atomic');
    const outcomes=await Promise.all([f.invoke(),f.invoke()]);assert.ok(outcomes.some(r=>r.status===200));assert.equal(f.calls().generations,1);
    const user=(await getDoc(doc(db,f.userPath))).data();assert.equal(user.used,1);assert.equal(user.active,null);assert.equal(user.available,1);
    const beforeCounts=f.calls().counts,result=await f.invoke('result');assert.equal(result.status,200);assert.equal(result.body.result.mode,'saved_ai');assert.equal(f.calls().counts,beforeCounts);
    const other='paid-other-owner';await setDoc(doc(db,'users',other),{...f.profile,uid:other});assert.equal((await f.invoke('result',other)).status,404);
    await updateDoc(doc(db,f.userPath),{status:'blocked'});assert.equal((await f.invoke('result')).status,200);
    const ledger=(await getDoc(doc(db,'_replay_coaching_months','usd_micro_v1_202612'))).data();assert.equal(ledger.spentUnits,200);assert.equal(ledger.heldUnits,0);
    assert.equal(f.calls().generations,1);
  });
});

test('paid grant revocation while counting prevents any reservation in real Firestore',async()=>{
  await env.withSecurityRulesDisabled(async ctx=>{
    const db=ctx.firestore(),f=await paidFixture(db,'before_reserve');
    const r=await f.invoke('generate',f.uid,{countTokens:async()=>{await updateDoc(doc(db,f.userPath),{status:'blocked'});return 1000;}});
    assert.equal(r.status,403);assert.equal((await getDoc(doc(db,f.userPath))).data().held,0);assert.equal(f.calls().generations,0);
  });
});

test('paid grant revocation after reservation cancels before provider dispatch in real Firestore',async()=>{
  await env.withSecurityRulesDisabled(async ctx=>{
    const db=ctx.firestore(),f=await paidFixture(db,'before_dispatch');
    const guarded={collection:name=>db.collection(name),runTransaction:async fn=>{
      const r=await db.runTransaction(fn);if(r?.active?.orderId)await updateDoc(doc(db,f.userPath),{status:'blocked'});return r;
    }};
    assert.equal((await f.invoke('generate',f.uid,{db:guarded})).body.error,'COACHING_DISPATCH_BLOCKED');assert.equal(f.calls().generations,0);
    const user=(await getDoc(doc(db,f.userPath))).data();assert.equal(user.used,0);assert.equal(user.active,null);assert.equal(user.available,2);assert.equal((await getDoc(doc(db,f.requestPath))).data().status,'cancelled');
    const ledger=(await getDoc(doc(db,'_replay_coaching_months','usd_micro_v1_202612'))).data();assert.equal(ledger.spentUnits,0);assert.equal(ledger.heldUnits,0);
  });
});

test('credit purchase and refund confirmations are idempotent in real Firestore, including reused payment references',async()=>{
  await env.withSecurityRulesDisabled(async ctx=>{
    const db=ctx.firestore(),f=await paidFixture(db,'credit_orders');
    const manager=creditOrders.createCreditOrderManager({db,enabled:true,now:()=>Date.parse('2026-12-10T00:00:00Z'),
      product:{id:credits.PRODUCT,quantity:50,amountKRW:3300,termsVersion:'emulator_only',expiresAt:null},
      verifyPayment:async request=>({...request,status:'settled'}),verifyRefund:async request=>({...request,status:'settled'})});
    await manager.createOrder(f.uid,'purchase_a');
    const outcomes=await Promise.all([manager.confirmPayment(f.uid,'purchase_a','bank_emulator_one'),manager.confirmPayment(f.uid,'purchase_a','bank_emulator_one')]);
    assert.equal(outcomes.filter(o=>!o.duplicate).length,1);assert.equal((await getDoc(doc(db,f.userPath))).data().available,52);
    const other='credit-payment-other';await setDoc(doc(db,'users',other),{uid:other});await manager.createOrder(other,'purchase_b');
    await assert.rejects(manager.confirmPayment(other,'purchase_b','bank_emulator_one'),/ALREADY_APPLIED/);
    await manager.reserveRefund(f.uid,'purchase_a','refund_a',50);
    assert.equal((await getDoc(doc(db,f.userPath))).data().refundHeld,50);
    assert.equal((await f.invoke()).status,200); // only the original two unrefunded units are eligible
    await Promise.all([manager.confirmRefund(f.uid,'purchase_a','refund_a','bank_emulator_refund'),manager.confirmRefund(f.uid,'purchase_a','refund_a','bank_emulator_refund')]);
    const wallet=(await getDoc(doc(db,f.userPath))).data();assert.equal(wallet.refunded,50);assert.equal(wallet.refundHeld,0);assert.equal(wallet.available,1);assert.equal(wallet.used,1);
    await manager.confirmPayment(f.uid,'purchase_a','bank_emulator_one');assert.equal((await getDoc(doc(db,f.userPath))).data().available,1);
  });
});

test('last purchased unit cannot be consumed and reserved for refund concurrently in real Firestore',async()=>{
  await env.withSecurityRulesDisabled(async ctx=>{
    const db=ctx.firestore(),f=await paidFixture(db,'credit_refund_race',1);
    const manager=creditOrders.createCreditOrderManager({db,enabled:true,now:()=>Date.parse('2026-12-10T00:00:00Z')});
    const results=await Promise.allSettled([f.invoke(),manager.reserveRefund(f.uid,'fixture_order','refund_last',1)]);
    const wallet=(await getDoc(doc(db,f.userPath))).data();credits.validateWallet(wallet,f.uid);
    assert.equal(wallet.used+wallet.available+wallet.held+wallet.refundHeld+wallet.refunded,1);
    assert.ok(!(wallet.used===1&&wallet.refundHeld===1));
    if(results[1].status==='fulfilled')assert.equal(wallet.used,0);
    else assert.equal(results[0].value.status,200);
  });
});

test('unknown credit dispatch recovery releases customer hold while retaining maximum provider cost in real Firestore',async()=>{
  await env.withSecurityRulesDisabled(async ctx=>{
    const db=ctx.firestore(),f=await paidFixture(db,'credit_unknown');
    const response=await f.invoke('generate',f.uid,{generate:async()=>{throw Error('offline fake provider');}});
    assert.equal(response.body.error,'PROVIDER_OUTCOME_UNCONFIRMED');const wallet=(await getDoc(doc(db,f.userPath))).data();assert.equal(wallet.held,1);
    await credits.recoverCredit(db,f.uid,wallet.active.requestId,wallet.active.lease,'close_max_cost',wallet.active.startedAt+60000);
    const restored=(await getDoc(doc(db,f.userPath))).data();assert.equal(restored.available,2);assert.equal(restored.used,0);assert.equal(restored.held,0);
    const global=(await getDoc(doc(db,'_replay_coaching_months/usd_micro_v1_202612'))).data();assert.equal(global.spentUnits,wallet.active.quote.maxCostMicros);assert.equal(global.heldUnits,0);
  });
});

test('costed provider runner stores result with usage atomically and simultaneous duplicates never regenerate', async () => {
  await env.withSecurityRulesDisabled(async ctx => {
    const db=ctx.firestore(),now=Date.parse('2026-06-25T00:00:00Z'),period=quota.periodAt(now);
    const controlPath=cost.controlRef(db).path;
    await setDoc(doc(db,controlPath),{schemaVersion:1,enabled:true,period,allocatedMicros:10000,rateVersion:cost.POLICY.rateVersion});
    const opts={db,uid:'runner-emulator',requestId:`${period}-provider_atomic_result`,evidence,
      access:testAccess({id:'jun25-jul25',startsAt:now,endsAt:Date.parse('2026-07-25T00:00:00Z')}),
      userMicros:cost.POLICY.maxUserMicros,globalMonthly:100,now:()=>now};
    let counts=0,generations=0;
    opts.countTokens=async()=>{counts++;return 1000;};
    opts.generate=async(_request,q)=>{generations++;return openAIEnvelope(q);};
    const outcomes=await Promise.allSettled([runner.runCostedCoaching(opts),runner.runCostedCoaching(opts)]);
    assert.ok(outcomes.some(r=>r.status==='fulfilled'));assert.equal(generations,1);
    const userPath=`_replay_coaching_users/${cost.ACCOUNTING}_${quota.hash(opts.uid)}`;
    const user=(await getDoc(doc(db,userPath))).data();
    assert.equal(user.used,1);assert.equal(user.held,0);assert.deepEqual(user.recent[0].result.response,coachingResponse());
    assert.equal(user.recent[0].result.selection.schemaVersion,2);
    const globalPath=`_replay_coaching_months/${cost.ACCOUNTING}_${period}`;
    const ledger=(await getDoc(doc(db,globalPath))).data();assert.equal(ledger.spentUnits,200);assert.equal(ledger.heldUnits,0);
    await updateDoc(doc(db,controlPath),{enabled:false});const beforeCounts=counts;
    const cached=await runner.runCostedCoaching(opts);assert.equal(cached.outcome,'already_completed');
    assert.deepEqual(cached.response,coachingResponse());assert.equal(counts,beforeCounts);assert.equal(generations,1);
    for(const client of [env.unauthenticatedContext(),env.authenticatedContext(opts.uid),env.authenticatedContext('admin',{role:'admin'})]) {
      await assertFails(getDoc(doc(client.firestore(),userPath)));
      await assertFails(updateDoc(doc(client.firestore(),userPath),{used:0}));
    }
    // A privately corrupted rendered result must not bypass selection checking
    // on retry, and must not turn into another provider request or a refund.
    const altered=structuredClone(user);altered.recent[0].result.response.cards[0].observation='아군 3명·상대 3명이 생존했습니다.';
    await setDoc(doc(db,userPath),altered);
    await assert.rejects(runner.runCostedCoaching(opts),error=>error.code==='COACHING_RESULT_MISMATCH');
    assert.equal(generations,1);assert.equal(counts,beforeCounts);
    assert.deepEqual((await getDoc(doc(db,globalPath))).data(),ledger);
  });
});

test('provider-result settlement versus explicit recovery keeps exactly one durable expense and matching result state', async () => {
  await env.withSecurityRulesDisabled(async ctx => {
    const db=ctx.firestore(),now=Date.parse('2026-05-25T00:00:00Z'),period=quota.periodAt(now);
    await setDoc(doc(db,cost.controlRef(db).path),{schemaVersion:1,enabled:true,period,allocatedMicros:10000,rateVersion:cost.POLICY.rateVersion});
    let started,release;const ready=new Promise(resolve=>{started=resolve;});
    const opts={db,uid:'runner-recovery-emulator',requestId:`${period}-provider_recovery_result`,evidence,
      access:testAccess({id:'may25-jun25',startsAt:now,endsAt:Date.parse('2026-06-25T00:00:00Z')}),
      userMicros:cost.POLICY.maxUserMicros,globalMonthly:100,now:()=>now,countTokens:async()=>1000,
      generate:async(_request,q)=>{started();return new Promise(resolve=>{release=()=>resolve(openAIEnvelope(q));});}};
    const running=runner.runCostedCoaching(opts);await ready;
    const userPath=`_replay_coaching_users/${cost.ACCOUNTING}_${quota.hash(opts.uid)}`;
    const active=(await getDoc(doc(db,userPath))).data().active;
    const recovery={requestId:active.id,lease:active.lease,resolution:'close_max_cost',accounting:cost.ACCOUNTING};
    const recovering=quota.recoverCoachingQuota(db,opts.uid,recovery,now+61000);release();
    await Promise.allSettled([running,recovering]);
    const user=(await getDoc(doc(db,userPath))).data(),completed=user.recent[0].status==='completed';
    const global=(await getDoc(doc(db,`_replay_coaching_months/${cost.ACCOUNTING}_${period}`))).data();
    assert.equal(global.spentUnits,completed?200:1100);assert.equal(global.heldUnits,0);assert.equal(user.used,Number(completed));
    assert.equal(Boolean(user.recent[0].result),completed);assert.equal(user.recent.length,1);
    await quota.recoverCoachingQuota(db,opts.uid,recovery,now+62000);
    assert.deepEqual((await getDoc(doc(db,`_replay_coaching_months/${cost.ACCOUNTING}_${period}`))).data(),global);
  });
});
async function call(db, uid, n) {
  const result = { status: 200, body: null };
  const res = { set: () => res, status: n => { result.status = n; return res; },
    json: v => { result.body = v; return res; }, send: () => res };
  await service.createReplayCoachingHandler({ db, verifyToken: async () => ({ uid }), getEnv: () => config,
    now: () => Date.parse('2026-10-25T00:00:00Z') })({ method: 'POST', headers: { authorization: 'Bearer emulator-fixture',
    'content-type': 'application/json' }, rawBody: Buffer.from(JSON.stringify({ requestId: `202610-emulator_request_${n}`, evidence })) }, res);
  return result;
}

test('anonymous, members and site admins cannot read or mutate coaching ledgers', async () => {
  for (const collection of ['_replay_coaching_users', '_replay_coaching_months']) {
    await env.withSecurityRulesDisabled(async ctx => { await setDoc(doc(ctx.firestore(), collection, 'protected'), { used: 1 }); });
    for (const ctx of [env.unauthenticatedContext(), env.authenticatedContext('member'),
      env.authenticatedContext('admin', { email: 'demo-9249b6f9@example.com', role: 'admin' })]) {
      const ref = doc(ctx.firestore(), collection, 'protected');
      await assertFails(getDoc(ref)); await assertFails(setDoc(ref, { used: 0 }));
      await assertFails(updateDoc(ref, { used: 0 })); await assertFails(deleteDoc(ref));
    }
  }
});

test('funded dollar reservations and the persistent stop switch are atomic in Firestore', async () => {
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore(), now = Date.parse('2026-10-25T00:00:00Z'), { POLICY, ACCOUNTING } = cost;
    const controlPath = cost.controlRef(db).path;
    const settings = { schemaVersion: 1, enabled: true, period: '202610', allocatedMicros: 1100, rateVersion: POLICY.rateVersion };
    await setDoc(doc(db, controlPath), settings);
    const prepare = (uid, suffix) => budget.prepareCoachingBudget({ db, uid,
      requestId: `202610-emulator_budget_${suffix}`, evidence, access: testAccess({ successLimit: 50, attemptLimit: 70 }),
      userMicros: POLICY.maxUserMicros, globalMonthly: 100, countTokens: async () => 1000, now: () => now });
    const results = await Promise.allSettled([prepare('budget-emulator-a', 'first_a'), prepare('budget-emulator-b', 'first_b')]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(results.find(r => r.status === 'rejected').reason.code, 'GLOBAL_BUDGET_LIMIT');
    const winner = results.find(r => r.status === 'fulfilled').value;
    const globalRef = doc(db, winner.reservation.globalRef.path), userRef = doc(db, winner.reservation.userRef.path);
    assert.equal((await getDoc(globalRef)).data().heldUnits, 1100);
    await setDoc(doc(db, controlPath), { ...settings, enabled: false });
    await assert.rejects(budget.authorizeCoachingDispatch(db, winner, now), e => e.code === 'COACHING_DISPATCH_BLOCKED');
    assert.equal((await getDoc(globalRef)).data().heldUnits, 0);
    assert.equal((await getDoc(userRef)).data().recent[0].status, 'cancelled');
    await setDoc(doc(db, controlPath), settings);
    const p = await prepare('budget-emulator-next', 'second_request');
    await budget.authorizeCoachingDispatch(db, p, now);
    await setDoc(doc(db, controlPath), { ...settings, enabled: false });
    const options = { accounting: ACCOUNTING, requestId: p.reservation.active.id, lease: p.reservation.active.lease, resolution: 'close_max_cost' };
    const measured = { model: POLICY.model, serviceTier: 'default', usage: { input_tokens: 1000, output_tokens: 200,
      total_tokens: 1200, input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 } } };
    const outcomes = await Promise.allSettled([
      quota.recoverCoachingQuota(db, 'budget-emulator-next', options, now + 60000),
      quota.finishCoachingQuota(db, p.reservation, { customerSuccess: true, chargedUnits: 200, measured }),
      quota.recoverCoachingQuota(db, 'budget-emulator-next', options, now + 60000),
    ]);
    assert.ok(outcomes.some(result => result.status === 'fulfilled'));
    const user = (await getDoc(doc(db, p.reservation.userRef.path))).data(), global = (await getDoc(globalRef)).data();
    const success = user.recent[0].status === 'completed';
    assert.equal(global.spentUnits, success ? 200 : 1100); assert.equal(user.spentUnits, global.spentUnits);
    assert.equal(global.heldUnits, 0); assert.equal(global.heldCalls, 0); assert.equal(user.used, Number(success));
    const before = structuredClone(global); await quota.recoverCoachingQuota(db, 'budget-emulator-next', options, now + 61000);
    assert.deepEqual((await getDoc(globalRef)).data(), before);
    for (const client of [env.unauthenticatedContext(), env.authenticatedContext('budget-emulator-next'),
      env.authenticatedContext('budget-admin', { role: 'admin' })]) {
      for (const protectedPath of [controlPath, p.reservation.userRef.path, p.reservation.globalRef.path]) {
        await assertFails(getDoc(doc(client.firestore(), protectedPath)));
        await assertFails(setDoc(doc(client.firestore(), protectedPath), { enabled: true, spentUnits: 0 }));
      }
    }
  });
});

test('incurred failure costs stay in the real ledger and concurrent recovery cannot double settle', async () => {
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore(), now = Date.parse('2026-10-25T00:00:00Z');
    // Isolated month avoids tombstone/caching interaction with prior test fixtures.
    const periodTime = Date.parse('2026-09-20T00:00:00Z');
    const limits = { access: testAccess({ id: 'test-sep20-oct20', startsAt: periodTime, endsAt: Date.parse('2026-10-20T00:00:00Z') }),
      globalMonthly: 10, globalUnits: 20, unitsPerRequest: 5 };
    const first = await quota.reserveCoachingQuota(db, 'settlement-cost', '202609-emulator_cost_failure', 'cost-evidence', limits, periodTime);
    await quota.markCoachingDispatched(db, first, periodTime);
    await quota.finishCoachingQuota(db, first, { customerSuccess: false, chargedUnits: 3 });
    let user = (await getDoc(doc(db, first.userRef.path))).data();
    assert.equal(user.used, 0); assert.equal(user.held, 0);
    assert.equal((await getDoc(doc(db, first.globalRef.path))).data().spentUnits, 3);
    const second = await quota.reserveCoachingQuota(db, 'settlement-cost', '202609-emulator_cost_unknown', 'cost-evidence', limits, periodTime);
    await quota.markCoachingDispatched(db, second, periodTime);
    const recovery = { requestId: second.active.id, lease: second.active.lease, resolution: 'close_max_cost' };
    const outcomes = await Promise.allSettled([
      quota.recoverCoachingQuota(db, 'settlement-cost', recovery, now),
      quota.finishCoachingQuota(db, second, { customerSuccess: true, chargedUnits: 2 }),
      quota.recoverCoachingQuota(db, 'settlement-cost', recovery, now),
    ]);
    assert.ok(outcomes.some(result => result.status === 'fulfilled'));
    user = (await getDoc(doc(db, second.userRef.path))).data();
    const global = (await getDoc(doc(db, second.globalRef.path))).data();
    assert.equal(user.recent.length, 2); assert.equal(user.held, 0); assert.equal(user.active, null);
    assert.equal(global.usedCalls, 2); assert.equal(global.heldCalls, 0); assert.equal(global.heldUnits, 0);
    const success = user.recent[1].status === 'completed';
    assert.equal(user.used, Number(success)); assert.equal(global.successfulCalls, Number(success));
    assert.equal(global.spentUnits, success ? 5 : 8);
    const repeated = await quota.recoverCoachingQuota(db, 'settlement-cost', recovery, now);
    assert.equal(repeated.alreadySettled, true);
    assert.deepEqual((await getDoc(doc(db, second.globalRef.path))).data(), global);
    await assert.rejects(quota.finishCoachingQuota(db, second, { customerSuccess: true, chargedUnits: 2 }));
    assert.deepEqual((await getDoc(doc(db, second.globalRef.path))).data(), global);
  });
});

test('real Firestore transactions allow only one concurrent request under the global reservation', async () => {
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await deleteDoc(doc(db, '_replay_coaching_months', '202610'));
    const results = await Promise.all([call(db, 'tester', 'a'), call(db, 'second', 'b')]);
    assert.equal(results.filter(r => r.status === 200).length, 1);
    assert.equal(results.filter(r => r.status === 429).length, 1);
    const state = (await getDoc(doc(db, '_replay_coaching_months', '202610'))).data();
    assert.deepEqual(state, { schemaVersion: 2, successfulCalls: 1, usedCalls: 1, heldCalls: 0, spentUnits: 5, heldUnits: 0 });
    const winner = results[0].status === 200 ? ['tester', 'a'] : ['second', 'b'];
    assert.equal((await call(db, ...winner)).body.outcome, 'already_completed');
    assert.deepEqual((await getDoc(doc(db, '_replay_coaching_months', '202610'))).data(), state);
  });
});

test('real access windows survive calendar rollover and concurrent renewals grant only one active reservation', async () => {
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore(), firstTime = Date.parse('2026-08-31T14:59:59Z');
    const access = testAccess({ id: 'aug20-sep20', startsAt: Date.parse('2026-08-20T00:00:00Z'), endsAt: Date.parse('2026-09-20T00:00:00Z') });
    const limits = { access, globalMonthly: 100, globalUnits: 100, unitsPerRequest: 5 };
    const reserve = (n, now, caps = limits) => quota.reserveCoachingQuota(db, 'access-tester',
      `${quota.periodAt(now)}-emulator_access_${n}`, 'access-evidence', caps, now);
    async function finish(r, now) {
      await quota.markCoachingDispatched(db, r, now);
      await quota.finishCoachingQuota(db, r, { customerSuccess: true, chargedUnits: 1 });
    }
    const first = await reserve('first', firstTime); await finish(first, firstTime);
    const second = await reserve('second', firstTime + 1000); await finish(second, firstTime + 1000);
    let user = (await getDoc(doc(db, second.userRef.path))).data();
    assert.equal(user.used, 2); assert.equal(user.attempts, 2); assert.equal(user.access.id, access.id);
    await assert.rejects(reserve('blocked', firstTime + 1000), error => error.code === 'USER_LIMIT');
    const nextAccess = { ...access, id: 'sep20-oct20', startsAt: access.endsAt, endsAt: Date.parse('2026-10-20T00:00:00Z') };
    const nextLimits = { ...limits, access: nextAccess };
    const outcomes = await Promise.allSettled([reserve('renew_a', nextAccess.startsAt, nextLimits), reserve('renew_b', nextAccess.startsAt, nextLimits)]);
    assert.equal(outcomes.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(outcomes.find(r => r.status === 'rejected').reason.code, 'REQUEST_IN_PROGRESS');
    const r = outcomes.find(r => r.status === 'fulfilled').value; await finish(r, nextAccess.startsAt);
    user = (await getDoc(doc(db, r.userRef.path))).data();
    assert.equal(user.used, 1); assert.equal(user.attempts, 1); assert.equal(user.previous[0].used, 2);
    const before = (await getDoc(doc(db, first.globalRef.path))).data();
    const duplicate = await quota.reserveCoachingQuota(db, 'access-tester', first.active.id, 'access-evidence', nextLimits, nextAccess.startsAt);
    assert.equal(duplicate.duplicate, true); assert.equal(duplicate.used, 2);
    assert.deepEqual((await getDoc(doc(db, first.globalRef.path))).data(), before);
  });
});

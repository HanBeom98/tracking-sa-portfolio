import test from 'node:test';
import assert from 'node:assert/strict';
import {createDiscordSignatureFixture, discordIngressRejections} from '../fixtures/discord-interaction.js';
import fs from 'node:fs';
import {onRequest} from '../../functions/_middleware.js';

test('fixed Discord dispatch retains signature, freshness and exact-body validation', async () => {
  const fixture=createDiscordSignatureFixture();
  const invoke=request=>onRequest({request,env:{DISCORD_PUBLIC_KEY:fixture.publicKey},next(){assert.fail('Discord must use its signed ingress');}});
  const valid=await invoke(fixture.signedRequest('{"type":1}'));
  assert.equal(valid.status,200);
  assert.deepEqual(await valid.json(),{type:1});
  for(const {name,request,status} of discordIngressRejections(fixture)) {
    assert.equal((await invoke(request)).status,status,name);
  }
});

test('deployment confines root middleware to API requests and keeps static traffic out of Functions', () => {
  const routes=JSON.parse(fs.readFileSync('_routes.json','utf8'));
  assert.deepEqual(routes,{version:1,include:['/api/*'],exclude:[]});
  const manifest=JSON.parse(fs.readFileSync('scripts/deployment-artifacts.json','utf8'));
  assert.ok(manifest.rootAssets.includes('_routes.json'));
  for(const path of ['/','/index.html','/stats/sudden-attack/replay/','/logo.svg','/guides/replay-analysis-guide/']) {
    assert.equal(path.startsWith('/api/'),false);
  }
});

test('other paths preserve the original request/context and continue through Pages once', async () => {
  for(const path of ['/api/sa-proxy','/api/replay-pass-checkout','/api/soop-live','/api/discord-sa',
    '/api/discord-interaction-extra','/api/discord-interaction/','/stats/sudden-attack/replay/']) {
    const request=new Request('https://trackingsa.com'+path,{method:'POST',body:'unchanged body'});
    const data={identity:'context data'};let nextCalls=0;
    const context={request,env:{unmodified:true},data,next(){
      nextCalls++;assert.equal(this,context);assert.equal(this.request,request);assert.equal(this.data,data);
      return new Response('continued',{status:202});
    }};
    const response=await onRequest(context);
    assert.equal(response.status,202);assert.equal(await response.text(),'continued');
    assert.equal(nextCalls,1);assert.equal(await request.text(),'unchanged body');
  }
});

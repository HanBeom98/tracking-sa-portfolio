import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const route = '/stats/sudden-attack/replay/';

test('replay analysis desk is connected from the main discovery surfaces', () => {
  const entryFiles = [
    'src/shared/ui/header.html',
    'src/shared/ui/footer.html',
    'src/domains/stats/index.html',
    'src/domains/stats/sudden-attack/index.html',
  ];

  for (const file of entryFiles) {
    const source = fs.readFileSync(file, 'utf8');
    assert.match(source, new RegExp(`href="${route}"`), `${file} should link to the replay analysis desk`);
  }
});

test('replay analysis desk is included in search and sitemap sources', () => {
  const builder = fs.readFileSync('src/shared/infra/builder.py', 'utf8');

  assert.match(builder, /stats\/sudden-attack\/replay\/index\.html/);
  assert.match(builder, /"href": "\/stats\/sudden-attack\/replay\/"/);
  assert.match(builder, /"title": "리플레이 분석실"/);
});

test('replay file guide links to the official barracks site', () => {
  const replayPage = fs.readFileSync('src/domains/stats/sudden-attack/replay/index.html', 'utf8');

  assert.match(replayPage, /href="https:\/\/barracks\.sa\.nexon\.com\/"/);
  assert.match(replayPage, /target="_blank" rel="noopener noreferrer"/);
  assert.match(replayPage, /리플레이 표시가 있는 경기/);
});

test('replay hero describes current features without the removed mission flow', () => {
  const replayPage = fs.readFileSync('src/domains/stats/sudden-attack/replay/index.html', 'utf8');

  assert.match(replayPage, /병영수첩 JSON으로 경기 흐름과 주요 장면을 확인/);
  assert.doesNotMatch(replayPage, /다음 경기 미션/);
});

test('replay page exposes a crawlable analysis preview before file upload', () => {
  const replayPage = fs.readFileSync('src/domains/stats/sudden-attack/replay/index.html', 'utf8');

  assert.match(replayPage, /ANALYSIS PREVIEW/);
  assert.match(replayPage, /리플레이에서 이런 흐름을 찾습니다/);
  assert.match(replayPage, /평균 생존/);
  assert.match(replayPage, /팀원과 거리가 28m/);
  assert.match(replayPage, /투척 후 5초/);
});

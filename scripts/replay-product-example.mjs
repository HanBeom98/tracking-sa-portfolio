// Offline content generation only. No provider, credentials, network or DB access.
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import depth from '../cloud-functions/replay-coaching-depth.js';
import { analyzeReplay } from '../src/domains/stats/sudden-attack/replay/domain/replay-analyzer.js';
import { createReplaySamples } from '../src/domains/stats/sudden-attack/replay/domain/replay-samples.js';

export const EXAMPLE_START = '<!-- REPLAY_PRODUCT_EXAMPLE_START -->';
export const EXAMPLE_END = '<!-- REPLAY_PRODUCT_EXAMPLE_END -->';
const sourcePath = new URL('../src/domains/ai-replay-pass/index.html', import.meta.url);
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

// These are editorial selections, deliberately not represented as model output.
export const EXAMPLE_SELECTION = {
  schemaVersion: 2,
  cards: [
    { kind: 'strength', factId: 'depth1_r1_opening', questionId: 'dq1_opening', practiceId: 'dp2_opening' },
    { kind: 'review', factId: 'depth1_r2_death', questionId: 'dq1_death', practiceId: 'dp2_death' },
    { kind: 'practice', factId: 'depth1_r3_result', questionId: 'dq1_result', practiceId: 'dp2_result' },
  ],
};

export async function createReplayProductExample() {
  const replay = JSON.parse(await createReplaySamples()[0].text());
  const analysis = analyzeReplay(replay, 'sample-player');
  const evidence = analysis.coachingEvidence;
  const selection = depth.curateCurrentDepthSelection(EXAMPLE_SELECTION, evidence);
  const response = depth.renderCoachingDepthSelection(selection, evidence);
  const labels = { strength: '강점으로 살펴볼 기록', review: '복기할 장면', practice: '다음 경기 과제' };
  return {
    mapName: analysis.match.mapName,
    nickname: analysis.player.nickName,
    rounds: analysis.rounds.length,
    verifiedRounds: analysis.contextSummary.completeRounds,
    cards: response.cards.map(card => {
      const [question, goal] = card.practice.split('\n');
      if (!question?.startsWith('복기: ') || !goal) throw new Error('Example practice format changed; review the public example.');
      const round = evidence.rounds.find(round => round.evidenceId === card.evidenceRefs[0]);
      if (!round) throw new Error('Example evidence missing');
      return {
        kind: card.kind, label: labels[card.kind], title: card.title,
        observation: card.observation, question: question.slice('복기: '.length),
        goal, limitation: card.limitation, round: round.round,
      };
    }),
  };
}

export function renderReplayProductExample(example) {
  const cards = example.cards.map((card, index) => `          <article class="pass-example-card" data-example-kind="${escape(card.kind)}" aria-labelledby="example-card-${index + 1}">
            <p class="pass-example-kind">${escape(card.label)} <span>근거 ${card.round}라운드</span></p>
            <h3 id="example-card-${index + 1}">${escape(card.title)}</h3>
            <dl><dt>기록에서 확인한 사실</dt><dd>${escape(card.observation)}</dd><dt>복기 질문</dt><dd>${escape(card.question)}</dd><dt>다음 경기 연습 목표</dt><dd class="pass-example-goal">${escape(card.goal)}</dd></dl>
            <p class="pass-example-limit">${escape(card.limitation)}</p>
          </article>`).join('\n');
  return `      <section class="pass-example" id="result-example" aria-labelledby="example-title">
        <p class="pass-label">RESULT EXAMPLE · 구성 예시</p>
        <h2 id="example-title">AI 해설 결과는 이렇게 구성돼요</h2>
        <p class="pass-example-disclosure"><strong>가상 경기에서 수동 선택한 구성 예시이며, 실제 AI 생성 결과가 아닙니다.</strong> 현재 해설의 사실·질문·연습 항목을 사용해 결과 형태를 보여줍니다. 이 예시를 보거나 무료 샘플을 체험해도 유료 AI 요청·결제·이용 횟수 차감은 발생하지 않습니다.</p>
        <p class="pass-muted">${escape(example.nickname)} · ${escape(example.mapName)} · ${example.rounds}라운드 중 ${example.verifiedRounds}라운드 검증. 분석실의 첫 번째 무료 가상 샘플과 같은 기록입니다.</p>
        <ol class="pass-example-steps" aria-label="해설 결과를 읽는 순서"><li><b>01 · 사실 확인</b><span>어느 라운드에 무슨 기록이 있었는지</span></li><li><b>02 · 복기 질문</b><span>다시 볼 장면과 확인할 관점</span></li><li><b>03 · 다음 경기 과제</b><span>직접 실행하고 확인할 행동 목표</span></li></ol>
        <div class="pass-example-grid">
${cards}
        </div>
        <p class="pass-muted">실제 분석의 카드 수·장면·목표는 기록과 선택에 따라 달라집니다. 항상 예시처럼 3장을 제공하는 것은 아니며, 실력 향상이나 승률 상승을 보장하지 않습니다. 기록에 없는 시야·음성·플레이 의도와 사망 원인은 확정하지 않습니다.</p>
        <p><a class="pass-example-link" href="/stats/sudden-attack/replay/">같은 가상 경기로 무료 기본 분석 체험하기 →</a></p>
        <p class="pass-muted">분석실에서 ‘샘플로 한 경기 체험’을 눌러 기록·재생·PDF 보고서를 확인하세요. 무료 체험에는 유료 AI 선택이 포함되지 않습니다.</p>
      </section>`;
}

export function replaceReplayProductExample(html, fragment) {
  const start = html.indexOf(EXAMPLE_START), end = html.indexOf(EXAMPLE_END);
  if (start < 0 || end <= start || html.indexOf(EXAMPLE_START, start + EXAMPLE_START.length) !== -1
    || html.indexOf(EXAMPLE_END, end + EXAMPLE_END.length) !== -1) throw new Error('Expected exactly one example marker pair');
  return html.slice(0, start + EXAMPLE_START.length) + '\n' + fragment + '\n      ' + html.slice(end);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mode = process.argv[2] || '--check';
  if (!['--write', '--check'].includes(mode)) throw new Error('Usage: node scripts/replay-product-example.mjs [--write|--check]');
  const html = (await readFile(sourcePath, 'utf8')).replaceAll('\r\n', '\n');
  const updated = replaceReplayProductExample(html, renderReplayProductExample(await createReplayProductExample()));
  if (mode === '--write') { await writeFile(sourcePath, updated); console.log('Updated static product example without AI calls.'); }
  else { if (updated !== html) throw new Error('Product example is stale. Review it and regenerate with --write.'); console.log('Product example matches the current fictional facts and coaching contract.'); }
}

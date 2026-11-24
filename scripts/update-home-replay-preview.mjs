import {readFileSync,writeFileSync} from 'node:fs';
import {createReplaySamples} from '../src/domains/stats/sudden-attack/replay/domain/replay-samples.js';
import {buildReplayPlayback} from '../src/domains/stats/sudden-attack/replay/domain/replay-playback.js';
import {getReplayAdvantagePaths} from '../src/domains/stats/sudden-attack/replay/ui/replay-playback.js';

// Development-only static generation. The home browser never imports this engine.
const sourcePath=new URL('../index.html',import.meta.url);
const raw=JSON.parse(await createReplaySamples()[0].text()),model=buildReplayPlayback(raw);
if(model.metric!=='match-estimate'||model.verifiedRounds!==model.rounds.length||model.rounds.at(-1).points.at(-1).phase!=='finished')
  throw new Error('Home preview requires a complete verified ranked sample');
const paths=getReplayAdvantagePaths(model).map(path=>`<path class="home-preview-line" stroke="url(#home-preview-advantage)" d="${path}"/>`).join('');
const before=readFileSync(sourcePath,'utf8');
const marker=/<!-- HOME_REPLAY_PREVIEW_BEGIN -->[\s\S]*?<!-- HOME_REPLAY_PREVIEW_END -->/;
const initial=/(?:<path class="home-preview-line"[^>]+\/>\s*)+/;
const target=marker.test(before)?marker:initial;
if(!target.test(before))throw new Error('Home preview insertion point not found');
let after=before.replace(target,`<!-- HOME_REPLAY_PREVIEW_BEGIN -->\n                        ${paths}\n                        <!-- HOME_REPLAY_PREVIEW_END -->`);
const summary=raw.replay_info.replayMatchSummaryInfo;
after=after.replace(/(<strong><span>A팀 <b>)\d+(<\/b><\/span><i>:<\/i><span><b>)\d+(<\/b> B팀<\/span><\/strong>)/,
  (_,a,b,c)=>`${a}${summary.teamAWinCnt}${b}${summary.teamBWinCnt}${c}`);
after=after.replace(/(<div class="home-preview-axis-title"><span>)[^<]*(<\/span>)/,
  '$1A팀 기준 경기 승리 추정치 (%)$2');
after=after.replace(/(<svg data-home-preview-chart)[^>]*>/,
  '<svg data-home-preview-chart data-home-preview-metric="match-estimate" viewBox="0 0 1000 240" preserveAspectRatio="none" role="img" aria-label="가상 랭크전의 경기 승리 추정치. 전후반과 조기 종료를 반영합니다. 50 위는 A팀 우세, 아래는 B팀 우세입니다. 동등 전력 가정이며 실측 승률이 아닙니다.">');
after=after.replace(/(<p class="home-preview-caption">)[^<]*(<\/p>)/,
  '$1가상 경기 · 내 전적이 아닙니다. 동등 전력 가정 · 실측 승률 아님.$2');
if(after===before){console.log('Home replay preview matches the current fictional single sample.');}
else if(process.argv.includes('--write')){writeFileSync(sourcePath,after);console.log('Updated home preview from the verified fictional single sample. Run the site build next.');}
else {console.error('Home replay preview needs regeneration: node scripts/update-home-replay-preview.mjs --write');process.exitCode=1;}

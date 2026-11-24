import { escapeHtml } from '../../../../shared/html.js?v=d181848c5b3c';
import { getPlaybackFrame, findPlaybackTurningPoints, getPlaybackEventWindow, createReplayPlaybackShare, resolvePlaybackMomentTarget } from '../domain/replay-playback.js?v=bc9d6a4e5b8c';

const x = (time, total) => 2 + 996 * time / total;
const y = index => 238 - 2.36 * index;
const fixed = value => Number(value.toFixed(2));
const clock = ms => `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${(ms % 60000 / 1000).toFixed(1).padStart(4, '0')}`;
const bombLabels = { none: '설치 기록 없음', dropped: '폭탄 드롭 기록', planted: 'C4 설치됨', defused: 'C4 해제', exploded: '폭파 기록', unknown: '폭탄 상태 확인 보류' };
const eventLabel = e => e.type === 'kill' ? `${e.attacker} → ${e.victim} · ${e.weapon}` : e.type==='bomb-death'?`C4 폭발 사망 · ${e.victim}`:`${({plant:'C4 설치',defuse:'C4 해제',explode:'폭파',drop:'폭탄 드롭',leave:'이탈',rejoin:'재입장 · 생존 확인',join:'입장 · 생존 확인'})[e.type]} · ${e.actor}`;
export function getReplayAdvantagePaths(model) {
  return model.rounds.filter(r => r.indexVerified).map(round => {
    let result = '';
    for (const point of round.points) {
      const px = fixed(x(round.startMs + point.timeMs, model.durationMs)), py = fixed(y(point.indexA));
      result += result ? ` H${px} V${py}` : `M${px},${py}`;
    }
    return result;
  });
}

export function renderReplayPlayback(model) {
  const heading = '<div class="section-heading"><h2 id="playback-title">경기 흐름 재생</h2><p>라운드를 선택하면 그래프와 해당 시점의 기록이 함께 바뀝니다.</p></div>';
  if (model.status !== 'ready') return `<section id="replayPlayback" class="panel replay-playback" aria-labelledby="playback-title">${heading}<p class="playback-warning">라운드 시간이나 순서를 확인할 수 없어 흐름 재생을 보류합니다. 기존 분석 결과는 계속 이용할 수 있습니다.</p></section>`;
  const matchEstimate = model.metric === 'match-estimate';
  const metricName = matchEstimate ? '경기 승리 추정치' : '상황 우세 지수';
  const unit = matchEstimate ? '%p' : '점';
  const lines = getReplayAdvantagePaths(model).map(path => `<path class="playback-line" stroke="url(#playback-advantage-gradient)" d="${path}"/>`).join(''), partial = model.rounds.filter(r => !r.indexVerified);
  const turningPoints = findPlaybackTurningPoints(model);
  const players = new Map();
  for (const r of model.rounds) for (const p of r.roster) if (p.id && !players.has(p.id)) players.set(p.id, p);
  const playerOptions = [...players.values()].map((p,i) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)} · 선수 ${i+1}</option>`).join('');
  const markers = turningPoints.map((p, i) => `<g class="playback-turn-marker" aria-hidden="true"><line x1="${fixed(x(p.timeMs,model.durationMs))}" x2="${fixed(x(p.timeMs,model.durationMs))}" y1="0" y2="240"/><text x="${fixed(x(p.timeMs,model.durationMs))}" y="14" text-anchor="middle">${i+1}</text></g>`).join('');
  const bookmarks = turningPoints.length ? `<div class="playback-turning"><p id="playback-turning-label">주요 변화 <span>장면 5초 전으로 이동 · ${matchEstimate?'추정치':'지수'} 변화 기준</span></p><div role="group" aria-labelledby="playback-turning-label">${turningPoints.map((p,i)=>`<button type="button" data-playback-turn="${p.seekMs}" title="${escapeHtml(p.events.map(eventLabel).join(' / '))}" aria-label="주요 변화 ${i+1}, ${p.roundNo}라운드 ${clock(p.localMs)}, ${p.deltaA>0?'A':'B'}팀 ${matchEstimate?'추정치':'지수'} ${p.magnitude.toFixed(1)}${unit} 상승, 장면 최대 5초 전으로 이동"><b>${i+1}. ${p.roundNo}R · ${clock(p.localMs)}</b><span>${p.deltaA>0?'A':'B'}팀 +${p.magnitude.toFixed(1)}${unit}</span></button>`).join('')}</div></div>` : `<p class="playback-turning-empty">주요 변화: 검증된 사건 중 ${matchEstimate?'추정치가 8%p':'지수가 8점'} 이상 바뀐 장면이 없습니다.</p>`;
  const bands = partial.map(r => `<rect class="playback-gap" x="${fixed(x(r.startMs,model.durationMs))}" y="0" width="${fixed(996*r.durationMs/model.durationMs)}" height="240"/>`).join('');
  const grid = [0,25,50,75,100].map(n=>`<line class="${n===50?'playback-balance':'playback-grid'}" x1="0" x2="1000" y1="${y(n)}" y2="${y(n)}"/>`).join('');
  const boundaries = model.rounds.slice(1).map(r=>`<line class="playback-boundary" x1="${fixed(x(r.startMs,model.durationMs))}" x2="${fixed(x(r.startMs,model.durationMs))}" y1="0" y2="240"/>`).join('');
  const roundPicker = model.rounds.map(r => `<button type="button" data-playback-round-jump="${r.index}" data-winner="${r.winner}" aria-pressed="false" aria-label="${r.no}라운드로 이동, ${r.winner===0?'A팀 승리':r.winner===1?'B팀 승리':'결과 확인 보류'}">${r.no}R</button>`).join('');
  const stride = Math.ceil(model.rounds.length/8), labels = model.rounds.filter((_,i)=>i%stride===0).map(r=>`<span style="left:${Math.max(3,Math.min(97,(r.startMs+r.durationMs/2)/model.durationMs*100))}%">${r.no}R</span>`).join('');
  return `<section id="replayPlayback" class="panel replay-playback" aria-labelledby="playback-title" tabindex="-1">${heading}
    <div class="playback-top"><div><span class="playback-side-0">A팀</span><strong data-playback-score>0 : 0</strong><span class="playback-side-1">B팀</span></div><p><strong data-playback-round>1라운드</strong> · <output data-playback-time aria-live="off">00:00.0</output></p></div>
    <div class="playback-workspace"><div class="playback-main">
    <div class="playback-chart-heading"><div><h3>A팀 기준 ${metricName}${matchEstimate?' (%)':' (점)'}</h3><p data-playback-dominance>50 = 균형</p></div><div class="playback-index"><span>A팀 <b data-playback-index-a>—</b></span><span>B팀 <b data-playback-index-b>—</b></span></div></div>
    <div class="playback-plot"><div class="playback-axis" aria-hidden="true"><span>100</span><span>75</span><span>50</span><span>25</span><span>0</span></div>
      <svg data-playback-chart viewBox="0 0 1000 240" preserveAspectRatio="none" role="img" aria-labelledby="playback-chart-title playback-chart-desc"><title id="playback-chart-title">A팀 기준 한 개 선으로 보는 ${metricName}</title><desc id="playback-chart-desc">가로축은 누적 라운드 시간, 세로축은 0부터 100의 A팀 ${matchEstimate?'경기 승리 추정치(%)':'지수'}입니다. 50보다 높으면 A팀 우세, 낮으면 B팀 우세이며 50은 균형입니다. ${matchEstimate?'동등한 전력을 가정한 참고 추정치이며 실측 승률이 아닙니다.':'승리 확률이 아닙니다.'} 검증이 보류된 구간은 비워 두었습니다. 시간 이동 슬라이더로 같은 장면을 선택할 수 있습니다.</desc><defs><linearGradient id="playback-advantage-gradient" x1="0" y1="2" x2="0" y2="238" gradientUnits="userSpaceOnUse"><stop offset="50%" style="stop-color:var(--r-cyan)"/><stop offset="50%" style="stop-color:var(--r-red)"/></linearGradient><clipPath id="playback-progress-clip"><rect data-playback-clip x="0" y="0" width="2" height="240"/></clipPath></defs>${bands}<rect class="playback-round-band" data-playback-round-band x="0" y="0" width="0" height="240"/>${grid}${boundaries}${markers}<g class="playback-future">${lines}</g><g clip-path="url(#playback-progress-clip)">${lines}</g><line data-playback-cursor class="playback-cursor" x1="2" x2="2" y1="0" y2="240"/><circle data-playback-dot-a class="playback-dot" data-side="balanced" cx="2" cy="120" r="5"/></svg>
      <div class="playback-round-labels" aria-hidden="true">${labels}</div></div>
    <p class="playback-legend"><span class="playback-side-0">50 위: A팀 우세 ↑</span><span class="playback-side-1">50 아래: B팀 우세 ↓</span><span>${matchEstimate?'동등 전력 가정 · 실측 승률 아님':'참고 지수 · 승리 확률 아님'}</span><span>옅은 선: 전체 기록 · 진한 선: 현재 시점까지</span></p>
    <div class="playback-round-picker" role="group" aria-label="재생할 라운드 바로가기">${roundPicker}</div>
    <label class="playback-seek-label">재생 위치 <output data-playback-total aria-live="off">00:00.0 / ${clock(model.durationMs)}</output><input data-playback-seek type="range" min="0" max="${model.durationMs}" step="1" value="0" aria-label="경기 재생 위치"></label>
    <div class="playback-controls"><button type="button" data-playback-action="previous" aria-label="이전 라운드">이전</button><button type="button" class="playback-primary" data-playback-action="play" aria-pressed="false">재생</button><button type="button" data-playback-action="next" aria-label="다음 라운드">다음</button><label>속도 <select data-playback-speed aria-label="재생 속도"><option value="1">1배</option><option value="2">2배</option><option value="4">4배</option></select></label><label>라운드 <select data-playback-round-select aria-label="재생 라운드">${model.rounds.map(r=>`<option value="${r.index}">${r.no}라운드</option>`).join('')}</select></label><button type="button" data-share-playback title="이 시점에서 멈추고 경기 흐름과 사건 기록을 이미지로 만듭니다">이 시점 이미지</button></div>
    <p class="playback-state" data-playback-state role="status" aria-live="polite">일시정지 · 재생을 누르면 시작합니다.</p>
    <p class="playback-warning" data-playback-warning ${partial.length?'':'hidden'}>상태 확인 보류: ${partial.map(r=>`${r.no}R`).join(', ')}. 재입장·누락·알 수 없는 기록이 있는 구간의 인원 또는 지수는 표시하지 않습니다.</p>
    </div><aside class="playback-aside" aria-label="현재 시점 선수와 사건">
    <section class="playback-scene" aria-labelledby="playback-scene-title"><div class="playback-scene-head"><div><span>선택한 장면</span><time data-playback-scene-time>—</time></div><h3 id="playback-scene-title" data-playback-scene-title>라운드 시작</h3></div><div class="playback-scene-body"><p class="playback-moment-context" data-playback-moment-context role="status" aria-live="polite" hidden></p><p data-playback-scene-body>선택 시점까지 기록된 사건을 확인합니다.</p><div class="playback-scene-teams">${[0,1].map(side=>`<div class="playback-scene-team" data-side="${side}"><p><span>${side?'B':'A'}팀 생존</span><strong data-playback-alive-${side?'b':'a'}>—</strong></p><div class="playback-alive-track" data-playback-alive-track-${side?'b':'a'} aria-hidden="true"><i data-playback-alive-bar-${side?'b':'a'}></i></div></div>`).join('')}</div></div></section>
    ${bookmarks}
    <details class="playback-detail"><summary>선수·사건 기록 <span>명단 · 기록 필터</span></summary><div class="playback-detail-content">
    <div class="playback-sides"><article><h3 class="playback-side-0">A팀 </h3><ul data-playback-roster-a></ul></article><article><h3 class="playback-side-1">B팀 </h3><ul data-playback-roster-b></ul></article></div>
    <div class="playback-events"><div><h3>현재 라운드 사건 기록</h3><span data-playback-bomb></span></div><label class="playback-event-filter">선수 <select data-playback-player-filter aria-label="사건 기록 선수 필터" aria-describedby="playback-event-filter-help"><option value="">전체 선수</option>${playerOptions}</select></label><p id="playback-event-filter-help">이탈·재입장 포함 · 폭탄은 선수 식별 확인 시 포함</p><p data-playback-event-count></p><ol data-playback-events tabindex="0" aria-label="현재 라운드 사건 목록"></ol></div>
    </div></details></aside></div>
    <details class="playback-method"><summary>${matchEstimate?'경기 승리 추정치 계산 기준 · 실측 승률이 아닙니다':'지수 계산 기준 · 승리 확률이 아닙니다'}</summary>${matchEstimate?'<p>랭크전은 전반·후반 각각 3선승으로 계산합니다. 전반 한 팀이 3승하면 공수교대하고, 후반에 뒤진 팀이 남은 라운드를 모두 이겨도 합산 동점을 만들 수 없으면 즉시 승리 확정입니다. 합산 동점으로 후반이 끝나면 골든라운드로 갑니다. 현재까지 종료된 라운드만 반영하며 최종 결과를 미리 사용하지 않습니다.</p><p>현재 라운드의 A팀 승리 가정값은 중립 50에 생존 인원 차이/초기 큰 팀 인원×40, C4 설치 시 공격팀 방향 10을 더해 5~95%로 제한합니다. 이 값은 학습·검증한 확률이 아닙니다. 이후 모든 라운드는 양 팀 50%를 가정해 가능한 결과를 합산합니다. 라운드 종료 시 현재 보정을 제거하고 기록된 승패를 적용합니다. 승리 확정 시에만 100%·0%를 표시하며, 진행 중에는 0.1~99.9%로 표시합니다. 체력·시야·맵별 공수 유불리는 반영하지 않는 참고 추정치입니다.</p>':'<p>경기 규칙이 확인되지 않은 유형은 기존 상황 우세 지수를 표시합니다. 생존 인원 차이 최대 40점, 이미 종료된 라운드 점수 비율 차이 최대 10점, 기록된 C4 설치 상태 10점을 중립값 50에 반영하고 5~95로 제한합니다. A팀과 B팀 지수의 합은 100입니다. 실측 승리 확률이나 AI 예측이 아니며, 시야·체력·음성 대화는 반영하지 않습니다.</p>'}<p>사건 사이에는 마지막으로 확인된 상태를 유지하고, 검증이 어려운 구간은 계산을 보류합니다.</p><p>주요 변화는 검증된 라운드에서 같은 시각의 사건 전후로 ${matchEstimate?'추정치가 8%p':'지수가 8점'} 이상 바뀐 장면 중 라운드별 최대 1개, 경기 전체 최대 3개를 고른 것입니다. 변화가 같으면 먼저 발생한 장면을 고릅니다. 라운드 종료 점수 반영과 라운드 초기화는 제외하며 실제 승부처나 승리 원인을 뜻하지 않습니다. 버튼을 누르면 재생을 멈추고 해당 라운드 안에서 장면 최대 5초 전으로 이동합니다.</p><p>이탈·재입장은 선수별 상태 기록과 처치·입장 시각, 최종 처치/사망 합계를 대조해 복원합니다. 사망 뒤 이탈은 생존 인원을 다시 줄이지 않고, 이탈 후 생존 상태가 확인될 때만 다시 참여한 인원으로 반영합니다. 이탈 요약 표시만으로 시각을 추측하지 않습니다. 명시적 재입장 시각과 생존 표본이 일치하면 입장 전 표본은 참가 인원으로 세지 않습니다. 설치·폭발·사망 기록이 대조된 C4 시스템 사망은 인원만 줄이고 일반 킬/데스에는 더하지 않습니다. 복원 근거가 부족한 라운드는 계속 보류하며 통계·AI 해설의 검증 범위는 재생과 다를 수 있습니다.</p></details></section>`;
}

export function mountReplayPlayback(root, model) {
  if (!root || model.status !== 'ready') return { dispose() {}, pause() {}, seekToScene() { return false; }, seekToMoment() { return false; }, captureShareFrame() { return null; } };
  const $ = selector => root.querySelector(selector), controller = new AbortController();
  const on = (target,type,handler) => target.addEventListener(type,handler,{signal:controller.signal});
  const seek = $('[data-playback-seek]'), play = $('[data-playback-action="play"]'), filter = $('[data-playback-player-filter]');
  let time = 0, playing = false, speed = 1, raf = 0, last = 0, lastPaint = 0, rosterKey = '', eventKey = '', sceneKey = '', activeRound = -1, playerId = null, preferredRoundNo = null, disposed = false, current, selectedMomentRound = null;
  const momentContext = $('[data-playback-moment-context]');
  function clearMoment() { selectedMomentRound = null; momentContext.hidden = true; momentContext.textContent = ''; }
  const state = text => { $('[data-playback-state]').textContent = text; };
  function pause(text='일시정지') { playing=false;cancelAnimationFrame(raf);raf=0;last=0;play.textContent='재생';play.setAttribute('aria-pressed','false');state(text); }
  function paint() {
    const frame = getPlaybackFrame(model,time,preferredRoundNo); if (!frame) return; current=frame;
    const r=frame.round, px=fixed(x(time,model.durationMs));
    if(selectedMomentRound !== null && selectedMomentRound !== r.no)clearMoment();
    seek.value=String(Math.round(time));seek.setAttribute('aria-valuetext',`${r.no}라운드 ${clock(frame.localMs)}, 전체 ${clock(time)}`);
    $('[data-playback-time]').textContent=clock(frame.localMs);$('[data-playback-total]').textContent=`${clock(time)} / ${clock(model.durationMs)}`;
    const matchEstimate = model.metric === 'match-estimate';
    const phase = ({first:'전반',second:'후반',golden:'골든라운드',finished:'승리 확정',unknown:'규칙 확인 보류'})[frame.phase];
    $('[data-playback-round]').textContent=`${r.no}라운드${matchEstimate?` · ${phase}`:time===model.durationMs?' · 종료':''}`;
    $('[data-playback-round-select]').value=String(r.index);
    $('[data-playback-scene-time]').textContent=`${r.no}R · ${clock(frame.localMs)}`;
    const band=$('[data-playback-round-band]');band.setAttribute('x',String(fixed(x(r.startMs,model.durationMs))));band.setAttribute('width',String(fixed(996*r.durationMs/model.durationMs)));
    if(activeRound!==r.index){
      activeRound=r.index;
      for(const button of root.querySelectorAll('[data-playback-round-jump]'))button.setAttribute('aria-pressed',String(Number(button.dataset.playbackRoundJump)===r.index));
      const picker=$('.playback-round-picker'),selected=picker.querySelector('[aria-pressed="true"]');
      if(selected){const item=selected.getBoundingClientRect(),bounds=picker.getBoundingClientRect();if(item.left<bounds.left)picker.scrollLeft-=bounds.left-item.left;else if(item.right>bounds.right)picker.scrollLeft+=item.right-bounds.right;}
    }
    const nextSceneKey=`${r.index}:${frame.eventCount}:${frame.localMs===r.durationMs}:${frame.alive===null}:${frame.indexA===null}`;
    if(sceneKey!==nextSceneKey){
      sceneKey=nextSceneKey;
      const latest=frame.events[0],ended=frame.localMs===r.durationMs;
      const simultaneous=latest?r.events.filter(e=>e.timeMs===latest.timeMs):[];
      const title=ended?(frame.finished?'경기 기록 종료':'라운드 종료'):latest?(simultaneous.length>1?`같은 시각에 기록된 사건 ${simultaneous.length}건`:eventLabel(latest)):'기록된 사건 없음';
      const body=ended?(frame.score?`현재까지 합산 ${frame.score[0]} : ${frame.score[1]}`:'합산 점수 확인 보류'):latest?`마지막 사건 · ${clock(latest.timeMs)}${simultaneous.length>1?' · 순서를 추정하지 않습니다.':''}`:'선택 시점까지 기록된 사건이 없습니다.';
      $('[data-playback-scene-title]').textContent=title;
      $('[data-playback-scene-body]').textContent=body+(frame.alive===null?' · 생존 인원 확인 보류':frame.indexA===null?' · 그래프 수치 확인 보류':'');
    }
    $('[data-playback-score]').textContent=frame.score?`${frame.score[0]} : ${frame.score[1]}`:'점수 확인 보류';
    $('[data-playback-index-a]').textContent=frame.indexA===null?'확인 보류':`${frame.indexA.toFixed(1)}${matchEstimate?'%':'점'}`;
    $('[data-playback-index-b]').textContent=frame.indexA===null?'확인 보류':`${(100-frame.indexA).toFixed(1)}${matchEstimate?'%':'점'}`;
    $('[data-playback-cursor]').setAttribute('x1',String(px));$('[data-playback-cursor]').setAttribute('x2',String(px));$('[data-playback-clip]').setAttribute('width',String(px));
    $('[data-playback-dominance]').textContent=frame.indexA===null?'계산 확인 보류':`${matchEstimate?'경기 승리 추정 · ':''}${frame.indexA===50?'균형':frame.indexA>50?'A팀 우세':'B팀 우세'} · 50 = 균형`;
    const dot=$('[data-playback-dot-a]');dot.style.display=frame.indexA===null?'none':'';dot.setAttribute('cx',String(px));
    if(frame.indexA!==null){dot.setAttribute('cy',String(fixed(y(frame.indexA))));dot.dataset.side=frame.indexA===50?'balanced':frame.indexA>50?'a':'b';}
    $('[data-playback-action="previous"]').disabled=r.index===0;
    $('[data-playback-action="next"]').disabled=r.index===model.rounds.length-1;
    for(const side of [0,1])$(`[data-playback-alive-${side?'b':'a'}]`).textContent=frame.alive?`${frame.alive[side]} / ${r.initial[side]}명 · ${r.offense===side?'공격':'수비'}`:'인원 확인 보류';
    for(const side of [0,1]){const suffix=side?'b':'a',track=$('[data-playback-alive-track-'+suffix+']');track.hidden=frame.alive===null||r.initial[side]<=0;if(!track.hidden)$('[data-playback-alive-bar-'+suffix+']').style.width=(100*frame.alive[side]/r.initial[side])+'%';}
    const key=`${r.index}:${frame.aliveIds?.join(',') ?? '?'}:${frame.eventCount}:${frame.bomb}`;
    if(key!==rosterKey){rosterKey=key;
      for(const side of [0,1])$(`[data-playback-roster-${side?'b':'a'}]`).innerHTML=r.roster.filter(p=>p.team===side).map(p=>{const alive=frame.aliveIds===null?null:frame.aliveIds.includes(p.id),left=frame.leftIds.includes(p.id),pending=frame.pendingIds.includes(p.id);return `<li data-state="${alive===null?'unknown':pending?'pending':left?'left':alive?'alive':'dead'}"><span aria-hidden="true">${alive===null?'?':pending?'…':left?'−':alive?'●':'○'}</span><b>${escapeHtml(p.name)}</b><small>${alive===null?'미확인':pending?'입장 전':left?'이탈':alive?'생존':'사망'}</small></li>`;}).join('');
      $('[data-playback-bomb]').textContent=bombLabels[frame.bomb];
    }
    const nextEventKey=JSON.stringify([r.index,frame.eventCount,playerId]);
    if(nextEventKey!==eventKey){eventKey=nextEventKey;
      const visible=getPlaybackEventWindow(r,frame.localMs,playerId);
      $('[data-playback-event-count]').textContent=`${visible.count} / ${visible.total}건${playerId===null?'':' · 선택 선수'} · 최근 12건까지 표시`;
      $('[data-playback-events]').innerHTML=visible.events.length?visible.events.map(e=>`<li data-side="${e.side}"><time>${clock(e.timeMs)}</time><span>${escapeHtml(eventLabel(e))}</span></li>`).join(''):`<li>${playerId===null?'현재 시점까지 기록된 사건이 없습니다.':'현재 라운드의 이 시점까지 선택 선수로 확인된 사건이 없습니다.'}</li>`;
    }
  }
  function tick(stamp){if(!playing)return;if(document.hidden){pause('화면이 숨겨져 재생을 멈췄습니다.');return;}if(last)time=Math.min(model.durationMs,time+Math.max(0,Math.min(250,stamp-last))*speed);last=stamp;if(stamp-lastPaint>=100||time===model.durationMs){paint();lastPaint=stamp;}if(time===model.durationMs){pause('재생 완료');return;}raf=requestAnimationFrame(tick);}
  function move(value){clearMoment();preferredRoundNo=null;time=Math.max(0,Math.min(model.durationMs,value));last=0;paint();if(time===model.durationMs)pause('재생 완료');}
  function start(){if(time===model.durationMs)move(0);playing=true;last=0;play.textContent='일시정지';play.setAttribute('aria-pressed','true');state(`${speed}배속 재생 중`);raf=requestAnimationFrame(tick);}
  on(root,'click',event=>{const roundButton=event.target.closest('[data-playback-round-jump]');if(roundButton){const round=model.rounds[Number(roundButton.dataset.playbackRoundJump)];if(round)move(round.startMs);return;}const bookmark=event.target.closest('[data-playback-turn]');if(bookmark){pause('주요 변화 직전 · 재생을 누르면 이어집니다.');move(Number(bookmark.dataset.playbackTurn));return;}const action=event.target.closest('[data-playback-action]')?.dataset.playbackAction;if(!action)return;
    if(action==='play'){if(playing)pause();else start();}
    if(action==='previous')move(model.rounds[Math.max(0,current.round.index-1)].startMs);
    if(action==='next')move(model.rounds[Math.min(model.rounds.length-1,current.round.index+1)].startMs);
  });
  on(seek,'input',()=>move(Number(seek.value)));
  on(filter,'change',()=>{playerId=filter.value||null;paint();});
  on(seek,'keydown',event=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();move(time+(['ArrowRight','ArrowUp'].includes(event.key)?100:-100));}});
  on($('[data-playback-speed]'),'change',event=>{const value=Number(event.target.value);if([1,2,4].includes(value)){speed=value;last=0;if(playing)state(`${speed}배속 재생 중`);}});
  on($('[data-playback-round-select]'),'change',event=>{const r=model.rounds[Number(event.target.value)];if(r)move(r.startMs);});
  on($('[data-playback-chart]'),'click',event=>{const bounds=$('[data-playback-chart]').getBoundingClientRect();if(bounds.width>0)move(((event.clientX-bounds.left)/bounds.width*1000-2)/996*model.durationMs);});
  on(document,'visibilitychange',()=>{if(document.hidden&&playing)pause('화면이 숨겨져 재생을 멈췄습니다.');});
  on(window,'pagehide',()=>pause());
  paint();
  return {
    dispose(){disposed=true;pause();controller.abort();},
    pause(){if(!disposed)pause();},
    captureShareFrame(){
      if(disposed)return null;
      pause('이미지에 담을 시점 · 일시정지');
      paint();
      return createReplayPlaybackShare(model,time,preferredRoundNo);
    },
    seekToScene(target){
      const round=model.rounds.find(r=>r.no===target?.roundNo);
      if(disposed||!round?.aliveVerified||!Number.isSafeInteger(target.localMs)||target.localMs<0||target.localMs>round.durationMs)return false;
      clearMoment();
      pause('해설 근거 시점 · 일시정지 · 전체 선수 사건 표시');
      preferredRoundNo=round.no;time=round.startMs+target.localMs;playerId=null;filter.value='';last=0;paint();
      return true;
    },
    seekToMoment(moment, selectedPlayerId){
      if(disposed)return false;
      const target=resolvePlaybackMomentTarget(model,moment,selectedPlayerId);
      if(!target)return false;
      const round=model.rounds.find(r=>r.no===target.roundNo);
      pause();selectedMomentRound=round.no;preferredRoundNo=round.no;
      time=round.startMs+target.localMs;playerId=null;filter.value='';last=0;
      momentContext.textContent=`복기 중 · ${moment.title} · 근거 ${clock(target.anchorMs)} · ${((target.anchorMs-target.localMs)/1000).toFixed(1)}초 전부터 재생`;
      momentContext.hidden=false;paint();start();return true;
    },
  };
}

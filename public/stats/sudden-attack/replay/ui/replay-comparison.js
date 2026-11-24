import { escapeHtml } from '../../../../shared/html.js?v=d181848c5b3c';
import { createReplayComparisonSession } from '../application/replay-comparison-session.js?v=0e3e5d9dca35';
import { renderReplayProgressControls, renderReplayProgressReport } from './replay-progress.js?v=31739df24c0e';

const fixed=(n,d=1)=>n.toFixed(d);
const issues={invalid:'JSON 형식·파일 크기를 확인하지 못해 제외',unsupported:'지원 범위나 기록 구조를 확인하지 못해 제외',
  duplicate:'같은 경기 기록이라 중복 제외',conflict:'같은 경기 ID의 기록이 달라 이 파일 제외'};
const messages={empty:'비교할 JSON 파일을 2~5개 선택해 주세요.',loading:'기기 안에서 파일을 확인하고 있습니다…',
  limit:'한 번에 최대 5개까지 선택할 수 있습니다. 이전 비교는 지웠습니다.',
  insufficient:'서로 다른 경기 2개 이상에서 같은 선수 ID를 찾지 못했습니다. 파일 목록과 제외 사유를 확인해 주세요.',
  ready:'파일 확인 완료. 같은 선수 ID의 기록만 비교합니다.'};

export function renderReplayComparisonReport(report) {
  if(!report)return '';
  const aggregate=report.aggregate;
  const cells=m=>`<td>${m.kills} / ${m.deaths}</td><td>${fixed(m.killsPerRound,2)}</td><td>${m.openingDeaths} / ${m.rounds}</td><td>${fixed(m.survivedPercent)}% <small>(${m.survived}/${m.rounds})</small></td><td>${fixed(m.averageSurvivalSeconds)}초</td>`;
  const row=game=>`<tr><th scope="row"><b>${escapeHtml(game.map)}</b><small>${escapeHtml(game.date)}</small><small>${escapeHtml(game.name)}</small></th><td>${game.alias===null?'선수 없음':escapeHtml(game.alias)}</td>${game.metrics?`<td>${game.metrics.rounds} / ${game.totalRounds}</td>${cells(game.metrics)}`:`<td colspan="6">${game.status==='absent'?'이 경기에는 같은 선수 ID가 없어 집계에서 제외했습니다.':'검증된 라운드가 없어 집계에서 제외했습니다.'}</td>`}</tr>`;
  return `<p class="comparison-scope"><strong>${escapeHtml(report.player.names.join(' / '))}</strong> · 같은 선수 ID의 이름 ${report.player.names.length}개 · 집계 가능 ${report.comparedGames}/${report.games.length}경기</p>
    ${aggregate?`<div class="comparison-totals"><div><span>검증 라운드</span><strong>${aggregate.rounds} / ${report.totalRounds}</strong></div><div><span>처치 / 사망</span><strong>${aggregate.kills} / ${aggregate.deaths}</strong></div><div><span>라운드당 처치</span><strong>${fixed(aggregate.killsPerRound,2)}</strong></div><div><span>평균 생존</span><strong>${fixed(aggregate.averageSurvivalSeconds)}초</strong></div></div>`:'<p>선수 ID는 일치하지만 검증된 라운드가 없어 수치를 표시하지 않습니다.</p>'}
    <p class="comparison-note">표가 화면보다 넓으면 좌우로 밀어 나머지 지표를 확인하세요.</p>
    <div class="comparison-table-scroll" role="region" tabindex="0" aria-label="경기별 통계 비교 표, 좌우로 스크롤"><table><caption>선택한 파일 순서 · 검증된 라운드만 집계 · 시간순이나 실력 순위가 아닙니다</caption><thead><tr><th scope="col">경기</th><th scope="col">파일 속 닉네임</th><th scope="col">검증 / 제공 라운드</th><th scope="col">처치 / 사망</th><th scope="col">라운드당 처치</th><th scope="col">첫 사망 / 라운드</th><th scope="col">라운드 생존율</th><th scope="col">평균 생존</th></tr></thead><tbody>${report.games.map(row).join('')}</tbody>${aggregate?`<tfoot><tr><th scope="row" colspan="2">검증 라운드 전체 합산</th><td>${aggregate.rounds} / ${report.totalRounds}</td>${cells(aggregate)}</tr></tfoot>`:''}</table></div>
    <p class="comparison-note">검증이 안 된 라운드와 선수가 없는 경기는 0으로 채우지 않습니다. 평균·비율은 검증된 전체 라운드 기준이며, 사망 없이 끝난 라운드는 기록된 종료 시간까지 생존한 것으로 계산합니다. 첫 사망은 동시 사건에 포함될 수 있습니다. 맵·공수·상대·경기 길이가 달라 단순한 수치 차이를 실력 향상이나 코칭 효과로 단정할 수 없습니다.</p>${renderReplayProgressControls(report)}`;
}

export function mountReplayComparison(root) {
  const input=root.querySelector('[data-comparison-files]'),select=root.querySelector('[data-comparison-player]'),
    clear=root.querySelector('[data-comparison-clear]'),status=root.querySelector('[data-comparison-status]'),
    list=root.querySelector('[data-comparison-files-list]'),warnings=root.querySelector('[data-comparison-issues]'),result=root.querySelector('[data-comparison-result]');
  let optionsKey='',lastReport;
  const session=createReplayComparisonSession({onChange:view=>{
    status.textContent=view.state==='insufficient'&&view.files.length<2
      ? `비교 가능한 파일 ${view.files.length}개입니다. 파일 선택창에서 JSON 2~5개를 함께 선택해 주세요. 아래 제외 사유도 확인해 주세요.`
      :view.state==='ready'?`${view.files.length}개 경기 확인 · 공통 선수 ${view.players.length}명. 선택한 선수의 비교 결과를 아래에서 확인하세요.`:messages[view.state];
    status.dataset.state=view.state;
    const key=JSON.stringify(view.players);
    if(key!==optionsKey){optionsKey=key;select.innerHTML=view.players.length?view.players.map((p,i)=>`<option value="${escapeHtml(p.id)}">${escapeHtml(p.names.join(' / '))} · 선수 ${i+1} · ${p.games}경기</option>`).join(''):'<option value="">파일을 선택하면 공통 선수가 표시됩니다</option>';}
    select.value=view.selectedId;select.disabled=view.state!=='ready';
    list.innerHTML=view.files.map(name=>`<li>${escapeHtml(name)}</li>`).join('');
    warnings.innerHTML=view.issues.map(issue=>`<li>${escapeHtml(issue.name)}: ${issues[issue.code]}</li>`).join('');
    if(lastReport!==view.report){
      const open=result.querySelector('[data-progress-panel]')?.open;
      lastReport=view.report;result.innerHTML=renderReplayComparisonReport(view.report);
      if(open&&view.report)result.querySelector('[data-progress-panel]').open=true;
    }
    if(view.report){
      result.querySelectorAll('[data-progress-group]').forEach(control=>{control.value=view.groups[Number(control.dataset.progressGroup)];});
      result.querySelector('[data-progress-goal]').value=view.goal;
      result.querySelector('[data-progress-result]').innerHTML=renderReplayProgressReport(view.progress);
    }
    clear.disabled=view.state==='empty';
  }});
  const onFiles=()=>{void session.load(input.files);},onSelect=()=>session.select(select.value),onClear=()=>{input.value='';session.clear();};
  const onProgressChange=event=>{
    if(event.target.matches('[data-progress-group]'))session.assignGroup(Number(event.target.dataset.progressGroup),event.target.value);
    if(event.target.matches('[data-progress-goal]'))session.selectGoal(event.target.value);
  };
  const onProgressReset=event=>{if(event.target.closest('[data-progress-reset]'))session.resetProgress();};
  input.addEventListener('change',onFiles);select.addEventListener('change',onSelect);clear.addEventListener('click',onClear);session.clear();
  root.addEventListener('change',onProgressChange);root.addEventListener('click',onProgressReset);
  const dispose=()=>{session.dispose();input.removeEventListener('change',onFiles);select.removeEventListener('change',onSelect);clear.removeEventListener('click',onClear);root.removeEventListener('change',onProgressChange);root.removeEventListener('click',onProgressReset);};
  return {dispose,loadFiles(files){input.value='';return session.load(files);},selectPlayer(id){session.select(id);}};
}

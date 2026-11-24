import { escapeHtml } from '../../../../shared/html.js?v=d181848c5b3c';
import { REPLAY_PROGRESS_GOALS } from '../domain/replay-progress.js?v=f87d8ed795b7';

const groupLabels={unassigned:'미지정',before:'기준 경기',after:'이후 경기',exclude:'비교에서 제외'};
export function renderReplayProgressControls(report) {
  return `<details class="comparison-progress" data-progress-panel><summary>과제 전후 확인 <span>기준·이후 경기를 직접 지정</span></summary>
    <p class="comparison-note">해설에서 받은 과제 중 확인할 지표를 선택하고, 파일명과 경기 일시를 확인해 기준·이후 그룹을 지정하세요. 경기마다 한 그룹만 선택할 수 있습니다. 구분과 선택 지표는 현재 페이지에서만 유지합니다.</p>
    <div class="progress-controls"><label>확인할 지표<select data-progress-goal>${REPLAY_PROGRESS_GOALS.map(g=>`<option value="${g.key}">${g.label}</option>`).join('')}</select></label><button type="button" class="secondary" data-progress-reset>과제 설정 지우기</button></div>
    <div class="progress-groups">${report.games.map((g,i)=>`<label><span><b>${i+1}. ${escapeHtml(g.map)}</b><small>${escapeHtml(g.date)}</small><small>${escapeHtml(g.name)}</small></span><select data-progress-group="${i}" aria-label="${i+1}번 경기 구분">${Object.entries(groupLabels).map(([key,label])=>`<option value="${key}">${label}</option>`).join('')}</select></label>`).join('')}</div>
    <div data-progress-result></div></details>`;
}

export function renderReplayProgressReport(progress) {
  if(!progress||progress.state==='invalid')return '<p role="status">경기 구분과 지표를 다시 확인해 주세요.</p>';
  if(progress.state!=='ready')return `<p role="status">${progress.reason==='coverage'?'두 그룹 모두 검증된 라운드가 있어야 비교할 수 있습니다. 선수가 없거나 검증이 안 된 경기는 0으로 계산하지 않습니다.':'기준 경기와 이후 경기를 각각 1개 이상 지정해 주세요. 파일 순서나 날짜로 자동 지정하지 않습니다.'}</p>`;
  const format=(metric,n)=>`${n.toFixed(metric.digits)}${metric.unit==='percentage_points'?'%':metric.unit==='seconds'?'초':''}`;
  const delta=metric=>`${metric.delta>0?'+':''}${metric.delta.toFixed(metric.digits)}${metric.unit==='percentage_points'?'%p':metric.unit==='seconds'?'초':''}`;
  const denominator=(metric,group)=>metric.key==='openingDeathRate'?`${group.metrics.openingDeaths}/${group.metrics.rounds}라운드`:
    metric.key==='survivedPercent'?`${group.metrics.survived}/${group.metrics.rounds}라운드`:`${group.metrics.rounds}라운드 기준`;
  const status={toward:'선택 지표가 목표 방향으로 변했습니다.',away:'선택 지표가 목표와 반대 방향으로 변했습니다.',same:'선택 지표는 표시 정밀도에서 차이가 없습니다.',observed:'평균 생존 시간의 변화를 표시합니다. 증가 자체를 개선으로 평가하지 않습니다.'};
  const summary=group=>`집계 ${group.comparedGames}/${group.selectedGames}경기 · 검증 ${group.metrics.rounds}/${group.totalRounds}라운드`;
  return `<p class="progress-status" role="status"><strong>${escapeHtml(progress.goal.label)}</strong> · ${status[progress.direction]}</p>
    <div class="progress-coverage"><p><b>기준</b> ${summary(progress.before)}</p><p><b>이후</b> ${summary(progress.after)}</p></div>
    <p class="comparison-note">표가 넓으면 좌우로 밀어 확인하세요. 증감은 이후 − 기준이며, 비율 차이는 퍼센트포인트(%p)입니다.</p>
    <div class="comparison-table-scroll progress-table" role="region" tabindex="0" aria-label="과제 전후 지표 비교 표"><table><caption>직접 지정한 그룹의 검증 라운드 비교 · 증감은 표시 단위로 반올림</caption><thead><tr><th scope="col">지표</th><th scope="col">기준</th><th scope="col">이후</th><th scope="col">증감</th></tr></thead><tbody>${progress.changes.map(metric=>`<tr${metric.key===progress.goal.key?' class="progress-selected"':''}><th scope="row">${escapeHtml(metric.metric)}${metric.key===progress.goal.key?'<small>선택 지표</small>':''}</th><td>${format(metric,metric.before)}<small>${denominator(metric,progress.before)}</small></td><td>${format(metric,metric.after)}<small>${denominator(metric,progress.after)}</small></td><td>${delta(metric)}</td></tr>`).join('')}</tbody></table></div>
    <p class="comparison-note">기준·이후는 직접 구분한 그룹입니다. 맵·공수·상대·라운드 길이와 표본 수가 다를 수 있고, 이 수치만으로 과제 실행 여부·실력 향상·코칭 효과를 확정하지 않습니다. 같은 선수 ID의 검증된 라운드 합계로 계산하며, 경기별 평균을 단순 평균하지 않습니다.</p>`;
}

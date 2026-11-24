import { aggregateReplayComparisonGames } from './replay-comparison.js?v=6da381fddb9d';

export const REPLAY_PROGRESS_GROUPS = Object.freeze(['unassigned','before','after','exclude']);
export const REPLAY_PROGRESS_GOALS = Object.freeze([
  {key:'openingDeathRate',label:'첫 사망 비율 줄이기',metric:'첫 사망 비율',unit:'percentage_points',digits:1,direction:-1},
  {key:'survivedPercent',label:'라운드 생존율 늘리기',metric:'라운드 생존율',unit:'percentage_points',digits:1,direction:1},
  {key:'killsPerRound',label:'라운드당 처치 늘리기',metric:'라운드당 처치',unit:'kills_per_round',digits:2,direction:1},
  {key:'averageSurvivalSeconds',label:'평균 생존 시간 변화 확인',metric:'평균 생존 시간',unit:'seconds',digits:1,direction:0},
].map(Object.freeze));

// Groups are explicit user choices, never inferred from file order, timestamps
// or AI prose. Each deduplicated game belongs to at most one group.
export function compareReplayProgress(report,groups,goalKey=REPLAY_PROGRESS_GOALS[0].key) {
  const goal=REPLAY_PROGRESS_GOALS.find(g=>g.key===goalKey);
  if(!goal||!Array.isArray(report?.games)||report.games.length>5||!Array.isArray(groups)
    ||groups.length!==report.games.length||groups.some(g=>!REPLAY_PROGRESS_GROUPS.includes(g)))return {state:'invalid'};
  const summary=group=>{
    const games=report.games.filter((_,i)=>groups[i]===group);
    const result=aggregateReplayComparisonGames(games);
    return {...result,selectedGames:games.length,metrics:result.aggregate?{...result.aggregate,
      openingDeathRate:result.aggregate.openingDeaths/result.aggregate.rounds*100}:null};
  };
  const before=summary('before'),after=summary('after');
  if(!before.selectedGames||!after.selectedGames)return {state:'pending',reason:'groups',before,after,goal};
  if(!before.metrics||!after.metrics)return {state:'pending',reason:'coverage',before,after,goal};
  const changes=REPLAY_PROGRESS_GOALS.map(metric=>({...metric,before:before.metrics[metric.key],after:after.metrics[metric.key],
    delta:Number((after.metrics[metric.key]-before.metrics[metric.key]).toFixed(metric.digits))}));
  const selected=changes.find(c=>c.key===goalKey);
  const direction=selected.delta===0?'same':goal.direction===0?'observed':Math.sign(selected.delta)===goal.direction?'toward':'away';
  return {state:'ready',before,after,goal,changes,direction};
}

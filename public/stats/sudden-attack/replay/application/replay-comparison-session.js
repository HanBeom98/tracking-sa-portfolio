import { parseReplayText, validateReplayFile } from '../domain/replay-analyzer.js?v=5f9d9c6fc575';
import { MAX_COMPARISON_FILES, prepareReplayComparison, compareReplayGames } from '../domain/replay-comparison.js?v=6da381fddb9d';
import { REPLAY_PROGRESS_GROUPS, REPLAY_PROGRESS_GOALS, compareReplayProgress } from '../domain/replay-progress.js?v=f87d8ed795b7';

export function createReplayComparisonSession({ onChange = () => {} } = {}) {
  let revision=0,disposed=false,prepared=null,selectedId='',state='empty',readIssues=[];
  let groups=[],goal=REPLAY_PROGRESS_GOALS[0].key;
  const reports=new Map();
  const view=()=>({state,selectedId,players:prepared?.players??[],files:prepared?.games.map(g=>g.name)??[],
    issues:[...readIssues,...(prepared?.issues??[])],report:reports.get(selectedId)??null,groups:[...groups],goal,
    progress:reports.has(selectedId)?compareReplayProgress(reports.get(selectedId),groups,goal):null});
  const publish=()=>{if(!disposed)onChange(view());};
  function select(playerId){
    if(disposed||state!=='ready'||!prepared.players.some(p=>p.id===playerId))return;
    selectedId=playerId;if(!reports.has(playerId))reports.set(playerId,compareReplayGames(prepared,playerId));publish();
  }
  return {
    view,select,
    assignGroup(index,value){
      if(disposed||state!=='ready'||!Number.isSafeInteger(index)||index<0||index>=groups.length||!REPLAY_PROGRESS_GROUPS.includes(value))return;
      groups[index]=value;publish();
    },
    selectGoal(value){if(!disposed&&state==='ready'&&REPLAY_PROGRESS_GOALS.some(g=>g.key===value)){goal=value;publish();}},
    resetProgress(){if(!disposed){groups=groups.map(()=>'unassigned');goal=REPLAY_PROGRESS_GOALS[0].key;publish();}},
    async load(fileList){
      if(disposed)return;
      const current=++revision,files=Array.from(fileList??[]);prepared=null;selectedId='';readIssues=[];groups=[];goal=REPLAY_PROGRESS_GOALS[0].key;reports.clear();
      state=files.length?'loading':'empty';
      if(files.length>MAX_COMPARISON_FILES){state='limit';publish();return;}publish();
      if(!files.length)return;
      const entries=[],issues=[];
      for(const file of files){
        if(disposed||current!==revision)return;
        try{
          validateReplayFile(file);const content=await file.text();
          if(disposed||current!==revision)return;
          if(typeof content!=='string'||new TextEncoder().encode(content).byteLength>2*1024*1024)throw new Error();
          entries.push({name:String(file.name??'리플레이 JSON').slice(0,160),parsed:parseReplayText(content)});
        }catch{issues.push({name:String(file.name??'리플레이 JSON').slice(0,160),code:'invalid'});}
      }
      if(disposed||current!==revision)return;
      prepared=prepareReplayComparison(entries);readIssues=issues;state=prepared.players.length?'ready':'insufficient';
      groups=prepared.games.map(()=>'unassigned');
      if(state==='ready'){selectedId=prepared.players[0].id;reports.set(selectedId,compareReplayGames(prepared,selectedId));}publish();
    },
    clear(){if(disposed)return;revision++;prepared=null;selectedId='';state='empty';readIssues=[];groups=[];goal=REPLAY_PROGRESS_GOALS[0].key;reports.clear();publish();},
    dispose(){disposed=true;revision++;prepared=null;groups=[];reports.clear();},
  };
}

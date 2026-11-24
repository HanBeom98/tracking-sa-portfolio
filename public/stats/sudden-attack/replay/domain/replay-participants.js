const rows=v=>Array.isArray(v)?v:[];
const num=v=>(typeof v==='number'||typeof v==='string'&&v.trim())&&Number.isFinite(Number(v))?Number(v):null;
const key=v=>typeof v==='string'&&v.length>0&&v.length<=80?v:Number.isSafeInteger(v)&&v>=0?String(v):null;
const team=v=>num(v)===0||num(v)===1;
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);

// Playback-only recovery. The official viewer treats state3 as leaving and
// state3->1 as backfill. Summary flags alone provide no transition timestamp.
// Existing coaching/statistics validation deliberately remains separate.
export function trackReplayParticipants(raw) {
  const stop=reason=>{throw new Error(reason);};
  try{
    const duration=num(raw?.playTime),roster=rows(raw?.replayRoundSummaryInfo),characters=rows(raw?.replayCharacterInfo);
    if(duration===null||duration<=0||duration>3600||!roster.length||roster.length>64||characters.length!==roster.length
      ||!Array.isArray(raw.replayAttackInfo)||rows(raw.replayAttackInfo).length>5000
      ||raw.replayEnterInfo!=null&&!Array.isArray(raw.replayEnterInfo)||rows(raw.replayEnterInfo).length>5000)stop('participant-records-incomplete');
    const byId=new Map(),deathEvents=new Map(),killCounts=new Map(),actions=[],events=[],bombDeaths=[],initialAliveIds=[],initialLeftIds=[];
    const at=v=>{const t=num(v);if(t===null||t<0||t>duration*10+1)stop('participant-time-invalid');return Math.min(Math.round(t*100),Math.round(duration*1000));};
    for(const p of roster){
      const id=key(p?.nexonSN);
      if(!object(p)||id===null||byId.has(id)||!team(p.teamNo)||![0,1].includes(num(p.breakType??0))
        ||![0,1].includes(num(p.reJoin??0))||!Number.isSafeInteger(num(p.kill))||num(p.kill)<0
        ||!Number.isSafeInteger(num(p.death))||num(p.death)<0)stop('participant-summary-invalid');
      byId.set(id,{...p,id,side:num(p.teamNo)});
    }
    if(![0,1].every(side=>[...byId.values()].some(p=>p.side===side)))stop('participant-summary-invalid');
    // A system C4 death has no player attacker. Require its exact record code,
    // terminal explosion and preceding valid plant; never assign a human kill.
    const isBombDeath=e=>{
      if(key(e.attackerNexonSN)!=='0'||num(e.itemID)!==6104||e.itemName!=='킬타입_폭파미션 자살'
        ||!team(raw.offenseTeam)||num(raw.winTeam)!==num(raw.offenseTeam)
        ||num(e.attackerTeamNo)!==num(raw.offenseTeam)||at(e.timeStamp)!==Math.round(duration*1000)
        ||!Array.isArray(raw.replayBombInfo)||raw.replayBombInfo.length>5000)return false;
      const bombs=raw.replayBombInfo.filter(b=>object(b)&&num(b.bombEventType)!==3);
      if(bombs.length!==2)return false;
      const [plant,explosion]=[...bombs].sort((a,b)=>num(a.timeStamp)-num(b.timeStamp));
      const planter=byId.get(key(plant.nexonSN));
      return num(plant.bombEventType)===0&&planter?.side===num(raw.offenseTeam)
        &&num(plant.teamNo)===planter.side&&at(plant.timeStamp)<at(e.timeStamp)
        &&num(explosion.bombEventType)===1&&key(explosion.nexonSN)==='0'
        &&num(explosion.teamNo)===num(raw.offenseTeam)&&at(explosion.timeStamp)===at(e.timeStamp);
    };
    const attacks=raw.replayAttackInfo.map((e,index)=>{
      if(!object(e)||num(e.eventType)!==0)stop('participant-attack-invalid');
      const attacker=byId.get(key(e.attackerNexonSN)),victim=byId.get(key(e.victimNexonSN));
      const bombDeath=!attacker&&isBombDeath(e);
      if((!attacker&&!bombDeath)||!victim||attacker&&attacker.side===victim.side
        ||attacker&&e.attackerTeamNo!=null&&num(e.attackerTeamNo)!==attacker.side
        ||e.victimTeamNo!=null&&num(e.victimTeamNo)!==victim.side)stop('participant-attack-invalid');
      const attack={index,timeMs:at(e.timeStamp),attacker:attacker?.id??null,victim:victim.id,bombDeath};
      if(!deathEvents.has(victim.id))deathEvents.set(victim.id,[]);deathEvents.get(victim.id).push(attack);
      if(bombDeath)bombDeaths.push(attack);
      else killCounts.set(attacker.id,(killCounts.get(attacker.id)??0)+1);return attack;
    });
    const firstAttack=Math.min(500,...attacks.map(e=>e.timeMs));
    for(const deaths of deathEvents.values())deaths.sort((a,b)=>a.timeMs-b.timeMs||a.index-b.index);
    const entries=rows(raw.replayEnterInfo).map(e=>{
      const p=byId.get(key(e?.nexonSN));if(!object(e)||!p||e.teamNo!=null&&num(e.teamNo)!==p.side)stop('participant-entry-invalid');
      return {id:p.id,timeMs:at(e.timeStamp)};
    });
    const seen=new Set(),matchedDeaths=new Set();let stateCount=0;
    for(const character of characters){
      const id=key(character?.nexonSN),p=byId.get(id);
      if(!object(character)||!p||seen.has(id)||!Array.isArray(character.replayCharacterStateInfo)||!character.replayCharacterStateInfo.length)stop('participant-states-incomplete');
      seen.add(id);stateCount+=character.replayCharacterStateInfo.length;if(stateCount>25000)stop('participant-states-limit');
      let states=character.replayCharacterStateInfo.map(s=>{
        if(!object(s)||![1,2,3].includes(num(s.state)))stop('participant-state-unsupported');
        return {code:num(s.state),timeMs:at(s.timeStamp)};
      }).sort((a,b)=>a.timeMs-b.timeMs);
      for(let i=1;i<states.length;i++)if(states[i].timeMs===states[i-1].timeMs&&states[i].code!==states[i-1].code
        &&!(states[i-1].code===1&&states[i].code===2))stop('participant-simultaneous-state');
      // Some re-entry files prefill alive samples from the round start. An
      // explicit late entry plus a nearby alive sample gates that first life.
      // Conflicting earlier states or combat cannot be silently discarded.
      const ownEntries=entries.filter(e=>e.id===id).sort((a,b)=>a.timeMs-b.timeMs),entry=ownEntries[0];
      let gatedEntry=null;
      if(num(p.reJoin??0)===1&&entry?.timeMs>firstAttack&&states[0].code===1&&states[0].timeMs<=firstAttack
        &&states.filter(s=>s.timeMs<entry.timeMs).every(s=>s.code===1)){
        const after=states.find(s=>s.timeMs>=entry.timeMs);
        if(!after||after.code!==1||after.timeMs-entry.timeMs>500
          ||attacks.some(e=>e.timeMs<entry.timeMs&&(e.attacker===id||e.victim===id)))stop('participant-entry-invalid');
        gatedEntry=entry.timeMs;states=states.filter(s=>s.timeMs>=entry.timeMs);
      }
      const first=states[0],deaths=deathEvents.get(id)??[];let previous=first.code,returned=false,deathCursor=0;
      if(gatedEntry!==null){actions.push({type:'join',id,timeMs:gatedEntry});returned=true;}
      else if(first.code===1&&first.timeMs<=firstAttack)initialAliveIds.push(id);
      else if(first.code===3&&first.timeMs===0)initialLeftIds.push(id);
      else if(first.code===1&&entries.some(e=>e.id===id&&Math.abs(e.timeMs-first.timeMs)<=100)){
        actions.push({type:'join',id,timeMs:first.timeMs});returned=true;
      }else stop('participant-initial-unconfirmed');
      for(const state of states.slice(1)){
        if(state.code===previous)continue;
        if(state.code===1){
          if(previous!==3)stop('participant-return-unconfirmed');
          actions.push({type:'rejoin',id,timeMs:state.timeMs});returned=true;
        }else if(state.code===2){
          if(previous!==1)stop('participant-death-unconfirmed');
          const death=deaths[deathCursor++];
          if(!death||Math.abs(death.timeMs-state.timeMs)>100)stop('participant-death-unconfirmed');
          matchedDeaths.add(death.index);actions.push({type:'kill',id,timeMs:death.timeMs});
        }else actions.push({type:'leave',id,timeMs:state.timeMs});
        previous=state.code;
      }
      if(previous===1&&states.at(-1).timeMs<Math.round(duration*1000)-500)stop('participant-tail-unconfirmed');
      if(num(p.reJoin??0)===1&&!returned)stop('participant-return-unconfirmed');
      // The supplied C4 system elimination changes presence but is excluded
      // from the game's summary deaths. Ordinary deaths must still match.
      if((killCounts.get(id)??0)!==num(p.kill)||(deathEvents.get(id)??[]).filter(e=>!e.bombDeath).length!==num(p.death))stop('participant-count-mismatch');
    }
    if(matchedDeaths.size!==attacks.length)stop('participant-death-unconfirmed');
    for(const e of entries){
      if(e.timeMs<=firstAttack){if(!initialAliveIds.includes(e.id))stop('participant-entry-invalid');}
      else if(!actions.some(a=>a.id===e.id&&['join','rejoin'].includes(a.type)&&Math.abs(a.timeMs-e.timeMs)<=100))stop('participant-entry-invalid');
    }
    const initialPendingIds=actions.filter(a=>a.type==='join').map(a=>a.id);
    const alive=new Set(initialAliveIds),left=new Set(initialLeftIds),pending=new Set(initialPendingIds),transitions=[];
    const groups=new Map();for(const action of actions.sort((a,b)=>a.timeMs-b.timeMs)){
      if(!groups.has(action.timeMs))groups.set(action.timeMs,[]);groups.get(action.timeMs).push(action);
    }
    for(const [timeMs,group] of groups){
      if(new Set(group.map(a=>a.id)).size!==group.length)stop('participant-simultaneous-life');
      for(const action of group){
        if(action.type==='kill'){
          if(!alive.has(action.id))stop('participant-death-unconfirmed');alive.delete(action.id);
        }else if(action.type==='leave'){
          if(left.has(action.id))stop('participant-leave-unconfirmed');alive.delete(action.id);left.add(action.id);
        }else{
          if(alive.has(action.id)||action.type==='rejoin'&&!left.has(action.id))stop('participant-return-unconfirmed');
          left.delete(action.id);pending.delete(action.id);alive.add(action.id);
        }
        if(action.type!=='kill'){const p=byId.get(action.id);events.push({type:action.type,timeMs,actorId:action.id,side:p.side});}
      }
      transitions.push({timeMs,aliveIds:[...alive],leftIds:[...left],pendingIds:[...pending]});
    }
    return {status:'complete',initialAliveIds,initialLeftIds,initialPendingIds,events,transitions,bombDeaths};
  }catch(error){return {status:'unavailable',reason:error.message};}
}

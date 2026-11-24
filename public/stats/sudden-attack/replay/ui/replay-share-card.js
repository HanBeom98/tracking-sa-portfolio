const WIDTH = 1080;
const HEIGHT = 675;
const PLAYBACK_HEIGHT = 1080;

const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const boundedText = (value, fallback, maxLength) => String(value || fallback).trim().slice(0, maxLength);
const duration = (value) => {
  const seconds = Math.max(0, finite(value));
  const minutes = Math.floor(seconds / 60);
  return minutes ? `${minutes}분 ${Math.round(seconds % 60)}초` : `${Math.round(seconds)}초`;
};

export function createReplayShareCardModel(analysis, moments = [], pageUrl = '', { playback = null } = {}) {
  const url = new URL(pageUrl || 'https://trackingsa.com/stats/sudden-attack/replay/');
  return {
    nickname: boundedText(analysis?.player?.nickName, 'PLAYER', 80),
    mapName: boundedText(analysis?.match?.mapName, '알 수 없는 맵', 100),
    score: boundedText(analysis?.match?.score, '-', 30),
    result: analysis?.match?.won ? '승리' : '패배',
    kda: `${finite(analysis?.player?.kill)} / ${finite(analysis?.player?.death)} / ${finite(analysis?.player?.assist)}`,
    averageSurvival: duration(analysis?.totals?.averageSurvivalSeconds),
    throws: `${finite(analysis?.totals?.throws)}회`,
    moments: moments.slice(0, 2).map((moment) => ({
      label: boundedText(moment?.label, '핵심 장면', 60),
      title: boundedText(moment?.title, '', 160),
      round: finite(moment?.round),
      tone: moment?.tone === 'review' ? 'review' : 'good',
    })),
    url: `${url.origin}${url.pathname}`,
    ...(playback ? {playback} : {}),
  };
}

function roundedRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.closePath();
}

function fitText(context, text, maxWidth) {
  if (context.measureText(text).width <= maxWidth) return text;
  let low = 0;
  let high = text.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (context.measureText(`${text.slice(0, middle)}…`).width <= maxWidth) low = middle;
    else high = middle - 1;
  }
  return `${text.slice(0, low)}…`;
}

export function drawReplayShareCard(canvas, model) {
  canvas.width = WIDTH;
  canvas.height = model?.playback ? PLAYBACK_HEIGHT : HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('CANVAS_UNAVAILABLE');
  const background = context.createLinearGradient(0, 0, WIDTH, canvas.height);
  background.addColorStop(0, '#08111f');
  background.addColorStop(1, '#101d32');
  context.fillStyle = background;
  context.fillRect(0, 0, WIDTH, canvas.height);

  context.fillStyle = 'rgba(67,211,255,.08)';
  context.beginPath();
  context.arc(955, 55, 245, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = '#43d3ff';
  context.font = '900 20px "Arial", "Noto Sans KR", sans-serif';
  context.fillText(model.playback?'TRACKING SA · MATCH FLOW':'TRACKING SA · REPLAY DESK', 56, 64);
  context.fillStyle = '#f6f8fc';
  context.font = '900 46px "Arial", "Noto Sans KR", sans-serif';
  context.fillText(fitText(context, model.nickname, 590), 56, 126);
  context.fillStyle = '#9aacbf';
  context.font = '700 22px "Arial", "Noto Sans KR", sans-serif';
  const scoreSuffix=` · ${model.playback?'최종 ':''}${model.score}`;
  context.fillText(fitText(context,model.mapName,Math.max(0,968-context.measureText(scoreSuffix).width))+scoreSuffix,58,166);

  context.textAlign = 'right';
  context.fillStyle = model.result === '승리' ? '#5ee0b2' : '#ff7785';
  context.font = '900 54px "Arial", "Noto Sans KR", sans-serif';
  context.fillText(model.result, 1024, 126);
  context.textAlign = 'left';

  const metrics = [
    ['K / D / A', model.kda],
    ['평균 생존', model.averageSurvival],
    ['투척 기록', model.throws],
  ];
  metrics.forEach(([label, value], index) => {
    const x = 56 + index * 326;
    context.fillStyle = 'rgba(255,255,255,.035)';
    context.strokeStyle = 'rgba(67,211,255,.2)';
    context.lineWidth = 1.5;
    roundedRect(context, x, 208, 302, 128, 18);
    context.fill();
    context.stroke();
    context.fillStyle = '#8fa2b8';
    context.font = '800 18px "Arial", "Noto Sans KR", sans-serif';
    context.fillText(label, x + 22, 246);
    context.fillStyle = '#f6f8fc';
    context.font = '900 31px "Arial", "Noto Sans KR", sans-serif';
    context.fillText(fitText(context,value,258), x + 22, 295);
  });

  if(model.playback){drawPlayback(context,model.playback);drawFooter(context,model,1004);return canvas;}

  context.fillStyle = '#8fa2b8';
  context.font = '900 17px "Arial", "Noto Sans KR", sans-serif';
  context.fillText('KEY MOMENTS', 56, 388);
  const moments = model.moments.length ? model.moments : [{ label: '경기 요약', title: '리플레이 분석 완료', round: 0, tone: 'good' }];
  moments.forEach((moment, index) => {
    const x = 56 + index * 490;
    const accent = moment.tone === 'review' ? '#ff7785' : '#5ee0b2';
    context.fillStyle = 'rgba(255,255,255,.035)';
    roundedRect(context, x, 410, 464, 130, 17);
    context.fill();
    context.fillStyle = accent;
    context.fillRect(x, 410, 5, 130);
    context.font = '900 16px "Arial", "Noto Sans KR", sans-serif';
    context.fillText(`${moment.label}${moment.round ? ` · ${moment.round}R` : ''}`, x + 24, 450);
    context.fillStyle = '#f6f8fc';
    context.font = '900 24px "Arial", "Noto Sans KR", sans-serif';
    context.fillText(fitText(context, moment.title, 410), x + 24, 493);
  });

  drawFooter(context,model,582);
  return canvas;
}

const clock = ms => `${String(Math.floor(ms/60000)).padStart(2,'0')}:${(ms%60000/1000).toFixed(1).padStart(4,'0')}`;
function drawPlayback(context,playback) {
  const {scene}=playback,left=100,top=420,width=902,height=210;
  const x=ms=>left+width*ms/playback.durationMs,y=index=>top+height*(1-index/100);
  context.fillStyle='#f6f8fc';context.font='900 22px "Arial", "Noto Sans KR", sans-serif';
  context.fillText('경기 흐름 · 선택 시점',56,380);
  context.textAlign='right';context.fillStyle='#9aacbf';context.font='700 16px "Arial", "Noto Sans KR", sans-serif';
  context.fillText(playback.metric==='match-estimate'?'경기 승리 추정치 · 동등 전력 가정 · 실측 승률 아님':'상황 우세 지수 · 승리 확률이나 AI 예측이 아닙니다',1024,380);context.textAlign='left';
  context.fillStyle='rgba(255,255,255,.035)';roundedRect(context,56,400,968,280,14);context.fill();
  for(const r of playback.rounds)if(!r.verified){context.fillStyle='rgba(160,175,195,.13)';context.fillRect(x(r.startMs),top,x(r.endMs)-x(r.startMs),height);}
  context.font='700 13px "Arial", "Noto Sans KR", sans-serif';
  for(const n of [0,25,50,75,100]){
    context.strokeStyle=n===50?'rgba(255,255,255,.45)':'rgba(255,255,255,.1)';context.lineWidth=1;context.setLineDash(n===50?[5,5]:[]);context.beginPath();context.moveTo(left,y(n));context.lineTo(left+width,y(n));context.stroke();context.setLineDash([]);
    context.fillStyle='#8fa2b8';context.textAlign='right';context.fillText(String(n),left-12,y(n)+5);
  }
  context.textAlign='center';const stride=Math.ceil(playback.rounds.length/8);
  for(const [i,r] of playback.rounds.entries())if(i%stride===0){context.fillStyle='#8fa2b8';context.fillText(`${r.no}R`,x((r.startMs+r.endMs)/2),657);}
  const gradient=context.createLinearGradient(0,top,0,top+height);
  gradient.addColorStop(0,'#43d3ff');gradient.addColorStop(.5,'#43d3ff');gradient.addColorStop(.5,'#ff7785');gradient.addColorStop(1,'#ff7785');
  const lines=alpha=>{
    context.globalAlpha=alpha;context.lineWidth=2.5;
    for(const r of playback.rounds){
      if(!r.verified||!r.points.length)continue;
      context.strokeStyle=gradient;context.beginPath();let previous=null;
      for(const point of r.points){const value=point.indexA;
        if(previous===null)context.moveTo(x(point.timeMs),y(value));else{context.lineTo(x(point.timeMs),y(previous));context.lineTo(x(point.timeMs),y(value));}previous=value;}
      context.stroke();
    }
  };
  context.save();context.beginPath();context.rect(left,top,width,height);context.clip();lines(.2);context.restore();
  context.save();context.beginPath();context.rect(left,top,Math.max(0,x(scene.timeMs)-left),height);context.clip();lines(1);context.restore();
  context.globalAlpha=1;context.strokeStyle='#f6f8fc';context.lineWidth=1.5;context.setLineDash([4,4]);
  context.beginPath();context.moveTo(x(scene.timeMs),top);context.lineTo(x(scene.timeMs),top+height);context.stroke();context.setLineDash([]);
  if(scene.indexA!==null){
    context.fillStyle=scene.indexA===50?'#9aacbf':scene.indexA>50?'#43d3ff':'#ff7785';context.beginPath();context.arc(x(scene.timeMs),y(scene.indexA),4.5,0,Math.PI*2);context.fill();
  }
  if(!playback.rounds.some(r=>r.verified)){context.fillStyle='#d4dfec';context.font='700 20px "Arial", "Noto Sans KR", sans-serif';context.fillText('검증된 지수 구간 없음',left+width/2,top+height/2);}
  context.textAlign='left';context.font='700 16px "Arial", "Noto Sans KR", sans-serif';
  context.fillStyle='#43d3ff';context.fillText('50 위 A팀 ↑',56,710);context.fillStyle='#ff7785';context.fillText('50 아래 B팀 ↓',184,710);
  context.fillStyle='#8fa2b8';context.fillText('50=균형 · 옅은 선:전체 · 진한 선:현재 · 음영:보류',336,710);
  context.fillStyle='#f6f8fc';context.font='900 25px "Arial", "Noto Sans KR", sans-serif';
  context.fillText(`선택 시점 · ${scene.roundNo}라운드 ${clock(scene.localMs)}`,56,756);
  context.textAlign='right';context.font='800 22px "Arial", "Noto Sans KR", sans-serif';
  context.fillText(scene.score?`이 시점 점수 A ${scene.score[0]} : ${scene.score[1]} B`:'점수 확인 보류',1024,756);context.textAlign='left';
  context.fillStyle='#9aacbf';context.font='700 20px "Arial", "Noto Sans KR", sans-serif';
  context.fillText(scene.alive?`생존 인원  A팀 ${scene.alive[0]}명 · B팀 ${scene.alive[1]}명`:'생존 인원 확인 보류',56,802);
  context.textAlign='right';context.fillText(scene.indexA===null?'현재 지수 확인 보류':playback.metric==='match-estimate'?`승리 추정  A ${scene.indexA.toFixed(1)}% · B ${(100-scene.indexA).toFixed(1)}%`:`지수  A ${scene.indexA.toFixed(1)} · B ${(100-scene.indexA).toFixed(1)}`,1024,802);context.textAlign='left';
  const bomb={none:'설치 기록 없음',dropped:'폭탄 드롭 기록',planted:'C4 설치됨',defused:'C4 해제',exploded:'폭파 기록',unknown:'폭탄 상태 확인 보류'};
  context.font='700 17px "Arial", "Noto Sans KR", sans-serif';context.fillText(`폭탄 상태: ${bomb[scene.bomb]} · 이 시점까지의 최근 사건 (최대 2건)`,56,842);
  for(const [i,event] of scene.events.entries()){
    const label=event.type==='kill'?`${event.attacker} → ${event.victim} · ${event.weapon}`:event.type==='bomb-death'?`C4 폭발 사망 · ${event.victim}`:
      `${({plant:'C4 설치',defuse:'C4 해제',explode:'폭파',drop:'폭탄 드롭',leave:'이탈',rejoin:'재입장 · 생존 확인',join:'입장 · 생존 확인'})[event.type]} · ${event.actor}`;
    context.fillStyle='rgba(255,255,255,.035)';roundedRect(context,56,864+i*52,968,44,9);context.fill();
    context.fillStyle='#d4dfec';context.font='700 18px "Arial", "Noto Sans KR", sans-serif';context.fillText(fitText(context,`${clock(event.timeMs)}  ${label}`,924),78,892+i*52);
  }
  if(!scene.events.length){context.fillStyle='#8fa2b8';context.fillText('현재 시점까지 기록된 사건이 없습니다.',56,894);}
}

function drawFooter(context,model,top) {
  context.strokeStyle = 'rgba(255,255,255,.11)';
  context.beginPath();
  context.moveTo(56, top);
  context.lineTo(1024, top);
  context.stroke();
  context.fillStyle = '#718399';
  context.font = '700 16px "Arial", "Noto Sans KR", sans-serif';
  context.fillText(model.playback?'JSON 사건 기록 재구성 · 같은 장면 재생에는 원본 파일 필요':'리플레이 파일은 기기 안에서 분석됩니다.', 56, top+38);
  context.textAlign = 'right';
  context.fillText(fitText(context, model.url, model.playback?330:420), 1024, top+38);
  context.textAlign = 'left';
}

export async function createReplayShareCardBlob(model, documentRef = document) {
  await documentRef.fonts?.ready;
  const canvas = documentRef.createElement('canvas');
  drawReplayShareCard(canvas, model);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('SHARE_CARD_FAILED')), 'image/png');
  });
}

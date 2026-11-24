import { getKeyMoments } from '../domain/replay-analyzer.js?v=5f9d9c6fc575';

const escape = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const text = (value, fallback, limit = 120) => String(value || fallback).slice(0, limit);
const number = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
const seconds = value => `${number(value).toFixed(1)}초`;

// Whitelist printable facts. Never serialize the analysis, identifiers, coordinates,
// forecast, paid review, source filename or the current URL into the report.
export function createReplayPrintReportModel(analysis) {
  const rounds = analysis.rounds || [];
  const verified = rounds.filter(round => round.context?.status === 'complete');
  const kills = verified.reduce((sum, round) => sum + round.kills.length, 0);
  const deaths = verified.filter(round => round.death).length;
  return {
    nickname: text(analysis.player?.nickName, '이름 없음', 80),
    mapName: text(analysis.match?.mapName, '알 수 없는 맵'),
    date: text(analysis.match?.date, '경기 시각 기록 없음', 80),
    score: text(analysis.match?.score, '기록 없음', 30),
    result: analysis.match?.won ? '승리' : '패배',
    sample: analysis.isSample === true,
    official: {
      kills: number(analysis.player?.kill), deaths: number(analysis.player?.death),
      assists: number(analysis.player?.assist), damage: number(analysis.player?.damage),
    },
    verified: {
      rounds: verified.length, total: rounds.length, kills, deaths,
      averageSurvival: verified.length
        ? verified.reduce((sum, round) => sum + number(round.survivalSeconds), 0) / verified.length : null,
      survivalRate: verified.length ? (verified.length - deaths) / verified.length * 100 : null,
    },
    moments: getKeyMoments({ ...analysis, rounds: verified })
      .filter(moment => verified.some(round => round.round === moment.round)).map(moment => ({
      round: number(moment.round), label: text(moment.label, '주요 장면'),
      title: text(moment.title, '', 160), body: text(moment.body, '', 400),
    })),
    rounds: rounds.map(round => {
      const complete = round.context?.status === 'complete';
      return {
        round: number(round.round), complete,
        result: complete ? round.won ? '승리' : '패배' : '보류',
        side: complete ? round.offense ? '공격' : '수비' : '—',
        kills: complete ? round.kills.length : null,
        deaths: complete ? Number(Boolean(round.death)) : null,
        throws: complete ? round.throws.length : null,
        survival: complete ? number(round.survivalSeconds) : null,
      };
    }),
  };
}

export function renderReplayPrintReport(model) {
  const v = model.verified;
  const metric = (label, value) => `<div class="report-metric"><dt>${label}</dt><dd>${value}</dd></div>`;
  const rows = model.rounds.map(round => `<tr><th scope="row">${round.round}R</th><td>${round.result}</td><td>${round.side}</td><td>${round.kills ?? '—'} / ${round.deaths ?? '—'}</td><td>${round.survival === null ? '—' : seconds(round.survival)}</td><td>${round.throws ?? '—'}</td><td>${round.complete ? '확인' : '검증 보류'}</td></tr>`).join('');
  return `<article class="report-paper" aria-label="리플레이 분석 보고서">
    <div class="report-heading"><p class="report-brand">TRACKING SA · REPLAY REPORT</p><p>${model.sample ? '샘플 체험 · 가상의 경기 기록' : '공식 JSON 기반 · 규칙 기반 분석'}</p><h1>${escape(model.nickname)}의 리플레이 분석</h1><p>${escape(model.mapName)} · ${escape(model.date)}</p><p class="report-score">${escape(model.score)} · ${model.result}</p></div>
    <section aria-labelledby="report-summary-title"><h2 id="report-summary-title">경기 총계</h2><p class="report-note">공식 JSON의 선수 요약값입니다. 아래 검증 라운드 집계와 범위가 다를 수 있습니다.</p><dl class="report-metrics">${metric('공식 K / D / A', `${model.official.kills} / ${model.official.deaths} / ${model.official.assists}`)}${metric('공식 피해량', model.official.damage.toLocaleString('ko-KR'))}</dl></section>
    <section aria-labelledby="report-verified-title"><h2 id="report-verified-title">검증 라운드 기반 지표</h2><dl class="report-metrics">${metric('집계 라운드', `${v.rounds} / ${v.total}`)}${metric('처치 / 사망', v.rounds ? `${v.kills} / ${v.deaths}` : '집계 불가')}${metric('평균 생존', v.averageSurvival === null ? '집계 불가' : seconds(v.averageSurvival))}${metric('라운드 생존율', v.survivalRate === null ? '집계 불가' : `${v.survivalRate.toFixed(1)}%`)}</dl><p class="report-notice">${v.total - v.rounds ? `${v.total - v.rounds}개 라운드는 참가자 변동·누락 등으로 상황 검증을 보류했습니다. 해당 라운드는 이 집계와 주요 장면에서 제외하고 아래 표에 남깁니다.` : v.total ? '모든 라운드의 상황 기록을 확인했습니다.' : '기록된 라운드가 없습니다.'} 생존율은 사망 없이 마친 검증 라운드의 비율입니다.</p></section>
    <section aria-labelledby="report-moments-title"><h2 id="report-moments-title">다시 볼 주요 장면</h2><p class="report-note">검증된 라운드에서 처치·생존·인원 기록에 따라 선정했습니다. 실제 승부처나 플레이의 원인으로 단정하지 않습니다.</p>${model.moments.length ? model.moments.map(moment => `<div class="report-moment"><h3>${escape(moment.label)} · ${escape(moment.title)}</h3><p>${escape(moment.body)}</p></div>`).join('') : '<p>검증된 라운드가 없어 주요 장면을 선정하지 않았습니다.</p>'}</section>
    <section aria-labelledby="report-rounds-title"><h2 id="report-rounds-title">전체 라운드 요약</h2><p class="report-note">화면의 접힘·필터와 관계없이 모든 라운드를 표시합니다. 검증 보류값은 추정하지 않습니다.</p><div class="report-table-scroll" role="region" aria-label="전체 라운드 요약 표" tabindex="0"><table><thead><tr><th scope="col">라운드</th><th scope="col">결과</th><th scope="col">진영</th><th scope="col">처치 / 사망</th><th scope="col">생존 시간</th><th scope="col">투척</th><th scope="col">상황 검증</th></tr></thead><tbody>${rows || '<tr><td colspan="7">라운드 기록이 없습니다.</td></tr>'}</tbody></table></div></section>
    <div class="report-footer" role="note"><p>기록 기반 복기 자료입니다. 실제 시야·음성·의도와 투척의 인과관계를 확인한 보고서가 아닙니다. 상황 우세 지수는 실측 승리 확률이 아닙니다.</p><p>기존 무료 분석으로 기기 안에서 생성했습니다. 추가 API·AI 호출이나 서버 저장은 하지 않습니다. 출력물에는 선택 선수의 닉네임·경기 시각이 포함되므로 공유 전에 확인하세요.</p></div>
  </article>`;
}

const styles = `
#replayPrintDialog{box-sizing:border-box;width:calc(100% - 24px);max-width:900px;max-height:calc(100dvh - 32px);padding:0;border:1px solid #cbd5e1;border-radius:18px;background:#fff;color:#172033;overflow:auto;font-family:Arial,"Malgun Gothic",sans-serif;font-size:14px;line-height:1.65;color-scheme:light}
#replayPrintDialog::backdrop{background:rgba(3,10,22,.75)}
#replayPrintDialog *{box-sizing:border-box}
#replayPrintDialog .report-toolbar{position:sticky;top:0;z-index:1;padding:16px 24px;background:#f1f5f9;border-bottom:1px solid #cbd5e1;display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap}
#replayPrintDialog .report-toolbar h2{font-size:16px;margin:0}
#replayPrintDialog .report-buttons{display:flex;gap:8px}
#replayPrintDialog button{font:inherit;font-weight:bold;min-height:44px;padding:8px 14px;border:1px solid #9caabd;border-radius:8px;background:white;color:#172033;cursor:pointer}
#replayPrintDialog [data-report-print]{background:#164dbb;color:#fff;border-color:#164dbb}
#replayPrintDialog :focus-visible{outline:3px solid #2169df;outline-offset:3px}
#replayPrintDialog .report-instructions{padding:14px 24px 0;margin:0;color:#48576d;font-size:13px}
#replayPrintDialog .report-paper{padding:24px 32px;background:#fff;color:#172033;overflow-wrap:anywhere}
#replayPrintDialog .report-heading{border-bottom:3px solid #172033;padding-bottom:14px;margin-bottom:20px}
#replayPrintDialog .report-brand{font-weight:bold;font-size:12px;letter-spacing:1.5px;color:#164dbb}
#replayPrintDialog h1{font-size:26px;line-height:1.35;margin:8px 0}
#replayPrintDialog h2{font-size:18px;margin:20px 0 8px;line-height:1.4}
#replayPrintDialog h3{font-size:14px;margin:0 0 4px}
#replayPrintDialog p{margin:5px 0}
#replayPrintDialog .report-score{font-size:18px;font-weight:bold}
#replayPrintDialog .report-note{font-size:12px;color:#48576d}
#replayPrintDialog .report-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:10px 0}
#replayPrintDialog .report-metric{border:1px solid #cbd5e1;border-radius:8px;padding:9px 13px;break-inside:avoid}
#replayPrintDialog dt{font-size:12px;color:#48576d}
#replayPrintDialog dd{font-size:20px;font-weight:bold;margin:3px 0 0}
#replayPrintDialog .report-notice{border-left:3px solid #64748b;background:#f1f5f9;padding:9px 12px;font-size:12px}
#replayPrintDialog .report-moment{padding:10px 0;border-bottom:1px solid #d9e0e8;break-inside:avoid}
#replayPrintDialog .report-table-scroll{overflow-x:auto;margin-top:10px}
#replayPrintDialog table{width:100%;border-collapse:collapse;font-size:12px;min-width:560px;font-variant-numeric:tabular-nums}
#replayPrintDialog th,#replayPrintDialog td{text-align:center;padding:8px 6px;border-bottom:1px solid #cbd5e1}
#replayPrintDialog thead th{background:#edf1f6;border-top:1px solid #9caabd}
#replayPrintDialog .report-footer{border-top:1px solid #9caabd;margin-top:22px;padding-top:10px;font-size:11px;color:#48576d}
@media(max-width:600px){#replayPrintDialog .report-paper{padding:20px 16px}#replayPrintDialog .report-toolbar{padding:12px 16px}#replayPrintDialog .report-instructions{padding:12px 16px 0}#replayPrintDialog h1{font-size:22px}}
@media print{
 @page{size:A4;margin:12mm}
 html:root,body{height:auto!important;min-height:0!important;overflow:visible!important;background:#fff!important;color:#172033!important;color-scheme:light!important;margin:0!important;padding:0!important}
 body>:not(#replayPrintDialog){display:none!important}
 #replayPrintDialog{display:block!important;position:static!important;inset:auto!important;width:100%!important;max-width:none!important;height:auto!important;max-height:none!important;overflow:visible!important;border:0!important;border-radius:0!important;margin:0!important;padding:0!important;font-size:10pt;line-height:1.5}
 #replayPrintDialog::backdrop{display:none}
 #replayPrintDialog .report-toolbar,#replayPrintDialog .report-instructions{display:none!important}
 #replayPrintDialog .report-paper{padding:0!important}
 #replayPrintDialog h1{font-size:19pt;margin:5px 0}
 #replayPrintDialog h2{font-size:13pt;margin:12px 0 6px;break-after:avoid}
 #replayPrintDialog h3{font-size:10pt}
 #replayPrintDialog .report-note,#replayPrintDialog .report-notice,#replayPrintDialog dt{font-size:9pt}
 #replayPrintDialog .report-metrics{grid-template-columns:repeat(4,minmax(0,1fr))}
 #replayPrintDialog [aria-labelledby="report-summary-title"] .report-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}
 #replayPrintDialog .report-metric{padding:6px 10px}
 #replayPrintDialog dd{font-size:14pt}
 #replayPrintDialog .report-heading{padding-bottom:8px;margin-bottom:10px}
 #replayPrintDialog .report-moment{padding:7px 0}
 #replayPrintDialog .report-table-scroll{overflow:visible}
 #replayPrintDialog table{min-width:0;font-size:9pt}
 #replayPrintDialog thead{display:table-header-group}
 #replayPrintDialog th,#replayPrintDialog td{padding:5px 6px}
 #replayPrintDialog tr{break-inside:avoid}
 #replayPrintDialog .report-heading,#replayPrintDialog .report-footer{break-inside:avoid}
 #replayPrintDialog .report-footer{font-size:8pt;margin-top:12px;padding-top:8px}
}`;

export function openReplayPrintReport(analysis, { onBeforePrint = () => {}, onClose = () => {}, returnFocus = document.activeElement } = {}) {
  const dialog = document.createElement('dialog');
  dialog.id = 'replayPrintDialog';
  dialog.setAttribute('aria-labelledby', 'report-dialog-title');
  dialog.innerHTML = `<style>${styles}</style><div class="report-toolbar"><h2 id="report-dialog-title">분석 보고서 미리보기</h2><div class="report-buttons"><button type="button" data-report-print>인쇄 / PDF 저장</button><button type="button" data-report-close>닫기</button></div></div><p class="report-instructions">인쇄 창에서 대상 ‘PDF로 저장’을 선택하세요. 브라우저 머리글·바닥글을 끄면 URL 등의 자동 표시를 제외할 수 있습니다. 화면에서 표를 좌우로 밀어 확인해도 인쇄에는 전체 열이 들어갑니다.</p><p class="report-instructions" data-report-status role="status"></p>${renderReplayPrintReport(createReplayPrintReportModel(analysis))}`;
  const previousFocus = returnFocus;
  let active = true;
  let previousTitle = null;
  const restoreTitle = () => {
    if (previousTitle !== null) { document.title = previousTitle; previousTitle = null; }
  };
  const beforePrint = () => {
    if (!active) return;
    if (previousTitle === null) previousTitle = document.title;
    document.title = 'TrackingSA 리플레이 분석 보고서';
    onBeforePrint();
  };
  const close = () => {
    if (!active) return;
    active = false;
    globalThis.removeEventListener('beforeprint', beforePrint);
    globalThis.removeEventListener('afterprint', restoreTitle);
    restoreTitle();
    dialog.close();
    dialog.remove();
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    onClose();
  };
  dialog.querySelector('[data-report-close]').addEventListener('click', close);
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('close', close);
  dialog.querySelector('[data-report-print]').addEventListener('click', () => {
    try { globalThis.print(); }
    catch { dialog.querySelector('[data-report-status]').textContent = '인쇄 창을 열지 못했습니다. 브라우저 메뉴의 인쇄를 사용해 주세요.'; restoreTitle(); }
  });
  document.body.append(dialog);
  try { dialog.showModal(); }
  catch (error) { close(); throw error; }
  globalThis.addEventListener('beforeprint', beforePrint);
  globalThis.addEventListener('afterprint', restoreTitle);
  return close;
}

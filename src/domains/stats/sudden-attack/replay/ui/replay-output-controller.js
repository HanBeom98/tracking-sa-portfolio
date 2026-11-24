import { getKeyMoments } from '../domain/replay-analyzer.js';
import { createReplayShareCardBlob, createReplayShareCardModel } from './replay-share-card.js';

// Own every pending export and modal. Clear/dispose invalidate work before
// releasing resources, so an old import/PNG encoding cannot reopen a dialog.
export function createReplayOutputController({ results, getAnalysis, getPlayback, isVisible, location }, {
  loadPrint = () => import('./replay-print-report.js'),
  loadShare = () => import('./replay-image-share.js'),
  createBlob = createReplayShareCardBlob,
} = {}) {
  let disposed = false, printRevision = 0, printOperation = null, releasePrint = null, releaseShare = null, shareOperation = null;
  function closePrint() {
    printRevision++;
    const operation = printOperation; printOperation = null; operation?.restore();
    const release = releasePrint; releasePrint = null; release?.();
  }
  function closeShare() {
    const operation = shareOperation; shareOperation = null;
    operation?.restore();
    const release = releaseShare; releaseShare = null; release?.();
  }
  const current = (source, button) => !disposed && getAnalysis() === source && button.isConnected && isVisible();
  async function print(button) {
    const source = getAnalysis();
    if (disposed || !source || printOperation) return;
    const ticket = ++printRevision;
    const operation = { restore() { if (button.isConnected) button.disabled = false; } };
    printOperation = operation;
    const reportStatus = results.querySelector('[data-share-status]');
    button.disabled = true;
    if (reportStatus) reportStatus.textContent = '보고서를 준비하고 있습니다…';
    try {
      const { openReplayPrintReport } = await loadPrint();
      if (ticket !== printRevision || !current(source, button)) return;
      const release = releasePrint; releasePrint = null; release?.();
      getPlayback()?.pause();
      releasePrint = openReplayPrintReport(source, { returnFocus: button,
        onBeforePrint: () => getPlayback()?.pause(), onClose: () => { releasePrint = null; } });
      if (reportStatus) reportStatus.textContent = '';
    } catch {
      if (ticket === printRevision && current(source, button) && reportStatus) reportStatus.textContent = '보고서를 열지 못했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.';
    } finally {
      if (printOperation === operation) { printOperation = null; operation.restore(); }
    }
  }
  async function share(button) {
    const source = getAnalysis(), sourcePlayback = getPlayback();
    if (disposed || !source || shareOperation) return;
    const includePlayback = button.hasAttribute('data-share-playback');
    const snapshot = includePlayback ? sourcePlayback?.captureShareFrame() : null;
    if (includePlayback && !snapshot) return;
    const shareStatus = results.querySelector(includePlayback ? '[data-playback-state]' : '[data-share-status]');
    const original = button.innerHTML;
    const buttons = [...results.querySelectorAll('[data-share-replay], [data-share-playback]')];
    const operation = { restore() {
      buttons.forEach(item => { if (item.isConnected) item.disabled = false; });
      if (button.isConnected) button.innerHTML = original;
    } };
    shareOperation = operation;
    buttons.forEach(item => { item.disabled = true; });
    button.textContent = '카드 만드는 중…';
    if (shareStatus) shareStatus.textContent = '이미지를 만들고 있습니다…';
    try {
      const model = createReplayShareCardModel(source, getKeyMoments(source), location.href, { playback: snapshot });
      const [blob, { openReplayImageShare }] = await Promise.all([createBlob(model), loadShare()]);
      if (shareOperation !== operation || !current(source, button) || (includePlayback && getPlayback() !== sourcePlayback)) return;
      const safeName = model.nickname.replace(/[\\/:*?"<>|]/g, '_').slice(0, 60) || 'player';
      const suffix = snapshot ? `-r${snapshot.scene.roundNo}-${Math.round(snapshot.scene.localMs)}` : '';
      const file = new File([blob], `tracking-sa-replay-${safeName}${suffix}.png`, { type: 'image/png' });
      const release = releaseShare; releaseShare = null; release?.();
      releaseShare = openReplayImageShare({ blob, file, returnFocus: button, onClose: () => {
        releaseShare = null;
        if (getAnalysis() === source && shareStatus?.isConnected) shareStatus.textContent = '';
      } });
      if (shareStatus) shareStatus.textContent = '미리보기에서 이미지 복사·PNG 저장을 선택해 주세요.';
    } catch {
      if (shareOperation === operation && current(source, button) && shareStatus) shareStatus.textContent = '카드를 만들지 못했습니다. 다시 시도해 주세요.';
    } finally {
      // A canceled job must not restore the controls of a newer job.
      if (shareOperation === operation) { shareOperation = null; operation.restore(); }
    }
  }
  return { print, share, closePrint, closeShare,
    clear() { closePrint(); closeShare(); },
    dispose() { disposed = true; closePrint(); closeShare(); },
  };
}

import { createShareCardModel, formatMetric } from './share-card-model.js?v=905485ac7b61';
import { createShareCardBlob, withDeadline } from './share-card-canvas.js?v=6c66283f1c91';
import { createShareProfileImageController } from './share-profile-image.js?v=ac4ab0bf4cde';

export { createShareCardModel } from './share-card-model.js?v=905485ac7b61';
export { drawShareCard, createShareCardBlob } from './share-card-canvas.js?v=6c66283f1c91';
export { SHARE_PROFILE_IMAGE_MAX_BYTES, getShareProfileImageError, getShareProfilePlacement } from './share-profile-image.js?v=ac4ab0bf4cde';

function revealCard(element) {
  if (!element) return;
  element.classList.add('is-revealed');
  element.setAttribute('aria-label', '전적 카드 공개됨');
}

function setText(panel, selector, value) {
  const target = panel.querySelector(selector);
  if (target) target.textContent = value;
}

export function createShareCardController({
  panel,
  preview,
  shareButton,
  copyButton,
  downloadButton,
  status,
  profileImageInput,
  resetProfileImageButton,
  profileAdjustments,
  profileZoomInput,
  profileZoomValue,
  resetProfilePositionButton,
  getPageUrl = () => window.location.href,
  navigatorRef = globalThis.navigator,
  documentRef = globalThis.document,
  matchMediaRef = globalThis.matchMedia,
  urlRef = globalThis.URL,
  windowRef = globalThis.window,
  ResizeObserverRef = globalThis.ResizeObserver,
  startMeasurement = null,
  createBlob = createShareCardBlob,
  FileRef = globalThis.File,
  ClipboardItemRef = globalThis.ClipboardItem,
  waitingNoticeMs = 8000,
  generationTimeoutMs = 15000,
} = {}) {
  let model = null;
  let renderedNickname = '';
  let renderVersion = 0;
  let activeShare = null;
  let statusOwner = null;
  const prefersNativeShare = () => Boolean(matchMediaRef?.('(max-width: 820px)')?.matches);

  const profileEditor = createShareProfileImageController({
    panel, status, profileImageInput, resetProfileImageButton, profileAdjustments,
    profileZoomInput, profileZoomValue, resetProfilePositionButton,
    documentRef, urlRef, windowRef, ResizeObserverRef,
    onImageSelected: () => revealCard(preview),
  });
  const { resetProfileImage, resetProfilePosition } = profileEditor;

  function beginMeasurement(source) {
    let operation;
    try { operation = startMeasurement?.(source); } catch { /* Optional observer. */ }
    return (method, outcome, error) => {
      try { operation?.finish(method, outcome, error); } catch { /* Never change sharing. */ }
    };
  }

  function updateActionLabel() {
    if (shareButton) shareButton.textContent = prefersNativeShare() ? '공유하기' : '이미지 복사';
  }

  function requestImageCopy(image) {
    try {
      if (!navigatorRef?.clipboard?.write || typeof ClipboardItemRef === 'undefined') {
        throw new Error('IMAGE_CLIPBOARD_UNSUPPORTED');
      }
      // Request permission in the click handler; ClipboardItem waits for the PNG.
      // Observe rejection immediately, including while image generation is pending.
      return Promise.resolve(navigatorRef.clipboard.write([
        new ClipboardItemRef({ 'image/png': image }),
      ])).then(() => ({ ok: true }), error => ({ ok: false, error }));
    } catch (error) {
      return Promise.resolve({ ok: false, error });
    }
  }

  function render(nextModel) {
    renderVersion++;
    statusOwner = null;
    if (status) status.textContent = '';
    downloadButton?.classList.add('hidden');
    const nextNickname = String(nextModel?.nickname || '');
    if (!nextModel || (renderedNickname && nextNickname !== renderedNickname)) {
      resetProfileImage();
    }
    model = nextModel;
    renderedNickname = nextNickname;
    panel?.classList.toggle('hidden', !model);
    if (!panel || !model) return;
    preview?.classList.remove('is-revealed');
    preview?.setAttribute('aria-label', '클릭하여 전적 카드 공개');
    setText(panel, '[data-share-nickname]', model.nickname);
    setText(panel, '[data-share-clan]', model.clanName || (model.isCrew ? 'interval' : '공개 전적'));
    setText(panel, '[data-share-solo-tier]', model.soloTier || 'UNRANK');
    setText(panel, '[data-share-party-tier]', model.partyTier || 'UNRANK');
    const rankImage = panel.querySelector('[data-share-rank-image]');
    if (rankImage) {
      rankImage.src = model.rankImage || '';
      rankImage.alt = model.rankName || '계급';
      rankImage.parentElement?.classList.toggle('is-fallback', !model.rankImage);
    }
    const soloImage = panel.querySelector('[data-share-solo-image]');
    if (soloImage) {
      soloImage.src = model.soloImage || '';
      soloImage.alt = model.soloTier || 'UNRANK';
    }
    const partyImage = panel.querySelector('[data-share-party-image]');
    if (partyImage) {
      partyImage.src = model.partyImage || '';
      partyImage.alt = model.partyTier || 'UNRANK';
    }
    setText(panel, '[data-share-win-rate]', `${formatMetric(model.winRate, 1)}%`);
    setText(panel, '[data-share-kd]', `${formatMetric(model.kdPercent, 1)}%`);
    setText(panel, '[data-share-headshot]', `${formatMetric(model.headshotRate, 0)}%`);
    setText(panel, '[data-share-assault]', `${formatMetric(model.assaultRate, 1)}%`);
    setText(panel, '[data-share-sniper]', `${formatMetric(model.sniperRate, 1)}%`);
    setText(panel, '[data-share-special]', `${formatMetric(model.specialRate, 1)}%`);
    if (status && activeShare) status.textContent = '이전 카드 작업의 응답을 기다리고 있습니다. 현재 결과 링크는 복사할 수 있습니다.';
  }

  async function share() {
    if (!model || activeShare) return;
    const finishMeasurement = beginMeasurement('image_button');
    const acceptedModel = { ...model };
    const acceptedImage = profileEditor.getImageOptions();
    const operation = { version: renderVersion, blob: null, downloaded: false, finish: finishMeasurement, model: acceptedModel };
    activeShare = operation;
    statusOwner = operation;
    const announce = message => {
      if (operation.version === renderVersion && statusOwner === operation && status) status.textContent = message;
    };
    let waitingTimer;
    let method = 'clipboard_image';
    revealCard(preview);
    shareButton.disabled = true;
    if (status) status.textContent = '공유 이미지를 만드는 중입니다…';
    let blob;
    try {
      const image = withDeadline(Promise.resolve().then(() => createBlob(acceptedModel, documentRef, acceptedImage)), generationTimeoutMs);
      const mayShareNatively = prefersNativeShare() && navigatorRef?.share && navigatorRef?.canShare;
      // Keep native sharing first on supported mobile devices. Otherwise start
      // clipboard access before awaiting rendering so transient activation survives.
      let copyResult = mayShareNatively ? null : requestImageCopy(image);
      blob = await image;
      operation.blob = blob;
      const file = mayShareNatively ? new FileRef([blob], `tracking-sa-${acceptedModel.nickname}.png`, { type: 'image/png' }) : null;
      if (file && navigatorRef.canShare({ files: [file] })) {
        method = 'native';
        announce('기기 공유 화면에서 완료하거나 취소해 주세요.');
        await navigatorRef.share({
          title: `${acceptedModel.nickname} 서든어택 전적`,
          text: `Tracking SA에서 ${acceptedModel.nickname}님의 최근 전적을 확인하세요.`,
          url: acceptedModel.url,
          files: [file],
        });
        announce('공유를 완료했습니다.');
        finishMeasurement(method, 'success');
        return;
      }
      copyResult ||= requestImageCopy(blob);
      announce('이미지 복사 결과를 확인하는 중입니다…');
      waitingTimer = setTimeout(() => {
        if (operation.version !== renderVersion || operation.downloaded) return;
        announce('복사 응답이 늦어지고 있습니다. PNG 저장 또는 결과 링크 복사를 이용해 주세요.');
        downloadButton?.classList.remove('hidden');
        if (downloadButton) downloadButton.disabled = false;
      }, waitingNoticeMs);
      const result = await copyResult;
      if (!result.ok) throw result.error;
      if (!operation.downloaded) {
        announce('이미지를 복사했습니다. 채팅창에서 붙여넣기를 이용하세요.');
        finishMeasurement(method, 'success');
      }
    } catch (error) {
      if (operation.downloaded) return;
      if (error?.name === 'AbortError') {
        announce(method === 'native' ? '공유를 취소했습니다.' : '이미지 복사가 중단되었습니다. 다시 시도해 주세요.');
        finishMeasurement(method, method === 'native' ? 'cancelled' : 'failure', error);
        return;
      }
      if (!blob) {
        announce('이미지를 만들지 못했습니다. 다시 시도해 주세요.');
        finishMeasurement(method, 'failure', error);
        return;
      }
      try {
        method = 'png_download';
        await saveBlob(blob, `tracking-sa-${acceptedModel.nickname}.png`);
        announce('기기 공유나 복사를 사용할 수 없어 PNG 저장을 요청했습니다. 브라우저의 다운로드를 확인해 주세요.');
        finishMeasurement(method, 'download_requested');
      } catch (fallbackError) {
        announce('PNG 저장을 요청하지 못했습니다. 다시 시도해 주세요.');
        finishMeasurement(method, 'failure', fallbackError);
      }
    } finally {
      clearTimeout(waitingTimer);
      if (activeShare === operation) {
        activeShare = null;
        shareButton.disabled = false;
        downloadButton?.classList.add('hidden');
        if (model && operation.version !== renderVersion && statusOwner === null && status) {
          status.textContent = '이전 카드 작업이 끝났습니다. 현재 카드를 공유할 수 있습니다.';
        }
      }
    }
  }

  async function downloadPendingImage() {
    const operation = activeShare;
    if (!operation?.blob || operation.downloaded || operation.version !== renderVersion) return;
    operation.downloaded = true;
    statusOwner = operation;
    if (downloadButton) downloadButton.disabled = true;
    try {
      saveBlob(operation.blob, `tracking-sa-${operation.model.nickname}.png`);
      operation.finish('png_download', 'download_requested');
      if (operation.version === renderVersion && statusOwner === operation && status) {
        status.textContent = 'PNG 저장을 요청했습니다. 이전 복사 응답은 아직 대기 중이며 중복 복사는 요청하지 않습니다.';
      }
    } catch {
      operation.downloaded = false;
      if (downloadButton) downloadButton.disabled = false;
      if (operation.version === renderVersion && statusOwner === operation && status) status.textContent = 'PNG 저장을 요청하지 못했습니다. 결과 링크 복사를 이용해 주세요.';
    }
  }

  function saveBlob(blob, fileName) {
    const objectUrl = urlRef.createObjectURL(blob);
    try {
      const anchor = documentRef.createElement('a');
      anchor.href = objectUrl;
      anchor.download = fileName;
      anchor.click();
    } finally { urlRef.revokeObjectURL(objectUrl); }
  }

  async function copyLink() {
    if (!model) return;
    const operation = { version: renderVersion };
    statusOwner = operation;
    const finishMeasurement = beginMeasurement('link_button');
    const acceptedModel = { ...model };
    try {
      const currentModel = { ...acceptedModel, url: createShareCardModel({ player: { nickname: acceptedModel.nickname } }, {}, getPageUrl()).url };
      await navigatorRef.clipboard.writeText(currentModel.url);
      if (status && statusOwner === operation && operation.version === renderVersion) status.textContent = '전적 결과 링크를 복사했습니다.';
      finishMeasurement('clipboard_link', 'success');
    } catch (error) {
      if (status && statusOwner === operation && operation.version === renderVersion) status.textContent = '주소창의 링크를 복사해 주세요.';
      finishMeasurement('clipboard_link', 'failure', error);
    }
  }

  preview?.addEventListener('click', () => revealCard(preview));
  shareButton?.addEventListener('click', share);
  copyButton?.addEventListener('click', copyLink);
  downloadButton?.addEventListener('click', downloadPendingImage);
  windowRef?.addEventListener('resize', () => { profileEditor.syncPreview(); updateActionLabel(); });
  updateActionLabel();

  return { render, share, copyLink, downloadPendingImage, resetProfileImage, resetProfilePosition };
}

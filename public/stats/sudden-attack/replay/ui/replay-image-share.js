const styles = `
#replayImageShareDialog{position:fixed;inset:0;width:min(760px,calc(100% - 24px));max-height:calc(100dvh - 28px);margin:auto;padding:0;overflow:auto;border:1px solid var(--r-line,#dbe4ef);border-radius:18px;background:var(--r-card,#fff);color:var(--r-ink,#13213b);font:inherit}
#replayImageShareDialog:not([open]){display:none}#replayImageShareDialog::backdrop{background:rgba(4,10,20,.7)}
#replayImageShareDialog .image-share-heading{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:16px 20px;border-bottom:1px solid var(--r-line,#dbe4ef)}
#replayImageShareDialog h2{margin:0;font-size:1.1rem}#replayImageShareDialog button{min-height:44px;padding:10px 16px;border:1px solid var(--r-line,#dbe4ef);border-radius:10px;background:var(--r-soft,#f3f7fb);color:inherit;font:inherit;font-size:.88rem;cursor:pointer}
#replayImageShareDialog button:focus-visible{outline:3px solid var(--r-cyan,#007fa7);outline-offset:3px}#replayImageShareDialog button:disabled{opacity:.55;cursor:wait}#replayImageShareDialog [hidden]{display:none!important}
#replayImageShareDialog .image-share-preview{padding:18px 20px 0}#replayImageShareDialog img{display:block;width:100%;height:auto;max-height:54vh;object-fit:contain;border-radius:10px}
#replayImageShareDialog .image-share-actions{display:flex;gap:9px;flex-wrap:wrap;padding:16px 20px 0}#replayImageShareDialog [data-image-copy]{background:#2265db;color:#fff;border-color:transparent;font-weight:700}
#replayImageShareDialog p{margin:0;padding:12px 20px 18px;color:var(--r-muted,#64748b);font-size:.82rem;line-height:1.6}
@media(max-width:480px){#replayImageShareDialog .image-share-heading{padding:14px}#replayImageShareDialog .image-share-preview{padding:14px 14px 0}#replayImageShareDialog .image-share-actions{padding:14px 14px 0;display:grid;grid-template-columns:1fr 1fr}#replayImageShareDialog p{padding:12px 14px 16px}}
`;

// The PNG is ready before these buttons are clicked. Clipboard/native access
// therefore starts inside a fresh user gesture, without waiting for canvas work.
export function openReplayImageShare({ blob, file, returnFocus = document.activeElement, onClose = () => {} }, {
  documentRef = document, navigatorRef = navigator, ClipboardItemRef = globalThis.ClipboardItem, urlRef = URL,
} = {}) {
  const dialog = documentRef.createElement('dialog');
  dialog.id = 'replayImageShareDialog';
  dialog.setAttribute('aria-labelledby', 'replay-image-share-title');
  dialog.innerHTML = `<style>${styles}</style><div class="image-share-heading"><h2 id="replay-image-share-title">리플레이 이미지 공유</h2><button type="button" data-image-close>닫기</button></div><div class="image-share-preview"><img alt="리플레이 분석 이미지 미리보기"></div><div class="image-share-actions"><button type="button" data-image-copy>이미지 복사</button><button type="button" data-image-save>PNG 저장</button><button type="button" data-image-native hidden>기기로 공유</button></div><p role="status" data-image-status>이미지 복사 후 이미지 첨부를 지원하는 채팅창·편집기에 Ctrl+V로 붙여넣으세요. 붙여넣기가 지원되지 않으면 PNG 저장 후 파일을 첨부하세요.</p>`;
  const imageUrl = urlRef.createObjectURL(blob);
  dialog.querySelector('img').src = imageUrl;
  const copy = dialog.querySelector('[data-image-copy]'), save = dialog.querySelector('[data-image-save]');
  const native = dialog.querySelector('[data-image-native]'), status = dialog.querySelector('[data-image-status]');
  let active = true, copying = false, sharing = false, downloaded = false, pendingNotice, noticeRevision = 0;
  const announce = (text, revision = noticeRevision) => { if (active && revision === noticeRevision) status.textContent = text; };
  const close = () => {
    if (!active) return;
    active = false; clearTimeout(pendingNotice);
    dialog.close(); dialog.remove();
    if (downloaded) setTimeout(() => urlRef.revokeObjectURL(imageUrl), 1000); else urlRef.revokeObjectURL(imageUrl);
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    onClose();
  };
  dialog.querySelector('[data-image-close]').addEventListener('click', close);
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('close', close);
  const copySupported = Boolean(navigatorRef.clipboard?.write && typeof ClipboardItemRef === 'function');
  copy.disabled = !copySupported;
  if (!copySupported) announce('이 브라우저는 이미지 복사를 지원하지 않습니다. PNG 저장 후 파일을 첨부해 주세요.');
  copy.addEventListener('click', async () => {
    if (!active || copying || !copySupported) return;
    copying = true; copy.disabled = true;
    const revision = ++noticeRevision;
    announce('이미지 복사 권한을 확인하고 있습니다…');
    pendingNotice = setTimeout(() => announce('복사 응답이 늦어지고 있습니다. 브라우저의 권한 안내를 확인하거나 PNG 저장을 이용해 주세요.', revision), 8000);
    try {
      await navigatorRef.clipboard.write([new ClipboardItemRef({ 'image/png': blob })]);
      announce('이미지를 복사했습니다. 이미지 첨부를 지원하는 채팅창·편집기에 Ctrl+V로 붙여넣으세요.', revision);
    } catch {
      announce('이미지를 복사하지 못했습니다. 브라우저의 클립보드 권한을 확인하거나 PNG 저장 후 첨부해 주세요.', revision);
    } finally { clearTimeout(pendingNotice); copying = false; if (active) copy.disabled = false; }
  });
  save.addEventListener('click', () => {
    if (!active) return;
    noticeRevision++;
    const anchor = documentRef.createElement('a');
    anchor.href = imageUrl; anchor.download = file.name;
    documentRef.body.append(anchor); anchor.click(); anchor.remove(); downloaded = true;
    announce('PNG 저장을 요청했습니다. 브라우저의 다운로드 목록에서 파일을 확인하고 첨부해 주세요.');
  });
  try { native.hidden = !(navigatorRef.share && navigatorRef.canShare?.({ files: [file] })); }
  catch { native.hidden = true; }
  native.addEventListener('click', async () => {
    if (!active || sharing) return;
    sharing = true; native.disabled = true;
    const revision = ++noticeRevision;
    try {
      await navigatorRef.share({ title: 'Tracking SA 리플레이 분석', files: [file] });
      announce('기기 공유를 완료했습니다.', revision);
    } catch (error) {
      announce(error?.name === 'AbortError' ? '공유를 취소했습니다. 이미지 복사 또는 PNG 저장도 사용할 수 있습니다.' : '기기 공유를 열지 못했습니다. 이미지 복사 또는 PNG 저장을 이용해 주세요.', revision);
    } finally { sharing = false; if (active) native.disabled = false; }
  });
  documentRef.body.append(dialog);
  try { dialog.showModal(); } catch (error) { close(); throw error; }
  return close;
}

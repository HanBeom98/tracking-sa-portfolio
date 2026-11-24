// One controller per page; hide/show keeps the existing comparison session.
export function createLazyReplayComparison(root) {
  const input = root.querySelector('[data-comparison-files]');
  const clear = root.querySelector('[data-comparison-clear]');
  const status = root.querySelector('[data-comparison-status]');
  let controller = null, pending = null, disposed = false, revision = 0;

  function open() {
    if (disposed) return Promise.resolve(null);
    if (controller) return Promise.resolve(controller);
    if (pending) return pending;
    root.setAttribute('aria-busy', 'true');
    input.disabled = true;
    status.textContent = '비교 화면을 준비하고 있습니다…';
    status.dataset.state = 'loading';
    pending = import('./replay-comparison.js').then(({ mountReplayComparison }) => {
      if (disposed) return null;
      controller = mountReplayComparison(root);
      input.disabled = false;
      // Also honor a restored or programmatically selected FileList before mount.
      if (revision === 0 && input.files?.length) void loadFiles(Array.from(input.files));
      return controller;
    }).catch(() => {
      if (!disposed) {
        status.textContent = '비교 화면을 불러오지 못했습니다. 새로고침 후 다시 열어 주세요. 한 경기 분석은 계속 사용할 수 있습니다.';
        status.dataset.state = 'error';
      }
      return null;
    }).finally(() => {
      pending = null;
      if (!disposed) root.setAttribute('aria-busy', 'false');
    });
    return pending;
  }

  async function loadFiles(files) {
    const current = ++revision;
    const selected = Array.from(files ?? []);
    const ready = await open();
    if (!ready || disposed || current !== revision) return false;
    await ready.loadFiles(selected);
    return !disposed && current === revision;
  }
  const onFiles = () => {
    if (controller) revision++;
    else void loadFiles(input.files);
  };
  const onClear = () => { revision++; };
  input.addEventListener('change', onFiles);
  clear.addEventListener('click', onClear);
  return {
    open, loadFiles,
    selectPlayer(id) { controller?.selectPlayer(id); },
    dispose() {
      disposed = true; revision++;
      input.removeEventListener('change', onFiles);
      clear.removeEventListener('click', onClear);
      controller?.dispose();
    },
  };
}

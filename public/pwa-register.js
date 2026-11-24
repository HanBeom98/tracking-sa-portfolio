(function setupTrackingSaPwa() {
  if (!("serviceWorker" in navigator)) return;

  let deferredInstallPrompt = null;

  function getInstallButton() {
    return document.getElementById("pwa-install-button");
  }

  function isIos() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
  }

  function isStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches
      || navigator.standalone === true;
  }

  function updateInstallButton() {
    const button = getInstallButton();
    if (!button || isStandalone()) return;
    button.hidden = !(deferredInstallPrompt || isIos());
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    updateInstallButton();
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    const button = getInstallButton();
    if (button) button.hidden = true;
  });

  document.addEventListener("click", async (event) => {
    const button = event.target.closest("#pwa-install-button");
    if (!button) return;

    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      updateInstallButton();
      return;
    }

    if (isIos()) {
      window.alert("Safari 하단의 공유 버튼을 누른 뒤 ‘홈 화면에 추가’를 선택해 주세요.");
    }
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" })
      .catch((error) => console.warn("PWA service worker registration failed:", error));
    updateInstallButton();
  }, { once: true });
})();

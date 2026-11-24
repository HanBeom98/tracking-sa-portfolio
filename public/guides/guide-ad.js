// Only the maintained article with this explicit placement can request a manual ad.
export function initializeGuideAd(win = window, doc = document) {
    const placement = doc.querySelector("[data-guide-ad]");
    if (win.runtimeConfig?.guideAdEnabled !== true || !placement) return false;
    const ad = placement.querySelector("ins.adsbygoogle");
    if (!ad || ad.dataset.guideAdRequested === "true") return false;

    ad.dataset.guideAdRequested = "true";
    placement.hidden = false;
    try {
        (win.adsbygoogle = win.adsbygoogle || []).push({});
        return true;
    } catch {
        placement.hidden = true;
        return false;
    }
}

initializeGuideAd();

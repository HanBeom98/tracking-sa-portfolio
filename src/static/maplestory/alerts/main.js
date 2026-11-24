import { runeAlertMessage, selectRuneVoice } from "./rune-alert.mjs";
import { formatApproximateRemaining, initHuntTools } from "./hunt-tools.mjs?v=maple-hunt-10";
import { formatRemaining } from "./hunt-timing.mjs?v=maple-hunt-2";
import { canCaptureGame, createCaptureWorker, isSkillIconRect, readSkillRegion, requestGameCapture } from "./game-capture.mjs?v=maple-hunt-10";
import { initHuntJournal } from "./hunt-journal.mjs?v=maple-hunt-6";
import { initMapleWindow } from "../maple-window.mjs?v=tracking-maple-2";
import { formatExperienceProgress } from "./exp-tracking.mjs?v=maple-hunt-6";
import { captureViewport, frameSizeKey, sameCaptureViewport, savedCaptureRegions } from "./capture-regions.mjs?v=maple-hunt-7";

const byId = (id) => document.getElementById(id);
const stage = byId("stage");
const preview = byId("preview");
const layer = byId("selection-layer");
const box = byId("selection-box");
const captureMode = byId("capture-mode");
const storageKey = "tracking-sa.maplestory-alerts.v1";
const cooldownMs = 15 * 60 * 1000;
const regionKinds = ["rune", "experience", "solErda", "monitorView"];
const handheld = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const captureSupported = !handheld && canCaptureGame();
const alertMessages = {
    rune: runeAlertMessage,
    timer: "룬 재사용 대기 15분이 지났어요.",
};

let settings = readSettings();
let stream = null;
let worker = null;
let capturePending = false;
let reconnectNeeded = false;
let resumeAfterReconnect = false;
let startOnFrame = false;
let captureSession = null;
let frame = null;
let experienceReading = null;
let solErdaReading = null;
let runeRegion = null;
let runeFound = false;
let guideVisible = false;
let captureNote = "";
let selection = null;
let audio = null;
let activeSpeech = null;
let deadline = 0;
let timerExpired = false;

function readSettings() {
    let stored;
    try {
        stored = JSON.parse(localStorage.getItem(storageKey)) ?? {};
    } catch {
        stored = {};
    }
    return { runeRepeat: stored.runeRepeat, runeEnabled: stored.runeEnabled !== false,
        captureSurface: stored.captureSurface === "monitor" ? "monitor" : "window",
        ...Object.fromEntries(regionKinds.map((kind) => [kind, savedCaptureRegions(stored[kind])])) };
}

function configure(kind, value) {
    if (regionKinds.includes(kind)) {
        if (!value && !frame) return;
        const size = frameSizeKey(value ?? frame);
        if (value) settings[kind][size] = value;
        else delete settings[kind][size];
    } else {
        settings[kind] = value;
    }
    if (kind === "rune" || kind === "runeEnabled") {
        runeRegion = null;
        runeFound = false;
        refreshStage();
    }
    if (kind !== "captureSurface") worker?.postMessage({ type: "configure", kind, value: settings[kind] });
    try {
        localStorage.setItem(storageKey, JSON.stringify(settings));
    } catch {
        byId("last-alert").textContent = "브라우저 저장소를 사용할 수 없어 이 탭에서만 설정이 유지돼요.";
    }
    refreshStatus();
}

function badge(id, label, state = "") {
    const element = byId(id);
    if (element.textContent !== label) element.textContent = label;
    element.dataset.state = state;
}

function captureReady() {
    return Boolean(frame?.viewport && !frame.dark && performance.now() - frame.receivedAt <= 4500 &&
        stream && !stream.getVideoTracks()[0]?.muted);
}

function captureTarget() {
    return settings.captureSurface === "monitor" ? "모니터" : "게임 창";
}

function refreshStatus() {
    const ready = captureReady();
    const monitor = settings.captureSurface === "monitor";
    const target = captureTarget();
    const trackMuted = stream?.getVideoTracks()[0]?.muted;
    let detail = captureNote;
    if (capturePending) {
        badge("capture-state", "공유 대상 선택 중");
    } else if (!stream) {
        badge("capture-state", reconnectNeeded ? "재연결 필요" : "공유 꺼짐", reconnectNeeded ? "warning" : "");
        detail ||= monitor ? "‘전체 화면’ 탭에서 메이플이 표시되는 모니터를 선택하세요."
            : "‘창’ 탭에서 메이플스토리를 선택하세요.";
    } else if (monitor && frame && !frame.viewport && !trackMuted) {
        badge("capture-state", "메이플 화면 대기", "warning");
        detail = "메이플을 화면에 띄우세요. 창 모드에서는 창 모드 영역을 한 번 지정하세요.";
    } else if (!ready) {
        badge("capture-state", frame || trackMuted ? "감지 일시 중지" : "화면 연결 중", "warning");
        detail = "게임 화면이 돌아오면 자동으로 감지를 재개해요.";
    } else {
        badge("capture-state", "공유 중", "active");
        const mode = monitor ? sameCaptureViewport(frame.viewport, captureViewport(frame.sourceSize)) ? "전체화면" : "창 모드" : "게임 창";
        detail = mode + " · " + frame.width + " × " + frame.height + " · 브라우저에서 화면 분석 중";
    }

    const detailElement = byId("capture-detail");
    if (detailElement.textContent !== detail) detailElement.textContent = detail;
    const share = byId("share");
    share.hidden = !captureSupported || Boolean(stream);
    share.disabled = Boolean(stream || capturePending);
    const shareLabel = journal.status === "idle" ? target + " 공유하고 시작"
        : resumeAfterReconnect && journal.status === "paused" ? target + " 다시 공유하고 사냥 재개"
            : reconnectNeeded ? target + " 다시 공유" : target + " 공유";
    if (share.textContent !== shareLabel) share.textContent = shareLabel;
    byId("stop").hidden = !stream;
    byId("capture-inputs").hidden = !stream;
    const size = ready ? frameSizeKey(frame) : null;
    captureMode.disabled = Boolean(stream || capturePending);
    const sourceMatches = frame?.sourceSize?.width === preview.videoWidth && frame?.sourceSize?.height === preview.videoHeight;
    const canSelect = ready && sourceMatches;
    const monitorView = byId("choose-monitor-view");
    monitorView.hidden = !monitor || !stream;
    monitorView.disabled = !sourceMatches;
    for (const [suffix, kind] of [["map", "rune"], ["exp", "experience"], ["erda", "solErda"]]) {
        byId("choose-" + suffix).disabled = !canSelect;
        byId("clear-" + suffix).hidden = !settings[kind][size];
    }
    const needsMap = canSelect && settings.runeEnabled && runeRegion?.mode === "waiting";
    const runeSetup = byId("rune-settings");
    runeSetup.hidden = !stream || !settings.runeEnabled;
    const setupNote = byId("rune-setup-note");
    const mapDetail = needsMap ? "게임 미니맵을 펼쳐 주세요. 필요하면 미니맵을 직접 지정할 수 있어요." : "";
    if (setupNote.textContent !== mapDetail) setupNote.textContent = mapDetail;
    const runeTarget = stream && settings.runeEnabled ? "#rune-settings" : "#alert-settings";
    if (byId("rune-status-link").getAttribute("href") !== runeTarget) byId("rune-status-link").setAttribute("href", runeTarget);
    if (!settings.runeEnabled) badge("rune-state", "알림 꺼짐");
    else if (!ready) badge("rune-state", "공유 대기");
    else if (!runeRegion?.rect) badge("rune-state", "미니맵 확인 대기", "warning");
    else if (runeFound) badge("rune-state", "룬 발견", "warning");
    else badge("rune-state", runeRegion.mode === "auto" ? "자동 감지 중" : "수동 감지 중", "active");
    const runeBadge = byId("rune-state");
    badge("rune-tile-state", settings.runeEnabled ? runeBadge.textContent : "—", runeBadge.dataset.state);
    const expState = byId("exp-state");
    const label = !stream ? "게임 화면 공유 대기"
        : !ready ? "공유 화면 대기"
            : experienceReading?.value != null
                ? "현재 " + formatExperienceProgress(experienceReading.value, true) + "% · 게임 숫자"
                : "게임 하단 경험치 숫자 확인 중";
    const amountLabel = ready && experienceReading?.amount ? "보유 경험치 " + BigInt(experienceReading.amount).toLocaleString("ko-KR") : "";
    const expLabel = amountLabel ? label + " · " + amountLabel : label;
    if (expState.textContent !== expLabel) expState.textContent = expLabel;
    const erdaState = byId("erda-state");
    const sol = solErdaReading?.value;
    let erdaLabel = "게임에서 솔 에르다 통합 UI를 열고 창을 지정하세요.";
    if (Object.keys(settings.solErda).length && !ready) erdaLabel = "게임 화면 공유 대기";
    else if (ready && !settings.solErda[size] && Object.keys(settings.solErda).length) {
        erdaLabel = "이 해상도에서 솔 에르다 창을 한 번 지정하세요.";
    } else if (sol?.fragments != null) {
        erdaLabel = "보유 조각 " + sol.fragments.toLocaleString("ko-KR") + "개";
    } else if (settings.solErda[size]) erdaLabel = "창의 숫자를 확인 중이에요. 창을 가리지 마세요.";
    if (erdaState.textContent !== erdaLabel) erdaState.textContent = erdaLabel;
    huntTools.updateCapture(canSelect ? frame : null);
}

function refreshShareStart() {
    const button = byId("hunt-share-start");
    button.hidden = !captureSupported || journal.status === "running" || journal.status === "finished";
    button.disabled = capturePending || startOnFrame || Boolean(stream && !captureReady());
    byId("hunt-start").hidden = Boolean(stream && !button.hidden);
    const label = startOnFrame ? "게임 화면 연결 중…" : journal.status === "paused"
        ? (stream ? "사냥 재개" : captureTarget() + " 공유하고 재개")
        : (stream ? "사냥 시작" : captureTarget() + " 공유하고 시작");
    if (button.textContent !== label) button.textContent = label;
}

function startCapturedHunt() {
    startOnFrame = false;
    captureSession = journal.startFromCapture(Date.now());
    if (captureSession !== null) byId("hunt-elapsed").scrollIntoView({ block: "nearest" });
    refreshShareStart();
}

async function prepareSound() {
    try {
        audio ??= new AudioContext();
        if (audio.state !== "running") await audio.resume();
    } catch {
        return false;
    }
    return audio.state === "running";
}

function playTone() {
    if (audio?.state !== "running") return false;
    const notes = [680, 910];
    notes.forEach((frequency, index) => {
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        const start = audio.currentTime + index * 0.17;
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.exponentialRampToValueAtTime(0.16, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.145);
        oscillator.connect(gain).connect(audio.destination);
        oscillator.start(start);
        oscillator.stop(start + 0.15);
    });
    return true;
}

function playLocalVoice(message, { onStart, onError } = {}) {
    const synthesis = globalThis.speechSynthesis;
    const voice = selectRuneVoice(synthesis?.getVoices() ?? []);
    if (!voice || !globalThis.SpeechSynthesisUtterance) return false;
    if (activeSpeech && (synthesis.speaking || synthesis.pending)) return false;

    const utterance = new SpeechSynthesisUtterance(message);
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.rate = 0.96;
    utterance.onstart = onStart;
    utterance.onend = () => {
        if (activeSpeech === utterance) activeSpeech = null;
    };
    utterance.onerror = () => {
        if (activeSpeech !== utterance) return;
        activeSpeech = null;
        onError?.();
    };
    activeSpeech = utterance;
    try {
        synthesis.speak(utterance);
        return true;
    } catch {
        activeSpeech = null;
        return false;
    }
}

function alertUser(kind, repeat = false, message = alertMessages[kind], tag = kind) {
    const voiceAlert = kind === "rune" || kind === "skill" || kind === "custom-timer" || kind === "capture";
    if (!voiceAlert || !playLocalVoice(message, { onError: playTone })) playTone();
    if (repeat) return;
    const time = new Date().toLocaleTimeString("ko-KR");
    byId("last-alert").textContent = time + " · " + message;
    if (globalThis.Notification?.permission === "granted") {
        try {
            new Notification("TrackingMaple · 사냥", { body: message, tag });
        } catch {
            // The sound and on-page alert still work without a desktop notification.
        }
    }
}

function refreshNotificationButton() {
    const button = byId("notifications");
    const permission = globalThis.Notification?.permission;
    button.disabled = permission !== "default";
    button.textContent = {
        default: "시스템 알림 켜기",
        granted: "시스템 알림 켜짐",
        denied: "시스템 알림 차단됨",
    }[permission] ?? "시스템 알림 사용 불가";
}

function refreshStage() {
    preview.hidden = !stream;
    const guide = byId("capture-guide");
    const focus = selection?.kind === "rune" || selection?.kind === "experience" ? selection.kind : "";
    guide.hidden = Boolean(stream) && !focus && (!guideVisible || Boolean(selection));
    guide.dataset.overlay = String(Boolean(stream));
    guide.dataset.focus = focus;
    const toggle = byId("capture-guide-toggle");
    toggle.hidden = !stream || Boolean(selection);
    toggle.setAttribute("aria-pressed", String(guideVisible));
    const { videoWidth: width, videoHeight: height } = preview;
    stage.style.aspectRatio = width && height ? width + " / " + height : "";
    const inset = (area) => area && width && height
        ? `${area.y / height * 100}% ${(width - area.x - area.width) / width * 100}% ${(height - area.y - area.height) / height * 100}% ${area.x / width * 100}%`
        : "";
    layer.style.inset = inset(selection?.viewport);
    guide.style.inset = inset(selection?.viewport ?? frame?.viewport);
    const guideMap = byId("guide-map");
    const rect = runeRegion?.rect;
    guideMap.hidden = Boolean(stream && !rect);
    guideMap.style.inset = rect ? `${rect.y * 100}% ${(1 - rect.x - rect.w) * 100}% ${(1 - rect.y - rect.h) * 100}% ${rect.x * 100}%` : "";
}

function cancelSelection() {
    selection = null;
    layer.hidden = true;
    box.hidden = true;
    byId("selection-tools").hidden = true;
    refreshStage();
}

function resetCaptureReadings() {
    experienceReading = null;
    solErdaReading = null;
    runeRegion = null;
    runeFound = false;
    journal.resetExperienceSource();
    journal.resetSolErdaSource();
}

function stopCapture(note, unexpected = false) {
    const closing = stream;
    stream = null;
    guideVisible = false;
    startOnFrame = false;
    const pausedHunt = captureSession !== null && journal.pauseAfterCapture(captureSession, Date.now());
    if (unexpected) {
        reconnectNeeded = true;
        resumeAfterReconnect ||= pausedHunt;
    }
    captureSession = null;
    worker?.terminate();
    worker = null;
    frame = null;
    resetCaptureReadings();
    closing?.getTracks().forEach((track) => track.stop());
    preview.srcObject = null;
    captureNote = [note, pausedHunt && "사냥을 일시정지했어요."].filter(Boolean).join(" ");
    if (selection) cancelSelection();
    huntTools.captureStopped();
    refreshStage();
    refreshStatus();
    refreshShareStart();
}

function captureLost(note) {
    stopCapture(note, true);
    const recovery = settings.captureSurface === "window" ? "전체화면 전환 중이면 모니터 전체 공유로 다시 연결해 주세요."
        : "메이플이 표시되는 모니터를 다시 공유해 주세요.";
    alertUser("capture", false, "화면 공유가 끊겼습니다. " + recovery);
}

async function startCapture(startHunt = false) {
    if (capturePending || stream) return;
    if (!captureSupported) {
        captureNote = "PC용 최신 Chrome 또는 Edge에서 HTTPS나 localhost로 열어 주세요.";
        refreshStatus();
        byId("hunt-live").scrollIntoView({ block: "start" });
        return;
    }
    prepareSound();
    startOnFrame = startHunt;
    capturePending = true;
    refreshStatus();
    refreshShareStart();
    let selectedTrack;
    const surface = settings.captureSurface;
    const picker = surface === "monitor" ? "‘전체 화면’ 탭에서 메이플이 표시되는 모니터" : "‘창’ 탭에서 메이플스토리 창";
    try {
        stream = await requestGameCapture(surface);
        if (!stream) {
            stopCapture("공유 선택창의 " + picker + "을 선택하세요.");
            return;
        }

        const [track] = stream.getVideoTracks();
        selectedTrack = track;
        const isCurrent = () => stream?.getVideoTracks()[0] === track;
        track.addEventListener("ended", () => {
            if (isCurrent()) captureLost(surface === "window"
                ? "게임 창 공유가 종료됐어요. 화면 모드를 바꿨다면 ‘모니터 전체’로 다시 공유하세요."
                : "모니터 공유가 종료됐어요. 화면을 다시 공유하세요.");
        });
        track.addEventListener("mute", () => {
            if (!isCurrent()) return;
            frame = null;
            resetCaptureReadings();
            if (selection) cancelSelection();
            refreshStatus();
        });
        track.addEventListener("unmute", () => {
            if (isCurrent()) refreshStatus();
        });
        worker = createCaptureWorker(track, (data) => {
            if (!isCurrent()) return;
            if (data.type === "frame") {
                const changed = !sameCaptureViewport(frame?.viewport ?? null, data.viewport);
                if (changed && selection && selection.kind !== "monitorView") cancelSelection();
                if (!frame || changed || data.gap || data.dark !== frame.dark) resetCaptureReadings();
                frame = { ...data, receivedAt: performance.now() };
                if (captureReady()) {
                    reconnectNeeded = false;
                    resumeAfterReconnect = false;
                    if (startOnFrame) startCapturedHunt();
                }
                if (changed) refreshStage();
                refreshStatus();
                refreshTimer();
            } else if (data.type === "ended" || data.type === "error") {
                captureLost("공유 화면이 끊겼어요. " + picker + "을 다시 선택하세요.");
            } else if (!captureReady()) {
                return;
            } else if (data.type === "alert") {
                if (data.kind !== "rune" || settings.runeEnabled) alertUser(data.kind, data.repeat);
            } else if (data.type === "rune-region") {
                if (!settings.runeEnabled) return;
                runeRegion = data;
                runeFound = false;
                refreshStage();
                refreshStatus();
            } else if (data.type === "rune-presence") {
                runeFound = data.present;
                refreshStatus();
            } else if (data.type === "skill-activated") {
                huntTools.skillActivated(data.id);
            } else if (data.type === "hunt-icon") {
                huntTools.automaticIconReading(data);
            } else if (data.type === "experience") {
                experienceReading = data;
                journal.observeExperience(data.value, Date.now());
                refreshStatus();
            } else if (data.type === "sol-erda") {
                solErdaReading = data;
                journal.observeSolErda(data.value, Date.now());
                refreshStatus();
            }
        }, () => {
            if (isCurrent()) captureLost("공유 화면을 읽지 못했어요. " + picker + "을 다시 선택하세요.");
        }, surface);
        for (const kind of [...regionKinds, "runeRepeat", "runeEnabled"]) {
            worker.postMessage({ type: "configure", kind, value: settings[kind] ?? null });
        }
        preview.srcObject = stream;
        refreshStage();
        await preview.play();
    } catch (error) {
        if (selectedTrack && stream?.getVideoTracks()[0] !== selectedTrack) return;
        stopCapture(error.name === "NotAllowedError"
            ? "화면 공유가 취소됐어요. 감지를 시작하려면 다시 선택하세요."
            : "화면을 연결하지 못했어요. 브라우저의 화면 공유 권한을 확인하세요.");
        if (startHunt && error.name !== "NotAllowedError") byId("hunt-live").scrollIntoView({ block: "start" });
    } finally {
        capturePending = false;
        refreshStatus();
        refreshShareStart();
    }
}

function openSelection(kind, { id, mode } = {}) {
    const sourceSize = { width: preview.videoWidth, height: preview.videoHeight };
    const viewport = kind === "monitorView" ? captureViewport(sourceSize) : frame?.viewport;
    if (!viewport || !sourceSize.width || !sourceSize.height) return;
    const { width, height } = viewport;
    selection = { kind, width, height, viewport, sourceSize, id, pointer: null, rect: null };
    byId("selection-help").textContent = {
        monitorView: "창 모드일 때 메이플스토리 창 전체를 드래그하세요. 제목 줄과 맨 아래 경험치까지 포함하세요.",
        rune: "제목과 버튼을 빼고 미니맵 지도 안쪽을 드래그하세요.",
        experience: "화면 하단 경험치 바를 왼쪽 끝부터 오른쪽 끝까지 드래그하세요. 채워지지 않은 부분도 포함하세요.",
        solErda: "솔 에르다 통합 창의 테두리 전체를 드래그하세요. 두 숫자가 보이면 오른쪽 조각 수를 읽어요.",
        skill: mode === "buff" ? "켜져 있는 버프 아이콘 한 칸만 드래그하세요."
            : "지금 사용할 수 있는 스킬 아이콘 한 칸만 드래그하세요.",
    }[kind];
    layer.hidden = false;
    box.hidden = true;
    byId("selection-tools").hidden = false;
    byId("save-selection").disabled = true;
    refreshStage();
    stage.scrollIntoView({ block: "nearest" });
}

function point(event) {
    const area = layer.getBoundingClientRect();
    const clamp = (value) => Math.max(0, Math.min(1, value));
    return { x: clamp((event.clientX - area.left) / area.width), y: clamp((event.clientY - area.top) / area.height) };
}

function moveSelection(event) {
    if (selection?.pointer !== event.pointerId) return;
    const start = selection.start;
    const end = point(event);
    const rect = {
        x: Math.min(start.x, end.x),
        y: Math.min(start.y, end.y),
        w: Math.abs(end.x - start.x),
        h: Math.abs(end.y - start.y),
    };
    selection.rect = rect;
    box.hidden = false;
    box.style.left = rect.x * 100 + "%";
    box.style.top = rect.y * 100 + "%";
    box.style.width = rect.w * 100 + "%";
    box.style.height = rect.h * 100 + "%";
    const width = rect.w * selection.width;
    const height = rect.h * selection.height;
    let valid = width >= 24 && height >= 12;
    if (selection.kind === "monitorView") {
        valid = width >= 480 && height >= 300;
    } else if (selection.kind === "skill") {
        valid = isSkillIconRect(rect, selection.width, selection.height);
    } else if (selection.kind === "experience") {
        valid = width >= 160 && width >= selection.width * .6 && height >= 3 && height <= 100;
    } else if (selection.kind === "solErda") {
        valid = width >= 70 && width <= 360 && height >= 25 && height <= 155 && width / height >= 1.5 && width / height <= 4.8;
    }
    byId("save-selection").disabled = !valid;
}

function saveSelection() {
    const { kind, id, rect, width, height, viewport, sourceSize } = selection;
    if (sourceSize.width !== preview.videoWidth || sourceSize.height !== preview.videoHeight ||
        (kind !== "monitorView" && !sameCaptureViewport(viewport, frame?.viewport))) {
        cancelSelection();
        byId("last-alert").textContent = "공유 창 크기가 바뀌었어요. 영역을 다시 지정하세요.";
        return;
    }

    const value = { rect, width, height };
    if (kind === "monitorView") {
        configure(kind, value);
        cancelSelection();
        byId("choose-monitor-view").focus();
        return;
    }
    if (kind === "solErda") {
        const left = Math.round(rect.x * width);
        const top = Math.round(rect.y * height);
        const right = Math.round((rect.x + rect.w) * width);
        const bottom = Math.round((rect.y + rect.h) * height);
        value.rect = { x: left / width, y: top / height, w: (right - left) / width, h: (bottom - top) / height };
    }
    if (kind === "skill") {
        const region = readSkillRegion(preview, rect, viewport);
        if (!region) {
            byId("selection-help").textContent = "아이콘이 선명하게 보이는 영역을 다시 지정하세요.";
            return;
        }
        cancelSelection();
        huntTools.setSkillRegion(id, region);
        return;
    }
    configure(kind, value);
    cancelSelection();
    if (kind === "experience") {
        experienceReading = null;
        journal.resetExperienceSource();
        byId("choose-exp").focus();
        refreshStatus();
    } else if (kind === "solErda") {
        solErdaReading = null;
        journal.resetSolErdaSource();
        byId("choose-erda").focus();
        refreshStatus();
    } else {
        byId("choose-map").focus();
    }
}

function refreshTimer() {
    const now = Date.now();
    const ms = deadline ? Math.max(0, deadline - now) : timerExpired ? 0 : cooldownMs;
    const display = deadline || timerExpired ? formatRemaining(ms) : "—";
    if (byId("remaining").value !== display) byId("remaining").value = display;
    if (deadline && !ms) {
        deadline = 0;
        timerExpired = true;
        alertUser("timer");
    }
    byId("start-timer").textContent = deadline ? "15분 다시 시작" : "15분 시작";
    byId("reset-timer").disabled = !deadline && !timerExpired;
    huntTools.advance(now);
    const next = huntTools.nextTimer();
    const heading = next ? next.label : "실행 중인 타이머 없음";
    const remaining = !next ? "—" : next.approximate ? formatApproximateRemaining(next.remainingMs) : formatRemaining(next.remainingMs);
    const nextName = byId("next-timer-name");
    const nextRemaining = byId("next-timer-remaining");
    const nextTimer = byId("next-timer");
    nextTimer.hidden = !next;
    nextTimer.dataset.state = next?.phase ?? "";
    if (nextName.textContent !== heading) nextName.textContent = heading;
    if (nextRemaining.textContent !== remaining) nextRemaining.textContent = remaining;
    const wealth = huntTools.presetStatus("preset-wealth");
    const wealthStatus = byId("wealth-status");
    if (wealth && wealthStatus.value !== wealth.value) wealthStatus.value = wealth.value;
    if (wealth) wealthStatus.dataset.state = wealth.phase === "ending" || wealth.phase === "expired" ? "warning"
        : wealth.phase === "running" ? "active" : "";
    const session = journal.update(now);
    miniWindow.update({ ...session, rune: deadline ? display : "—", "next-timer": heading, remaining,
        capture: byId("capture-state").textContent, "rune-status": byId("rune-state").textContent, wealth: wealthStatus.value });
    refreshShareStart();
}

const huntTools = initHuntTools({
    notify: (kind, message, tag) => alertUser(kind, false, message, tag),
    prepareSound,
    chooseSkillRegion: (id, mode) => {
        cancelSelection();
        openSelection("skill", { id, mode });
    },
    onMonitoringChange: () => worker?.postMessage({
        type: "skills", skills: huntTools.monitoredSkills(), automatic: huntTools.automaticSkills(),
    }),
});
const journal = initHuntJournal();
const miniWindow = initMapleWindow({
    button: byId("hunt-pip"), template: byId("hunt-pip-template"), note: byId("hunt-note"),
    title: "TrackingMaple · 사냥", height: 290,
});
byId("capture-unavailable").hidden = captureSupported;
byId("capture-mode-field").hidden = !captureSupported;
byId("capture-mode-help").hidden = !captureSupported;
captureMode.value = settings.captureSurface;
if (handheld) byId("hunt-pip").hidden = true;
document.body.dataset.captureSupported = String(captureSupported);

captureMode.addEventListener("change", () => {
    if (!stream && !capturePending) {
        captureNote = "";
        configure("captureSurface", captureMode.value);
        refreshShareStart();
    }
});
byId("share").addEventListener("click", () =>
    startCapture(journal.status === "idle" || (resumeAfterReconnect && journal.status === "paused")));
byId("capture-guide-toggle").addEventListener("click", () => {
    guideVisible = !guideVisible;
    refreshStage();
});
byId("hunt-share-start").addEventListener("click", () => {
    if (!stream) startCapture(true);
    else if (captureReady()) startCapturedHunt();
});
byId("stop").addEventListener("click", () => {
    reconnectNeeded = false;
    resumeAfterReconnect = false;
    stopCapture("화면 공유가 종료됐어요.");
});
preview.addEventListener("resize", () => {
    if (selection && (selection.sourceSize.width !== preview.videoWidth || selection.sourceSize.height !== preview.videoHeight)) cancelSelection();
    refreshStage();
    refreshStatus();
});
byId("choose-monitor-view").addEventListener("click", () => openSelection("monitorView"));
byId("choose-map").addEventListener("click", () => {
    cancelSelection();
    openSelection("rune");
});
byId("clear-map").addEventListener("click", () => configure("rune", null));
byId("choose-exp").addEventListener("click", () => {
    cancelSelection();
    openSelection("experience");
});
byId("clear-exp").addEventListener("click", () => {
    experienceReading = null;
    journal.resetExperienceSource();
    configure("experience", null);
});
byId("choose-erda").addEventListener("click", () => {
    cancelSelection();
    openSelection("solErda");
});
byId("clear-erda").addEventListener("click", () => {
    solErdaReading = null;
    journal.resetSolErdaSource();
    configure("solErda", null);
});
const runeRepeat = byId("rune-repeat");
if ([...runeRepeat.options].some(({ value }) => value === settings.runeRepeat)) runeRepeat.value = settings.runeRepeat;
runeRepeat.addEventListener("change", () => configure("runeRepeat", runeRepeat.value));
const runeToggle = byId("rune-alert-enabled");
runeToggle.checked = settings.runeEnabled;
runeToggle.addEventListener("change", () => {
    if (runeToggle.checked) prepareSound();
    configure("runeEnabled", runeToggle.checked);
});
layer.addEventListener("pointerdown", (event) => {
    if (!selection || event.button !== 0 || selection.pointer !== null) return;
    layer.setPointerCapture(event.pointerId);
    selection.pointer = event.pointerId;
    selection.start = point(event);
    moveSelection(event);
});
layer.addEventListener("pointermove", moveSelection);
layer.addEventListener("pointerup", (event) => {
    if (selection?.pointer !== event.pointerId) return;
    moveSelection(event);
    selection.pointer = null;
});
layer.addEventListener("pointercancel", () => {
    if (selection) selection.pointer = null;
    box.hidden = true;
    byId("save-selection").disabled = true;
});
byId("save-selection").addEventListener("click", saveSelection);
byId("cancel-selection").addEventListener("click", cancelSelection);
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && selection) cancelSelection();
});
byId("test-sound").addEventListener("click", async () => {
    const ready = prepareSound();
    const fallback = async () => {
        if (await ready) playTone();
        byId("last-alert").textContent = "한국어 음성을 재생할 수 없어요. 기기의 한국어 음성 설정을 확인하세요.";
    };
    const started = playLocalVoice(runeAlertMessage, {
        onStart: () => { byId("last-alert").textContent = "룬 알림 음성을 재생했어요."; },
        onError: fallback,
    });
    if (!started) await fallback();
});
byId("notifications").addEventListener("click", async () => {
    try {
        await Notification.requestPermission();
    } finally {
        refreshNotificationButton();
    }
});
byId("start-timer").addEventListener("click", () => {
    prepareSound();
    deadline = Date.now() + cooldownMs;
    timerExpired = false;
    refreshTimer();
});
byId("reset-timer").addEventListener("click", () => {
    deadline = 0;
    timerExpired = false;
    refreshTimer();
});
document.addEventListener("visibilitychange", refreshTimer);
window.addEventListener("pagehide", () => stopCapture(""));
setInterval(() => {
    refreshStatus();
    refreshTimer();
}, 500);
refreshStatus();
refreshNotificationButton();
refreshTimer();
globalThis.speechSynthesis?.getVoices();

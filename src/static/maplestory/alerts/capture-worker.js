import { findRune } from "./detection.mjs";
import { nextRuneAlert, runeAlertState } from "./rune-alert.mjs";
import { classifySkillIcon, observeSkillIcon, skillSampleSize, skillSignature, skillVisionState } from "./skill-vision.mjs?v=maple-hunt-9";
import { confirmExperienceHud, readExperienceHud } from "./exp-text.mjs?v=maple-hunt-7";
import { readSolErdaPanel } from "./sol-erda-vision.mjs?v=maple-hunt-3";
import { automaticIconType, huntIconState, observeHuntIcon } from "./hunt-icon-vision.mjs?v=maple-hunt-10";
import { captureViewport, frameSizeKey, sameCaptureViewport } from "./capture-regions.mjs?v=maple-hunt-7";
import { findMinimap, minimapState, observeMinimap } from "./minimap-vision.mjs";

const canvas = new OffscreenCanvas(12, 8);
const context = canvas.getContext("2d", { willReadFrequently: true });
let runeRegions = {};
let runeState = runeAlertState();
let runeEnabled = true;
let lastRunePresence = false;
let lastRuneRegion = null;
let runeRepeat = "short";
let minimap = minimapState();
let nextMinimapSearch = 0;
let skills = new Map();
let huntIcons = new Map();
let nextHuntIconCheck = 0;
let experienceRegions = {};
let nextExperienceCheck = 0;
let experienceSamples = [];
let solErdaRegions = {};
let nextSolErdaCheck = 0;
let lastSolErdaReading = null;
let monitorViews = {};

const defaultExperienceRegion = { x: 0, y: .955, w: 1, h: .045 };

function sample(view, rect, width, height) {
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    const { source, x, y, displayWidth, displayHeight } = view;
    context.drawImage(source, x + rect.x * displayWidth, y + rect.y * displayHeight,
        rect.w * displayWidth, rect.h * displayHeight, 0, 0, width, height);
    return context.getImageData(0, 0, width, height);
}

function viewOf(source, { x, y, width, height }) {
    return { source, x, y, displayWidth: width, displayHeight: height };
}

function hasGameHud(view) {
    const { data, width, height } = sample(view, { x: .44, y: .9, w: .12, h: .09 }, 24, 24);
    let hp = -Infinity;
    for (let y = 0; y < height; y++) {
        let pink = 0;
        let cyan = 0;
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const r = data[i], g = data[i + 1], b = data[i + 2];
            if (r >= 165 && r >= g + 55 && r >= b + 12) pink++;
            if (g >= 145 && b >= 145 && g >= r + 50 && b >= r + 50) cyan++;
        }
        if (pink >= 10) hp = y;
        if (cyan >= 10 && y - hp >= 2 && y - hp <= 10) return true;
    }
    return readExperienceRegion(view, { x: 0, y: .982, w: 1, h: .018 }) !== null;
}

function findMonitorGame(source, size) {
    const configured = monitorViews[frameSizeKey(size)]?.rect;
    if (configured) {
        const windowed = captureViewport(size, configured);
        if (windowed.width >= 480 && windowed.height >= 300 && hasGameHud(viewOf(source, windowed))) return windowed;
    }
    const full = captureViewport(size);
    return hasGameHud(viewOf(source, full)) ? full : null;
}

function isDark(frame) {
    const { data } = sample(frame, { x: 0, y: 0, w: 1, h: 1 }, 12, 8);
    for (let i = 0; i < data.length; i += 4) {
        if (data[i] > 15 || data[i + 1] > 15 || data[i + 2] > 15) return false;
    }
    return true;
}

function hasSize(frame, region) {
    return frame.displayWidth === region.width && frame.displayHeight === region.height;
}

function findRuneIn(frame, rect) {
    const width = rect.w * frame.displayWidth;
    const height = rect.h * frame.displayHeight;
    const scale = Math.min(1, 480 / width, 320 / height);
    return findRune(sample(frame, rect, Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale))));
}

function resetRuneTracking() {
    minimap = minimapState();
    nextMinimapSearch = 0;
    lastRuneRegion = null;
    lastRunePresence = false;
    runeState.present = 0;
    runeState.absent = 0;
}

function currentMinimap(frame, now) {
    const previous = minimap.active ?? minimap.pending;
    if (!previous && now < nextMinimapSearch) return null;
    const scale = Math.min(1, 1920 / frame.displayWidth, 1080 / frame.displayHeight);
    const width = Math.round(frame.displayWidth * scale);
    const height = Math.round(frame.displayHeight * scale);
    // Recheck the discovered map and its header in a small crop. Search the full game view on loss.
    const left = previous ? Math.max(0, previous.x - 16) : 0;
    const top = previous ? Math.max(0, previous.y - 160) : 0;
    const right = previous ? Math.min(width, previous.x + previous.width + 16) : width;
    const bottom = previous ? Math.min(height, previous.y + previous.height + 28) : height;
    const crop = { x: left / width, y: top / height, w: (right - left) / width, h: (bottom - top) / height };
    const candidate = findMinimap(sample(frame, crop, right - left, bottom - top));
    if (candidate) {
        candidate.x += left;
        candidate.y += top;
    }
    nextMinimapSearch = previous ? now : now + 1000;
    const confirmed = observeMinimap(minimap, candidate);
    return confirmed && { x: confirmed.x / width, y: confirmed.y / height,
        w: confirmed.width / width, h: confirmed.height / height };
}

function checkRune(frame, now, size) {
    if (!runeEnabled) return;
    const automatic = currentMinimap(frame, now);
    const manual = minimap.found || minimap.pending ? null : runeRegions[size]?.rect;
    const rect = automatic ?? manual ?? null;
    const mode = automatic ? "auto" : manual ? "manual" : "waiting";
    const lastRect = lastRuneRegion?.rect;
    const shifted = rect && lastRect && ["x", "y", "w", "h"].some((key) => Math.abs(rect[key] - lastRect[key]) > .003);
    if (mode !== lastRuneRegion?.mode || shifted) {
        runeState.present = 0;
        runeState.absent = 0;
        lastRunePresence = false;
        lastRuneRegion = { mode, rect };
        postMessage({ type: "rune-region", mode, rect });
    }
    if (!rect) return;
    const present = findRuneIn(frame, rect) !== null;
    const alert = nextRuneAlert(runeState, present, now, runeRepeat);
    const visible = runeState.latched && (present || lastRunePresence);
    if (lastRunePresence !== visible) {
        lastRunePresence = visible;
        postMessage({ type: "rune-presence", present: visible });
    }
    if (alert) postMessage({ type: "alert", kind: "rune", repeat: alert === "repeat" });
}

function readExperienceRegion(frame, region) {
    const { displayWidth, displayHeight } = frame;
    const left = Math.floor(displayWidth * region.x);
    const top = Math.floor(displayHeight * region.y);
    const nativeWidth = Math.round(displayWidth * (region.x + region.w)) - left;
    const nativeHeight = Math.round(displayHeight * (region.y + region.h)) - top;
    const rect = { x: left / displayWidth, y: top / displayHeight,
        w: nativeWidth / displayWidth, h: nativeHeight / displayHeight };
    const width = Math.min(4096, nativeWidth);
    const height = Math.min(160, nativeHeight);
    if (width < 160 || height < 5) return null;
    return readExperienceHud(sample(frame, rect, width, height));
}

function checkExperience(frame, now, size) {
    if (now < nextExperienceCheck) return;
    nextExperienceCheck = now + 900;
    const region = experienceRegions[size]?.rect;
    const automatic = readExperienceRegion(frame, defaultExperienceRegion);
    const reading = automatic ?? (region ? readExperienceRegion(frame, region) : null);
    experienceSamples = [...experienceSamples.slice(-2), reading];
    const confirmed = confirmExperienceHud(experienceSamples);
    postMessage({ type: "experience", value: confirmed ? confirmed.percentage / 10 : null, amount: confirmed?.amount ?? null });
}

function checkSolErda(frame, now, size) {
    const region = solErdaRegions[size];
    if (!region || now < nextSolErdaCheck) return;
    nextSolErdaCheck = now + 1100;
    let reading = null;
    const { rect } = region;
    const width = Math.round(frame.displayWidth * rect.w);
    const height = Math.round(frame.displayHeight * rect.h);
    if (width >= 70 && width <= 360 && height >= 25 && height <= 155) {
        reading = readSolErdaPanel(sample(frame, rect, width, height));
    }
    const value = reading && lastSolErdaReading ? {
        fragments: reading.fragments === lastSolErdaReading.fragments ? reading.fragments : null,
    } : null;
    lastSolErdaReading = reading;
    postMessage({ type: "sol-erda", value });
}

function checkHuntIcons(frame, now) {
    if (!huntIcons.size || now < nextHuntIconCheck) return;
    const { displayWidth, displayHeight } = frame;
    const images = {};
    for (const [id, state] of huntIcons) {
        if (!state.position && now < state.nextSearch) continue;
        const type = automaticIconType(id);
        if (!images[type]) {
            const width = Math.min(Math.ceil(displayWidth * (type === "buff" ? .42 : .57)), 1500);
            const height = Math.min(Math.ceil(displayHeight * .22), 250);
            images[type] = sample(frame, { x: (displayWidth - width) / displayWidth,
                y: type === "buff" ? 0 : (displayHeight - height) / displayHeight,
                w: width / displayWidth, h: height / displayHeight }, width, height);
        }
        const reading = observeHuntIcon(images[type], state, id, type, performance.timeOrigin + now);
        const acquiring = state.position && (state.vision.stable === null || state.vision.stable === "visible");
        state.nextSearch = now + (acquiring ? 280 : 900);
        postMessage({ type: "hunt-icon", id, ...reading });
    }
    nextHuntIconCheck = now + 280;
}

function checkFrame(frame, now, size) {
    checkExperience(frame, now, size);
    checkSolErda(frame, now, size);
    checkHuntIcons(frame, now);

    checkRune(frame, now, size);
    for (const { id, mode, region, state } of skills.values()) {
        if (!hasSize(frame, region)) continue;
        const pixels = sample(frame, region.rect, skillSampleSize, skillSampleSize);
        const appearance = classifySkillIcon(region.signature, skillSignature(pixels.data));
        if (observeSkillIcon(state, appearance, mode)) postMessage({ type: "skill-activated", id });
    }
}

async function watch(readable, surface) {
    const reader = readable.getReader();
    let lastCheck = -Infinity;
    let lastStatus = -Infinity;
    let lastFrameSize = "";
    let lastViewport = null;
    let lastDark = false;
    try {
        while (true) {
            const { value: frame, done } = await reader.read();
            if (done) break;
            try {
                const now = performance.now();
                if (now - lastCheck < 300) continue;
                const sourceSize = { width: frame.displayWidth, height: frame.displayHeight };
                const viewport = surface === "monitor" ? findMonitorGame(frame, sourceSize) : captureViewport(sourceSize);
                const view = viewport ? viewOf(frame, viewport) : null;
                const dimensions = viewport ?? sourceSize;
                const frameSize = frameSizeKey(dimensions);
                const dark = view ? isDark(view) : false;
                const gap = Number.isFinite(lastCheck) && now - lastCheck > 1500;
                const changed = frameSize !== lastFrameSize || dark !== lastDark || !sameCaptureViewport(viewport, lastViewport);
                if (gap || changed) {
                    resetRuneTracking();
                    for (const skill of skills.values()) skill.state = skillVisionState();
                    for (const id of huntIcons.keys()) huntIcons.set(id, huntIconState());
                    nextHuntIconCheck = 0;
                    experienceSamples = [];
                    lastSolErdaReading = null;
                    nextExperienceCheck = 0;
                    nextSolErdaCheck = 0;
                }
                lastCheck = now;
                if (now - lastStatus >= 1000 || changed || gap) {
                    postMessage({ type: "frame", width: dimensions.width, height: dimensions.height, viewport, sourceSize, dark, gap });
                    lastStatus = now;
                    lastFrameSize = frameSize;
                    lastDark = dark;
                    lastViewport = viewport;
                }
                if (view && !dark) checkFrame(view, now, frameSize);
            } finally {
                frame.close();
            }
        }
        postMessage({ type: "ended" });
    } catch {
        postMessage({ type: "error" });
    } finally {
        reader.releaseLock();
    }
}

self.onmessage = ({ data }) => {
    if (data.type === "skills") {
        skills = new Map(data.skills.map((skill) => [skill.id, {
            ...skill, state: skills.get(skill.id)?.state ?? skillVisionState(),
        }]));
        huntIcons = new Map((data.automatic ?? []).filter(automaticIconType)
            .map((id) => [id, huntIcons.get(id) ?? huntIconState()]));
        nextHuntIconCheck = 0;
    } else if (data.type === "configure" && data.kind === "runeRepeat") {
        runeRepeat = data.value;
    } else if (data.type === "configure" && data.kind === "experience") {
        experienceRegions = data.value ?? {};
        nextExperienceCheck = 0;
        experienceSamples = [];
    } else if (data.type === "configure" && data.kind === "solErda") {
        solErdaRegions = data.value ?? {};
        nextSolErdaCheck = 0;
        lastSolErdaReading = null;
    } else if (data.type === "configure" && data.kind === "rune") {
        runeRegions = data.value ?? {};
        runeState = runeAlertState();
        resetRuneTracking();
    } else if (data.type === "configure" && data.kind === "runeEnabled") {
        runeEnabled = Boolean(data.value);
        runeState = runeAlertState();
        resetRuneTracking();
    } else if (data.type === "configure" && data.kind === "monitorView") {
        monitorViews = data.value ?? {};
    } else if (data.type === "start") {
        watch(data.readable, data.surface);
    }
};

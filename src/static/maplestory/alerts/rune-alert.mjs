import { confirmDetection, detectionState } from "./detection.mjs";

export const runeAlertMessage = "룬이 감지되었습니다.";
const repeatModes = new Map([
    ["short", { interval: 5000, limit: 2 }],
    ["once", { interval: 0, limit: 0 }],
    ["30", { interval: 30000, limit: Infinity }],
    ["60", { interval: 60000, limit: Infinity }],
    ["120", { interval: 120000, limit: Infinity }],
]);

export function runeAlertState() {
    return { ...detectionState(), repeatsLeft: 0, repeatAt: 0 };
}

export function nextRuneAlert(state, present, now, mode = "short") {
    const repeat = repeatModes.get(mode) ?? repeatModes.get("short");
    if (confirmDetection(state, present)) {
        state.repeatsLeft = repeat.limit;
        state.repeatAt = now + repeat.interval;
        state.mode = mode;
        return "first";
    }

    if (state.latched && state.mode !== mode) {
        state.repeatsLeft = repeat.limit;
        state.repeatAt = now + repeat.interval;
        state.mode = mode;
    }
    if (!state.latched || !present || state.repeatsLeft === 0 || now < state.repeatAt) return null;
    state.repeatsLeft--;
    state.repeatAt = now + repeat.interval;
    return "repeat";
}

export function selectRuneVoice(voices) {
    const korean = voices.filter((voice) => voice.localService && /^ko(?:-|$)/i.test(voice.lang));
    // The Web Speech API has no gender metadata. Prefer known Korean female voices.
    const preferred = /\b(?:heami|sunhi|female)\b|여성|헤아미|선희/i;
    return korean.find((voice) => preferred.test(voice.name))
        ?? korean.find((voice) => voice.default)
        ?? korean[0];
}

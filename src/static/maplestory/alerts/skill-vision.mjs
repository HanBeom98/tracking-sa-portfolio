export const skillSampleSize = 24;

export function skillSignature(rgba) {
    const luminance = new Uint8Array(rgba.length / 4);
    for (let i = 0; i < luminance.length; i++) {
        const start = i * 4;
        luminance[i] = Math.round((rgba[start] * 2 + rgba[start + 1] * 5 + rgba[start + 2]) / 8);
    }
    return luminance;
}

export function classifySkillIcon(reference, current) {
    let expectedTotal = 0;
    let currentTotal = 0;
    let difference = 0;
    for (let i = 0; i < reference.length; i++) {
        expectedTotal += reference[i];
        currentTotal += current[i];
        difference += Math.abs(reference[i] - current[i]);
    }
    if (difference / reference.length <= 9) return "visible";

    const ratio = currentTotal / expectedTotal;
    if (ratio < 0.23 || ratio > 0.83 || !Number.isFinite(ratio)) return "unknown";
    let shapeError = 0;
    let contrast = 0;
    const mean = expectedTotal / reference.length;
    for (let i = 0; i < reference.length; i++) {
        shapeError += Math.abs(current[i] - reference[i] * ratio);
        contrast += Math.abs(reference[i] - mean);
    }
    return contrast / reference.length >= 12 && shapeError / reference.length <= 12 ? "dimmed" : "unknown";
}

export function skillVisionState() {
    return { candidate: null, frames: 0, stable: null };
}

export function observeSkillIcon(state, appearance, mode) {
    if (appearance !== state.candidate) {
        state.candidate = appearance;
        state.frames = 0;
    }
    if (++state.frames !== 3) return false;
    const previous = state.stable;
    state.stable = appearance;
    return mode === "buff"
        ? previous !== null && previous !== "visible" && appearance === "visible"
        : previous === "visible" && appearance === "dimmed";
}

const quickslotReadingMaxAgeMs = 3000;

export function observeQuickslotClock(state, { seconds, sampledAt, ready }) {
    state.ready = ready === true;
    if (state.ready) {
        state.sample = null;
        state.endsAt = null;
        state.confirmedAt = sampledAt;
        return;
    }
    if (!Number.isInteger(seconds) || seconds < 1 || !Number.isFinite(sampledAt)) {
        state.sample = null;
        return;
    }

    const last = state.sample;
    const endsAt = sampledAt + seconds * 1000;
    state.sample = { seconds, sampledAt, endsAt };
    if (!last || sampledAt <= last.sampledAt || sampledAt - last.sampledAt > quickslotReadingMaxAgeMs ||
        seconds > last.seconds || Math.abs(endsAt - last.endsAt) > 1000) return;

    // Do not push the deadline later just because a whole-second digit was painted twice.
    state.endsAt = Math.min(endsAt, last.endsAt);
    state.confirmedAt = sampledAt;
}

export function quickslotClockStatus(state, now) {
    if (!Number.isFinite(state.confirmedAt) || now - state.confirmedAt > quickslotReadingMaxAgeMs) return null;
    if (state.ready) return { ready: true };
    return state.endsAt > now ? { remainingMs: state.endsAt - now } : null;
}

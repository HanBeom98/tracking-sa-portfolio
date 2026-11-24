export const minExperienceMeasureMs = 15000;

export function emptyExperience() {
    return { gained: 0, observedMs: 0, last: null };
}

export function measureExperience(state, value, now) {
    if (!Number.isFinite(value) || value < 0 || value > 10000) {
        state.last = null;
        return;
    }
    value = Math.round(value * 10) / 10;
    const previous = state.last;
    state.last = { value, now };
    if (!previous) return;

    const elapsed = now - previous.now;
    if (elapsed <= 0 || elapsed > 4200) return;
    const change = value - previous.value;
    if (change < 0 && change >= -.31) {
        state.last.value = previous.value;
        state.observedMs += elapsed;
        return;
    }

    const crossedLevel = previous.value >= 9000 && value <= 1000;
    const gained = crossedLevel ? 10000 + change : change;
    if (gained < 0 || gained > 2300) return;
    state.gained = Math.round((state.gained + gained) * 10) / 10;
    state.observedMs += elapsed;
}

export function validExperience(value) {
    return value && Number.isSafeInteger(Math.round(value.gained * 10)) && Number.isFinite(value.gained) && value.gained >= 0 &&
        Number.isFinite(value.observedMs) && value.observedMs >= 0;
}

const percentFormat = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 3 });
const exactPercentFormat = new Intl.NumberFormat("ko-KR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const pacePercentFormat = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 });

export function formatExperienceProgress(points, fixedDigits = false) {
    return (fixedDigits ? exactPercentFormat : percentFormat).format(points / 100);
}

function formatPace(percent) {
    if (percent > 0 && percent < .001) return "<0.001%";
    return (percent < .01 ? percentFormat : pacePercentFormat).format(percent) + "%";
}

export function experiencePace(state) {
    if (!validExperience(state) || state.observedMs < minExperienceMeasureMs) return null;
    const perHour = state.gained * 3600000 / (100 * state.observedMs);
    return { perHour: formatPace(perHour), perTwoHours: formatPace(perHour * 2) };
}

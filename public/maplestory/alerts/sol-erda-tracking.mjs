export function emptySolErda() {
    return { fragments: null, last: null };
}

export function restoreSolErda(value) {
    const state = emptySolErda();
    if (Number.isSafeInteger(value?.fragments) && value.fragments >= 0) state.fragments = value.fragments;
    return state;
}

export function measureSolErda(state, reading, now) {
    const current = reading.fragments;
    if (!Number.isSafeInteger(current) || current < 0) return;
    const previous = state.last;
    state.fragments ??= 0;
    if (!previous || now <= previous.now || now - previous.now > 6500) {
        state.last = { value: current, now };
        return;
    }
    const gain = current - previous.value;
    // Confirm spends and large jumps to avoid counting a missed leading digit.
    if ((gain < 0 || gain > 30) && previous.pending !== current) {
        state.last = { value: previous.value, now, pending: current };
        return;
    }
    state.last = { value: current, now };
    if (gain > 0 && gain <= 30) state.fragments += gain;
}

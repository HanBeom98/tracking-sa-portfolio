export function reminderState(durationMs) {
    return { endsAt: null, remainingMs: durationMs, notified: false };
}

export function startReminder(state, now) {
    state.endsAt = now + state.remainingMs;
}

export function pauseReminder(state, now) {
    if (state.endsAt === null) return;
    state.remainingMs = Math.max(0, state.endsAt - now);
    state.endsAt = null;
}

export function shiftReminder(state, offsetMs, now) {
    if (state.endsAt === null || state.endsAt <= now) return;
    state.endsAt = Math.max(now, state.endsAt + offsetMs);
    state.remainingMs = state.endsAt - now;
}

export function advanceReminder(config, state, now) {
    if (state.endsAt === null) return false;
    const alert = !state.notified && now >= state.endsAt - config.leadMs;
    state.notified ||= alert;
    state.remainingMs = Math.max(0, state.endsAt - now);
    if (state.remainingMs > 0) return alert;

    if (config.repeat) {
        const skipped = Math.floor((now - state.endsAt) / config.durationMs);
        state.endsAt += (skipped + 1) * config.durationMs;
        state.remainingMs = state.endsAt - now;
        state.notified = false;
    } else {
        state.endsAt = null;
    }
    return alert;
}

export function advanceBuffReminder(config, state, now) {
    const expired = state.endsAt !== null && now >= state.endsAt;
    const alert = advanceReminder(config, state, now);
    return expired ? "ended" : alert ? "lead" : null;
}

export function formatRemaining(ms) {
    const seconds = Math.ceil(ms / 1000);
    return [Math.floor(seconds / 60), seconds % 60].map((part) => String(part).padStart(2, "0")).join(":");
}

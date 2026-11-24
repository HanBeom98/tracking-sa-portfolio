export function emptySession() {
    return { status: "idle", startedAt: null, runningSince: null, accruedMs: 0 };
}

export function validHuntSession(session) {
    if (!session || !["idle", "running", "paused", "finished"].includes(session.status) ||
        !Number.isFinite(session.accruedMs) || session.accruedMs < 0) return false;
    if (session.status === "idle") return session.startedAt === null && session.runningSince === null;
    if (!Number.isFinite(session.startedAt)) return false;
    return session.status === "running" ? Number.isFinite(session.runningSince) : session.runningSince === null;
}

export function huntElapsed(session, now) {
    const current = session.runningSince === null ? 0 : Math.max(0, now - session.runningSince);
    return session.accruedMs + current;
}

export function runHunt(session, now) {
    if (session.status !== "idle" && session.status !== "paused") return;
    session.startedAt ??= now;
    session.runningSince = now;
    session.status = "running";
}

export function stopHunt(session, now, status) {
    if (session.status !== "running" && session.status !== "paused") return;
    session.accruedMs = huntElapsed(session, now);
    session.runningSince = null;
    session.status = status;
}

export function formatHuntTime(ms) {
    const seconds = Math.floor(ms / 1000);
    return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
        .map((part) => String(part).padStart(2, "0")).join(":");
}

export function parseHuntCount(value) {
    const input = value.trim();
    if (!input) return null;
    if (!/^\d{1,27}$|^\d{1,3}(?:,\d{3}){1,8}$/.test(input)) return undefined;
    return BigInt(input.replaceAll(",", "")).toString();
}

export function huntRate(value, elapsedMs) {
    if (value === null || elapsedMs < 1000) return null;
    const elapsed = BigInt(Math.round(elapsedMs));
    return ((BigInt(value) * 3600000n + elapsed / 2n) / elapsed).toString();
}

const numberFormat = new Intl.NumberFormat("ko-KR");
const units = [[10n ** 16n, "경"], [10n ** 12n, "조"], [10n ** 8n, "억"], [10n ** 4n, "만"]];

export function formatHuntCount(value, compact = false) {
    if (value === null) return "—";
    const number = BigInt(value);
    if (compact) {
        const unit = units.find(([threshold]) => number >= threshold);
        if (unit) {
            const [threshold, label] = unit;
            const scaled = number * 100n / threshold;
            const whole = numberFormat.format(scaled / 100n);
            const fraction = (scaled % 100n).toString().padStart(2, "0").replace(/0+$/, "");
            return whole + (fraction ? "." + fraction : "") + label;
        }
    }
    return numberFormat.format(number);
}

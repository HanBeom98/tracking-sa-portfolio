const profileKey = "tracking-sa.maplestory-profile.v1";
const bossKey = "tracking-sa.maplestory-boss.v1";
export const huntKey = "tracking-sa.maplestory-hunts.v1";
const dayMs = 86400000;
const weekMs = 7 * dayMs;
const koreaOffsetMs = 9 * 3600000;

export function readMapleData(key) {
    try {
        return JSON.parse(localStorage.getItem(key)) ?? null;
    } catch {
        return null;
    }
}

export function writeMapleData(key, value) {
    try {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch {
        return false;
    }
}

export function mapleProfile() {
    const profile = readMapleData(profileKey);
    if (typeof profile?.name !== "string" || !Number.isFinite(profile.savedAt)) return null;
    if (Date.now() - profile.savedAt >= 30 * dayMs) return { name: profile.name, savedAt: profile.savedAt };
    return profile;
}

export function saveMapleProfile(profile) {
    return writeMapleData(profileKey, profile);
}

export function readBossData() {
    const data = readMapleData(bossKey);
    return {
        plans: Array.isArray(data?.plans) ? data.plans : [],
        records: Array.isArray(data?.records) ? data.records : [],
        settings: data?.settings && typeof data.settings === "object" ? data.settings : {},
    };
}

export function saveBossData(data) {
    return writeMapleData(bossKey, data);
}

export function bossWeek(now = Date.now()) {
    // 1970-01-01 was a Thursday.
    const weekStart = Math.floor((now + koreaOffsetMs) / weekMs) * weekMs;
    return new Date(weekStart).toISOString().slice(0, 10);
}

export function nextBossReset(now = Date.now()) {
    return (Math.floor((now + koreaOffsetMs) / weekMs) + 1) * weekMs - koreaOffsetMs;
}

export function mapleDay(now = Date.now()) {
    return new Date(now + koreaOffsetMs).toISOString().slice(0, 10);
}

export function mapleResetTimes(now = Date.now()) {
    const tomorrow = (Math.floor((now + koreaOffsetMs) / dayMs) + 1) * dayMs - koreaOffsetMs;
    const koreanDate = new Date(now + koreaOffsetMs);
    const untilSunday = 7 - koreanDate.getUTCDay();
    return {
        daily: tomorrow,
        weekly: nextBossReset(now),
        sunday: tomorrow + (untilSunday - 1) * dayMs,
        monthly: Date.UTC(koreanDate.getUTCFullYear(), koreanDate.getUTCMonth() + 1, 1) - koreaOffsetMs,
    };
}

export function bossMesoShare({ meso, party }) {
    return Number.isSafeInteger(meso) && Number.isSafeInteger(party) && party > 0 ? Math.floor(meso / party) : null;
}

export function summarizeBossWeek(plans, character, week) {
    const own = plans.filter((plan) => plan.character === character);
    const cleared = own.filter((plan) => plan.clearedWeek === week);
    return {
        count: cleared.length,
        total: own.length,
        meso: cleared.reduce((sum, plan) => sum + (bossMesoShare(plan) ?? 0), 0),
    };
}

export function summarizeMapleIncome(plans, records, character, now = Date.now()) {
    const week = bossWeek(now);
    const start = Date.parse(week + "T00:00:00+09:00");
    const end = nextBossReset(now);
    const own = plans.filter((entry) => entry.character === character);
    const cleared = own.filter((entry) => entry.clearedWeek === week);
    const crystals = cleared.map(bossMesoShare).filter((value) => value !== null && value >= 0);
    const savedHunts = records.filter((entry) => (entry?.character || "") === character &&
        Number.isFinite(entry?.savedAt) && entry.savedAt >= start && entry.savedAt < end);
    const huntAmounts = savedHunts.filter((entry) => /^\d{1,27}$/.test(entry.meso ?? ""));
    return {
        cleared: cleared.length,
        remaining: own.filter((entry) => entry.clearedWeek !== week),
        crystals: crystals.length ? crystals.reduce((sum, value) => sum + BigInt(value), 0n) : null,
        huntMeso: huntAmounts.length ? huntAmounts.reduce((sum, entry) => sum + BigInt(entry.meso), 0n) : null,
        huntCount: savedHunts.length,
        huntTimeMs: savedHunts.reduce((sum, entry) => sum + (Number.isFinite(entry.elapsedMs) && entry.elapsedMs > 0 ? entry.elapsedMs : 0), 0),
    };
}

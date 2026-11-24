const formatter = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 });
const errors = {
    INVALID_NICKNAME: "닉네임에는 글자와 숫자만 입력해 주세요.",
    CHARACTER_NOT_FOUND: "캐릭터를 찾지 못했어요. 닉네임을 확인해 주세요.",
    KEY_NOT_CONFIGURED: "지금은 캐릭터 조회를 이용할 수 없어요.",
    RATE_LIMITED: "조회 한도에 도달했어요. 잠시 후 다시 시도해 주세요.",
};

export function characterUrl(path, name) {
    return name ? path + "?" + new URLSearchParams({ character: name }) : path;
}

export function requestedCharacter() {
    return new URLSearchParams(location.search).get("character")?.trim() || "";
}

export async function fetchCharacterView(name, view) {
    let response;
    try {
        response = await fetch("/api/maple-character?" + new URLSearchParams({ name, include: view }),
            { signal: AbortSignal.timeout(12000) });
    } catch {
        throw new Error("캐릭터 조회 서버에 연결하지 못했어요.");
    }
    const data = await response.json().catch(() => null);
    if (!response.ok || !data) {
        throw new Error(errors[data?.error] ?? "캐릭터 조회에 실패했어요. 잠시 후 다시 시도해 주세요.");
    }
    return data;
}

export async function fetchCharacter(name, view) {
    const data = await fetchCharacterView(name, view);
    if (!data.profile) throw new Error("캐릭터 조회에 실패했어요. 잠시 후 다시 시도해 주세요.");
    return data;
}

export function profileDescription(profile) {
    return [profile?.world, profile?.job, profile?.level && "Lv. " + profile.level].filter(Boolean).join(" · ");
}

const powerUnits = [[1_000_000_000_000n, "조"], [100_000_000n, "억"], [10_000n, "만"]];

export function formatPower(value) {
    if (!/^\d{1,24}$/.test(value ?? "")) return "—";
    let remaining = BigInt(value);
    const parts = [];
    for (const [unit, label] of powerUnits) {
        if (remaining < unit) continue;
        parts.push(formatter.format(remaining / unit) + label);
        remaining %= unit;
    }
    if (remaining || !parts.length) parts.push(formatter.format(remaining));
    return parts.join(" ");
}

function percentage(value) {
    return Number.isFinite(value) ? formatter.format(value) + "%" : "—";
}

export function renderStats(root, stats, cooldown = null) {
    const fixed = stats?.cooldownSeconds ?? (cooldown?.fixedSource === "hat" ? cooldown.fixedSeconds : null);
    const reductions = [
        fixed > 0 ? "−" + formatter.format(fixed) + "초" : null,
        stats?.cooldownPercent > 0 ? "−" + percentage(stats.cooldownPercent) : null,
    ].filter(Boolean);
    root.querySelector("[data-stat=power]").textContent = formatPower(stats?.power);
    root.querySelector("[data-stat=cooldown]").textContent = reductions.join(" · ") ||
        (fixed === 0 ? "0초" : stats?.cooldownPercent === 0 ? "0%" : "—");
    root.querySelector("[data-stat=cooldown]").title = cooldown?.fixedSource === "hat" ? "확인된 모자 옵션 기준" : "";
    root.querySelector("[data-stat=drop]").textContent = percentage(stats?.drop);
    root.querySelector("[data-stat=meso]").textContent = percentage(stats?.meso);
}

export function lookupTime(timestamp) {
    return Number.isFinite(timestamp) ? new Intl.DateTimeFormat("ko-KR", {
        timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit",
    }).format(timestamp) + " KST 조회" : "";
}

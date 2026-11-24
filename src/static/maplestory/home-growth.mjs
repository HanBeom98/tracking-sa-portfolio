import { mapleDay, readMapleData, writeMapleData } from "./maple-data.mjs?v=tracking-maple-3";
import { formatPower, lookupTime } from "./profile-view.mjs?v=tracking-maple-3";

const dayMs = 86400000;
const recordsKey = "tracking-sa.maplestory-character-records.v1";
const number = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 3 });
const chartNumber = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 });
const byId = (id) => document.getElementById(id);
const signed = (value) => (value > 0 ? "+" : value < 0 ? "−" : "") + number.format(Math.abs(value));
const rateExists = (value) => Number.isFinite(value) && value >= 0 && value <= 100;
const validPower = (value) => typeof value === "string" && /^\d{1,24}$/.test(value);
const dayLabel = (date) => Number(date.slice(5, 7)) + "/" + Number(date.slice(8));
const characterKey = ({ name, world }) => JSON.stringify([name, world]);

export function growthChanges(day, snapshots, current) {
    const now = Date.parse(day + "T00:00:00+09:00");
    const byDate = new Map(snapshots.map((snapshot) => [snapshot.date, snapshot]));
    if (current) byDate.set(day, current);
    return Array.from({ length: 7 }, (_, index) => {
        const date = mapleDay(now - (6 - index) * dayMs);
        const prior = byDate.get(mapleDay(now - (7 - index) * dayMs));
        const next = byDate.get(date);
        const result = { date, level: next?.level, levelUp: false, change: null };
        if (!prior || !next) return result;
        if (next.level > prior.level) return { ...result, levelUp: true };
        if (next.level !== prior.level || !rateExists(prior.expRate) || !rateExists(next.expRate)) return result;
        const change = Math.round((next.expRate - prior.expRate) * 1000) / 1000;
        return change >= 0 ? { ...result, change } : result;
    });
}

export function advanceVisit(record, latest) {
    const old = record?.latest;
    if (!old) return { latest, previous: null };
    if (latest.fetchedAt <= old.fetchedAt) {
        return { latest: old, previous: latest.fetchedAt < old.fetchedAt ? null : record.previous };
    }
    return { latest, previous: {
        level: old.level,
        expRate: old.expRate,
        power: old.power ?? record.previous?.power ?? null,
        fetchedAt: old.fetchedAt,
        powerAt: old.power ? old.fetchedAt : record.previous?.powerAt,
    } };
}

function readRecords() {
    const records = readMapleData(recordsKey);
    return Array.isArray(records) ? records.filter((entry) => typeof entry?.key === "string") : [];
}

function saveRecord(records, record) {
    let recent = 0;
    const updated = [record, ...records.filter(({ key }) => key !== record.key)];
    return writeMapleData(recordsKey, updated.filter((entry) => entry.setups || recent++ < 30));
}

function snapshot(summary) {
    if (!summary || !Number.isFinite(summary.fetchedAt)) return null;
    return {
        fetchedAt: summary.fetchedAt,
        level: summary.profile.level,
        expRate: summary.profile.expRate,
        power: validPower(summary.stats?.power) ? summary.stats.power : null,
    };
}

function renderChart(chart, items, peak) {
    chart.replaceChildren(...items.map((item, index) => {
        const row = document.createElement("li");
        const date = document.createElement("time");
        const value = document.createElement("span");
        const track = document.createElement("span");
        const bar = document.createElement("span");
        const today = index === items.length - 1;
        row.dataset.kind = item.levelUp ? "level" : item.change === null ? "missing" : today ? "today" : "normal";
        value.className = "growth-value";
        track.className = "growth-track";
        bar.className = "growth-bar";
        track.setAttribute("aria-hidden", "true");
        date.dateTime = item.date;
        date.textContent = today ? "오늘" : dayLabel(item.date);
        value.textContent = item.levelUp ? "레벨업" : item.change === null ? "—"
            : item.change > 0 && item.change < 0.01 ? "<0.01" : chartNumber.format(item.change);
        row.title = dayLabel(item.date) + " " + (item.levelUp ? "레벨업" : item.change === null ? "기록 없음"
            : number.format(item.change) + "%p");
        row.setAttribute("aria-label", row.title);
        bar.style.setProperty("--growth-height", (item.change > 0 ? item.change / peak * 100 : 0) + "%");
        track.append(bar);
        row.append(value, track, date);
        return row;
    }));
}

export function initHomeGrowth() {
    const chart = byId("growth-chart");
    const average = byId("growth-average");
    const growthNote = byId("growth-note");
    const recordsRoot = byId("profile-records");
    const setupCards = Array.from(recordsRoot.querySelectorAll("[data-setup]"));
    const status = byId("setup-status");
    let recordKey = null;
    let current = null;
    let comparison = null;
    let requestId = 0;
    let elapsedDay = null;

    function renderRecords() {
        recordsRoot.hidden = !recordKey;
        if (!recordKey) return;
        const record = readRecords().find(({ key }) => key === recordKey);
        for (const card of setupCards) {
            const saved = record?.setups?.[card.dataset.setup];
            card.querySelector("[data-value]").textContent = formatPower(saved?.power);
            card.querySelector("[data-time]").textContent = saved
                ? lookupTime(saved.fetchedAt) + " 기준" : "저장한 전투력 없음";
            const button = card.querySelector("button");
            button.disabled = !validPower(current?.power);
            button.textContent = saved ? "조회한 전투력으로 갱신" : "조회한 전투력 저장";
            button.setAttribute("aria-label", card.querySelector("h2").textContent.trim() + " " + button.textContent);
        }
        const changes = byId("visit-changes");
        const note = byId("visit-note");
        changes.hidden = !comparison || !current;
        if (!comparison || !current) {
            note.textContent = "이 브라우저에서 다음에 조회하면 변화를 볼 수 있어요.";
            return;
        }
        const levelChange = current.level - comparison.level;
        byId("visit-exp").textContent = levelChange !== 0 && Number.isInteger(levelChange)
            ? "Lv. " + comparison.level + " → " + current.level
            : rateExists(current.expRate) && rateExists(comparison.expRate)
                ? signed(Math.round((current.expRate - comparison.expRate) * 1000) / 1000) + "%p" : "—";
        const canComparePower = validPower(current.power) && validPower(comparison.power);
        const power = byId("visit-power");
        if (canComparePower) {
            const difference = BigInt(current.power) - BigInt(comparison.power);
            power.textContent = (difference > 0n ? "+" : difference < 0n ? "−" : "")
                + formatPower((difference < 0n ? -difference : difference).toString());
        } else power.textContent = "—";
        power.title = canComparePower ? lookupTime(comparison.powerAt ?? comparison.fetchedAt) + " 기준" : "";
        note.textContent = lookupTime(comparison.fetchedAt) + " 대비"
            + (canComparePower && comparison.powerAt !== comparison.fetchedAt ? " · 전투력은 " + power.title : "");
    }

    function showHistory(data) {
        const { day, snapshots } = data;
        if (!/^\d{4}-\d\d-\d\d$/.test(day ?? "") || !Array.isArray(snapshots)) throw new Error("Invalid history");
        const datedCurrent = current && mapleDay(current.fetchedAt) === day ? current : null;
        const items = growthChanges(day, snapshots, datedCurrent);
        const visible = items.some((item) => item.change !== null || item.levelUp);
        renderChart(chart, items, Math.max(0.001, ...items.map(({ change }) => change ?? 0)));
        chart.hidden = !visible;
        const samples = items.slice(0, -1).filter((item) => item.level === current?.level && item.change !== null);
        const mean = samples.length < 2 ? null : samples.reduce((sum, item) => sum + item.change, 0) / samples.length;
        average.hidden = mean === null;
        if (mean !== null) average.textContent = "일평균 +" + chartNumber.format(mean) + "%p";
        growthNote.textContent = visible ? "일일 경험치 변화(%p) · 한국 시간" : "최근 경험치 변화를 비교할 기록이 부족해요.";
    }

    async function loadHistory(name) {
        const id = ++requestId;
        chart.hidden = true;
        average.hidden = true;
        growthNote.textContent = name ? "최근 성장 기록을 불러오는 중이에요." : "";
        if (!name) return;
        try {
            const query = new URLSearchParams({ name, include: "growth", day: mapleDay() });
            const response = await fetch("/api/maple-character?" + query, { signal: AbortSignal.timeout(12000) });
            if (!response.ok) throw new Error("History unavailable");
            const data = await response.json();
            if (id === requestId) showHistory(data);
        } catch {
            if (id === requestId) growthNote.textContent = "성장 기록을 불러오지 못했어요. 다시 검색해 주세요.";
        }
    }

    for (const card of setupCards) {
        card.querySelector("button").addEventListener("click", () => {
            if (!recordKey || !validPower(current?.power)) return;
            const key = recordKey;
            const records = readRecords();
            const record = records.find((entry) => entry.key === key);
            const saved = saveRecord(records, { ...record, key, setups: {
                ...record?.setups, [card.dataset.setup]: { power: current.power, fetchedAt: current.fetchedAt },
            } });
            const title = card.querySelector("h2").textContent.trim();
            status.textContent = saved ? title + " 전투력을 이 브라우저에 저장했어요." : "브라우저가 전투력 저장을 차단했어요.";
            renderRecords();
        });
    }
    window.addEventListener("storage", (event) => {
        if (event.key === recordsKey || event.key === null) renderRecords();
    });

    return {
        select(profile, summary) {
            recordKey = profile ? characterKey(profile) : null;
            current = snapshot(summary);
            comparison = null;
            elapsedDay = mapleDay();
            status.textContent = "";
            if (current) {
                const records = readRecords();
                const record = records.find(({ key }) => key === recordKey);
                const visit = advanceVisit(record?.visit, current);
                comparison = visit.previous;
                if (visit.latest === current) saveRecord(records, { ...record, key: recordKey, visit });
            }
            renderRecords();
            loadHistory(current ? profile.name : null);
            if (profile && !current) growthNote.textContent = "최근 성장 기록을 준비하고 있어요.";
        },
        updateDay(profile, now) {
            const day = mapleDay(now);
            if (elapsedDay === day) return;
            elapsedDay = day;
            if (current && profile) loadHistory(profile.name);
        },
    };
}

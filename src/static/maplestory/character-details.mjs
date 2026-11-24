import { fetchCharacterView, lookupTime } from "./profile-view.mjs?v=tracking-maple-3";

const number = new Intl.NumberFormat("ko-KR");
const recordDate = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric" });
const roman = ["I", "II", "III"];

function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
}

function message(text) {
    return node("p", "quiet detail-message", text);
}

function count(value, unit = "") {
    return Number.isSafeInteger(value) && value >= 0 ? number.format(value) + unit : "—";
}

function splitSymbolName(name) {
    const match = name.match(/^([^:：]+)[:：]\s*(.+)$/);
    return match ? [match[1].trim(), match[2]] : ["기타 심볼", name];
}

function symbolType(type) {
    switch (type.replace(/\s/g, "")) {
        case "아케인심볼": return { force: "arcane", maxLevel: 20 };
        case "어센틱심볼":
        case "그랜드어센틱심볼": return { force: "authentic", maxLevel: 11 };
        default: return { force: null, maxLevel: null };
    }
}

export function symbolUpgradeState(symbol, type) {
    const { maxLevel } = symbolType(type);
    if (maxLevel !== null && symbol.level >= maxLevel) return "max";
    if (symbol.required > 0 && Number.isSafeInteger(symbol.growth)) {
        return symbol.growth >= symbol.required ? "ready" : "growing";
    }
    return null;
}

export function symbolForceGroups(symbols) {
    return groupBy(symbols, ({ name }) => symbolType(splitSymbolName(name)[0]).force);
}

function forceSummary(groups, type) {
    const group = groups.get(type);
    if (!group?.length) return ["—", ""];
    const hasForce = group.every((symbol) => Number.isSafeInteger(symbol.force));
    const force = hasForce ? count(group.reduce((total, symbol) => total + symbol.force, 0)) : "—";
    return [force, "장착 심볼 " + count(group.length, "개")];
}

function groupBy(items, key) {
    const groups = new Map();
    for (const item of items ?? []) {
        const label = key(item);
        if (!groups.has(label)) groups.set(label, []);
        groups.get(label).push(item);
    }
    return groups;
}

function renderMetrics(root, details) {
    const groups = symbolForceGroups(details.symbols);
    const dojang = details.dojang;
    const union = details.union;
    const time = dojang?.seconds > 0 ? Math.floor(dojang.seconds / 60) + "분 " + dojang.seconds % 60 + "초" : "";
    const date = Number.isFinite(dojang?.achievedAt) ? recordDate.format(dojang.achievedAt) : "";
    const entries = {
        dojang: [dojang?.floor > 0 ? count(dojang.floor, "층") : "—", dojang?.floor === 0 ? "클리어 기록 없음" : [time, date].filter(Boolean).join(" · ")],
        union: [union?.level > 0 ? "Lv. " + count(union.level) : "—", union?.level === 0 ? "유니온 기록 없음"
            : [union?.grade, union?.artifact > 0 && "아티팩트 Lv. " + count(union.artifact)].filter(Boolean).join(" · ")],
        authentic: forceSummary(groups, "authentic"),
        arcane: forceSummary(groups, "arcane"),
    };
    for (const [key, [value, note]] of Object.entries(entries)) {
        root.querySelector('[data-value="' + key + '"]').textContent = value;
        root.querySelector('[data-note="' + key + '"]').textContent = note;
    }
    root.hidden = false;
}

function symbolCard(symbol, type) {
    const [, region] = splitSymbolName(symbol.name);
    const card = node("li", "symbol-card");
    const top = node("div", "symbol-card-line");
    if (symbol.icon) {
        const img = node("img", "symbol-icon");
        img.alt = "";
        img.width = 38;
        img.height = 38;
        img.loading = "lazy";
        img.referrerPolicy = "no-referrer";
        img.addEventListener("error", () => { img.hidden = true; }, { once: true });
        img.src = symbol.icon;
        top.append(img);
    }
    const text = node("div");
    text.append(node("h4", "", region), node("p", "quiet", symbol.level === null ? "" : "Lv. " + count(symbol.level)));
    top.append(text);
    const label = symbolType(type).force ? "포스 " : "증가 수치 ";
    if (symbol.force !== null) top.append(node("strong", "symbol-force", label + count(symbol.force)));
    card.append(top);
    const state = symbolUpgradeState(symbol, type);
    if (state === "max") {
        card.append(node("p", "symbol-status", "최대 레벨"));
    } else if (state) {
        const progress = node("progress", "symbol-progress");
        progress.max = symbol.required;
        progress.value = symbol.growth;
        progress.setAttribute("aria-label", region + " 심볼 성장치");
        const growth = node("div", "symbol-growth-row");
        if (state === "ready") growth.append(node("p", "symbol-status", "강화 가능"));
        growth.append(node("p", "quiet symbol-growth", count(symbol.growth) + " / " + count(symbol.required)));
        card.append(progress, growth);
    }
    return card;
}

function renderSymbols(symbols) {
    if (!symbols) return [message("심볼 정보를 가져오지 못했어요.")];
    if (!symbols.length) return [message("장착한 심볼이 없어요.")];
    return [...groupBy(symbols, ({ name }) => splitSymbolName(name)[0])].map(([type, items]) => {
        const section = node("section", "symbol-group");
        const heading = node("div", "row");
        heading.append(node("h3", "", type), node("span", "quiet", count(items.length, "개")));
        const list = node("ul", "symbol-grid");
        list.append(...items.map((item) => symbolCard(item, type)));
        section.append(heading, list);
        return section;
    });
}

function renderHexa({ cores, stats }) {
    const skills = node("section", "hexa-section");
    skills.append(node("h3", "", "HEXA 매트릭스"));
    if (cores?.length) {
        const list = node("ul", "hexa-grid");
        list.append(...cores.map((core) => {
            const item = node("li", "hexa-card");
            item.append(node("span", "quiet", core.type ?? ""), node("h4", "", core.name),
                node("strong", "hexa-level", "Lv. " + count(core.level)));
            if (core.eventLevel > 0) item.append(node("span", "quiet", "이벤트 레벨 +" + count(core.eventLevel)));
            return item;
        }));
        skills.append(list);
    } else skills.append(message(cores ? "장착한 HEXA 코어가 없어요." : "HEXA 코어를 가져오지 못했어요."));

    const statsSection = node("section", "hexa-section");
    statsSection.append(node("h3", "", "HEXA 스탯"));
    if (stats?.length) {
        const list = node("ul", "hexa-grid");
        list.append(...stats.map((core) => {
            const item = node("li", "hexa-card");
            item.append(node("h4", "", "HEXA 스탯 " + roman[core.slot - 1]));
            if (core.grade !== null) item.append(node("span", "quiet", "코어 등급 " + count(core.grade)));
            const values = node("dl", "hexa-stats");
            for (const stat of core.stats) {
                const row = node("div");
                row.append(node("dt", "", stat.label), node("dd", "", "Lv. " + count(stat.level)));
                values.append(row);
            }
            item.append(values);
            return item;
        }));
        statsSection.append(list);
    } else statsSection.append(message(stats ? "장착한 HEXA 스탯이 없어요." : "HEXA 스탯을 가져오지 못했어요."));
    return [skills, statsSection];
}

export function initCharacterDetails() {
    const root = document.getElementById("character-details");
    const metrics = document.getElementById("character-metrics");
    const content = document.getElementById("character-detail-content");
    const status = document.getElementById("character-detail-status");
    const time = document.getElementById("character-detail-time");
    const retry = document.getElementById("character-detail-retry");
    const buttons = root.querySelectorAll("[data-detail]");
    let character = null;
    let selected = "progression";
    let requests = new Map();

    async function show(view) {
        if (!character) return;
        selected = view;
        retry.hidden = true;
        for (const button of buttons) button.setAttribute("aria-pressed", String(button.dataset.detail === view));
        content.replaceChildren();
        status.textContent = "상세 정보를 불러오는 중이에요.";
        time.textContent = "";
        const current = requests;
        if (!current.has(view)) current.set(view, fetchCharacterView(character, view));
        try {
            const details = await current.get(view);
            if (current !== requests) return;
            if (view === "progression") renderMetrics(metrics, details);
            if (view !== selected) return;
            status.textContent = "";
            time.textContent = lookupTime(details.fetchedAt);
            content.replaceChildren(...(view === "progression" ? renderSymbols(details.symbols) : renderHexa(details)));
        } catch (error) {
            current.delete(view);
            if (current !== requests || view !== selected) return;
            status.textContent = error.message;
            retry.hidden = false;
        }
    }

    for (const button of buttons) {
        button.addEventListener("click", () => {
            if (button.dataset.detail !== selected || !requests.has(selected)) show(button.dataset.detail);
        });
    }
    retry.addEventListener("click", () => show(selected));
    return {
        select(name) {
            character = name;
            requests = new Map();
            root.hidden = !name;
            metrics.hidden = true;
            time.textContent = "";
            if (name) show("progression");
        },
    };
}

import { mapleProfile } from "../maple-data.mjs";
import { characterUrl, fetchCharacter, lookupTime, profileDescription, renderStats, requestedCharacter } from "../profile-view.mjs?v=tracking-maple-1";

const byId = (id) => document.getElementById(id);
const name = requestedCharacter() || mapleProfile()?.name;
const slotOrder = [
    "모자", "얼굴장식", "눈장식", "귀고리", "상의", "하의", "한벌옷", "어깨장식",
    "무기", "보조무기", "엠블렘", "망토", "장갑", "신발", "벨트", "뱃지",
    "반지1", "반지2", "반지3", "반지4", "펜던트", "펜던트2", "포켓 아이템", "기계 심장",
];
const slots = byId("gear-slots");
const presets = byId("gear-presets");
const detail = byId("gear-detail");
const itemIcon = byId("item-icon");
const retry = byId("gear-retry");
const mobile = matchMedia("(max-width: 670px)");
let data = null;
let preset = 0;
let selected = null;

function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
}

function showIcon(image, url) {
    image.hidden = !url;
    if (url) image.src = url;
    else image.removeAttribute("src");
}

function showLines(label, lines) {
    const group = element("div");
    const content = element("dd");
    const list = element("ul");
    for (const line of lines.length ? lines : ["—"]) list.append(element("li", line));
    content.append(list);
    group.append(element("dt", label), content);
    return group;
}

function showItem(slot, items) {
    selected = slot;
    const item = items.get(slot);
    const equipped = data.equipped.find((entry) => entry.slot === slot);
    const change = JSON.stringify(equipped ?? null) !== JSON.stringify(item ?? null);
    slots.querySelectorAll("button").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.slot === slot)));
    byId("item-name").textContent = item?.name ?? "빈 슬롯";
    byId("item-stars").textContent = item?.stars != null ? "★ " + item.stars + "성" : slot || "";
    showIcon(itemIcon, item?.icon);
    byId("item-change").hidden = !change;
    byId("item-change").textContent = equipped ? "현재 착용 · " + equipped.name : "현재 착용 장비 없음";
    byId("item-details").replaceChildren(...(item ? [
        showLines(["잠재능력", item.potential.grade].filter(Boolean).join(" · "), item.potential.lines),
        showLines(["에디셔널", item.additional.grade].filter(Boolean).join(" · "), item.additional.lines),
        showLines("추가옵션", item.bonus),
        showLines("주문서 강화", item.scroll),
    ] : []));
}

function makeSlot(slot, item, before, items) {
    const row = element("li");
    const button = element("button", "", "gear-slot");
    button.type = "button";
    button.dataset.slot = slot;
    const change = JSON.stringify(before ?? null) !== JSON.stringify(item ?? null);
    const target = item || change ? button : element("div", "", "gear-empty");
    if (item?.icon) {
        const image = element("img");
        image.alt = "";
        image.width = 32;
        image.height = 32;
        image.loading = "lazy";
        image.referrerPolicy = "no-referrer";
        image.src = item.icon;
        image.addEventListener("error", () => image.replaceWith(element("span", "◇", "slot-placeholder")));
        target.append(image);
    } else target.append(element("span", item ? "◇" : "—", "slot-placeholder"));
    target.append(element("span", slot));
    if (change) target.append(element("span", "변경", "gear-change"));
    if (target === button) {
        button.setAttribute("aria-label", [slot, item?.name ?? "빈 슬롯", change && "변경"].filter(Boolean).join(" · "));
        button.addEventListener("click", () => {
            showItem(slot, items);
            if (mobile.matches) detail.scrollIntoView({ block: "nearest" });
        });
    }
    row.append(target);
    return row;
}

function showPreset(number) {
    preset = number;
    const actual = new Map(data.equipped.map((entry) => [entry.slot, entry]));
    const items = number ? new Map(data.presets.find((entry) => entry.number === number).items.map((entry) => [entry.slot, entry])) : actual;
    const names = [...new Set([...slotOrder, ...actual.keys(), ...items.keys()])];
    byId("gear-slots-title").textContent = number ? "프리셋 " + number : "착용 장비";
    byId("gear-compare").hidden = !number;
    presets.querySelectorAll("button").forEach((button) => button.setAttribute("aria-pressed", String(Number(button.dataset.preset) === number)));
    slots.replaceChildren(...names.map((slot) => makeSlot(slot, items.get(slot), actual.get(slot), items)));
    const focus = items.has(selected) || (selected && number && actual.has(selected))
        ? selected : names.find((slot) => items.has(slot) || (number && actual.has(slot)));
    showItem(focus, items);
}

function renderSets(sets) {
    const section = byId("gear-sets");
    section.hidden = !sets?.length;
    if (section.hidden) return;
    byId("gear-set-list").replaceChildren(...sets.map((set) => {
        const div = element("div", "", "set-entry");
        const list = element("ul");
        for (const effect of set.effects) list.append(element("li", [effect.count && effect.count + "세트", effect.text].filter(Boolean).join(" · "), "quiet"));
        div.append(element("h3", [set.name, set.count && set.count + "개 착용"].filter(Boolean).join(" · ")), list);
        return div;
    }));
}

function render() {
    const profile = data.profile;
    byId("gear-name").textContent = profile.name;
    byId("gear-profile").textContent = profileDescription(profile);
    byId("gear-home").href = characterUrl("../", profile.name);
    byId("gear-self").href = characterUrl("./", profile.name);
    const gearStats = byId("gear-stats");
    gearStats.hidden = false;
    renderStats(gearStats, data.stats, data.cooldown);
    byId("gear-stat-source").textContent = [data.cooldown?.fixedSource === "hat" ? "쿨감은 확인된 모자 옵션 기준" : "현재 착용 기준",
        lookupTime(data.fetchedAt)].filter(Boolean).join(" · ");
    byId("gear-content").hidden = data.equipped === null;
    renderSets(data.sets);
    if (data.equipped === null) return;
    presets.hidden = !data.presets.length;
    presets.replaceChildren(...[0, ...data.presets.map((entry) => entry.number)].map((number) => {
        const label = !number ? "현재 착용" : number + (number === data.activePreset ? " · 적용 중" : "");
        const button = element("button", label, "secondary");
        button.type = "button";
        button.dataset.preset = number;
        if (number) button.setAttribute("aria-label", "프리셋 " + label);
        button.addEventListener("click", () => showPreset(number));
        return button;
    }));
    showPreset(data.presets.some((entry) => entry.number === preset) ? preset : 0);
}

async function load() {
    const feedback = byId("gear-feedback");
    const status = byId("gear-status");
    if (!name) {
        status.textContent = "홈에서 닉네임을 검색하면 장비를 볼 수 있어요.";
        return;
    }
    retry.hidden = true;
    feedback.hidden = false;
    status.textContent = "장비를 불러오는 중이에요.";
    try {
        data = await fetchCharacter(name, "equipment");
        render();
        const missing = [data.equipped === null && "장비", !data.stats && "주요 스탯", !data.sets && "세트 효과"].filter(Boolean);
        status.textContent = missing.length ? missing.join("·") + " 정보를 가져오지 못했어요." : "";
        feedback.hidden = !missing.length;
        retry.hidden = !missing.length;
    } catch (error) {
        status.textContent = error.message;
        retry.hidden = false;
    }
}

itemIcon.addEventListener("error", () => { itemIcon.hidden = true; });
retry.addEventListener("click", load);
load();

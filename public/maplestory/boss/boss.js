import { advanceReminder, formatRemaining, reminderState, shiftReminder, startReminder } from "../alerts/hunt-timing.mjs";
import { selectRuneVoice } from "../alerts/rune-alert.mjs";
import { bossMesoShare, bossWeek, mapleProfile, readBossData, saveBossData, summarizeBossWeek } from "../maple-data.mjs";
import { initBossCapture } from "./boss-capture.mjs";
import { adjustedCooldownSeconds } from "./cooldown.mjs";
import { initMapleWindow } from "../maple-window.mjs?v=tracking-maple-2";

const byId = (id) => document.getElementById(id);
const setText = (id, value) => {
    if (byId(id).textContent !== value) byId(id).textContent = value;
};
const battleForm = byId("battle-form");
const weeklyForm = byId("weekly-form");
const cooldowns = new Map();
const burstRows = new Map();
const mesoFormat = new Intl.NumberFormat("ko-KR");
const dateFormat = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" });
const sound = byId("burst-sound");
const lead = byId("burst-lead");
const refreshCooldown = byId("boss-refresh-cooldown");
const secondsFormat = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 });
const cooldownTtl = 10 * 60 * 1000;
const miniWindow = initMapleWindow({
    button: byId("boss-pip"), template: byId("boss-pip-template"), note: byId("battle-note"),
    title: "TrackingMaple · 보스", height: 155,
});
let data = readBossData();
let character = mapleProfile()?.name ?? "";
let week = bossWeek();
let battle = null;
let cooldown = null;
let cooldownPending = false;

function persist(note) {
    if (!saveBossData(data)) byId(note).textContent = "브라우저가 저장을 차단했어요. 이 페이지에서는 계속 쓸 수 있어요.";
}

function announce(message) {
    setText("burst-note", message);
    if (!sound.checked) return;
    const synthesis = globalThis.speechSynthesis;
    const voice = selectRuneVoice(synthesis?.getVoices() ?? []);
    if (!voice || !globalThis.SpeechSynthesisUtterance) {
        setText("burst-note", message + " · 이 브라우저에서 한국어 기기 음성을 찾지 못했어요.");
        return;
    }
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.voice = voice;
    utterance.lang = voice.lang;
    synthesis.speak(utterance);
}

for (const [key, name, initial] of [["short", "준극딜", 60], ["burst", "극딜", 120], ["hexa", "6차 · 어센트", 360]]) {
    const node = byId("burst-row").content.firstElementChild.cloneNode(true);
    const input = node.querySelector("[data-burst-base]");
    const apply = node.querySelector("[data-burst-apply]");
    const effective = node.querySelector("[data-burst-effective]");
    const display = node.querySelector("output");
    const button = node.querySelector("[data-burst-start]");
    const slot = node.querySelector("[data-burst-slot]");
    const clear = node.querySelector("[data-burst-reset]");
    input.value = data.settings[key] ?? initial;
    apply.checked = data.settings.applyCooldown?.[key] ?? (key !== "hexa");
    node.querySelector("[data-burst-name]").textContent = name;
    input.setAttribute("aria-label", name + " 쿨타임(초)");
    apply.setAttribute("aria-label", name + " 쿨감 적용");
    button.setAttribute("aria-label", name + " 사용");
    slot.setAttribute("aria-label", name + " 퀵슬롯 지정");
    clear.setAttribute("aria-label", name + " 퀵슬롯 해제");
    burstRows.set(key, { name, input, apply, effective, display, slot, clear });
    input.addEventListener("input", renderEffectiveCooldowns);
    input.addEventListener("change", () => {
        if (!input.validity.valid || !input.valueAsNumber) return;
        data.settings[key] = input.valueAsNumber;
        persist("burst-note");
    });
    apply.addEventListener("change", () => {
        data.settings.applyCooldown ??= {};
        data.settings.applyCooldown[key] = apply.checked;
        renderEffectiveCooldowns();
        persist("burst-note");
    });
    button.addEventListener("click", () => {
        if (input.reportValidity()) startBurst(key);
    });
    byId("burst-timers").append(node);
}

function renderEffectiveCooldowns() {
    for (const { input, apply, effective } of burstRows.values()) {
        const base = input.valueAsNumber;
        const seconds = adjustedCooldownSeconds(base, apply.checked ? cooldown : null);
        const text = !input.validity.valid || !base ? "기본 쿨타임을 입력하세요."
            : seconds < base ? secondsFormat.format(base) + "초 → " + secondsFormat.format(seconds) + "초"
                : secondsFormat.format(base) + "초 · " + (apply.checked ? cooldown ? "스탯 반영" : "기본 쿨타임" : "쿨감 제외");
        if (effective.textContent !== text) effective.textContent = text;
    }
}

function renderCooldownSource(note = "") {
    const reductions = [];
    if (Number.isFinite(cooldown?.percent)) reductions.push("−" + secondsFormat.format(cooldown.percent) + "%");
    if (Number.isFinite(cooldown?.fixedSeconds)) reductions.push("−" + secondsFormat.format(cooldown.fixedSeconds) + "초");
    const badge = reductions.some((text) => !["−0%", "−0초"].includes(text)) ? "쿨감 " + reductions.join(" · ") : "쿨감 없음";
    setText("boss-cooldown-badge", cooldownPending ? "장비 조회 중" : cooldown ? badge : character ? "쿨감 미확인" : "대표 캐릭터 미등록");
    byId("boss-cooldown-badge").dataset.state = cooldown ? "active" : "";
    const pieces = [character];
    if (cooldown?.hat?.name) pieces.push(cooldown.hat.name + " 잠재 " + secondsFormat.format(cooldown.hat.seconds) + "초 감소");
    if (cooldown?.fixedSource === "hat") pieces.push("확인된 모자 옵션 기준");
    if (note) pieces.push(note);
    setText("boss-cooldown-source", character ? pieces.join(" · ") : "대표 캐릭터를 등록하면 쿨감을 불러와요.");
    refreshCooldown.hidden = !character;
    refreshCooldown.disabled = cooldownPending;
    byId("boss-profile-link").hidden = Boolean(character);
    renderEffectiveCooldowns();
}

async function loadCooldown(force = false) {
    if (cooldownPending || !character) return;
    const name = character;
    const stored = data.settings.cooldownSnapshot;
    if (!force && stored?.character === name && Date.now() - stored.checkedAt < cooldownTtl) {
        cooldown = stored.reduction;
        renderCooldownSource();
        return;
    }
    cooldownPending = true;
    renderCooldownSource();
    let note = "";
    try {
        const query = new URLSearchParams({ name, include: "cooldown" });
        const response = await fetch("/api/maple-character?" + query, {
            cache: force ? "reload" : "default", signal: AbortSignal.timeout(12000),
        });
        const result = await response.json();
        if (!response.ok || result.fixedSeconds == null && result.percent == null) {
            throw new Error("Cooldown data unavailable");
        }
        if (character !== name) return;
        cooldown = result;
        if (result.fixedSource === "stat" && result.percent !== null && result.hat !== null) {
            data.settings.cooldownSnapshot = { character: name, reduction: result, checkedAt: Date.now() };
            persist("burst-note");
        }
    } catch {
        note = cooldown ? "새로 가져오지 못했어요. 이전 조회값을 표시 중이에요." : "조회에 실패했어요. 기본 쿨타임이 적용돼요.";
    } finally {
        cooldownPending = false;
        renderCooldownSource(note);
    }
}

refreshCooldown.addEventListener("click", () => loadCooldown(true));

function startBurst(key, detected = false) {
    const { name, input, apply, display } = burstRows.get(key);
    if (!input.validity.valid || !input.valueAsNumber) return;
    const now = Date.now();
    if (detected && (cooldowns.get(key)?.state.endsAt ?? 0) > now) return;
    const durationMs = Math.max(1, Math.round(adjustedCooldownSeconds(input.valueAsNumber, apply.checked ? cooldown : null) * 1000));
    const state = reminderState(durationMs);
    startReminder(state, now);
    cooldowns.set(key, { name, state, durationMs, display });
    display.textContent = formatRemaining(durationMs);
    delete display.dataset.ready;
    renderNextBurst(now);
    if (detected) setText("burst-note", name + " 스킬 사용 감지 · 쿨타임을 시작했어요.");
    if (data.settings[key] !== input.valueAsNumber) {
        data.settings[key] = input.valueAsNumber;
        persist("burst-note");
    }
}

initBossCapture({
    rows: burstRows,
    getRegion: (key) => data.settings.regions?.[key],
    setRegion: (key, region) => {
        data.settings.regions ??= {};
        if (region) data.settings.regions[key] = region;
        else delete data.settings.regions[key];
        setText("burst-note", burstRows.get(key).name + (region ? " 퀵슬롯을 등록했어요." : " 퀵슬롯 지정을 해제했어요."));
        persist("burst-note");
    },
    onSkill: (key) => {
        if (battle && Date.now() < battle.endsAt) startBurst(key, true);
    },
});

lead.value = ["0", "5", "10", "15"].includes(data.settings.lead) ? data.settings.lead : "10";
sound.checked = data.settings.sound !== false;
for (const control of [lead, sound]) control.addEventListener("change", () => {
    Object.assign(data.settings, { lead: lead.value, sound: sound.checked });
    persist("burst-note");
});
byId("burst-test").addEventListener("click", () => announce(lead.value === "0" ? "극딜 준비 완료." : "극딜 " + lead.value + "초 전."));

function renderBattle(now = Date.now()) {
    const active = Boolean(battle);
    const elapsed = active ? Math.max(0, now - battle.startedAt) : 0;
    const remaining = active ? Math.max(0, battle.endsAt - now) : 0;
    setText("battle-title", active ? battle.difficulty + " " + battle.boss : "보스 전투");
    byId("battle-state").dataset.state = active ? remaining ? "active" : "warning" : "";
    setText("battle-state", active ? remaining ? battle.practice ? "연습 중" : "전투 중" : "시간 종료" : "대기 중");
    setText("battle-elapsed", formatRemaining(Math.floor(elapsed / 1000) * 1000));
    setText("battle-remaining", active ? formatRemaining(remaining) : "--:--");
    byId("battle-remaining").dataset.urgent = String(active && remaining <= 60000);
    byId("battle-progress").value = active ? remaining / (battle.endsAt - battle.startedAt) : 0;
    battleForm.hidden = active;
    byId("battle-actions").hidden = !active;
    byId("battle-clear").disabled = !active;
    byId("battle-cancel").disabled = !active;
    if (battle && !battle.warned && remaining <= 60000) {
        battle.warned = true;
        announce(remaining ? "전투 종료 1분 전." : "전투 제한 시간이 끝났어요.");
    }
}

function stopBattle(message) {
    battle = null;
    for (const { display } of cooldowns.values()) {
        display.textContent = "대기";
        delete display.dataset.ready;
    }
    cooldowns.clear();
    setText("battle-note", message);
    const now = Date.now();
    renderBattle(now);
    renderNextBurst(now);
}

function addRow(list, title, detail, actions = []) {
    const row = document.createElement("li");
    const description = document.createElement("div");
    const heading = document.createElement("strong");
    const note = document.createElement("p");
    heading.textContent = title;
    note.textContent = detail;
    note.className = "hint";
    description.append(heading, note);
    row.append(description);
    if (actions.length) {
        const group = document.createElement("div");
        group.className = "actions";
        for (const [label, action, pressed] of actions) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = pressed ? "" : "secondary";
            button.textContent = label;
            button.setAttribute("aria-label", title + " " + label);
            if (pressed !== undefined) button.setAttribute("aria-pressed", String(pressed));
            button.addEventListener("click", action);
            group.append(button);
        }
        row.append(group);
    }
    list.append(row);
}

function renderWeekly() {
    setText("week-date", week + " 목요일 시작 · 한국 시간");
    setText("weekly-character", character || "캐릭터 미지정");
    const own = data.plans.filter((plan) => plan.character === character);
    const summary = summarizeBossWeek(data.plans, character, week);
    setText("weekly-count", summary.count + " / " + summary.total);
    setText("weekly-meso", mesoFormat.format(summary.meso) + " 메소");
    const list = byId("weekly-list");
    list.replaceChildren();
    for (const plan of own) {
        const cleared = plan.clearedWeek === week;
        const share = bossMesoShare(plan);
        const detail = plan.party + "인 · " + (share === null ? "결정석 가격 미입력" : "내 몫 " + mesoFormat.format(share) + " 메소");
        addRow(list, plan.difficulty + " " + plan.boss, detail, [
            ["클리어", () => {
                const currentWeek = bossWeek();
                plan.clearedWeek = plan.clearedWeek === currentWeek ? null : currentWeek;
                persist("weekly-note");
                week = currentWeek;
                renderWeekly();
            }, cleared],
            ["삭제", () => {
                if (!confirm(plan.boss + "을(를) 주간 목록에서 삭제할까요?")) return;
                data.plans = data.plans.filter((entry) => entry !== plan);
                persist("weekly-note");
                renderWeekly();
            }],
        ]);
    }
}

function renderHistory() {
    const list = byId("boss-history");
    const records = data.records.filter((record) => record.character === character);
    list.replaceChildren();
    setText("boss-history-count", records.length + "회");
    byId("boss-history-empty").hidden = records.length > 0;
    for (const record of records) {
        addRow(list, record.difficulty + " " + record.boss,
            formatRemaining(record.duration) + " · " + dateFormat.format(record.finishedAt), [
                ["삭제", () => {
                    if (!confirm("이 전투 기록을 삭제할까요?")) return;
                    data.records = data.records.filter((entry) => entry !== record);
                    persist("battle-note");
                    renderHistory();
                }],
            ]);
    }
}

function findPlan(boss, difficulty) {
    return data.plans.find((plan) => plan.character === character && plan.boss === boss && plan.difficulty === difficulty);
}

weeklyForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const fields = new FormData(weeklyForm);
    const boss = fields.get("boss").trim();
    const difficulty = fields.get("difficulty");
    if (!boss) return;
    const meso = fields.get("meso") === "" ? null : Number(fields.get("meso"));
    const party = Number(fields.get("party"));
    const plan = findPlan(boss, difficulty);
    if (plan) Object.assign(plan, { meso, party });
    else data.plans.push({ boss, difficulty, meso, party, character, clearedWeek: null });
    setText("weekly-note", plan ? "결정석 가격과 파티원 수를 갱신했어요." : "주간 보스 목록에 추가했어요.");
    persist("weekly-note");
    weeklyForm.reset();
    renderWeekly();
});

battleForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (battle) return;
    const fields = new FormData(battleForm);
    const boss = fields.get("boss").trim();
    if (!boss) return;
    const now = Date.now();
    battle = {
        boss, difficulty: fields.get("difficulty"), practice: fields.has("practice"),
        startedAt: now, endsAt: now + Number(fields.get("minutes")) * 60000, warned: false,
    };
    setText("battle-note", battle.difficulty + " " + boss + " 시작");
    renderBattle(now);
});

byId("battle-cancel").addEventListener("click", () => stopBattle("전투를 종료했어요."));
byId("battle-clear").addEventListener("click", () => {
    if (!battle) return;
    if (battle.practice) {
        stopBattle("연습 전투를 종료했어요.");
        return;
    }
    const { boss, difficulty, startedAt } = battle;
    const now = Date.now();
    week = bossWeek(now);
    const plan = findPlan(boss, difficulty);
    if (plan) plan.clearedWeek = week;
    else data.plans.push({ boss, difficulty, character, clearedWeek: week, meso: null, party: 1 });
    data.records.unshift({ boss, difficulty, character, finishedAt: now, duration: Math.max(0, now - startedAt) });
    stopBattle("클리어를 기록했어요.");
    persist("battle-note");
    renderWeekly();
    renderHistory();
});

function nextBurst(now) {
    let next = null;
    for (const timer of cooldowns.values()) {
        if (timer.state.endsAt > now && (!next || timer.state.endsAt < next.state.endsAt)) next = timer;
    }
    return next;
}

function renderNextBurst(now) {
    const next = nextBurst(now);
    const remaining = next ? formatRemaining(next.state.endsAt - now) : "--:--";
    setText("burst-next-name", next?.name ?? "대기 중");
    setText("burst-next-time", remaining);
    byId("burst-earlier").disabled = !next;
    byId("burst-later").disabled = !next;
    miniWindow.update({
        boss: byId("battle-title").textContent,
        status: byId("battle-state").textContent,
        time: byId("battle-remaining").textContent,
        next: next?.name ?? "다음 스킬 대기 중",
        remaining,
    });
}

for (const [id, offset] of [["burst-earlier", -1000], ["burst-later", 1000]]) {
    byId(id).addEventListener("click", () => {
        const now = Date.now();
        const timer = nextBurst(now);
        if (!timer) return;
        shiftReminder(timer.state, offset, now);
        setText("burst-note", timer.name + " 타이머를 1초 " + (offset < 0 ? "앞당겼어요." : "늦췄어요."));
        update();
    });
}

function update() {
    const now = Date.now();
    renderBattle(now);
    for (const { name, state, durationMs, display } of cooldowns.values()) {
        const leadMs = Math.min(Number(lead.value) * 1000, Math.max(0, durationMs - 1000));
        if (advanceReminder({ leadMs, durationMs, repeat: false }, state, now)) {
            const seconds = Math.ceil(state.remainingMs / 1000);
            announce(name + (seconds ? " " + seconds + "초 전." : " 준비 완료."));
        }
        display.textContent = state.endsAt === null ? "준비" : formatRemaining(state.remainingMs);
        display.dataset.ready = String(state.endsAt === null);
    }
    renderNextBurst(now);
    const currentWeek = bossWeek(now);
    if (week !== currentWeek) {
        week = currentWeek;
        renderWeekly();
    }
}

window.addEventListener("pageshow", () => {
    if (!battle) {
        data = readBossData();
        const name = mapleProfile()?.name ?? "";
        if (character !== name) cooldown = null;
        character = name;
    }
    renderCooldownSource();
    loadCooldown();
    renderWeekly();
    renderHistory();
    update();
});
setInterval(update, 250);

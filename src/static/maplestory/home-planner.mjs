import { formatHuntCount, formatHuntTime } from "./alerts/hunt-session.mjs";
import { bossMesoShare, mapleDay, mapleResetTimes, readMapleData, summarizeMapleIncome, writeMapleData } from "./maple-data.mjs?v=tracking-maple-3";

const dailyKey = "tracking-sa.maplestory-dailies.v1";
const defaults = ["일일 퀘스트", "몬스터파크"];
const byId = (id) => document.getElementById(id);
const shortDate = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric" });

function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
}

function storedTasks(owner) {
    const data = readMapleData(dailyKey);
    if (!Array.isArray(data?.[owner])) return defaults.map((name) => ({ name, checkedOn: null }));
    return data[owner].filter((task) => typeof task?.name === "string" && task.name.trim() && task.name.length <= 35);
}

export function initDailyTasks() {
    const list = byId("daily-list");
    const count = byId("daily-count");
    const form = byId("daily-form");
    const field = byId("daily-name");
    const status = byId("daily-status");
    let owner = "";
    let day = mapleDay();
    let tasks = storedTasks(owner);

    function updateCount() {
        const checked = tasks.filter((task) => task.checkedOn === day).length;
        count.textContent = checked + " / " + tasks.length;
        count.dataset.complete = String(checked > 0 && checked === tasks.length);
    }

    function persist() {
        const saved = writeMapleData(dailyKey, { ...readMapleData(dailyKey), [owner]: tasks });
        status.textContent = saved ? "" : "이 브라우저에 할 일을 저장할 수 없어요.";
    }

    function draw() {
        list.replaceChildren(...tasks.map((task) => {
            const li = element("li");
            const label = element("label");
            const checkbox = element("input");
            checkbox.type = "checkbox";
            checkbox.checked = task.checkedOn === day;
            checkbox.addEventListener("change", () => {
                task.checkedOn = checkbox.checked ? day : null;
                persist();
                updateCount();
            });
            label.append(checkbox, element("span", task.name));
            const remove = element("button", "×", "daily-remove");
            remove.type = "button";
            remove.setAttribute("aria-label", task.name + " 삭제");
            remove.addEventListener("click", () => {
                tasks = tasks.filter((entry) => entry !== task);
                persist();
                draw();
                field.focus();
            });
            li.append(label, remove);
            return li;
        }));
        if (!tasks.length) list.append(element("li", "할 일을 추가해 보세요.", "quiet"));
        updateCount();
    }

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        const name = field.value.trim();
        if (!name || name.length > 35) return;
        if (tasks.some((task) => task.name === name)) {
            status.textContent = "이미 등록한 할 일이에요.";
            return;
        }
        tasks.push({ name, checkedOn: null });
        persist();
        field.value = "";
        draw();
    });

    return (name, today, reload = false) => {
        if (owner !== name || reload) tasks = storedTasks(name);
        owner = name;
        day = today;
        draw();
    };
}

function meso(value) {
    return value === null ? "—" : formatHuntCount(value, true) + " 메소";
}

export function renderWeeklyOverview(plans, records, character, now) {
    const { cleared, remaining, crystals, huntMeso, huntCount, huntTimeMs } = summarizeMapleIncome(plans, records, character, now);
    const total = cleared + remaining.length;
    const mesoTotal = crystals === null && huntMeso === null ? null : (crystals ?? 0n) + (huntMeso ?? 0n);
    byId("home-income-total").textContent = meso(mesoTotal);
    if (mesoTotal !== null) byId("home-income-total").title = formatHuntCount(mesoTotal) + " 메소 · 기록한 금액 기준";
    else byId("home-income-total").removeAttribute("title");
    byId("home-boss-meso").textContent = meso(crystals);
    byId("home-hunt-meso").textContent = meso(huntMeso);
    byId("home-hunt-week").textContent = huntCount ? huntCount + "회 · " + formatHuntTime(huntTimeMs) : "—";
    byId("home-boss-count").textContent = total ? cleared + " / " + total + " 클리어" : "";
    byId("home-boss-remaining").textContent = "남은 주간 보스" + (total ? " " + remaining.length + "개" : "");
    const progress = byId("home-boss-progress");
    progress.hidden = !total;
    progress.value = total ? cleared / total : 0;
    const list = byId("home-boss-list");
    list.hidden = !remaining.length;
    list.replaceChildren(...remaining.slice(0, 3).map((plan) => {
        const row = element("li");
        const share = bossMesoShare(plan);
        row.append(element("span", [plan.boss, plan.difficulty].filter(Boolean).join(" · ")));
        if (share !== null) {
            const amount = element("strong", meso(share));
            amount.title = "클리어 시 예상 내 몫";
            row.append(amount);
        }
        return row;
    }));
    byId("home-boss-note").textContent = !total ? "보스 체크에서 이번 주 보스를 등록해 보세요."
        : remaining.length > 3 ? "외 " + (remaining.length - 3) + "개" : remaining.length ? "" : "이번 주 보스를 모두 완료했어요.";
}

function renderNews(kind, entries) {
    const list = byId("home-" + kind + "-list");
    const note = byId("home-" + kind + "-status");
    const events = kind === "event";
    const today = Date.parse(mapleDay());
    const rows = (entries ?? []).filter((entry) => !events || entry.endsAt > Date.now());
    list.replaceChildren(...rows.map((entry) => {
        const row = element("li");
        const link = element("a", entry.title);
        link.href = entry.url;
        if (events && Number.isFinite(entry.endsAt)) {
            const days = (Date.parse(mapleDay(entry.endsAt)) - today) / 86_400_000;
            const deadline = days === 0 ? "오늘 마감" : days <= 3 ? "D-" + days : shortDate.format(entry.endsAt) + " 마감";
            row.append(element("span", deadline, days <= 3 ? "news-deadline is-soon" : "news-deadline"));
        }
        row.append(link);
        if (!events && Number.isFinite(entry.published)) row.append(element("small", shortDate.format(entry.published), "quiet"));
        return row;
    }));
    list.hidden = !rows.length;
    note.hidden = Boolean(rows.length);
    note.textContent = entries === null ? (events ? "이벤트를 가져오지 못했어요." : "공지를 가져오지 못했어요.")
        : events ? "표시할 진행 중 이벤트가 없어요." : "표시할 최신 공지가 없어요.";
}

export function loadHomeNews() {
    function showEvents(entries) {
        renderNews("event", entries);
        if (!entries?.length) return;
        const now = Date.now();
        const pending = entries.filter((entry) => entry.endsAt > now);
        if (!pending.length) return;
        const next = Math.min(mapleResetTimes(now).daily, ...pending.map((entry) => entry.endsAt));
        setTimeout(() => showEvents(pending), Math.max(20, next - now + 20));
    }

    const load = async () => {
        try {
            const response = await fetch("/api/maple-news", { signal: AbortSignal.timeout(6500) });
            const data = response.ok ? await response.json() : null;
            showEvents(data?.events ?? null);
            renderNews("notice", data?.notices ?? null);
        } catch {
            renderNews("event", null);
            renderNews("notice", null);
        }
    };
    if (!("IntersectionObserver" in window)) return load();
    const observer = new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        load();
    }, { rootMargin: "180px" });
    observer.observe(byId("home-news"));
}

import { experiencePace } from "./alerts/exp-tracking.mjs";
import { formatHuntCount, formatHuntTime, huntElapsed, huntRate, validHuntSession } from "./alerts/hunt-session.mjs";
import { bossWeek, huntKey, mapleDay, mapleProfile, mapleResetTimes, readBossData, readMapleData, saveMapleProfile } from "./maple-data.mjs?v=tracking-maple-3";
import { characterUrl, fetchCharacter, lookupTime, profileDescription, renderStats, requestedCharacter } from "./profile-view.mjs?v=tracking-maple-3";
import { initHomeGrowth } from "./home-growth.mjs?v=tracking-maple-5";
import { initCharacterDetails } from "./character-details.mjs?v=tracking-maple-6";
import { initDailyTasks, loadHomeNews, renderWeeklyOverview } from "./home-planner.mjs?v=tracking-maple-3";

const byId = (id) => document.getElementById(id);
const setText = (id, value) => {
    const element = byId(id);
    if (element.textContent !== value) element.textContent = value;
};
const form = byId("character-search");
const nameInput = byId("character-name");
const search = form.querySelector("button[type=submit]");
const progressFormat = new Intl.NumberFormat("ko-KR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const refreshTasks = initDailyTasks();
const growth = initHomeGrowth();
const details = initCharacterDetails();
let representative = mapleProfile();
let profile = null;
let summary = null;
let requestNumber = 0;
let journal = null;
let displayedWeek = null;
let displayedDay = null;

function resetLabel(remaining) {
    if (remaining < 60000) return "1분 미만";
    const minutes = Math.floor(remaining / 60000);
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor(minutes / 60) % 24;
    return [days && days + "일", hours && hours + "시간", minutes % 60 && minutes % 60 + "분"].filter(Boolean).join(" ");
}

function updateClocks(now = Date.now()) {
    const resets = mapleResetTimes(now);
    setText("reset-daily", formatHuntTime(resets.daily - now));
    for (const key of ["weekly", "sunday", "monthly"]) setText("reset-" + key, resetLabel(resets[key] - now));
    const session = journal?.session;
    if (!validHuntSession(session) || session.status === "idle") {
        byId("home-session").hidden = true;
        return;
    }

    const finished = session.status === "finished";
    const action = byId("home-session-link");
    byId("home-session").hidden = false;
    setText("home-session-state", { running: "사냥 중", paused: "일시정지된 사냥", finished: "저장 대기 중인 사냥" }[session.status]);
    setText("home-session-detail", [journal.draft?.character, formatHuntTime(huntElapsed(session, now))].filter(Boolean).join(" · "));
    action.textContent = finished ? "결과 저장으로 이동" : "사냥 이어서 보기";
    action.href = finished ? "./alerts/#hunt-record" : "./alerts/";
}

function render(reloadTasks = false) {
    const now = Date.now();
    displayedDay = mapleDay(now);
    displayedWeek = bossWeek(now);
    refreshTasks(representative?.name ?? "", displayedDay, reloadTasks);

    byId("maple-profile").hidden = !profile;
    byId("home-hero").toggleAttribute("data-profile", Boolean(profile));
    byId("home-intro").hidden = Boolean(profile);
    byId("home-stats").hidden = !profile;
    byId("profile-exp").hidden = !Number.isFinite(profile?.expRate);
    byId("gear-nav").href = characterUrl("./gear/", profile?.name);
    if (profile) {
        setText("profile-name", profile.name);
        const selectedRepresentative = representative?.name === profile.name;
        setText("profile-role", selectedRepresentative ? "대표 캐릭터" : "조회 중인 캐릭터");
        setText("profile-details", [profileDescription(profile), profile.guild && "길드 " + profile.guild].filter(Boolean).join(" · "));
        if (Number.isFinite(profile.expRate)) {
            byId("profile-exp-bar").value = profile.expRate;
            setText("profile-exp-rate", progressFormat.format(profile.expRate) + "%");
        }
        byId("save-profile").hidden = selectedRepresentative;
        byId("clear-profile").hidden = !selectedRepresentative;
        byId("gear-link").href = characterUrl("./gear/", profile.name);
        const image = byId("profile-image");
        if (!profile.image) {
            image.hidden = true;
            image.removeAttribute("src");
        } else if (image.getAttribute("src") !== profile.image) {
            image.hidden = false;
            image.src = profile.image;
        }
    }
    renderStats(byId("home-stats"), summary?.stats);
    setText("home-stats-time", summary?.stats ? lookupTime(summary.fetchedAt) : "");

    byId("home-record-owner").hidden = !representative;
    if (representative) setText("home-record-owner", "대표 캐릭터 · " + representative.name);

    journal = readMapleData(huntKey);
    const records = Array.isArray(journal?.records) ? journal.records : [];
    const recent = records.find((record) => Number.isFinite(record?.elapsedMs) &&
        (!representative || record.character === representative.name));
    setText("home-hunt-time", recent ? formatHuntTime(recent.elapsedMs) : "—");
    const fragments = recent?.fragments;
    setText("home-fragments", typeof fragments === "string" && /^\d{1,27}$/.test(fragments) ? formatHuntCount(fragments, true) : "—");
    const enteredRate = typeof recent?.exp === "string" && /^\d{1,27}$/.test(recent.exp)
        ? huntRate(recent.exp, recent.elapsedMs) : null;
    const rate = enteredRate === null ? experiencePace(recent?.experience)?.perHour : formatHuntCount(enteredRate, true);
    setText("home-hunt-rate", rate ?? "—");
    setText("home-hunt-note", recent
        ? [recent.map || recent.character || "최근 기록", lookupTime(recent.savedAt).replace(" 조회", " 기록")].filter(Boolean).join(" · ")
        : "저장한 사냥 기록이 여기에 표시돼요.");
    renderWeeklyOverview(readBossData().plans, records, representative?.name ?? "", now);
    updateClocks(now);
}

async function lookup(nickname, navigate = false) {
    const id = ++requestNumber;
    search.disabled = true;
    setText("character-status", "캐릭터를 불러오는 중이에요.");
    try {
        const data = await fetchCharacter(nickname, "summary");
        if (id !== requestNumber) return;
        profile = data.profile;
        summary = data;
        nameInput.value = profile.name;
        if (navigate && requestedCharacter() !== profile.name) history.pushState(null, "", characterUrl("./", profile.name));
        render();
        growth.select(profile, summary);
        details.select(profile.name);
        setText("character-status", data.stats ? "" : "주요 스탯을 가져오지 못했어요. 검색을 다시 시도할 수 있어요.");
    } catch (error) {
        if (id === requestNumber) setText("character-status", error.message);
    } finally {
        if (id === requestNumber) search.disabled = false;
    }
}

function readLocation() {
    const name = requestedCharacter() || representative?.name || "";
    profile = name === representative?.name ? representative : null;
    summary = null;
    nameInput.value = name;
    render();
    growth.select(profile, null);
    details.select(null);
    if (name) return lookup(name);
    requestNumber++;
    search.disabled = false;
    setText("character-status", "");
}

form.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = nameInput.value.trim();
    if (name && !search.disabled) lookup(name, true);
});

byId("profile-image").addEventListener("error", (event) => { event.currentTarget.hidden = true; });
byId("save-profile").addEventListener("click", () => {
    if (!profile) return;
    const saved = { ...profile, savedAt: Date.now() };
    if (saveMapleProfile(saved)) {
        representative = saved;
        render();
        byId("clear-profile").focus();
        setText("character-status", "대표 캐릭터로 저장했어요.");
    } else setText("character-status", "브라우저가 캐릭터 저장을 차단했어요.");
});
byId("clear-profile").addEventListener("click", () => {
    if (saveMapleProfile(null)) {
        representative = null;
        render();
        byId("save-profile").focus();
        setText("character-status", "대표 캐릭터를 해제했어요.");
    } else setText("character-status", "브라우저가 설정 저장을 차단했어요.");
});
window.addEventListener("popstate", readLocation);
window.addEventListener("pageshow", (event) => {
    if (!event.persisted) return;
    representative = mapleProfile();
    render(true);
});
window.addEventListener("storage", (event) => {
    if (event.storageArea !== localStorage) return;
    representative = mapleProfile();
    render(true);
});
setInterval(() => {
    const now = Date.now();
    growth.updateDay(profile, now);
    if (bossWeek(now) !== displayedWeek || mapleDay(now) !== displayedDay) render();
    else updateClocks(now);
}, 1000);
readLocation();
loadHomeNews();

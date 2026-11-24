import {
    emptySession, formatHuntCount, formatHuntTime, huntElapsed, huntRate, parseHuntCount, runHunt, stopHunt, validHuntSession,
} from "./hunt-session.mjs";
import {
    emptyExperience, experiencePace, formatExperienceProgress, measureExperience, validExperience,
} from "./exp-tracking.mjs?v=maple-hunt-6";
import { emptySolErda, measureSolErda, restoreSolErda } from "./sol-erda-tracking.mjs?v=maple-hunt-2";
import { huntKey as storageKey, mapleProfile } from "../maple-data.mjs";

const labels = { idle: "대기 중", running: "사냥 중", paused: "일시정지", finished: "기록 대기" };
const counts = ["exp", "meso", "fragments"];
const fields = ["character", "map", ...counts];
const newestFirst = (a, b) => b.savedAt - a.savedAt;
const dateFormat = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" });

function loadJournal() {
    try {
        return JSON.parse(localStorage.getItem(storageKey)) ?? {};
    } catch {
        return {};
    }
}

export function initHuntJournal() {
    const byId = (id) => document.getElementById(id);
    const stored = loadJournal();
    let session = validHuntSession(stored.session) ? stored.session : emptySession();
    let experience = stored.experience?.source === "text" && validExperience(stored.experience)
        ? { ...stored.experience, last: null } : emptyExperience();
    let solErda = restoreSolErda(stored.solErda);
    let lastExperienceSave = 0;
    let records = (Array.isArray(stored.records) ? stored.records : []).filter((record) =>
        record && typeof record.id === "string" && Number.isFinite(record.savedAt) &&
        Number.isFinite(record.elapsedMs) && record.elapsedMs >= 1000 &&
        counts.every((key) => record[key] == null || (typeof record[key] === "string" && /^\d{1,27}$/.test(record[key]))),
    ).sort(newestFirst);
    const form = byId("hunt-record-form");
    const start = byId("hunt-start");
    const finish = byId("hunt-finish");
    const note = byId("hunt-note");
    const list = byId("history-list");
    const listTemplate = byId("history-row");
    const inputs = Object.fromEntries(fields.map((key) => [key, form.elements.namedItem(key)]));
    for (const key of fields) {
        if (typeof stored.draft?.[key] === "string") inputs[key].value = stored.draft[key].slice(0, inputs[key].maxLength);
    }
    if (!inputs.character.value) inputs.character.value = mapleProfile()?.name ?? "";

    function experienceSnapshot() {
        return { gained: experience.gained, observedMs: experience.observedMs, source: "text" };
    }

    function persist() {
        const draft = Object.fromEntries(fields.map((key) => [key, inputs[key].value]));
        try {
            localStorage.setItem(storageKey, JSON.stringify({
                session, records, draft, experience: experienceSnapshot(),
                solErda: { fragments: solErda.fragments },
            }));
        } catch {
            note.textContent = "브라우저 저장소에 기록할 수 없어 이 탭을 닫으면 기록이 사라질 수 있어요.";
        }
    }

    function put(id, value, title = "") {
        const slot = byId(id);
        if (slot.textContent !== value) slot.textContent = value;
        if (slot.title !== title) slot.title = title;
    }

    function fragmentCount() {
        return solErda.fragments === null ? null : String(solErda.fragments);
    }

    function update(now = Date.now()) {
        const elapsed = huntElapsed(session, now);
        const time = formatHuntTime(elapsed);
        const metrics = {
            exp: huntRate(parseHuntCount(inputs.exp.value) ?? null, elapsed),
            meso: huntRate(parseHuntCount(inputs.meso.value) ?? null, elapsed),
            fragments: parseHuntCount(inputs.fragments.value) ?? fragmentCount(),
        };
        put("hunt-elapsed", time);
        put("hunt-session-state", labels[session.status]);
        byId("hunt-session-state").dataset.state = session.status === "running" ? "active" : "";
        const pace = metrics.exp === null ? experiencePace(experience) : null;
        const measuring = session.status === "running" && experience.observedMs > 0 && !pace;
        const display = {};
        for (const key of counts) {
            const metric = metrics[key];
            display[key] = key === "exp" && metric === null
                ? pace?.perHour ?? (measuring ? "측정 중" : "—") : formatHuntCount(metric, true);
            put("hunt-metric-" + key, display[key],
                metric === null ? "" : formatHuntCount(metric));
        }
        let expDetail = "";
        if (metrics.exp !== null) expDetail = "배틀 분석 입력 기준";
        else if (experience.observedMs > 0) {
            expDetail = "이번 사냥 +" + formatExperienceProgress(experience.gained) + "%";
            if (!pace) expDetail += " · 15초부터 환산";
        }
        put("hunt-exp-source", expDetail, metrics.exp === null && experience.observedMs > 0
            ? "경험치 측정 시간 " + formatHuntTime(experience.observedMs) : "");
        byId("hunt-exp-two-hours").hidden = !pace;
        if (pace) put("hunt-exp-two-hours", "1재획(2시간) 예상 " + pace.perTwoHours);
        const action = { idle: "공유 없이 시작", running: "일시정지", paused: "사냥 재개", finished: "기록으로 이동" };
        if (start.textContent.trim() !== action[session.status]) start.textContent = action[session.status];
        finish.disabled = session.status !== "running" && session.status !== "paused";
        finish.hidden = finish.disabled;
        byId("hunt-save").disabled = session.status !== "finished" || elapsed < 1000;
        byId("hunt-discard").hidden = session.status !== "finished";
        return { time, status: labels[session.status], ...display };
    }

    function renderHistory() {
        list.replaceChildren();
        byId("history-empty").hidden = records.length > 0;
        put("history-count", records.length + "회");
        for (const record of records) {
            const row = listTemplate.content.firstElementChild.cloneNode(true);
            const cell = (key) => row.querySelector("[data-history-" + key + "]");
            cell("name").textContent = String(record.map || record.character || "사냥 기록");
            cell("detail").textContent = [record.map && record.character, dateFormat.format(record.savedAt),
                formatHuntTime(record.elapsedMs)].filter(Boolean).join(" · ");
            for (const key of counts) {
                const count = record[key] ?? null;
                const value = key === "fragments" ? count : huntRate(count, record.elapsedMs);
                const estimated = key === "exp" && value === null ? experiencePace(record.experience)?.perHour : null;
                cell(key).textContent = estimated ?? formatHuntCount(value, true);
                if (value !== null) cell(key).title = formatHuntCount(value);
            }
            cell("remove").addEventListener("click", () => {
                if (!confirm("이 사냥 기록을 삭제할까요?")) return;
                records = records.filter(({ id }) => id !== record.id);
                persist();
                renderHistory();
            });
            list.append(row);
        }
    }

    function showRecord() {
        form.scrollIntoView({ behavior: "smooth", block: "center" });
        byId("hunt-save").focus({ preventScroll: true });
    }

    function changeSession(next, now) {
        if (next === "running") runHunt(session, now);
        else stopHunt(session, now, next);
        experience.last = null;
        solErda.last = null;
        persist();
        update(now);
    }

    start.addEventListener("click", () => {
        const now = Date.now();
        if (session.status === "finished") {
            showRecord();
            return;
        }
        changeSession(session.status === "running" ? "paused" : "running", now);
    });

    finish.addEventListener("click", () => {
        const now = Date.now();
        changeSession("finished", now);
        showRecord();
    });

    byId("hunt-discard").addEventListener("click", () => {
        if (!confirm("저장하지 않은 사냥 측정을 초기화할까요?")) return;
        session = emptySession();
        experience = emptyExperience();
        solErda = emptySolErda();
        for (const key of counts) inputs[key].value = "";
        persist();
        note.textContent = "";
        update();
    });

    form.addEventListener("input", () => {
        note.textContent = "";
        persist();
        update();
    });
    form.addEventListener("submit", (event) => {
        event.preventDefault();
        const now = Date.now();
        const elapsedMs = huntElapsed(session, now);
        if (elapsedMs < 1000 || session.status !== "finished") return;
        const values = Object.fromEntries(counts.map((key) => [key, parseHuntCount(inputs[key].value)]));
        const invalid = counts.find((key) => values[key] === undefined);
        if (invalid) {
            note.textContent = "획득 수치는 0 이상의 숫자로 입력하세요. 천 단위 쉼표도 쓸 수 있어요.";
            const details = inputs[invalid].closest("details");
            if (details) details.open = true;
            inputs[invalid].focus();
            return;
        }
        values.fragments ??= fragmentCount();
        const id = crypto.randomUUID();
        records.unshift({ id, savedAt: now, elapsedMs, ...values,
            experience: experienceSnapshot(),
            character: inputs.character.value.trim(), map: inputs.map.value.trim() });
        session = emptySession();
        experience = emptyExperience();
        solErda = emptySolErda();
        for (const key of counts) inputs[key].value = "";
        persist();
        update(now);
        renderHistory();
        note.textContent = "브라우저에 사냥 기록을 저장했어요.";
    });

    renderHistory();
    update();
    return {
        update,
        get status() { return session.status; },
        startFromCapture(now) {
            if (session.status !== "idle" && session.status !== "paused") return null;
            changeSession("running", now);
            return session.startedAt;
        },
        pauseAfterCapture(startedAt, now) {
            if (session.status !== "running" || session.startedAt !== startedAt) return false;
            changeSession("paused", now);
            note.textContent = "화면 공유가 끝나 사냥을 일시정지했어요.";
            return true;
        },
        resetExperienceSource() {
            experience.last = null;
        },
        resetSolErdaSource() {
            solErda.last = null;
        },
        observeSolErda(value, now) {
            if (session.status !== "running" || !value) return;
            const { fragments } = solErda;
            measureSolErda(solErda, value, now);
            if (fragments !== solErda.fragments) persist();
            update(now);
        },
        observeExperience(value, now) {
            if (session.status !== "running") return;
            const gained = experience.gained;
            measureExperience(experience, value, now);
            if (value === null) return;
            if (experience.gained !== gained || now - lastExperienceSave >= 10000) {
                lastExperienceSave = now;
                persist();
            }
            update(now);
        },
    };
}

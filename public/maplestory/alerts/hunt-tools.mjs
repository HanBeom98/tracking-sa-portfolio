import { advanceBuffReminder, advanceReminder, formatRemaining, pauseReminder, reminderState, startReminder } from "./hunt-timing.mjs?v=maple-hunt-2";
import { observeQuickslotClock, quickslotClockStatus, skillSampleSize } from "./skill-vision.mjs?v=maple-hunt-9";
import { automaticIconType, experienceCoupons } from "./hunt-icon-vision.mjs?v=maple-hunt-10";
import { observeBuffCountdown } from "./buff-countdown.mjs?v=maple-hunt-9";
import { formatHuntTime } from "./hunt-session.mjs";
import { sameCaptureViewport } from "./capture-regions.mjs?v=maple-hunt-7";

const storageKey = "tracking-sa.maplestory-reminders.v1";
const skillModes = {
    reuse: { label: "재사용", message: "다시 사용할 시간입니다." },
    install: { label: "설치 종료", message: "설치가 끝나는 시간입니다." },
    buff: { label: "버프 종료", message: "버프가 끝나는 시간입니다." },
};
const groups = { skill: 4, "custom-timer": 8 };
const clockToleranceMs = 1500;
export function formatApproximateRemaining(ms) {
    const minutes = Math.floor(ms / 60000);
    return minutes > 0 ? `약 ${minutes}분` : "1분 미만";
}

const timerLabels = { idle: "대기", running: "진행 중", ending: "종료 임박", paused: "일시정지", expired: "종료" };

function timerPhase({ config, state }) {
    if (state.endsAt !== null) return config.leadMs > 0 && state.remainingMs <= config.leadMs ? "ending" : "running";
    if (state.remainingMs === 0) return "expired";
    return state.remainingMs < (state.durationMs ?? config.durationMs) ? "paused" : "idle";
}
const presets = [
    { id: "preset-janus", label: "솔 야누스 새벽", mode: "install", lead: 5, choices: [
        [60, "60초"], [70, "70초"], [80, "80초"], [120, "120초"],
    ] },
    { id: "preset-fountain", label: "에르다 파운틴", mode: "install", lead: 5, choices: [[60, "60초"]] },
    { id: "preset-wealth", label: "재획비", mode: "buff", lead: 60, autoLabel: "소형 재획비", autoSeconds: 1800, choices: [
        [7200, "일반 · 2시간"], [1800, "소형 · 30분"],
    ] },
    { id: "preset-exp-coupon", label: "경험치 쿠폰", mode: "buff", lead: 30, autoLabel: "경험치 쿠폰",
        choices: [[1800, "30분"], [900, "15분"], [1200, "20분"], [3600, "60분"],
    ] },
];

function savedReminders() {
    try {
        return JSON.parse(localStorage.getItem(storageKey)) ?? {};
    } catch {
        return {};
    }
}

function validConfig(config, kind) {
    return config && typeof config.id === "string" && typeof config.label === "string" &&
        config.label.length > 0 && config.label.length <= 32 &&
        Number.isInteger(config.durationMs) && config.durationMs >= 1000 && config.durationMs <= 86400000 &&
        Number.isInteger(config.leadMs) && config.leadMs >= 0 && config.leadMs < config.durationMs &&
        (kind !== "skill" || Object.hasOwn(skillModes, config.mode));
}

export function initHuntTools({ notify, prepareSound, chooseSkillRegion, onMonitoringChange }) {
    const data = savedReminders();
    const entries = new Map();
    const rowTemplate = document.getElementById("reminder-row");
    const switchTemplate = document.getElementById("preset-alert-switch");
    const alertSwitches = document.getElementById("alert-switches");
    let capture = null;

    function entriesFor(kind) {
        return [...entries.values()].filter((entry) => entry.kind === kind);
    }

    function screenEntries() {
        return [...entries.values()].filter(({ kind }) => kind !== "custom-timer");
    }

    function save() {
        const records = Object.fromEntries(Object.keys(groups).map((kind) => [kind,
            entriesFor(kind).map(({ config }) => config),
        ]));
        records.preset = Object.fromEntries(entriesFor("preset").map(({ config, monitoring, alertsEnabled }) => [config.id, {
            durationMs: config.durationMs, region: config.region, monitoring, alertsEnabled,
        }]));
        try {
            localStorage.setItem(storageKey, JSON.stringify(records));
        } catch {
            document.getElementById("last-alert").textContent = "타이머 설정은 이 탭에서만 유지됩니다.";
        }
    }

    function refreshRow(entry) {
        const { config, state, controls, kind } = entry;
        const duration = state.durationMs ?? config.durationMs;
        const phase = timerPhase(entry);
        const remaining = kind === "preset" && phase === "idle" ? "—"
            : state.remainingMs > 0 && entry.buffUncertaintyMs > 2000
            ? formatApproximateRemaining(state.remainingMs) : kind === "preset" && duration >= 3600000
            ? formatHuntTime(Math.ceil(state.remainingMs / 1000) * 1000)
            : formatRemaining(state.remainingMs);
        if (controls.remaining.value !== remaining) controls.remaining.value = remaining;
        if (entry.quickslotClock) {
            const manualRegion = captureMatches(config);
            const clock = capture && !manualRegion ? quickslotClockStatus(entry.quickslotClock, Date.now()) : null;
            const cooldown = !capture ? "공유 대기" : manualRegion ? "자동 인식 필요" : clock?.ready ? "사용 가능"
                : clock ? formatRemaining(clock.remainingMs) : "확인 대기";
            if (controls.cooldown.value !== cooldown) controls.cooldown.value = cooldown;
        }
        const label = state.endsAt !== null ? "일시정지"
            : phase === "paused" ? "재개" : kind === "preset" ? "직접 시작" : "시작";
        if (controls.start.textContent !== label) controls.start.textContent = label;
        controls.reset.disabled = state.endsAt === null && state.remainingMs === duration;
        if (kind === "preset") {
            const active = state.endsAt !== null;
            const accessibleAction = config.label + " " + label;
            if (controls.start.getAttribute("aria-label") !== accessibleAction) controls.start.setAttribute("aria-label", accessibleAction);
            controls.restart.hidden = !active;
            controls.choice.disabled = active || phase === "paused";
            entry.row.dataset.active = String(active);
            entry.row.dataset.timerState = phase;
            if (controls.stateLabel.textContent !== timerLabels[phase]) controls.stateLabel.textContent = timerLabels[phase];
            if (controls.progress.max !== duration) controls.progress.max = duration;
            const progress = active || phase === "paused" ? state.remainingMs : 0;
            if (controls.progress.value !== progress) controls.progress.value = progress;
            if (entry.alertValue) {
                const tileValue = active ? remaining : timerLabels[phase];
                if (entry.alertValue.textContent !== tileValue) entry.alertValue.textContent = tileValue;
                entry.alertValue.dataset.phase = phase;
            }
        }
    }

    function captureMatches(config) {
        return capture && config.region?.width === capture.width && config.region?.height === capture.height &&
            config.region.rect && config.region.signature?.length === skillSampleSize ** 2;
    }

    function refreshSkill(entry) {
        const { config, controls, monitoring } = entry;
        const ready = captureMatches(config);
        const automatic = automaticIconType(config.id);
        controls.region.disabled = !capture;
        controls.monitor.disabled = !ready;
        controls.monitor.checked = monitoring;
        controls.restoreAuto.hidden = !(automatic && config.region);
        let label = "수동 시작";
        if (config.region && (!capture || ready || !automatic)) {
            label = !capture ? "화면 공유 대기" : !ready ? "해상도 다시 지정" : monitoring ? "감지 중" : "영역 저장됨";
        } else if (automatic && !capture) {
            label = (entry.preset.autoLabel ?? "퀵슬롯") + " 자동 감지";
        } else if (automatic === "quickslot") {
            label = entry.autoFound ? "퀵슬롯 인식됨" : "퀵슬롯 찾는 중";
        } else if (automatic === "buff") {
            const { endsAt, remainingMs } = entry.state;
            const waiting = endsAt === null && remainingMs === 0;
            const name = entry.autoFound ? entry.coupon?.label ?? entry.preset.autoLabel : entry.preset.autoLabel;
            label = name + (entry.autoFound
                ? entry.manualBuffTimer ? " · 직접 설정한 시간"
                    : endsAt === null ? " 감지됨 · 남은 시간 확인 중"
                        : entry.buffClockSynced ? " · 게임 버프 시간 동기화" : " · 사용 감지 기준 · 게임 시간 확인 중"
                : waiting ? " 재사용 대기" : " 대기");
        }
        if (controls.note.textContent !== label) controls.note.textContent = label;
    }

    function updateLimit(kind) {
        const full = entriesFor(kind).length >= groups[kind];
        const button = document.querySelector(`#${kind}-form button[type="submit"]`);
        button.disabled = full;
        const note = document.getElementById(`${kind}-note`);
        note.textContent = full ? `최대 ${groups[kind]}개까지 등록할 수 있어요.` : "";
    }

    function setSummary(entry, summary) {
        const { kind, config, preset } = entry;
        const interval = formatRemaining(config.durationMs);
        if (preset) {
            const lead = config.leadMs / 1000;
            const notice = lead < 60 ? lead + "초 전 알림" : lead / 60 + "분 전 알림";
            summary.textContent = preset.choices.length === 1 ? config.durationMs / 1000 + "초 설정 · " + notice : notice;
            return;
        }
        summary.textContent = kind === "custom-timer"
            ? interval + (config.repeat ? " · 반복" : "")
            : skillModes[config.mode].label + " · " + interval + (config.leadMs ? ` · ${config.leadMs / 1000}초 전 알림` : "");
    }

    function restart(entry, now = Date.now()) {
        entry.state = reminderState(entry.config.durationMs);
        startReminder(entry.state, now);
        refreshRow(entry);
    }

    function advanceEntry(entry, now) {
        const { config, kind, preset, state } = entry;
        const notice = preset?.mode === "buff" ? advanceBuffReminder(config, state, now)
            : advanceReminder(config, state, now) ? state.remainingMs === 0 ? "ended" : "lead" : null;
        if (notice) {
            const status = kind === "custom-timer" ? "타이머가 끝났습니다."
                : notice === "lead" ? entry.buffUncertaintyMs > 2000 ? "버프 종료가 가까워졌습니다."
                    : skillModes[config.mode].label + `까지 ${Math.ceil(state.remainingMs / 1000)}초 남았습니다.`
                    : config.mode === "buff" ? entry.buffUncertaintyMs > 2000 ? "버프 종료 예상 시점입니다." : "버프가 끝났습니다."
                        : skillModes[config.mode].message;
            if (entry.alertsEnabled !== false) {
                notify(kind === "preset" ? "skill" : kind, config.label + ". " + status, config.id);
            }
            if (notice === "ended" && preset?.mode === "buff") refreshSkill(entry);
        }
        refreshRow(entry);
    }

    function addAlertSwitch(entry, saved) {
        const node = switchTemplate.content.firstElementChild.cloneNode(true);
        const label = entry.config.label;
        node.querySelector("img").src = "./icon-" + entry.config.id.slice("preset-".length) + ".png";
        node.querySelector(".alert-label").textContent = label;
        entry.alertValue = node.querySelector("[data-alert-value]");
        const toggle = node.querySelector("input");
        toggle.setAttribute("aria-label", label + " 알림");
        entry.alertsEnabled = saved?.alertsEnabled !== false;
        toggle.checked = entry.alertsEnabled;
        toggle.addEventListener("change", () => {
            entry.alertsEnabled = toggle.checked;
            if (toggle.checked) prepareSound();
            save();
        });
        alertSwitches.append(node);
    }

    function usePresetDuration(entry) {
        const { config, preset, controls, row } = entry;
        config.durationMs = preset.autoSeconds * 1000;
        controls.choice.value = config.durationMs;
        setSummary(entry, row.querySelector("[data-summary]"));
    }

    function synchronizeBuff(entry, clock, sampledAt) {
        if (entry.manualBuffTimer || (!entry.buffSyncPending && !entry.buffClockSynced)) return;
        const duration = (entry.coupon?.maxSeconds ?? entry.preset.autoSeconds) * 1000;
        const bounds = observeBuffCountdown(entry.buffClock, clock, sampledAt, duration);
        if (!bounds || bounds.latest <= sampledAt) return;
        const { endsAt } = entry.state;
        if (entry.buffSyncPending && endsAt !== null && bounds.earliest <= endsAt + clockToleranceMs &&
                endsAt <= bounds.latest + clockToleranceMs && !entry.buffClockSynced) {
            return;
        }
        if (endsAt === null && entry.autoBuffEndsAt !== undefined && bounds.latest <= entry.autoBuffEndsAt) return;

        const changedDeadline = (entry.buffSyncPending || entry.coupon) && entry.buffClockSynced && endsAt !== null &&
            (bounds.earliest > endsAt + clockToleranceMs || bounds.latest < entry.buffEarliestEnd - clockToleranceMs);
        if (!entry.buffClockSynced || endsAt === null || changedDeadline) {
            if (!entry.coupon) usePresetDuration(entry);
            entry.state = reminderState(duration);
            if (entry.coupon) entry.state.durationMs = duration;
        }
        entry.buffSyncPending = false;
        entry.buffClockSynced = true;
        entry.buffEarliestEnd = bounds.earliest;
        entry.autoBuffEndsAt = bounds.latest;
        entry.buffUncertaintyMs = bounds.latest - bounds.earliest;
        entry.state.endsAt = bounds.latest;
        entry.state.remainingMs = Math.min(duration, bounds.latest - sampledAt);
        refreshRow(entry);
    }

    function readExperienceCoupon(entry, { variant, settled, activated, activatedAt, briefGap, clock, sampledAt }) {
        if (!settled || !Object.hasOwn(experienceCoupons, variant)) return;
        const coupon = experienceCoupons[variant];
        const previousEnd = entry.buffEarliestEnd ?? entry.autoBuffEndsAt;
        const reused = activated && (previousEnd === undefined ? !briefGap : activatedAt >= previousEnd - clockToleranceMs);
        if (entry.coupon !== coupon || reused) {
            if (reused || entry.coupon) entry.manualBuffTimer = false;
            entry.coupon = coupon;
            entry.buffClock = {};
            entry.buffClockSynced = false;
            entry.buffSyncPending = true;
            entry.buffUncertaintyMs = 0;
            entry.buffEarliestEnd = undefined;
            entry.autoBuffEndsAt = undefined;
            if (!entry.manualBuffTimer) {
                entry.state = reminderState(entry.config.durationMs);
                refreshRow(entry);
            }
        }
        if (clock) synchronizeBuff(entry, clock, sampledAt);
    }

    function add(kind, config, preset = null) {
        const row = rowTemplate.content.firstElementChild.cloneNode(true);
        const control = (name) => row.querySelector("[data-" + name + "]");
        const components = {
            start: control("start"), reset: control("reset"), remaining: control("remaining"),
            region: control("region"), monitor: control("monitor"), note: control("monitor-note"),
            restart: control("restart"), choice: control("choice"), restoreAuto: control("restore-auto"),
            stateLabel: control("timer-state"), progress: control("progress"), cooldown: control("cooldown"),
        };
        const entry = { kind, config, preset, row, controls: components, state: reminderState(config.durationMs),
            monitoring: Boolean(preset && data.preset?.[config.id]?.monitoring) };
        if (preset?.mode === "buff") {
            entry.buffClock = {};
            entry.buffSyncPending = true;
        }
        if (automaticIconType(config.id) === "quickslot") {
            entry.quickslotClock = {};
            control("cooldown-row").hidden = false;
        }
        entries.set(config.id, entry);
        control("name").textContent = config.label;
        setSummary(entry, control("summary"));

        components.start.addEventListener("click", () => {
            const now = Date.now();
            prepareSound();
            if (preset?.mode === "buff") entry.manualBuffTimer = true;
            if (entry.state.endsAt !== null) {
                pauseReminder(entry.state, now);
            } else {
                if (!entry.state.remainingMs) {
                    entry.state = reminderState(config.durationMs);
                    entry.buffUncertaintyMs = 0;
                }
                startReminder(entry.state, now);
            }
            refreshRow(entry);
            if (preset?.mode === "buff") refreshSkill(entry);
        });
        components.reset.addEventListener("click", () => {
            if (preset?.mode === "buff") {
                entry.manualBuffTimer = true;
                entry.buffUncertaintyMs = 0;
            }
            entry.state = reminderState(config.durationMs);
            refreshRow(entry);
            if (preset?.mode === "buff") refreshSkill(entry);
        });
        if (!preset) control("remove").addEventListener("click", () => {
            entries.delete(config.id);
            row.remove();
            save();
            updateLimit(kind);
            if (kind === "skill") onMonitoringChange();
        });
        if (preset) {
            row.id = config.id;
            row.classList.add("hunt-preset");
            row.dataset.mode = config.mode;
            control("remove").hidden = true;
            components.stateLabel.hidden = false;
            components.progress.hidden = false;
            addAlertSwitch(entry, data.preset?.[config.id]);
            components.restart.setAttribute("aria-label", config.label + " 다시 시작");
            components.reset.setAttribute("aria-label", config.label + " 초기화");
            components.region.setAttribute("aria-label", config.label + " 아이콘 지정");
            components.monitor.setAttribute("aria-label", config.label + " 화면 감지");
            const choiceLabel = preset.mode === "buff" ? "직접 시작 시간" : "지속 시간";
            control("choice-label").textContent = choiceLabel;
            components.choice.setAttribute("aria-label", config.label + " " + choiceLabel);
            for (const [seconds, text] of preset.choices) components.choice.add(new Option(text, seconds * 1000));
            components.choice.value = config.durationMs;
            control("choice-field").hidden = preset.choices.length < 2;
            components.choice.addEventListener("change", () => {
                if (components.choice.disabled) return;
                config.durationMs = Number(components.choice.value);
                entry.state = reminderState(config.durationMs);
                if (preset.mode === "buff") {
                    entry.buffUncertaintyMs = 0;
                }
                setSummary(entry, control("summary"));
                refreshRow(entry);
                if (preset.mode === "buff") refreshSkill(entry);
                save();
            });
            components.restart.addEventListener("click", () => {
                prepareSound();
                if (preset.mode === "buff") {
                    entry.manualBuffTimer = true;
                    entry.buffUncertaintyMs = 0;
                }
                restart(entry);
            });
        }
        if (kind !== "custom-timer") {
            control("skill-settings").hidden = false;
            components.note.hidden = false;
            control("region-guide").textContent = config.mode === "buff" ? "버프가 켜진 상태에서 버프칸의 아이콘을 지정하세요."
                : "직접 지정하려면 사용 가능한 상태의 퀵슬롯 아이콘을 선택하세요.";
            components.region.addEventListener("click", () => chooseSkillRegion(config.id, config.mode));
            components.monitor.addEventListener("change", () => {
                entry.monitoring = components.monitor.checked;
                if (preset) save();
                refreshSkill(entry);
                onMonitoringChange();
            });
            components.restoreAuto.addEventListener("click", () => {
                delete config.region;
                entry.monitoring = false;
                entry.autoFound = false;
                save();
                refreshSkill(entry);
                onMonitoringChange();
                components.region.closest("details").querySelector("summary").focus();
            });
            refreshSkill(entry);
        }
        const list = kind === "preset" ? config.mode + "-preset"
            : kind === "custom-timer" && config.id.startsWith("quick-") ? "quick-timer" : kind;
        document.getElementById(`${list}-list`).append(row);
        refreshRow(entry);
    }

    for (const preset of presets) {
        const stored = data.preset?.[preset.id];
        const durationMs = preset.choices.some(([seconds]) => seconds * 1000 === stored?.durationMs)
            ? stored.durationMs : preset.choices[0][0] * 1000;
        add("preset", { id: preset.id, label: preset.label, mode: preset.mode, durationMs, leadMs: preset.lead * 1000,
            repeat: false, region: stored?.region }, preset);
    }

    for (const [kind, limit] of Object.entries(groups)) {
        if (Array.isArray(data[kind])) {
            for (const config of data[kind].filter((item) => validConfig(item, kind)).slice(0, limit)) {
                if (!entries.has(config.id)) add(kind, config);
            }
        }
        updateLimit(kind);
        const form = document.getElementById(`${kind}-form`);
        form.addEventListener("submit", (event) => {
            event.preventDefault();
            if (entriesFor(kind).length >= limit) return;
            const values = new FormData(form);
            const config = {
                id: crypto.randomUUID(),
                label: String(values.get("label") ?? "").trim(),
                durationMs: (Number(values.get("minutes")) * 60 + Number(values.get("seconds"))) * 1000,
                leadMs: Number(values.get("lead")) * 1000,
                repeat: values.has("repeat"),
                mode: values.get("mode"),
            };
            if (!validConfig(config, kind)) {
                document.getElementById(`${kind}-note`).textContent =
                    kind === "skill" ? "이름과 시간을 확인하세요. 미리 알림은 설정 시간보다 짧아야 해요."
                        : "이름을 입력하고 1초 이상, 24시간 이하로 설정하세요.";
                return;
            }
            add(kind, config);
            save();
            form.elements.namedItem("label").value = "";
            updateLimit(kind);
        });
    }

    document.getElementById("quick-timers").addEventListener("click", (event) => {
        const button = event.target.closest("[data-quick-minutes]");
        if (!button) return;
        const minutes = Number(button.dataset.quickMinutes);
        const id = "quick-" + minutes;
        const note = document.getElementById("quick-note");
        if (!entries.has(id)) {
            if (entriesFor("custom-timer").length >= groups["custom-timer"]) {
                document.getElementById("timers").open = true;
                note.textContent = "타이머를 하나 삭제하면 새 타이머를 시작할 수 있어요.";
                return;
            }
            add("custom-timer", { id, label: minutes + "분 타이머", durationMs: minutes * 60000, leadMs: 0, repeat: false });
            save();
            updateLimit("custom-timer");
        }
        prepareSound();
        const entry = entries.get(id);
        restart(entry);
        note.textContent = entry.config.label + " 시작";
    });

    return {
        advance(now) {
            for (const entry of entries.values()) advanceEntry(entry, now);
        },
        nextTimer() {
            let next = null;
            for (const entry of entries.values()) {
                const { config, state, buffUncertaintyMs } = entry;
                if (state.endsAt === null || (next && next.remainingMs <= state.remainingMs)) continue;
                next = { label: config.label, remainingMs: state.remainingMs,
                    approximate: buffUncertaintyMs > 2000, phase: timerPhase(entry) };
            }
            return next;
        },
        presetStatus(id) {
            const entry = entries.get(id);
            if (!entry) return null;
            const phase = timerPhase(entry);
            const value = phase === "running" || phase === "ending" ? entry.controls.remaining.value : timerLabels[phase];
            return { phase, value };
        },
        updateCapture(dimensions) {
            const changed = capture?.width !== dimensions?.width || capture?.height !== dimensions?.height ||
                !sameCaptureViewport(capture?.viewport, dimensions?.viewport);
            capture = dimensions;
            if (changed) {
                for (const entry of screenEntries()) {
                    entry.autoFound = false;
                    if (entry.preset?.mode === "buff") {
                        entry.buffClock = {};
                        entry.buffSyncPending = true;
                    }
                    if (entry.quickslotClock) entry.quickslotClock = {};
                    refreshSkill(entry);
                }
                onMonitoringChange();
            }
        },
        captureStopped() {
            capture = null;
            for (const entry of screenEntries()) {
                if (entry.kind === "skill") entry.monitoring = false;
                entry.autoFound = false;
                if (entry.quickslotClock) entry.quickslotClock = {};
                refreshSkill(entry);
            }
        },
        setSkillRegion(id, region) {
            const entry = entries.get(id);
            if (!entry) return;
            entry.config.region = region;
            entry.monitoring = entry.kind === "preset";
            save();
            refreshSkill(entry);
            onMonitoringChange();
            entry.controls.monitor.focus();
        },
        monitoredSkills() {
            return screenEntries().filter(({ config, monitoring }) => monitoring && captureMatches(config))
                .map(({ config }) => ({ id: config.id, mode: config.mode, region: config.region }));
        },
        automaticSkills() {
            return capture ? entriesFor("preset").filter(({ config }) => !captureMatches(config) && automaticIconType(config.id))
                .map(({ config }) => config.id) : [];
        },
        automaticIconReading(reading) {
            const { id, found, activated, activatedAt = Date.now(), briefGap = false, clock, sampledAt, settled, seconds, ready } = reading;
            const entry = entries.get(id);
            if (!capture || !entry?.preset || captureMatches(entry.config)) return;
            entry.autoFound = found && (id !== "preset-exp-coupon" || settled);
            const { config, preset } = entry;
            if (id === "preset-exp-coupon") {
                readExperienceCoupon(entry, reading);
            } else if (preset.mode !== "buff") {
                observeQuickslotClock(entry.quickslotClock, { seconds, sampledAt, ready });
                if (activated) restart(entry, activatedAt);
            } else if (activated && (entry.autoBuffEndsAt === undefined ? !briefGap
                : activatedAt >= (entry.buffEarliestEnd ?? entry.autoBuffEndsAt) - clockToleranceMs)) {
                advanceEntry(entry, activatedAt);
                usePresetDuration(entry);
                entry.buffClock = {};
                entry.buffClockSynced = false;
                entry.buffSyncPending = true;
                entry.manualBuffTimer = false;
                entry.buffUncertaintyMs = 0;
                entry.buffEarliestEnd = undefined;
                entry.autoBuffEndsAt = activatedAt + config.durationMs;
                restart(entry, activatedAt);
            } else if (clock && settled) {
                synchronizeBuff(entry, clock, sampledAt);
            }
            refreshSkill(entry);
        },
        skillActivated(id) {
            const entry = entries.get(id);
            if (entry?.monitoring && captureMatches(entry.config)) restart(entry);
        },
    };
}

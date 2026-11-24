import { canCaptureGame, createCaptureWorker, isSkillIconRect, readSkillRegion, requestGameWindow } from "../alerts/game-capture.mjs";

export function initBossCapture({ rows, getRegion, setRegion, onSkill }) {
    const byId = (id) => document.getElementById("boss-" + id);
    const share = byId("share");
    const stop = byId("stop-share");
    const stage = byId("stage");
    const video = byId("preview");
    const layer = byId("selection-layer");
    const box = byId("selection-box");
    const tools = byId("selection-tools");
    const help = byId("selection-help");
    const save = byId("save-region");
    const status = byId("capture-status");
    let stream = null;
    let worker = null;
    let frame = null;
    let opening = false;
    let selection = null;
    let note = "게임 창 공유 대기";

    function refresh() {
        const ready = Boolean(stream && frame && !frame.dark && Date.now() - frame.at < 4500 && video.videoWidth);
        const text = ready ? "공유 중 · 화면은 브라우저에서 분석돼요."
            : opening ? "창 선택 중"
                : stream ? "게임 화면을 기다리는 중이에요. 게임 창을 확인하세요." : note;
        if (status.textContent !== text) status.textContent = text;
        share.disabled = Boolean(stream || opening);
        stop.disabled = !stream;
        stage.hidden = !stream;
        if (video.videoWidth && video.videoHeight) stage.style.aspectRatio = video.videoWidth + " / " + video.videoHeight;
        for (const [key, { slot, clear }] of rows) {
            const region = getRegion(key);
            const resized = region && ready && (region.width !== frame.width || region.height !== frame.height);
            slot.disabled = !ready;
            slot.textContent = resized ? "다시 지정" : region ? "지정됨" : "퀵슬롯 지정";
            clear.hidden = !region;
        }
    }

    function sync() {
        if (!worker) return;
        const skills = [...rows.keys()].filter((key) => key !== selection?.key && getRegion(key))
            .map((id) => ({ id, mode: "cooldown", region: getRegion(id) }));
        worker.postMessage({ type: "skills", skills });
    }

    function closeSelection() {
        const selected = selection;
        selection = null;
        layer.hidden = true;
        box.hidden = true;
        tools.hidden = true;
        sync();
        selected?.slot.focus({ preventScroll: true });
    }

    function disconnect(message) {
        const closing = stream;
        stream = null;
        worker?.terminate();
        worker = null;
        closing?.getTracks().forEach((track) => track.stop());
        video.srcObject = null;
        frame = null;
        note = message;
        closeSelection();
        refresh();
    }

    share.addEventListener("click", async () => {
        if (opening || stream) return;
        if (!canCaptureGame()) {
            note = "PC용 최신 Chrome 또는 Edge의 보안 연결에서 창을 공유할 수 있어요.";
            refresh();
            return;
        }
        opening = true;
        refresh();
        try {
            stream = await requestGameWindow();
            if (!stream) {
                disconnect("공유 선택창의 ‘창’ 탭에서 메이플스토리를 선택하세요.");
                return;
            }
            const [track] = stream.getVideoTracks();
            track.addEventListener("ended", () => {
                if (stream?.getVideoTracks()[0] === track) disconnect("화면 공유가 종료됐어요.");
            });
            worker = createCaptureWorker(track, (event) => {
                if (event.type === "frame") {
                    frame = { ...event, at: Date.now() };
                    refresh();
                } else if (event.type === "skill-activated" && event.id !== selection?.key) {
                    onSkill(event.id);
                } else if (event.type === "ended" || event.type === "error") {
                    disconnect(event.type === "ended" ? "화면 공유가 종료됐어요." : "게임 화면을 읽지 못했어요. 다시 공유해 주세요.");
                }
            }, () => disconnect("게임 화면 분석을 시작하지 못했어요."));
            sync();
            video.srcObject = stream;
            refresh();
            await video.play();
        } catch (error) {
            disconnect(error.name === "NotAllowedError" ? "창 공유가 취소됐어요." : "게임 창을 연결하지 못했어요.");
        } finally {
            opening = false;
            refresh();
        }
    });
    stop.addEventListener("click", () => disconnect("화면 공유가 종료됐어요."));
    video.addEventListener("resize", refresh);
    window.addEventListener("pagehide", () => {
        if (stream) disconnect("화면 공유가 종료됐어요.");
    });
    setInterval(() => { if (stream) refresh(); }, 1000);

    function point(event) {
        const area = layer.getBoundingClientRect();
        const clamp = (value) => Math.max(0, Math.min(1, value));
        return { x: clamp((event.clientX - area.left) / area.width), y: clamp((event.clientY - area.top) / area.height) };
    }

    function move(event) {
        if (selection?.pointer !== event.pointerId) return;
        const start = selection.start;
        const end = point(event);
        const rect = { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), w: Math.abs(start.x - end.x), h: Math.abs(start.y - end.y) };
        selection.rect = rect;
        box.hidden = false;
        box.style.left = rect.x * 100 + "%";
        box.style.top = rect.y * 100 + "%";
        box.style.width = rect.w * 100 + "%";
        box.style.height = rect.h * 100 + "%";
        save.disabled = !isSkillIconRect(rect, selection.width, selection.height);
    }

    for (const [key, { name, slot, clear }] of rows) {
        slot.addEventListener("click", () => {
            selection = { key, slot, width: video.videoWidth, height: video.videoHeight };
            help.textContent = name + "의 사용 가능한 퀵슬롯 아이콘 한 칸을 드래그하세요.";
            save.disabled = true;
            box.hidden = true;
            tools.hidden = false;
            layer.hidden = false;
            sync();
            stage.scrollIntoView({ block: "nearest" });
        });
        clear.addEventListener("click", () => {
            if (key === selection?.key) closeSelection();
            setRegion(key, null);
            sync();
            refresh();
        });
    }

    layer.addEventListener("pointerdown", (event) => {
        if (!selection || event.button !== 0 || selection.pointer != null) return;
        layer.setPointerCapture(event.pointerId);
        selection.pointer = event.pointerId;
        selection.start = point(event);
        move(event);
    });
    layer.addEventListener("pointermove", move);
    layer.addEventListener("pointerup", (event) => {
        if (selection?.pointer !== event.pointerId) return;
        move(event);
        selection.pointer = null;
    });
    layer.addEventListener("pointercancel", () => {
        if (selection) selection.pointer = null;
        box.hidden = true;
        save.disabled = true;
    });
    save.addEventListener("click", () => {
        if (!selection?.rect) return;
        if (selection.width !== video.videoWidth || selection.height !== video.videoHeight) {
            help.textContent = "공유 창 크기가 바뀌었어요. 퀵슬롯을 다시 지정하세요.";
            save.disabled = true;
            return;
        }
        if (!frame || frame.dark || Date.now() - frame.at >= 4500) {
            help.textContent = "게임 화면이 들어오면 영역을 저장하세요.";
            return;
        }
        const region = readSkillRegion(video, selection.rect);
        if (!region) {
            help.textContent = "선명하게 보이는 스킬 아이콘 한 칸을 다시 드래그하세요.";
            return;
        }
        setRegion(selection.key, region);
        closeSelection();
        refresh();
    });
    byId("cancel-region").addEventListener("click", closeSelection);
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && selection) closeSelection();
    });
    refresh();
}

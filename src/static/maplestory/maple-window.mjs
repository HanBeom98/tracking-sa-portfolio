export function initMapleWindow({ button, template, note, title, height }) {
    const api = globalThis.documentPictureInPicture;
    let pip = null;
    let model = null;

    function render() {
        if (!pip || pip.closed || !model) return;
        for (const [key, value] of Object.entries(model)) {
            const node = pip.document.querySelector("[data-pip-" + key + "]");
            if (node && node.textContent !== value) node.textContent = value;
        }
    }

    button.hidden = !api;
    button.addEventListener("click", async () => {
        if (pip && !pip.closed) {
            pip.focus();
            return;
        }
        button.disabled = true;
        try {
            pip = await api.requestWindow({ width: 335, height });
            pip.document.title = title;
            pip.document.body.className = "maple-pip";
            const sources = [...document.styleSheets];
            pip.document.adoptedStyleSheets = ["./maple-theme.css", "./alerts/style.css"].flatMap((path) => {
                const href = new URL(path, import.meta.url).href;
                const source = sources.find((sheet) => sheet.href?.split("?", 1)[0] === href);
                if (!source) return [];
                const stylesheet = new pip.CSSStyleSheet();
                stylesheet.replaceSync([...source.cssRules].map((rule) => rule.cssText).join("\n"));
                return [stylesheet];
            });
            pip.document.body.append(pip.document.importNode(template.content, true));
            pip.addEventListener("pagehide", () => { pip = null; }, { once: true });
            render();
        } catch {
            pip?.close();
            pip = null;
            note.textContent = "작은 창을 열 수 없어요. 페이지를 활성화한 뒤 다시 누르세요.";
        } finally {
            button.disabled = false;
        }
    });
    return {
        update(summary) {
            model = summary;
            render();
        },
    };
}

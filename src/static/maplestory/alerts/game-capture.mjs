import { skillSampleSize, skillSignature } from "./skill-vision.mjs";

export function canCaptureGame() {
    return Boolean(globalThis.navigator?.mediaDevices?.getDisplayMedia &&
        globalThis.MediaStreamTrackProcessor && globalThis.OffscreenCanvas);
}

export async function requestGameCapture(surface) {
    const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: surface, frameRate: { ideal: 5, max: 10 } },
        audio: false,
        monitorTypeSurfaces: surface === "monitor" ? "include" : "exclude",
        selfBrowserSurface: "exclude",
        surfaceSwitching: "exclude",
    });
    if (stream.getVideoTracks()[0]?.getSettings().displaySurface === surface) return stream;
    stream.getTracks().forEach((track) => track.stop());
    return null;
}

export function requestGameWindow() {
    return requestGameCapture("window");
}

export function createCaptureWorker(track, onMessage, onError, surface = "window") {
    const { readable } = new MediaStreamTrackProcessor({ track, maxBufferSize: 1 });
    const worker = new Worker(new URL("./capture-worker.js?v=maple-hunt-10", import.meta.url), { type: "module" });
    worker.onmessage = ({ data }) => onMessage(data);
    worker.onerror = onError;
    try {
        worker.postMessage({ type: "start", readable, surface }, [readable]);
        return worker;
    } catch (error) {
        worker.terminate();
        throw error;
    }
}

export function isSkillIconRect({ w, h }, width, height) {
    const pixelsWide = w * width;
    const pixelsTall = h * height;
    const ratio = pixelsWide / pixelsTall;
    return pixelsWide >= 12 && pixelsWide <= 128 && pixelsTall >= 12 && pixelsTall <= 128 &&
        ratio >= .65 && ratio <= 1.55;
}

export function readSkillRegion(video, rect, viewport = { x: 0, y: 0, width: video.videoWidth, height: video.videoHeight }) {
    const { x, y, width, height } = viewport;
    const crop = new OffscreenCanvas(skillSampleSize, skillSampleSize);
    const context = crop.getContext("2d");
    context.drawImage(video, x + rect.x * width, y + rect.y * height, rect.w * width, rect.h * height,
        0, 0, crop.width, crop.height);
    const signature = skillSignature(context.getImageData(0, 0, crop.width, crop.height).data);
    if (Math.max(...signature) - Math.min(...signature) < 25) return null;
    return { rect, width, height, signature: Array.from(signature) };
}

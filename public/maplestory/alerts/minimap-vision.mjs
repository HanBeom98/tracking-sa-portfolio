const MIN_BORDER_WIDTH = 64;
const UI_SCALES = [.5, .6, .7, .8, .9, 1, 1.12, 1.25, 1.4, 1.55, 1.75, 2, 2.25, 2.5];

function bright(data, pixel) {
    const r = data[pixel];
    const g = data[pixel + 1];
    const b = data[pixel + 2];
    const low = Math.min(r, g, b);
    return low >= 162 && Math.max(r, g, b) - low <= 40;
}

function lightness({ data, width, height }, x, y) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || x >= width || y < 0 || y >= height) return 0;
    const pixel = (y * width + x) * 4;
    return (data[pixel] + data[pixel + 1] * 2 + data[pixel + 2]) / 4;
}

function controlsScale(image, left, top) {
    // The minus/plus positions are relative to the map frame, independent of map content and width.
    for (const scale of UI_SCALES) {
        const x = left + 5 * scale;
        const plusX = x + 21 * scale;
        for (const headerHeight of [53, 55, 57]) {
            const estimate = Math.round(top - headerHeight * scale);
            for (let y = estimate - 2; y <= estimate + 2; y++) {
                if (y < 5) continue;
                const minus = Math.min(...[-2, 0, 2].map(dx => lightness(image, x + dx * scale, y)));
                const minusBackground = Math.max(lightness(image, x, y - 5 * scale), lightness(image, x, y + 5 * scale));
                if (minus < 102 || minus - minusBackground < 38) continue;
                const plus = lightness(image, plusX, y);
                const plusArm = Math.max(lightness(image, plusX, y - 3 * scale), lightness(image, plusX, y + 3 * scale));
                const plusBackground = Math.min(lightness(image, plusX - 4 * scale, y - 4 * scale),
                    lightness(image, plusX + 4 * scale, y - 4 * scale), lightness(image, plusX + 4 * scale, y + 4 * scale));
                if (plus >= plusBackground + 8 && plusArm >= plusBackground + 8) return scale;
            }
        }
    }
    return null;
}

function brightNear(image, x, y, radius) {
    const { data, width } = image;
    for (let i = Math.max(0, x - radius); i <= Math.min(width - 1, x + radius); i++) {
        if (bright(data, (y * width + i) * 4)) return true;
    }
    return false;
}

function mapInterior(image, left, right, top, scale) {
    const span = right - left;
    const { data, width, height } = image;
    const sideOffset = Math.max(2, Math.round(2.5 * scale));
    const sideRadius = Math.max(2, Math.ceil(2.5 * scale));
    for (let bottom = top + Math.max(24, Math.round(35 * scale)); bottom < Math.min(height, top + 255 * scale); bottom++) {
        let horizontal = 0;
        for (let step = 1; step <= 9; step++) {
            const x = left + Math.round(span * step / 10);
            horizontal += Number(bright(data, (bottom * width + x) * 4));
        }
        if (horizontal < 8) continue;

        let sides = 0;
        for (let step = 1; step <= 6; step++) {
            const y = top + Math.round((bottom - top) * step / 7);
            sides += Number(brightNear(image, left - sideOffset, y, sideRadius) &&
                brightNear(image, right + sideOffset, y, sideRadius));
        }
        if (sides < 5) continue;
        // Inset the white border so the rune reader only receives the map interior.
        const y = top + Math.max(2, Math.round(2 * scale));
        return { x: left, y, width: span + 1, height: bottom - y };
    }
    return null;
}

export function findMinimap(image) {
    const { data, width, height } = image;
    for (let y = 28; y < height - 24; y++) {
        const row = y * width;
        let left = -1;
        for (let x = 0; x <= width; x++) {
            if (x < width && bright(data, (row + x) * 4)) {
                if (left < 0) left = x;
                continue;
            }
            if (left >= 0 && x - left >= MIN_BORDER_WIDTH) {
                const scale = controlsScale(image, left, y);
                if (scale !== null) {
                    const map = mapInterior(image, left, x - 1, y, scale);
                    if (map) return map;
                }
            }
            left = -1;
        }
    }
    return null;
}

function sameMinimap(a, b) {
    return Boolean(a && b && ["x", "y", "width", "height"].every(key => Math.abs(a[key] - b[key]) <= 3));
}

export function minimapState() {
    return { pending: null, active: null, found: false };
}

export function observeMinimap(state, candidate) {
    const confirmed = sameMinimap(state.active ?? state.pending, candidate);
    state.active = confirmed ? candidate : null;
    state.pending = confirmed ? null : candidate;
    state.found ||= confirmed;
    return state.active;
}

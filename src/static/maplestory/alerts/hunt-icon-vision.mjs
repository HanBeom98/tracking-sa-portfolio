import { observeSkillIcon, skillVisionState } from "./skill-vision.mjs";
import { readBuffCountdown, readQuickslotCountdown } from "./buff-countdown.mjs?v=maple-hunt-9";

const sampleColumns = [5, 10, 16, 22, 26];
const sampleRows = [5, 9, 13, 17, 21];
const quickslotPoints = sampleRows.flatMap((y) => sampleColumns.map((x) => [x, y]));
// These buff samples avoid the bottom-left duration overlay. Samples in the
// bottom-right distinguish the gold wealth potion from the silver EXP potion.
const buffPoints = [
    [4, 4], [8, 5], [12, 6], [18, 8], [23, 8], [26, 10], [8, 9], [11, 12], [15, 13], [18, 13],
    [22, 13], [25, 14], [12, 16], [15, 16], [18, 16], [21, 17], [24, 17], [26, 18], [19, 20],
    [22, 20], [25, 21], [18, 23], [21, 24], [24, 25], [25, 26],
];
const timedBuffPoints = [
    [3, 3], [6, 3], [9, 4], [12, 3], [15, 5], [18, 4], [21, 4], [24, 5], [26, 6],
    [5, 7], [9, 7], [12, 7], [17, 7], [22, 7], [26, 7], [17, 22], [20, 22], [24, 22],
    [26, 22], [17, 24], [20, 24], [23, 24], [26, 24], [18, 26], [21, 26], [24, 26], [26, 26],
];
// The top of the 30px buff box stays legible under both countdown styles.
// Standard and MVP coupons with the same multiplier share this artwork.
const couponPoints = [
    [24, 9], [19, 5], [26, 8], [25, 8], [23, 9], [24, 5], [21, 6], [19, 8],
    [8, 5], [4, 4], [13, 4], [11, 6], [3, 8], [3, 6], [10, 3], [4, 6],
    [8, 6], [4, 9], [4, 5], [6, 5], [10, 6], [11, 5],
];
export const experienceCoupons = {
    "exp-2x": { label: "경험치 2배 쿠폰", maxSeconds: 3600 },
    "exp-3x": { label: "경험치 3배 쿠폰", maxSeconds: 1800 },
    "exp-4x": { label: "경험치 4배 쿠폰", maxSeconds: 1800 },
    "union-exp-2": { label: "유니온의 경험 2단계", maxSeconds: 1200 },
};
const couponColors = {
    "exp-2x": [
        34, 204, 238, 136, 238, 255, 0, 34, 187, 0, 34, 187, 0, 34, 204, 0, 34, 187, 153, 238, 255, 0, 34, 204,
        51, 221, 255, 51, 221, 255, 51, 221, 255, 51, 221, 255, 51, 221, 255, 51, 221, 255, 51, 221, 255, 51, 221, 255,
        51, 221, 255, 51, 221, 255, 51, 221, 255, 51, 221, 255, 51, 221, 255, 51, 221, 255,
    ],
    "exp-3x": [
        85, 153, 255, 170, 221, 255, 85, 153, 255, 0, 17, 136, 0, 17, 136, 0, 17, 136, 153, 204, 255, 0, 17, 136,
        102, 136, 255, 102, 136, 255, 102, 136, 255, 102, 136, 255, 102, 136, 255, 102, 136, 255, 102, 136, 255, 102, 136, 255,
        102, 136, 255, 102, 136, 255, 102, 136, 255, 102, 136, 255, 102, 136, 255, 102, 136, 255,
    ],
    "exp-4x": [
        255, 255, 255, 0, 17, 136, 119, 170, 255, 0, 17, 136, 255, 255, 255, 0, 17, 136, 68, 102, 255, 119, 136, 255,
        68, 119, 255, 51, 153, 255, 51, 153, 255, 68, 102, 255, 68, 102, 255, 68, 102, 255, 51, 170, 255, 68, 102, 255,
        68, 102, 255, 85, 136, 255, 68, 119, 255, 68, 119, 255, 68, 102, 255, 68, 119, 255,
    ],
    "union-exp-2": [
        134, 125, 227, 99, 135, 255, 190, 206, 255, 89, 103, 254, 134, 125, 227, 184, 200, 255, 99, 135, 255, 174, 192, 254,
        99, 135, 255, 221, 229, 255, 238, 242, 255, 100, 135, 255, 100, 135, 255, 99, 135, 255, 99, 135, 255, 205, 216, 255,
        99, 135, 255, 102, 98, 225, 221, 229, 255, 158, 181, 255, 99, 135, 255, 99, 135, 255,
    ],
};
// The game draws the buff sprites at about 83% of their original RGB values.
const couponSignatures = Object.entries(couponColors).map(([variant, colors]) =>
    ({ variant, colors: colors.map(value => Math.round(value * .83)) }));

// Avoid both the centered countdown and the key name or charge count in the corners.
const timedQuickslotPoints = [
    [17, 5], [21, 5], [25, 5], [5, 22], [9, 22], [25, 22], [5, 25],
    [9, 25], [13, 25], [17, 25], [5, 27], [9, 27], [13, 27], [17, 27],
];
const settings = {
    quickslot: { sizes: [32, 44, 45, 40, 48, 24], native: 32, points: quickslotPoints, maxError: 19 },
    buff: { sizes: [30, 24, 38, 45], native: 30, points: buffPoints, maxError: 10.5 },
};

const dimmedFountain = [
    255, 255, 255, 153, 255, 255, 85, 221, 255, 34, 204, 255, 119, 255, 255,
    34, 204, 255, 119, 255, 255, 255, 255, 255, 102, 255, 255, 255, 255, 255,
    85, 221, 255, 153, 238, 255, 255, 255, 255, 255, 255, 255,
];
const timedQuickslotColors = {
    "preset-janus": [[
        221, 221, 221, 85, 85, 119, 85, 85, 85, 58, 67, 85, 81, 83, 124,
        74, 75, 124, 42, 51, 85, 105, 114, 148, 74, 75, 124, 81, 83, 124,
        26, 35, 61, 42, 51, 85, 89, 90, 132, 58, 67, 101,
    ]],
    "preset-fountain": [.42, .58, .74].map(scale => dimmedFountain.map(value => Math.round(value * scale))),
};
// The skill artwork samples avoid shortcut labels along the bottom edge.
const skillColors = {
    "preset-janus": [
        51, 51, 85, 170, 170, 204, 119, 102, 170, 255, 255, 255, 51, 51, 85,
        255, 255, 255, 221, 204, 238, 119, 102, 170, 119, 102, 170, 255, 255, 255,
        119, 102, 170, 119, 102, 170, 119, 102, 187, 119, 102, 170, 119, 102, 170,
        119, 102, 170, 85, 68, 136, 68, 51, 119, 119, 102, 170, 119, 102, 170,
        85, 85, 102, 119, 102, 170, 85, 68, 136, 187, 170, 221, 85, 85, 102,
    ],
    "preset-fountain": [
        17, 136, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 17, 136, 255,
        255, 255, 255, 153, 255, 255, 255, 255, 255, 153, 255, 255, 255, 255, 255,
        0, 17, 255, 0, 102, 255, 255, 255, 255, 0, 102, 255, 255, 255, 255,
        34, 204, 255, 0, 102, 255, 34, 221, 255, 0, 102, 255, 187, 255, 255,
        34, 204, 255, 0, 102, 255, 170, 255, 255, 0, 102, 255, 34, 204, 255,
    ],
};

const buffColors = {
    "preset-wealth": [
        102, 198, 211, 4, 101, 114, 214, 213, 211, 74, 185, 183, 4, 2, 1,
        4, 3, 1, 46, 157, 183, 172, 213, 212, 88, 185, 169, 32, 101, 86,
        74, 115, 99, 60, 73, 30, 144, 199, 184, 144, 199, 169, 116, 171, 156,
        116, 143, 85, 200, 185, 155, 131, 101, 43, 144, 129, 71, 200, 171, 113,
        130, 87, 44, 131, 101, 43, 215, 213, 127, 5, 3, 1, 214, 213, 211,
    ],
};
// The game's centered countdown darkens the lower part of the icon.
const timedBuffColors = {
    "preset-wealth": [
        65, 191, 206, 107, 204, 220, 9, 7, 11, 217, 219, 219, 219, 218, 219,
        210, 210, 210, 214, 213, 214, 213, 213, 214, 213, 213, 214, 37, 149, 165,
        79, 189, 205, 219, 219, 219, 8, 7, 9, 4, 4, 4, 213, 212, 214,
        121, 129, 96, 114, 102, 84, 94, 89, 83, 22, 31, 50, 114, 103, 84,
        114, 103, 84, 81, 71, 71, 121, 129, 149, 115, 110, 97, 82, 71, 71,
        121, 129, 149, 121, 129, 148,
    ],
};

export function automaticIconType(id) {
    if (Object.hasOwn(skillColors, id)) return "quickslot";
    return id === "preset-exp-coupon" || Object.hasOwn(buffColors, id) ? "buff" : null;
}

function templateFor(size, width, native, points, colors) {
    const offsets = points.map(([x, y]) =>
        (Math.floor((y + .5) * size / native) * width + Math.floor((x + .5) * size / native)) * 4);
    return { offsets, colors };
}

function iconError(data, start, template, ratio = 1, ceiling = Infinity) {
    let total = 0;
    const { offsets, colors } = template;
    for (let i = 0; i < offsets.length; i++) {
        const here = start + offsets[i];
        const there = i * 3;
        total += Math.abs(data[here] - colors[there] * ratio) +
            Math.abs(data[here + 1] - colors[there + 1] * ratio) +
            Math.abs(data[here + 2] - colors[there + 2] * ratio);
        if (total > ceiling * colors.length) return Infinity;
    }
    return total / colors.length;
}

function timedQuickslotTemplates(id, size, width) {
    return timedQuickslotColors[id].map(colors => templateFor(size, width, settings.quickslot.native, timedQuickslotPoints, colors));
}

function quickslotReadyLimit(size) {
    return size >= 40 ? 24 : settings.quickslot.maxError;
}

function buffErrorLimit(id, size) {
    if (id === "preset-exp-coupon" && size !== settings.buff.native) return size === 24 ? 17 : 14;
    return settings.buff.maxError;
}

function buffTemplates(id, size, width) {
    const { native, points } = settings.buff;
    if (id === "preset-exp-coupon") {
        return couponSignatures.map(({ variant, colors }) =>
            ({ ...templateFor(size, width, native, couponPoints, colors), variant }));
    }
    return [templateFor(size, width, native, points, buffColors[id]),
        templateFor(size, width, native, timedBuffPoints, timedBuffColors[id])];
}

function findIcon(frame, id, type, cooling = false) {
    const { data, width, height } = frame;
    const { sizes, native, points } = settings[type];
    const coupon = id === "preset-exp-coupon";
    let best = null;
    for (const size of sizes) {
        const limit = cooling ? 16 : type === "quickslot" ? quickslotReadyLimit(size) : buffErrorLimit(id, size);
        const templates = cooling ? timedQuickslotTemplates(id, size, width)
            : type === "buff" ? buffTemplates(id, size, width)
                : [templateFor(size, width, native, points, skillColors[id])];
        const borderOffsets = coupon ? templateFor(size, width, native, [[12, 1], [1, 6], [28, 6]], []).offsets : null;
        const borderRed = size === 24 ? 112 : 165;
        const strongMatch = coupon ? 2 : limit * .75;
        for (const template of templates) {
            const step = size === native || type === "quickslot" || template.variant ? 1 : 2;
            for (let y = 0; y <= height - size; y += step) {
                for (let x = 0; x <= width - size; x += step) {
                    const start = (y * width + x) * 4;
                    // The light bevel anchors the crop so a smaller fragment of a
                    // scaled coupon cannot hide its countdown by winning the search.
                    if (borderOffsets && (data[start + borderOffsets[0]] < borderRed ||
                        data[start + borderOffsets[1]] < borderRed || data[start + borderOffsets[2]] < borderRed)) continue;
                    const ceiling = Math.min(best?.error ?? Infinity, limit);
                    const error = iconError(data, start, template, 1, ceiling);
                    if (error >= ceiling || (cooling && !(readQuickslotCountdown(frame, { x, y, size }) > 0))) continue;
                    best = { x, y, size, template, error };
                }
            }
            if (best?.error < strongMatch) break;
        }
        if (best?.error < strongMatch) break;
    }
    if (best && type === "quickslot") {
        if (cooling) best.template = templateFor(best.size, width, native, points, skillColors[id]);
        best.timedTemplates = timedQuickslotTemplates(id, best.size, width);
    }
    return best;
}

function classifyQuickslot({ data, width }, { x, y, size, template }) {
    const start = (y * width + x) * 4;
    const maxError = quickslotReadyLimit(size);
    if (iconError(data, start, template, 1, maxError) <= maxError) return "visible";
    let expected = 0;
    let actual = 0;
    for (let i = 0; i < template.offsets.length; i++) {
        const pixel = start + template.offsets[i];
        const color = i * 3;
        expected += template.colors[color] + template.colors[color + 1] + template.colors[color + 2];
        actual += data[pixel] + data[pixel + 1] + data[pixel + 2];
    }
    const ratio = actual / expected;
    return ratio >= .25 && ratio <= .81 && iconError(data, start, template, ratio, 14) <= 14
        ? "dimmed" : "unknown";
}

export function huntIconState() {
    return { position: null, vision: skillVisionState(), missing: 0, nextSearch: 0 };
}

function observeBuff(frame, state, id, now) {
    const { data, width } = frame;
    const position = state.position;
    const maxError = buffErrorLimit(id, position?.size ?? settings.buff.native);
    if (!position || iconError(data, (position.y * width + position.x) * 4, position.template, 1, maxError) >= maxError) {
        state.position = findIcon(frame, id, "buff");
    }
    const found = state.position !== null;
    const variant = state.position?.template.variant;
    const appearance = variant ?? (found ? "visible" : "unknown");
    if (found && state.vision.candidate !== appearance) {
        state.appearedAt = now;
        state.briefGap = state.vision.stable === appearance;
    }
    const previous = state.vision.stable;
    const activated = observeSkillIcon(state.vision, appearance, "buff") ||
        Boolean(variant && previous !== null && previous !== variant && state.vision.stable === variant);
    const settled = state.vision.stable === appearance && (!variant || state.vision.frames >= 3);
    const clock = found ? readBuffCountdown(frame, state.position) : null;
    const reading = variant ? { found, variant, settled } : { found };
    if (clock) Object.assign(reading, { clock, sampledAt: now, settled });
    if (activated) return { ...reading, activated, activatedAt: state.appearedAt };
    if (found && state.briefGap && state.vision.frames === 3) {
        return { ...reading, activated: true, activatedAt: state.appearedAt, briefGap: true };
    }
    return { ...reading, activated: false };
}

export function observeHuntIcon(frame, state, id, type, now) {
    if (type === "buff") return observeBuff(frame, state, id, now);
    state.position ??= findIcon(frame, id, "quickslot") ?? findIcon(frame, id, "quickslot", true);
    if (!state.position) return { found: false, activated: false };

    const { x, y, timedTemplates } = state.position;
    const baseAppearance = classifyQuickslot(frame, state.position);
    const timed = baseAppearance !== "visible" && (baseAppearance === "dimmed"
        || timedTemplates.some(template => iconError(frame.data, (y * frame.width + x) * 4, template, 1, 16) < 16));
    const seconds = timed ? readQuickslotCountdown(frame, state.position) : null;
    const appearance = seconds > 0 ? "dimmed" : baseAppearance;
    state.missing = appearance === "unknown" ? state.missing + 1 : 0;
    if (state.missing >= 5) {
        Object.assign(state, huntIconState());
        return { found: false, activated: false };
    }
    const activated = observeSkillIcon(state.vision, appearance, "install");
    if (seconds > 0) return { found: true, activated, seconds, sampledAt: now };
    if (appearance === "visible" && state.vision.frames >= 3) return { found: true, activated, ready: true, sampledAt: now };
    return { found: true, activated };
}

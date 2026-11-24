const minute = 60_000;
const blueRows = [
    [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [238, 255, 255],
    [221, 238, 255], [187, 221, 255], [170, 204, 255], [153, 204, 255],
];
const yellowDigits = {
    0: ".####. #....# #....# #....# #....# #....# #....# ##..## .####.",
    1: ".## ### ..# ..# ..# ..# ..# ..# ..#",
    2: "##### ....# ....# ....# ...## ..##. .##.. ##... #####",
    3: "####. ....# ....# ...## .###. ....# ....# ...## ####.",
    4: "...##. ...##. ..###. ..#.#. .#..#. .#..#. ###### ....#. ....#.",
    5: "##### #.... #.... #.... ####. ....# ....# ...## ####.",
    6: "..#### .##... #..... #..... #####. #....# #....# #....# .####.",
    7: "###### ....## ....#. ...##. ...#.. ...#.. ..#... ..#... .#....",
    8: ".####. #....# #....# .#..#. .####. ##..## #....# ##..## .####.",
    9: ".####. #....# #....# #....# .##### .....# .....# ....## ####..",
    ":": ". . # # . . # # .",
};
const blueDigits = {
    ...yellowDigits,
    0: ".####. #....# #....# #....# #....# #....# #....# #....# .####.",
    1: "..# ### ..# ..# ..# ..# ..# ..# ..#",
    2: ".####. #....# .....# .....# ....#. ..##.. .#.... #..... ######",
    3: ".####. #....# .....# .....# ..###. .....# .....# #....# .####.",
    6: ".####. #....# #..... #..... #####. #....# #....# #....# .####.",
    7: "###### .....# ....#. ....#. ...#.. ...#.. ..#... ..#... ..#...",
    9: ".####. #....# #....# #....# #....# .##### .....# .....# .####.",
};

function readDigit(rows, patterns, left, right) {
    const width = right - left;
    let best = Infinity;
    let nextBest = Infinity;
    let result = null;
    for (const [digit, pattern] of Object.entries(patterns)) {
        const expected = pattern.split(" ");
        if (Math.abs(width - expected[0].length) > 1) continue;
        let differences = Math.abs(width - expected[0].length) * 2;
        for (let y = 0; y < 9; y++) {
            for (let x = 0; x < width; x++) {
                const sourceX = Math.floor((x + .5) * expected[y].length / width);
                if (rows[y][left + x] !== (expected[y][sourceX] === "#")) differences++;
            }
        }
        if (differences < best) {
            nextBest = best;
            best = differences;
            result = digit;
        } else nextBest = Math.min(nextBest, differences);
    }
    return best <= (width <= 3 ? 2 : 7) && nextBest - best >= 2 ? result : null;
}

function readDigits(ink, width, patterns) {
    const rows = Array.from({ length: 9 }, (_, y) => Array.from({ length: width }, (_, x) => ink(x, y)));
    let result = "";
    let start = null;
    for (let x = 0; x <= width; x++) {
        if (rows.some((row) => row[x])) start ??= x;
        else if (start !== null) {
            const digit = readDigit(rows, patterns, start, x);
            if (digit === null) return null;
            result += digit;
            start = null;
        }
    }
    return result;
}

function yellowInk(data, pixel) {
    return data[pixel] >= 175 && data[pixel + 1] >= 170 && data[pixel + 2] < 110 && data[pixel] - data[pixel + 2] > 80;
}

function yellowSeconds(text) {
    const match = text?.match(/^(\d{1,2}):([0-5]\d)$/);
    if (match) return Number(match[1]) * 60 + Number(match[2]);
    return /^\d{1,3}$/.test(text ?? "") ? Number(text) : null;
}

export function readQuickslotCountdown({ data, width }, { x, y, size }) {
    if (size < 24) return null;
    const normal = 32;
    let firstRow = normal;
    let lastRow = -1;
    let firstColumn = normal;
    let lastColumn = -1;
    const mask = new Uint8Array(normal * normal);
    // The timer sits in the center. Shortcut labels and stack counters sit near the corners.
    for (let row = 9; row <= 23; row++) {
        const start = (y + Math.floor((row + .5) * size / normal)) * width + x;
        for (let col = 2; col <= 29; col++) {
            const pixel = (start + Math.floor((col + .5) * size / normal)) * 4;
            // Scaled HUD glyphs are antialiased against the black countdown outline.
            const ink = size === normal ? yellowInk(data, pixel)
                : data[pixel] >= 125 && data[pixel + 1] >= 120 && data[pixel + 2] < 110 && data[pixel] - data[pixel + 2] > 70;
            if (!ink) continue;
            mask[row * normal + col] = 1;
            firstColumn = Math.min(firstColumn, col);
            lastColumn = Math.max(lastColumn, col);
            firstRow = Math.min(firstRow, row);
            lastRow = row;
        }
    }
    const inkHeight = lastRow - firstRow + 1;
    if (inkHeight < 8 || inkHeight > 10 || Math.abs((firstColumn + lastColumn) / 2 - 15.5) > 3 ||
        Math.abs((firstRow + lastRow) / 2 - 16) > 3) return null;
    return yellowSeconds(readDigits((col, row) => Boolean(mask[(firstRow + Math.floor((row + .5) * inkHeight / 9)) * normal + col]),
        normal, yellowDigits));
}

export function readBuffCountdown({ data, width }, { x, y, size }) {
    if (size < 24) return null;
    const pixel = (col, row) => ((y + Math.floor((row + .5) * size / 30)) * width +
        x + Math.floor((col + .5) * size / 30)) * 4;
    const yellow = readDigits((col, row) => yellowInk(data, pixel(col, row + 11)), 30, yellowDigits);
    const match = yellow?.match(/^(\d):([0-5]\d)$/);
    if (match) return { seconds: Number(match[1]) * 60 + Number(match[2]) };

    const blue = readDigits((col, row) => {
        const i = pixel(col, row + 20);
        return blueRows[row].every((value, channel) => Math.abs(data[i + channel] - value) <= 24);
    }, 17, blueDigits);
    if (/^\d{1,2}$/.test(blue ?? "")) return { minutes: Number(blue) };
    if (/^\d{1,3}$/.test(yellow ?? "")) return { seconds: Number(yellow) };
    return null;
}

function blueUnit(state, value, now) {
    const previous = state.blue;
    if (previous?.value !== value) {
        const step = previous && previous.value === value + 1 && now - previous.firstAt <= 1700;
        state.blue = { value, firstAt: now, steps: step ? previous.steps + 1 : 0, unit: previous?.unit };
    }
    const reading = state.blue;
    // An unmarked number that changes every second must not restore a multi-minute timer.
    if (reading.steps >= 2) reading.unit = "seconds";
    else if (now - reading.firstAt >= 1500) reading.unit = "minutes";
    return reading.unit;
}

export function observeBuffCountdown(state, text, now, durationMs) {
    const unit = text.seconds !== undefined ? "seconds" : blueUnit(state, text.minutes, now);
    if (!unit) return null;
    const coarse = unit === "minutes";
    const remaining = (text.seconds ?? text.minutes) * (coarse ? minute : 1000);
    if (remaining > durationMs || (coarse && remaining === 0) || (!coarse && remaining >= 10 * minute)) return null;
    const candidate = {
        earliest: now + remaining,
        latest: now + Math.min(durationMs, remaining + (coarse ? minute : 1000)),
    };
    const previous = state.candidate;
    state.candidate = candidate;
    if (!previous || candidate.earliest > previous.latest || candidate.latest < previous.earliest) return null;
    const latest = Math.min(previous.latest, candidate.latest, state.confirmed?.latest ?? Infinity);
    const earliest = Math.max(previous.earliest, candidate.earliest, state.confirmed?.earliest ?? 0);
    if (earliest > latest) {
        // A renewed buff or a corrected reading can start a fresh pair.
        state.confirmed = null;
        return null;
    }
    state.confirmed = { earliest, latest };
    return state.confirmed;
}

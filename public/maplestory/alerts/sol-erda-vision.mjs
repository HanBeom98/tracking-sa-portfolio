// Small HUD numerals are matched at their original aspect ratio.
const glyphs = Object.entries({
    0: [".###.", "#...#", "#...#", "#...#", ".###."],
    1: ["##", ".#", ".#", ".#", ".#"],
    2: [".###.", "#...#", "...#.", "..#..", "#####"],
    3: ["####.", "....#", ".###.", "....#", "####."],
    4: ["#..#.", "#..#.", "#####", "...#.", "...#."],
    5: ["#####", "#....", "####.", "....#", "####."],
    6: [".###.", "#....", "####.", "#...#", ".###."],
    7: ["#####", "....#", "...#.", "..#..", "..#.."],
    8: [".###.", "#...#", ".###.", "#...#", ".###."],
    9: [".###.", "#...#", ".####", "....#", ".###."],
    "/": ["....#", "...#.", "..#..", ".#...", "#...."],
}).concat([
    ["3", ["####.", "....#", ".####", "....#", "####."]],
    ["5", ["#####", "#....", "####.", "....#", "####."]],
    ["7", ["####", "...#", "...#", "..#.", "..#."]],
]);

function readGlyph(ink, left, right, top, bottom) {
    const width = right - left;
    const height = bottom - top;
    if (!width || height < 3 || width > height * 1.65) return null;
    const errors = new Map();
    for (const [char, rows] of glyphs) {
        const columns = rows[0].length;
        let mismatch = 0;
        for (let y = 0; y < rows.length; y++) {
            for (let x = 0; x < columns; x++) {
                const actual = ink(left + Math.floor((x + .5) * width / columns),
                    top + Math.floor((y + .5) * height / rows.length));
                if (actual !== (rows[y][x] === "#")) mismatch++;
            }
        }
        const aspectError = Math.abs(width / height - columns / rows.length);
        const error = mismatch / (columns * rows.length) + aspectError * .22;
        errors.set(char, Math.min(error, errors.get(char) ?? Infinity));
    }
    const [[char, error], [, runnerUp]] = [...errors].sort((a, b) => a[1] - b[1]);
    return error <= .17 && runnerUp - error >= .025 ? char : null;
}

function readLine(ink, left, right, top, bottom) {
    let start = null;
    let text = "";
    for (let x = left; x <= right; x++) {
        let occupied = false;
        if (x < right) {
            for (let y = top; y < bottom; y++) occupied ||= ink(x, y);
        }
        if (occupied) {
            start ??= x;
        } else if (start !== null) {
            let first = bottom;
            let last = top;
            for (let y = top; y < bottom; y++) {
                for (let col = start; col < x; col++) {
                    if (!ink(col, y)) continue;
                    first = Math.min(first, y);
                    last = Math.max(last, y);
                }
            }
            text += readGlyph(ink, start, x, first, last + 1) ?? "?";
            start = null;
        }
    }
    return text;
}

export function readSolErdaPanel({ data, width, height }) {
    if (width < 70 || height < 25) return null;
    const ink = (x, y) => {
        const index = (y * width + x) * 4;
        return data[index] >= 182 && data[index + 1] >= 162 && data[index + 2] >= 202;
    };
    const leftStart = Math.floor(width * .08);
    const middle = Math.round(width * .53);
    const rightEnd = Math.ceil(width * .95);
    const scanStart = Math.floor(height * .59);
    const scanEnd = Math.min(height, Math.ceil(height * .94));
    let top = null;

    for (let y = scanStart; y <= scanEnd; y++) {
        let hits = 0;
        if (y < scanEnd) {
            for (let x = leftStart; x < middle; x++) hits += Number(ink(x, y));
        }
        if (hits >= 2) {
            top ??= y;
        } else if (top !== null) {
            const height = y - top;
            if (height >= 3 && height <= 18) {
                // The gauge highlight can touch the numeral row just above the stable digits.
                for (const textTop of [top, top + Math.max(1, Math.round(height / 6))]) {
                    if (!readLine(ink, leftStart, middle, textTop, y).endsWith("/1000")) continue;
                    const fragments = readLine(ink, middle, rightEnd, textTop, y);
                    return { fragments: /^\d{1,7}$/.test(fragments) ? Number(fragments) : null };
                }
            }
            top = null;
        }
    }
    return null;
}

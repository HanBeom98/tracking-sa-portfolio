// The bottom HUD uses a six-row bitmap font. Some punctuation is clipped by its border.
const glyphs = [
    ["0", [".###.", "#...#", "#...#", "#...#", "#...#", "#...#"]],
    ["1", [".#", "##", ".#", ".#", ".#", ".#"]],
    ["1", ["..#", ".##", "#.#", "..#", "..#", "..#"]],
    ["2", [".###.", "#...#", "....#", "...#.", "..#..", ".#..."]],
    ["3", [".###.", "#...#", "....#", "..##.", "....#", "#...#"]],
    ["4", ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#."]],
    ["5", ["#####", "#....", "#....", ".###.", "....#", "#...#"]],
    ["6", [".###.", "#...#", "#....", "####.", "#...#", "#...#"]],
    ["7", ["#####", "....#", "....#", "...#.", "...#.", "..#.."]],
    ["8", [".###.", "#...#", "#...#", ".###.", "#...#", "#...#"]],
    ["9", [".###.", "#...#", "#...#", ".####", "....#", "#...#"]],
    ["9", [".###.", "#...#", "#...#", ".####", "....#", "....#"]],
    ["[", ["##", "#.", "#.", "#.", "#.", "#."]],
    ["]", ["##", ".#", ".#", ".#", ".#", ".#"]],
    ["%", [".#....#", "#.#..#.", ".#..#..", "...#...", "..#..#.", ".#..#.#"]],
    // Larger in-game UI scales use a separate nine-row bitmap font.
    ...[
        ["0", ".####. #....# #....# #....# #....# #....# #....# #....# .####."],
        ["0", ".####.. #.....# #.....# #.....# #.....# #.....# #.....# #.....# .#####."],
        ["1", "..# ### ..# ..# ..# ..# ..# ..# ..#"],
        ["2", "..####. ##....# ......# ......# .....#. ...##.. ..#.... .##.... #######"],
        ["3", ".####.. #....## .....## .....#. ...##.. .....## #....## #....#. .####.."],
        ["3", ".####.. #.....# ......# ......# ...###. ......# #.....# #.....# .#####."],
        ["4", "....#. ..###. .#..#. .#..#. #...#. ###### ...##. ....#. ....#."],
        ["4", "....#.. ...##.. .#..#.. ....#.. #...#.. ####### ....#.. ....#.. ....#.."],
        ["5", "####### #...... #...... #...... .####.. .....## #....## #.....# .####.."],
        ["6", ".####. #....# #..... #..... #####. #....# #....# #....# .####."],
        ["6", ".####.. #....## #...... ##..... #####.. #....## #....## #.....# .####.."],
        ["7", "###### .....# .....# .....# ....#. ....#. ...#.. ..#... ..#..."],
        ["8", ".####.. #....## #....## #...... .####.. #....## #....## #....#. .####.."],
        ["8", "..####. #.....# #.....# ......# ..####. #.....# #.....# #.....# ..####."],
        ["9", "..####. ##....# ##....# ......# ..##### ......# ......# .#....# ..####."],
        ["9", ".####.. #....## #....## .....## .###### .....## #....## #....#. .####.."],
        ["[", "### #.. #.. #.. #.. #.. #.. ##. ###"],
        ["]", "## .# .# .# .# .# .# .# ##"],
        ["%", ".##.....# #..#...#. .##...#.. ......... ....#.... ...#...#. ......#.. .#....#.# #......#."],
    ].map(([char, rows]) => [char, rows.split(" ")]),
];

function classify(ink, start, end, top, height) {
    const width = end - start;
    const scores = new Map();
    for (const [symbol, rows] of glyphs) {
        const columns = rows[0].length;
        const shapeError = Math.abs(width / height - columns / rows.length);
        if (shapeError > .23) continue;
        let mismatches = 0;
        for (let y = 0; y < rows.length; y++) {
            for (let x = 0; x < columns; x++) {
                const pixel = ink(start + Math.floor((x + .5) * width / columns),
                    top + Math.floor((y + .5) * height / rows.length));
                if (pixel !== (rows[y][x] === "#")) mismatches++;
            }
        }
        const score = mismatches / (columns * rows.length) + shapeError * .25;
        scores.set(symbol, Math.min(score, scores.get(symbol) ?? Infinity));
    }
    const [best, second] = [...scores].sort((a, b) => a[1] - b[1]);
    return best?.[1] <= .15 && (second?.[1] ?? Infinity) - best[1] >= .028 ? best[0] : null;
}

function amountBeforeBracket(ink, runs, top, bottom) {
    const amount = runs.map(({ char, start, end }) => {
        if (char !== null) return char;
        const height = bottom - top;
        if (end - start > Math.max(1, Math.floor(height * .36))) return "?";
        // The visible part of each thousands separator is at the bottom of the band.
        for (let y = top; y < bottom - Math.max(1, Math.round(height / 3)); y++) {
            for (let x = start; x < end; x++) if (ink(x, y)) return "?";
        }
        return ",";
    }).join("");
    return /^(?:0|[1-9]\d{0,2}(?:,\d{3}){0,6})$/.test(amount) ? amount.replaceAll(",", "") : null;
}

function experienceInBand(ink, left, right, top, bottom) {
    const height = bottom - top;
    const runs = [];
    let start = null;
    for (let x = left; x <= right; x++) {
        let hits = 0;
        if (x < right) for (let y = top; y < bottom; y++) hits += Number(ink(x, y));
        if (hits) start ??= x;
        else if (start !== null) {
            // Commas and a visible decimal dot can occupy only a single scanline.
            const char = classify(ink, start, x, top, height);
            const last = runs.at(-1);
            const combined = height >= 8 && char === null && last?.char === null && start - last.end <= 1
                ? classify(ink, last.start, x, top, height) : null;
            if (combined === "%" || combined === "6" || combined === "8") {
                last.char = combined;
                last.end = x;
            } else {
                runs.push({ char, start, end: x });
            }
            start = null;
        }
    }

    for (let i = 4; i + 1 < runs.length; i++) {
        if (runs[i].char !== "%" || runs[i + 1].char !== "]") continue;
        for (const length of [3, 2]) {
            // The game's decimal point can sit on a dark border below the white digits.
            const boundary = i - length;
            const after = runs[boundary];
            let before = boundary - 1;
            if (runs[before]?.char === null) before--;
            const decimalGap = after.start - (runs[before]?.end ?? after.start);
            if (decimalGap < height * .62 || decimalGap > height * 1.46) continue;
            const fractional = runs.slice(boundary, i).map(({ char }) => char ?? "?").join("");
            let first = before;
            while (first >= 0 && /^[0-9]$/.test(runs[first].char ?? "")) first--;
            if (runs[first]?.char !== "[" || before - first < 1 || before - first > 3) continue;
            const whole = runs.slice(first + 1, before + 1).map(({ char }) => char).join("");
            if (!/^\d{2,3}$/.test(fractional)) continue;
            const value = Number(whole) * 1000 + Number(fractional.padEnd(3, "0"));
            if (value <= 100000) return { percentage: value, amount: amountBeforeBracket(ink, runs.slice(0, first), top, bottom) };
        }
    }
    return null;
}

function scanBands(ink, left, right, height) {
    let bottom = null;
    for (let y = height - 1; y >= -1; y--) {
        let hits = 0;
        if (y >= 0) for (let x = left; x < right; x++) hits += Number(ink(x, y));
        if (hits >= 7) bottom ??= y + 1;
        else if (bottom !== null) {
            const top = y + 1;
            if (bottom - top >= 5 && bottom - top <= 18) {
                const reading = experienceInBand(ink, left, right, top, bottom);
                if (reading) return reading;
            }
            bottom = null;
        }
    }
    return null;
}

export function readExperienceHud({ data, width, height }) {
    if (width < 160 || height < 5) return null;
    const left = Math.floor(width * .24);
    const right = Math.ceil(width * .76);
    const tones = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
        for (let x = left; x < right; x++) {
            const offset = (y * width + x) * 4;
            const red = data[offset];
            const green = data[offset + 1];
            const blue = data[offset + 2];
            // Keep blended white text without picking up the yellow-green bar.
            if (Math.max(red, green, blue) - Math.min(red, green, blue) <= 50) {
                tones[y * width + x] = Math.min(red, green, blue);
            }
        }
    }
    const readAt = (threshold) => scanBands((x, y) => tones[y * width + x] >= threshold, left, right, height);
    const bright = readAt(145);
    if (bright) return bright;
    const alternatives = [125, 105, 90].map(readAt).filter(Boolean);
    return alternatives.find((reading, index) => alternatives.findIndex(({ percentage }) => percentage === reading.percentage) !== index)
        ?? null;
}

export function confirmExperienceHud(samples) {
    const [older, previous, current] = [samples.at(-3), samples.at(-2), samples.at(-1)];
    if (!previous || !current) return null;
    if (current.percentage === previous.percentage) return current;
    if (!older) return null;
    // Use the middle reading so an isolated digit error cannot become a gain.
    return [older, previous, current].sort((a, b) => a.percentage - b.percentage)[1];
}

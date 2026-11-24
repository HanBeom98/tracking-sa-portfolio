import assert from "node:assert/strict";
import test from "node:test";
import { observeBuffCountdown, readBuffCountdown, readQuickslotCountdown } from "../../src/static/maplestory/alerts/buff-countdown.mjs";

const minute = 60_000;

test("two minute readings restore a running buff, then the next minute change pins down expiry", () => {
    const clock = {};
    assert.equal(observeBuffCountdown(clock, { minutes: 27 }, 0, 30 * minute), null);
    assert.equal(observeBuffCountdown(clock, { minutes: 27 }, 1500, 30 * minute), null);
    assert.deepEqual(observeBuffCountdown(clock, { minutes: 27 }, 1800, 30 * minute),
        { earliest: 27 * minute + 1800, latest: 28 * minute + 1500 });
    assert.deepEqual(observeBuffCountdown(clock, { minutes: 26 }, 2100, 30 * minute),
        { earliest: 27 * minute + 1800, latest: 27 * minute + 2100 });
});

test("seconds and the transition from one minute to 59 seconds preserve the observed expiry", () => {
    const clock = {};
    observeBuffCountdown(clock, { minutes: 1 }, 0, 30 * minute);
    observeBuffCountdown(clock, { minutes: 1 }, 1500, 30 * minute);
    observeBuffCountdown(clock, { minutes: 1 }, 1800, 30 * minute);
    assert.deepEqual(observeBuffCountdown(clock, { seconds: 59 }, 2100, 30 * minute),
        { earliest: minute + 1800, latest: minute + 2100 });
    assert.equal(observeBuffCountdown(clock, { minutes: 37 }, 2500, 30 * minute), null);
});

test("an unmarked 27 that ticks every second cannot be mistaken for 27 minutes", () => {
    const clock = {};
    const read = (value, now) => observeBuffCountdown(clock, { minutes: value }, now, 30 * minute);
    assert.equal(read(27, 0), null);
    assert.equal(read(26, 1000), null);
    assert.equal(read(25, 2000), null);
    assert.deepEqual(read(24, 3000), { earliest: 27000, latest: 28000 });
});

test("reads the yellow 9:29 printed over the buff, including its colon", () => {
    const width = 30;
    const data = new Uint8Array(width * width * 4);
    const rows = [
        "....####.......#####...####...", "...#....#..........#..#....#..", "...#....#...#......#..#....#..",
        "...#....#...#......#..#....#..", "....#####.........#....#####..", "........#........##........#..",
        "........#...#...##.........#..", ".......##...#...#.........##..", "...####........#####..####....",
    ];
    for (const [y, row] of rows.entries()) {
        for (let x = 0; x < width; x++) {
            if (row[x] === "#") data.set([244, 229, 10, 255], ((11 + y) * width + x) * 4);
        }
    }
    assert.deepEqual(readBuffCountdown({ data, width }, { x: 0, y: 0, size: 30 }), { seconds: 569 });
    assert.equal(readBuffCountdown({ data: new Uint8Array(data.length), width }, { x: 0, y: 0, size: 30 }), null);
});

test("reads only the centered skill cooldown and ignores the lower corner charge label", () => {
    const width = 32;
    const data = new Uint8Array(width * width * 4);
    const rows = [".##...#####", "###...#....", "..#...#....", "..#...#....", "..#...####.",
        "..#.......#", "..#.......#", "..#......##", "..#...####."];
    rows.forEach((row, y) => [...row].forEach((pixel, x) => {
        if (pixel === "#") data.set([244, 229, 10, 255], ((12 + y) * width + 10 + x) * 4);
        if (pixel === "#" && y < 6 && x > 5) data.set([244, 229, 10, 255], ((25 + y) * width + 20 + x) * 4);
    }));
    assert.equal(readQuickslotCountdown({ data, width }, { x: 0, y: 0, size: width }), 15);
    data.fill(0, 0, width * 24 * 4);
    assert.equal(readQuickslotCountdown({ data, width }, { x: 0, y: 0, size: width }), null);
});

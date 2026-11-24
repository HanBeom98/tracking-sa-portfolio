import assert from "node:assert/strict";
import test from "node:test";
import { inflateSync } from "node:zlib";
import { advanceBuffReminder, advanceReminder, pauseReminder, reminderState, shiftReminder, startReminder } from "../../src/static/maplestory/alerts/hunt-timing.mjs";
import { nextRuneAlert, runeAlertState } from "../../src/static/maplestory/alerts/rune-alert.mjs";
import { classifySkillIcon, observeQuickslotClock, observeSkillIcon, quickslotClockStatus, skillVisionState } from "../../src/static/maplestory/alerts/skill-vision.mjs";
import { observeHuntIcon, huntIconState } from "../../src/static/maplestory/alerts/hunt-icon-vision.mjs";

test("a repeating timer preserves its cadence without replaying missed alerts", () => {
    const config = { durationMs: 10000, repeat: true, leadMs: 0 };
    const state = reminderState(config.durationMs);
    startReminder(state, 1000);
    assert.equal(advanceReminder(config, state, 36500), true);
    assert.equal(state.endsAt, 41000);
    assert.equal(advanceReminder(config, state, 36500), false);
    assert.equal(advanceReminder(config, state, 41000), true);
});

test("a paused skill timer resumes with the same time left and fires a lead alert once", () => {
    const config = { durationMs: 15000, repeat: false, leadMs: 3000 };
    const state = reminderState(config.durationMs);
    startReminder(state, 1000);
    pauseReminder(state, 5000);
    assert.equal(state.remainingMs, 11000);
    assert.equal(advanceReminder(config, state, 50000), false);
    startReminder(state, 50000);
    assert.equal(advanceReminder(config, state, 57999), false);
    assert.equal(advanceReminder(config, state, 58000), true);
    assert.equal(advanceReminder(config, state, 61000), false);
    assert.equal(state.endsAt, null);
});

test("a buff warns once, expires once, and stays idle during a late reapplication", () => {
    const minute = 60_000;
    const config = { durationMs: 30 * minute, repeat: false, leadMs: minute };
    const firstUse = reminderState(config.durationMs);
    startReminder(firstUse, 0);
    assert.equal(advanceBuffReminder(config, firstUse, 29 * minute), "lead");
    assert.equal(advanceBuffReminder(config, firstUse, 30 * minute - 1), null);
    assert.equal(advanceBuffReminder(config, firstUse, 30 * minute), "ended");
    assert.equal(advanceBuffReminder(config, firstUse, 31 * minute), null);
    assert.equal(firstUse.remainingMs, 0);

    const secondUse = reminderState(config.durationMs);
    startReminder(secondUse, 31 * minute);
    assert.equal(secondUse.endsAt, 61 * minute);
    assert.equal(advanceBuffReminder(config, secondUse, 61 * minute + 1000), "ended");
    assert.equal(advanceBuffReminder(config, secondUse, 62 * minute), null);
});

test("a quickslot starts only when its registered icon goes from visible to dimmed", () => {
    const ready = [240, 60, 180, 62, 20, 220, 70, 110];
    const dimmed = ready.map((value) => Math.round(value * 0.5));
    assert.equal(classifySkillIcon(ready, ready), "visible");
    assert.equal(classifySkillIcon(ready, dimmed), "dimmed");
    assert.equal(classifySkillIcon(ready, dimmed.toReversed()), "unknown");
    const state = skillVisionState();
    const samples = ["dimmed", "dimmed", "dimmed", "visible", "visible", "visible",
        "dimmed", "visible", "dimmed", "dimmed", "dimmed", "dimmed"];
    assert.deepEqual(samples.map((value) => observeSkillIcon(state, value, "reuse")),
        samples.map((_, index) => index === 10));
});

test("finds a real Janus icon without a selected region and triggers once on use", () => {
    const width = 87;
    const height = 57;
    const colors = Buffer.from("ZmZm3d3d3d3d////MzNVZmZm3czubWaBd2aq////d2aqd2aqd2a7d2aqd2aqd2aqVUSIRDN3d2aqd2aqVVVmd2aqVUSIu6rdVVVm", "base64");
    function image(x, brightness) {
        const data = new Uint8Array(width * height * 4);
        let byte = 0;
        for (const dy of [5, 9, 13, 17, 21]) {
            for (const dx of [5, 10, 16, 22, 26]) {
                const offset = ((11 + dy) * width + x + dx) * 4;
                data.set(colors.subarray(byte, byte + 3).map((value) => value * brightness), offset);
                byte += 3;
            }
        }
        return { width, height, data };
    }
    const state = huntIconState();
    const read = (frame) => observeHuntIcon(frame, state, "preset-janus", "quickslot");
    const ready = image(19, 1);
    const dimmed = image(19, .5);
    assert.equal(read(dimmed).found, false);
    assert.deepEqual([ready, ready, ready, dimmed, dimmed, dimmed, dimmed].map((frame) => read(frame).activated),
        [false, false, false, false, false, true, false]);

    const relocated = image(49, 1);
    for (let i = 0; i < 5; i++) assert.equal(read(relocated).activated, false);
    assert.deepEqual(read(relocated), { found: true, activated: false });
});

test("recovers an already cooling Janus by its artwork and centered digits without triggering a cast", () => {
    const width = 64;
    const height = 52;
    const data = new Uint8Array(width * height * 4);
    const x = 12, y = 9;
    const points = [[17, 5], [21, 5], [25, 5], [5, 22], [9, 22], [25, 22], [5, 25],
        [9, 25], [13, 25], [17, 25], [5, 27], [9, 27], [13, 27], [17, 27]];
    const colors = [221,221,221,85,85,119,85,85,85,58,67,85,81,83,124,74,75,124,42,51,85,
        105,114,148,74,75,124,81,83,124,26,35,61,42,51,85,89,90,132,58,67,101];
    points.forEach(([dx, dy], i) => data.set(colors.slice(i * 3, i * 3 + 3), ((y + dy) * width + x + dx) * 4));
    const rows = [".##...#####", "###...#....", "..#...#....", "..#...#....", "..#...####.",
        "..#.......#", "..#.......#", "..#......##", "..#...####."];
    rows.forEach((row, j) => [...row].forEach((pixel, i) => {
        if (pixel === "#") data.set([244, 229, 10, 255], ((y + 12 + j) * width + x + 10 + i) * 4);
    }));
    const full = { width, height, data };
    const state = huntIconState();
    const clocks = [1000, 1300, 1600].map(now => observeHuntIcon(full, state, "preset-janus", "quickslot", now));
    assert.deepEqual(clocks.map(({ seconds, activated }) => [seconds, activated]), [[15, false], [15, false], [15, false]]);
    assert.equal(observeHuntIcon(full, huntIconState(), "preset-fountain", "quickslot", 1600).found, false);
});

test("the quickslot clock requires compatible readings and expires unless the game confirms readiness", () => {
    const state = {};
    observeQuickslotClock(state, { seconds: 15, sampledAt: 1000 });
    assert.equal(quickslotClockStatus(state, 1000), null);
    observeQuickslotClock(state, { seconds: 15, sampledAt: 1300 });
    assert.deepEqual(quickslotClockStatus(state, 1300), { remainingMs: 14700 });
    observeQuickslotClock(state, { seconds: 114, sampledAt: 1600 });
    assert.deepEqual(quickslotClockStatus(state, 1600), { remainingMs: 14400 });
    assert.equal(quickslotClockStatus(state, 4301), null);
    observeQuickslotClock(state, { ready: true, sampledAt: 4400 });
    assert.deepEqual(quickslotClockStatus(state, 4400), { ready: true });
    assert.equal(quickslotClockStatus(state, 7401), null);
});

test("recognizes small wealth potion after it appears and ignores the similar EXP potion", () => {
    const coordinates = [
        [4, 4], [8, 5], [12, 6], [18, 8], [23, 8], [26, 10], [8, 9], [11, 12], [15, 13], [18, 13],
        [22, 13], [25, 14], [12, 16], [15, 16], [18, 16], [21, 17], [24, 17], [26, 18], [19, 20],
        [22, 20], [25, 21], [18, 23], [21, 24], [24, 25], [25, 26],
    ];
    const wealth = "ZsbTBGVy1tXTSrm3BAIBBAMBLp23rNXUWLmpIGVWSnNjPEkekMe4kMepdKucdI9VyLmbg2UrkIFHyKtxglcsg2Ur19V/BQMB1tXT";
    const experience = "ZMXTAmNx09PTR7e3AgEBAgEBLJu3uNPTSLe3EFVVR3FxOUc5ccXTgMXFVrepVY1/uMXFZGNjVY1/uLe3ZHFjVXFjxcXFAQEB1NPT";
    function frame(colors, x) {
        const width = 80;
        const height = 40;
        const data = new Uint8Array(width * height * 4);
        const bytes = Buffer.from(colors, "base64");
        for (const [i, [dx, dy]] of coordinates.entries()) {
            data.set(bytes.subarray(i * 3, i * 3 + 3), ((dy + 1) * width + x + dx) * 4);
        }
        return { width, height, data };
    }
    const state = huntIconState();
    const read = (capture, now) => observeHuntIcon(capture, state, "preset-wealth", "buff", now);
    const active = frame(wealth, 8);
    for (let i = 0; i < 3; i++) assert.deepEqual(read(active), { found: true, activated: false });
    for (let i = 0; i < 3; i++) assert.deepEqual(read(frame(experience, 8)), { found: false, activated: false });
    assert.equal(read(active, 1000).activated, false);
    assert.equal(read(active, 1300).activated, false);
    assert.deepEqual(read(active, 1600), { found: true, activated: true, activatedAt: 1000 });
    assert.deepEqual(read(frame(wealth, 42)), { found: true, activated: false });
    assert.deepEqual(read(frame(experience, 8), 3000), { found: false, activated: false });
    assert.deepEqual(read(active, 3300), { found: true, activated: false });
    assert.deepEqual(read(active, 3600), { found: true, activated: false });
    assert.deepEqual(read(active, 3900),
        { found: true, activated: true, activatedAt: 3300, briefGap: true });
    assert.deepEqual(read(active, 4200), { found: true, activated: false });
});

test("distinguishes coupon artwork and its own clock when a new multiplier takes over the same slot", () => {
    // The original standard 3x and MVP 4x sprites rendered in a 30px buff box
    // with the game's two countdown styles. The RGB fixtures are deflated.
    const sprites = [
        "eNqtlsFxgzAQRakgFaSCVJAOqIAKqIAKVIEKyFABaYBD7px81NUtuAWy+OPv9a5AjIedN5pljZ4WIXtcVUv0w3gi1SMkT6dGvMup" +
            "bboSMYVhRedC9dFpxNbFAeaytnsx+JwNHzF3MWPGXPZmVjloNvTjaoj3JD4uWX/bLI/AhqnlPksF7JjNJnhtHRJHsxsoZs0wGDmK" +
            "MFPIXO/GnjmsEkkEU6TB7604gTW3K5TQ74sSy/b2yzs1K2bOc7sn92ZflFVkLWDMaC/b4ZHgdGGrZ+GzrbYoaovmKfXA5Hlzu21u" +
            "Jg07pFmPHj23K5lNz2bUGLPwYq4nDWeFFI6MZro3xzYB3A987sfQJJAxf49SZ+ycjaz5+Q1qFhXNswr6ZxfFIw0tzZiCigC57p8L" +
            "7Tup1T0bMxJunaCfhR4Np3tz/TWEepJRJDIaUAz3V4Pb9jFm4ZbTsvie+XqbhextrMPs5X4tmv+u89bq+qMt81bPv5f1pWfvkU9N" +
            "e0e0MP9cZoM+Tuby6G91HPjXTvITgfQfWU7oCQ==",
        "eNq1lkGRhjAMhTnvAQUoqII6qIIqQEEVoKAKUFAFOEBBLayDFbApD0Ka8rMc2M4bJn0k34QSZui6sua0vKjuWBTnV1fc4IwdzF+y" +
            "1+r6oES0EBPIVGii1rhUWy5s47juDgJNniqFlFMuV3YkgWPlX5LtqBXmM3ZTVcsoukVXn/YtAk32uwjCsTSnupyETDgsTbYHIdCb" +
            "LdcKu5kSy3CQWWO8JoOwjU2JwWezFIaTgxhpcT4SbsjzMZNzkSrkoSJnP/b5LCnk8eqcXfaCzPzWhO8a/+M8Tzv85/uLxc3LpRJa" +
            "k8RkE7JZCpxMyZG1lw5vKfBj6c0OWfZsjp6RwHBZeEOetictWFdQigwf5Cm8Rx5Wa3epE/vzNAjrvT78SzLJuxVtPyW7s5ZQ1Rsc" +
            "kjWLJ+amSBO16clpUBoXEoRQFblPXecwjcFUgwRTkqXJMUtNndvIn2YVX8Hzea7OuZ9Bbjnsw+Rb0udPj/2T3BVyirkV+0xufYh9" +
            "SbaCjEBuJaQ1VRtNz1GhnpM5HyJUS44+kyjAI1xu4bh+UQmsd8njsNyTIc6RDlBQdFlu73sG/F5UFc1KQvkngUbk//j7AhaL4hcF" +
            "6C8ILZ3X",
    ].map(sprite => inflateSync(Buffer.from(sprite, "base64")));
    function frame(sprite, size) {
        const width = 63;
        const height = 55;
        const data = new Uint8Array(width * height * 4);
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const source = (Math.floor((y + .5) * 30 / size) * 30 + Math.floor((x + .5) * 30 / size)) * 3;
                data.set(sprite.subarray(source, source + 3), ((y + 3) * width + x + 5) * 4);
            }
        }
        return { width, height, data };
    }
    for (const size of [30, 45]) {
        const state = huntIconState();
        const read = (image, now) => observeHuntIcon(image, state, "preset-exp-coupon", "buff", now);
        const [standard, mvp] = sprites.map(sprite => frame(sprite, size));
        const initial = [0, 300, 600].map(now => read(standard, now));
        assert.deepEqual(initial[2], {
            found: true, variant: "exp-3x", clock: { minutes: 27 }, sampledAt: 600, settled: true, activated: false,
        });
        const replacement = [900, 1200, 1500].map(now => read(mvp, now));
        assert.equal(replacement[0].settled, false);
        assert.deepEqual(replacement[2], {
            found: true, variant: "exp-4x", clock: { seconds: 545 }, sampledAt: 1500,
            settled: true, activated: true, activatedAt: 900,
        });
        const clockOnly = Buffer.from(sprites[1]);
        clockOnly.fill(0, 0, 30 * 11 * 3);
        assert.equal(read(frame(clockOnly, size), 1800).found, false);
    }
});

test("shifting a running timer keeps its alert state and never moves its deadline into the past", () => {
    const state = reminderState(12000);
    const config = { durationMs: 12000, repeat: false, leadMs: 3000 };
    startReminder(state, 1000);
    shiftReminder(state, -1000, 8000);
    assert.equal(state.endsAt, 12000);
    assert.equal(advanceReminder(config, state, 9000), true);
    shiftReminder(state, 1000, 9000);
    assert.equal(state.endsAt, 13000);
    assert.equal(advanceReminder(config, state, 10000), false);
    shiftReminder(state, -1000, 12500);
    assert.equal(state.endsAt, 12500);
    advanceReminder(config, state, 12500);
    shiftReminder(state, 1000, 12500);
    assert.equal(state.endsAt, null);
});

test("a buff starts when its registered icon appears after being absent", () => {
    const state = skillVisionState();
    const samples = ["visible", "visible", "visible", "unknown", "unknown", "unknown",
        "visible", "visible", "visible", "visible"];
    assert.deepEqual(samples.map((value) => observeSkillIcon(state, value, "buff")),
        samples.map((_, index) => index === 8));
});

test("the rune repeat preference supports one alert and a timed repeat", () => {
    const state = runeAlertState();
    for (const now of [0, 350, 700]) nextRuneAlert(state, true, now, "once");
    assert.equal(nextRuneAlert(state, true, 41000, "once"), null);
    assert.equal(nextRuneAlert(state, true, 41000, "30"), null);
    assert.equal(nextRuneAlert(state, true, 70999, "30"), null);
    assert.equal(nextRuneAlert(state, true, 71000, "30"), "repeat");
    assert.equal(nextRuneAlert(state, false, 101000, "30"), null);
});

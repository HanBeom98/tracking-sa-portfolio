import assert from "node:assert/strict";
import test from "node:test";
import { confirmExperienceHud, readExperienceHud } from "../../src/static/maplestory/alerts/exp-text.mjs";
import { emptyExperience, experiencePace, measureExperience } from "../../src/static/maplestory/alerts/exp-tracking.mjs";

function hudWithText(text, scale = 1, brightness = 253) {
    const width = 800 * scale;
    const height = 30 * scale;
    const data = new Uint8Array(width * height * 4);
    // Row masks for the small HUD font. The dot is clipped beneath the main text.
    const masks = {
        "[": [2, 3, 2, 2, 2, 2, 2], "]": [2, 3, 1, 1, 1, 1, 1],
        0: [5, 14, 17, 17, 17, 17, 17], 1: [2, 1, 3, 1, 1, 1, 1],
        2: [5, 14, 17, 1, 2, 4, 8], 3: [5, 14, 17, 1, 6, 1, 17], 4: [5, 2, 6, 10, 18, 31, 2],
        5: [5, 31, 16, 16, 14, 1, 17], 6: [5, 14, 17, 16, 30, 17, 17],
        7: [5, 31, 1, 1, 2, 2, 4], 8: [5, 14, 17, 17, 14, 17, 17], 9: [5, 14, 17, 17, 15, 1, 17],
        "%": [7, 33, 82, 36, 8, 18, 37], ",": [1, 0, 0, 0, 0, 0, 1],
    };
    let left = 370;
    for (const char of text) {
        if (char === ".") {
            left += 3;
            continue;
        }
        const [columns, ...rows] = masks[char];
        for (const [y, row] of rows.entries()) {
            for (let x = 0; x < columns; x++) {
                if (!(row & (1 << (columns - 1 - x)))) continue;
                for (let dy = 0; dy < scale; dy++) {
                    for (let dx = 0; dx < scale; dx++) {
                        const pixel = (((20 + y) * scale + dy) * width + (left + x) * scale + dx) * 4;
                        data.set([brightness, brightness, brightness - 2, 255], pixel);
                    }
                }
            }
        }
        left += columns + 2;
    }
    return { data, width, height };
}

test("reads the bracketed experience percentage at native and scaled sizes", () => {
    assert.equal(readExperienceHud(hudWithText("[86.560%]")).percentage, 86560);
    assert.equal(readExperienceHud(hudWithText("[0.019%]", 2)).percentage, 19);
    assert.equal(readExperienceHud(hudWithText("[86.56%]")).percentage, 86560);
    assert.equal(readExperienceHud(hudWithText("[86.560]")), null);
    assert.equal(readExperienceHud(hudWithText("86560%")), null);
});

test("keeps all three decimals when the captured HUD text is dimmer than the default threshold", () => {
    const image = hudWithText("[86.775%]", 1, 128);
    assert.equal(readExperienceHud(image).percentage, 86775);
    assert.equal(readExperienceHud(hudWithText("86.775%", 1, 128)), null);
});

test("reads the exact formatted amount next to the percent and rejects malformed groups", () => {
    for (const scale of [1, 2]) {
        assert.deepEqual(readExperienceHud(hudWithText("309,372,710,477,273[86.876%]", scale)), {
            percentage: 86876, amount: "309372710477273",
        });
    }
    assert.deepEqual(readExperienceHud(hudWithText("309,37[86.876%]")), { percentage: 86876, amount: null });
    assert.deepEqual(readExperienceHud(hudWithText("0[0.000%]")), { percentage: 0, amount: "0" });
});

test("confirms the game percentage without promoting a single unreadable or misread frame", () => {
    const actual = { percentage: 86775, amount: "309016230472056" };
    const increased = { percentage: 86776, amount: "309017230472056" };
    const misread = { percentage: 50700, amount: null };
    assert.equal(confirmExperienceHud([actual]), null);
    assert.equal(confirmExperienceHud([actual, misread]), null);
    assert.equal(confirmExperienceHud([actual, actual]), actual);
    assert.equal(confirmExperienceHud([actual, misread, increased]), actual);
    assert.equal(confirmExperienceHud([actual, increased, null]), null);
});

test("reads the larger full-screen HUD, including a percent glyph split by an empty column", () => {
    const width = 800;
    const height = 24;
    const data = new Uint8Array(width * height * 4);
    const glyphs = [
        "### #.. #.. #.. #.. #.. #.. ##. ###",
        ".####.. #....## #....## #...... .####.. #....## #....## #....#. .####..",
        ".####. #....# #..... #..... #####. #....# #....# #....# .####.",
        ".. .. .. .. .. .. .. .. ##",
        ".####.. #....## #....## .....## .###### .....## #....## #....#. .####..",
        "..####. ##....# ......# ....... .....#. ...##.. ..#.... ..#.... #######",
        "..# ### ..# ..# ..# ..# ..# ..# ..#",
        ".##.....# #..#...#. .##...#.. ......... ....#.... ...#...#. ......#.. .#....#.# #......#.",
        "## .# .# .# .# .# .# .# ##",
    ];
    let left = 366;
    for (const glyph of glyphs) {
        const rows = glyph.split(" ");
        rows.forEach((row, y) => [...row].forEach((value, x) => {
            if (value === "#") data.set([252, 252, 250, 255], ((y + 12) * width + left + x) * 4);
        }));
        left += rows[0].length + 3;
    }
    assert.equal(readExperienceHud({ data, width, height }).percentage, 86921);
});

test("accumulates progress across a level-up and ignores small backward digit noise", () => {
    const state = emptyExperience();
    measureExperience(state, 9970, 1000);
    measureExperience(state, 9969.8, 2000);
    measureExperience(state, 30, 3000);
    measureExperience(state, 55, 4000);
    assert.equal(state.gained, 85);
    assert.equal(state.observedMs, 3000);
    assert.equal(experiencePace(state), null);
    assert.deepEqual(experiencePace({ ...state, observedMs: 15000 }), { perHour: "204%", perTwoHours: "408%" });
});

test("formats hourly and two-hour gains in percent without rounding the hourly rate first", () => {
    assert.deepEqual(experiencePace({ gained: 235.4, observedMs: 3600000 }), { perHour: "2.35%", perTwoHours: "4.71%" });
    assert.deepEqual(experiencePace({ gained: .1, observedMs: 3600000 }), { perHour: "0.001%", perTwoHours: "0.002%" });
    assert.deepEqual(experiencePace({ gained: 0, observedMs: 3600000 }), { perHour: "0%", perTwoHours: "0%" });
});

test("digit readings retain sub-hundredth gains without bridging unreadable samples", () => {
    const state = emptyExperience();
    measureExperience(state, 8656, 1000);
    measureExperience(state, null, 1500);
    measureExperience(state, 8657.2, 2000);
    measureExperience(state, 8657.3, 3000);
    measureExperience(state, 8657.5, 4000);
    measureExperience(state, null, 5000);
    measureExperience(state, 8660, 6000);
    assert.equal(state.gained, .3);
    assert.equal(state.observedMs, 2000);
});

test("rebases after missing readings or a jump to a different progress bar", () => {
    const state = emptyExperience();
    measureExperience(state, 3000, 1000);
    measureExperience(state, 5000, 12000);
    measureExperience(state, 1200, 13000);
    measureExperience(state, 8000, 14000);
    measureExperience(state, 8030, 15000);
    assert.equal(state.gained, 30);
    assert.equal(state.observedMs, 1000);
    assert.equal(experiencePace(emptyExperience()), null);
});

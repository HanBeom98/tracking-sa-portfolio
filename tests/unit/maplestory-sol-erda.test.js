import assert from "node:assert/strict";
import test from "node:test";
import { readSolErdaPanel } from "../../src/static/maplestory/alerts/sol-erda-vision.mjs";
import { emptySolErda, measureSolErda, restoreSolErda } from "../../src/static/maplestory/alerts/sol-erda-tracking.mjs";

const digitRows = {
    0: [14, 17, 17, 17, 14], 1: [3, 1, 1, 1, 1], 2: [14, 17, 2, 4, 31],
    3: [30, 1, 14, 1, 30], 4: [18, 18, 31, 2, 2], 5: [31, 16, 30, 1, 30],
    6: [14, 16, 30, 17, 14], 7: [31, 1, 2, 4, 4], 8: [14, 17, 14, 17, 14],
    9: [14, 17, 15, 1, 14], "/": [1, 2, 4, 8, 16],
};

function panel(energy, fragments, scale = 1) {
    const width = 156 * scale;
    const height = 57 * scale;
    const data = new Uint8Array(width * height * 4);
    data.fill(24);
    for (const [label, start] of [[energy, 18], [fragments, 97]]) {
        let x = start;
        for (const char of label) {
            const columns = char === "1" ? 2 : 5;
            digitRows[char].forEach((row, y) => {
                for (let col = 0; col < columns; col++) {
                    if (!(row & (1 << (columns - col - 1)))) continue;
                    for (let dy = 0; dy < scale; dy++) {
                        for (let dx = 0; dx < scale; dx++) {
                            const index = ((41 * scale + y * scale + dy) * width + (x + col) * scale + dx) * 4;
                            data.set([251, 250, 255, 255], index);
                        }
                    }
                }
            });
            x += columns + 1;
        }
    }
    return { data, width, height };
}

test("reads only Sol Erda fragments at native and integer-scaled sizes", () => {
    assert.deepEqual(readSolErdaPanel(panel("50/1000", "9")), { fragments: 9 });
    assert.deepEqual(readSolErdaPanel(panel("987/1000", "234567", 2)), { fragments: 234567 });
    assert.deepEqual(readSolErdaPanel(panel("950/1000", "0")), { fragments: 0 });
});

test("reads the live HUD's narrow seven despite a bright gauge highlight above the digits", () => {
    const image = panel("530/1000", "1");
    const ink = (x, y) => image.data.set([251, 250, 255, 255], (y * image.width + x) * 4);
    for (const x of [12, 13, 15, 16, 36]) ink(x, 40);
    const seven = ["####", "...#", "...#", "..#.", "..#."];
    seven.forEach((row, y) => {
        [...row].forEach((pixel, x) => {
            if (pixel === "#") ink(102 + x, 41 + y);
        });
    });
    assert.deepEqual(readSolErdaPanel(image), { fragments: 17 });
});

test("requires the counter denominator and leaves an unreadable fragment count empty", () => {
    assert.equal(readSolErdaPanel(panel("50/2000", "9")), null);
    assert.equal(readSolErdaPanel(panel("", "9")), null);
    assert.deepEqual(readSolErdaPanel(panel("50/1000", "")), { fragments: null });
});

test("counts fragment gains after a spend and skips gaps in observation", () => {
    const state = emptySolErda();
    measureSolErda(state, { fragments: 9 }, 1000);
    measureSolErda(state, { fragments: 10 }, 2000);
    assert.equal(state.fragments, 1);
    measureSolErda(state, { fragments: 8 }, 3000);
    measureSolErda(state, { fragments: 8 }, 4000);
    measureSolErda(state, { fragments: 10 }, 5000);
    measureSolErda(state, { fragments: 28 }, 12000);
    measureSolErda(state, { fragments: 29 }, 13000);
    assert.equal(state.fragments, 4);
    assert.deepEqual(restoreSolErda({ fragments: state.fragments, energy: 77 }), { fragments: 4, last: null });
});

test("a temporary missing leading digit does not manufacture an acquisition", () => {
    const state = emptySolErda();
    measureSolErda(state, { fragments: 29 }, 1000);
    measureSolErda(state, { fragments: 9 }, 2000);
    measureSolErda(state, { fragments: 30 }, 3000);
    assert.equal(state.fragments, 1);
});

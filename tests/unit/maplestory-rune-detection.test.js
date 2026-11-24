import assert from "node:assert/strict";
import test from "node:test";
import { findRune } from "../../src/static/maplestory/alerts/detection.mjs";

const palette = {
    ".": [12, 13, 12],
    p: [221, 102, 255],
    v: [152, 89, 174],
    x: [206, 118, 238],
    o: [137, 130, 141],
    y: [248, 236, 5],
};

function minimap(rows) {
    const width = rows[0].length;
    const height = rows.length;
    const data = new Uint8Array(width * height * 4);
    rows.forEach((row, y) => {
        Array.from(row).forEach((color, x) => {
            data.set([...palette[color], 255], (y * width + x) * 4);
        });
    });
    return { width, height, data };
}

const compressedRune = [
    ".............",
    ".............",
    ".....oo......",
    "....ov.o.....",
    "...ovxx.o....",
    "...ovvx.o....",
    ".....v.o.....",
    ".....oo......",
    ".............",
    "....yy.......",
    "...yyyy......",
    "....yy.......",
];

test("detects a small purple rune with a faint center and light outline", () => {
    assert.deepEqual(findRune(minimap(compressedRune)), { x: 5, y: 4.5 });
});

test("ignores faint purple pixels without an outline and yellow position markers", () => {
    const unoutlined = compressedRune.map((row) => row.replaceAll("o", "."));
    assert.equal(findRune(minimap(unoutlined)), null);
});

test("still detects a vivid diamond without relying on the outline", () => {
    const brightRune = [
        ".........",
        "....p....",
        "...ppp...",
        "..ppppp..",
        ".ppppppp.",
        "..ppppp..",
        "...ppp...",
        "....p....",
        ".........",
    ];
    assert.deepEqual(findRune(minimap(brightRune)), { x: 4, y: 4 });
});

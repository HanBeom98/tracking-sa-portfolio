import assert from "node:assert/strict";
import { test } from "node:test";
import { findMinimap, minimapState, observeMinimap } from "../../src/static/maplestory/alerts/minimap-vision.mjs";

function scene(width = 780, height = 520) {
    const data = new Uint8ClampedArray(width * height * 4).fill(38);
    function fill(x, y, w, h, value) {
        for (let row = y; row < y + h; row++) {
            for (let column = x; column < x + w; column++) {
                const i = (row * width + column) * 4;
                data.fill(value, i, i + 3);
            }
        }
    }
    return { data, width, height, fill };
}

function borderedPanel(image, x, y, width, height) {
    image.fill(x + 3, y, width - 6, 2, 228);
    image.fill(x + 3, y + height - 2, width - 6, 2, 228);
    image.fill(x, y + 3, 2, height - 6, 228);
    image.fill(x + width - 2, y + 3, 2, height - 6, 228);
}

function drawMinimap(image, x, y, scale) {
    const px = value => Math.round(value * scale);
    borderedPanel(image, x, y, px(195), px(84));
    image.fill(x + 3 + px(1), y - px(55), px(9), px(2), 153);
    image.fill(x + 3 + px(22), y - px(55), px(9), px(2), 76);
    image.fill(x + 3 + px(25), y - px(59), px(3), px(10), 76);
}

test("finds an expanded minimap at different positions without using map artwork or the rune", () => {
    for (const [x, y, scale] of [[5, 97, 1], [380, 242, 1.4], [210, 380, .6]]) {
        const image = scene();
        borderedPanel(image, 8, 49, 150, 67);
        drawMinimap(image, x, y, scale);
        const map = findMinimap(image);
        assert.ok(map);
        assert.equal(map.x, x + 3);
        assert.ok(map.y >= y + 2 && map.y <= y + 3);
        assert.ok(map.width > 100);
    }
});

test("ignores unrelated frames and a covered or collapsed map", () => {
    const image = scene();
    borderedPanel(image, 100, 130, 195, 84);
    assert.equal(findMinimap(image), null);
    drawMinimap(image, 400, 240, 1);
    assert.ok(findMinimap(image));
    image.fill(400, 245, 195, 80, 38);
    assert.equal(findMinimap(image), null);
    image.fill(400, 240, 195, 5, 38);
    assert.equal(findMinimap(image), null);
});

test("waits for two consistent frames and suspends on loss before finding a moved minimap", () => {
    const state = minimapState();
    const windowed = { x: 10, y: 98, width: 185, height: 74 };
    const jittered = { ...windowed, x: 12 };
    const fullscreen = { x: 460, y: 310, width: 268, height: 112 };
    assert.equal(observeMinimap(state, windowed), null);
    assert.equal(observeMinimap(state, jittered), jittered);
    assert.equal(observeMinimap(state, null), null);
    assert.equal(state.found, true);
    assert.equal(observeMinimap(state, fullscreen), null);
    assert.equal(observeMinimap(state, fullscreen), fullscreen);
});

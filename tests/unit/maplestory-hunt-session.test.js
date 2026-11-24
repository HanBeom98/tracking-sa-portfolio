import assert from "node:assert/strict";
import test from "node:test";
import {
    emptySession, formatHuntCount, formatHuntTime, huntElapsed, huntRate, parseHuntCount, runHunt, stopHunt,
} from "../../src/static/maplestory/alerts/hunt-session.mjs";
import { captureViewport, frameSizeKey, sameCaptureViewport, savedCaptureRegions } from "../../src/static/maplestory/alerts/capture-regions.mjs";

test("preserves a previously selected region and stores independent regions by capture size", () => {
    const windowed = { width: 1366, height: 798, rect: { x: .006, y: .12, w: .14, h: .095 } };
    const maximized = { width: 1920, height: 1080, rect: { x: .002, y: .09, w: .10, h: .07 } };
    const restored = savedCaptureRegions(windowed);
    restored[frameSizeKey(maximized)] = maximized;
    assert.deepEqual(savedCaptureRegions(JSON.parse(JSON.stringify(restored))), {
        "1366x798": windowed, "1920x1080": maximized,
    });
    assert.deepEqual(savedCaptureRegions({ invalid: null, mystery: { width: 100, height: 100 } }), {});
});

test("keeps monitor input dimensions independent from the tracked game viewport", () => {
    const monitor = { width: 1920, height: 1080 };
    const selected = { x: 32 / monitor.width, y: 24 / monitor.height, w: 1368 / monitor.width, h: 800 / monitor.height };
    const windowed = captureViewport(monitor, selected);
    const fullscreen = captureViewport(monitor);
    assert.deepEqual(windowed, { x: 32, y: 24, width: 1368, height: 800 });
    assert.deepEqual(fullscreen, { x: 0, y: 0, width: 1920, height: 1080 });
    assert.equal(sameCaptureViewport(windowed, captureViewport(monitor, selected)), true);
    assert.equal(sameCaptureViewport(windowed, fullscreen), false);
    assert.equal(sameCaptureViewport(windowed, { ...windowed, x: 48 }), false);
});

test("hunt time accumulates only during running periods and survives reload and finish", () => {
    const session = emptySession();
    runHunt(session, 1000);
    stopHunt(session, 61000, "paused");
    assert.equal(huntElapsed(session, 121000), 60000);
    runHunt(session, 121000);
    const restored = JSON.parse(JSON.stringify(session));
    stopHunt(restored, 241000, "finished");
    assert.equal(huntElapsed(restored, 841000), 180000);
    assert.equal(formatHuntTime(huntElapsed(restored, 841000)), "00:03:00");
});

test("hunting totals preserve large integers and use elapsed time for hourly rates", () => {
    assert.equal(parseHuntCount("9,123,456,789,123,456,789"), "9123456789123456789");
    assert.equal(huntRate("9123456789123456789", 1800000), "18246913578246913578");
    assert.equal(huntRate("125000000", 900000), "500000000");
    assert.equal(formatHuntCount("500000000", true), "5억");
    assert.equal(formatHuntCount("125000000", true), "1.25억");
    assert.equal(formatHuntCount("125000000"), "125,000,000");
});

test("missing and invalid result fields are distinguishable", () => {
    assert.equal(parseHuntCount(""), null);
    assert.equal(parseHuntCount("0"), "0");
    assert.equal(parseHuntCount("-1"), undefined);
    assert.equal(parseHuntCount("12,34"), undefined);
    assert.equal(huntRate(null, 900000), null);
    assert.equal(huntRate("1000", 0), null);
    assert.equal(formatHuntCount(null, true), "—");
});

import assert from "node:assert/strict";
import test from "node:test";
import { nextRuneAlert, runeAlertState, selectRuneVoice } from "../../src/static/maplestory/alerts/rune-alert.mjs";

test("a visible rune triggers one alert and two spaced reminders", () => {
    const state = runeAlertState();
    const samples = [0, 350, 700, 4000, 5700, 10400, 10700, 15700];
    assert.deepEqual(
        samples.map((now) => nextRuneAlert(state, true, now)),
        [null, null, "first", null, "repeat", null, "repeat", null],
    );
});

test("a rune that disappears stops reminders and a later rune alerts again", () => {
    const state = runeAlertState();
    for (const now of [0, 350, 700]) nextRuneAlert(state, true, now);

    assert.equal(nextRuneAlert(state, false, 5700), null);
    assert.equal(nextRuneAlert(state, false, 6050), null);
    assert.equal(nextRuneAlert(state, false, 6400), null);
    assert.equal(nextRuneAlert(state, true, 6750), null);
    assert.equal(nextRuneAlert(state, true, 7100), null);
    assert.equal(nextRuneAlert(state, true, 7450), "first");
    assert.equal(nextRuneAlert(state, true, 12450), "repeat");
});

test("a delayed frame does not cause multiple reminders at once", () => {
    const state = runeAlertState();
    for (const now of [0, 350, 700]) nextRuneAlert(state, true, now);

    assert.equal(nextRuneAlert(state, true, 20000), "repeat");
    assert.equal(nextRuneAlert(state, true, 20350), null);
    assert.equal(nextRuneAlert(state, true, 25000), "repeat");
});

test("prefers an installed Korean female voice and skips remote voices", () => {
    const remote = { name: "SunHi", lang: "ko-KR", localService: false };
    const male = { name: "InJoon", lang: "ko-KR", localService: true, default: true };
    const female = { name: "Microsoft Heami Desktop", lang: "ko-KR", localService: true };
    const english = { name: "Zira", lang: "en-US", localService: true };

    assert.equal(selectRuneVoice([remote, male, female, english]), female);
    assert.equal(selectRuneVoice([remote, male, english]), male);
    assert.equal(selectRuneVoice([remote, english]), undefined);
});

import assert from "node:assert/strict";
import test from "node:test";
import { onRequestGet } from "../../functions/api/maple-character.js";
import { onRequestGet as mapleNews } from "../../functions/api/maple-news.js";
import { bossWeek, mapleDay, mapleResetTimes, nextBossReset, summarizeBossWeek, summarizeMapleIncome } from "../../src/static/maplestory/maple-data.mjs";
import { adjustedCooldownSeconds } from "../../src/static/maplestory/boss/cooldown.mjs";
import { advanceVisit, growthChanges } from "../../src/static/maplestory/home-growth.mjs";
import { symbolForceGroups, symbolUpgradeState } from "../../src/static/maplestory/character-details.mjs";

test("boss weeks roll over on Thursday at midnight in Korea", () => {
    assert.equal(bossWeek(Date.parse("2026-11-11T14:59:59Z")), "2026-11-05");
    assert.equal(bossWeek(Date.parse("2026-11-11T15:00:00Z")), "2026-11-12");
    assert.equal(nextBossReset(Date.parse("2026-11-11T14:59:59Z")), Date.parse("2026-11-11T15:00:00Z"));
    assert.equal(nextBossReset(Date.parse("2026-11-11T15:00:00Z")), Date.parse("2026-11-18T15:00:00Z"));
});

test("only the selected character's current clears count toward the weekly meso share", () => {
    const entries = [
        { character: "대표", clearedWeek: "new", meso: 100, party: 3 },
        { character: "대표", clearedWeek: "new", meso: null, party: 1 },
        { character: "대표", clearedWeek: "old", meso: 200, party: 1 },
        { character: "다른캐릭터", clearedWeek: "new", meso: 300, party: 1 },
    ];
    assert.deepEqual(summarizeBossWeek(entries, "대표", "new"), { count: 2, total: 3, meso: 33 });
});

test("the home schedule crosses Korean midnight and year-end independently of the host time zone", () => {
    const now = Date.parse("2026-12-31T14:59:59Z");
    assert.equal(mapleDay(now), "2026-12-31");
    assert.deepEqual(mapleResetTimes(now), {
        daily: Date.parse("2026-12-31T15:00:00Z"),
        weekly: Date.parse("2027-01-06T15:00:00Z"),
        sunday: Date.parse("2027-01-02T15:00:00Z"),
        monthly: Date.parse("2026-12-31T15:00:00Z"),
    });
    assert.equal(mapleDay(now + 1000), "2027-01-01");
    assert.equal(mapleResetTimes(now + 1000).monthly, Date.parse("2027-01-31T15:00:00Z"));
});

test("home income counts only known current-week values for the selected representative", () => {
    const now = Date.parse("2026-11-17T12:00:00+09:00");
    const plans = [
        { character: "대표", boss: "루시드", clearedWeek: "2026-11-12", meso: 100, party: 3 },
        { character: "대표", boss: "윌", clearedWeek: "2026-11-12", meso: null, party: 1 },
        { character: "대표", boss: "듄켈", clearedWeek: "2026-11-05", meso: 999, party: 1 },
        { character: "친구", boss: "세렌", clearedWeek: "2026-11-12", meso: 999, party: 1 },
    ];
    const hunts = [
        { character: "대표", savedAt: now, meso: "1230000000", elapsedMs: 1800000 },
        { character: "대표", savedAt: now, meso: null },
        { character: "대표", savedAt: nextBossReset(now), meso: "123" },
        { character: "대표", savedAt: Date.parse("2026-11-11T23:59:59+09:00"), meso: "123" },
        { character: "친구", savedAt: now, meso: "123" },
    ];
    const result = summarizeMapleIncome(plans, hunts, "대표", now);
    assert.deepEqual(result, { cleared: 2, remaining: [plans[2]], crystals: 33n, huntMeso: 1230000000n, huntCount: 2, huntTimeMs: 1800000 });
    const empty = summarizeMapleIncome(plans, hunts, "", now);
    assert.equal(empty.crystals, null);
    assert.equal(empty.huntMeso, null);
});

test("home news deduplicates requests and sorts ongoing official events by deadline", async (t) => {
    t.mock.method(Date, "now", () => Date.parse("2026-11-17T01:00:00+09:00"));
    const notice = { title: "공지", url: "https://maplestory.nexon.com/News/Notice/All/12", date: "2026-11-16T10:00:00+09:00" };
    const event = {
        title: "마감 임박", url: "https://maplestory.nexon.com/News/Event/16",
        date_event_start: "2026-11-16T10:00:00+09:00", date_event_end: "2026-11-17T23:59:00+09:00",
    };
    const seen = [];
    t.mock.method(globalThis, "fetch", (url, options) => {
        seen.push(url.pathname);
        assert.equal(options.redirect, "manual");
        if (url.pathname.endsWith("/notice")) return Response.json({ notice: [notice, { ...notice, url: "https://example.invalid/News/12" }] });
        return Response.json({ event_notice: [
            { ...event, title: "나중에 마감", date_event_end: "2026-11-20T23:59:00+09:00" }, event,
            { ...event, title: "종료", date_event_end: "2026-11-17T00:30:00+09:00" },
            { ...event, title: "시작 전", date_event_start: "2026-11-17T10:00:00+09:00" },
        ] });
    });
    const ctx = { env: { MAPLE_NEXON_API_KEY: "fixture" }, request: new Request("https://trackingsa.com/api/maple-news") };
    const results = await Promise.all([mapleNews(ctx), mapleNews(ctx)]);
    assert.deepEqual(seen, ["/maplestory/v1/notice", "/maplestory/v1/notice-event"]);
    for (const response of results) {
        assert.equal(response.status, 200);
        const data = await response.json();
        assert.deepEqual(data.notices.map(({ title }) => title), ["공지"]);
        assert.deepEqual(data.events.map(({ title }) => title), ["마감 임박", "나중에 마감"]);
    }
});

function context(name, env = {}) {
    return { request: new Request("https://trackingsa.com/api/maple-character?" + new URLSearchParams({ name })), env };
}

test("the character lookup checks configuration and passes only the nickname to the official endpoint", async (t) => {
    const fakeKey = "test-secret-for-fixture";
    assert.equal((await onRequestGet(context("캐릭터"))).status, 503);
    assert.equal((await onRequestGet(context("../id"))).status, 400);
    const seen = [];
    t.mock.method(globalThis, "fetch", (url, options) => {
        seen.push(url.toString());
        assert.equal(options.headers["x-nxopen-api-key"], fakeKey);
        assert.equal(options.redirect, "manual");
        if (url.pathname.endsWith("/id")) return Response.json({ ocid: "sample" });
        return Response.json({
            character_name: "캐릭터", world_name: "스카니아", character_class: "비숍",
            character_level: 285, character_image: "https://open.api.nexon.com/static/maplestory/character/look/test",
            unrelated_field: fakeKey,
        });
    });
    const ctx = context("캐릭터", { MAPLE_NEXON_API_KEY: fakeKey });
    const responses = await Promise.all([onRequestGet(ctx), onRequestGet(ctx)]);
    assert.equal(seen.length, 2);
    assert.equal(new URL(seen[0]).searchParams.get("character_name"), "캐릭터");
    assert.equal(new URL(seen[1]).searchParams.get("ocid"), "sample");
    for (const response of responses) {
        assert.deepEqual(await response.json(), {
            name: "캐릭터", world: "스카니아", job: "비숍", level: 285,
            image: "https://open.api.nexon.com/static/maplestory/character/look/test",
        });
    }
});

test("a redirect from Nexon stops the lookup without forwarding the credential", async (t) => {
    const seen = [];
    t.mock.method(globalThis, "fetch", (url, options) => {
        seen.push(url.origin);
        if (options.redirect === "error") throw new TypeError("Unsupported redirect mode");
        return Response.redirect("https://example.invalid/redirected", 302);
    });
    const response = await onRequestGet(context("캐릭터", { MAPLE_NEXON_API_KEY: "test-secret-for-fixture" }));
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: "NEXON_UNAVAILABLE" });
    assert.deepEqual(seen, ["https://open.api.nexon.com"]);
});

test("cooldown lookup separates hat options from total reductions and sums both potential tiers", async (t) => {
    const responses = {
        "/maplestory/v1/id": { ocid: "sample" },
        "/maplestory/v1/character/stat": { final_stat: [
            { stat_name: "재사용 대기시간 감소 (초)", stat_value: "3" },
            { stat_name: "재사용 대기시간 감소 (%)", stat_value: "5" },
            { stat_name: "재사용 대기시간 미적용", stat_value: "15" },
        ] },
        "/maplestory/v1/character/item-equipment": { item_equipment: [
            {
                item_equipment_slot: "모자", item_name: "테스트 모자",
                potential_option_1: "모든 스킬의 재사용 대기시간 : -2초",
                additional_potential_option_1: "모든 스킬의 재사용 대기시간 1초 감소",
            },
            { item_equipment_slot: "상의", potential_option_1: "모든 스킬의 재사용 대기시간 : -2초" },
        ] },
    };
    t.mock.method(globalThis, "fetch", (url) => Response.json(responses[url.pathname]));
    const ctx = context("캐릭터", { MAPLE_NEXON_API_KEY: "test-secret-for-fixture" });
    ctx.request = new Request(ctx.request.url + "&include=cooldown");
    const response = await onRequestGet(ctx);
    assert.equal(response.status, 200);
    const reduction = await response.json();
    assert.deepEqual(reduction, {
        fixedSeconds: 3, percent: 5, fixedSource: "stat", hat: { name: "테스트 모자", seconds: 3 },
    });
    assert.equal(adjustedCooldownSeconds(120, reduction), 111);
});

test("home summaries defer equipment calls and keep the profile available if stats time out", async (t) => {
    const seen = [];
    t.mock.method(globalThis, "fetch", (url) => {
        seen.push(url.pathname);
        if (url.pathname.endsWith("/id")) return Response.json({ ocid: "sample" });
        if (url.pathname.endsWith("/basic")) return Response.json({ character_name: "친구", character_level: 285 });
        return Response.json({ error: {} }, { status: 429 });
    });
    const ctx = context("친구", { MAPLE_NEXON_API_KEY: "fixture" });
    ctx.request = new Request(ctx.request.url + "&include=summary");
    const response = await onRequestGet(ctx);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    const payload = await response.json();
    assert.equal(payload.profile.name, "친구");
    assert.equal(payload.stats, null);
    assert.deepEqual(seen, ["/maplestory/v1/id", "/maplestory/v1/character/basic", "/maplestory/v1/character/stat"]);
});

test("growth history skips unpublished dates in Korea and combines concurrent lookups", async (t) => {
    let now = Date.parse("2027-01-02T01:59:59+09:00");
    t.mock.method(Date, "now", () => now);
    const dates = [];
    t.mock.method(globalThis, "fetch", (url) => {
        if (url.pathname.endsWith("/id")) return Response.json({ ocid: "sample" });
        assert.equal(url.pathname, "/maplestory/v1/character/basic");
        const date = url.searchParams.get("date");
        dates.push(date);
        if (date === "2026-12-29") return Response.json({ error: {} }, { status: 400 });
        return Response.json({ character_level: 292, character_exp_rate: "86.775" });
    });
    const ctx = context("성장조회", { MAPLE_NEXON_API_KEY: "fixture" });
    ctx.request = new Request(ctx.request.url + "&include=growth&day=1999-01-01");
    const responses = await Promise.all([onRequestGet(ctx), onRequestGet(ctx)]);
    assert.deepEqual(dates, ["2026-12-26", "2026-12-27", "2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31"]);
    const first = await responses[0].json();
    assert.equal(first.day, "2027-01-02");
    assert.equal(first.snapshots.length, 5);
    assert.deepEqual(first.snapshots.at(-1), { date: "2026-12-31", level: 292, expRate: 86.775 });
    assert.deepEqual(await responses[1].json(), first);
    now += 1000;
    assert.equal((await (await onRequestGet(ctx)).json()).snapshots.at(-1).date, "2027-01-01");
});

test("daily changes preserve zeroes and avoid bridging missing dates and character levels", () => {
    const day = "2027-01-03";
    const snapshots = [
        { date: "2026-12-28", level: 291, expRate: 98 },
        { date: "2026-12-29", level: 292, expRate: 1 },
        { date: "2026-12-30", level: 292, expRate: 1 },
        { date: "2027-01-01", level: 292, expRate: 2 },
        { date: "2027-01-02", level: 292, expRate: 2.355 },
    ];
    const result = growthChanges(day, snapshots, { level: 292, expRate: 2.356 });
    assert.deepEqual(result.map(({ change, levelUp }) => levelUp ? "레벨업" : change),
        [null, "레벨업", 0, null, null, 0.355, 0.001]);
    assert.equal(growthChanges(day, snapshots, { level: 292, expRate: 2 }).at(-1).change, null);
    assert.equal(growthChanges(day, snapshots, null).at(-1).change, null);
});

test("a cached refresh preserves the last comparison and a partial lookup preserves the last known power", () => {
    const first = { fetchedAt: 1, level: 292, expRate: 86.775, power: "220320000" };
    const partial = { fetchedAt: 2, level: 292, expRate: 87.1, power: null };
    const third = { fetchedAt: 3, level: 292, expRate: 88.037, power: "107739101" };
    const initial = advanceVisit(null, first);
    const second = advanceVisit(initial, partial);
    const result = advanceVisit(second, third);
    assert.deepEqual(result.previous, { ...partial, power: first.power, powerAt: first.fetchedAt });
    assert.deepEqual(advanceVisit(result, { ...third }), result);
    assert.deepEqual(advanceVisit(result, first), { latest: third, previous: null });
});

test("equipment normalizes presets and set effects while using the current hat and stats for cooldown", async (t) => {
    const hat = {
        item_name: "현재 모자", item_equipment_slot: "모자", starforce: "22",
        item_icon: "https://open.api.nexon.com/static/maplestory/item/icon/sample",
        potential_option_grade: "레전드리", potential_option_1: "재사용 대기시간 : -2초",
        item_add_option: { luk: "80", attack_power: "0" }, item_etc_option: { attack_power: "6" },
    };
    const responses = {
        "/maplestory/v1/id": { ocid: "sample" },
        "/maplestory/v1/character/basic": { character_name: "장비조회" },
        "/maplestory/v1/character/stat": { final_stat: [
            { stat_name: "전투력", stat_value: "142300000" },
            { stat_name: "아이템 드롭률", stat_value: "200" },
            { stat_name: "메소 획득량", stat_value: "0" },
            { stat_name: "재사용 대기시간 감소 (초)", stat_value: "2" },
            { stat_name: "재사용 대기시간 감소 (%)", stat_value: "0" },
        ] },
        "/maplestory/v1/character/item-equipment": {
            preset_no: 1, item_equipment: [hat], item_equipment_preset_1: [hat],
            item_equipment_preset_2: [{ ...hat, item_name: "다른 모자", potential_option_1: "LUK +12%",
                item_icon: "https://other.example/icon.png" }],
        },
        "/maplestory/v1/character/set-effect": { set_effect: [
            { set_name: "모험가 세트", total_set_count: 4, set_effect_info: [{ set_count: 4, set_option: "모든 스탯 +10" }] },
        ] },
    };
    t.mock.method(globalThis, "fetch", (url) => Response.json(responses[url.pathname]));
    const ctx = context("장비조회", { MAPLE_NEXON_API_KEY: "fixture" });
    ctx.request = new Request(ctx.request.url + "&include=equipment");
    const response = await onRequestGet(ctx);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("Cache-Control"), /s-maxage=600/);
    const payload = await response.json();
    assert.deepEqual(payload.stats, { power: "142300000", drop: 200, meso: 0, cooldownSeconds: 2, cooldownPercent: 0 });
    assert.deepEqual(payload.cooldown, { fixedSeconds: 2, percent: 0, fixedSource: "stat", hat: { name: "현재 모자", seconds: 2 } });
    assert.equal(payload.activePreset, 1);
    assert.deepEqual(payload.equipped[0].bonus, ["LUK +80"]);
    assert.deepEqual(payload.equipped[0].scroll, ["공격력 +6"]);
    assert.equal(payload.presets[1].items[0].icon, null);
    assert.equal(payload.sets[0].effects[0].text, "모든 스탯 +10");
});

test("public character details keep symbol progression and union when the dojang endpoint is unavailable", async (t) => {
    const seen = [];
    t.mock.method(globalThis, "fetch", (url) => {
        const path = url.pathname.replace("/maplestory/v1/", "");
        seen.push(path);
        if (path === "id") return Response.json({ ocid: "public-character" });
        assert.equal(url.searchParams.get("ocid"), "public-character");
        if (path === "character/dojang") return Response.json({}, { status: 429 });
        if (path === "user/union") return Response.json({
            union_level: 9852, union_grade: "슈프림 유니온 2", union_artifact_level: 60,
        });
        assert.equal(path, "character/symbol-equipment");
        return Response.json({ symbol: [{
            symbol_name: "어센틱심볼 : 탈라하트", symbol_icon: "https://open.api.nexon.com/static/maplestory/item/icon/a",
            symbol_force: "40", symbol_level: 4, symbol_growth_count: 11, symbol_require_growth_count: 45,
        }, {
            symbol_name: "아케인심볼 : 소멸의 여로", symbol_icon: "https://example.invalid/image.png",
            symbol_force: "0", symbol_level: 20, symbol_growth_count: 0, symbol_require_growth_count: 0,
        }] });
    });
    const ctx = context("캐릭터", { MAPLE_NEXON_API_KEY: "fixture" });
    ctx.request = new Request(ctx.request.url + "&include=progression");
    const response = await onRequestGet(ctx);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("Cache-Control"), /s-maxage=60$/);
    const data = await response.json();
    assert.equal(data.dojang, null);
    assert.deepEqual(data.union, { level: 9852, grade: "슈프림 유니온 2", artifact: 60 });
    assert.deepEqual(data.symbols[0], {
        name: "어센틱심볼 : 탈라하트", icon: "https://open.api.nexon.com/static/maplestory/item/icon/a",
        force: 40, level: 4, growth: 11, required: 45,
    });
    assert.equal(data.symbols[1].icon, null);
    assert.equal(data.symbols[1].force, 0);
    assert.deepEqual(seen, ["id", "character/symbol-equipment", "character/dojang", "user/union"]);
});

test("HEXA details show equipped cores and retain zero-level stats without returning presets", async (t) => {
    const responses = {
        "/maplestory/v1/id": { ocid: "public-character" },
        "/maplestory/v1/character/hexamatrix": { character_hexa_core_equipment: [
            { hexa_core_name: "솔라 슬래시", hexa_core_level: 30, hexa_core_event_level: 1, hexa_core_type: "마스터리 코어" },
        ] },
        "/maplestory/v1/character/hexamatrix-stat": {
            character_hexa_stat_core: [],
            character_hexa_stat_core_2: [{ main_stat_name: "공격력", main_stat_level: 6, sub_stat_name_1: "보스 데미지",
                sub_stat_level_1: 0, stat_grade: 6 }],
            preset_hexa_stat_core: [{ main_stat_name: "마력", main_stat_level: 10 }],
        },
    };
    t.mock.method(globalThis, "fetch", (url) => Response.json(responses[url.pathname]));
    const ctx = context("캐릭터", { MAPLE_NEXON_API_KEY: "fixture" });
    ctx.request = new Request(ctx.request.url + "&include=hexa");
    const response = await onRequestGet(ctx);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("Cache-Control"), /s-maxage=600$/);
    const data = await response.json();
    assert.deepEqual(data.cores, [{ name: "솔라 슬래시", level: 30, eventLevel: 1, type: "마스터리 코어" }]);
    assert.deepEqual(data.stats, [{ slot: 2, grade: 6, stats: [{ label: "공격력", level: 6 }, { label: "보스 데미지", level: 0 }] }]);
});

test("authentic force includes Grand Authentic Symbols and symbol growth honors each level cap", () => {
    const authentic = { name: "어센틱심볼 : 카르시온", force: 110, level: 11, growth: 0, required: 1309 };
    const grand = { name: "그랜드 어센틱심볼 : 탈라하트", force: 70, level: 7, growth: 1678, required: 581 };
    const arcane = { name: "아케인심볼 : 소멸의 여로", force: 220, level: 20, growth: 0, required: 411 };
    const groups = symbolForceGroups([authentic, grand, arcane]);
    assert.deepEqual(groups.get("authentic"), [authentic, grand]);
    assert.deepEqual(groups.get("arcane"), [arcane]);
    assert.equal(symbolUpgradeState(authentic, "어센틱심볼"), "max");
    assert.equal(symbolUpgradeState(grand, "그랜드 어센틱심볼"), "ready");
    assert.equal(symbolUpgradeState(arcane, "아케인심볼"), "max");
    assert.equal(symbolUpgradeState({ ...arcane, level: 19 }, "아케인심볼"), "growing");
});

test("fixed reduction respects the 10-second conversion and 5-second floor", () => {
    assert.equal(adjustedCooldownSeconds(120, { fixedSeconds: 2, percent: 0 }), 118);
    assert.equal(adjustedCooldownSeconds(11, { fixedSeconds: 2, percent: 0 }), 9.5);
    assert.equal(adjustedCooldownSeconds(8, { fixedSeconds: 2, percent: 0 }), 7.2);
    assert.equal(adjustedCooldownSeconds(7, { fixedSeconds: 10, percent: 0 }), 5);
    assert.equal(adjustedCooldownSeconds(4, { fixedSeconds: 2, percent: 0 }), 4);
    assert.equal(adjustedCooldownSeconds(360, null), 360);
});

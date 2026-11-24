import { requestJson } from "../../src/domains/shared/http-request.js";
import { mapleDay } from "../../src/static/maplestory/maple-data.mjs";
import { publicCacheKey, readPublicResponse, storePublicResponse } from "../infra/public-response-cache.js";

const nexonBase = "https://open.api.nexon.com/maplestory/v1/";
const cacheHeader = "X-Maple-Cache";
const pending = new Map();
const dayMs = 86400000;

function lastGrowthDate(now) {
    // Nexon publishes the previous day's character data at 02:00 KST.
    return mapleDay(now - dayMs - 2 * 3600000);
}

function fail(status, error) {
    return Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

function lookup(path, name, value, key, date) {
    const url = new URL(path, nexonBase);
    url.searchParams.set(name, value);
    if (date) url.searchParams.set("date", date);
    return requestJson(url, {
        headers: { accept: "application/json", "x-nxopen-api-key": key },
        // Workers supports manual redirects, which keeps the key on the Nexon origin.
        redirect: "manual",
    }, { timeoutMs: 5000 });
}

function characterImage(value) {
    try {
        const url = new URL(value);
        return url.origin === "https://open.api.nexon.com" && url.pathname.startsWith("/static/maplestory/")
            ? url.href : null;
    } catch {
        return null;
    }
}

function statNumber(stats, name) {
    const value = stats.find((entry) => entry?.stat_name === name)?.stat_value;
    return typeof value === "string" && /^\d+(?:\.\d+)?$/.test(value) ? Number(value) : null;
}

function readStats(data) {
    if (!Array.isArray(data?.final_stat)) return null;
    const stats = data.final_stat;
    const power = stats.find((entry) => entry?.stat_name === "전투력")?.stat_value;
    return {
        power: typeof power === "string" && /^\d{1,24}$/.test(power) ? power : null,
        drop: statNumber(stats, "아이템 드롭률"),
        meso: statNumber(stats, "메소 획득량"),
        cooldownSeconds: statNumber(stats, "재사용 대기시간 감소 (초)"),
        cooldownPercent: statNumber(stats, "재사용 대기시간 감소 (%)"),
    };
}

function readCooldown(stats, equipment) {
    const hat = equipment?.item_equipment?.find((item) => item.item_equipment_slot === "모자");
    const options = ["potential_option", "additional_potential_option"]
        .flatMap((type) => [1, 2, 3].map((index) => hat?.[type + "_" + index]))
        .flatMap((text) => {
            const match = text?.match(/재사용\s*대기시간\s*(?:(?:감소)?\s*[:：]\s*)?([-−]?)\s*(\d+(?:\.\d+)?)\s*초(?:\s*감소)?/u);
            return match && (match[1] || /초\s*감소/.test(match[0])) ? [Number(match[2])] : [];
        });
    const hatSeconds = hat ? options.reduce((total, seconds) => total + seconds, 0) : null;
    const summary = readStats(stats);
    const fixedSeconds = summary?.cooldownSeconds ?? null;
    const percent = summary?.cooldownPercent ?? null;
    return {
        fixedSeconds: fixedSeconds ?? (hatSeconds > 0 ? hatSeconds : null),
        percent,
        hat: hat ? { name: hat.item_name, seconds: hatSeconds } : null,
        fixedSource: fixedSeconds !== null ? "stat" : hatSeconds > 0 ? "hat" : null,
    };
}

const optionNames = {
    str: "STR", dex: "DEX", int: "INT", luk: "LUK", max_hp: "최대 HP", max_mp: "최대 MP",
    attack_power: "공격력", magic_power: "마력", all_stat: "올스탯",
    boss_damage: "보스 데미지", ignore_monster_armor: "방어율 무시", damage: "데미지",
};
const percentOptions = new Set(["all_stat", "boss_damage", "ignore_monster_armor", "damage"]);

function optionValues(values) {
    return Object.entries(optionNames).flatMap(([key, label]) => {
        const value = Number(values?.[key]);
        return Number.isFinite(value) && value !== 0
            ? [label + " " + (value > 0 ? "+" : "") + value + (percentOptions.has(key) ? "%" : "")] : [];
    });
}

function potentialLines(item, prefix) {
    return [1, 2, 3].map((index) => item[prefix + "_" + index]).filter((line) => typeof line === "string" && line.trim());
}

function equipmentItems(items) {
    if (!Array.isArray(items)) return null;
    return items.filter((item) => item?.item_equipment_slot && item.item_name).map((item) => ({
        slot: item.item_equipment_slot,
        name: item.item_name,
        icon: characterImage(item.item_icon),
        stars: item.starforce ?? null,
        potential: { grade: item.potential_option_grade, lines: potentialLines(item, "potential_option") },
        additional: { grade: item.additional_potential_option_grade, lines: potentialLines(item, "additional_potential_option") },
        bonus: optionValues(item.item_add_option),
        scroll: optionValues(item.item_etc_option),
    }));
}

function setEffects(data) {
    if (!Array.isArray(data?.set_effect)) return null;
    return data.set_effect.map((entry) => ({
        name: entry.set_name,
        count: entry.total_set_count,
        effects: Array.isArray(entry.set_effect_info)
            ? entry.set_effect_info.map(({ set_count, set_option }) => ({ count: set_count, text: set_option })) : [],
    }));
}

function basicProfile(data) {
    if (typeof data?.character_name !== "string") return null;
    return {
        name: data.character_name,
        world: data.world_name,
        job: data.character_class,
        level: data.character_level,
        image: characterImage(data.character_image),
    };
}

function experienceRate(value) {
    if (typeof value !== "string" || !/^\d{1,3}(?:\.\d+)?$/.test(value)) return null;
    const rate = Number(value);
    return rate <= 100 ? rate : null;
}

async function fetchGrowth(ocid, apiKey, now) {
    const day = mapleDay(now);
    const lastPublishedDay = lastGrowthDate(now);
    const dates = Array.from({ length: 7 }, (_, index) => mapleDay(now - (7 - index) * dayMs));
    const results = await Promise.allSettled(dates.map(async (date) => {
        if (date > lastPublishedDay) return null;
        const { response, data } = await lookup("character/basic", "ocid", ocid, apiKey, date);
        if (response.status === 429 || response.status >= 500) throw new Error("Nexon history temporarily unavailable");
        const level = data?.character_level;
        const expRate = experienceRate(data?.character_exp_rate);
        return response.ok && Number.isInteger(level) && level > 0 && expRate !== null
            ? { date, level, expRate } : null;
    }));
    const snapshots = results.flatMap((result) => result.status === "fulfilled" && result.value ? [result.value] : []);
    if (!snapshots.length && results.some((result) => result.status === "rejected")) return fail(502, "NEXON_UNAVAILABLE");
    const complete = results.every((result) => result.status === "fulfilled" && result.value);
    return Response.json({ day, snapshots }, { headers: {
        "Cache-Control": complete ? "public, max-age=600, s-maxage=21600" : "public, max-age=60, s-maxage=600",
        [cacheHeader]: "MISS",
    } });
}

const nonnegativeInt = (value) => Number.isSafeInteger(value) && value >= 0 ? value : null;
const availableText = (value) => typeof value === "string" && value.trim() ? value.trim() : null;

function readSymbols(data) {
    if (!Array.isArray(data?.symbol)) return null;
    return data.symbol.flatMap((item) => {
        const name = availableText(item?.symbol_name);
        if (!name) return [];
        const force = typeof item.symbol_force === "string" && /^\d+$/.test(item.symbol_force)
            ? nonnegativeInt(Number(item.symbol_force)) : nonnegativeInt(item.symbol_force);
        return [{
            name, icon: characterImage(item.symbol_icon), force, level: nonnegativeInt(item.symbol_level),
            growth: nonnegativeInt(item.symbol_growth_count), required: nonnegativeInt(item.symbol_require_growth_count),
        }];
    });
}

function readDojang(data) {
    const floor = nonnegativeInt(data?.dojang_best_floor);
    if (floor === null) return null;
    const achievedAt = Date.parse(data.date_dojang_record);
    return { floor, seconds: nonnegativeInt(data.dojang_best_time), achievedAt: Number.isFinite(achievedAt) ? achievedAt : null };
}

function readUnion(data) {
    const level = nonnegativeInt(data?.union_level);
    return level === null ? null : {
        level, grade: availableText(data.union_grade), artifact: nonnegativeInt(data.union_artifact_level),
    };
}

function readHexaCores(data) {
    if (!Array.isArray(data?.character_hexa_core_equipment)) return null;
    return data.character_hexa_core_equipment.flatMap((item) => {
        const name = availableText(item?.hexa_core_name);
        const level = nonnegativeInt(item?.hexa_core_level);
        return name && level !== null ? [{
            name, level, type: availableText(item.hexa_core_type), eventLevel: nonnegativeInt(item.hexa_core_event_level),
        }] : [];
    });
}

function readHexaStats(data) {
    const slots = [data?.character_hexa_stat_core, data?.character_hexa_stat_core_2, data?.character_hexa_stat_core_3];
    if (!slots.some(Array.isArray)) return null;
    return slots.flatMap((slot, index) => (Array.isArray(slot) ? slot : []).flatMap((item) => {
        const stats = [
            [item?.main_stat_name, item?.main_stat_level],
            [item?.sub_stat_name_1, item?.sub_stat_level_1],
            [item?.sub_stat_name_2, item?.sub_stat_level_2],
        ].flatMap(([label, level]) => availableText(label) && nonnegativeInt(level) !== null ? [{ label: label.trim(), level }] : []);
        return stats.length ? [{ slot: index + 1, grade: nonnegativeInt(item.stat_grade), stats }] : [];
    }));
}

const detailFields = {
    progression: [
        ["symbols", "character/symbol-equipment", readSymbols],
        ["dojang", "character/dojang", readDojang],
        ["union", "user/union", readUnion],
    ],
    hexa: [
        ["cores", "character/hexamatrix", readHexaCores],
        ["stats", "character/hexamatrix-stat", readHexaStats],
    ],
};

async function fetchDetails(ocid, apiKey, view) {
    const fields = detailFields[view];
    const results = await Promise.allSettled(fields.map(([, path]) => lookup(path, "ocid", ocid, apiKey)));
    if (!results.some((result) => result.status === "fulfilled" && result.value.response.ok)) {
        const limited = results.some((result) => result.status === "fulfilled" && result.value.response.status === 429);
        return limited ? fail(429, "RATE_LIMITED") : fail(502, "NEXON_UNAVAILABLE");
    }
    const data = Object.fromEntries(fields.map(([field, , parse], index) => {
        const result = results[index];
        const value = result.status === "fulfilled" && result.value.response.ok ? parse(result.value.data) : null;
        return [field, value];
    }));
    const complete = Object.values(data).every((value) => value !== null);
    return Response.json({ ...data, fetchedAt: Date.now() }, { headers: {
        "Cache-Control": complete ? "public, max-age=120, s-maxage=600" : "public, max-age=30, s-maxage=60",
        [cacheHeader]: "MISS",
    } });
}

async function fetchOverview(ocid, apiKey, view) {
    const gear = view === "equipment";
    const paths = ["character/basic", "character/stat"];
    if (gear) paths.push("character/item-equipment", "character/set-effect");
    const results = await Promise.allSettled(paths.map((path) => lookup(path, "ocid", ocid, apiKey)));
    const [basic, stat, equipment, sets] = results.map((result) =>
        result.status === "fulfilled" && result.value.response.ok ? result.value.data : null);
    const profile = basicProfile(basic);
    if (!profile) return results[0].status === "fulfilled" && results[0].value.response.status === 429
        ? fail(429, "RATE_LIMITED") : fail(502, "NEXON_UNAVAILABLE");

    const data = {
        profile: { ...profile, guild: basic.character_guild_name || null, expRate: experienceRate(basic.character_exp_rate) },
        stats: readStats(stat),
        fetchedAt: Date.now(),
    };
    let complete = data.stats !== null;
    if (gear) {
        data.cooldown = readCooldown(stat, equipment);
        data.equipped = equipmentItems(equipment?.item_equipment);
        data.activePreset = Number(equipment?.preset_no) || null;
        data.presets = [1, 2, 3].flatMap((number) => {
            const items = equipmentItems(equipment?.["item_equipment_preset_" + number]);
            return items ? [{ number, items }] : [];
        });
        data.sets = setEffects(sets);
        complete &&= data.equipped !== null && data.sets !== null;
    }
    return Response.json(data, { headers: {
        "Cache-Control": complete ? "public, max-age=120, s-maxage=600" : "no-store",
        [cacheHeader]: "MISS",
    } });
}

async function fetchCooldown(ocid, apiKey) {
    const queries = ["character/stat", "character/item-equipment"];
    const results = await Promise.allSettled(queries.map((path) => lookup(path, "ocid", ocid, apiKey)));
    const [stats, equipment] = results.map((result) => result.status === "fulfilled" && result.value.response.ok ? result.value.data : null);
    const cooldown = readCooldown(stats, equipment);
    if (cooldown.fixedSeconds === null && cooldown.percent === null) {
        const limited = results.some((result) => result.status === "fulfilled" && result.value.response.status === 429);
        return limited ? fail(429, "RATE_LIMITED") : fail(502, "NEXON_UNAVAILABLE");
    }
    const complete = cooldown.fixedSource === "stat" && cooldown.percent !== null && equipment;
    return Response.json(cooldown, { headers: {
        "Cache-Control": complete ? "public, max-age=120, s-maxage=600" : "no-store",
        [cacheHeader]: "MISS",
    } });
}

async function fetchCharacter(nickname, apiKey, view, now) {
    try {
        const id = await lookup("id", "character_name", nickname, apiKey);
        if (id.response.status === 429) return fail(429, "RATE_LIMITED");
        if (!id.response.ok) {
            if (id.response.status === 404 || ["OPENAPI00003", "OPENAPI00004"].includes(id.data?.error?.name)) {
                return fail(404, "CHARACTER_NOT_FOUND");
            }
            return fail(502, "NEXON_UNAVAILABLE");
        }
        if (typeof id.data?.ocid !== "string" || !id.data.ocid) return fail(404, "CHARACTER_NOT_FOUND");
        if (view === "cooldown") return await fetchCooldown(id.data.ocid, apiKey);
        if (view === "growth") return await fetchGrowth(id.data.ocid, apiKey, now);
        if (Object.hasOwn(detailFields, view)) return await fetchDetails(id.data.ocid, apiKey, view);
        if (view === "summary" || view === "equipment") return await fetchOverview(id.data.ocid, apiKey, view);

        const { response, data } = await lookup("character/basic", "ocid", id.data.ocid, apiKey);
        if (response.status === 429) return fail(429, "RATE_LIMITED");
        const profile = basicProfile(data);
        if (!response.ok || !profile) return fail(502, "NEXON_UNAVAILABLE");
        return Response.json(profile, { headers: { "Cache-Control": "public, max-age=120, s-maxage=600", [cacheHeader]: "MISS" } });
    } catch {
        return fail(502, "NEXON_UNAVAILABLE");
    }
}

export async function onRequestGet(context) {
    const { request, env } = context;
    const query = new URL(request.url).searchParams;
    const nickname = query.get("name")?.trim();
    const include = query.get("include");
    const view = ["cooldown", "summary", "equipment", "growth"].includes(include) || Object.hasOwn(detailFields, include)
        ? include : "character";
    if (!nickname || !/^[\p{L}\p{N}]{1,12}$/u.test(nickname)) return fail(400, "INVALID_NICKNAME");
    if (!env.MAPLE_NEXON_API_KEY) return fail(503, "KEY_NOT_CONFIGURED");

    const service = view === "summary" ? "maple-summary-v2" : "maple-" + view;
    const now = Date.now();
    const cacheQuery = { nickname };
    if (view === "growth") {
        cacheQuery.day = mapleDay(now);
        cacheQuery.lastPublishedDay = lastGrowthDate(now);
    }
    const cacheKey = await publicCacheKey(request.url, service, cacheQuery);
    const cached = await readPublicResponse(cacheKey, cacheHeader);
    if (cached) return cached;
    const pendingKey = service + ":" + JSON.stringify(cacheQuery);
    if (!pending.has(pendingKey)) {
        pending.set(pendingKey, fetchCharacter(nickname, env.MAPLE_NEXON_API_KEY, view, now).then(async (response) => {
            await storePublicResponse(context, cacheKey, response);
            return { headers: response.headers, status: response.status, body: await response.text() };
        }).finally(() => pending.delete(pendingKey)));
    }
    const result = await pending.get(pendingKey);
    return new Response(result.body, { status: result.status, headers: result.headers });
}

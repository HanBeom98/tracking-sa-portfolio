import { requestJson } from "../../src/domains/shared/http-request.js";
import { publicCacheKey, readPublicResponse, storePublicResponse } from "../infra/public-response-cache.js";

const base = "https://open.api.nexon.com/maplestory/v1/";
const cacheHeader = "X-Maple-News-Cache";
let snapshot;
let pending;

function officialUrl(value) {
    try {
        const url = new URL(value);
        return url.origin === "https://maplestory.nexon.com" && /^\/news\//i.test(url.pathname) ? url.href : null;
    } catch {
        return null;
    }
}

function noticeTime(value) {
    if (typeof value !== "string") return null;
    const timestamp = Date.parse(/(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(value) ? value : value + "+09:00");
    return Number.isFinite(timestamp) ? timestamp : null;
}

function normalize(items) {
    if (!Array.isArray(items)) return null;
    return items.flatMap((item) => {
        const url = officialUrl(item?.url);
        const title = typeof item?.title === "string" ? item.title.trim() : "";
        return title && url ? [{
            title, url, published: noticeTime(item.date),
            startsAt: noticeTime(item.date_event_start),
            endsAt: noticeTime(item.date_event_end),
        }] : [];
    });
}

async function list(path, field, key) {
    try {
        const { response, data } = await requestJson(new URL(path, base), {
            headers: { accept: "application/json", "x-nxopen-api-key": key },
            redirect: "manual",
        }, { timeoutMs: 4500 });
        return response.ok ? normalize(data?.[field]) : null;
    } catch {
        return null;
    }
}

async function collect(key) {
    const [announcements, events] = await Promise.all([
        list("notice", "notice", key), list("notice-event", "event_notice", key),
    ]);
    const now = Date.now();
    const result = {
        notices: announcements?.sort((a, b) => b.published - a.published).slice(0, 4) ?? null,
        events: events?.filter(({ startsAt, endsAt }) => Number.isFinite(startsAt) && startsAt <= now && endsAt > now)
            .sort((a, b) => a.endsAt - b.endsAt).slice(0, 5) ?? null,
    };
    const complete = result.events !== null && result.notices !== null;
    return {
        body: result,
        status: result.events === null && result.notices === null ? 502 : 200,
        cache: complete ? "public, max-age=120, s-maxage=900" : "no-store",
        expiresAt: now + (complete ? 900_000 : 60_000),
    };
}

function respond(result, cache) {
    return Response.json(result.body, { status: result.status, headers: { "Cache-Control": result.cache, [cacheHeader]: cache } });
}

export async function onRequestGet(context) {
    const key = context.env.MAPLE_NEXON_API_KEY;
    if (!key) return Response.json({ error: "KEY_NOT_CONFIGURED" }, { status: 503, headers: { "Cache-Control": "no-store" } });
    const cacheKey = await publicCacheKey(context.request.url, "maple-news");
    const cached = await readPublicResponse(cacheKey, cacheHeader);
    if (cached) return cached;
    if (snapshot?.expiresAt > Date.now()) return respond(snapshot, "HIT");
    pending ??= collect(key).then(async (result) => {
        snapshot = result;
        await storePublicResponse(context, cacheKey, respond(result, "MISS"));
        return result;
    }).finally(() => { pending = null; });
    return respond(await pending, "MISS");
}

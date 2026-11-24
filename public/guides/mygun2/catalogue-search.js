export function normalizeSearch(value) {
    return String(value || '').normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/[^\p{L}\p{N}]+/gu, '');
}

export function matchingGuns(item, { query = '', weapon = '' } = {}) {
    const seriesNames = normalizeSearch(`${item.name} ${item.english}`);
    const gunWords = query.trim().split(/\s+/).map(normalizeSearch).filter(word =>
        word && !seriesNames.includes(word) && item.guns.some(gun => normalizeSearch(gun.name).includes(word)));
    return item.guns.filter(gun => (!weapon || gun.base === weapon) &&
        gunWords.every(word => normalizeSearch(gun.name).includes(word)));
}

export function filterCatalogue(items, { query = '', category = '', weapon = '' } = {}) {
    const words = query.trim().split(/\s+/).map(normalizeSearch).filter(Boolean);
    return items.filter(item => {
        if (category && item.category !== category) return false;
        if (!matchingGuns(item, {query, weapon}).length) return false;
        const index = normalizeSearch([item.name, item.english, item.tagline, item.category, item.trigger,
            item.triggerDetail, item.effect, item.persistence, item.note, ...item.guns.map(gun => gun.name)].join(' '));
        return words.every(word => index.includes(word));
    });
}

export function toggleComparison(ids, id, validIds, limit = 3) {
    if (!validIds.has(id)) return ids;
    if (ids.includes(id)) return ids.filter(value => value !== id);
    return ids.length < limit ? [...ids, id] : ids;
}

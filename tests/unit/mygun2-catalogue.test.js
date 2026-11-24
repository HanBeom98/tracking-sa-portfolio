import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {catalogue} from '../../src/domains/guides/mygun2/catalog.js';
import {filterCatalogue, matchingGuns, normalizeSearch, toggleComparison} from '../../src/domains/guides/mygun2/catalogue-search.js';

test('official catalogue relationships have unique series, valid sources and real local images', () => {
    assert.equal(new Set(catalogue.map(s => s.id)).size, catalogue.length);
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/domains/guides/mygun2');
    for (const series of catalogue) {
        assert.match(series.id, /^[a-z]+$/);
        assert.equal(new URL(series.source).origin, 'https://guide.sa.nexon.com');
        assert.ok(series.guns.length && series.levels.length && series.sets.length);
        for (const gun of series.guns) {
            assert.match(gun.image, /^images\/[a-z]+-\d{2}\.webp$/);
            assert.ok(gun.name && gun.base && gun.width > 0 && gun.height > 0);
            assert.ok(['https://img.sa.nexon.com', 'https://img-sa-file.nexon.com'].includes(new URL(gun.sourceImage).origin));
            const bytes = fs.readFileSync(path.join(root, gun.image));
            assert.equal(bytes.subarray(0,4).toString(), 'RIFF');
            assert.equal(bytes.subarray(8,12).toString(), 'WEBP');
        }
    }
    assert.ok(catalogue.find(s => s.id === 'circle').guns.some(g => g.name.includes('Black')));
    assert.ok(catalogue.find(s => s.id === 'xeno').levels.some(r => r.benefit.includes('G18')));
    assert.ok(catalogue.find(s => s.id === 'evil').sets.filter(r => r.count === '3').length > 1, 'rowspan rewards retain their shared group requirement');
});

test('search combines real weapon spelling, series aliases, function words and independent filters', () => {
    assert.equal(normalizeSearch('ＧＡＬ-１_v2 (IS)'), normalizeSearch('gal1 v2is'));
    assert.deepEqual(filterCatalogue(catalogue, {query:'EON 스택'}).map(s=>s.id), ['eon']);
    assert.ok(filterCatalogue(catalogue, {query:'GAL-1_v2'}).every(s=>s.guns.some(g=>g.name.includes('GAL-1_v2'))));
    assert.deepEqual(filterCatalogue(catalogue, {category:'특수 공격',weapon:'AWP'}).map(s=>s.id), ['hunt','nova','royal']);
    assert.ok(filterCatalogue(catalogue, {weapon:'VS-9'}).some(s=>s.id==='evo'), 'series suffixes must not split the same base weapon into separate filter options');
    assert.ok(filterCatalogue(catalogue, {weapon:'TAC-9'}).some(s=>s.id==='evo'));
    assert.deepEqual(filterCatalogue(catalogue, {query:'없는총기이름'}), []);
    assert.deepEqual(filterCatalogue(catalogue, {query:'제노',category:'모드 전환'}), []);
});

test('all 45 set rewards retain separate official images and valid original PNG dimensions', () => {
    const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/domains/guides/mygun2');
    const rewards=catalogue.flatMap(series=>series.sets);
    assert.equal(rewards.length,45);
    assert.equal(new Set(rewards.map(row=>row.image)).size,45);
    for(const series of catalogue) for(const [index,reward] of series.sets.entries()) {
        assert.equal(reward.image,`images/rewards/${series.id}-${String(index+1).padStart(2,'0')}.png`);
        assert.equal(new URL(reward.sourceImage).origin,'https://img.sa.nexon.com');
        const bytes=fs.readFileSync(path.join(root,reward.image));
        assert.deepEqual([...bytes.subarray(0,8)],[137,80,78,71,13,10,26,10]);
        assert.equal(bytes.readUInt32BE(16),reward.width);
        assert.equal(bytes.readUInt32BE(20),reward.height);
        assert.ok(reward.width>0 && reward.height>0);
        const bounds=reward.imageBounds;
        assert.ok(Object.values(bounds).every(Number.isInteger));
        assert.ok(bounds.x>=0 && bounds.y>=0 && bounds.width>0 && bounds.height>0);
        assert.ok(bounds.x+bounds.width<=reward.width && bounds.y+bounds.height<=reward.height);
    }
    const evil=catalogue.find(series=>series.id==='evil');
    const sharedTier=evil.sets.filter(row=>row.count==='3');
    assert.equal(sharedTier.length,2);
    assert.notEqual(sharedTier[0].image,sharedTier[1].image,'rewards sharing a tier keep their own image');
});

test('comparison selection survives filtering and rejects a fourth or unknown series', () => {
    const valid = new Set(catalogue.map(s=>s.id));
    let ids = ['eon','evo'];
    ids = toggleComparison(ids, 'circle', valid);
    assert.deepEqual(toggleComparison(ids, 'hunt', valid), ids);
    assert.deepEqual(toggleComparison(ids, '<unknown>', valid), ids);
    filterCatalogue(catalogue, {query:'로얄'});
    assert.deepEqual(ids,['eon','evo','circle']);
    assert.deepEqual(toggleComparison(ids, 'evo', valid), ['eon','circle']);
});

test('search card guns match weapon queries and filters rather than the first series image', () => {
    const eon = catalogue.find(s=>s.id==='eon');
    assert.equal(matchingGuns(eon)[0], eon.guns[0]);
    for (const query of ['awp', 'ＡＷＰ', '이온 awp', 'EON AWP 스택']) {
        assert.deepEqual(matchingGuns(eon,{query}).map(g=>g.base), ['AWP']);
    }
    for (const series of filterCatalogue(catalogue,{weapon:'AWP'})) {
        assert.ok(matchingGuns(series,{weapon:'AWP'}).every(g=>g.base==='AWP'));
    }
    assert.deepEqual(matchingGuns(eon,{query:'AWP',weapon:'GAL-1_v2'}), []);
    assert.deepEqual(filterCatalogue(catalogue,{query:'AWP',weapon:'GAL-1_v2'}), []);
    const circle = catalogue.find(s=>s.id==='circle');
    assert.ok(matchingGuns(circle,{query:'ANR Black'}).length);
    assert.ok(matchingGuns(circle,{query:'ANR Black'}).every(g=>g.base==='ANR' && g.name.includes('Black')));
    assert.deepEqual(matchingGuns(circle,{query:'AWP Black'}), [], 'the catalogue has no Circle Black AWP image');
});

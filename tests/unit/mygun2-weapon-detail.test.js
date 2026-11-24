import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogue} from '../../src/domains/guides/mygun2/catalog.js';
import {baseWeaponSpecs} from '../../src/domains/guides/mygun2/weapon-specs.js';
import {weaponReferences,weaponHighlights,mygunAmmo} from '../../src/domains/guides/mygun2/weapon-detail.js';

test('base weapon reference data retains its source type and zero display indices', () => {
    assert.equal(Object.keys(baseWeaponSpecs).length,38);
    for(const spec of Object.values(baseWeaponSpecs)) {
        if(spec.sourceType === 'in-game') {
            assert.match(spec.sourceLabel,/사용자 제공 인게임 화면/);
            assert.match(spec.sourceSha256,/^[a-f0-9]{64}$/);
            assert.equal(spec.source,undefined);
        } else assert.match(spec.source,/^https:\/\/guide\.sa\.nexon\.com\/guide\/39#toc-\d+$/);
        assert.match(spec.checkedAt,/^\d{4}-\d{2}-\d{2}$/);
        assert.match(spec.ammo,/^\d+(?:\/\d+)?발$/);
        for(const key of ['damage','fireRate','accuracy','recoil']) assert.ok(Number.isInteger(spec[key]) && spec[key]>=0 && spec[key]<=100);
    }
    assert.equal(baseWeaponSpecs.TRG21.fireRate,0);
    assert.deepEqual(weaponReferences({base:'SG870_v3',name:'unknown variant'}),[]);
});

test('AWP and Specter skins use their shared in-game-confirmed base stats', () => {
    const values = base => ['damage','fireRate','accuracy','recoil','ammo'].map(key=>baseWeaponSpecs[base][key]);
    assert.deepEqual(values('AWP'),[100,0,100,85,'5발']);
    assert.deepEqual(values('Specter'),[31,84,88,34,'30/120발']);
    for(const series of catalogue) for(const gun of series.guns.filter(g=>['AWP','Specter'].includes(g.base))) {
        assert.deepEqual(weaponReferences(gun),[baseWeaponSpecs[gun.base]]);
    }
    assert.doesNotMatch(baseWeaponSpecs.AWP.ammo,/무한/);
});

test('eight additional in-game weapons keep transcribed stats and common skin matching', () => {
    const expected={
        'VS-9':[28,75,77,44,'12/48발'],TSR:[100,0,100,85,'5/20발'],
        TAS:[52,66,88,78,'30/120발'],'TAC-9':[23,84,53,69,'15/60발'],
        SCAR_v2:[39,84,84,55,'30/120발'],Peacemaker:[36,65,67,65,'8/48발'],
        PPS:[37,61,67,52,'9/54발'],P90_v2:[34,94,76,47,'50/150발'],
    };
    for(const [base,values] of Object.entries(expected)) {
        assert.deepEqual(['damage','fireRate','accuracy','recoil','ammo'].map(key=>baseWeaponSpecs[base][key]),values);
        const guns=catalogue.flatMap(s=>s.guns).filter(g=>g.base===base);
        assert.ok(guns.length);
        for(const gun of guns) assert.deepEqual(weaponReferences(gun),[baseWeaponSpecs[base]]);
    }
    assert.match(baseWeaponSpecs.TAS.modeNote,/기본 모드 기준/);
});

test('reference matching keeps Light and Heavy distinct, including an image representing both', () => {
    const ref = name => weaponReferences({base:'AK47',name}).map(spec=>spec.name);
    assert.deepEqual(ref('[M]AK47(IK) Light Eon'),['AK-47 Light']);
    assert.deepEqual(ref('[M]AK47(IK) Heavy Eon'),['AK-47 Heavy']);
    assert.deepEqual(ref('[M]AK47 Light Nova / [M]AK47 Heavy Nova'),['AK-47 Light','AK-47 Heavy']);
    assert.deepEqual(ref('[M]AK47 Circle'),['AK-47']);
    assert.equal(weaponReferences({base:'M4A1',name:'[M]M4A1 Marble'})[0].name,'M4A1 Carbine');
});

test('eleven supplied weapons preserve original screenshot values and raw source ammo', () => {
    const expected={
        'NA-34':[41,76,84,70,'30발'],'Mak-12':[31,70,70,51,'28발'],
        'MSR-200':[100,0,100,85,'5발'],'MP-X3':[30,61,61,29,'30/150발'],
        HK416_v2:[41,76,87,64,'30발'],'GSR-6':[99,40,100,50,'5/25발'],
        'GAL-1_v2':[44,80,87,79,'35발'],G18:[26,51,51,37,'12/48발'],
        'DSG-12':[80,12,48,93,'14/56발'],'DRT-6':[40,80,87,70,'30발'],ANR:[38,86,86,53,'30/120발'],
    };
    for(const [base,values] of Object.entries(expected)) {
        const spec=baseWeaponSpecs[base];
        assert.deepEqual(['damage','fireRate','accuracy','recoil','ammo'].map(key=>spec[key]),values);
        assert.doesNotMatch(spec.ammo,/무한/);
        const guns=catalogue.flatMap(s=>s.guns).filter(g=>g.base===base);
        assert.ok(guns.length);
        for(const gun of guns) assert.deepEqual(weaponReferences(gun),[spec]);
    }
    const unknown=catalogue.flatMap(s=>s.guns).filter(g=>!weaponReferences(g).length);
    assert.equal(unknown.length,0);
});

test('all 151 entries have base stats and every Mygun2 reserve is infinite without changing its magazine', () => {
    assert.deepEqual(['damage','fireRate','accuracy','recoil','ammo'].map(key=>baseWeaponSpecs.XM68[key]),[65,53,88,80,'20/80발']);
    const guns=catalogue.flatMap(s=>s.guns);
    assert.equal(guns.length,151);
    for(const gun of guns) {
        const specs=weaponReferences(gun);
        assert.ok(specs.length);
        for(const spec of specs) assert.match(mygunAmmo(spec),/^\d+발 \/ 무한$/);
    }
    assert.equal(mygunAmmo(baseWeaponSpecs.XM68),'20발 / 무한');
    assert.equal(mygunAmmo(baseWeaponSpecs.AWP),'5발 / 무한');
    assert.equal(mygunAmmo(baseWeaponSpecs.P90_v2),'50발 / 무한');
    assert.equal(baseWeaponSpecs.XM68.ammo,'20/80발','original source ammo is preserved');
    assert.equal(mygunAmmo({ammo:'unknown'}),'미확인 / 무한');
});

test('weapon-specific notes keep evolution, reload thresholds and exceptions scoped to the selected gun', () => {
    const series = id=>catalogue.find(s=>s.id===id);
    const notes=(id,base)=>weaponHighlights(series(id),series(id).guns.find(g=>g.base===base)).join(' ');
    assert.match(notes('evo','AWP'),/2단계 진화.*\+1/);
    assert.match(notes('evo','GAL-1_v2'),/2단계 진화.*\+2/);
    assert.match(notes('circle','P90_v2'),/25발 이하/);
    assert.match(notes('circle','AWP'),/3발 이하/);
    assert.match(notes('marble','G18'),/G18 예외.*\+3/);
    assert.match(notes('marble','윈체스터'),/윈체스터 예외/);
    assert.doesNotMatch(notes('marble','AWP'),/G18 예외|윈체스터 예외/);
    assert.match(notes('noble','AWP'),/개조 대상/);
});

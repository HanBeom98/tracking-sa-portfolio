import { baseWeaponSpecs } from './weapon-specs.js';

export function mygunAmmo(spec) {
    const magazine = /^(\d+)(?:\/\d+)?발$/.exec(spec.ammo)?.[1];
    return `${magazine ? magazine+'발' : '미확인'} / 무한`;
}

export function weaponReferences(gun) {
    if (gun.base === 'AK47') {
        const variants = ['Light', 'Heavy'].filter(name => gun.name.includes(name));
        if (variants.length) return variants.map(name => baseWeaponSpecs[`AK47 ${name}`]);
    }
    return baseWeaponSpecs[gun.base] ? [baseWeaponSpecs[gun.base]] : [];
}

export function weaponHighlights(series, gun) {
    const notes = [];
    if (series.id === 'evo') {
        const one = ['AWP', 'MSR-200', 'SG870_v2'];
        const two = ['GAL-1_v2', 'TAC-9', 'Specter', 'VS-9', 'XM68', 'DRT-6', 'DSG-12', 'SCAR_v2', 'HK416_v2'];
        const extra = one.includes(gun.base) ? 1 : two.includes(gun.base) || (gun.base === 'AK47' && gun.name.includes('Light')) ? 2 : null;
        if (extra !== null) notes.push(`Lv.40 이상 · 2단계 진화 시 이 총기의 장탄수 +${extra}`);
    }
    if (series.id === 'circle') {
        const thresholds = {P90_v2:25,ANR:15,'MP-X3':15,AK47:15,MP7:15,'DRT-6':15,SCAR_v2:15,XM68:10,'VS-9':6,AWP:3,TSR:3,'MSR-200':3};
        const threshold = thresholds[gun.base];
        if (threshold !== undefined) notes.push(`Lv.40 이상 · 이 총기의 잔탄이 ${threshold}발 이하일 때 서클장전 조건 충족`);
    }
    const benefits = series.levels.map(row => row.benefit).join(' ');
    if (gun.base === '윈체스터' && benefits.includes('윈체스터는 재장전 시간만 단축')) {
        notes.push('윈체스터 예외: 교체·재장전 단축 혜택 중 재장전 시간만 단축');
    }
    if (gun.base === 'G18' && benefits.includes('G18은 장탄수 +3으로 대체')) {
        notes.push('G18 예외: 교체·재장전 단축 대신 장탄수 +3 적용');
    }
    if (series.id === 'noble') notes.push('기본 Lv.1~50 기준 · 개조 대상·확장 레벨 혜택은 별도로 확인하세요.');
    return notes;
}

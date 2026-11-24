import { catalogue } from './catalog.js';
import { filterCatalogue, matchingGuns, toggleComparison } from './catalogue-search.js';
import { weaponReferences, weaponHighlights, mygunAmmo } from './weapon-detail.js';

const $ = selector => document.querySelector(selector);
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const byId = new Map(catalogue.map(item => [item.id, item]));
const validIds = new Set(byId.keys());
const image = (gun, eager = false) => `<img src="${escape(gun.image)}" width="${gun.width}" height="${gun.height}" alt="${escape(gun.name)} 공식 총기 대표 외형" loading="${eager ? 'eager' : 'lazy'}" decoding="async">`;
const specMetrics = [['대미지','damage'],['연사력','fireRate'],['명중률','accuracy'],['총기반동','recoil']];

function renderSetRewards(series, label) {
    const cards = series.sets.map(row=>{
        const bounds = row.imageBounds;
        const cropStyle = `--crop-ratio:${bounds.width/bounds.height};--image-width:${row.width/bounds.width*100}%;--image-height:${row.height/bounds.height*100}%;--image-left:${-bounds.x/bounds.width*100}%;--image-top:${-bounds.y/bounds.height*100}%`;
        return `<article class="mg-set-reward"><div class="mg-set-reward-top"><div class="mg-set-reward-art"><span class="mg-set-reward-crop" style="${cropStyle}"><img src="${escape(row.image)}" width="${row.width}" height="${row.height}" alt="" loading="lazy" decoding="async"></span></div><div><span class="mg-set-badge">${escape(row.count)}세트 효과</span><h4>${escape(row.reward)}</h4></div></div><ul class="mg-set-effects">${row.effect.split(/\s*[·ㆍ]\s*/).filter(Boolean).map(effect=>`<li>${escape(effect)}</li>`).join('')}</ul></article>`;
    }).join('');
    return `<div class="mg-set-rewards" role="region" aria-label="${escape(label)}">${cards}</div>`;
}

function renderBaseSpecs(references) {
    const cards = references.map(spec => `<div class="mg-base-spec"><h4>${escape(spec.name)} <small>· ${escape(spec.category)}</small></h4><dl class="mg-spec-grid">${specMetrics.map(([label,key])=>`<div class="mg-stat" data-stat="${key}"><dt>${label}</dt><dd>${spec[key]}</dd><span class="mg-stat-track" aria-hidden="true"><span style="width:${spec[key]}%"></span></span></div>`).join('')}<div class="mg-ammo"><dt>장전 / 예비</dt><dd>${escape(mygunAmmo(spec))}</dd></div></dl>${spec.modeNote ? `<p class="mg-mode-note">${escape(spec.modeNote)}</p>` : ''}</div>`).join('');
    const content = references.length
        ? cards
        : `<p class="mg-spec-unavailable">기본 성능 준비 중</p><dl class="mg-spec-grid">${[...specMetrics.map(([label])=>[label,'미확인']),['장전 / 예비','미확인 / 무한']].map(([label,value])=>`<div><dt>${label}</dt><dd class="mg-spec-unknown">${value}</dd></div>`).join('')}</dl>`;
    return `<section class="mg-weapon-stats" aria-labelledby="mg-weapon-spec-heading"><div class="mg-weapon-section-label"><h3 id="mg-weapon-spec-heading">기본 성능</h3><span>레벨·진화 효과 별도</span></div>${content}</section>`;
}

// Short display copy keeps provenance in the data and maintenance records.
const weaponDisplayCopy = {
    evo: {note:'진화 상태와 초과 스택은 같은 에보 시리즈끼리 공유합니다. 장탄수 증가는 총기별로 다릅니다.'},
    nova: {persistence:'사용 횟수 제한 미확인',note:'특수 근접무기의 세부 성능과 사용 횟수는 별도 확인이 필요합니다.'},
    evil: {triggerDetail:'Lv.1부터 특수모션을 사용할 수 있습니다.'},
    marble: {note:'윈체스터·G18 등의 예외는 레벨 표에서 확인하세요. 별도 특수 공격은 안내되지 않았습니다.'},
    noble: {note:'개조는 대상 총기에만 적용됩니다. 개조 대상·재료·확장 레벨을 먼저 확인하세요.'},
};

function renderWeaponFeature(series, highlights) {
    const copy = {...series, ...weaponDisplayCopy[series.id]};
    return `<section class="mg-weapon-section mg-weapon-feature" aria-labelledby="mg-weapon-feature-heading">
      <div class="mg-weapon-section-label"><h3 id="mg-weapon-feature-heading">${escape(series.name)} 시리즈 기능</h3><span>Lv.${series.minLevel}${series.id === 'evil' ? ' 모션' : '부터'}</span></div>
      <p class="mg-weapon-effect">${escape(copy.effect)}</p>
      <dl class="mg-weapon-functions"><div><dt><span aria-hidden="true">01</span> 발동 조건</dt><dd>${escape(copy.trigger)}</dd></div><div><dt><span aria-hidden="true">02</span> 유지·재사용</dt><dd>${escape(copy.persistence)}</dd></div></dl>
      ${highlights.length ? `<div class="mg-weapon-special"><span class="mg-weapon-special-label">이 총기의 추가 효과</span><ul class="mg-weapon-highlights">${highlights.map(note=>`<li>${escape(note)}</li>`).join('')}</ul></div>` : ''}
      <details class="mg-weapon-extra"><summary>발동 상세·주의사항</summary><div class="mg-weapon-extra-body"><p>${escape(copy.triggerDetail)}</p><p>${escape(copy.note)}</p><p>성능 게이지는 0~100 표기 수치입니다. 실제 피해량·명중 확률을 뜻하지 않으며, 반동은 클수록 강합니다. 장전 수는 기본값이며 레벨·진화 추가 효과는 별도로 적용됩니다.</p></div></details>
      <details class="mg-weapon-extra"><summary>레벨별 혜택·총기별 예외</summary><div class="mg-weapon-extra-body"><div class="mg-table-scroll" tabindex="0" role="region" aria-label="무기 상세 레벨별 혜택"><table><thead><tr><th scope="col">레벨</th><th scope="col">경험치</th><th scope="col">혜택·예외</th></tr></thead><tbody>${series.levels.map(row=>`<tr><th scope="row">Lv.${escape(row.level)}</th><td>${escape(row.experience)}</td><td>${escape(row.benefit)}</td></tr>`).join('')}</tbody></table></div></div></details>
      <details class="mg-weapon-extra"><summary>세트 효과</summary><div class="mg-weapon-extra-body"><p>같은 세트 대상의 변형은 중복으로 세지 않습니다. 기본 세트 보상은 Lv.50이며 킬 기록이 적용되지 않습니다.</p>${renderSetRewards(series,'무기 상세 세트 효과')}</div></details>
    </section>`;
}
let selected = [];
let lastDetailLink;
const query = $('#mg-query'), feature = $('#mg-feature'), weapon = $('#mg-weapon');
for (const category of new Set(catalogue.map(item => item.category))) feature.add(new Option(category, category));
for (const name of [...new Set(catalogue.flatMap(item => item.guns.map(gun => gun.base)))].sort()) weapon.add(new Option(name, name));
for (const control of [query, feature, weapon]) control.disabled = false;

function updateSelection() {
    $('#mg-tray').hidden = selected.length === 0;
    $('#mg-selection').textContent = `${selected.map(id => byId.get(id).name).join(' · ')} (${selected.length}/3)`;
    $('#mg-compare').disabled = selected.length < 2;
    document.querySelectorAll('[data-compare]').forEach(input => {
        input.checked = selected.includes(input.dataset.compare);
        input.disabled = selected.length === 3 && !input.checked;
    });
}

function renderCards() {
    const filtered = filterCatalogue(catalogue, {query: query.value, category: feature.value, weapon: weapon.value});
    $('#mg-count').textContent = `${filtered.length}개 시리즈 / 전체 ${catalogue.length}개 · 비교할 시리즈를 2~3개 선택하세요.`;
    $('#mg-empty').hidden = filtered.length > 0;
    $('#mg-cards').innerHTML = filtered.map(item => {
        const gun = matchingGuns(item, {query: query.value, weapon: weapon.value})[0];
        return `<article class="mg-card" style="--series-color:${item.color}">
      <button class="mg-card-visual" type="button" data-gun="${item.guns.indexOf(gun)}" data-series="${item.id}" aria-label="${escape(gun.name)} 스펙·기능 보기"><span class="mg-category">${escape(item.category)}</span>${image(gun)}<span class="mg-card-gun">${escape(gun.name)}</span><span class="mg-card-spec-link">스펙·기능 보기 ↗</span></button>
      <div class="mg-card-body"><h3>${escape(item.name)}<small>${item.english}</small></h3><p>${escape(item.tagline)}</p>
      <div class="mg-trigger"><span>${item.category === '외형·기본 성장' ? '확인할 조건' : '핵심 발동 조건'} · Lv.${item.minLevel}${item.id === 'evil' ? ' 모션' : '부터'}</span><b>${escape(item.trigger)}</b></div>
      <p>총기 이미지 ${item.guns.length}개 · 기본 레벨·세트 안내</p>
      <div class="mg-card-actions"><a class="mg-detail-link" href="#${item.id}" data-detail="${item.id}">${escape(item.name)} 자세히 ↗</a><label><input type="checkbox" data-compare="${item.id}" aria-label="${escape(item.name)} 비교에 추가">비교</label></div></div></article>`;
    }).join('');
    updateSelection();
}

function showDetail(id, scroll = true) {
    const item = byId.get(id);
    const panel = $('#mg-detail');
    if (!item) { panel.hidden = true; return; }
    panel.hidden = false;
    panel.innerHTML = `<div class="mg-detail-top"><div><p class="mg-eyebrow">${item.english.toUpperCase()} · SERIES GUIDE</p><h2 id="mg-detail-title" tabindex="-1">${item.name} 마이건2</h2><p>${escape(item.tagline)}</p></div><button type="button" class="mg-button" data-detail-close>상세 닫기</button></div>
      <dl class="mg-facts"><div><dt>핵심 적용 레벨</dt><dd>Lv.${item.minLevel}${item.id === 'evil' ? '부터 특수모션' : '부터'}</dd></div><div><dt>발동 조건</dt><dd>${escape(item.trigger)}</dd></div><div><dt>유지·재사용</dt><dd>${escape(item.persistence)}</dd></div></dl>
      <p><strong>${escape(item.effect)}</strong></p><p>${escape(item.triggerDetail)}</p><p class="mg-note">${escape(item.note)}</p>
      <details open><summary>총기 이미지 · ${item.guns.length}개</summary><p>총기를 누르면 큰 이미지와 기본 성능 참고값·마이건2 기능을 확인할 수 있어요.</p><div class="mg-guns">${item.guns.map((gun,index) => `<button class="mg-gun" type="button" data-gun="${index}" data-series="${id}" aria-label="${escape(gun.name)} 스펙·기능 보기">${image(gun)}<span>${escape(gun.name)}</span><small>스펙·기능 보기 ↗</small></button>`).join('')}</div></details>
      <details><summary>기본 레벨별 혜택</summary><p>총기별 예외를 같은 행에서 확인하세요. 노블 개조 혜택은 이 기본 표와 별도입니다.</p><div class="mg-table-scroll" tabindex="0" role="region" aria-label="${item.name} 레벨별 혜택"><table><thead><tr><th scope="col">레벨</th><th scope="col">경험치</th><th scope="col">변경점·예외</th></tr></thead><tbody>${item.levels.map(row=>`<tr><th scope="row">Lv.${escape(row.level)}</th><td>${escape(row.experience)}</td><td>${escape(row.benefit)}</td></tr>`).join('')}</tbody></table></div></details>
      <details><summary>세트 보상과 기능</summary><p>공식 세트 구성의 활성화 기준입니다. 같은 세트 대상 총기의 변형은 중복으로 세지 않습니다. 기본 세트 보상은 Lv.50이며 킬 기록이 적용되지 않습니다.</p>${renderSetRewards(item,item.name+' 세트 보상')}<p>세트 보상의 경험치·반투명·외형별 차이는 공식 표를 함께 확인하세요.</p></details>
      <p><a href="${item.source}" target="_blank" rel="noopener noreferrer">${item.name} 공식 설명 확인 ↗</a> · 확인일 ${item.checkedAt}</p>`;
    if (scroll) { panel.scrollIntoView({behavior:'instant', block:'start'}); $('#mg-detail-title').focus({preventScroll:true}); }
}

function resetFilters() { query.value = ''; feature.value = ''; weapon.value = ''; renderCards(); query.focus(); }

function openWeaponDetail(button) {
    const series = byId.get(button.dataset.series);
    const gun = series?.guns[Number(button.dataset.gun)];
    if (!gun) return;
    const references = weaponReferences(gun);
    const highlights = weaponHighlights(series, gun);
    $('#mg-image-title').textContent = gun.base;
    $('#mg-image-dialog').style.setProperty('--series-color', series.color);
    $('#mg-weapon-content').innerHTML = `<div class="mg-weapon-overview"><div class="mg-weapon-visual"><div class="mg-weapon-tags"><span class="mg-weapon-series">${escape(series.name)} · ${escape(series.english)}</span><span>${escape(series.category)}</span><span>Lv.${series.minLevel}${series.id === 'evil' ? ' 모션' : '+'}</span></div><figure><img id="mg-large-image" src="${escape(gun.image)}" width="${gun.width}" height="${gun.height}" alt="${escape(gun.name)}"><figcaption>${escape(gun.name)}</figcaption></figure></div>${renderBaseSpecs(references)}</div>${renderWeaponFeature(series, highlights)}`;
    $('#mg-image-dialog').showModal();
    $('#mg-image-dialog').scrollTop = 0;
}

$('#mg-filters').addEventListener('submit', event => event.preventDefault());
$('#mg-filters').addEventListener('reset', event => { event.preventDefault(); resetFilters(); });
$('#mg-empty-reset').addEventListener('click', resetFilters);
query.addEventListener('input', renderCards);
feature.addEventListener('change', renderCards);
weapon.addEventListener('change', renderCards);
$('#mg-cards').addEventListener('change', event => {
    const id = event.target.dataset.compare;
    if (!id) return;
    selected = toggleComparison(selected, id, validIds);
    $('#mg-feedback').textContent = selected.length === 3 ? '3개를 선택했어요. 다른 시리즈를 추가하려면 하나를 해제하세요.' : '';
    updateSelection();
});
$('#mg-cards').addEventListener('click', event => {
    const gunButton = event.target.closest('[data-gun]');
    if (gunButton) { openWeaponDetail(gunButton); return; }
    const link = event.target.closest('[data-detail]');
    if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); lastDetailLink = link;
    history.replaceState(null, '', '#'+link.dataset.detail); showDetail(link.dataset.detail);
});
$('#mg-detail').addEventListener('click', event => {
    if (event.target.closest('[data-detail-close]')) {
        $('#mg-detail').hidden = true; history.replaceState(null,'',location.pathname+location.search);
        (lastDetailLink?.isConnected ? lastDetailLink : query).focus(); return;
    }
    const button = event.target.closest('[data-gun]');
    if (!button) return;
    openWeaponDetail(button);
});
$('#mg-clear').addEventListener('click', () => { selected = []; $('#mg-feedback').textContent = '비교 선택을 지웠어요.'; updateSelection(); query.focus({preventScroll:true}); });
$('#mg-compare').addEventListener('click', () => {
    if (selected.length < 2) return;
    const items = selected.map(id => byId.get(id));
    const rows = [['핵심 기능','effect'],['발동 조건','trigger'],['조건 상세','triggerDetail'],['유지·재사용','persistence'],['주의할 차이','note']];
    $('#mg-comparison').innerHTML = `<caption>선택한 ${items.length}개 마이건2 시리즈의 기능과 조건 비교</caption><thead><tr><th scope="col">비교 항목</th>${items.map(item=>`<th scope="col">${image(item.guns[0],true)}${item.name}<br><small>${item.english}</small></th>`).join('')}</tr></thead><tbody><tr><th scope="row">핵심 적용</th>${items.map(item=>`<td>Lv.${item.minLevel}${item.id === 'evil' ? ' 모션' : '부터'}</td>`).join('')}</tr>${rows.map(([label,key])=>`<tr><th scope="row">${label}</th>${items.map(item=>`<td>${escape(item[key])}</td>`).join('')}</tr>`).join('')}</tbody>`;
    $('#mg-compare-dialog').showModal();
});
for (const dialog of document.querySelectorAll('.mg-dialog,.mg-image-dialog')) dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
document.addEventListener('error', event => {
    if (event.target instanceof HTMLImageElement && event.target.closest('.mg-page,.mg-dialog,.mg-image-dialog')) {
        event.target.classList.add('mg-image-missing'); event.target.alt = '이미지를 불러오지 못했어요. '+event.target.alt;
    }
}, true);
window.addEventListener('hashchange', () => showDetail(location.hash.slice(1)));
renderCards();
if (validIds.has(location.hash.slice(1))) showDetail(location.hash.slice(1), false);

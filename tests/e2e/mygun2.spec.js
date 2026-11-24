import {test,expect} from '@playwright/test';

test.beforeEach(async ({context}) => {
    await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.origin !== 'http://127.0.0.1:4173' || url.pathname.startsWith('/api/')) return route.abort();
        return route.continue();
    });
});

test('home and navigation entries reach weapon search, filters and reset without an API', async ({page}) => {
    // Navigation is shared by both themes. Its actual destinations are exercised
    // once here; the matrix below checks every theme and the mobile menu layout.
    await page.goto('/');
    await page.locator('.home-mygun-link').click();
    await expect(page).toHaveURL(/\/guides\/mygun2\/$/);
    await expect(page.locator('.mg-card')).toHaveCount(12);
    await page.goto('/guides/');
    await page.locator('#primary-navigation').getByRole('link',{name:'마이건2 도감',exact:true}).click();
    await expect(page).toHaveURL(/\/guides\/mygun2\/$/);
    await expect(page.locator('.mg-card')).toHaveCount(12);
    await page.getByLabel('시리즈·총기·기능 검색').fill('EON 스택');
    await expect(page.locator('.mg-card')).toHaveCount(1);
    await page.getByRole('button',{name:'필터 초기화',exact:true}).first().click();
    await page.getByRole('combobox',{name:'기능별',exact:true}).selectOption('특수 공격');
    await page.getByRole('combobox',{name:'총기별',exact:true}).selectOption('AWP');
    await expect(page.locator('.mg-card')).toHaveCount(3);
    await page.getByLabel('시리즈·총기·기능 검색').fill('노블');
    await expect(page.locator('#mg-empty')).toBeVisible();
    await page.locator('#mg-empty-reset').click();
    await expect(page.locator('.mg-card')).toHaveCount(12);
    await page.getByRole('combobox',{name:'총기별',exact:true}).selectOption('VS-9');
    await expect(page.locator('[data-detail="evo"]')).toBeVisible();
    await expect(page.locator('#mg-weapon option').filter({hasText:/^VS-9 /})).toHaveCount(0);
});

test('comparison keeps hidden selections, limits three and supports keyboard dismissal', async ({page}) => {
    await page.goto('/guides/mygun2/');
    await page.getByLabel('이온 비교에 추가',{exact:true}).check();
    await page.getByLabel('서클 비교에 추가',{exact:true}).check();
    await page.getByLabel('시리즈·총기·기능 검색').fill('제노');
    await page.getByLabel('제노 비교에 추가',{exact:true}).check();
    await expect(page.locator('#mg-selection')).toContainText('이온 · 서클 · 제노');
    await page.getByLabel('시리즈·총기·기능 검색').fill('헌트');
    await expect(page.getByLabel('헌트 비교에 추가',{exact:true})).toBeDisabled();
    await page.getByRole('button',{name:'비교하기',exact:true}).click();
    await expect(page.locator('#mg-compare-dialog')).toBeVisible();
    await expect(page.locator('#mg-comparison')).toContainText('라운드 전환');
    await page.keyboard.press('Escape');
    await expect(page.locator('#mg-compare-dialog')).not.toBeVisible();
    await expect(page.getByRole('button',{name:'비교하기',exact:true})).toBeFocused();
    await page.getByRole('button',{name:'선택 지우기'}).click();
    await expect(page.locator('#mg-tray')).toBeHidden();
});

test('weapon queries and filters display matching weapon images and captions on every card', async ({page}) => {
    await page.goto('/guides/mygun2/');
    await page.getByLabel('시리즈·총기·기능 검색').fill('awp');
    const eonCard = page.locator('.mg-card').filter({has:page.locator('[data-detail="eon"]')});
    await expect(eonCard.locator('.mg-card-visual img')).toHaveAttribute('src','images/eon-04.webp');
    for (const card of await page.locator('.mg-card').all()) {
        await expect(card.locator('.mg-card-visual img')).toHaveAttribute('alt',/AWP/i);
        await expect(card.locator('.mg-card-gun')).toContainText('AWP');
    }
    await page.getByLabel('시리즈·총기·기능 검색').fill('이온 awp');
    await expect(page.locator('.mg-card')).toHaveCount(1);
    await expect(eonCard.locator('.mg-card-visual img')).toHaveAttribute('src','images/eon-04.webp');
    await page.getByRole('combobox',{name:'총기별',exact:true}).selectOption('GAL-1_v2');
    await expect(page.locator('#mg-empty')).toBeVisible();
    await page.locator('#mg-empty-reset').click();
    await expect(eonCard.locator('.mg-card-visual img')).toHaveAttribute('src','images/eon-01.webp');
    await page.getByRole('combobox',{name:'총기별',exact:true}).selectOption('AWP');
    for (const card of await page.locator('.mg-card').all()) {
        await expect(card.locator('.mg-card-visual img')).toHaveAttribute('alt',/AWP/i);
    }
});

test('series details preserve weapon exceptions, set groups and image fallback', async ({page}) => {
    // Install the failure before any card can populate the decoded-image cache.
    await page.route('**/images/circle-01.webp',route=>route.abort());
    await page.goto('/guides/mygun2/#xeno');
    await expect(page.locator('#mg-detail-title')).toHaveText('제노 마이건2');
    await page.getByText('기본 레벨별 혜택',{exact:true}).click();
    await expect(page.locator('#mg-detail table').first()).toContainText('G18');
    await page.getByText('세트 보상과 기능',{exact:true}).click();
    await expect(page.locator('#mg-detail')).toContainText('같은 세트 대상 총기의 변형은 중복으로 세지 않습니다');
    await expect(page.locator('#mg-detail')).toContainText('3세트 효과');
    await expect(page.locator('#mg-detail')).toContainText('6세트 효과');
    await expect(page.locator('#mg-detail')).not.toContainText('그룹');
    const gun = page.locator('.mg-gun').first();
    await expect.poll(()=>gun.locator('img').evaluate(img=>img.naturalWidth)).toBeGreaterThan(0);
    await gun.click();
    await expect(page.locator('#mg-image-dialog')).toBeVisible();
    await expect(page.locator('#mg-large-image')).toHaveAttribute('alt',/Xeno/);
    await page.keyboard.press('Escape');
    await page.goto('/guides/mygun2/#circle');
    await expect(page.locator('#mg-detail')).toContainText('Black');
    const missingImage = page.locator('#mg-detail .mg-gun img[src="images/circle-01.webp"]');
    await missingImage.scrollIntoViewIfNeeded();
    await expect(missingImage).toHaveClass(/mg-image-missing/);
    await expect(missingImage).toHaveAttribute('alt',/불러오지 못/);
    await expect(page.locator('#mg-detail-title')).toHaveText('서클 마이건2');
});

test('AWP evolution stays separate from its magazine and XM68 completes the base stats', async ({page}) => {
    await page.goto('/guides/mygun2/');
    await page.getByLabel('시리즈·총기·기능 검색').fill('EVO AWP');
    const button = page.locator('.mg-card-visual');
    await button.click();
    const dialog = page.locator('#mg-image-dialog');
    await expect(dialog).toBeVisible();
    await expect(page.locator('#mg-image-title')).toContainText('AWP');
    await expect(dialog.locator('.mg-spec-unknown')).toHaveCount(0);
    await expect(dialog.locator('.mg-spec-grid dd')).toHaveText(['100','0','100','85','5발 / 무한']);
    await expect(dialog.locator('.mg-base-spec')).toContainText('AWP');
    await expect(dialog.locator('.mg-base-spec a')).toHaveCount(0);
    await expect(dialog.locator('.mg-weapon-highlights')).toContainText('2단계 진화 시 이 총기의 장탄수 +1');
    await dialog.getByText('레벨별 혜택·총기별 예외',{exact:true}).click();
    await expect(dialog.getByRole('region',{name:'무기 상세 레벨별 혜택'})).toContainText('Lv.40');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(button).toBeFocused();
    await page.getByRole('button',{name:'필터 초기화',exact:true}).first().click();
    await page.getByLabel('시리즈·총기·기능 검색').fill('TRG21');
    await page.locator('.mg-card-visual').first().click();
    await expect(dialog.locator('.mg-base-spec')).toContainText('TRG-21');
    await expect(dialog.locator('.mg-spec-grid dd')).toHaveText(['100','0','100','85','5발 / 무한']);
    await expect(dialog.locator('.mg-weapon-stats')).toContainText('레벨·진화 효과 별도');
    await expect(dialog.locator('.mg-spec-unknown')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.getByLabel('시리즈·총기·기능 검색').fill('XM68');
    await page.locator('.mg-card-visual').first().click();
    await expect(dialog.locator('.mg-spec-grid dd')).toHaveText(['65','53','88','80','20발 / 무한']);
    await expect(dialog.locator('.mg-spec-unknown')).toHaveCount(0);
    await expect(dialog.locator('.mg-ammo dd')).toHaveText('20발 / 무한');
});

test('Specter uses the same confirmed base stats across series skins', async ({page}) => {
    await page.goto('/guides/mygun2/');
    await page.getByLabel('시리즈·총기·기능 검색').fill('Specter');
    for(const card of (await page.locator('.mg-card-visual').all()).slice(0,2)) {
        await card.click();
        const dialog=page.locator('#mg-image-dialog');
        await expect(dialog.locator('.mg-spec-grid dd')).toHaveText(['31','84','88','34','30발 / 무한']);
        await expect(dialog.locator('.mg-base-spec')).toContainText('Specter');
        await page.keyboard.press('Escape');
    }
});

test('eight newly supplied guns show common stats and TAS labels its base mode', async ({page}) => {
    await page.goto('/guides/mygun2/');
    const expected={
        'VS-9':['28','75','77','44','12발 / 무한'],TSR:['100','0','100','85','5발 / 무한'],
        TAS:['52','66','88','78','30발 / 무한'],'TAC-9':['23','84','53','69','15발 / 무한'],
        SCAR_v2:['39','84','84','55','30발 / 무한'],Peacemaker:['36','65','67','65','8발 / 무한'],
        PPS:['37','61','67','52','9발 / 무한'],P90_v2:['34','94','76','47','50발 / 무한'],
    };
    for(const [base,values] of Object.entries(expected)) {
        await page.getByRole('combobox',{name:'총기별',exact:true}).selectOption(base);
        await page.locator('.mg-card-visual').first().click();
        const dialog=page.locator('#mg-image-dialog');
        await expect(dialog.locator('.mg-spec-grid dd')).toHaveText(values);
        if(base==='TAS') await expect(dialog).toContainText('기본 모드 기준');
        await page.keyboard.press('Escape');
    }
});

test('new weapon detail markup loads versioned assets instead of stale unversioned image code', async ({page}) => {
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/guides/mygun2/main.js',route=>route.fulfill({contentType:'text/javascript',body:'throw new Error("stale image-only entry");'}));
    await page.goto('/guides/mygun2/');
    await expect(page.locator('script[src^="main.js"]')).toHaveAttribute('src',/^main\.js\?v=[a-f0-9]{12}$/);
    await expect(page.locator('link[href^="mygun2.css"]')).toHaveAttribute('href',/^mygun2\.css\?v=[a-f0-9]{12}$/);
    await expect(page.locator('.mg-card')).toHaveCount(12);
    await page.locator('.mg-card-visual').first().click();
    await expect(page.locator('#mg-weapon-content')).toContainText('기본 성능');
    expect(errors).toEqual([]);
});

test('eleven supplied base specs render and G18 growth stays separate from the base magazine', async ({page}) => {
    await page.goto('/guides/mygun2/');
    const expected={
        'NA-34':['41','76','84','70','30발 / 무한'],'Mak-12':['31','70','70','51','28발 / 무한'],
        'MSR-200':['100','0','100','85','5발 / 무한'],'MP-X3':['30','61','61','29','30발 / 무한'],
        HK416_v2:['41','76','87','64','30발 / 무한'],'GSR-6':['99','40','100','50','5발 / 무한'],
        'GAL-1_v2':['44','80','87','79','35발 / 무한'],G18:['26','51','51','37','12발 / 무한'],
        'DSG-12':['80','12','48','93','14발 / 무한'],'DRT-6':['40','80','87','70','30발 / 무한'],ANR:['38','86','86','53','30발 / 무한'],
    };
    for(const [base,values] of Object.entries(expected)) {
        await page.getByRole('combobox',{name:'총기별',exact:true}).selectOption(base);
        await page.locator('.mg-card-visual').first().click();
        const dialog=page.locator('#mg-image-dialog');
        await expect(dialog.locator('.mg-spec-grid dd')).toHaveText(values);
        if(base==='G18') await expect(dialog.locator('.mg-weapon-highlights')).toContainText('장탄수 +3 적용');
        await page.keyboard.press('Escape');
    }
});

test('weapon profiles keep provenance off-screen and disclose conditions, exceptions and sets on demand', async ({page}) => {
    await page.goto('/guides/mygun2/');
    for(const id of ['eon','evo','circle','hunt','xeno','nova','royal','rumble','double','evil','marble','noble']) {
        await page.locator(`#mg-cards [data-series="${id}"][data-gun]`).click();
        const dialog=page.locator('#mg-image-dialog');
        await expect(dialog.locator('a')).toHaveCount(0);
        await expect(dialog).not.toContainText(/출처|사용자 제공|공식|확인일/);
        await expect(dialog.locator('details')).toHaveCount(3);
        await expect(dialog.locator('details[open]')).toHaveCount(0);
        await expect(dialog.locator('.mg-weapon-tags')).toContainText('Lv.');
        await expect(dialog.locator('.mg-weapon-functions')).toContainText('발동 조건');
        await expect(dialog.locator('.mg-weapon-functions')).toContainText('유지·재사용');
        const metrics=await dialog.locator('.mg-stat').evaluateAll(rows=>rows.map(row=>({value:Number(row.querySelector('dd').textContent),width:row.querySelector('.mg-stat-track>span').style.width,hidden:row.querySelector('.mg-stat-track').getAttribute('aria-hidden')})));
        expect(metrics).toHaveLength(4 * await dialog.locator('.mg-base-spec').count());
        for(const metric of metrics) { expect(metric.width).toBe(`${metric.value}%`); expect(metric.hidden).toBe('true'); }
        await dialog.getByText('발동 상세·주의사항',{exact:true}).click();
        await expect(dialog.locator('.mg-weapon-extra').first()).toHaveAttribute('open','');
        await expect(dialog.locator('.mg-weapon-extra').first()).toContainText('실제 피해량·명중 확률을 뜻하지 않으며');
        if(id==='hunt') await expect(dialog.locator('.mg-weapon-extra').first()).toContainText('훈련소');
        if(id==='circle') await expect(dialog.locator('.mg-weapon-extra').first()).toContainText('P90_v2 25발');
        if(id==='nova') await expect(dialog.locator('.mg-weapon-functions')).toContainText('사용 횟수 제한 미확인');
        await dialog.getByText('세트 효과',{exact:true}).click();
        const rewards=dialog.getByRole('region',{name:'무기 상세 세트 효과'});
        await expect(rewards).toContainText(id==='noble'?'5세트':'3세트');
        await expect(rewards.locator('.mg-set-reward img')).toHaveCount(({eon:2,evil:6,marble:3,noble:2})[id]??4);
        await expect(rewards.locator('img').first()).toHaveAttribute('src',`images/rewards/${id}-01.png`);
        await page.keyboard.press('Escape');
    }
});

test('set reward images load when expanded and failed images preserve the reward name and effect', async ({page}) => {
    const imageRequests=[];
    page.on('request',request=>{if(request.url().includes('/images/rewards/'))imageRequests.push(request.url());});
    await page.route('**/images/rewards/eon-01.png',route=>route.abort());
    await page.goto('/guides/mygun2/');
    await page.locator('#mg-cards [data-series="eon"][data-gun]').click();
    const dialog=page.locator('#mg-image-dialog');
    await expect(dialog.locator('.mg-set-rewards')).toBeHidden();
    expect(imageRequests).toEqual([]);
    await dialog.getByText('세트 효과',{exact:true}).click();
    const kit=dialog.locator('.mg-set-reward').first();
    await expect(kit.locator('img')).toHaveClass(/mg-image-missing/);
    await expect(kit.locator('h4')).toContainText('BombTechkit');
    await expect(kit).toContainText('Eon 스택 최대 충전');
    await expect.poll(()=>dialog.locator('.mg-set-reward').nth(1).locator('img').evaluate(img=>img.naturalWidth)).toBeGreaterThan(0);
    await page.keyboard.press('Escape');
    await page.locator('[data-detail="eon"]').click();
    await page.locator('#mg-detail').getByText('세트 보상과 기능',{exact:true}).click();
    await expect(page.getByRole('region',{name:'이온 세트 보상'}).locator('.mg-set-reward')).toHaveCount(2);
});

for (const width of [390,1280]) for (const theme of ['light','dark']) {
    test(`weapon details fit and dismiss at ${width}px ${theme}`,async ({page}) => {
        await page.setViewportSize({width,height:844});
        await page.addInitScript(theme=>localStorage.setItem('theme',theme),theme);
        await page.goto('/guides/mygun2/');
        await page.getByLabel('시리즈·총기·기능 검색').fill('AK47');
        const card = page.locator('.mg-card').filter({has:page.locator('[data-detail="nova"]')});
        const button = card.locator('.mg-card-visual');
        await button.click();
        const dialog = page.locator('#mg-image-dialog');
        await expect(dialog.locator('.mg-base-spec')).toHaveCount(2);
        await expect(dialog.locator('.mg-base-spec h4')).toHaveText(['AK-47 Light · 돌격소총','AK-47 Heavy · 돌격소총']);
        await expect.poll(()=>dialog.locator('#mg-large-image').evaluate(img=>img.naturalWidth)).toBeGreaterThan(0);
        expect(await dialog.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&el.scrollWidth<=el.clientWidth;})).toBe(true);
        await dialog.getByText('세트 효과',{exact:true}).click();
        const reward=dialog.locator('.mg-set-reward').first();
        await expect(reward.locator('h4')).toContainText('Blade Nova');
        await expect.poll(()=>reward.locator('img').evaluate(img=>img.naturalWidth)).toBeGreaterThan(0);
        expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
        await page.keyboard.press('Escape');
        await expect(dialog).toBeHidden();
        await expect(button).toBeFocused();
    });

    test(`entry points, catalogue and comparison fit ${width}px ${theme}`,async ({page},info) => {
        const errors=[]; page.on('pageerror',e=>errors.push(e.message));
        await page.setViewportSize({width,height:844});
        await page.addInitScript(theme=>localStorage.setItem('theme',theme),theme);
        await page.goto('/');
        const homeEntry = page.locator('.home-mygun-link');
        await expect(homeEntry).toHaveAttribute('href','/guides/mygun2/');
        await expect.poll(()=>homeEntry.locator('img').evaluate(img=>img.naturalWidth)).toBeGreaterThan(0);
        expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.goto('/guides/');
        const featured = page.locator('.guide-featured');
        await expect(featured).toHaveAccessibleName('마이건2 도감');
        expect(await featured.evaluate(el=>el.getBoundingClientRect().bottom)).toBeLessThan(844);
        await expect(page.locator('.guide-card')).toHaveCount(13);
        await expect(page.locator('.guide-topic')).toHaveCount(3);
        expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        const navEntry = page.locator('#primary-navigation').getByRole('link',{name:'마이건2 도감',exact:true});
        if(width===390) await page.getByRole('button',{name:'메뉴 열기',exact:true}).click();
        await expect(navEntry).toBeVisible();
        await expect(navEntry).toHaveAttribute('href','/guides/mygun2/');
        await page.goto('/guides/mygun2/');
        await expect(page.locator('.mg-card')).toHaveCount(12);
        await expect(page.locator('.mg-hero-image img')).toHaveJSProperty('complete',true);
        expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({path:info.outputPath(`mygun2-${width}-${theme}.png`),fullPage:false});
        await page.getByLabel('이온 비교에 추가',{exact:true}).check();
        await page.getByLabel('서클 비교에 추가',{exact:true}).check();
        await page.getByRole('button',{name:'비교하기',exact:true}).click();
        expect(await page.locator('#mg-compare-dialog').evaluate(el=>el.getBoundingClientRect().right <= innerWidth)).toBe(true);
        expect(await page.locator('#mg-compare-dialog .mg-table-scroll').evaluate(el=>el.clientWidth <= innerWidth)).toBe(true);
        expect(errors).toEqual([]);
    });
}

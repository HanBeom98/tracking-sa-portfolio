import {test,expect} from '@playwright/test';
import {createDrawDetail} from '../fixtures/sa-draw-match.js';

async function openList(page, {width,theme,context='public',count=6}) {
  await page.setViewportSize({width,height:900});
  await page.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4173'?route.fallback():route.abort());
  await page.route('**/__public-list/',route=>route.fulfill({contentType:'text/html',body:`
    <!doctype html><html lang="ko" class="${theme==='dark'?'dark-mode':''}"><head><meta charset="utf-8">
    <link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/stats/sudden-attack/ui/style.css">
    <style>main{max-width:1100px;margin:24px auto;padding:0 12px;box-sizing:border-box}</style></head>
    <body class="${theme==='dark'?'dark-mode':''}"><main><sa-match-list></sa-match-list></main><script type="module">
    import {MatchRecord} from '/stats/sudden-attack/domain/match.js';
    import '/stats/sudden-attack/ui/components/match-list.js';
    const draw=${JSON.stringify(createDrawDetail())};
    const rows=Array.from({length:${count}},(_,i)=>{
      const result=['DRAW','WIN','LOSE','UNKNOWN','ABANDON','WIN'][i%6];
      const detail=structuredClone(draw);detail.match_id='local-row-'+i;
      const code={WIN:'1',LOSE:'2',DRAW:'3',UNKNOWN:'0',ABANDON:'0'}[result];
      detail.match_detail.forEach((p,index)=>p.match_result=index<6?code:code==='1'?'2':code==='2'?'1':code);
      const match=new MatchRecord(detail,'퀵매치 클랜전','Subject',{names:[],ouids:[]},{ouid:'local-subject',kill:16,death:13,result:code});
      match.context='${context}';match.matchResult=result;
      if(result==='UNKNOWN')Object.assign(match,{headshot:null,damage:undefined,kdPercent:null,matchDate:'invalid',mapName:'아주 긴 맵 이름 <i data-injected="yes">테스트</i>',matchTypeName:'긴 경기 유형 <img data-injected="yes">'});
      if(result==='ABANDON')Object.assign(match,{isSyntheticAbandon:true,killDisplay:'—',deathDisplay:'—',assistDisplay:'—',kdDisplay:'—'});
      if(i%6===5)Object.assign(match,{headshot:0,damage:0,kill:0,death:0,assist:0,kdPercent:0});
      return match;
    });
    window.fixtureRows=rows;window.searchEvents=[];
    addEventListener('sa-request-search',e=>searchEvents.push(e.detail.name));
    document.querySelector('sa-match-list').matchRecords=rows;
    </script></body></html>`}));
  await page.goto('/__public-list/');
  await expect(page.locator('.match-item')).toHaveCount(Math.min(20,count));
}

for(const width of [320,390,1280]) for(const theme of ['light','dark']) {
  test(`public match summaries stay compact and disclose all records at ${width}px ${theme}`,async({page})=>{
    const errors=[],api=[];page.on('pageerror',error=>errors.push(error.message));
    page.on('request',request=>{if(new URL(request.url()).pathname.startsWith('/api/'))api.push(request.url());});
    await openList(page,{width,theme});
    const rows=page.locator('.public-match-row');
    await expect(rows).toHaveCount(6);
    await expect(page.locator('.public-match-heading')).toHaveCount(1);
    if(width>800)await expect(page.locator('.public-match-heading')).toBeVisible();
    else await expect(page.locator('.public-match-heading')).toBeHidden();
    await expect(page.locator('.watermark-text')).toHaveCount(0);
    await expect(rows.locator('.result-badge')).toHaveText(['무승부','승리','패배','결과 미확인','탈주','승리']);
    const first=rows.first();
    await expect(first).toHaveJSProperty('tagName','BUTTON');
    await expect(first.locator('.public-match-kda-value')).toHaveText('16 / 13 / 6');
    await expect(first.locator('time')).toHaveAttribute('datetime','2026-11-06T14:37:25.258Z');
    await expect(first.locator('time')).toHaveAttribute('aria-label','2026.11.06 23:37 (한국 시간)');
    const zero=rows.nth(5);
    await expect(zero.locator('.public-match-metric')).toHaveText(['헤드샷: 0회','딜량: 0']);
    await expect(rows.nth(3).locator('.public-match-metric')).toHaveText(['헤드샷: —','딜량: —']);
    await expect(rows.nth(3).locator('time')).toHaveText('시간 미확인');
    await expect(rows.nth(4).locator('.public-match-kda-value')).toHaveText('— / — / —');
    await expect(page.locator('[data-injected]')).toHaveCount(0);
    const layout=await rows.evaluateAll(elements=>elements.map(el=>{
      const box=el.getBoundingClientRect();
      return {height:box.height,overflow:el.scrollWidth-el.clientWidth,top:box.top,bottom:box.bottom};
    }));
    for(let i=0;i<layout.length;i++){
      expect(layout[i].height).toBeLessThanOrEqual(90);
      expect(layout[i].overflow).toBeLessThanOrEqual(1);
      if(i)expect(layout[i].top).toBeGreaterThanOrEqual(layout[i-1].bottom);
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    if(width<=800){
      await expect(first.locator('.public-match-metric').first()).toBeHidden();
      const map=await first.locator('.map').boundingBox(),mode=await first.locator('.type-tag').boundingBox();
      const kda=await first.locator('.public-match-combat').boundingBox();
      expect(mode.y).toBeGreaterThan(map.y);
      expect(Math.abs((kda.y+kda.height/2)-(mode.y+mode.height/2))).toBeLessThan(2);
    }
    await first.focus();await first.press('Enter');
    await expect(first).toHaveAttribute('aria-expanded','true');
    const detail=page.locator('#detail-0');
    await expect(detail).toBeVisible();
    await expect(detail.locator('.score-player')).toHaveCount(12);
    await expect(detail.locator('.score-team')).toHaveCount(2);
    const board=detail.locator('.public-scoreboard');
    await expect(board.locator('.public-score-result strong')).toHaveText('무승부');
    await expect(board.locator('.public-score-map-image')).toHaveAttribute('src',/old-town-simple.jpg$/);
    await expect(board.locator('.public-score-subject-name')).toContainText('Subject');
    expect(await board.locator('.public-score-hero').evaluate(el=>getComputedStyle(el).position)).toBe('relative');
    const positions=await board.evaluate(el=>{
      const hero=el.querySelector('.public-score-hero').getBoundingClientRect();
      const subject=el.querySelector('.public-score-subject').getBoundingClientRect();
      const filters=el.querySelector('.public-score-filters').getBoundingClientRect();
      return {heroBeforeSubject:hero.bottom<=subject.top,subjectBeforeFilters:subject.bottom<=filters.top};
    });
    expect(positions).toEqual({heroBeforeSubject:true,subjectBeforeFilters:true});
    await expect(board.locator('.score-player.is-subject .subject-tag')).toHaveText('조회');
    await expect(board.locator('.public-score-map-copy time')).toContainText('23:37');
    await board.getByRole('button',{name:'상대 팀 6',exact:true}).click();
    await expect(board.locator('[data-score-group="0"]')).toBeHidden();
    await expect(board.locator('[data-score-group="1"]')).toBeVisible();
    await board.getByRole('button',{name:'전체 12',exact:true}).click();
    await expect(board.locator('[data-score-group="0"]')).toBeVisible();
    if(width<=800){
      await expect(detail.locator('.public-match-extra')).toBeVisible();
      await expect(detail.locator('.public-match-extra')).toContainText('2,470');
      await expect(detail.locator('.public-match-extra')).toContainText('1회');
    }
    if(width<=640){
      const more=board.locator('.score-player.is-subject .public-score-more');
      await more.locator('summary').click();await expect(more.locator('div')).toBeVisible();
      await expect(more).toContainText('6%');
      await expect(board.locator('.score-player.is-subject .public-score-damage')).toContainText('2,470');
    }
    if(process.env.SA_VISUAL_OUTPUT)await board.screenshot({path:`${process.env.SA_VISUAL_OUTPUT}/scoreboard-${width}-${theme}.png`});
    const name=detail.locator('.clickable-name[data-name="Subject"]');await name.click();
    expect(await page.evaluate(()=>window.searchEvents)).toEqual(['Subject']);
    await expect(first).toHaveAttribute('aria-expanded','true');
    expect(await detail.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
    const close=detail.getByRole('button',{name:'상세 기록 닫기',exact:true});
    await close.scrollIntoViewIfNeeded();
    expect((await close.boundingBox()).height).toBeGreaterThanOrEqual(44);
    if(process.env.SA_VISUAL_OUTPUT)await page.screenshot({path:`${process.env.SA_VISUAL_OUTPUT}/scoreboard-bottom-${width}-${theme}.png`});
    await close.click();
    await expect(detail).toBeHidden();
    await expect(first).toBeFocused();
    await expect(first).toHaveAttribute('aria-expanded','false');
    await expect(first).toBeInViewport();
    await first.press(' ');await expect(detail).toBeVisible();
    await expect(first).toHaveAttribute('aria-expanded','true');
    await expect(detail.locator('.score-player')).toHaveCount(12);
    await first.press('Enter');await expect(detail).toBeHidden();
    await expect(first).toHaveAttribute('aria-expanded','false');
    await rows.nth(1).click();
    await expect(page.locator('#detail-1 .public-score-result strong')).toHaveText('승리');
    await expect(page.locator('#detail-1 .score-player')).toHaveCount(12);
    await rows.nth(1).click();
    await rows.nth(3).click();
    await expect(page.locator('#detail-3 .public-score-map-copy h3')).toContainText('<i data-injected="yes">');
    await expect(page.locator('#detail-3 [data-injected]')).toHaveCount(0);
    await expect(page.locator('#detail-3 .public-score-subject-other')).toContainText('—');
    expect(await page.locator('#detail-3').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
    await rows.nth(3).click();
    if(process.env.SA_VISUAL_OUTPUT)await page.locator('main').screenshot({path:`${process.env.SA_VISUAL_OUTPUT}/match-list-${width}-${theme}.png`});
    expect(api).toEqual([]);expect(errors).toEqual([]);
  });
}

test('public row pagination and legacy league cards keep their original interactions',async({page})=>{
  await openList(page,{width:1280,theme:'dark',count:25});
  await page.locator('.match-list-more-btn').click();
  await expect(page.locator('.public-match-row')).toHaveCount(25);
  await expect(page.locator('.match-list-more-btn')).toHaveCount(0);
  await page.locator('.public-match-row').nth(24).click();
  await expect(page.locator('#detail-24')).toBeVisible();
  await page.evaluate(()=>{
    const rows=window.fixtureRows.slice(0,2).map(row=>({...row,context:'league',isCustomMatch:true,mmrChange:12,hsrChange:4}));
    document.querySelector('sa-match-list').matchRecords=rows;
  });
  await expect(page.locator('.public-match-row,.public-match-heading')).toHaveCount(0);
  await expect(page.locator('.watermark-text')).toHaveCount(2);
  await expect(page.locator('.score-change')).toHaveCount(2);
  await page.locator('.match-item').first().click();
  await expect(page.locator('#detail-0 .score-player')).toHaveCount(12);
  await expect(page.locator('.public-scoreboard')).toHaveCount(0);
  await expect(page.locator('.public-match-close')).toHaveCount(0);
});

test('a missing map image, zero damage and unavailable participants leave the public record usable',async({page})=>{
  await page.route('**/assets/maps/**',route=>route.abort());
  await openList(page,{width:390,theme:'dark'});
  await page.locator('.public-match-row').first().click();
  await expect(page.locator('#detail-0 .public-score-map-image')).toBeHidden();
  await expect(page.locator('#detail-0 .score-player')).toHaveCount(12);
  await page.evaluate(()=>{
    const match=window.fixtureRows[0];
    match.allPlayerStats.forEach(p=>{p.damage=0;});
    document.querySelector('sa-match-list').matchRecords=[match];
  });
  await page.locator('.public-match-row').first().click();
  await expect(page.locator('.public-score-damage-mark').first()).toHaveAttribute('style','width:0.00%');
  await page.evaluate(()=>{
    const match=window.fixtureRows[0];match.allPlayerStats=[];
    document.querySelector('sa-match-list').matchRecords=[match];
  });
  await page.locator('.public-match-row').first().click();
  await expect(page.locator('.public-score-subject-kda')).toContainText('16 / 13 / 6');
  await expect(page.locator('.no-detail')).toContainText('매치 상세 정보가 없습니다');
});

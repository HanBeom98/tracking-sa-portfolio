import {test, expect} from '@playwright/test';

async function settleTheme(page) {
  await page.evaluate(async () => {
    const roots=[document];
    for (const root of roots) for (const element of root.querySelectorAll('*')) {
      if (element.shadowRoot) roots.push(element.shadowRoot);
    }
    // Contrast can pass on the previous theme's colors in the first frame.
    // Wait for actual color transitions, including shadow trees, without a sleep.
    const transitions=roots.flatMap(root=>root.getAnimations()).filter(animation=>animation instanceof CSSTransition);
    await Promise.all(transitions.map(animation=>animation.finished.catch(()=>{})));
  });
}

const fixture = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><link rel="stylesheet" href="/style.css"><style>.fixture{max-width:960px;margin:20px auto;padding:16px}</style></head><body><div class="fixture"><board-list></board-list><board-post-view></board-post-view><board-comments></board-comments><app-layout page-title="게시판 글쓰기" page-description="작성 안내"><board-write-form></board-write-form><board-edit-form cancel-href="/board/"></board-edit-form></app-layout></div><script type="module">
import '/board/ui/board-list.js';import '/board/ui/board-post-view.js';import '/board/ui/board-comments.js';import '/board/ui/board-write-form.js';import '/board/ui/board-edit-form.js';import '/ui/app-layout.js';
const post={id:'local-post',title:'모바일 자유게시판 제목',authorName:'테스트회원',category:'free',content:'테마를 바꿔도 읽을 수 있는 본문입니다.',createdAt:{seconds:1793980800}};
const list=document.querySelector('board-list');list.setPosts([post]);list.setAttribute('status','ready');document.querySelector('board-post-view').renderPost(post,{canEdit:true});
const comments=document.querySelector('board-comments');comments.configure({user:{uid:'local-user',nickname:'테스트회원'}});comments.setComments([{id:'local-comment',authorUid:'local-user',authorName:'테스트회원',content:'댓글 내용도 잘 보여야 합니다.'}]);
document.querySelector('board-edit-form').renderForm({title:post.title,content:post.content});window.themeFixtureReady=true;
</script></body></html>`;

test.beforeEach(async ({page}) => {
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== 'http://127.0.0.1:4173') return route.abort();
    if (url.pathname === '/__board-theme-fixture/') return route.fulfill({contentType:'text/html',body:fixture});
    return route.continue();
  });
});

for (const width of [390,1280]) for (const theme of ['light','dark']) for (const hostContext of [true,false]) {
  test(`board text at ${width}px ${theme}, host-context ${hostContext}`, async ({page}) => {
    await page.setViewportSize({width,height:1000});
    await page.goto('/__board-theme-fixture/');
    await page.waitForFunction(() => window.themeFixtureReady);
    await page.evaluate(({theme,hostContext}) => {
      document.documentElement.classList.toggle('dark-mode',theme==='dark');
      document.body.classList.toggle('dark-mode',theme==='dark');
      // Exercise the fallback even on engines that support this selector. Firefox
      // and Safari do not apply these rules in the first place.
      if (!hostContext) {
        const strip = root => {
          for(const style of root.querySelectorAll('style')) {
            const sheet=style.sheet;
            if(!sheet)continue;
            for(let i=sheet.cssRules.length-1;i>=0;i--)if(sheet.cssRules[i].selectorText?.includes(':host-context('))sheet.deleteRule(i);
          }
          for(const el of root.querySelectorAll('*'))if(el.shadowRoot)strip(el.shadowRoot);
        };
        strip(document);
      }
    },{theme,hostContext});
    await settleTheme(page);
    const measure = () => page.evaluate(() => {
      const ctx=document.createElement('canvas').getContext('2d',{willReadFrequently:true});
      const rgba=color=>{
        ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);
        return [...ctx.getImageData(0,0,1,1).data].map((value,i)=>i===3?value/255:value);
      };
      const blend=(front,back)=>[0,1,2].map(i=>front[i]*front[3]+back[i]*(1-front[3]));
      const luminance=rgb=>rgb.map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;})
        .reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0);
      const colorsFor=surface=>{
        const backgrounds=[];
        for(let node=surface;node;node=node.assignedSlot||node.parentElement||node.getRootNode().host) {
          backgrounds.push(getComputedStyle(node).backgroundColor);
        }
        let background=[255,255,255];
        for(const color of backgrounds.reverse())background=blend(rgba(color),background);
        return background;
      };
      const contrast=(name,text,surface)=>{
        if(!text||!surface)throw Error('Missing contrast fixture: '+name);
        // Translucent button colors must be blended with the card underneath.
        const background=colorsFor(surface),foreground=blend(rgba(getComputedStyle(text).color),background);
        const a=luminance(foreground),b=luminance(background);
        return{name,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),backgroundLuminance:b};
      };
      const pair=(tag,text,surface)=>{
        const root=document.querySelector(tag).shadowRoot;
        return contrast(tag+' '+text,root.querySelector(text),surface===':host'?root.host:root.querySelector(surface));
      };
      const pairs=[
        pair('board-list','.item-title','.list-container'),
        pair('board-list','.item-author','.list-container'),
        pair('board-post-view','.post-content','.post-container'),
        pair('board-post-view','.btn.secondary','.btn.secondary'),
        pair('board-comments','.comment p','.wrap'),
        pair('board-comments','.delete','.wrap'),
        pair('app-layout','.page-description',':host'),
        pair('app-layout','.content-card','.content-card'),
        pair('board-write-form','input','input'),
        pair('board-edit-form','input','input'),
        pair('board-edit-form','.btn.secondary','.btn.secondary'),
      ];
      const editor=document.querySelector('board-write-form').shadowRoot.querySelector('board-image-editor').shadowRoot;
      for(const selector of ['.rich-toolbar>button','.list-panel button','.editor']){
        const element=editor.querySelector(selector);
        pairs.push(contrast('editor '+selector,element,element));
      }
      return pairs;
    });
    const expectReadable = async expectedTheme => {
      await expect.poll(async () => (await measure()).filter(item =>
        item.ratio < 4.5 || (item.name === 'app-layout .content-card' &&
          (expectedTheme === 'dark' ? item.backgroundLuminance > .2 : item.backgroundLuminance < .5))
      ), {message:'Readable board text and a content surface matching the active theme'}).toEqual([]);
    };
    await expectReadable(theme);
    for(const host of ['board-write-form','board-edit-form']){
      await page.locator(host+' input#title').focus();
      const ratio=await page.locator(host+' input#title').evaluate(el=>({color:getComputedStyle(el).color,background:getComputedStyle(el).backgroundColor}));
      expect(ratio.color).not.toBe(ratio.background);
    }
    await page.evaluate(() => {document.documentElement.classList.toggle('dark-mode');document.body.classList.toggle('dark-mode');});
    await settleTheme(page);
    await expectReadable(theme === 'dark' ? 'light' : 'dark');
  });
}

// These are user-visible contracts, not exact CSS declarations. Each selector
// must exist: a removed class must not turn a contrast check into an empty pass.
const siteTextSurfaces = [
  {
    path:'/stats/sudden-attack/',
    text:['.sa-home-hero h1', '.sa-home-hero-copy p', '#searchBtn', '.sa-discovery-strip span'],
  },
  {
    path:'/about/',
    text:['.about-info-card a', '.about-info-card p', '.about-docs-card a', '.about-docs-card p', '.about-section-title', '.about-list li'],
    surfaces:['.about-info-card', '.about-docs-card'],
  },
  {
    path:'/contact/',
    text:['.contact-email-card a', '.contact-email-card strong', '.contact-details-card p', '.contact-response-time'],
    surfaces:['.contact-email-card', '.contact-details-card'],
  },
  {
    path:'/guides/',
    text:['.guide-topic-nav a', '.guide-card h3', '.guide-card p'],
    surfaces:['.guide-card'],
  },
  {
    path:'/stats/',
    text:['.stats-card h2', '.stats-card p', '.stats-card li', '.stats-guide-panel h2', '.stats-guide-panel p', '.stats-guide-links strong', '.stats-guide-links span', '.stats-faq h2', '.stats-faq p', '.stats-faq-item strong', '.stats-faq-item span'],
    surfaces:['.stats-card', '.stats-guide-panel', '.stats-guide-links a', '.stats-faq', '.stats-faq-item'],
  },
];

for (const width of [390,1280]) for (const theme of ['light','dark']) {
  for (const {path,text:selectors,surfaces=[]} of siteTextSurfaces) {
    test(`site text ${path} at ${width}px ${theme}`, async ({page}) => {
      await page.setViewportSize({width,height:900});
      await page.addInitScript(theme => localStorage.setItem('theme',theme),theme);
      await page.goto(path);
      await settleTheme(page);
      await expect(page.locator(selectors[0]).first()).toBeVisible();
      await expect.poll(async () => page.evaluate(({selectors,surfaces,theme}) => {
        const ctx = document.createElement('canvas').getContext('2d',{willReadFrequently:true});
        const rgba = color => {
          ctx.clearRect(0,0,1,1);
          ctx.fillStyle = color;
          ctx.fillRect(0,0,1,1);
          return [...ctx.getImageData(0,0,1,1).data].map((value,i) => i===3 ? value/255 : value);
        };
        const blend = (front,back) => [0,1,2].map(i => front[i]*front[3]+back[i]*(1-front[3]));
        const luminance = rgb => rgb.slice(0,3).map(value => {
          value /= 255;
          return value<=.04045 ? value/12.92 : ((value+.055)/1.055)**2.4;
        }).reduce((sum,value,i) => sum+value*[.2126,.7152,.0722][i],0);
        const problems = [];
        const elementsFor = selector => {
          const elements = [...document.querySelectorAll(selector)];
          if (!elements.length) problems.push({selector,reason:'missing'});
          return elements;
        };
        for (const selector of selectors) for (const element of elementsFor(selector)) {
          if (!element.getClientRects().length || getComputedStyle(element).visibility !== 'visible') {
            problems.push({selector,reason:'hidden'});
            continue;
          }
          const backgrounds = [];
          // Slotted page content is painted on the shadow content card, not
          // directly on body. Walk the composed tree to include that surface.
          for (let node=element; node; node=node.assignedSlot || node.parentElement || node.getRootNode().host) {
            backgrounds.push(getComputedStyle(node).backgroundColor);
          }
          let background = [255,255,255];
          for (const color of backgrounds.reverse()) background=blend(rgba(color),background);
          const foreground=blend(rgba(getComputedStyle(element).color),background);
          const a=luminance(foreground),b=luminance(background);
          const ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
          if (ratio<4.5) problems.push({selector,reason:'contrast',ratio});
        }
        for (const selector of surfaces) for (const element of elementsFor(selector)) {
          const background = rgba(getComputedStyle(element).backgroundColor);
          if (theme==='dark' && (background[3]<1 || luminance(background)>.2)) {
            problems.push({selector,reason:'light or transparent card in dark theme'});
          }
        }
        return problems;
      },{selectors,surfaces,theme}),{message:'Every text target exists, remains readable and uses the active theme'}).toEqual([]);
    });
  }
}

import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { historyPayload } from './fixtures.mjs';

// Use an installed Playwright package; no downloads or live KeyFrame requests.
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const temp = await mkdtemp(join(tmpdir(), 'keyframe-overlap-test-'));
const extension = join(temp, 'extension');
await cp(resolve('dist'), extension, { recursive: true });
const manifest = JSON.parse(await readFile(join(extension, 'manifest.json'), 'utf8'));
manifest.content_scripts[0].matches = ['http://127.0.0.1/*'];
manifest.web_accessible_resources[0].matches = ['http://127.0.0.1/*'];
await writeFile(join(extension, 'manifest.json'), JSON.stringify(manifest));
await mkdir('test-results', { recursive: true });
const fixture = `<!doctype html><html><head><meta charset="UTF-8"><title>KeyFrame local fixture</title>
<style>body{font-family:Verdana;background:#eef2f6;padding:30px}table{background:white}td{padding:10px}button{color:red}input{font-size:30px}h1{color:#17314d}</style>
</head><body><h1>KeyFrame fixture</h1><p>No staff links exist on this page.</p></body></html>`;
const server = createServer((_req,res)=>{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(fixture);});
let context;
try {
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const origin = `http://127.0.0.1:${server.address().port}`;
  context = await chromium.launchPersistentContext(join(temp,'profile'), {
    channel: 'chromium', headless: true, viewport: { width: 1280, height: 900 },
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  let requests = 0, fail = false, slow = false;
  const errors = [];
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === origin || url.protocol === 'chrome-extension:') return route.continue();
    if (url.origin === 'https://keyframe-staff-list.com' && url.pathname === '/api/search/') {
      const q = url.searchParams.get('q');
      const id = q === '押山' || q === 'Alias Seven' ? 7 : Number(q?.match(/Person (\d+)/)?.[1]);
      const staff = [7,8,9,10,11,12].includes(id) ? [{anilist_id:id,en:q==='Alias Seven'?'Alias Seven':`Person ${id}`,ja:id===7?'押山清高':`Native ${id}`,main_en:`Person ${id}`,is_studio:0,jobs:['Animator']}] : [];
      return route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Credentials':'true'},body:JSON.stringify({staff})});
    }
    if (url.origin === 'https://keyframe-staff-list.com' && url.pathname === '/api/person/show.php') {
      requests++;
      if(slow) await new Promise(r=>setTimeout(r,400));
      const id = Number(url.searchParams.get('id'));
      const payload = historyPayload(id);
      payload.staff.en = `Person ${id}`;
      payload.credits[0].names[0].categories[0].roles[0].credits.push({episode:'#02',is_nc:0});
      if(id===8){
        const second=structuredClone(payload.credits[0]);second.uuid='second';second.slug='second';second.stafflist_name='Second Show';
        payload.credits.push(second);
        payload.credits[0].names[0].categories[0].roles[0].credits.push({episode:'ED',is_nc:0});
        payload.credits[0].names[0].categories[0].roles.push({role_en:'Animation Layout',credits:[{episode:'#01',is_nc:0}]});
        payload.credits[0].names[0].categories.push({category:'Ending-only category',roles:[{role_en:'Ending Direction',credits:[{episode:'ED',is_nc:0,comment:'Ending-only note'}]}]});
      }
      if(id===9){payload.credits[0].uuid='second';payload.credits[0].slug='second';payload.credits[0].stafflist_name='Second Show';}
      await route.fulfill({status:fail&&id===8?500:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Credentials':'true'},body:JSON.stringify(payload)});
      return;
    }
    // Unexpected network traffic is denied locally; these tests never contact a live site.
    await route.abort();
  });
  const page = context.pages()[0] ?? await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',msg=>{if(msg.type()==='error') console.error(msg.text());});
  page.setDefaultTimeout(8000);
  await page.goto(origin);
  const trigger=page.getByRole('button',{name:'Compare Staff',exact:true});
  await trigger.click();
  const dialog=page.getByRole('dialog');
  const input=page.getByRole('combobox');
  assert.equal(await page.getByRole('button',{name:'Compare',exact:true}).isDisabled(),true);

  async function add(query, name){
    await input.fill(query);
    await page.getByRole('option').filter({hasText:name}).click();
    await page.getByRole('button',{name:`Remove ${name}`,exact:true}).waitFor();
  }
  await input.fill('\u62bc\u5c71');
  await page.getByRole('option').filter({hasText:'Person 7'}).waitFor();
  await input.press('Enter');
  await input.fill('Alias Seven');
  await page.getByText('No unselected staff found.',{exact:false}).waitFor();
  await add('Person 8','Person 8');
  await page.getByRole('button',{name:'Compare',exact:true}).click();
  await page.getByRole('heading',{name:'1 common production / 2 common episodes',exact:true}).waitFor();
  assert.equal(requests,2);
  assert.equal(await page.getByRole('link',{name:'Show',exact:true}).getAttribute('href'),'https://keyframe-staff-list.com/staff/show');
  assert.equal(await page.getByRole('radio').count(),0,'one unified comparison view');
  assert.equal(await page.locator('.episode-heading').innerText(),'Episode');
  const episodeRows=page.locator('.episode-row');
  assert.deepEqual(await page.locator('.episode-name').allTextContents(),['Episode 1','Episode 2','ED','Overview']);
  assert.equal(await page.locator('.shared-episode').count(),2);
  const firstEpisode=episodeRows.nth(0);
  assert.equal(await firstEpisode.locator('.episode-name').count(),1,'episode label appears once per row');
  assert.deepEqual(await firstEpisode.locator('.person-credits').nth(1).locator('.role').allTextContents(),['Key Animation / 原画','Animation Layout']);
  assert.ok((await firstEpisode.innerText()).includes('[NC]'));
  assert.equal(await episodeRows.nth(2).locator('.person-credits').nth(0).innerText(),'No credit listed');
  assert.ok((await episodeRows.nth(2).innerText()).includes('Ending Direction'));
  assert.ok((await episodeRows.nth(3).innerText()).includes('Production-wide'));
  await firstEpisode.getByText('Credit details',{exact:true}).first().click();
  assert.ok((await dialog.innerText()).includes('First credit'));
  assert.equal((await dialog.innerText()).includes('Source:'),false);
  assert.equal((await dialog.innerText()).includes('All 2 staff'),false);
  assert.equal(await episodeRows.nth(1).locator('details').count(),0,'no empty details for episode-only credits');
  const inputBox=await input.boundingBox();
  for(const name of ['Compare','Refresh']) {
    const box=await page.getByRole('button',{name,exact:true}).boundingBox();
    assert.ok(Math.abs(box.y-inputBox.y)<2 && box.width<150,'compact buttons align with search');
  }
  assert.equal(await page.locator('.category').count(),0);
  for(const text of ['Find their shared productions','Comparison complete.','staff selected /','One show. Every episode.','Episodes shared by everyone']) {
    assert.equal((await dialog.innerText()).includes(text),false);
  }
  const desktopBox=await dialog.boundingBox();
  assert.ok(desktopBox.width>1000,'desktop dialog uses available width');
  assert.ok(Math.abs(desktopBox.x+desktopBox.width/2-640)<2,'dialog centered horizontally');
  assert.ok(Math.abs(desktopBox.y+desktopBox.height/2-450)<2,'dialog centered vertically');
  const columns=page.locator('.staff-columns').first();
  const first=await columns.locator('.person-credits').nth(0).boundingBox();
  const second=await columns.locator('.person-credits').nth(1).boundingBox();
  assert.ok(Math.abs(first.y-second.y)<1 && second.x>=first.x+first.width-1,'staff credits are parallel');
  await input.scrollIntoViewIfNeeded();
  await page.screenshot({path:'test-results/desktop.png'});
  await page.emulateMedia({colorScheme:'dark'});
  await page.screenshot({path:'test-results/desktop-dark.png'});
  await page.emulateMedia({colorScheme:'light'});
  await page.getByRole('button',{name:'Compare',exact:true}).click();
  await page.locator('.results > div').waitFor();
  assert.equal(requests,2,'cached repeat avoids requests');
  await page.getByRole('button',{name:'Refresh',exact:true}).click();
  await page.locator('.results > div').waitFor();
  assert.equal(requests,4,'refresh fetches selected histories');

  await add('Person 9','Person 9');
  await page.getByRole('button',{name:'Compare',exact:true}).click();
  await page.getByRole('heading',{name:'No match for everyone'}).waitFor();
  await page.getByRole('heading',{name:'Partial overlaps'}).waitFor();
  assert.ok((await dialog.innerText()).includes('Person 7 + Person 8 / 1 shared production'));
  await page.getByRole('button',{name:'Remove Person 9',exact:true}).click();

  slow=true;
  await page.getByRole('button',{name:'Compare',exact:true}).click();
  await page.locator('.results > div').waitFor();
  await page.getByRole('button',{name:'Refresh',exact:true}).click();
  await page.getByRole('button',{name:'Close',exact:true}).click();
  await trigger.click();
  assert.equal(await page.getByRole('heading',{name:'1 common production / 2 common episodes',exact:true}).count(),0);
  slow=false;
  fail=true;
  await page.getByRole('button',{name:'Compare',exact:true}).click();
  await page.locator('.results > div').waitFor();
  await page.getByRole('button',{name:'Refresh',exact:true}).click();
  await page.getByRole('alert').waitFor();
  assert.ok((await page.getByRole('alert').innerText()).includes('Person 8'));
  fail=false;
  await page.getByRole('button',{name:'Retry comparison',exact:true}).click();
  await page.locator('.results > div').waitFor();

  await input.fill('Person 9');
  await page.getByRole('option').waitFor();
  await input.press('Escape');
  assert.equal(await dialog.isVisible(),true);
  await input.press('Escape');
  await dialog.waitFor({state:'hidden'});
  assert.equal(await trigger.evaluate(node=>node.getRootNode().activeElement===node),true);
  await page.evaluate(()=>history.pushState({},'', '/person/local-fixture'));
  await trigger.click();
  assert.equal(await page.locator('[data-kf-overlap-root]').count(),1);
  await page.getByRole('button',{name:'Close',exact:true}).click();
  await page.goto(`${origin}/staff/local-fixture`);
  await trigger.click();
  await page.getByRole('button',{name:'Remove Person 7',exact:true}).waitFor();
  await page.getByRole('button',{name:'Compare',exact:true}).click();
  await page.locator('.results > div').waitFor();
  await page.setViewportSize({width:320,height:720});
  const box=await dialog.boundingBox();assert.ok(box.width<=320);
  assert.equal(await dialog.evaluate(node=>node.scrollWidth<=node.clientWidth),true);
  await columns.scrollIntoViewIfNeeded();
  assert.equal(await columns.evaluate(node=>node.scrollWidth>node.clientWidth),true,'mobile preserves scrollable parallel columns');
  await columns.focus();
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(()=>document.querySelector('[data-kf-overlap-root]').shadowRoot.querySelector('.staff-columns').scrollLeft>0);
  await page.screenshot({path:'test-results/mobile.png'});

  await page.setViewportSize({width:1280,height:900});
  await add('Person 10','Person 10');
  await page.getByRole('button',{name:'Compare',exact:true}).click();
  await page.locator('.results > div').waitFor();
  assert.equal(await columns.locator('.staff-heading').count(),3);
  assert.equal(await columns.evaluate(node=>node.scrollWidth<=node.clientWidth),true,'three staff fit on desktop');
  for(const id of [11,12]) await add(`Person ${id}`,`Person ${id}`);
  await page.getByRole('button',{name:'Compare',exact:true}).click();
  await page.locator('.results > div').waitFor();
  assert.equal(await columns.locator('.staff-heading').count(),5);
  assert.equal(await columns.evaluate(node=>node.scrollWidth>node.clientWidth),true,'larger groups scroll without wrapping staff');
  assert.equal(await dialog.evaluate(node=>node.scrollWidth<=node.clientWidth),true);
  await page.mouse.click(640,10);
  await dialog.waitFor({state:'hidden'});
  await trigger.click();
  await dialog.waitFor();
  assert.deepEqual(errors,[]);
  console.log('Extension E2E passed: selection, Japanese/alias search, episode rows, grouped roles, shared-first ordering, all credits, partial overlaps, caching, refresh, errors, cancellation, Escape/focus, navigation, persistence, mobile.');
} catch (error) {
  console.error(await context?.pages()[0]?.locator('[data-kf-overlap-root]').evaluate(e=>e.shadowRoot.innerHTML));
  throw error;
} finally {
  await context?.close();
  server.close();
}

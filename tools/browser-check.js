import {chromium} from 'playwright';
import {createServer} from './serve.js';
import {mkdir,readdir,access} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {checkFirebase} from './firebase-check.js';

const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
async function executable(){
  if(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE)return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
  try{await access(chromium.executablePath());return undefined;}catch{}
  const cache=path.join(process.env.LOCALAPPDATA||'', 'ms-playwright');
  try{for(const dir of (await readdir(cache)).filter(n=>n.startsWith('chromium-')).sort().reverse())for(const inner of ['chrome-win64','chrome-win']){const exe=path.join(cache,dir,inner,'chrome.exe');try{await access(exe);return exe;}catch{}}}catch{}
  return undefined;
}
let browser;
try{
  browser=await chromium.launch({headless:true,executablePath:await executable(),args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage(),errors=[],external=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await context.route('**/*',route=>{if(!route.request().url().startsWith(base)){external.push(route.request().url());return route.abort();}return route.continue();});
  await page.goto(`${base}/?sample=1`);await page.waitForFunction(()=>window.__TABLETOP__?.state.meta);
  await page.locator('#picker').waitFor({state:'visible'});await page.selectOption('#pcs','test_pc');await page.getByRole('button',{name:'Join the map'}).click();
  await page.evaluate(()=>window.__TABLETOP__.ready());await page.waitForTimeout(500);
  assert.equal(await page.evaluate(()=>window.__TABLETOP__.own()),'gh_test');
  assert.deepEqual(await page.evaluate(()=>[...window.__TABLETOP__.built.keys()]),[0,1]);
  assert.match(await page.locator('#status').textContent(),/Offline.*sample/);
  assert.equal(await page.evaluate(()=>window.__TABLETOP__.built.get(1).group.visible),false);
  // Exercise tap-select/tap-cell using projected world coordinates and real mouse events.
  async function screen(x,y,z){return page.evaluate(async p=>{const {Vector3}=await import('three'),t=window.__TABLETOP__,v=new Vector3(...p).project(t.camera),r=t.renderer.domElement.getBoundingClientRect();return {x:r.left+(v.x+1)*r.width/2,y:r.top+(1-v.y)*r.height/2};},[x,y,z]);}
  let from=await screen(3.5,.12,6.5),to=await screen(4.5,0,6.5);
  await page.mouse.click(from.x,from.y);await page.mouse.click(to.x,to.y);
  await page.waitForFunction(()=>window.__TABLETOP__.state.tokens.gh_test.x===.375);
  // A real drag moves the same token another cell.
  await page.waitForTimeout(300);from=await screen(4.5,.12,6.5);to=await screen(4.5,0,5.5);
  await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:8});await page.mouse.up();
  await page.waitForFunction(()=>window.__TABLETOP__.state.tokens.gh_test.y===.55);
  await page.mouse.click(to.x,to.y,{button:'right'});await page.waitForFunction(()=>window.__TABLETOP__.pings.entries.size===1);
  const before=await page.evaluate(()=>({...window.__TABLETOP__.state.tokens.gh_test}));
  await page.evaluate(async()=>{const t=window.__TABLETOP__;t.state.session={lockMove:true,lockPings:true};await t.move({x:3.5,y:5.5});await t.ping({x:4,y:4});});
  assert.deepEqual(await page.evaluate(()=>window.__TABLETOP__.state.tokens.gh_test),before);
  assert.equal(await page.evaluate(()=>Object.keys(window.__TABLETOP__.state.pings).length),1);
  await page.evaluate(async()=>{const t=window.__TABLETOP__;t.state.session={};await t.move({x:4.5,y:2.5});});
  await page.locator('#stairs').waitFor({state:'visible'});await page.locator('#stairs').click();await page.waitForFunction(()=>window.__TABLETOP__.state.f===1);
  assert.equal(await page.evaluate(()=>window.__TABLETOP__.built.get(1).group.visible),true);
  await page.waitForFunction(()=>window.__TABLETOP__.built.get(1).roofs[0].group.visible===false);
  assert.equal(await page.evaluate(()=>window.__TABLETOP__.built.get(1).roofs[0].group.visible),false);
  await page.locator('#stairs').click();await page.waitForFunction(()=>window.__TABLETOP__.state.f===0);
  // Dark fog remembers explored cells, and changing doors keeps floor geometry intact.
  const fog=await page.evaluate(()=>{const t=window.__TABLETOP__,b=t.built.get(0),g=b.ground[0].geometry;t.state.meta.light='dark';t.state.meta.time='night';t.refresh();const explored=b.vision.explored.size;t.state.doors[0].d6_4_1='closed';b.doorStates(t.state.doors[0]);t.refresh();return {explored,enabled:b.vision.enabled.value,sameGeometry:g===b.ground[0].geometry};});
  assert.ok(fog.explored>0);assert.equal(fog.enabled,1);assert.ok(fog.sameGeometry);
  await page.evaluate(()=>{const t=window.__TABLETOP__;t.state.meta.light='lit';t.state.meta.time='day';t.refresh();});
  await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/sample-desktop.png'});
  // Verify a second load remembers the player without requiring the picker.
  await page.reload();await page.waitForFunction(()=>window.__TABLETOP__?.own()==='gh_test');assert.equal(await page.locator('#picker').isVisible(),false);
  const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,reducedMotion:'reduce'}),phone=await mobile.newPage();
  phone.on('pageerror',e=>errors.push(e.message));phone.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await mobile.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
  await phone.goto(`${base}/?sample=1&name=Test`);await phone.waitForFunction(()=>window.__TABLETOP__?.state.meta);await phone.evaluate(()=>window.__TABLETOP__.ready());await phone.waitForTimeout(400);
  assert.equal(await phone.evaluate(()=>window.__TABLETOP__.renderer.getPixelRatio()),2);
  assert.equal(await phone.locator('#find').isVisible(),true);await phone.screenshot({path:'test-results/sample-mobile.png'});
  // Long-press uses a genuine touch pointer; reduced motion keeps the ring static.
  const touchPoint=await phone.evaluate(async()=>{const {Vector3}=await import('three'),t=window.__TABLETOP__,v=new Vector3(4.5,0,6.5).project(t.camera);return {x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2};});
  const cdp=await mobile.newCDPSession(phone);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touchPoint]});await phone.waitForTimeout(750);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await phone.waitForFunction(()=>window.__TABLETOP__.pings.entries.size===1);
  const perf=await page.evaluate(async()=>{const {Floor3D}=await import('./src/map3d.js'),{Vision}=await import('./src/vision.js'),paint={};for(let x=0;x<100;x++)for(let y=0;y<100;y++)paint[`${x}_${y}`]='stone';const start=performance.now(),floor=new Floor3D(0,{paint},new Vision({x:100,y:100}));const elapsed=performance.now()-start,meshes=floor.ground.length;floor.dispose();return {elapsed,meshes};});
  assert.equal(perf.meshes,1,'100×100 tiles use one mesh per material');assert.ok(perf.elapsed<5000,`large map build took ${perf.elapsed}ms`);
  console.log(`100×100 floor: ${Math.round(perf.elapsed)} ms geometry build, ${perf.meshes} ground mesh (desktop headless; not a phone benchmark).`);
  assert.deepEqual(external,[],'sample must not request external resources');assert.deepEqual(errors,[],'no browser or WebGL console errors');
  console.log('PASS: offline sample, PC picker/persistence, two floors, tap move, drag move, ping, locks, stairs both directions, roofs, dark fog, door-only updates, mobile/reduced motion; zero external requests and zero console errors.');
  await checkFirebase(browser,base);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}

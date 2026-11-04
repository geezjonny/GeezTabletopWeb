import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// The real Firebase adapter runs against module stubs; no production reads or writes.
export async function checkFirebase(browser,base){
  const sample=JSON.parse(await readFile(new URL('./sample-map.json',import.meta.url),'utf8'));
  const context=await browser.newContext(),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const root='geezvtt/live/browser_test/',map=root+`table3d/${sample.bid}/`,data={'.info/connected':true,'geezvtt/campaign/things':sample.things,[root+'dmAt']:{target:sample.bid},[root+'session']:sample.session,[root+'pings']:{},[root+'handouts']:{old:{title:'Old handout',ts:1}},[map+'meta']:sample.meta,[map+'tokenInfo']:sample.tokenInfo,[root+`tokens/${sample.bid}`]:sample.tokens};
  for(const [f,r]of Object.entries(sample.floors)){data[map+`floors/${f}`]=r;data[map+`doors/${f}`]=sample.doors[f];}
  await context.addInitScript(data=>{window.__FIREBASE_TEST__={data,reads:[],writes:[],listeners:{},auth:false};},data);
  const database=`
    const m=window.__FIREBASE_TEST__;
    export const getDatabase=()=>({});
    export const ref=(db,path)=>({path});
    const snapshot=value=>({val:()=>structuredClone(value??null)});
    m.emit=(path,value)=>{m.data[path]=structuredClone(value);for(const cb of m.listeners[path]||[])cb(snapshot(value));};
    export function onValue(r,cb){m.reads.push(r.path);(m.listeners[r.path]??=new Set()).add(cb);queueMicrotask(()=>{if(m.listeners[r.path].has(cb))cb(snapshot(m.data[r.path]));});return ()=>m.listeners[r.path].delete(cb);}
    export async function update(r,value){m.writes.push({method:'update',path:r.path,value});const parent=r.path.slice(0,r.path.lastIndexOf('/')),id=r.path.split('/').at(-1);m.data[parent]={...m.data[parent],[id]:{...m.data[parent]?.[id],...value}};m.emit(parent,m.data[parent]);}
    export const push=r=>({path:r.path+'/test_ping'});
    export async function set(r,value){m.writes.push({method:'set',path:r.path,value});const parent=r.path.slice(0,r.path.lastIndexOf('/'));m.emit(parent,{...m.data[parent],[r.path.split('/').at(-1)]:value});}
    export async function remove(r){m.writes.push({method:'remove',path:r.path});}
  `;
  await context.route('**/*',route=>{
    const url=route.request().url();if(url.startsWith(base))return route.continue();
    if(url==='https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js')return route.fulfill({contentType:'text/javascript',body:'export const initializeApp=config=>({config});'});
    if(url==='https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js')return route.fulfill({contentType:'text/javascript',body:'export const getAuth=()=>({});export const signInAnonymously=async()=>{window.__FIREBASE_TEST__.auth=true;};'});
    if(url==='https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js')return route.fulfill({contentType:'text/javascript',body:database});
    return route.abort();
  });
  await page.goto(`${base}/?camp=browser_test&name=Test`);await page.waitForFunction(()=>window.__TABLETOP__?.own()==='gh_test');await page.evaluate(()=>window.__TABLETOP__.ready());
  assert.equal(await page.locator('#status').textContent(),'Connected');assert.equal(await page.evaluate(()=>window.__FIREBASE_TEST__.auth),true);
  assert.equal(await page.locator('.handout').count(),0,'old handouts do not pop up');
  const door=await page.evaluate(root=>{const t=window.__TABLETOP__,b=t.built.get(0);window.__FIREBASE_TEST__.emit(root+'table3d/sample_tavern/doors/0',{d6_4_1:'closed'});return {same:b===t.built.get(0),angle:b.doors.get('d6_4_1').target};},root);
  assert.ok(door.same);assert.equal(door.angle,0);
  await page.evaluate(root=>{const m=window.__FIREBASE_TEST__,path=root+'tokens/sample_tavern';m.emit(path,{...m.data[path],gh_test:{...m.data[path].gh_test,x:.375}});},root);
  await page.waitForFunction(()=>window.__TABLETOP__.state.tokens.gh_test.x===.375);
  const target=await page.evaluate(()=>window.__TABLETOP__.tokens.entries.get('gh_test').target.x);assert.equal(target,4.5);
  await page.evaluate(async()=>{await window.__TABLETOP__.move({x:4.5,y:5.5});await window.__TABLETOP__.ping({x:4,y:4});});
  const writes=await page.evaluate(()=>window.__FIREBASE_TEST__.writes);
  assert.equal(writes[0].path,root+'tokens/sample_tavern/gh_test');assert.deepEqual(Object.keys(writes[0].value).sort(),['f','x','y']);
  assert.equal(writes[1].path,root+'pings/test_ping');assert.equal(writes[1].value.v,'vtt:sample_tavern');
  await page.evaluate(root=>{const m=window.__FIREBASE_TEST__;m.emit(root+'handouts',{new:{title:'A new clue',text:'<script>plain text</script>',ts:Date.now()+1}});},root);
  await page.getByText('A new clue').waitFor();assert.equal(await page.locator('.handout p').textContent(),'<script>plain text</script>');await page.getByRole('button',{name:'Dismiss handout'}).click();
  // A changed floor replaces only that floor; existing door and token subscriptions stay live.
  assert.ok(await page.evaluate(root=>{const t=window.__TABLETOP__,m=window.__FIREBASE_TEST__,b=t.built.get(1),old=t.built.get(0);const path=root+'table3d/sample_tavern/floors/0';m.emit(path,{...m.data[path],elevation:{'2_2':1}});return t.built.get(1)===b&&t.built.get(0)!==old;},root));
  await page.evaluate(root=>{const m=window.__FIREBASE_TEST__,old=root+'table3d/sample_tavern/',next=root+'table3d/next/';m.data[next+'meta']={...m.data[old+'meta'],name:'Second map',floors:[0]};m.data[next+'floors/0']=m.data[old+'floors/0'];m.data[next+'tokenInfo']=m.data[old+'tokenInfo'];m.data[root+'tokens/next']=m.data[root+'tokens/sample_tavern'];m.emit(root+'dmAt',{target:'next'});},root);
  await page.waitForFunction(()=>window.__TABLETOP__.state.bid==='next'&&window.__TABLETOP__.built.size===1);
  assert.equal(await page.locator('#title').textContent(),'Second map');
  assert.equal(await page.evaluate(root=>Object.entries(window.__FIREBASE_TEST__.listeners).filter(([p])=>p.startsWith(root+'table3d/sample_tavern/')||p===root+'tokens/sample_tavern').reduce((n,[,set])=>n+set.size,0),root),0,'old map listeners are detached');
  assert.ok(await page.evaluate(()=>window.__FIREBASE_TEST__.reads.every(p=>!p.startsWith('geezvtt/table3d/'))));
  await page.evaluate(root=>window.__FIREBASE_TEST__.emit(root+'dmAt',{target:''}),root);await page.waitForFunction(()=>window.__TABLETOP__.state.bid==='');assert.match(await page.locator('#status').textContent(),/Waiting for the GM/);
  const pinned=await context.newPage();pinned.on('pageerror',e=>errors.push(e.message));pinned.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await pinned.goto(`${base}/?camp=browser_test&bid=sample_tavern&name=Test`);await pinned.waitForFunction(()=>window.__TABLETOP__?.own()==='gh_test');
  await pinned.evaluate(root=>window.__FIREBASE_TEST__.emit(root+'dmAt',{target:'another_map'}),root);
  assert.equal(await pinned.evaluate(()=>window.__TABLETOP__.state.bid),'sample_tavern','bid override pins the requested map');
  await pinned.getByText('The GM moved to another map',{exact:false}).waitFor();
  await pinned.getByRole('button',{name:'Follow',exact:true}).click();
  await pinned.waitForFunction(()=>window.__TABLETOP__.state.bid==='another_map');
  assert.equal(await pinned.locator('#gm-moved').isVisible(),false);
  assert.equal(new URL(pinned.url()).searchParams.has('bid'),false);
  await pinned.evaluate(root=>window.__FIREBASE_TEST__.emit(root+'dmAt',{target:'next_map'}),root);
  await pinned.waitForFunction(()=>window.__TABLETOP__.state.bid==='next_map');
  assert.deepEqual(errors,[],'Firebase integration has no console errors');await context.close();
  console.log('PASS: simulated Firebase anonymous auth, public paths, GM token and door updates, player writes, handouts, incremental floor rebuild, map follow and unsubscribe, bid pin/change notice and explicit follow; no production Firebase access.');
}

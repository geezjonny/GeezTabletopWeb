import {invalidate,demandLoop} from './rendering.js';
import {Quality,QUALITY_KEY} from './quality.js';
import {lowMaterials} from './materials.js';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {Floor3D,prepareAssets} from './map3d.js';
import {Tokens3D,ownToken,tokenLook,allowedMove,stairAt,installMovement,moveRecord} from './tokens.js';
import {Vision} from './vision.js';
import {Pings} from './pings.js';
import {Atmosphere} from './atmosphere.js';
import {createUI} from './ui.js';
import {centre,heightAt,LEVEL_HEIGHT,tokenCell,span} from './coordinates.js';
import {blockers} from './rules.js';
import {connectFirebase,connectSample} from './firebase.js';

const params=new URLSearchParams(location.search),sample=params.get('sample')==='1',camp=sample?'sample':params.get('camp')||'',initialOverride=params.get('bid');
let override=initialOverride;
const storageKey=`geeztabletop:player:${camp}`,loadedAt=Date.now(),seenHandouts=new Set();
const state={bid:'',meta:null,floors:{},doors:{},tokens:{},info:{},things:{},session:{},pings:{},f:0,identity:null,connected:false};
try{state.identity=JSON.parse(localStorage.getItem(storageKey));}catch{/* Browser privacy mode can disable storage. */}
if(params.has('name'))state.identity={name:params.get('name').trim(),id:''};
const ui=createUI(p=>{state.identity=p;try{localStorage.setItem(storageKey,JSON.stringify(p));}catch{}ui.identity(p);refresh(true);});
ui.identity(state.identity);
let renderer,scene,camera,controls,tokens,pings,atmosphere,connection,target='',focused=false,removeMovement,appliedQuality;
let savedQuality;try{savedQuality=localStorage.getItem(QUALITY_KEY);}catch{}
const selection={selected:false};
const quality=new Quality(savedQuality,applyQuality),metrics={frames:0},startedAt=performance.now();
const built=new Map(),explored=new Map(),raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const own=()=>ownToken(state.tokens,state.info,state.things,state.identity);
const ownPoint=()=>{const id=own();return id&&state.meta?centre(state.tokens[id],state.meta.size):null;};
const reportError=e=>{console.error(e);ui.status('Offline · connection error');ui.notice(e.message||String(e));};
const status=()=>ui.status(sample?'Offline · sample map':!state.connected?'Offline':!state.bid||!state.meta?'Waiting for the GM to show a map':'Connected');
function follow(bid){
  if(bid===state.bid)return;
  for(const floor of built.values())floor.dispose();built.clear();tokens.dispose();pings.clear();
  Object.assign(state,{bid,meta:null,floors:{},doors:{},tokens:{},info:{},f:0});focused=false;
  invalidate();connection.follow(bid);status();ui.map(state.meta,state.f,state.session.lockMove);
}
function buildFloor(f){
  built.get(f)?.dispose();built.delete(f);const record=state.floors[f];if(!record||!state.meta)return;
  const key=`${camp}:${state.bid}:${f}`;if(!explored.has(key))explored.set(key,new Set());
  const vision=new Vision(state.meta.size,explored.get(key)),floor=new Floor3D(f,record,vision);built.set(f,floor);scene.add(floor.group);floor.doorStates(state.doors[f]);
  // Expose actual resource completion for headless verification, including GLB clones.
  floor.ready=Promise.all(floor.pending).then(()=>{refresh();});
}
function lightsFor(f){
  const floor=state.floors[f]||{},lights=Object.values(floor.lights||{}).map(l=>({...l,height:f*3+heightAt(floor,l.x,l.y)+1.6}));
  if(state.meta)for(const token of Object.values(state.tokens))if(Number(token.f||0)===f&&token.light?.on){const p=centre(token,state.meta.size);lights.push({...p,range:Number(token.light.range)||4,height:f*3+heightAt(floor,p.x,p.y)+1.3});}
  return lights;
}
function refresh(recentre=false){
  invalidate();if(!state.meta||!tokens)return;
  const id=own(),record=state.tokens[id],point=ownPoint(),floors=(state.meta.floors||[]).filter(f=>f!==null).map(Number);
  const previous=state.f;state.f=record?Number(record.f||0):floors.includes(0)?0:Math.min(...floors,Infinity);if(!Number.isFinite(state.f))state.f=0;
  const dark=state.meta.light==='dark'||state.meta.time==='night';
  tokens.sync(state.tokens,state.info,state.things,state.meta,state.floors,id);
  tokens.visibility(state.f,point,blockers(state.floors[state.f],state.doors[state.f]),lightsFor(state.f),dark);
  for(const [f,b]of built){b.group.visible=f<=state.f;b.vision.update(b.record,state.doors[f],f===state.f?point:null,lightsFor(f),dark);}
  ui.map(state.meta,state.f,state.session.lockMove);status();
  const stair=point?stairAt(point,state.f,state.floors):null;
  ui.stairs(stair&&!state.session.lockMove?stair:null,()=>useStairs(stair));
  pings.sync(state.pings,state.bid,state.f,state.meta,state.floors);
  if(recentre||(!focused&&point)||previous!==state.f){findMe();focused=!!point;}
}
function findMe(){
  if(!state.meta)return;const p=ownPoint()||{x:state.meta.size.x/2,y:state.meta.size.y/2},floor=state.floors[state.f],h=state.f*3+heightAt(floor,p.x,p.y);
  const delta=new THREE.Vector3(p.x,h,p.y).sub(controls.target);controls.target.add(delta);camera.position.add(delta);
  if(!focused){camera.position.set(p.x+9,h+14,p.y+12);controls.target.set(p.x,h,p.y);}controls.update();invalidate();
}
function pick(event){
  if(!state.meta)return null;const rect=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);
  const current=built.get(state.f);if(!current)return null;
  const surfaces=current.ground||[];
  const hit=raycaster.intersectObjects(surfaces,false)[0];if(!hit)return null;
  const tokenHits=raycaster.intersectObjects([...tokens.entries.values()].filter(e=>e.group.visible).map(e=>e.group),true);
  return {x:hit.point.x,y:hit.point.z,token:tokenHits[0]?.object.userData.token};
}
async function move(hit){
  if(state.session.lockMove){ui.notice('The GM has locked movement');return false;}
  const id=own();if(!id||!state.meta)return false;
  const look=tokenLook(id,state.info,state.things),r=state.tokens[id],{cell,record,start}=moveRecord(hit,r,look,state.meta);
  if(!allowedMove(start,cell,look.size,state.meta,state.floors[state.f]||{},state.doors[state.f])){ui.notice('That path is blocked');return false;}
  try{await connection.move(id,record);return true;}catch(e){ui.notice(`Move failed: ${e.message}`);return false;}
}
async function useStairs(stair){
  if(!stair||state.session.lockMove)return;const id=own();if(!id)return;const floor=state.floors[stair.to];if(!floor){ui.notice('The destination floor is not available');return;}
  const look=tokenLook(id,state.info,state.things),r=state.tokens[id],cell=tokenCell(r,look.size,{x:0,y:0},state.meta.size),n=span(look.size);
  for(let x=0;x<n;x++)for(let y=0;y<n;y++)if(!floor.paint?.[`${cell.x+x}_${cell.y+y}`]){ui.notice('The stair landing is blocked');return;}
  try{await connection.move(id,{...r,f:stair.to});}catch(e){ui.notice(`Move failed: ${e.message}`);}
}
async function ping(hit){
  if(!state.meta)return;if(state.session.lockPings){ui.notice('The GM has locked pings');return;}
  try{await connection.ping({v:`vtt:${state.bid}`,x:Math.max(0,Math.min(1,hit.x/state.meta.size.x)),y:Math.max(0,Math.min(1,hit.y/state.meta.size.y)),f:state.f,by:state.identity?.name||'Player',ts:Date.now()});}catch(e){ui.notice(`Ping failed: ${e.message}`);}
}
function installControls(targetPoint){
  controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=3;controls.maxDistance=120;controls.minPolarAngle=.12;controls.maxPolarAngle=Math.PI/2-.22;controls.maxTargetRadius=150;controls.screenSpacePanning=false;
  if(targetPoint){controls.target.copy(targetPoint);controls.update();}
  controls.addEventListener('change',invalidate);controls.addEventListener('start',invalidate);
  removeMovement=installMovement({canvas:renderer.domElement,controls,pick,own,move,ping,notice:ui.notice,selection});
}
function makeRenderer(settings){
  const old=renderer,targetPoint=controls?.target.clone();
  removeMovement?.();controls?.dispose();
  renderer=new THREE.WebGLRenderer({antialias:settings.antialias,powerPreference:'default'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,settings.pixelRatio));renderer.setSize(innerWidth,innerHeight);renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.domElement.setAttribute('aria-label','Battle map: orbit, pan, zoom, and move your character');
  if(old){old.domElement.replaceWith(renderer.domElement);old.dispose();old.forceContextLoss();}
  else document.getElementById('map').append(renderer.domElement);
  installControls(targetPoint);
}
function applyQuality(settings=quality.settings){
  const wasLow=appliedQuality?.name==='Low',isLow=settings.name==='Low';
  lowMaterials(isLow);
  if(!renderer||appliedQuality.antialias!==settings.antialias)makeRenderer(settings);
  else renderer.setPixelRatio(Math.min(devicePixelRatio,settings.pixelRatio));
  atmosphere?.quality(settings);
  if(atmosphere)atmosphere.lights(lightsFor(state.f),camera.position);
  if(appliedQuality&&wasLow!==isLow){for(const f of [...built.keys()])buildFloor(f);tokens.dispose();refresh();}
  appliedQuality=settings;ui.quality(quality.mode,settings.name);invalidate();
}
function targetChanged(bid){
  target=bid;
  if(connection)follow(override||target);
  ui.gmMoved(!!override&&!!target&&target!==override,()=>{
    override=null;const url=new URL(location.href);url.searchParams.delete('bid');history.replaceState(null,'',url);
    follow(target);ui.gmMoved(false);
  });
}
async function start(){
  scene=new THREE.Scene();scene.background=new THREE.Color('#27343d');camera=new THREE.PerspectiveCamera(45,innerWidth/innerHeight,.1,500);camera.position.set(9,14,12);
  tokens=new Tokens3D(scene);pings=new Pings(scene);atmosphere=new Atmosphere(scene);
  demandLoop((dt,interval,now)=>{
    if(document.hidden)return false;
    let active=controls.update();
    camera.position.y=Math.max(camera.position.y,state.f*3+heightAt(state.floors[state.f],camera.position.x,camera.position.z)+.5);
    const point=ownPoint();for(const [f,b]of built)if(f<=state.f)active=b.update(dt,f===state.f?point:null,camera.position,reduced.matches)||active;
    active=tokens.update(dt,reduced.matches)||active;active=pings.update(reduced.matches)||active;active=atmosphere.update(dt,controls.target,reduced.matches)||active;
    atmosphere.lights(lightsFor(state.f),camera.position);
    renderer.render(scene,camera);metrics.frames++;
    quality.sample(interval,now-startedAt);
    return active;
  });
  applyQuality();ui.find(findMe);ui.onQuality(mode=>{try{localStorage.setItem(QUALITY_KEY,mode);}catch{}quality.select(mode);});
  addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,quality.settings.pixelRatio));invalidate();});
  document.addEventListener('visibilitychange',invalidate);
  reduced.addEventListener('change',()=>{atmosphere.set(state.meta,reduced.matches);invalidate();});
  await prepareAssets();
  const callbacks={
    error:reportError,
    connected(v){state.connected=!!v;status();},
    target:targetChanged,
    things(things){state.things=things;ui.things(things,camp);refresh();},
    session(session){state.session=session;refresh();},
    meta(meta){const changed=JSON.stringify(state.meta?.size)!==JSON.stringify(meta?.size);state.meta=meta;atmosphere.set(meta,reduced.matches);if(!meta){invalidate();for(const b of built.values())b.dispose();built.clear();tokens.dispose();pings.clear();ui.map(null,0);status();return;}if(changed)for(const f of Object.keys(state.floors))buildFloor(Number(f));refresh();},
    floor(f,record){if(record)state.floors[f]=record;else delete state.floors[f];buildFloor(f);refresh();},
    doors(f,states){state.doors[f]=states;built.get(f)?.doorStates(states);refresh();},
    tokenInfo(info){state.info=info;refresh();},
    tokens(records){state.tokens=records;refresh();},
    pings(records){state.pings=records;refresh();},
    handouts(records){for(const [id,h]of Object.entries(records)){if(!seenHandouts.has(id)&&h.ts>loadedAt)ui.handout(h);seenHandouts.add(id);}}
  };
  if(!sample&&!camp){ui.status('Add ?camp=your_campaign to join');if(!state.identity?.name)ui.picker();return;}
  connection=await (sample?connectSample(callbacks):connectFirebase(camp,callbacks));follow(override||target);
  if(!state.identity?.name)ui.picker();
  window.__TABLETOP__={state,get renderer(){return renderer;},scene,camera,get controls(){return controls;},quality,metrics,invalidate,atmosphere,built,tokens,pings,move,ping,useStairs,refresh,findMe,own,pick,ready:async()=>{await Promise.all([...built.values()].map(f=>f.ready));}};
  window.render_game_to_text=()=>JSON.stringify({coords:'grid x:right y:down; world x:right y:up z:down; floor height:3',bid:state.bid,floor:state.f,own:own(),tokens:state.tokens,visibleTokens:[...tokens.entries].filter(([,e])=>e.group.visible).map(([id])=>id),floors:[...built.keys()],drawCalls:renderer.info.render.calls});
  window.advanceTime=ms=>new Promise(resolve=>setTimeout(resolve,ms));
}
start().catch(reportError);

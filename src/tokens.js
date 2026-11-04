import {litMaterial} from './materials.js';
import * as THREE from 'three';
import {span,centre,tokenCell,tokenRecord,heightAt,LEVEL_HEIGHT} from './coordinates.js';
import {blockers,lineOfSight,onStair} from './rules.js';
import {billboard,disposeGroup} from './map3d.js';
import {visiblePoint} from './visibility.js';
import {safeImage} from './ui.js';

export function tokenLook(id,info={},things={}){
  const t=id.startsWith('gh_')?info[id]:things[id];
  return {name:t?.name||id,color:t?.color||t?.traits?.color||(t?.traits?.pc?'#78c9be':'#dd9c80'),size:t?.size||t?.traits?.size||'medium',pc:!!(t?.pc||t?.traits?.pc),avatar:t?.traits?.avatar||t?.avatar};
}
export function ownToken(tokens,info,things,identity){
  if(!identity?.name)return null;
  if(identity.id&&tokens[identity.id]&&things[identity.id]?.traits?.pc)return identity.id;
  // Prefer linked PCs; names of unlinked tokens only count when the GM marked them PC.
  return Object.keys(tokens).find(id=>{const look=tokenLook(id,info,things);return look.pc&&look.name.trim().toLowerCase()===identity.name.trim().toLowerCase();})||null;
}
export function allowedMove(start,cell,sizeName,meta,floor,states){
  const n=span(sizeName);
  if(cell.x<0||cell.y<0||cell.x+n>meta.size.x||cell.y+n>meta.size.y)return false;
  for(let dx=0;dx<n;dx++)for(let dy=0;dy<n;dy++)if(!floor.paint?.[`${cell.x+dx}_${cell.y+dy}`])return false;
  const dest={x:cell.x+n/2,y:cell.y+n/2},segments=blockers(floor,states,'move');
  // Swept footprint: corners + centre, with a tiny inset to permit wall-adjacent cells.
  const margin=n/2-.015;
  for(const [dx,dy]of [[0,0],[-margin,-margin],[margin,-margin],[-margin,margin],[margin,margin]])if(!lineOfSight({x:start.x+dx,y:start.y+dy},{x:dest.x+dx,y:dest.y+dy},segments))return false;
  return true;
}
export function stairAt(point,f,floors){
  for(const [from,floor]of Object.entries(floors))for(const s of Object.values(floor?.stairs||{})){
    if(Number(from)===Number(f)&&onStair(point,s))return {...s,from:Number(f),to:Number(s.to)};
    if(Number(s.to)===Number(f)&&onStair(point,s))return {...s,from:Number(f),to:Number(from)};
  }
  return null;
}
export class Tokens3D {
  constructor(scene){this.scene=scene;this.entries=new Map();}
  sync(records,info,things,meta,floors,own){
    this.records=records;this.meta=meta;this.floors=floors;this.own=own;
    for(const [id,entry]of this.entries)if(!records[id]){disposeGroup(entry.group);this.entries.delete(id);}
    for(const [id,r]of Object.entries(records)){
      const look=tokenLook(id,info,things),key=JSON.stringify([look,id===own]);let entry=this.entries.get(id);
      if(entry?.key!==key){if(entry)disposeGroup(entry.group);const group=new THREE.Group(),n=span(look.size);
        const base=new THREE.Mesh(new THREE.CylinderGeometry(n*.43,n*.46,.12,24),litMaterial({color:look.color,roughness:.6}));base.position.y=.1;group.add(base);
        if(id===own){const ring=new THREE.Mesh(new THREE.TorusGeometry(n*.49,.035,8,40),new THREE.MeshBasicMaterial({color:'#ffe2a3'}));ring.rotation.x=Math.PI/2;ring.position.y=.18;group.add(ring);}
        const initials=look.name.split(/\s+/).map(s=>s[0]).slice(0,2).join('').toUpperCase(),sprite=billboard(initials,look.color,look.avatar&&safeImage(look.avatar)?look.avatar:null);sprite.scale.set(n*.95,n*.95,1);sprite.position.y=n*.6+.3;group.add(sprite);
        const label=billboard(look.name);label.scale.set(Math.max(1.2,Math.min(2.4,look.name.length*.13)),.45,1);label.position.y=n+ .65;group.add(label);
        group.userData.token=id;group.traverse(o=>o.userData.token=id);this.scene.add(group);entry={group,key,look,target:new THREE.Vector3()};this.entries.set(id,entry);
      }
      const p=centre(r,meta.size);entry.target.set(p.x,Number(r.f||0)*LEVEL_HEIGHT+heightAt(floors[r.f||0],p.x,p.y),p.y);
      if(!entry.initialized||entry.f!==Number(r.f||0)){entry.group.position.copy(entry.target);entry.initialized=true;}entry.f=Number(r.f||0);
    }
  }
  visibility(f,viewer,segments,lights,dark){for(const [id,e]of this.entries){const p={x:e.target.x,y:e.target.z};e.group.visible=e.f===f&&(id===this.own||(!viewer&&!dark)||visiblePoint(p,viewer,segments,lights,dark));}}
  update(dt,reduced){let active=false;for(const e of this.entries.values()){if(reduced||e.group.position.distanceToSquared(e.target)<.000001)e.group.position.copy(e.target);else{e.group.position.lerp(e.target,1-Math.exp(-dt*14));active=true;}}return active;}
  dispose(){for(const e of this.entries.values())disposeGroup(e.group);this.entries.clear();}
}
export function installMovement({canvas,controls,pick,own,getState,move,ping,notice,selection={selected:false}}){
  let gesture=null;
  const cancel=()=>{if(gesture)clearTimeout(gesture.timer);gesture=null;controls.enabled=true;};
  canvas.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;if(gesture){cancel();return;}
    const hit=pick(e),id=own();if(!hit)return;
    gesture={pointer:e.pointerId,x:e.clientX,y:e.clientY,hit,drag:hit.token===id&&!!id,moved:false,long:false};
    if(gesture.drag)controls.enabled=false;
    const active=gesture;
    if(e.pointerType==='touch')active.timer=setTimeout(()=>{if(gesture===active&&!active.moved){active.long=true;ping(active.hit);}},650);
  },{capture:true});
  canvas.addEventListener('pointermove',e=>{if(!gesture||gesture.pointer!==e.pointerId)return;if(Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y)>8){gesture.moved=true;clearTimeout(gesture.timer);}});
  canvas.addEventListener('pointerup',async e=>{
    if(!gesture||gesture.pointer!==e.pointerId)return;const g=gesture,hit=pick(e);cancel();
    if(g.long||!hit)return;
    if(g.drag){selection.selected=true;if(g.moved){await move(hit);selection.selected=false;}else notice('Token selected · tap a cell to move');}
    else if(selection.selected&&!g.moved){await move(hit);selection.selected=false;}
  });
  canvas.addEventListener('pointercancel',cancel);
  const release=()=>{if(gesture)cancel();};window.addEventListener('pointerup',release);
  canvas.addEventListener('contextmenu',e=>{e.preventDefault();const hit=pick(e);if(hit)ping(hit);});
  window.addEventListener('blur',cancel);
  return ()=>{cancel();window.removeEventListener('pointerup',release);window.removeEventListener('blur',cancel);};
}
export function moveRecord(hit,record,look,meta){
  const cell={x:Math.floor(hit.x),y:Math.floor(hit.y)};
  return {cell,record:tokenRecord(cell,look.size,{x:0,y:0},meta.size,record.f||0,record),start:centre(record,meta.size)};
}

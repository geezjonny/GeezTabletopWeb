import {invalidate} from './rendering.js';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {LEVEL_HEIGHT,heightAt,yaw,cellKey} from './coordinates.js';
import {roofComponents,doorRules,intersects} from './rules.js';

const textures=new Map(),models=new Map();
// Kit origins sit at the first cell; bridge props are centred on the footprint.
const longProps=new Set(['shop_counter','long_table','market_canopy','gallows','bed','rug','coffin','cart','bar_counter','workbench','market_stall','pew','bunk_bed','torture_rack','cannon']);
function propOffset(kind){const length=kind==='blackship'?8:['bridge','stairs','cliff_rock'].includes(kind)?3:longProps.has(kind)?2:1;return {x:kind==='blackship'?1.5:0,z:(length-1)/2};}
let manifest;
export async function prepareAssets(){manifest=await fetch('assets/manifest.json').then(r=>{if(!r.ok)throw Error('Missing asset manifest');return r.json();});}
const available=path=>manifest?.includes(path);
function texture(path,fallback){
  path=available(path)?path:fallback;if(!path||!available(path))return null;
  if(!textures.has(path)){
    const tex=new THREE.TextureLoader().load(path,invalidate);tex.colorSpace=THREE.SRGBColorSpace;tex.wrapS=tex.wrapT=THREE.RepeatWrapping;textures.set(path,tex);
  }
  return textures.get(path);
}
function model(path){
  if(!available(path))return Promise.resolve(null);
  if(!models.has(path))models.set(path,new GLTFLoader().loadAsync(path).then(g=>g.scene).catch(()=>null));
  return models.get(path);
}
class GeometryBatch {
  constructor(){this.p=[];this.uv=[];this.fade=[];}
  quad(a,b,c,d,u=1,v=1){for(const [p,t] of [[a,[0,0]],[b,[u,0]],[c,[u,v]],[a,[0,0]],[c,[u,v]],[d,[0,v]]]){this.p.push(...p);this.uv.push(...t);}}
  geometry(){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(this.p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(this.uv,2));g.computeVertexNormals();g.computeBoundingSphere();return g;}
}
function box(batch,x,y,z,w,h,d,angle=0){
  const cs=Math.cos(angle),sn=Math.sin(angle),p=(a,b,c)=>[x+a*cs+c*sn,y+b,z-a*sn+c*cs];
  const a=p(-w/2,0,-d/2),b=p(w/2,0,-d/2),c=p(w/2,0,d/2),e=p(-w/2,0,d/2),A=p(-w/2,h,-d/2),B=p(w/2,h,-d/2),C=p(w/2,h,d/2),E=p(-w/2,h,d/2);
  batch.quad(e,c,C,E,w,h);batch.quad(b,a,A,B,w,h);batch.quad(a,e,E,A,d,h);batch.quad(c,b,B,C,d,h);batch.quad(E,C,B,A,w,d);
}
export function billboard(text,color='#e4d5b7',avatar=null){
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=128;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#17232deb';ctx.beginPath();ctx.roundRect(3,12,250,104,16);ctx.fill();ctx.fillStyle=color;ctx.font='600 42px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text.slice(0,24),128,64,236);
  const tex=new THREE.CanvasTexture(canvas),material=new THREE.SpriteMaterial({map:tex,depthTest:true});const sprite=new THREE.Sprite(material);sprite.scale.set(1.8,.9,1);
  sprite.userData.ownedTexture=tex;
  if(avatar){const image=new Image();image.crossOrigin='anonymous';image.onload=()=>{ctx.clearRect(0,0,256,128);ctx.drawImage(image,64,0,128,128);tex.needsUpdate=true;invalidate();};image.src=avatar;}
  return sprite;
}
export function disposeGroup(group){
  group.userData.disposed=true;const geometries=new Set(),materials=new Set();
  group.traverse(o=>{if(o.geometry&&!o.userData.shared)geometries.add(o.geometry);if(o.material&&!o.userData.shared)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);o.userData.ownedTexture?.dispose();});
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());group.removeFromParent();
}
export class Floor3D {
  constructor(f,record,vision){
    this.f=Number(f);this.record=record;this.vision=vision;this.group=new THREE.Group();this.group.position.y=this.f*LEVEL_HEIGHT;
    this.doors=new Map();this.roofs=[];this.wallBatches=[];this.lights=[];this.ground=[];this.pending=[];this.materials=new Map();this.build();
  }
  material(type,kind){
    const key=`${type}_${kind}`;
    if(!this.materials.has(key))this.materials.set(key,this.vision.material(new THREE.MeshStandardMaterial({map:texture(`assets/textures/${key}.png`,`assets/textures/${type==='wall'?'wall_stone':type==='roof'?'roof_thatch':'floor_stone'}.png`),roughness:.95,side:THREE.DoubleSide})));
    return this.materials.get(key);
  }
  addBatch(batch,material,parent=this.group){if(!batch.p.length)return;const mesh=new THREE.Mesh(batch.geometry(),material);parent.add(mesh);return mesh;}
  build(){
    const r=this.record,tiles=new Map();
    for(const [key,kind] of Object.entries(r.paint||{})){
      if(!tiles.has(kind))tiles.set(kind,new GeometryBatch());const batch=tiles.get(kind),[x,z]=key.split('_').map(Number),h=heightAt(r,x,z);
      batch.quad([x,h,z+1],[x+1,h,z+1],[x+1,h,z],[x,h,z]);
      for(const [dx,dz,a,b] of [[0,1,[x,h,z+1],[x+1,h,z+1]],[1,0,[x+1,h,z+1],[x+1,h,z]],[0,-1,[x+1,h,z],[x,h,z]],[-1,0,[x,h,z],[x,h,z+1]]]){
        const neighbor=r.paint?.[cellKey(x+dx,z+dz)]!=null,low=neighbor?heightAt(r,x+dx,z+dz):Math.min(-.18,h-.18);
        if(low<h)batch.quad([a[0],low,a[2]],[b[0],low,b[2]],b,a,1,h-low);
      }
    }
    for(const [kind,batch]of tiles)this.ground.push(this.addBatch(batch,this.material('floor',kind)));
    const walls=new Map();
    for(const wall of Object.values(r.walls||{})){
      const kind=wall.mat||'stone';if(!walls.has(kind))walls.set(kind,{batch:new GeometryBatch(),spans:[]});
      const {batch,spans}=walls.get(kind),start=batch.p.length/3;
      const x=(wall.x1+wall.x2)/2,z=(wall.y1+wall.y2)/2;
      box(batch,x,heightAt(r,x,z),z,Math.hypot(wall.x2-wall.x1,wall.y2-wall.y1),2.6,.2,-Math.atan2(wall.y2-wall.y1,wall.x2-wall.x1));spans.push({wall,start,end:batch.p.length/3});
    }
    for(const [kind,{batch,spans}]of walls){
      const material=this.material('wall',kind).clone();material.transparent=true;material.depthWrite=false;material.forceSinglePass=true;material.userData.cutaway=true;
      const mesh=this.addBatch(batch,this.vision.material(material)),values=new Float32Array(batch.p.length/3).fill(1);
      mesh.geometry.setAttribute('wallAlpha',new THREE.BufferAttribute(values,1));
      const before=material.onBeforeCompile;
      material.onBeforeCompile=shader=>{before(shader);shader.vertexShader='attribute float wallAlpha; varying float vWallAlpha;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvWallAlpha=wallAlpha;');shader.fragmentShader='varying float vWallAlpha;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>','diffuseColor.a *= vWallAlpha;\n#include <opaque_fragment>');};
      this.wallBatches.push({mesh,spans,values});
    }
    for(const [key,d]of Object.entries(r.doors||{}))this.buildDoor(key,d);
    for(const p of Object.values(r.props||{}))this.addProp(p);
    for(const [key,s]of Object.entries(r.stairs||{}))if(!r.props?.[key])this.addProp({...s,p:s.kind||'stairs',s:1});
    for(const cells of roofComponents(r.roofs)){
      const group=new THREE.Group(),byKind=new Map();this.group.add(group);
      for(const key of cells){const kind=r.roofs[key];if(!byKind.has(kind))byKind.set(kind,new GeometryBatch());const [x,z]=key.split('_').map(Number);box(byKind.get(kind),x+.5,2.72+heightAt(r,x,z),z+.5,1,.16,1);}
      for(const [kind,batch]of byKind)this.addBatch(batch,this.material('roof',kind),group);
      this.roofs.push({cells:new Set(cells),group});
    }
    for(const l of Object.values(r.lights||{})){
      const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture(),color:l.color||'#ffbb77',transparent:true,opacity:.75,depthWrite:false}));glow.scale.set(.65,.65,1);glow.position.set(l.x,heightAt(r,l.x,l.y)+1.6,l.y);this.group.add(glow);this.lights.push({...l,glow});
    }
    for(const path of Object.values(r.paths||{})){
      const batch=new GeometryBatch(),points=path.points||[],w=(path.width||1)/2;
      for(let i=1;i<points.length;i++){const [x,z]=points[i-1],[X,Z]=points[i],len=Math.hypot(X-x,Z-z);if(!len)continue;const dx=-(Z-z)/len*w,dz=(X-x)/len*w,h=heightAt(r,x,z)+.025;batch.quad([x+dx,h,z+dz],[X+dx,h,Z+dz],[X-dx,h,Z-dz],[x-dx,h,z-dz],len,w*2);}
      this.addBatch(batch,this.vision.material(new THREE.MeshStandardMaterial({color:({road:'#9a896b',water:'#527e90',trail:'#796649'})[path.kind]||'#9a896b',side:THREE.DoubleSide,roughness:1})));
    }
    for(const d of Object.values(r.decals||{})){
      const size=d.s||1,path=`assets/textures/decals/${d.kind}.png`;
      const mesh=new THREE.Mesh(new THREE.PlaneGeometry(size,size),this.vision.material(new THREE.MeshBasicMaterial({map:texture(path),color:available(path)?'#ffffff':d.kind==='blood'?'#882c30':'#80744b',transparent:true,opacity:.7,depthWrite:false,side:THREE.DoubleSide})));mesh.rotation.set(-Math.PI/2,0,yaw(d.rot||0));mesh.position.set(d.x,heightAt(r,d.x,d.y)+.04,d.y);this.group.add(mesh);
    }
    for(const l of Object.values(r.labels||{})){const text=billboard(l.text);text.scale.multiplyScalar(l.size||1);text.position.set(l.x,heightAt(r,l.x,l.y)+.6,l.y);this.group.add(text);}
  }
  addProp(p){
    const wrapper=new THREE.Group();wrapper.position.set(p.x,heightAt(this.record,p.x,p.y),p.y);wrapper.rotation.y=yaw(p.rot||0);wrapper.scale.setScalar(p.s||1);this.group.add(wrapper);
    this.pending.push(model(`assets/kit/props/${p.p}.glb`).then(source=>{
      if(this.group.userData.disposed)return;
      if(source){const clone=source.clone(true),offset=propOffset(p.p);clone.position.x-=offset.x;clone.position.z-=offset.z;clone.traverse(o=>{if(o.isMesh){o.userData.shared=true;o.material=Array.isArray(o.material)?o.material.map(m=>this.vision.material(m.clone())):this.vision.material(o.material.clone());}});wrapper.add(clone);}
      else{const mesh=new THREE.Mesh(new THREE.BoxGeometry(.55,.5,.55),this.vision.material(new THREE.MeshStandardMaterial({color:'#9a9b92'})));mesh.position.y=.25;wrapper.add(mesh);}
    }));
  }
  buildDoor(key,d){
    const length=Math.hypot(d.x2-d.x1,d.y2-d.y1),root=new THREE.Group(),hinge=new THREE.Group(),kind=d.kind||d.mat||'wood';
    root.position.set((d.x1+d.x2)/2,heightAt(this.record,(d.x1+d.x2)/2,(d.y1+d.y2)/2),(d.y1+d.y2)/2);root.rotation.y=-Math.atan2(d.y2-d.y1,d.x2-d.x1);root.scale.x=length;
    hinge.position.x=-.5;root.add(hinge);this.group.add(root);
    const state={root,hinge,kind,target:0,current:0};this.doors.set(key,state);
    const attach=(path,parent,door=false)=>this.pending.push(model(path).then(source=>{
      if(this.group.userData.disposed)return;
      if(source){const clone=source.clone(true);clone.traverse(o=>{if(o.isMesh){o.userData.shared=true;o.material=Array.isArray(o.material)?o.material.map(m=>this.vision.material(m.clone())):this.vision.material(o.material.clone());}});
        // Kit doors are centred on X, grounded at Y=0, with their face in XY.
        if(door)clone.position.x=.5;parent.add(clone);
      }else if(door&&kind!=='arch'){
        const mesh=new THREE.Mesh(new THREE.BoxGeometry(.9,2.1,.12),this.vision.material(new THREE.MeshStandardMaterial({color:kind==='window'?'#90b4bd':kind==='secret'?'#827a70':'#896341',transparent:kind==='window',opacity:kind==='window'?.4:1})));mesh.position.set(.5,1.05,0);parent.add(mesh);
      }
    }));
    const frame=`assets/kit/doorframe_${d.mat}.glb`;attach(available(frame)?frame:'assets/kit/doorframe_stone.glb',root);
    if(kind!=='arch')attach(`assets/kit/door_${kind==='double'?'wood':kind}.glb`,hinge,true);
  }
  doorStates(states={}){for(const [key,d]of this.doors)d.target=doorRules(d.kind,states[key]==='open').closed?0:Math.PI/2;}
  update(dt,viewer,camera,reduced=false){
    let active=false;
    for(const d of this.doors.values()){d.current=reduced||Math.abs(d.current-d.target)<.001?d.target:THREE.MathUtils.damp(d.current,d.target,12,dt);active ||= d.current!==d.target;if(['portcullis','curtain'].includes(d.kind))d.hinge.position.y=d.current/(Math.PI/2)*2.2;else d.hinge.rotation.y=d.current;}
    for(const roof of this.roofs)roof.group.visible=!(viewer&&roof.cells.has(cellKey(viewer.x,viewer.y)));
    for(const {mesh,spans,values}of this.wallBatches){
      let changed=false;
      for(const {wall,start,end}of spans){const fade=viewer&&camera.y>this.f*3&&camera.y<30+this.f*3&&intersects({x:camera.x,y:camera.z},viewer,wall)?.15:1;if(values[start]!==Math.fround(fade)){values.fill(fade,start,end);changed=true;}}
      if(changed)mesh.geometry.attributes.wallAlpha.needsUpdate=true;
    }
    return active;
  }
  dispose(){
    // Model geometry and texture caches survive floor rebuilds; cloned materials do not.
    this.group.traverse(o=>{if(o.userData.shared&&o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();});
    disposeGroup(this.group);this.materials.forEach(m=>m.dispose());this.vision.dispose();
  }
}
let glow;
function glowTexture(){if(!glow){const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;const c=canvas.getContext('2d'),g=c.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'white');g.addColorStop(.2,'#ffffbb');g.addColorStop(1,'transparent');c.fillStyle=g;c.fillRect(0,0,64,64);glow=new THREE.CanvasTexture(canvas);}return glow;}

import * as THREE from 'three';
import {heightAt,LEVEL_HEIGHT} from './coordinates.js';
export function playerColor(name='DM'){let hash=0;for(const c of name)hash=(hash*31+c.charCodeAt(0))>>>0;return new THREE.Color().setHSL((hash%360)/360,.65,.65);}
export class Pings {
  constructor(scene){this.scene=scene;this.entries=new Map();}
  sync(records,bid,f,meta,floors){
    const active=new Set();
    for(const [id,p]of Object.entries(records))if(p.v===`vtt:${bid}`&&Number(p.f||0)===f&&Date.now()-p.ts<6000&&p.ts<=Date.now()+1000){
      active.add(id);if(this.entries.has(id))continue;
      const material=new THREE.MeshBasicMaterial({color:playerColor(p.by),transparent:true,depthTest:false,depthWrite:false,side:THREE.DoubleSide});
      const ring=new THREE.Mesh(new THREE.RingGeometry(.36,.44,48),material);ring.rotation.x=-Math.PI/2;ring.renderOrder=1000;const x=p.x*meta.size.x,y=p.y*meta.size.y;ring.position.set(x,f*LEVEL_HEIGHT+heightAt(floors[f],x,y)+.12,y);this.scene.add(ring);this.entries.set(id,{ring,ts:p.ts});
    }
    for(const [id,e]of this.entries)if(!active.has(id))this.remove(id,e);
  }
  remove(id,e){e.ring.removeFromParent();e.ring.geometry.dispose();e.ring.material.dispose();this.entries.delete(id);}
  update(reduced){for(const [id,e]of this.entries){const age=Date.now()-e.ts;if(age>=6000){this.remove(id,e);continue;}const phase=(age%1300)/1300;e.ring.scale.setScalar(reduced?1:1+phase*3);e.ring.material.opacity=reduced?.8:(1-phase)*.9;}}
  clear(){for(const [id,e]of this.entries)this.remove(id,e);}
}

import {simplifyMaterial} from './materials.js';
import * as THREE from 'three';
import {visibilityPolygon} from './visibility.js';
import {blockers} from './rules.js';

export class Vision {
  constructor(size,explored=new Set()) {
    this.size=size;this.explored=explored;
    this.canvas=document.createElement('canvas');
    this.scale=Math.min(8,1024/Math.max(size.x,size.y));
    this.canvas.width=Math.ceil(size.x*this.scale);this.canvas.height=Math.ceil(size.y*this.scale);
    this.mask=document.createElement('canvas');this.mask.width=this.canvas.width;this.mask.height=this.canvas.height;
    this.texture=new THREE.CanvasTexture(this.canvas);this.texture.minFilter=THREE.LinearFilter;this.texture.magFilter=THREE.LinearFilter;
    this.enabled={value:0};
  }
  material(material) {
    material=simplifyMaterial(material);
    const previous=material.onBeforeCompile;
    material.onBeforeCompile=shader=>{
      previous?.(shader);
      shader.uniforms.mapFog={value:this.texture};shader.uniforms.mapSize={value:new THREE.Vector2(this.size.x,this.size.y)};shader.uniforms.fogEnabled=this.enabled;
      shader.vertexShader='varying vec2 vGrid;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nvGrid = (modelMatrix * vec4(transformed,1.0)).xz;');
      shader.fragmentShader='uniform sampler2D mapFog; uniform vec2 mapSize; uniform float fogEnabled; varying vec2 vGrid;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>','outgoingLight *= mix(1.0, texture2D(mapFog, vec2(vGrid.x / mapSize.x, 1.0-vGrid.y / mapSize.y)).r, fogEnabled);\n#include <opaque_fragment>');
    };
    material.customProgramCacheKey=()=>`map-fog-${material.userData.cutaway?'cutaway':'plain'}`;
    return material;
  }
  update(floor,states,viewer,lights,dark) {
    this.enabled.value=dark?1:0;if(!dark)return;
    const ctx=this.mask.getContext('2d',{willReadFrequently:true}),s=this.scale;
    ctx.setTransform(s,0,0,s,0,0);ctx.clearRect(0,0,this.size.x,this.size.y);
    const segments=blockers(floor,states);
    const clipPolygon=(poly)=>{ctx.beginPath();poly.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.clip();};
    if(viewer){
      ctx.save();clipPolygon(visibilityPolygon(viewer,segments,Math.hypot(this.size.x,this.size.y)*2));
      for(const light of lights){
        ctx.save();clipPolygon(visibilityPolygon(light,segments,light.range));ctx.fillStyle='#fff';ctx.fillRect(0,0,this.size.x,this.size.y);ctx.restore();
      }
      ctx.restore();
    }
    const pixels=ctx.getImageData(0,0,this.mask.width,this.mask.height).data;
    for(const key of Object.keys(floor.paint||{})) {
      const [x,y]=key.split('_').map(Number),px=Math.min(this.mask.width-1,Math.floor((x+.5)*s)),py=Math.min(this.mask.height-1,Math.floor((y+.5)*s));
      if(pixels[(py*this.mask.width+px)*4+3]>128)this.explored.add(key);
    }
    const out=this.canvas.getContext('2d');out.setTransform(s,0,0,s,0,0);out.fillStyle='#121212';out.fillRect(0,0,this.size.x,this.size.y);
    out.fillStyle='#606060';for(const key of this.explored){const [x,y]=key.split('_').map(Number);out.fillRect(x,y,1,1);}
    out.setTransform(1,0,0,1,0,0);out.drawImage(this.mask,0,0);this.texture.needsUpdate=true;
  }
  dispose(){this.texture.dispose();}
}

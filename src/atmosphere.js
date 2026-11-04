import * as THREE from 'three';
export class Atmosphere {
  constructor(scene){
    this.scene=scene;this.ambient=new THREE.HemisphereLight('#c5dded','#665446',2);this.sun=new THREE.DirectionalLight('#fff0ce',2.5);this.sun.position.set(-12,25,8);scene.add(this.ambient,this.sun);
    this.pool=Array.from({length:8},()=>{const l=new THREE.PointLight('#ffbb77',15,6,2);l.visible=false;scene.add(l);return l;});
    const positions=new Float32Array(260*3);for(let i=0;i<positions.length;i+=3){positions[i]=(Math.random()-.5)*35;positions[i+1]=Math.random()*16;positions[i+2]=(Math.random()-.5)*35;}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(positions,3));this.particles=new THREE.Points(geo,new THREE.PointsMaterial({size:.06,color:'#bed2df',transparent:true,opacity:.55,depthWrite:false}));scene.add(this.particles);this.kind='clear';this.wind=0;
  }
  set(meta,reduced){
    const presets={dawn:['#edc49a','#a4b8c6',1.45,1.9],day:['#fff0ce','#c5dded',2,2.5],dusk:['#ebac92','#969fbd',1.15,1.8],night:['#879fcf','#73839e',.7,.6]};const [sun,sky,ambient,intensity]=presets[meta?.time]||presets.day;
    this.sun.color.set(sun);this.sun.intensity=intensity;this.ambient.color.set(sky);this.ambient.intensity=ambient;
    this.scene.background=new THREE.Color(meta?.time==='night'?'#101923':'#27343d');
    this.kind=(meta?.weather?.kind||'Clear').toLowerCase();this.wind=Number(meta?.weather?.wind||0);this.particles.visible=this.kind!=='clear'&&!reduced;
    this.particles.material.color.set(({snow:'#eff5ff',leaves:'#bba55d',ash:'#a5a3a0',rain:'#b5d8ee'})[this.kind]||'#b5d8ee');this.particles.material.size=this.kind==='rain'?.045:.11;
  }
  lights(sources,camera){
    const nearest=[...sources].sort((a,b)=>(a.x-camera.x)**2+(a.y-camera.z)**2-(b.x-camera.x)**2-(b.y-camera.z)**2).slice(0,this.pool.length);
    this.pool.forEach((light,i)=>{const s=nearest[i];light.visible=!!s;if(s){light.position.set(s.x,s.height||1.6,s.y);light.color.set(s.color||'#ffbb77');light.distance=s.range;light.intensity=12;}});
  }
  update(dt,target,reduced){if(reduced||!this.particles.visible)return;this.particles.position.set(target.x,Math.floor(target.y/3)*3,target.z);const p=this.particles.geometry.attributes.position;for(let i=0;i<p.count;i++){let y=p.getY(i)-dt*(this.kind==='rain'?12:this.kind==='snow'?1.4:2);if(y<0)y=16;let x=p.getX(i)+dt*this.wind*3;if(x>17.5)x=-17.5;p.setXYZ(i,x,y,p.getZ(i));}p.needsUpdate=true;}
}

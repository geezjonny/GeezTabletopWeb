import * as THREE from 'three';
let low=false;
export function lowMaterials(value){low=value;}
export function simplifyMaterial(material){
  if(!low||!material.isMeshStandardMaterial)return material;
  const simple=new THREE.MeshLambertMaterial();
  for(const key of ['name','color','map','lightMap','lightMapIntensity','aoMap','aoMapIntensity','emissive','emissiveMap','emissiveIntensity','alphaMap','normalMap','normalScale','bumpMap','bumpScale','side','transparent','opacity','alphaTest','depthTest','depthWrite','vertexColors','flatShading','visible','fog','forceSinglePass']){
    if(key in material&&key in simple){if(simple[key]?.copy)simple[key].copy(material[key]);else simple[key]=material[key];}
  }
  simple.userData={...material.userData};material.dispose();return simple;
}
export const litMaterial=options=>simplifyMaterial(new THREE.MeshStandardMaterial(options));

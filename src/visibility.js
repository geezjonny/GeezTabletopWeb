import {lineOfSight} from './rules.js';
export function visiblePoint(point,viewer,segments,lights=[],dark=false) {
  if(!viewer||!lineOfSight(viewer,point,segments)) return false;
  if(!dark) return true;
  return lights.some(l=>Math.hypot(point.x-l.x,point.y-l.y)<=l.range&&lineOfSight(l,point,segments));
}
// Cast at each obstacle endpoint and either side, plus a circular range boundary.
export function visibilityPolygon(viewer,segments,range=100) {
  if(!viewer) return [];
  const angles=Array.from({length:96},(_,i)=>i*Math.PI*2/96);
  for(const s of segments) for(const [x,y] of [[s.x1,s.y1],[s.x2,s.y2]]) {
    const a=Math.atan2(y-viewer.y,x-viewer.x);angles.push(a-1e-5,a,a+1e-5);
  }
  return angles.sort((a,b)=>a-b).map(a=>{
    const dx=Math.cos(a),dy=Math.sin(a);let distance=range;
    for(const s of segments) {
      const sx=s.x2-s.x1,sy=s.y2-s.y1,den=dx*sy-dy*sx;
      if(Math.abs(den)<1e-9) continue;
      const qx=s.x1-viewer.x,qy=s.y1-viewer.y;
      const t=(qx*sy-qy*sx)/den,u=(qx*dy-qy*dx)/den;
      if(t>=0&&u>=0&&u<=1) distance=Math.min(distance,t);
    }
    return {x:viewer.x+dx*distance,y:viewer.y+dy*distance};
  });
}

export function doorRules(kind='wood',open=false) {
  const closed=kind==='arch'?false:kind==='window'?true:!open;
  return {closed,toggle:!['window','arch'].includes(kind),sight:closed&&!['window','bars','portcullis'].includes(kind),pass:kind==='curtain'||!closed};
}
export function blockers(floor={},states={},mode='sight') {
  return [...Object.values(floor.walls||{}),...Object.entries(floor.doors||{}).filter(([k,d])=>{
    const r=doorRules(d.kind||d.mat,states[k]==='open'); return mode==='sight'?r.sight:!r.pass;
  }).map(([,d])=>d)];
}
const cross=(ax,ay,bx,by)=>ax*by-ay*bx;
// Inclusive intersections prevent slipping through shared wall endpoints.
export function intersects(a,b,s) {
  const rx=b.x-a.x, ry=b.y-a.y, sx=s.x2-s.x1, sy=s.y2-s.y1;
  const dx=s.x1-a.x,dy=s.y1-a.y,den=cross(rx,ry,sx,sy),eps=1e-8;
  if(Math.abs(den)<eps) {
    if(Math.abs(cross(dx,dy,rx,ry))>eps) return false;
    const len=rx*rx+ry*ry;
    if(len<eps) return false;
    const t=(dx*rx+dy*ry)/len,u=t+(sx*rx+sy*ry)/len;
    return Math.max(t,u)>=-eps&&Math.min(t,u)<=1+eps;
  }
  const t=cross(dx,dy,sx,sy)/den,u=cross(dx,dy,rx,ry)/den;
  return t>=-eps&&t<=1+eps&&u>=-eps&&u<=1+eps;
}
export const lineOfSight=(a,b,segments)=>!segments.some(s=>intersects(a,b,s));
export function roofComponents(roofs={}) {
  const remaining=new Set(Object.keys(roofs)),groups=[];
  while(remaining.size) {
    const cells=[remaining.values().next().value]; remaining.delete(cells[0]);
    for(let i=0;i<cells.length;i++) {
      const [x,y]=cells[i].split('_').map(Number);
      for(const key of [`${x-1}_${y}`,`${x+1}_${y}`,`${x}_${y-1}`,`${x}_${y+1}`]) if(remaining.delete(key)) cells.push(key);
    }
    groups.push(cells);
  }
  return groups;
}
export function onStair(p,s) {
  const angle=-(s.rot||0)*Math.PI/180,dx=p.x-s.x,dy=p.y-s.y;
  const x=dx*Math.cos(angle)-dy*Math.sin(angle),y=dx*Math.sin(angle)+dy*Math.cos(angle);
  return Math.abs(x)<=Number(s.w||1)/2&&Math.abs(y)<=Number(s.h||1)/2;
}

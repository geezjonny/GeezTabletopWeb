// Modules can request a frame without owning the renderer or a perpetual loop.
let wake=()=>{};
export const invalidate=()=>wake();
export function demandLoop(draw,request=requestAnimationFrame){
  let pending=false,previous=null;
  const frame=now=>{
    pending=false;
    const interval=previous===null?null:now-previous;
    previous=now;
    if(draw(Math.min((interval??16.67)/1000,.1),interval,now))invalidate();
    if(!pending)previous=null; // Idle time is never counted as a slow frame.
  };
  wake=()=>{if(!pending){pending=true;request(frame);}};
  return invalidate;
}

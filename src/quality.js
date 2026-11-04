export const QUALITY_KEY='geeztabletop:quality';
export const tiers=[
  {name:'High',pixelRatio:2,antialias:true,lights:8,particles:260},
  {name:'Medium',pixelRatio:1.5,antialias:true,lights:3,particles:130},
  {name:'Low',pixelRatio:1,antialias:false,lights:1,particles:60}
];
export class Quality {
  constructor(mode='auto',change=()=>{}){
    this.mode=['auto','high','low'].includes(mode)?mode:'auto';this.autoTier=0;this.change=change;this.reset();
  }
  get level(){return this.mode==='auto'?this.autoTier:this.mode==='low'?2:0;}
  get settings(){return tiers[this.level];}
  reset(){this.elapsed=0;this.frames=0;}
  select(mode){if(!['auto','high','low'].includes(mode))return;this.mode=mode;this.reset();this.change(this.settings);}
  sample(ms,sessionMs){
    if(this.mode!=='auto'||this.autoTier===2)return;
    if(ms===null||!Number.isFinite(ms)||ms<=0){this.reset();return;}
    this.elapsed+=ms;this.frames++;
    if(this.elapsed<1000||this.frames<20)return;
    const average=this.elapsed/this.frames;this.reset();
    if(average>(sessionMs<6000?34:42)){this.autoTier++;this.change(this.settings);}
  }
}

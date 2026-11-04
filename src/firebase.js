// Firebase client configuration is public; copied from GeezSheets' shared config.
const config={apiKey:'AIzaSyCJrkcYjFjyyx5UNA9FUaCIlCvxxOYabis',authDomain:'geezsheets.firebaseapp.com',databaseURL:'https://geezsheets-default-rtdb.firebaseio.com',projectId:'geezsheets',storageBucket:'geezsheets.firebasestorage.app',messagingSenderId:'57811286242',appId:'1:57811286242:web:cd9cac596acdb355a2c6bb'};
// ?db=local (or ?db=http://host:port): GeezTabletop's local database (godot-vtt/tools/localdb)
// instead of Firebase, for testing. src/local-db.js is a copy of GeezSheets' js/local-db.js.
async function localDatabase(at){
  await import('./local-db.js');
  const db=window.GeezLocalDb(at==='local'?location.origin:at);
  return {db,ref:(d,p)=>d.ref(p),onValue:(r,cb,err)=>{r.on('value',cb,err);return()=>r.off('value',cb);},update:(r,v)=>r.update(v),push:(r,v)=>r.push(v),set:(r,v)=>r.set(v),remove:r=>r.remove()};
}
async function firebaseDatabase(){
  const [{initializeApp},{getAuth,signInAnonymously},{getDatabase,ref,onValue,update,push,set,remove}]=await Promise.all([import('firebase/app'),import('firebase/auth'),import('firebase/database')]);
  const app=initializeApp(config);
  await signInAnonymously(getAuth(app));
  return {db:getDatabase(app),ref,onValue,update,push,set,remove};
}
export async function connectFirebase(camp,callbacks) {
  const at=new URLSearchParams(location.search).get('db');
  const {db,ref,onValue,update,push,set,remove}=at?await localDatabase(at):await firebaseDatabase();
  const root=`geezvtt/live/${camp}/`;
  const listen=(path,callback)=>onValue(ref(db,path),s=>callback(s.val()),e=>callbacks.error(e));
  const off=[listen('.info/connected',callbacks.connected),listen('geezvtt/campaign/things',v=>callbacks.things(v||{})),listen(root+'session',v=>callbacks.session(v||{})),listen(root+'dmAt',v=>callbacks.target(v?.target||'')),listen(root+'pings',v=>callbacks.pings(v||{})),listen(root+'handouts',v=>callbacks.handouts(v||{}))];
  let mapOff=[],floorOff=new Map(),bid='';
  const clearMap=()=>{mapOff.forEach(fn=>fn());mapOff=[];for(const list of floorOff.values())list.forEach(fn=>fn());floorOff.clear();};
  return {
    follow(id){
      clearMap();bid=id;if(!id)return;
      const map=root+`table3d/${id}/`;
      mapOff.push(listen(map+'meta',meta=>{
        callbacks.meta(meta);
        const floors=new Set((meta?.floors||[]).filter(f=>f!==null).map(Number));
        for(const [f,list]of floorOff)if(!floors.has(f)){list.forEach(fn=>fn());floorOff.delete(f);callbacks.floor(f,null);}
        for(const f of floors)if(!floorOff.has(f))floorOff.set(f,[listen(map+`floors/${f}`,v=>callbacks.floor(f,v)),listen(map+`doors/${f}`,v=>callbacks.doors(f,v||{}))]);
      }),listen(map+'tokenInfo',v=>callbacks.tokenInfo(v||{})),listen(root+`tokens/${id}`,v=>callbacks.tokens(v||{})));
    },
    // Update only changed position fields so a concurrent GM light toggle survives.
    async move(id,record){if(!bid)throw Error('No active map');await update(ref(db,root+`tokens/${bid}/${id}`),{x:record.x,y:record.y,f:record.f});},
    async ping(record){const entry=push(ref(db,root+'pings'));await set(entry,record);setTimeout(()=>remove(entry).catch(callbacks.error),5000);},
    close(){clearMap();off.forEach(fn=>fn());}
  };
}
export async function connectSample(callbacks){
  const response=await fetch('tools/sample-map.json');if(!response.ok)throw Error('Could not load sample map');const sample=await response.json();
  const tokens=structuredClone(sample.tokens),pings={};
  // Delay until the caller has installed its connection handle.
  queueMicrotask(()=>{callbacks.connected(false);callbacks.things(sample.things||{});callbacks.session(sample.session||{});callbacks.target(sample.bid);});
  return {
    follow(){callbacks.meta(sample.meta);for(const [f,r]of Object.entries(sample.floors)){callbacks.floor(Number(f),r);callbacks.doors(Number(f),sample.doors?.[f]||{});}callbacks.tokenInfo(sample.tokenInfo||{});callbacks.tokens({...tokens});},
    async move(id,record){tokens[id]={...record};callbacks.tokens({...tokens});},
    async ping(record){const id=crypto.randomUUID();pings[id]=record;callbacks.pings({...pings});setTimeout(()=>{delete pings[id];callbacks.pings({...pings});},5000);},
    close(){}
  };
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {loadPicture,pictureUrl} from '../src/picture.js';
import {Floor3D} from '../src/map3d.js';

test('picture resolves existing campaign file and decodes PNG, JPEG and WebP',async()=>{
  for(const [image,mime] of [['abc','png'],['/9j/abc','jpeg'],['UklGRabc','webp']]){
    const descriptor={dd2vtt:'Room 1.dd2vtt',rect:[2.5,-1,8,4]},calls=[];
    const result=await loadPicture(descriptor,async url=>{calls.push(url);return {ok:true,json:async()=>({image})};},async src=>src,name=>pictureUrl(name,''));
    assert.equal(calls[0],'https://geezjonny.github.io/GeezSheets/battlemap/Room%201.dd2vtt');
    assert.deepEqual(result,{image:`data:image/${mime};base64,${image}`,rect:descriptor.rect});
  }
  assert.equal(pictureUrl('map.dd2vtt','?db=http://127.0.0.1:5555'),'http://127.0.0.1:5555/GeezSheets/battlemap/map.dd2vtt');
});
test('picture failures reject for caller to retain guessed tiles',async()=>{
  const d={dd2vtt:'a',rect:[0,0,4,3]};
  await assert.rejects(loadPicture({...d,rect:[0,0,0,3]}),/Invalid/);
  await assert.rejects(loadPicture(d,async()=>({ok:false,status:404}),null,()=>''),/404/);
  await assert.rejects(loadPicture(d,async()=>({ok:true,json:async()=>({})}),null,()=>''),/Missing/);
  await assert.rejects(loadPicture(d,async()=>({ok:true,json:async()=>({image:'broken'})}),async()=>{throw Error('decode');},()=>''),/decode/);
});

test('floor replaces guessed tiles only after decoding, retains walls, and disposes late results',async()=>{
  const saved={fetch:globalThis.fetch,Image:globalThis.Image,location:globalThis.location,warn:console.warn};
  let finish;const warnings=[];
  globalThis.location={search:''};
  globalThis.fetch=async()=>({ok:true,json:async()=>({image:'abc'})});
  globalThis.Image=class{decode(){return new Promise(resolve=>{finish=resolve;});}};
  console.warn=(...args)=>warnings.push(args);
  const vision={material:m=>m,dispose(){}};
  const record={paint:{'0_0':'wood'},walls:{w:{x1:0,y1:0,x2:2,y2:0}},picture:{dd2vtt:'room',rect:[2,-1,8,4]}};
  try{
    const floor=new Floor3D(-1,record,vision),tiles=[...floor.ground];
    assert.equal(tiles[0].visible,true);
    await new Promise(resolve=>setImmediate(resolve));finish();await Promise.all(floor.pending);
    assert.equal(tiles[0].visible,false);assert.equal(floor.wallBatches.length,1);
    assert.deepEqual(floor.ground[0].position.toArray(),[6,.01,1]);
    assert.equal(floor.ground[0].geometry.parameters.width,8);assert.equal(floor.ground[0].geometry.parameters.height,4);
    assert.equal(floor.ground[0].rotation.x,-Math.PI/2);assert.equal(floor.group.position.y,-3);
    floor.dispose();
    const late=new Floor3D(0,record,vision);late.dispose();await new Promise(resolve=>setImmediate(resolve));finish();await Promise.all(late.pending);
    assert.equal(late.ground[0].visible,true,'disposed floor never installs its late picture');
    globalThis.fetch=async()=>{throw Error('missing source');};
    const failed=new Floor3D(0,record,vision);await Promise.all(failed.pending);
    assert.equal(failed.ground[0].visible,true);assert.equal(warnings.length,1);failed.dispose();
  } finally {globalThis.fetch=saved.fetch;globalThis.Image=saved.Image;globalThis.location=saved.location;console.warn=saved.warn;}
});

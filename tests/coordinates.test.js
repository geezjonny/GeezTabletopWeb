import test from 'node:test';
import assert from 'node:assert/strict';
import {span,roundCell,tokenCell,tokenRecord,worldPoint,centre,yaw,heightAt} from '../src/coordinates.js';

test('grid axes, floor height, elevation and clockwise rotation match the bridge',()=>{
  assert.deepEqual(worldPoint(4,7,-1,.5),{x:4,y:-2.5,z:7});assert.equal(yaw(90),-Math.PI/2);
  assert.equal(heightAt({elevation:{'2_3':.75}},2.8,3.2),.75);assert.equal(heightAt({},1,2),0);
  assert.deepEqual(centre({x:.25,y:.75},{x:20,y:10}),{x:5,y:7.5});
});
test('span sizes and Godot negative rounding',()=>{
  assert.deepEqual(['tiny','small','medium','large','huge','gargantuan','unknown'].map(span),[1,1,1,2,3,4,1]);
  assert.equal(roundCell(-1.5),-2);assert.equal(roundCell(1.5),2);
});
test('token_record uses the footprint centre, origin and five decimal precision',()=>{
  const record=tokenRecord({x:-3,y:8},'large',{x:-5,y:2},{x:13,y:17},-1,{light:{range:4,on:false},other:1});
  assert.deepEqual(record,{x:.23077,y:.41176,f:-1,light:{range:4,on:false},other:1});
  assert.deepEqual(tokenCell(record,'large',{x:-5,y:2},{x:13,y:17}),{x:-3,y:8});
});
test('all sizes round-trip on positive and negative map origins',()=>{
  for(const sizeName of ['tiny','small','medium','large','huge','gargantuan'])for(const origin of [{x:0,y:0},{x:-32,y:8}])for(let x=0;x<24;x+=3)for(let y=0;y<18;y+=3){
    const cell={x:x+origin.x,y:y+origin.y},size={x:31,y:23};
    assert.deepEqual(tokenCell(tokenRecord(cell,sizeName,origin,size,2),sizeName,origin,size),cell);
  }
});

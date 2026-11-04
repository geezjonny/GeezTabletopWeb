import test from 'node:test';
import assert from 'node:assert/strict';
import {demandLoop,invalidate} from '../src/rendering.js';
import {Quality,tiers} from '../src/quality.js';

test('demand rendering coalesces invalidations and stops after animation settles',()=>{
  const queue=[],intervals=[];let moving=true;
  demandLoop((dt,interval)=>{intervals.push(interval);return moving;},cb=>queue.push(cb));
  invalidate();invalidate();assert.equal(queue.length,1);
  queue.shift()(100);assert.equal(queue.length,1);
  moving=false;queue.shift()(116);assert.equal(queue.length,0);
  invalidate();queue.shift()(10000);
  assert.deepEqual(intervals,[null,16,null]);assert.equal(queue.length,0);
});

test('auto quality steps down on sustained slow frames, never back up',()=>{
  const changes=[],q=new Quality('auto',s=>changes.push(s));
  for(let i=0;i<25;i++)q.sample(40,2000);
  assert.equal(q.level,1);
  for(let i=0;i<60;i++)q.sample(16,4000);
  assert.equal(q.level,1);
  q.sample(null,90000);assert.equal(q.frames,0);
  for(let i=0;i<20;i++)q.sample(50,90000);
  assert.equal(q.level,2);assert.deepEqual(changes,[tiers[1],tiers[2]]);
  for(let i=0;i<100;i++)q.sample(10,100000);
  assert.equal(q.level,2);
  q.select('high');for(let i=0;i<100;i++)q.sample(100,100000);
  assert.equal(q.level,0);q.select('auto');assert.equal(q.level,2);
});

test('quality validates stored preferences and defines laptop budgets',()=>{
  assert.equal(new Quality('invalid').mode,'auto');
  assert.equal(new Quality('low').level,2);
  assert.deepEqual(tiers.map(t=>t.pixelRatio),[2,1.5,1]);
  assert.deepEqual(tiers.map(t=>t.lights),[8,3,1]);
  assert.deepEqual(tiers.map(t=>t.antialias),[true,true,false]);
  assert.ok(tiers[0].particles>tiers[1].particles&&tiers[1].particles>tiers[2].particles);
});

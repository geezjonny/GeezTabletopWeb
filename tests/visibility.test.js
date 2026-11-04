import test from 'node:test';
import assert from 'node:assert/strict';
import {visiblePoint,visibilityPolygon} from '../src/visibility.js';
import {blockers} from '../src/rules.js';

const viewer={x:1,y:2},wall={x1:3,y1:0,x2:3,y2:4};
test('daylight tokens are occluded by walls even without fog',()=>{
  assert.ok(visiblePoint({x:2,y:2},viewer,[wall]));assert.equal(visiblePoint({x:4,y:2},viewer,[wall]),false);
  assert.equal(visiblePoint({x:2,y:2},null,[]),false);
});
test('darkness requires light AND player line of sight AND unobstructed light reach',()=>{
  const torch={x:1,y:2,range:2};
  assert.equal(visiblePoint({x:2,y:2},viewer,[],[],true),false);assert.ok(visiblePoint({x:2,y:2},viewer,[],[torch],true));
  assert.equal(visiblePoint({x:5,y:2},viewer,[],[torch],true),false);
  assert.equal(visiblePoint({x:4,y:2},viewer,[wall],[{x:4,y:1,range:8}],true),false);
  assert.equal(visiblePoint({x:2,y:2},viewer,[wall],[{x:5,y:2,range:8}],true),false);
});
test('windows allow token sight, closed wood does not, opening wood restores sight',()=>{
  const a={x:4,y:2},floor={doors:{d:{...wall,kind:'wood'}}};
  assert.equal(visiblePoint(a,viewer,blockers(floor)),false);assert.ok(visiblePoint(a,viewer,blockers(floor,{d:'open'})));
  floor.doors.d.kind='window';assert.ok(visiblePoint(a,viewer,blockers(floor)));
});
test('visibility polygon stops at walls, follows endpoint rays and respects range',()=>{
  const polygon=visibilityPolygon(viewer,[wall],8);
  assert.ok(polygon.length>96);for(const p of polygon)assert.ok(Math.hypot(p.x-viewer.x,p.y-viewer.y)<=8.00001);
  const centreRay=polygon.find(p=>Math.abs(p.y-2)<1e-8&&p.x>viewer.x);assert.ok(centreRay);assert.ok(Math.abs(centreRay.x-3)<1e-8);
  assert.deepEqual(visibilityPolygon(null,[wall]),[]);
});

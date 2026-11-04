import test from 'node:test';
import assert from 'node:assert/strict';
import {doorRules,blockers,intersects,lineOfSight,roofComponents,onStair} from '../src/rules.js';

test('every door kind follows GeezSheets movement, sight and toggle rules',()=>{
  const closed={wood:[true,true,true,false],iron:[true,true,true,false],double:[true,true,true,false],secret:[true,true,true,false],window:[true,false,false,false],arch:[false,false,false,true],bars:[true,true,false,false],portcullis:[true,true,false,false],curtain:[true,true,true,true]};
  for(const [kind,expected]of Object.entries(closed)){
    assert.deepEqual(Object.values(doorRules(kind,false)),expected,kind);
    const open=doorRules(kind,true);assert.equal(open.pass,kind!=='window',kind);assert.equal(open.sight,false,kind);
  }
});
test('door state changes only add relevant blockers',()=>{
  const seg={x1:2,y1:0,x2:2,y2:4},f={walls:{wall:seg},doors:{door:{...seg,kind:'wood'},window:{...seg,kind:'window'},curtain:{...seg,kind:'curtain'}}};
  assert.equal(blockers(f,{},'sight').length,3);assert.equal(blockers(f,{door:'open'},'sight').length,2);
  assert.equal(blockers(f,{},'move').length,3);assert.equal(blockers(f,{door:'open'},'move').length,2);
});
test('intersection handles diagonal, endpoints, collinear and separated segments',()=>{
  const a={x:0,y:0},b={x:4,y:4};
  assert.ok(intersects(a,b,{x1:0,y1:4,x2:4,y2:0}));assert.ok(intersects(a,b,{x1:4,y1:4,x2:6,y2:4}));
  assert.ok(intersects(a,b,{x1:1,y1:1,x2:2,y2:2}));assert.equal(intersects(a,b,{x1:5,y1:5,x2:6,y2:6}),false);
  assert.equal(intersects(a,b,{x1:0,y1:1,x2:4,y2:5}),false);
  assert.ok(lineOfSight(a,b,[]));
});
test('connected roofs lift as a whole across mixed materials, without diagonal joining',()=>{
  const groups=roofComponents({'0_0':'thatch','1_0':'tile','1_1':'tile','3_3':'slate','4_4':'slate'});
  assert.deepEqual(groups.map(g=>g.length),[3,1,1]);
});
test('stairs use centre, rotated width and length',()=>{
  const stair={x:4,y:4,w:1,h:3,rot:90};
  assert.ok(onStair({x:5,y:4},stair));assert.equal(onStair({x:4,y:5},stair),false);
});

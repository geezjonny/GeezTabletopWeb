import test from 'node:test';
import assert from 'node:assert/strict';
import {allowedMove,ownToken,stairAt} from '../src/tokens.js';
import {readFile} from 'node:fs/promises';
const sample=JSON.parse(await readFile(new URL('../tools/sample-map.json',import.meta.url),'utf8'));
test('sample resolves Test, accepts a cell move and rejects through-wall moves',()=>{
  const f=sample.floors[0],meta=sample.meta;
  assert.equal(ownToken(sample.tokens,sample.tokenInfo,sample.things,{name:'test'}),'gh_test');
  assert.ok(allowedMove({x:3.5,y:6.5},{x:4,y:6},'medium',meta,f,sample.doors[0]));
  assert.equal(allowedMove({x:3.5,y:6.5},{x:7,y:6},'medium',meta,f,sample.doors[0]),false);
  assert.ok(allowedMove({x:5.5,y:4.5},{x:6,y:4},'medium',meta,f,sample.doors[0]));
  assert.equal(allowedMove({x:5.5,y:4.5},{x:6,y:4},'medium',meta,f,{}),false);
});
test('movement validates the whole footprint, map bounds and closed windows',()=>{
  const floor={paint:{'0_0':'wood','1_0':'wood','0_1':'wood'}},meta={size:{x:3,y:3}};
  assert.equal(allowedMove({x:1,y:1},{x:0,y:0},'large',meta,floor,{}),false);
  assert.equal(allowedMove({x:.5,y:.5},{x:-1,y:0},'medium',meta,floor,{}),false);
  assert.equal(allowedMove({x:10.5,y:3.5},{x:11,y:3},'medium',sample.meta,sample.floors[0],sample.doors[0]),false);
});
test('stairs work in both directions from a single source-floor record',()=>{
  assert.equal(stairAt({x:4.5,y:2.5},0,sample.floors).to,1);assert.equal(stairAt({x:4.5,y:2.5},1,sample.floors).to,0);
  assert.equal(stairAt({x:9,y:9},0,sample.floors),null);
});
test('PC identity requires PC status; ids disambiguate matching names',()=>{
  const records={a:{},b:{},gh_b:{}},things={a:{name:'Test',traits:{pc:false}},b:{name:'Test',traits:{pc:true}}},info={gh_b:{name:'Test',pc:true}};
  assert.equal(ownToken(records,info,things,{name:'TEST',id:'b'}),'b');
  assert.equal(ownToken({a:{}},{},things,{name:'Test'}),null);
});

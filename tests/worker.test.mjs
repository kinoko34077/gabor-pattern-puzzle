import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const script=fs.readFileSync(path.resolve(import.meta.dirname,'../service-worker.js'),'utf8');

test('service worker pre-caches only project-scoped URLs and drops old caches',async()=>{
  const scope='https://demo.github.io/gabor-pattern-puzzle/';
  const listeners=new Map();const added=[];const deleted=[];
  const cache={addAll:async urls=>added.push(...urls),match:async()=>undefined};
  const caches={open:async()=>cache,keys:async()=>['gabor-pattern-puzzle-v0','gabor-pattern-puzzle-v1','another-app'],delete:async k=>{deleted.push(k);return true},match:async()=>undefined};
  const self={registration:{scope},location:{origin:'https://demo.github.io'},addEventListener:(name,cb)=>listeners.set(name,cb),skipWaiting:async()=>{},clients:{claim:async()=>{}}};
  vm.runInNewContext(script,{self,caches,URL,Response,fetch:async()=>{throw Error('network disabled')},console});
  assert.ok(listeners.has('install')&&listeners.has('activate')&&listeners.has('fetch'));
  let installed;
  listeners.get('install')({waitUntil:promise=>installed=promise});await installed;
  assert.equal(added.length,11);
  assert.ok(added.every(u=>u.startsWith(scope)),added);
  assert.ok(added.includes(scope+'index.html'));
  let activated;listeners.get('activate')({waitUntil:promise=>activated=promise});await activated;
  assert.deepEqual(deleted,['gabor-pattern-puzzle-v0']);
});

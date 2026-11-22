import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const script=fs.readFileSync(path.resolve(import.meta.dirname,'../service-worker.js'),'utf8');

test('Service Workerが配信スコープ外へアクセスせず旧キャッシュを削除する',async()=>{
  const scope='https://demo.github.io/gabor-pattern-puzzle/';
  const listeners=new Map();const added=[];const deleted=[];
  const cache={addAll:async urls=>added.push(...urls),match:async()=>undefined};
  const caches={open:async()=>cache,keys:async()=>['gabor-pattern-puzzle-v0','gabor-pattern-puzzle-v1','gabor-pattern-puzzle-v2','another-app'],delete:async k=>{deleted.push(k);return true},match:async()=>undefined};
  const self={registration:{scope},location:{origin:'https://demo.github.io'},addEventListener:(name,cb)=>listeners.set(name,cb),skipWaiting:async()=>{},clients:{claim:async()=>{}}};
  vm.runInNewContext(script,{self,caches,URL,Response,fetch:async()=>{throw Error('network disabled')},console});
  assert.ok(listeners.has('install')&&listeners.has('activate')&&listeners.has('fetch'));
  let installed;
  listeners.get('install')({waitUntil:promise=>installed=promise});await installed;
  const core=script.match(/const CORE = \[([\s\S]*?)\];/);
  assert.ok(core,'Service Workerの事前キャッシュ定義が存在する');
  const expected=[...core[1].matchAll(/'(\.\/[^']+)'/g)].map(m=>m[1]);
  assert.equal(new Set(expected).size,expected.length,'同一ファイルを二重登録しない');
  assert.equal(added.length,expected.length,'全てのCORE資産が登録される');
  assert.deepEqual(added,[...expected.map(rel=>new URL(rel,scope).href)]);
  assert.ok(added.every(u=>u.startsWith(scope)),added);
  assert.ok(added.includes(scope+'index.html'));
  let activated;listeners.get('activate')({waitUntil:promise=>activated=promise});await activated;
  assert.deepEqual(deleted,['gabor-pattern-puzzle-v0','gabor-pattern-puzzle-v1']);
});

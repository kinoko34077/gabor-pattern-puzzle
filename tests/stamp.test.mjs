import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stampServiceWorker} from '../scripts/stamp-service-worker.mjs';

const source=readFileSync(new URL('../service-worker.js',import.meta.url),'utf8');
test('PWAキャッシュ世代を配信コミットごとに一意にする',()=>{
  const first='a'.repeat(40),second='b'.repeat(40);
  const a=stampServiceWorker(source,first),b=stampServiceWorker(source,second);
  assert.notEqual(a,b);
  assert.ok(a.includes(`const CACHE = 'gabor-pattern-puzzle-${first}';`));
  assert.ok(b.includes(`const CACHE = 'gabor-pattern-puzzle-${second}';`));
  assert.ok(!a.includes('gabor-pattern-puzzle-v2'));
  assert.throws(()=>stampServiceWorker(source,'invalid'),/40桁/);
  assert.throws(()=>stampServiceWorker(a,second),/置換位置/);
});

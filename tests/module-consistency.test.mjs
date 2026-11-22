import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const sourceDir=join(root,'src');
const sourceNames=readdirSync(sourceDir).filter(name=>name.endsWith('.ts'))
  .map(name=>name.slice(0,-3)).sort();
const read=path=>readFileSync(join(root,path),'utf8');

test('REQ-MODULE-001: standaloneとPWAの依存モジュール一覧が実ソースと完全一致する',()=>{
 const build=read('build.cjs');
 const sw=read('service-worker.js');
 const match=build.match(/const modules=(\[[^;]+\]);/);
 assert.ok(match,'standaloneバンドルのモジュール一覧が見つからない');
 const bundled=[...match[1].matchAll(/'([^']+)'/g)].map(m=>m[1]).sort();
 const offline=[...sw.matchAll(/'\.\/dist\/([a-z-]+)\.js'/g)].map(m=>m[1]).sort();
 assert.deepEqual(bundled,sourceNames,'新しいTypeScriptファイルはstandaloneに登録する');
 assert.deepEqual(offline,sourceNames,'新しいTypeScriptファイルはPWA事前キャッシュへ登録する');
 assert.equal(new Set(bundled).size,bundled.length);
 assert.equal(new Set(offline).size,offline.length);
 for(const name of sourceNames)assert.ok(existsSync(join(root,'dist',name+'.js')),name+'のビルド出力がない');
});

test('REQ-MODULE-002: ローカル依存が存在し、standalone内で解決可能である',()=>{
 const build=read('build.cjs');
 assert.match(build,/require\('\.\/main\.js'\)/);
 const known=new Set(sourceNames);
 for(const name of sourceNames){
   const source=read('src/'+name+'.ts');
   for(const match of source.matchAll(/(?:from\s*|import\s*)['"]\.\/([^'"]+)\.js['"]/g)){
     const dep=match[1];
     assert.ok(known.has(dep),name+'が存在しないモジュール'+dep+'を参照');
   }
 }
});

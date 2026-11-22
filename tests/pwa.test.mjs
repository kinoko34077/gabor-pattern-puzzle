import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const read=(f)=>fs.readFileSync(path.join(root,f),'utf8');
test('PWA metadata, scope and offline app shell are self-contained',()=>{
  const manifest=JSON.parse(read('manifest.webmanifest'));
  assert.equal(manifest.scope,'./');assert.ok(manifest.start_url.startsWith('./'));
  assert.equal(manifest.display,'standalone');
  assert.equal(manifest.icons.filter(i=>i.purpose==='maskable').length,2);
  for(const icon of manifest.icons)assert.ok(fs.statSync(path.join(root,icon.src)).size>100);
  const sw=read('service-worker.js');
  for(const file of ['index.html','manifest.webmanifest','dist/main.js','dist/game.js','dist/gabor.js','dist/render.js']){
    assert.ok(sw.includes(file),`Missing offline asset ${file}`);
    assert.ok(fs.existsSync(path.join(root,file)));
  }
  assert.ok(sw.includes('self.registration.scope'));
  const html=read('index.html');
  assert.ok(html.includes('manifest.webmanifest'));
  assert.ok(html.includes("serviceWorker.register('./service-worker.js', {scope:'./'})"));
  assert.ok(html.includes('src="./dist/main.js"'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {displayedPatchAngle} from '../dist/render.js';

test('縦画面は各ガボール画像の中心で90°だけ角度を加える',()=>{
 for(const angle of [-180,-90,0,15,90,137,450]){
  assert.equal(displayedPatchAngle(angle,false),angle);
  assert.equal(displayedPatchAngle(angle,true),angle+90);
 }
});
test('横向き右端の操作欄を縦画面では下端へ移し各要素を90°回転する',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8');
 const renderer=readFileSync(new URL('../src/render.ts',import.meta.url),'utf8');
 const portrait=html.slice(html.indexOf('@media (orientation:portrait)'));
 assert.match(portrait,/\.tool svg\s*\{[^}]*transform:rotate\(90deg\)/);
 assert.match(portrait,/#score-value\s*\{[^}]*rotate\(90deg\)/);
 assert.match(portrait,/#theme-toast\s*\{[^}]*rotate\(90deg\)/);
 assert.match(portrait,/\.end-panel\s*\{[^}]*rotate\(90deg\)/);
 assert.match(portrait,/dialog\s*\{[^}]*rotate\(90deg\)/);
 assert.match(portrait,/body\s*\{flex-direction:column\}/);
 assert.match(portrait,/#toolbar\s*\{[^}]*grid-template-columns:repeat\(7,minmax\(0,1fr\)\)/);
 assert.doesNotMatch(portrait,/#toolbar\s*\{[^}]*transform\s*:/);
 assert.doesNotMatch(portrait,/#game\s*\{[^}]*transform\s*:/);
 assert.match(main,/matchMedia\('\(orientation: portrait\)'\)\.matches/);
 assert.match(renderer,/displayedPatchAngle\(rotation,this\.portrait\)/);
});

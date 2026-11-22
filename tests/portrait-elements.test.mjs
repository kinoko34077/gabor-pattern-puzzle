import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('縦画面でもガボール画像に90°の追加回転を掛けない',()=>{
 const renderer=readFileSync(new URL('../src/render.ts',import.meta.url),'utf8');
 const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8');
 assert.match(renderer,/ctx\.rotate\(rotation\*Math\.PI\/180\)/);
 assert.doesNotMatch(renderer,/displayedPatchAngle|this\.portrait|portrait\?90/);
 assert.doesNotMatch(main,/matchMedia\('\(orientation: portrait\)'\)\.matches/);
});

test('縦画面は下端へ位置だけ移し、文字やダイアログを正立表示する',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const start=html.indexOf('@media (orientation:portrait)');
 const end=html.indexOf('</style>',start);
 assert.ok(start>=0&&end>start);
 const portrait=html.slice(start,end);
 assert.match(portrait,/body\{flex-direction:column\}/);
 assert.match(portrait,/#toolbar\s*\{[^}]*grid-template-columns:repeat\(7,minmax\(0,1fr\)\)/);
 for(const [id,column] of [['settings-button',7],['mode-button',6],['palette-button',5],
                            ['plus-button',4],['minus-button',3],['hint-button',2],['score',1]]){
   assert.ok(portrait.includes('#toolbar #'+id+'{grid-column:'+column));
 }
 assert.match(portrait,/#toolbar \.tool\s*\{[^}]*transform:none/);
 assert.doesNotMatch(portrait,/rotate\s*\(/);
 assert.doesNotMatch(portrait,/#game\s*\{[^}]*transform\s*:/);
 assert.doesNotMatch(portrait,/dialog\s*\{[^}]*transform\s*:/);
 assert.doesNotMatch(portrait,/#theme-toast\\s*\\{[^}]*translate\\(-50%,-50%\\)/);
 assert.doesNotMatch(portrait,/dialog\\s*\\{/);
 assert.match(html,/<aside id="settings" class="settings-popover" role="region"/);
 assert.doesNotMatch(html,/<dialog|::backdrop|backdrop-filter\\s*:/);
});

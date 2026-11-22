import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../dist/game.js';
import {PALETTE_OPTIONS} from '../dist/palette.js';

function random(seed=34077){return ()=>{
 seed=(Math.imul(seed,1664525)+1013904223)>>>0;
 return seed/4294967296;
};}
test('配色ボタン用の切替は全デザインを一定順序で循環する',()=>{
 const game=new Game({theme:'classic',paletteShift:3},random());
 const expected=PALETTE_OPTIONS.map(x=>x.id);
 assert.deepEqual(expected,['classic','set2','sunset','night','custom']);
 const colors=[];
 for(let i=1;i<=expected.length;i++){
   const actual=game.cycleTheme();
   assert.equal(actual,expected[i%expected.length]);
   assert.equal(game.theme,actual);
   assert.equal(game.paletteShift,0);
   colors.push(game.kindColor(1));
 }
 assert.notDeepEqual(colors[0],colors[1]);
 assert.equal(colors.at(-1).r,255);
});
test('横画面は右側、縦画面は下側へ時計回り相当の7スロットを並べる',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const start=html.indexOf('<nav id="toolbar"');
 const end=html.indexOf('</nav>',start);
 assert.ok(start>0&&end>start);
 const rail=html.slice(start,end);
 const slots=['settings-button','mode-button','palette-button',
              'plus-button','minus-button','hint-button','score'];
 const positions=slots.map(id=>rail.indexOf('id="'+id+'"'));
 assert.ok(positions.every(x=>x>=0));
 assert.deepEqual(positions,[...positions].sort((a,b)=>a-b));
 assert.ok(html.includes('body{height:100dvh;display:flex;flex-direction:row'));
 assert.ok(html.includes('body{flex-direction:column}'));
 const portrait=html.slice(html.indexOf('@media (orientation:portrait)'));
 assert.match(portrait,/#toolbar\s*\{[^}]*grid-template-columns:repeat\(7,minmax\(0,1fr\)\)/);
 for(const [id,col] of [['settings-button',7],['mode-button',6],['palette-button',5],['plus-button',4],['minus-button',3],['hint-button',2],['score',1]]){
   assert.ok(portrait.includes('#toolbar #'+id+'{grid-column:'+col));
 }
 assert.ok(!html.includes('id="hud"'));
 assert.ok(!html.includes('id="ready-message"'));
 assert.ok(rail.includes('配色'));
});

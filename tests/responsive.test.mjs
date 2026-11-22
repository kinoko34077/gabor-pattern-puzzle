import test from 'node:test';
import assert from 'node:assert/strict';
import {fitBoard} from '../dist/layout.js';
import {Game} from '../dist/game.js';
import {PALETTES,paletteColor} from '../dist/palette.js';

function seeded(seed=23){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}}

test('画面領域・回転に合わせてセル個数と大きさを両立する',()=>{
 const phonePortrait=fitBoard(390,772),phoneLandscape=fitBoard(772,390);
 const desktop=fitBoard(1824,1080),wide=fitBoard(3420,1960);
 assert.ok(phonePortrait.rows>phoneLandscape.rows);
 assert.ok(phoneLandscape.cols>phonePortrait.cols);
 assert.ok(desktop.tile>phoneLandscape.tile*1.3);
 assert.ok(wide.tile>desktop.tile*1.4);
 assert.ok(wide.cols<desktop.cols*2);
 for(const layout of [phonePortrait,phoneLandscape,desktop,wide]){
   assert.ok(layout.rows>=4&&layout.cols>=4);
   assert.ok(layout.cols*layout.tile>=1);
 }
});
test('回転後もゲーム進行・既存セルを保持し、模様を常時変化させる',()=>{
 const g=new Game({},seeded());
 g.resizeViewport(390,772);
 const ids=new Set(g.board.flat().map(c=>c?.id));
 const beforeTime=g.time;
 const previous=g.visualNow;
 for(let i=0;i<130;i++)g.tick(.05);
 assert.equal(g.phase,'ready');assert.equal(g.time,beforeTime);
 assert.ok(g.visualNow>previous);
 const oldAge=g.visualNow;
 g.resizeViewport(772,390);
 assert.ok(g.board.flat().some(c=>ids.has(c?.id)));
 assert.equal(g.time,beforeTime);assert.equal(g.visualNow,oldAge);
 const move=g.findPossibleSwap();assert.ok(move);
 g.swap(...move);
 for(let i=0;i<110;i++)g.tick(.05);
 const score=g.score,time=g.time;
 g.resizeViewport(390,772);assert.equal(g.score,score);assert.equal(g.time,time);
 g.paused=true;const pausedClock=g.now,visual=g.visualNow;
 for(let i=0;i<20;i++)g.tick(.05);
 assert.equal(g.now,pausedClock);assert.ok(g.visualNow>visual);
});
test('設定のゲーム時間・色・動作速度を検証する',()=>{
 const g=new Game({},seeded());
 g.setDuration(120);g.restart();
 assert.equal(g.time,120);
 g.setVisualSpeed(1.75);assert.equal(g.visualSpeed,1.75);
 g.setTheme('set2');
 const samples=Array.from({length:7},(_,i)=>g.kindColor(i+1));
 assert.equal(new Set(samples.map(c=>`${c.r},${c.g},${c.b}`)).size,7);
 g.setBackground('#142536');assert.equal(g.backgroundColor,'#142536');
 g.setPatchColor('#123abc');assert.equal(g.theme,'custom');
 assert.equal(g.kindColor(1).b,188);
 g.setDensity(8);g.resizeViewport(772,390);assert.equal(g.densityRows,8);
 assert.equal(PALETTES.set2.colors.length,7);
 assert.equal(paletteColor('sunset',7,0,'#112233').a,255);
});

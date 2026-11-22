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

test('プレイ中のゲーム時間設定は次回のゲームまで反映しない',()=>{
 const g=new Game({},seeded(125));g.setDuration(180);g.restart();
 g.start();g.tick(.1);
 const before=g.time;assert.ok(before>179);
 g.setDuration(30);
 assert.equal(g.initialSeconds,30);
 assert.equal(g.roundSeconds,180);
 g.tick(.1);
 assert.ok(g.time>170, '180秒のプレイ中に残り時間が短縮されてはいけない');
 assert.ok(Math.abs(g.time-before+.1)<.01);
 g.restart();
 assert.equal(g.roundSeconds,30);assert.equal(g.time,30);
});

test('回転直後の交換・消去中でも論理描画領域を更新し、処理後に安全に再配置する',()=>{
 const g=new Game({},seeded(451));
 assert.equal(g.resizeViewport(1024,768),true);
 const oldIds=new Set(g.board.flat().map(c=>c?.id));
 const move=g.findPossibleSwap();assert.ok(move);
 assert.equal(g.swap(...move),true);
 assert.equal(g.isBusy,true);
 const score=g.score,remaining=g.time,visual=g.visualNow;
 const finished=g.resizeViewport(768,1024);
 assert.equal(finished,false,'busy中の行列再編は延期する');
 assert.equal(g.width,768);
 assert.equal(g.height,1024);
 const activeWidth=g.mode==='stereo'?g.width/2:g.width;
 assert.ok(g.tile>0);
 assert.ok(g.originX>=-0.01&&g.originY>=-0.01);
 assert.ok(g.originX+g.cols*g.tile<=activeWidth+.01);
 assert.ok(g.originY+g.rows*g.tile<=g.height+.01);
 assert.equal(g.score,score);assert.equal(g.time,remaining);
 assert.equal(g.visualNow,visual);
 for(let i=0;i<300&&g.isBusy;i++)g.tick(.05);
 assert.equal(g.isBusy,false,'既存の消去処理が完了する');
 assert.equal(g.resizeViewport(768,1024),true);
 assert.equal(g.width,768);assert.equal(g.height,1024);
 assert.ok(g.board.flat().some(c=>oldIds.has(c?.id)));
 assert.equal(g.phase,'playing');
 assert.equal(g.resizeViewport(1024,768),true);
 assert.equal(g.resizeViewport(768,1024),true);
 assert.equal(g.resizeViewport(1024,768),true);
});
test('立体視モードのアニメーション中も片眼領域内に盤面を収める',()=>{
 const g=new Game({},seeded(771));
 g.cycleMode();g.cycleMode();
 assert.equal(g.mode,'stereo');
 g.resizeViewport(1024,768);
 const move=g.findPossibleSwap();assert.ok(move);
 assert.equal(g.swap(...move),true);
 assert.equal(g.resizeViewport(768,1024),false);
 assert.ok(g.originX>=-0.01);
 assert.ok(g.originX+g.cols*g.tile<=g.halfWidth+.01);
});

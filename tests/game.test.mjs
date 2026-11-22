import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,DESIGN,COLORS} from '../dist/game.js';
import {samplePatch,PATCH_FAMILIES,EDGE_FIT} from '../dist/gabor.js';
function seeded(seed=1){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}}
const forward=(g,sec)=>{for(let n=0;n<Math.ceil(sec/.05);n++)g.tick(.05)};
test('REQ-UI-001: 固定論理座標と最小行数',()=>{
 const g=new Game({},seeded());
 assert.equal(DESIGN.width,960);assert.equal(DESIGN.height,540);assert.equal(DESIGN.controlsWidth,80);
 assert.equal(g.cols,9);assert.equal(g.rows,6);assert.equal(g.tile,90);
 g.setRows(-1);assert.equal(g.rows,5);assert.equal(g.tile,108);assert.equal(g.cols,8);
 g.setRows(-99);assert.equal(g.rows,5);
 g.setRows(99);assert.equal(g.rows,16);assert.equal(g.tile,33);assert.equal(g.cols,26);
});
test('REQ-GAME-001: 初期盤面には成立済みのマッチがなく有効手がある',()=>{
 for(let n=0;n<15;n++){
   const g=new Game({},seeded(n+1));
   assert.equal(g.matchesAt({x:1,y:1}).length,0);
   assert.ok(g.findPossibleSwap());
 }
});
test('REQ-GAME-002: 有効交換で時間計測が始まり連鎖によって残り時間が増える',()=>{
 const g=new Game({},seeded(31));
 const matrix=Array.from({length:g.rows},(_,y)=>Array.from({length:g.cols},(_,x)=>(x*3+y*2)%6+1));
 matrix[0][0]=matrix[0][1]=1;matrix[0][2]=2;matrix[1][2]=1;
 g.loadBoard(matrix);
 assert.equal(g.swap({x:2,y:1},{x:2,y:0}),true);
 assert.equal(g.isPlaying,true);assert.equal(g.isBusy,true);
 forward(g,2);
 assert.ok(g.time>60,`time ${g.time} did not increase`);
 assert.ok(g.score>0);
 assert.equal(g.eventLog.some(e=>e.kind==='match'),true);
});
test('REQ-GAME-003: 隣接しないセルと盤外セルの交換を拒否する',()=>{
 const g=new Game({},seeded());
 assert.equal(g.swap({x:0,y:0},{x:2,y:0}),false);
 assert.equal(g.swap({x:0,y:0},{x:-1,y:0}),false);
 assert.equal(g.time,60);
});
test('REQ-GAME-004: モード切替で立体視の盤面幅を半分にする',()=>{
 const g=new Game({},seeded());g.cycleMode();assert.equal(g.mode,'binary');
 g.cycleMode();assert.equal(g.mode,'stereo');assert.equal(g.cols,4);
 g.cycleMode();assert.equal(g.mode,'gabor');assert.equal(g.cols,9);
});
test('REQ-HELP-001: ヒントを使うごとに時間消費が増える',()=>{
 const g=new Game({},seeded());g.hint();assert.ok(Math.abs(g.time-57)<.01);
 g.hint();assert.ok(Math.abs(g.time-53.1)<.01);
});
test('REQ-COLOR-001: 7種類の透過率と色設定を利用できる',()=>{
 const g=new Game({},seeded());
 const values=[];
 for(let i=0;i<7;i++){values.push(g.color.a);g.cycleColor()}
 assert.equal(COLORS.length,7);assert.deepEqual(values,[255,128,64,32,255,255,255]);
 assert.equal(g.colorIndex,0);
});
test('REQ-TEX-001: 14種類のガボール参数と透明な外周',()=>{
 assert.equal(PATCH_FAMILIES.normal.length,7);assert.equal(PATCH_FAMILIES.sharp.length,7);
 assert.ok(Math.abs(EDGE_FIT.sigmaX-15.529)<.001);
 for(const fam of ['normal','sharp'])for(let i=1;i<=7;i++){
   const [l,alpha]=samplePatch(i,fam,0,0);
   assert.ok(l>=0&&l<=255);assert.ok(alpha>254&&alpha<=255);
   const [,edge]=samplePatch(i,fam,49.5,49.5);
   assert.ok(edge<1,`edge ${i}/${fam} ${edge}`);
 }
});

test('REQ-GAME-005: 消去・落下・連鎖の実行順序を保持する',()=>{
 const g=new Game({},seeded(87));
 const move=g.findPossibleSwap();
 assert.ok(move);
 assert.equal(g.swap(...move),true);
 for(let i=0;i<200;i++)g.tick(.025);
 const observed=g.eventLog.map(e=>e.kind);
 assert.deepEqual(observed,['reset','swap','match','fall','match','fall']);
 const events=g.eventLog.filter(e=>e.kind==='match'||e.kind==='fall').map(e=>Math.round(e.time));
 assert.deepEqual(events,[200,400,1100,1300]);
 assert.equal(g.phase,'playing');
 assert.equal(g.isBusy,false);
});

/** ゲーム規則・時間軸・保存処理。CanvasやDOM描画には依存しない。 */
import {fitBoard} from './layout.js';
import {PALETTES,PALETTE_OPTIONS,paletteColor,isHexColor,type PaletteName} from './palette.js';
export type Mode = 'gabor' | 'binary' | 'stereo';
export type Special = 'none' | 'horizontal' | 'vertical' | 'bomb' | 'checker';
export interface Point { x:number; y:number; }
export interface Motion {from:Point; to:Point; start:number; duration:number; bounce?:boolean;}
export interface Cell { id:number; kind:number; special:Special; angle:number; rate:number; motion?:Motion; disappearing?:number; pulse?:number; tint?:string; }
interface Match {cells:Point[];axis:'x'|'y';type:number;}
interface Scheduled {at:number;action:()=>void;}
export interface Saved {rows:number;color:number;mode:Mode;best:number;totalSeconds:number;lastDay:string;duration:number;theme:PaletteName;background:string;patch:string;density:number;speed:number;paletteShift:number;}
export type ColorSpec={r:number;g:number;b:number;a:number};
export const COLORS:ColorSpec[]=[
 {r:255,g:255,b:255,a:255},{r:255,g:255,b:255,a:128},
 {r:255,g:255,b:255,a:64},{r:255,g:255,b:255,a:32},
 {r:255,g:0,b:0,a:255},{r:0,g:255,b:0,a:255},{r:0,g:0,b:255,a:255}
];
export const DESIGN={width:960,height:540,controlsWidth:80,baseTile:100,initialSeconds:60,
 removalMs:200,swapMs:200,fallMs:500,bounceMs:200} as const;
// 盤面の行数ごとの時間補正係数（設計幅960px基準）。
export const TIME_ADJUST=[2,2,2,2,2,1.69921875,1.69921875,1.787109375,1.71142578125,
 1.58447265625,1.36474609375,1.2060546875,1.01806640625,0.88134765625,
 0.762939453125,0.68359375,0.595703125,0.5,0.5,0.5,0.5] as const;
const STORAGE_KEY='gabor-pattern-puzzle/v1';
const clamp=(n:number,l:number,h:number)=>Math.min(h,Math.max(l,n));
const same=(a:Point,b:Point)=>a.x===b.x&&a.y===b.y;
const num=(n:unknown,f:number)=>typeof n==='number'&&Number.isFinite(n)?n:f;
const MODE_LIST:Mode[]=['gabor','binary','stereo'];
const DURATIONS=[30,60,90,120,180] as const;
const THEME_NAMES=PALETTE_OPTIONS.map(p=>p.id);
const today=()=>{const d=new Date();return `${d.getMonth()+1}/${d.getDate()}`};
export function loadSaved():Saved {
 const defaults:Saved={rows:6,color:0,mode:'gabor',best:0,totalSeconds:0,lastDay:today(),
   duration:60,theme:'set2',background:'',patch:'#49bfae',density:6,speed:1,paletteShift:0};
 try {
  const val=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}') as Partial<Saved>;
  const legacy=typeof val.theme!=='string'&&Object.keys(val).length>0;
  return {rows:clamp(Math.round(num(val.rows,6)),5,16),color:clamp(Math.round(num(val.color,0)),0,6),
    mode:MODE_LIST.includes(val.mode as Mode)?val.mode!:defaults.mode,
    best:num(val.best,0),totalSeconds:num(val.totalSeconds,0),lastDay:val.lastDay||defaults.lastDay,
    duration:DURATIONS.includes(val.duration as typeof DURATIONS[number])?val.duration!:60,
    theme:THEME_NAMES.includes(val.theme as PaletteName)?val.theme!:legacy?'classic':'set2',
    background:isHexColor(val.background)?val.background:'',
    patch:isHexColor(val.patch)?val.patch:'#49bfae',
    density:clamp(Math.round(num(val.density,num(val.rows,6))),4,10),
    speed:clamp(num(val.speed,1),0.25,2),
    paletteShift:clamp(Math.round(num(val.paletteShift,0)),0,6)};

 }catch{return defaults}
}
export function saveGame(game:Game):void {
 const data:Saved={rows:game.densityRows,color:game.colorIndex,mode:game.mode,
   best:game.best,totalSeconds:game.totalSeconds,lastDay:game.lastDay,
   duration:game.initialSeconds,theme:game.theme,background:game.backgroundOverride,
   patch:game.patchOverride,density:game.densityRows,speed:game.visualSpeed,
   paletteShift:game.paletteShift};
 try{localStorage.setItem(STORAGE_KEY,JSON.stringify(data))}catch{/* 保存領域が利用できない場合はゲーム進行を優先する */}
}
export interface Event { kind:'swap'|'match'|'fall'|'reset'|'gameover'|'hint'; time:number;value?:number; }

/** 盤面座標は上から下へ数え、描画スケールには依存しない。 */
export class Game {
 width:number=DESIGN.width;
 height:number=DESIGN.height;
 viewportSized=false;originX=0;originY=0;densityRows=6;
 initialSeconds=60;roundSeconds=60;visualSpeed=1;visualNow=0;paused=false;theme:PaletteName='set2';
 backgroundOverride='';patchOverride='#49bfae';paletteShift=0;
 readonly controlWidth=DESIGN.controlsWidth;
 rows=6; cols=9;tile=90;
 mode:Mode='gabor';colorIndex=0;
 family:'normal'|'sharp'='sharp';
 board:(Cell|null)[][]=[];
 score=0;best=0;time=60;totalSeconds=0;lastDay=today();
 phase:'ready'|'playing'|'resolving'|'over'='ready';
 now=0;
 startedAt:number|null=null;
 hintCount=0;
 active:Point|null=null;
 hintTintStart:number|null=null;
 eventLog:Event[]=[];
 private nextId=1;
 private tasks:Scheduled[]=[];
 private busy=false;
 private phaseAge=0;
 private rotationAge=0;
 private rotationIndex=0;
 private rotationPattern:'wait'|'rotate'|'random'|'degree'|'map'='degree';
 private rotationTarget=0;
 private rotationDuration=0;
 private readonly random:()=>number;
 private previewTime=0;

 constructor(saved?:Partial<Saved>,random:()=>number=Math.random){
   this.random=random;
   const v=saved??loadSaved();
   this.rows=clamp(num(v.rows,6),5,16);
   this.densityRows=clamp(num(v.density??v.rows,6),4,10);
   this.initialSeconds=DURATIONS.includes(v.duration as typeof DURATIONS[number])?v.duration!:60;
   this.roundSeconds=this.initialSeconds;
   this.visualSpeed=clamp(num(v.speed,1),0.25,2);
   this.theme=THEME_NAMES.includes(v.theme as PaletteName)?v.theme!:'set2';
   this.backgroundOverride=isHexColor(v.background)?v.background:'';
   this.patchOverride=isHexColor(v.patch)?v.patch:'#49bfae';
   this.paletteShift=clamp(Math.round(num(v.paletteShift,0)),0,6);
   this.colorIndex=clamp(num(v.color,0),0,6);
   this.mode=MODE_LIST.includes(v.mode as Mode)?v.mode!:'gabor';
   this.best=num(v.best,0);this.totalSeconds=num(v.totalSeconds,0);
   this.lastDay=v.lastDay||today();this.restart(false);
 }
 get color():ColorSpec{return COLORS[this.colorIndex]}
 kindColor(kind:number):ColorSpec{return this.theme==='classic'?this.color:paletteColor(this.theme,kind,this.paletteShift,this.patchOverride)}
 get backgroundColor():string {return this.backgroundOverride||(
   this.theme==='custom'?'#f1f3f6':this.theme==='classic'?(this.mode==='binary'?'#ffffff':'#808080'):PALETTES[this.theme].background)}
 setTheme(theme:PaletteName):void {if(!THEME_NAMES.includes(theme))return;this.theme=theme;saveGame(this)}
 setBackground(hex:string):void {if(!isHexColor(hex))return;this.backgroundOverride=hex;saveGame(this)}
 clearBackground():void {this.backgroundOverride='';saveGame(this)}
 setPatchColor(hex:string):void {if(!isHexColor(hex))return;this.patchOverride=hex;this.theme='custom';saveGame(this)}
 /** 右側の配色ボタンは全デザインを一定の順番で切り替える。 */
 cycleTheme():PaletteName {
   const i=PALETTE_OPTIONS.findIndex(p=>p.id===this.theme);
   const result=PALETTE_OPTIONS[(i+1)%PALETTE_OPTIONS.length].id;
   this.theme=result;this.paletteShift=0;saveGame(this);
   return result;
 }
 setDuration(sec:number):void {
   if(!DURATIONS.includes(sec as typeof DURATIONS[number]))return;
   this.initialSeconds=sec;
   // 開始前は即反映。進行中・終了後は次回restartまで現在の制限時間を保持する。
   if(this.phase==='ready'){this.roundSeconds=sec;this.time=sec}
   saveGame(this)
 }
 setVisualSpeed(speed:number):void {this.visualSpeed=clamp(num(speed,1),0.25,2);saveGame(this)}
 setDensity(value:number):void {this.densityRows=clamp(Math.round(value),4,10);if(this.viewportSized)this.resizeViewport(this.width,this.height,true);else this.setRows(this.densityRows-this.rows);saveGame(this)}
 get isBusy():boolean{return this.busy}
 get boardWidth():number{return this.cols*this.tile}
 get controlX():number{return this.viewportSized?this.width:DESIGN.width-DESIGN.controlsWidth}
 get halfWidth():number{return this.controlX/2}
 get isPlaying():boolean{return this.startedAt!==null&&this.phase!=='over'}
 get timeBarHeight():number{return this.height/this.roundSeconds*clamp(this.time,0,this.roundSeconds)}
 private emit(kind:Event['kind'],value?:number){this.eventLog.push({kind,time:this.now,value});if(this.eventLog.length>64)this.eventLog.shift()}
 private schedule(delay:number,action:()=>void){
   const task={at:this.now+Math.max(0,delay),action};
   const index=this.tasks.findIndex(existing=>existing.at>task.at);
   this.tasks.splice(index===-1?this.tasks.length:index,0,task);
 }
 private nextKind():number{return 1+Math.floor(this.random()*this.maxKinds)}
 private get maxKinds():number {return this.rows > (this.mode==='stereo'?6:5)?6:5}
 private makeCell(kind=this.nextKind(),special:Special='none'):Cell {
   return {id:this.nextId++,kind,special,angle:0,rate:0};
 }
 restart(persist=true):void {
   this.tasks=[];this.busy=false;this.paused=false;this.phase='ready';this.phaseAge=0;this.startedAt=null;
    this.hintTintStart=null;
   this.roundSeconds=this.initialSeconds;
   this.score=0;this.time=this.roundSeconds;this.hintCount=0;this.active=null;
   if(this.viewportSized){
     const v=fitBoard(this.width,this.height,this.densityRows,this.mode==='stereo');
     this.rows=v.rows;this.cols=v.cols;this.tile=v.tile;this.originX=v.originX;this.originY=v.originY;
   }else{
     this.rows=Math.round(clamp(this.rows,5,16));
     this.tile=Math.floor(DESIGN.height/this.rows);
     this.cols=Math.floor((this.mode==='stereo'?.5:1)*this.controlX/this.tile);
     this.originX=0;this.originY=0;
   }
   if(this.mode!=='binary')this.family=(this.family==='sharp'&&this.random()<.2)?'normal':'sharp';
   this.board=[];
   for(let y=0;y<this.rows;y++){
     const row:Cell[]=[];
     for(let x=0;x<this.cols;x++){
       let c=this.makeCell();
       // 開始直後に自動消去が起きない盤面を生成する。
       let tries=0;
       while(tries++<25 && (
         (x>=2&&row[x-1].kind===c.kind&&row[x-2].kind===c.kind)||
         (y>=2&&this.board[y-1][x]?.kind===c.kind&&this.board[y-2][x]?.kind===c.kind)))c=this.makeCell();
       row.push(c);
     }
     this.board.push(row);
   }
   if(!this.findPossibleSwap())this.shuffle();
   this.rotationAge=0;this.rotationIndex=0;this.rotationPattern='degree';this.rotationTarget=0;
   this.setRotationSequence();
   this.emit('reset');if(persist)saveGame(this);
 }
 setRows(n:number){if(this.busy)return;
   if(this.viewportSized){this.setDensity(this.densityRows+n);return}
   this.rows=clamp(this.rows+n,5,16);this.densityRows=this.rows;this.restart()
 }
 /** 画面回転時も進捗を保持し、盤面の重複領域を維持して周辺のみ補充する。 */
 resizeViewport(width:number,height:number,force=false):boolean {
   if(this.busy)return false;
   const w=Math.max(160,Math.round(width)),h=Math.max(160,Math.round(height));
    const layout=fitBoard(w,h,this.densityRows,this.mode==='stereo');
   const old=this.board,oldRows=this.rows,oldCols=this.cols;
   this.width=w;this.height=h;this.viewportSized=true;
   this.tile=layout.tile;this.rows=layout.rows;this.cols=layout.cols;
   this.originX=layout.originX;this.originY=layout.originY;
   if(!old.length){this.restart();return true}
   if(oldRows===this.rows&&oldCols===this.cols)return true;
   const dx=Math.floor((this.cols-oldCols)/2),dy=Math.floor((this.rows-oldRows)/2);
   const board:Cell[][]=[];
   for(let y=0;y<this.rows;y++){
     const row:Cell[]=[];
     for(let x=0;x<this.cols;x++){
       let cell=old[y-dy]?.[x-dx]??this.makeCell();
       let tries=0;
       while(tries++<30&&((x>=2&&row[x-1].kind===cell.kind&&row[x-2].kind===cell.kind)||
         (y>=2&&board[y-1][x].kind===cell.kind&&board[y-2][x].kind===cell.kind)))cell=this.makeCell();
       cell.motion=undefined;cell.disappearing=undefined;row.push(cell);
     }
     board.push(row);
   }
   this.board=board;
   if(!this.findPossibleSwap())this.shuffle();
   return true;
 }
 cycleMode(){if(this.busy||this.paused)return;this.mode=MODE_LIST[(MODE_LIST.indexOf(this.mode)+1)%3];this.restart()}
 cycleColor(){this.colorIndex=(this.colorIndex+1)%COLORS.length;this.emit('hint');saveGame(this)}
 private at(p:Point):Cell|null{return this.board[p.y]?.[p.x]??null}
 private inside(p:Point):boolean{return p.x>=0&&p.x<this.cols&&p.y>=0&&p.y<this.rows}
 private exchange(a:Point,b:Point){const tmp=this.board[a.y][a.x];this.board[a.y][a.x]=this.board[b.y][b.x];this.board[b.y][b.x]=tmp}
 private axial(a:Point,b:Point):boolean{return Math.abs(a.x-b.x)+Math.abs(a.y-b.y)===1}
 private matches():Match[]{
   const result:Match[]=[];
   for(let y=0;y<this.rows;y++)for(let x=0;x<this.cols;){
     const type=this.board[y][x]?.kind??0;let len=1;
     while(x+len<this.cols&&type!==0&&this.board[y][x+len]?.kind===type)len++;
     if(len>=3)result.push({type,axis:'x',cells:Array.from({length:len},(_,i)=>({x:x+i,y}))});
     x+=len;
   }
   for(let x=0;x<this.cols;x++)for(let y=0;y<this.rows;){
     const type=this.board[y][x]?.kind??0;let len=1;
     while(y+len<this.rows&&type!==0&&this.board[y+len][x]?.kind===type)len++;
     if(len>=3)result.push({type,axis:'y',cells:Array.from({length:len},(_,i)=>({x,y:y+i}))});
     y+=len;
   }
   return result;
 }
 matchesAt(p:Point):Match[]{return this.matches().filter(m=>m.cells.some(q=>same(p,q)))}
 findPossibleSwap():[Point,Point]|null{
   for(let y=0;y<this.rows;y++)for(let x=0;x<this.cols;x++){
     const a={x,y};for(const b of [{x:x+1,y},{x,y:y+1}]){
       if(!this.inside(b)||this.at(a)?.kind===this.at(b)?.kind)continue;
       this.exchange(a,b);const yes=this.matchesAt(a).length+this.matchesAt(b).length>0;
       this.exchange(a,b);if(yes)return[a,b];
     }
   }
   return null;
 }
 start(){if(!this.paused&&this.startedAt===null&&this.phase==='ready'){
   this.startedAt=this.now;this.phase='playing';this.phaseAge=0;
   if(this.lastDay!==today()){this.totalSeconds=0;this.lastDay=today()};
 }}
 /** 上下左右で隣接するセルへの交換を受け付ける。 */
 swap(a:Point,b:Point):boolean {
   if(!this.inside(a)||!this.inside(b)||!this.axial(a,b)||this.busy||this.paused||this.phase==='over')return false;
   this.start();
   const ca=this.at(a),cb=this.at(b);if(!ca||!cb)return false;
   this.busy=true;this.phase='resolving';this.active=null;
   this.exchange(a,b);this.emit('swap');
   ca.motion={from:a,to:b,start:this.now,duration:DESIGN.swapMs};
   cb.motion={from:b,to:a,start:this.now,duration:DESIGN.swapMs};
   this.schedule(DESIGN.swapMs,()=>{
     ca.motion=undefined;cb.motion=undefined;
     const m=this.matches().filter(group=>group.cells.some(p=>same(p,a)||same(p,b)));
     if(!m.length){
       this.exchange(a,b);
       ca.motion={from:b,to:a,start:this.now,duration:DESIGN.swapMs};
       cb.motion={from:a,to:b,start:this.now,duration:DESIGN.swapMs};
       this.schedule(DESIGN.swapMs,()=>{ca.motion=undefined;cb.motion=undefined;this.busy=false;this.phase='playing'});
     }else this.resolve(m);
   });
   return true;
 }
 /** 得点は経過時間で増え、消去によって残り時間が加算される。 */
 private timeBonus(count:number):number {
   const difficulty=(1-Math.min(400,Math.max(0,this.score-120))/400)*.5;
   return count*difficulty*(TIME_ADJUST[Math.min(this.rows,TIME_ADJUST.length-1)]??1);
 }
 private resolve(matches:Match[]):void {
   if(!matches.length){this.busy=false;this.phase=this.startedAt===null?'ready':'playing';return}
   this.busy=true;this.phase='resolving';this.emit('match',matches.length);
   const remove=new Set<string>();
   const rowMatch=new Map<string,number>();const colMatch=new Map<string,number>();
   let total=0;
   for(const m of matches){total+=m.cells.length;
     for(const p of m.cells){const key=`${p.x}:${p.y}`;remove.add(key);
       const map=m.axis==='x'?rowMatch:colMatch;map.set(key,m.cells.length);
     }
   }
   this.time+=this.timeBonus(total);
   // 4個・5個以上の消去や交点から特殊セルを生成する。
   const spawn=new Map<string,{kind:number;special:Special}>();
   for(const m of matches){if(m.cells.length<4)continue;
     const p=m.cells[m.cells.length-1];const key=`${p.x}:${p.y}`;
     let special:Special = m.cells.length>=5?'checker':m.axis==='x'?'vertical':'horizontal';
     if(rowMatch.has(key)&&colMatch.has(key))special='bomb';
     spawn.set(key,{kind:m.type,special});remove.delete(key);
   }
   for(const [key,len] of rowMatch){if(colMatch.has(key)){
     const [x,y]=key.split(':').map(Number);const kind=this.at({x,y})?.kind??1;
     spawn.set(key,{kind,special:'bomb'});remove.delete(key);
   }}
   // 特殊セルの消去範囲を展開し、同じセルを重複処理しない。
   const queue=[...remove].map(v=>v.split(':').map(Number)).map(([x,y])=>({x,y}));
   for(let idx=0;idx<queue.length;idx++){
     const p=queue[idx];const current=this.at(p);if(!current)continue;
     const expand:Point[]=[];
     if(current.special==='horizontal')for(let x=0;x<this.cols;x++)expand.push({x,y:p.y});
     if(current.special==='vertical')for(let y=0;y<this.rows;y++)expand.push({x:p.x,y});
     if(current.special==='bomb')for(let y=p.y-1;y<=p.y+1;y++)for(let x=p.x-1;x<=p.x+1;x++)expand.push({x,y});
     if(current.special==='checker')for(let y=0;y<this.rows;y++)for(let x=0;x<this.cols;x++)if((x+y)%2===0)expand.push({x,y});
     if(current.special!=='none')this.time+=this.timeBonus(current.special==='bomb'?9:this.cols);
     for(const t of expand)if(this.inside(t)){
       const key=`${t.x}:${t.y}`;if(!remove.has(key)){remove.add(key);queue.push(t)}
     }
   }
   for(const key of remove){const [x,y]=key.split(':').map(Number);const cell=this.board[y]?.[x];if(cell)cell.disappearing=this.now}
   this.schedule(DESIGN.removalMs,()=>{
     for(const key of remove){const [x,y]=key.split(':').map(Number);this.board[y][x]=null}
     for(const [key,value] of spawn){const [x,y]=key.split(':').map(Number);this.board[y][x]=this.makeCell(value.kind,value.special)}
     let falling=false;
     for(let x=0;x<this.cols;x++){
       const alive: {cell:Cell;oldY:number}[]=[];
       for(let y=this.rows-1;y>=0;y--){const cell=this.board[y][x];if(cell)alive.push({cell,oldY:y})}
       for(let i=0;i<this.rows;i++){
         const newY=this.rows-1-i;
         if(i<alive.length){
           const {cell,oldY}=alive[i];this.board[newY][x]=cell;
           if(oldY!==newY){falling=true;cell.motion={from:{x,y:oldY},to:{x,y:newY},start:this.now,duration:DESIGN.fallMs,bounce:true}}
         }else{
           falling=true;const cell=this.makeCell();this.board[newY][x]=cell;
           cell.motion={from:{x,y:newY-(this.rows-alive.length)},to:{x,y:newY},start:this.now,duration:DESIGN.fallMs,bounce:true};
         }
       }
     }
     this.emit('fall');
     this.schedule(falling?DESIGN.fallMs+DESIGN.bounceMs:100,()=>{
       for(const row of this.board)for(const c of row)if(c)c.motion=undefined;
       const next=this.matches();
       if(next.length)this.resolve(next);
       else{
         if(!this.findPossibleSwap())this.shuffle();
         this.busy=false;this.phase=this.startedAt===null?'ready':'playing';
       }
     });
   });
 }
 private shuffle(){
   for(let attempts=0;attempts<20;attempts++){
     for(let y=0;y<this.rows;y++)for(let x=0;x<this.cols;x++)this.board[y][x]=this.makeCell();
     if(!this.matches().length&&this.findPossibleSwap())break;
   }
 }
 hint():boolean {
   if(this.busy||this.paused||this.phase==='over')return false;
   this.start();this.time-=3*(1+this.hintCount*.3);this.hintCount++;
   this.hintTintStart=this.now;
   const move=this.findPossibleSwap();
   if(move){for(const p of move){const c=this.at(p);if(c)c.pulse=this.now+1000}this.emit('hint');return true}
   this.shuffle();this.emit('hint');return false;
 }
 private endGame(){
   this.phase='over';this.busy=false;this.startedAt=null;this.tasks=[];
   this.best=Math.max(this.best,Math.floor(this.score));
   this.totalSeconds+=this.score;
   saveGame(this);this.emit('gameover');
 }
 // 縞の回転パターンを描画から独立した時間列で管理する。
 private orientationTimeline():Array<{pattern:'wait'|'rotate'|'random'|'degree'|'map';duration:number;value:number|(()=>number);map?:'radial'|'columns'|'checker'|'rows'}>{
   const r=()=>this.random();
   const sequences:Array<{pattern:'wait'|'rotate'|'random'|'degree'|'map';duration:number;value:number|(()=>number);map?:'radial'|'columns'|'checker'|'rows'}>=[];
   const add=(pattern:'wait'|'rotate'|'random'|'degree'|'map',duration:number,value:number|(()=>number)=0,map?:'radial'|'columns'|'checker'|'rows')=>sequences.push({pattern,duration,value,map});
   // 待機中から渦巻き状の配列を見せる。時間経過後の既存パターンも保持する。
   add('map',0,90,'radial');add('rotate',18,180);
   add('degree',0,()=>Math.floor(r()*2)*90);
   add('wait',5);add('random',10);
   add('degree',20,()=>Math.floor(r()*4)*45);add('wait',5);add('random',10);
   add('degree',20,()=>Math.floor(r()*3)*90-90);add('wait',10);
   add('rotate',30,()=>90*(r()<.5?1:-1));add('wait',10);add('random',20);
   add('map',10,0,'radial');add('rotate',30,90);add('random',20);
   add('degree',20,()=>Math.floor(r()*4)*45);add('wait',5);add('random',10);
   add('degree',20,()=>Math.floor(r()*3)*90-90);add('wait',10);
   add('rotate',30,()=>90*(r()<.5?1:-1));add('wait',10);add('random',20);
   for(const map of ['columns','checker','rows'] as const){
     add('map',10,90,map);add('rotate',30,()=>180*(r()<.5?1:-1));
   }
   add('random',20);
   for(let i=0;i<8;i++){add('degree',0,i%2===0?0:90);add('wait',5)}
   for(let i=0;i<8;i++){add('degree',0,i%2===0?45:-45);add('wait',5)}
   for(let i=0;i<10;i++){add('random',0);add('wait',2)}
   add('map',0,90,'radial');add('rotate',20,()=>400*(r()<.5?1:-1));
   return sequences;
 }
 private getMapAngle(x:number,y:number,map:'radial'|'columns'|'checker'|'rows',value:number):number {
   if(map==='columns')return x%2===0?90:0;
   if(map==='checker')return (x+y)%2===0?90:0;
   if(map==='rows')return y%2===0?90:0;
   const normalizer=Math.max(this.cols,this.rows);
   const px=(x+.5-this.cols/2)/normalizer;
   const py=-(y+.5-this.rows/2)/normalizer;
   return value-90+180*Math.atan2(py,-px)/Math.PI;
 }
 private setRotationSequence():void {
   const timeline=this.orientationTimeline();
   if(this.startedAt===null&&this.rotationIndex>62)this.rotationIndex=1;
   if(this.startedAt!==null&&this.rotationIndex===13){
     const stages=[13,16,24,31,47,63];
     const upper=Math.min(stages.length-1,Math.floor(this.totalSeconds/200)+1);
     this.rotationIndex=stages[Math.floor(this.random()*upper)];
   }
   if(this.rotationIndex>=timeline.length)this.rotationIndex=1;
   const step=timeline[this.rotationIndex];
   this.rotationPattern=step.pattern;this.rotationDuration=step.duration;
   const value=this.rotationTarget=typeof step.value==='function'?step.value():step.value;
   for(let y=0;y<this.rows;y++)for(let x=0;x<this.cols;x++){
     const cell=this.board[y][x];if(!cell)continue;
     const angle=step.pattern==='random'?(this.random()*360-180):step.pattern==='map'?this.getMapAngle(x,y,step.map||'radial',value):value;
     if(step.pattern==='wait')cell.rate=0;
     else if(step.pattern==='rotate')cell.rate=value/Math.max(.01,step.duration);
     else if(step.duration===0){cell.angle=angle;cell.rate=0}
     else cell.rate=(angle-(cell.angle%180))/step.duration;
   }
   this.rotationIndex++;
 }
 tick(dtSeconds:number):void {
   const dt=clamp(dtSeconds,0,.12);
   this.visualNow+=dt*1000;
   // 設定を開いている間はゲームの時計を止め、模様の視覚変化だけ継続する。
   if(!this.paused){
     this.now+=dt*1000;this.phaseAge+=dt;
     if(this.isPlaying){this.time=clamp(this.time,0,Math.max(120,this.roundSeconds))-dt;this.score+=dt;
       if(this.time<=0){this.time=0;this.endGame()}}
     while(this.tasks.length&&this.tasks[0].at<=this.now){const task=this.tasks.shift()!;task.action()}
   }
   const visualDt=dt*this.visualSpeed;
   this.rotationAge+=visualDt;
   for(const row of this.board)for(const cell of row)if(cell)cell.angle+=cell.rate*visualDt;
   if(this.rotationAge>=this.rotationDuration){this.rotationAge=0;this.setRotationSequence()}
 }
 /** 描画に依存せず再現可能な盤面を設定するテスト用入口。 */
 loadBoard(matrix:number[][]){
   if(matrix.length!==this.rows||matrix.some(row=>row.length!==this.cols))throw new Error('盤面の行数・列数が一致しません');
   this.board=matrix.map(row=>row.map(kind=>this.makeCell(kind)));
   this.tasks=[];this.busy=false;this.paused=false;this.phase='ready';this.startedAt=null;this.roundSeconds=this.initialSeconds;this.time=this.roundSeconds;this.score=0;
 }
}

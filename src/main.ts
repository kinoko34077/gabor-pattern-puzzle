import {Game,type Point} from './game.js';
import {Renderer} from './render.js';
import {PALETTE_OPTIONS} from './palette.js';
import {ViewportController} from './viewport.js';
import {SettingsPanel} from './settings.js';

function el<T extends HTMLElement>(id:string):T{
 const node=document.getElementById(id);if(!node)throw new Error('UI要素が見つかりません: '+id);
 return node as T;
}
const canvas=el<HTMLCanvasElement>('game');
const stage=el<HTMLElement>('stage');
const game=new Game(),renderer=new Renderer(canvas);
const settings=el<HTMLElement>('settings');
const modeButton=el<HTMLButtonElement>('mode-button');
const toolbar=el<HTMLElement>('toolbar');
const plusButton=el<HTMLButtonElement>('plus-button');
const minusButton=el<HTMLButtonElement>('minus-button');
const themeToast=el<HTMLOutputElement>('theme-toast');
const paletteButton=el<HTMLButtonElement>('palette-button');
const settingsButton=el<HTMLButtonElement>('settings-button');
const hintButton=el<HTMLButtonElement>('hint-button');
const scoreValue=el<HTMLElement>('score-value');
const clock=el<HTMLElement>('clock');
const finished=el<HTMLElement>('finished');
const finalScore=el<HTMLElement>('final-score');
const bestScore=el<HTMLElement>('best-score');
const restartButton=el<HTMLButtonElement>('restart-button');
let last=performance.now();
const viewport=new ViewportController(game,renderer,stage,settings,settingsButton);

const modeLabel={gabor:'ガボール',binary:'白黒',stereo:'立体視'} as const;
function refreshHud():void {
 const points=String(Math.floor(game.score));
 if(scoreValue.textContent!==points)scoreValue.textContent=points;
 const t=game.phase==='ready'?game.roundSeconds:game.time;
 const timeString=Math.max(0,t).toFixed(1)+'秒';
 if(clock.textContent!==timeString)clock.textContent=timeString;
 const modeText=modeLabel[game.mode];
 if(modeButton.dataset.mode!==game.mode){modeButton.dataset.mode=game.mode;modeButton.setAttribute('aria-label','表示モード：'+modeText);modeButton.title='表示モード：'+modeText;}
 const themeIndex=PALETTE_OPTIONS.findIndex(p=>p.id===game.theme);
 const name=PALETTE_OPTIONS[themeIndex].label;
 const next=PALETTE_OPTIONS[(themeIndex+1)%PALETTE_OPTIONS.length].label;
 const description='現在：'+name+'。押すと'+next;
 if(paletteButton.title!==description){
   paletteButton.title=description;paletteButton.setAttribute('aria-label','配色：'+description);
 }
 const bg=game.backgroundColor;
 if(toolbar.dataset.color!==bg){
   toolbar.dataset.color=bg;toolbar.style.backgroundColor=bg;
   const channels=bg.match(/[a-f0-9]{2}/gi);
   if(channels&&channels.length===3){
     const [r,g,b]=channels.map(x=>parseInt(x,16));
     toolbar.style.color=(r*.2126+g*.7152+b*.0722)>151?'#353b49':'#eeeeee';
   }
 }
 panel.refreshPauseControls();
 finished.hidden=game.phase!=='over';
 if(game.phase==='over'){
   finalScore.textContent=String(Math.floor(game.score));
   bestScore.textContent=String(game.best);
 }
}
const panel=new SettingsPanel(game,canvas,settings,settingsButton,viewport,refreshHud,
  ()=>viewport.scheduleLayout(),()=>{startPoint=null;activeId=null});

function run(now:number):void{
 const dt=Math.min(.12,Math.max(0,(now-last)/1000));last=now;
 viewport.frame();
 game.tick(dt);renderer.render(game);refreshHud();
 requestAnimationFrame(run);
}
requestAnimationFrame(run);

function pointFrom(ev:PointerEvent):Point {
 const rect=canvas.getBoundingClientRect();
 const px=(ev.clientX-rect.left)/rect.width*game.width;
 const py=(ev.clientY-rect.top)/rect.height*game.height;
 const x=game.mode==='stereo'&&px>=game.halfWidth?px-game.halfWidth:px;
 return {x:Math.floor((x-game.originX)/game.tile),y:Math.floor((py-game.originY)/game.tile)};
}
let startPoint:Point|null=null,activeId:number|null=null;
canvas.addEventListener('pointerdown',ev=>{
 viewport.frame();
 if(game.phase==='over'||game.paused||!settings.hidden)return;
 if(ev.button!==0&&ev.pointerType==='mouse')return;
 ev.preventDefault();
 canvas.setPointerCapture(ev.pointerId);activeId=ev.pointerId;
 const p=pointFrom(ev);
 startPoint=p.x>=0&&p.x<game.cols&&p.y>=0&&p.y<game.rows&&!game.isBusy?p:null;
});
canvas.addEventListener('pointermove',ev=>{
 if(!startPoint||game.paused||activeId!==ev.pointerId||ev.pointerType==='mouse'&&!ev.buttons)return;
 const p=pointFrom(ev),origin=startPoint;
 if(origin.x===p.x&&origin.y===p.y)return;
 const target=Math.abs(p.x-origin.x)>=Math.abs(p.y-origin.y)
   ?{x:origin.x+Math.sign(p.x-origin.x),y:origin.y}
   :{x:origin.x,y:origin.y+Math.sign(p.y-origin.y)};
 game.swap(origin,target);startPoint=null;
});
function release(ev:PointerEvent):void{if(activeId===ev.pointerId){startPoint=null;activeId=null}}
canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);
canvas.addEventListener('contextmenu',ev=>ev.preventDefault());

canvas.tabIndex=0;canvas.setAttribute('role','application');
canvas.setAttribute('aria-label','ガボール模様を上下左右にドラッグして三つ以上そろえるパズル');
let focus:Point={x:0,y:0};
canvas.addEventListener('keydown',ev=>{
 const delta:Record<string,Point>={ArrowLeft:{x:-1,y:0},ArrowRight:{x:1,y:0},ArrowUp:{x:0,y:-1},ArrowDown:{x:0,y:1}};
 if(ev.key in delta){
   const d=delta[ev.key];
   if(ev.shiftKey)game.swap(focus,{x:focus.x+d.x,y:focus.y+d.y});
   else focus={x:Math.max(0,Math.min(game.cols-1,focus.x+d.x)),y:Math.max(0,Math.min(game.rows-1,focus.y+d.y))};
   ev.preventDefault();
 }else if(ev.key==='h'||ev.key==='H'){game.hint();ev.preventDefault()}
 else if(ev.key==='s'||ev.key==='S'){panel.toggleSettings();ev.preventDefault()}
 else if(game.phase==='over'&&(ev.key==='Enter'||ev.key===' ')){game.restart();ev.preventDefault()}
});

modeButton.addEventListener('click',()=>{game.cycleMode();viewport.scheduleLayout();refreshHud()});
hintButton.addEventListener('click',()=>game.hint());
let toastTimer:ReturnType<typeof setTimeout>;
function cycleVisibleTheme():void {
 const value=game.cycleTheme();panel.syncControls();refreshHud();
 const label=PALETTE_OPTIONS.find(p=>p.id===value)!.label;
 themeToast.textContent='配色：'+label;themeToast.hidden=false;
 clearTimeout(toastTimer);
 toastTimer=setTimeout(()=>{themeToast.hidden=true},1100);
}
paletteButton.addEventListener('click',cycleVisibleTheme);
plusButton.addEventListener('click',()=>{game.setDensity(game.densityRows-1);panel.syncControls();viewport.scheduleLayout()});
minusButton.addEventListener('click',()=>{game.setDensity(game.densityRows+1);panel.syncControls();viewport.scheduleLayout()});
restartButton.addEventListener('click',()=>{game.restart();refreshHud()});
Object.defineProperty(window,'__gaborPuzzleDev',{value:{game,renderer},configurable:false});

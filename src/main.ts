import {Game,type Point} from './game.js';
import {Renderer} from './render.js';
import {PALETTE_OPTIONS,type PaletteName} from './palette.js';

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
const pauseIndicator=el<HTMLOutputElement>('pause-indicator');
const paletteButton=el<HTMLButtonElement>('palette-button');
const settingsButton=el<HTMLButtonElement>('settings-button');
const hintButton=el<HTMLButtonElement>('hint-button');
const scoreValue=el<HTMLElement>('score-value');
const clock=el<HTMLElement>('clock');
const finished=el<HTMLElement>('finished');
const finalScore=el<HTMLElement>('final-score');
const bestScore=el<HTMLElement>('best-score');
const restartButton=el<HTMLButtonElement>('restart-button');
const themeSelect=el<HTMLSelectElement>('theme');
const durationSelect=el<HTMLSelectElement>('duration');
const backgroundInput=el<HTMLInputElement>('background');
const patchInput=el<HTMLInputElement>('patch');
const densityInput=el<HTMLInputElement>('density');
const speedInput=el<HTMLInputElement>('speed');
const densityValue=el<HTMLElement>('density-value');
const speedValue=el<HTMLElement>('speed-value');
const resetBackground=el<HTMLButtonElement>('reset-background');
const pauseButton=el<HTMLButtonElement>('pause-button');
const endGameButton=el<HTMLButtonElement>('end-game-button');
const closeSettingsButton=el<HTMLButtonElement>('close-settings');
let manuallyPaused=false;

for(const option of PALETTE_OPTIONS){
 const item=document.createElement('option');item.value=option.id;item.textContent=option.label;themeSelect.add(item);
}
let last=performance.now(),needsLayout=true;
function updateLayout():void {
 // CSS実寸を基準に描画サイズ・操作座標を同期する。回転直後の中間サイズは再計測する。
 const rect=stage.getBoundingClientRect();
 const w=Math.round(rect.width),h=Math.round(rect.height);
 if(w<10||h<10){needsLayout=true;return}
 const settled=game.resizeViewport(w,h);
 // busy中でも盤面の論理幅・高さは先に切り替え、Canvasの引き伸ばしを防ぐ。
 renderer.resize(game.width,game.height,window.devicePixelRatio||1);
 needsLayout=!settled;
 placeSettings();
}
function scheduleLayout():void {needsLayout=true;requestAnimationFrame(updateLayout)}
function syncViewportSize():void {
 const visual=window.visualViewport;
 // ピンチズーム中は表示領域を縮め直さず、通常の拡大操作を維持する。
 const viewport=visual&&Math.abs(visual.scale-1)<0.015?visual:null;
 const width=viewport?.width??window.innerWidth;
 const height=viewport?.height??window.innerHeight;
 if(width>10&&height>10&&Number.isFinite(width)&&Number.isFinite(height)){
   const root=document.documentElement.style;
   const w=Math.round(width*100)/100+'px',h=Math.round(height*100)/100+'px';
   if(root.getPropertyValue('--app-width')!==w)root.setProperty('--app-width',w);
   if(root.getPropertyValue('--app-height')!==h)root.setProperty('--app-height',h);
 }
 scheduleLayout();
}
new ResizeObserver(scheduleLayout).observe(stage);
window.addEventListener('resize',syncViewportSize);
window.addEventListener('orientationchange',syncViewportSize);
window.visualViewport?.addEventListener('resize',syncViewportSize);
window.visualViewport?.addEventListener('scroll',placeSettings);
syncViewportSize();

const modeLabel={gabor:'ガボール',binary:'白黒',stereo:'立体視'} as const;
function syncControls():void {
 durationSelect.value=String(game.initialSeconds);
 themeSelect.value=game.theme;
 backgroundInput.value=game.backgroundColor;
 patchInput.value=game.patchOverride;
 densityInput.value=String(game.densityRows);
 speedInput.value=String(game.visualSpeed);
 densityValue.textContent=String(game.densityRows);
 speedValue.textContent=game.visualSpeed.toFixed(2)+'倍';
}
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
 pauseIndicator.hidden=!manuallyPaused;
 pauseButton.textContent=manuallyPaused?'再開':'一時停止';
 pauseButton.disabled=!manuallyPaused&&!game.isPlaying;
 pauseButton.setAttribute('aria-pressed',String(manuallyPaused));
 finished.hidden=game.phase!=='over';
 if(game.phase==='over'){
   finalScore.textContent=String(Math.floor(game.score));
   bestScore.textContent=String(game.best);
 }
}
function run(now:number):void{
 const dt=Math.min(.12,Math.max(0,(now-last)/1000));last=now;
 if(needsLayout)updateLayout();
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
 if(needsLayout)updateLayout();
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
 else if(ev.key==='s'||ev.key==='S'){toggleSettings();ev.preventDefault()}
 else if(game.phase==='over'&&(ev.key==='Enter'||ev.key===' ')){game.restart();ev.preventDefault()}
});

modeButton.addEventListener('click',()=>{game.cycleMode();scheduleLayout();refreshHud()});
hintButton.addEventListener('click',()=>game.hint());
let toastTimer:ReturnType<typeof setTimeout>;
function cycleVisibleTheme():void {
 const value=game.cycleTheme();syncControls();refreshHud();
 const label=PALETTE_OPTIONS.find(p=>p.id===value)!.label;
 themeToast.textContent='配色：'+label;themeToast.hidden=false;
 clearTimeout(toastTimer);
 toastTimer=setTimeout(()=>{themeToast.hidden=true},1100);
}
paletteButton.addEventListener('click',cycleVisibleTheme);
plusButton.addEventListener('click',()=>{game.setDensity(game.densityRows-1);syncControls();scheduleLayout()});
minusButton.addEventListener('click',()=>{game.setDensity(game.densityRows+1);syncControls();scheduleLayout()});
restartButton.addEventListener('click',()=>{game.restart();refreshHud()});
function syncPause():void {
 // 設定中は従来どおり時間と得点のみ一時停止する。明示停止は閉じた後も維持。
 game.paused=manuallyPaused||!settings.hidden;
 refreshHud();
}
function placeSettings():void {
 if(settings.hidden)return;
 const button=settingsButton.getBoundingClientRect();
 const popup=settings.getBoundingClientRect();
 const margin=8;
 const bodyRect=document.body.getBoundingClientRect();
 const bodyStyle=getComputedStyle(document.body);
 const inset=(v:string)=>Number.parseFloat(v)||0;
 const leftMin=bodyRect.left+inset(bodyStyle.paddingLeft)+margin;
 const topMin=bodyRect.top+inset(bodyStyle.paddingTop)+margin;
 const leftMax=Math.max(leftMin,bodyRect.right-inset(bodyStyle.paddingRight)-popup.width-margin);
 const topMax=Math.max(topMin,bodyRect.bottom-inset(bodyStyle.paddingBottom)-popup.height-margin);
 const clamp=(x:number,min:number,max:number)=>Math.max(min,Math.min(max,x));
 const vertical=window.matchMedia('(orientation: portrait)').matches;
 const left=vertical?button.right-popup.width:button.left-popup.width-8;
 const top=vertical?button.top-popup.height-8:button.top;
 settings.style.left=clamp(left,leftMin,leftMax)+'px';
 settings.style.top=clamp(top,topMin,topMax)+'px';
}
function openSettings():void {
 if(!settings.hidden)return;
 syncControls();startPoint=null;activeId=null;
 settings.hidden=false;
 settingsButton.setAttribute('aria-expanded','true');
 syncPause();placeSettings();
 // モーダルから非モーダルに変わっても、キーボード利用者の操作起点を明示する。
 closeSettingsButton.focus({preventScroll:true});
}
function closeSettings():void {
 if(settings.hidden)return;
 const focusWasInside=settings.contains(document.activeElement);
 settings.hidden=true;
 settingsButton.setAttribute('aria-expanded','false');
 syncPause();
 // 非表示のパネル内にフォーカスを残さず、従来どおり盤面のキー操作へ戻す。
 if(focusWasInside)canvas.focus({preventScroll:true});
}
function toggleSettings():void {
 if(settings.hidden)openSettings();
 else closeSettings();
}
settingsButton.addEventListener('click',toggleSettings);
closeSettingsButton.addEventListener('click',closeSettings);
pauseButton.addEventListener('click',()=>{
 if(!manuallyPaused&&!game.isPlaying)return;
 manuallyPaused=!manuallyPaused;
 closeSettings();syncPause();
});
endGameButton.addEventListener('click',()=>{
 manuallyPaused=false;
 game.restart();
 closeSettings();syncPause();refreshHud();
});
document.addEventListener('pointerdown',ev=>{
 const target=ev.target as Node;
 if(!settings.hidden&&!settings.contains(target)&&!settingsButton.contains(target)){
   closeSettings();
 }
});
window.addEventListener('keydown',ev=>{
 if(ev.key==='Escape'&&!settings.hidden){closeSettings();ev.preventDefault()}
});
window.addEventListener('resize',placeSettings);
durationSelect.addEventListener('change',()=>game.setDuration(Number(durationSelect.value)));
themeSelect.addEventListener('change',()=>{game.setTheme(themeSelect.value as PaletteName);backgroundInput.value=game.backgroundColor});
backgroundInput.addEventListener('input',()=>game.setBackground(backgroundInput.value));
resetBackground.addEventListener('click',()=>{game.clearBackground();backgroundInput.value=game.backgroundColor});
patchInput.addEventListener('input',()=>{game.setPatchColor(patchInput.value);themeSelect.value=game.theme});
densityInput.addEventListener('input',()=>{game.setDensity(Number(densityInput.value));densityValue.textContent=String(game.densityRows);scheduleLayout()});
speedInput.addEventListener('input',()=>{game.setVisualSpeed(Number(speedInput.value));speedValue.textContent=game.visualSpeed.toFixed(2)+'倍'});
syncControls();
Object.defineProperty(window,'__gaborPuzzleDev',{value:{game,renderer},configurable:false});

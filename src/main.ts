import {Game,DESIGN,type Point} from './game.js';
import {Renderer} from './render.js';
const canvas=document.getElementById('game') as HTMLCanvasElement|null;
if(!canvas)throw new Error('Missing game canvas');
const game=new Game();
const renderer=new Renderer(canvas);
let last=performance.now();
function run(now:number){const dt=Math.min(.12,(now-last)/1000);last=now;game.tick(dt);renderer.render(game);requestAnimationFrame(run)}
requestAnimationFrame(run);
// Pointer coordinate translation uses the 960×540 logical layout.
function pointFrom(ev:PointerEvent):Point & {px:number;py:number} {
 const r=canvas!.getBoundingClientRect();
 let px=(ev.clientX-r.x)/r.width*DESIGN.width;
 let py=(ev.clientY-r.y)/r.height*DESIGN.height;
 // The canvas is visually rotated on portrait screens, not the game coordinate space.
 if(window.innerHeight>window.innerWidth && matchMedia('(max-width: 700px)').matches){
   // In portrait CSS rotation: local X advances down the viewport, local Y advances left.
   const cx=(ev.clientX-window.innerWidth/2),cy=(ev.clientY-window.innerHeight/2);
   px=(cy+canvas!.clientWidth/2)/canvas!.clientWidth*DESIGN.width;
   py=(-cx+canvas!.clientHeight/2)/canvas!.clientHeight*DESIGN.height;
 }
 const boardX=game.mode==='stereo'&&px>=game.halfWidth&&px<game.controlX?px-game.halfWidth:px;
 return {px,py,x:Math.floor(boardX/game.tile),y:Math.floor(py/game.tile)};
}
let startPoint:Point|null=null;let activeId:number|null=null;
canvas.addEventListener('pointerdown',ev=>{
 ev.preventDefault();if(ev.button!==0&&ev.pointerType==='mouse')return;
 canvas.setPointerCapture(ev.pointerId);activeId=ev.pointerId;
 const p=pointFrom(ev);
 if(game.phase==='over'){
   if(p.px<game.controlX){game.restart()};return;
 }
 if(p.px>=game.controlX){
   const center=game.controlX+30,yy=p.py;
   if(Math.abs(p.px-center)<39){
     if(Math.abs(yy-35)<27)game.toggleMute();
     else if(Math.abs(yy-80)<36)game.cycleMode();
     else if(Math.abs(yy-165)<38)game.cycleColor();
     else if(Math.abs(yy-250)<38)game.setRows(-1);
     else if(Math.abs(yy-335)<38)game.setRows(+1);
     else if(Math.abs(yy-420)<38)game.hint();
   }
   startPoint=null;return;
 }
 if(p.x>=0&&p.x<game.cols&&p.y>=0&&p.y<game.rows&&!game.isBusy)startPoint={x:p.x,y:p.y};
 else startPoint=null;
});
canvas.addEventListener('pointermove',ev=>{
 if(startPoint===null||activeId!==ev.pointerId||!ev.buttons&&ev.pointerType==='mouse')return;
 const p=pointFrom(ev);const old=startPoint;
 if(old.x===p.x&&old.y===p.y)return;
 const x=old.x+Math.sign(p.x-old.x),y=old.y+Math.sign(p.y-old.y);
 const target=p.x!==old.x?{x,y:old.y}:{x:old.x,y};
 game.swap(old,target);startPoint=null;
});
function clear(ev:PointerEvent){if(ev.pointerId===activeId){startPoint=null;activeId=null}}
canvas.addEventListener('pointerup',clear);canvas.addEventListener('pointercancel',clear);
canvas.addEventListener('contextmenu',ev=>ev.preventDefault());
// Keyboard navigation remains available without changing the game viewport.
canvas.tabIndex=0;canvas.setAttribute('role','application');
canvas.setAttribute('aria-label','ガボールパッチを上下左右にドラッグして三つ以上そろえるパズル');
let focus:Point={x:0,y:0};
canvas.addEventListener('keydown',ev=>{
 if(game.phase==='over'&&(ev.key==='Enter'||ev.key===' ')){game.restart();ev.preventDefault();return}
 const delta:Record<string,Point>={ArrowLeft:{x:-1,y:0},ArrowRight:{x:1,y:0},ArrowUp:{x:0,y:-1},ArrowDown:{x:0,y:1}};
 if(ev.key in delta){
   const d=delta[ev.key];
   if(ev.shiftKey){game.swap(focus,{x:focus.x+d.x,y:focus.y+d.y});}
   else focus={x:Math.max(0,Math.min(game.cols-1,focus.x+d.x)),y:Math.max(0,Math.min(game.rows-1,focus.y+d.y))};
   ev.preventDefault();
 }else if(ev.key==='h'||ev.key==='H'){game.hint();ev.preventDefault()}
});
Object.defineProperty(window,'__gaborPuzzleDev',{value:{game,renderer},configurable:false});

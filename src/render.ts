import {Game,DESIGN,COLORS,type Cell,type Mode,type Point,type ColorSpec} from './game.js';
import {generatePatch,type PatchFamily} from './gabor.js';

const HINT_COLORS:readonly ColorSpec[]=[
 {r:255,g:0,b:255,a:255},{r:0,g:255,b:255,a:255},
 {r:255,g:0,b:0,a:255},{r:0,g:0,b:255,a:255},
 {r:0,g:255,b:0,a:255},{r:0,g:0,b:0,a:255},
 {r:255,g:128,b:0,a:255}
];
const TAU=Math.PI*2;
const clamp=(n:number,l=0,h=1)=>Math.min(h,Math.max(l,n));
const ease=(t:number)=>{const x=clamp(t);return x*x*(3-2*x)};

/** 外部描画エンジンに依存せず、ガボール画像を数学的に生成して描画する。 */
export class Renderer {
 private readonly canvas:HTMLCanvasElement;
 private readonly ctx:CanvasRenderingContext2D;
 private readonly textures=new Map<string,HTMLCanvasElement>();
 private readonly density=2;
 constructor(canvas:HTMLCanvasElement){
   this.canvas=canvas;this.canvas.width=DESIGN.width*this.density;this.canvas.height=DESIGN.height*this.density;
   const context=canvas.getContext('2d',{alpha:false,desynchronized:true});
   if(!context)throw new Error('Canvas 2Dを利用できません');this.ctx=context;
 }
 private texture(kind:number,family:PatchFamily,color:ColorSpec):HTMLCanvasElement {
   const name=`${kind}/${family}/${color.r}/${color.g}/${color.b}`;
   const cached=this.textures.get(name);if(cached)return cached;
   const size=256;
   const data=generatePatch(kind,family,size),bytes=data.data;
   if(color.r!==255||color.g!==255||color.b!==255){
     for(let i=0;i<bytes.length;i+=4){
       bytes[i]=Math.round(bytes[i]*color.r/255);
       bytes[i+1]=Math.round(bytes[i+1]*color.g/255);
       bytes[i+2]=Math.round(bytes[i+2]*color.b/255);
     }
   }
   const cv=document.createElement('canvas');cv.width=cv.height=size;
   const cx=cv.getContext('2d');if(!cx)throw Error('画像生成用Canvasを利用できません');cx.putImageData(data,0,0);
   this.textures.set(name,cv);return cv;
 }
 private offset(cell:Cell,point:Point,now:number):Point {
   const m=cell.motion;if(!m)return point;
   const t=clamp((now-m.start)/m.duration);
   const p=m.bounce&&t>0.8?1+.018*Math.sin(Math.PI*(t-.8)/.2):ease(t);
   return {x:m.from.x+(m.to.x-m.from.x)*p,y:m.from.y+(m.to.y-m.from.y)*p};
 }
 render(game:Game):void{
   const ctx=this.ctx;
   ctx.setTransform(this.density,0,0,this.density,0,0);
   ctx.clearRect(0,0,DESIGN.width,DESIGN.height);
   ctx.fillStyle=game.mode==='binary'?'#fff':'rgb(128,128,128)';
   ctx.fillRect(0,0,DESIGN.width,DESIGN.height);
   ctx.save();ctx.beginPath();ctx.rect(0,0,game.controlX,DESIGN.height);ctx.clip();
   const tint=game.color;
   const family:PatchFamily=game.mode==='binary'?'binary':game.family;
   // ヒントの色変化は各セル共通。フレームにつき1回だけ求める。
   const hintElapsed=game.hintTintStart===null?Infinity:(game.now-game.hintTintStart)/1000;
   const hintBlend=hintElapsed<0?0:hintElapsed<.5?hintElapsed/.5:hintElapsed<4.5?1-(hintElapsed-.5)/4:0;
   for(let y=0;y<game.rows;y++)for(let x=0;x<game.cols;x++){
     const cell=game.board[y][x];if(!cell)continue;
     const point=this.offset(cell,{x,y},game.now);
     const base=game.tile;
     const stereoShrink=game.mode==='stereo'?1-cell.kind/30:1;
     let scale=1;
     if(cell.disappearing!==undefined)scale=1-ease((game.now-cell.disappearing)/DESIGN.removalMs);
     if(cell.pulse!==undefined&&game.now<cell.pulse){
       const t=1-(cell.pulse-game.now)/1000;scale+=.15*Math.sin(Math.PI*t);
     }
     const widthFactor=cell.special==='horizontal'?1.5:cell.special==='vertical'?.8:cell.special==='checker'?1.5:cell.special==='bomb'?.6:1;
     const heightFactor=cell.special==='vertical'?1.5:cell.special==='horizontal'?.8:cell.special==='checker'?1.5:cell.special==='bomb'?.6:1;
     const tex=this.texture(cell.kind,family,tint);
     const hintTex=hintBlend>0?this.texture(cell.kind,family,HINT_COLORS[(cell.kind-1)%HINT_COLORS.length]):null;
     const left=(point.x+.5)*base;
     const top=(point.y+.5)*base;
     this.drawPatch(tex,left,top,base*scale*stereoShrink*widthFactor,
       base*scale*stereoShrink*heightFactor,cell.angle,tint.a/255);
     if(hintTex)this.drawPatch(hintTex,left,top,base*scale*stereoShrink*widthFactor,
       base*scale*stereoShrink*heightFactor,cell.angle,hintBlend);
     if(game.mode==='stereo'){
       const sx=left+game.halfWidth+(1-stereoShrink)*45;
       this.drawPatch(tex,sx,top,base*scale*stereoShrink*widthFactor,
         base*scale*stereoShrink*heightFactor,cell.angle,tint.a/255);
       if(hintTex)this.drawPatch(hintTex,sx,top,base*scale*stereoShrink*widthFactor,
         base*scale*stereoShrink*heightFactor,cell.angle,hintBlend);
     }
   }
   ctx.restore();
   this.drawTimeBar(game);
   if(game.mode==='stereo')this.drawStereoMarks(game);
   this.drawControls(game);
   if(game.phase==='over')this.drawGameOver(game);
 }
 private drawPatch(tex:HTMLCanvasElement,x:number,y:number,w:number,h:number,rotation:number,alpha:number):void {
   const ctx=this.ctx;ctx.save();ctx.translate(x,y);ctx.rotate(rotation*Math.PI/180);
   ctx.globalAlpha=alpha;ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
   ctx.drawImage(tex,-w/2,-h/2,w,h);ctx.restore();
 }
 private drawTimeBar(game:Game):void {
   const ctx=this.ctx;
   const v=clamp(game.time,0,120);
   const ht=DESIGN.height*v/120;
   ctx.fillStyle=`rgba(255,${Math.round(135+v)},${Math.round(135+v)},0.5)`;
   ctx.fillRect(0,DESIGN.height-ht,16,ht);
   if(game.mode==='stereo')ctx.fillRect(game.halfWidth,DESIGN.height-ht,16,ht);
 }
 private drawStereoMarks(game:Game):void{
   const ctx=this.ctx;ctx.fillStyle='#f00';
   for(const x of [game.halfWidth/2,game.halfWidth*1.5]){
     ctx.beginPath();ctx.arc(x,30,5,0,TAU);ctx.fill();
   }
 }
 private drawControls(game:Game):void{
   const ctx=this.ctx,center=game.controlX+30;
   ctx.save();ctx.strokeStyle='rgba(219,219,219,.88)';ctx.fillStyle='rgba(222,222,222,.85)';
   ctx.lineCap='round';ctx.lineJoin='round';
   this.drawVibration(center,35,ctx,game.muted);
   this.drawMode(center,80,ctx,game.mode);
   this.drawInk(center,165,ctx);
   this.drawPlusMinus(center,250,ctx,true);
   this.drawPlusMinus(center,335,ctx,false);
   this.drawBulb(center,420,ctx);
   ctx.font='bold 27px system-ui, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
   ctx.fillText(String(Math.floor(game.score)),center,499);
   ctx.restore();
 }
 private drawVibration(x:number,y:number,ctx:CanvasRenderingContext2D,muted:boolean):void{
   ctx.lineWidth=1.3;ctx.strokeRect(x-5,y-7,10,14);
   for(let k of [-1,1]){
     ctx.beginPath();ctx.moveTo(x+k*8,y-8);ctx.lineTo(x+k*8,y+8);ctx.stroke();
     ctx.beginPath();ctx.moveTo(x+k*10,y-5);ctx.lineTo(x+k*10,y+5);ctx.stroke();
   }
   if(muted){ctx.beginPath();ctx.moveTo(x-11,y+10);ctx.lineTo(x+11,y-10);ctx.stroke()}
 }
 private drawMode(x:number,y:number,ctx:CanvasRenderingContext2D,mode:Mode):void{
   ctx.lineWidth=1.45;
   for(let k=-2;k<=2;k++){
     const cx=x+k*6;
     ctx.beginPath();
     if(mode==='binary'){
       ctx.moveTo(cx-1,y-9);ctx.lineTo(cx-1,y+9);
     }else{
       for(let i=0;i<=18;i++){
         const py=y-9+i,px=cx+Math.sin(i/18*Math.PI*2)*(k%2?1.5:2.5);
         if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);
       }
     }
     ctx.stroke();
   }
 }
 private drawInk(x:number,y:number,ctx:CanvasRenderingContext2D):void{
   ctx.save();ctx.translate(x,y-3);ctx.rotate(Math.PI/4);ctx.lineWidth=2.2;
   ctx.strokeRect(-11,-10,22,18);ctx.strokeRect(-9,-14,18,4);
   ctx.beginPath();ctx.moveTo(-8,8);ctx.lineTo(7,8);ctx.stroke();
   ctx.restore();
   ctx.beginPath();ctx.ellipse(x-8,y+25,2.5,4.5,-.3,0,TAU);ctx.fill();
 }
 private drawPlusMinus(x:number,y:number,ctx:CanvasRenderingContext2D,plus:boolean):void {
   ctx.lineWidth=2.1;ctx.beginPath();ctx.arc(x,y,19,0,TAU);ctx.stroke();
   ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x-9,y);ctx.lineTo(x+9,y);ctx.stroke();
   if(plus){ctx.beginPath();ctx.moveTo(x,y-9);ctx.lineTo(x,y+9);ctx.stroke()}
 }
 private drawBulb(x:number,y:number,ctx:CanvasRenderingContext2D):void {
   ctx.lineWidth=2.2;ctx.beginPath();ctx.moveTo(x-10,y+5);
   ctx.bezierCurveTo(x-23,y-8,x-11,y-21,x,y-20);
   ctx.bezierCurveTo(x+12,y-20,x+22,y-6,x+10,y+6);
   ctx.lineTo(x+6,y+10);ctx.lineTo(x+6,y+16);ctx.lineTo(x-6,y+16);ctx.lineTo(x-6,y+10);ctx.closePath();ctx.stroke();
   ctx.beginPath();ctx.moveTo(x-6,y+19);ctx.lineTo(x+6,y+19);ctx.moveTo(x-4,y+23);ctx.lineTo(x+4,y+23);ctx.stroke();
   for(let deg=195;deg<=345;deg+=30){const r=deg*Math.PI/180;
     ctx.beginPath();ctx.moveTo(x+Math.cos(r)*24,y+Math.sin(r)*24);
     ctx.lineTo(x+Math.cos(r)*28,y+Math.sin(r)*28);ctx.stroke();
   }
 }
 private drawGameOver(game:Game):void {
   const ctx=this.ctx;
   ctx.save();ctx.fillStyle=game.mode==='binary'?'rgba(255,255,255,.92)':'rgba(128,128,128,.92)';
   ctx.fillRect(0,0,game.controlX,DESIGN.height);
   ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=game.mode==='binary'?'#444':'#eee';
   ctx.font='26px sans-serif';ctx.fillText('ゲーム終了',game.controlX/2,140);
   ctx.font='bold 72px system-ui';ctx.fillText(String(Math.floor(game.score)),game.controlX/2,240);
   ctx.font='20px sans-serif';ctx.fillText(`最高記録 ${game.best}`,game.controlX/2,300);
   ctx.strokeStyle='currentColor';ctx.lineWidth=2;ctx.strokeRect(game.controlX/2-110,355,220,64);
   ctx.font='22px sans-serif';ctx.fillText('もう一度',game.controlX/2,387);
   ctx.restore();
 }
}

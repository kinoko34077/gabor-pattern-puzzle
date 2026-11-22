import {Game,DESIGN,type Cell,type Point,type ColorSpec} from './game.js';
import {generatePatch,type PatchFamily} from './gabor.js';

const TAU=Math.PI*2;
const clamp=(n:number,l=0,h=1)=>Math.min(h,Math.max(l,n));
const ease=(t:number)=>{const x=clamp(t);return x*x*(3-2*x)};
type PatchTexture={base:HTMLCanvasElement;soft:HTMLCanvasElement};

/** 画面全体に描画し、物理ピクセル密度の上限でメモリ消費を抑える。 */
export class Renderer {
 private readonly canvas:HTMLCanvasElement;
 private readonly ctx:CanvasRenderingContext2D;
 private readonly textures=new Map<string,PatchTexture>();
 private density=1;
 private width=0;
 private height=0;
 constructor(canvas:HTMLCanvasElement){
   this.canvas=canvas;
   const context=canvas.getContext('2d',{alpha:false,desynchronized:true});
   if(!context)throw new Error('Canvas 2Dを利用できません');
   this.ctx=context;
 }
 resize(width:number,height:number,dpr:number):void {
   const density=Math.max(.6,Math.min(dpr,2,Math.sqrt(8_000_000/(width*height))));
   const pixelWidth=Math.round(width*density),pixelHeight=Math.round(height*density);
   if(this.canvas.width!==pixelWidth||this.canvas.height!==pixelHeight){
     this.canvas.width=pixelWidth;this.canvas.height=pixelHeight;
   }
   this.width=width;this.height=height;
   this.density=density;
 }
 private texture(kind:number,family:PatchFamily,color:ColorSpec):PatchTexture {
   const key=`${kind}/${family}/${color.r}/${color.g}/${color.b}`;
   const cached=this.textures.get(key);if(cached)return cached;
   if(this.textures.size>48)this.textures.clear();
   const data=generatePatch(kind,family,256),bytes=data.data;
   if(color.r!==255||color.g!==255||color.b!==255){
     for(let i=0;i<bytes.length;i+=4){
       bytes[i]=Math.round(bytes[i]*color.r/255);
       bytes[i+1]=Math.round(bytes[i+1]*color.g/255);
       bytes[i+2]=Math.round(bytes[i+2]*color.b/255);
     }
   }
   const cv=document.createElement('canvas');cv.width=cv.height=256;
   const cx=cv.getContext('2d');if(!cx)throw Error('画像生成用Canvasを利用できません');
   cx.putImageData(data,0,0);
   // ぼかし済みの画像を一度だけ生成し、描画中は2枚の合成比率のみ変化させる。
   const soft=document.createElement('canvas');soft.width=soft.height=256;
   const sx=soft.getContext('2d');if(!sx)throw Error('ぼかし画像用Canvasを利用できません');
   sx.filter='blur(2px)';sx.drawImage(cv,0,0);sx.filter='none';
   const result={base:cv,soft};this.textures.set(key,result);return result;
 }
 private offset(cell:Cell,point:Point,now:number):Point{
   const m=cell.motion;if(!m)return point;
   const t=clamp((now-m.start)/m.duration);
   const p=m.bounce&&t>.8?1+.018*Math.sin(Math.PI*(t-.8)/.2):ease(t);
   return {x:m.from.x+(m.to.x-m.from.x)*p,y:m.from.y+(m.to.y-m.from.y)*p};
 }
 render(game:Game):void {
   const ctx=this.ctx;
   ctx.setTransform(this.density,0,0,this.density,0,0);
   ctx.fillStyle=game.backgroundColor;
   ctx.fillRect(0,0,game.width,game.height);
   const family:PatchFamily=game.mode==='binary'?'binary':game.family;
   const hintElapsed=game.hintTintStart===null?Infinity:(game.now-game.hintTintStart)/1000;
   const hintBlend=hintElapsed<0?0:hintElapsed<.5?hintElapsed/.5:hintElapsed<4.5?1-(hintElapsed-.5)/4:0;
   for(let y=0;y<game.rows;y++)for(let x=0;x<game.cols;x++){
     const cell=game.board[y]?.[x];if(!cell)continue;
     const point=this.offset(cell,{x,y},game.now);
     const base=game.tile;
     const stereoShrink=game.mode==='stereo'?1-cell.kind/30:1;
     let scale=1;
     if(cell.disappearing!==undefined)scale=1-ease((game.now-cell.disappearing)/DESIGN.removalMs);
     if(cell.pulse!==undefined&&game.now<cell.pulse){
       const t=1-(cell.pulse-game.now)/1000;scale+=.15*Math.sin(Math.PI*t);
     }
     const wx=cell.special==='horizontal'?1.5:cell.special==='vertical'?.8:cell.special==='checker'?1.5:cell.special==='bomb'?.6:1;
     const wy=cell.special==='vertical'?1.5:cell.special==='horizontal'?.8:cell.special==='checker'?1.5:cell.special==='bomb'?.6:1;
     const tint=game.kindColor(cell.kind);
     const tex=this.texture(cell.kind,family,tint);
     const x0=game.originX+(point.x+.5)*base,y0=game.originY+(point.y+.5)*base;
     const blur=.5+.5*Math.sin(game.visualNow/2400*game.visualSpeed+cell.kind*.7);
     const hintTex=hintBlend>0?this.texture(cell.kind,family,{r:255,g:242,b:173,a:255}):null;
     if(game.mode==='stereo'){ctx.save();ctx.beginPath();ctx.rect(0,0,game.halfWidth,game.height);ctx.clip()}
     this.drawPatch(tex,x0,y0,base*scale*stereoShrink*wx,base*scale*stereoShrink*wy,cell.angle,tint.a/255,blur);
     if(hintTex)this.drawPatch(hintTex,x0,y0,base*scale*stereoShrink*wx,base*scale*stereoShrink*wy,cell.angle,hintBlend,blur);
     if(game.mode==='stereo'){
       ctx.restore();
       ctx.save();ctx.beginPath();ctx.rect(game.halfWidth,0,game.halfWidth,game.height);ctx.clip();
       const stereoX=x0+game.halfWidth+(1-stereoShrink)*base*.45;
       this.drawPatch(tex,stereoX,y0,base*scale*stereoShrink*wx,base*scale*stereoShrink*wy,cell.angle,tint.a/255,blur);
       if(hintTex)this.drawPatch(hintTex,stereoX,y0,base*scale*stereoShrink*wx,base*scale*stereoShrink*wy,cell.angle,hintBlend,blur);
       ctx.restore();
     }
   }
   this.drawTimeBar(game);
   if(game.mode==='stereo')this.drawStereoMarks(game);
 }
 private drawPatch(tex:PatchTexture,x:number,y:number,w:number,h:number,rotation:number,alpha:number,blur:number):void {
   const ctx=this.ctx;ctx.save();ctx.translate(x,y);ctx.rotate(rotation*Math.PI/180);
   ctx.globalAlpha=alpha;ctx.imageSmoothingEnabled=true;
   ctx.drawImage(tex.base,-w/2,-h/2,w,h);
   if(blur>0.01){ctx.globalAlpha=alpha*blur;ctx.drawImage(tex.soft,-w/2,-h/2,w,h)}
   ctx.restore();
 }
 private drawTimeBar(game:Game):void{
   if(game.phase==='ready'||game.phase==='over')return;
   const ctx=this.ctx,v=clamp(game.time/game.initialSeconds,0,1);
   ctx.fillStyle='rgba(255,107,107,.65)';
   ctx.fillRect(0,game.height*(1-v),5,game.height*v);
 }
 private drawStereoMarks(game:Game):void{
   const ctx=this.ctx;ctx.fillStyle='#e94f64';
   for(const x of [game.halfWidth/2,game.halfWidth*1.5]){
     ctx.beginPath();ctx.arc(x,20,4,0,TAU);ctx.fill();
   }
 }
}

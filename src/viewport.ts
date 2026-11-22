import {Game} from './game.js';
import {Renderer} from './render.js';

/** 画面回転・safe-area・描画解像度・ポップアップ配置の唯一の所有者。 */
export class ViewportController {
 private needsLayout=true;

 constructor(
   private readonly game:Game,
   private readonly renderer:Renderer,
   private readonly stage:HTMLElement,
   private readonly settings:HTMLElement,
   private readonly settingsButton:HTMLButtonElement
 ){
   new ResizeObserver(()=>this.scheduleLayout()).observe(stage);
   window.addEventListener('resize',()=>this.syncViewportSize());
   window.addEventListener('orientationchange',()=>this.syncViewportSize());
   window.visualViewport?.addEventListener('resize',()=>this.syncViewportSize());
   window.visualViewport?.addEventListener('scroll',()=>this.placeSettings());
   this.syncViewportSize();
 }

 /** アニメーション中でも論理Canvasを先に新しい領域に合わせる。 */
 updateLayout():void {
   const rect=this.stage.getBoundingClientRect();
   const w=Math.round(rect.width),h=Math.round(rect.height);
   if(w<10||h<10){this.needsLayout=true;return}
   const settled=this.game.resizeViewport(w,h);
   this.renderer.resize(this.game.width,this.game.height,window.devicePixelRatio||1);
   this.needsLayout=!settled;
   this.placeSettings();
 }

 frame():void {if(this.needsLayout)this.updateLayout()}

 scheduleLayout():void {
   this.needsLayout=true;
   requestAnimationFrame(()=>this.updateLayout());
 }

 syncViewportSize():void {
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
   this.scheduleLayout();
 }

 placeSettings():void {
   if(this.settings.hidden)return;
   const button=this.settingsButton.getBoundingClientRect();
   const popup=this.settings.getBoundingClientRect();
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
   this.settings.style.left=clamp(left,leftMin,leftMax)+'px';
   this.settings.style.top=clamp(top,topMin,topMax)+'px';
 }
}

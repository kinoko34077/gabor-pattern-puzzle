import {Game} from './game.js';
import {PALETTE_OPTIONS,type PaletteName} from './palette.js';
import {ViewportController} from './viewport.js';

function element<T extends HTMLElement>(id:string):T {
 const node=document.getElementById(id);
 if(!node)throw new Error('UI要素が見つかりません: '+id);
 return node as T;
}

/** 設定項目とセッションの一時停止・復帰だけを所有する。 */
export class SettingsPanel {
 private readonly themeSelect=element<HTMLSelectElement>('theme');
 private readonly durationSelect=element<HTMLSelectElement>('duration');
 private readonly backgroundInput=element<HTMLInputElement>('background');
 private readonly patchInput=element<HTMLInputElement>('patch');
 private readonly densityInput=element<HTMLInputElement>('density');
 private readonly speedInput=element<HTMLInputElement>('speed');
 private readonly densityValue=element<HTMLElement>('density-value');
 private readonly speedValue=element<HTMLElement>('speed-value');
 private readonly resetBackground=element<HTMLButtonElement>('reset-background');
 private readonly pauseButton=element<HTMLButtonElement>('pause-button');
 private readonly endGameButton=element<HTMLButtonElement>('end-game-button');
 private readonly closeSettingsButton=element<HTMLButtonElement>('close-settings');
 private readonly pauseIndicator=element<HTMLOutputElement>('pause-indicator');
 private manuallyPaused=false;

 constructor(
   private readonly game:Game,
   private readonly canvas:HTMLCanvasElement,
   private readonly settings:HTMLElement,
   private readonly settingsButton:HTMLButtonElement,
   private readonly viewport:ViewportController,
   private readonly refreshHud:()=>void,
   private readonly scheduleLayout:()=>void,
   private readonly cancelPointer:()=>void
 ) {
   for(const option of PALETTE_OPTIONS){
     const item=document.createElement('option');
     item.value=option.id;item.textContent=option.label;this.themeSelect.add(item);
   }
   this.settingsButton.addEventListener('click',()=>this.toggleSettings());
   this.closeSettingsButton.addEventListener('click',()=>this.closeSettings());
   this.pauseButton.addEventListener('click',()=>{
     if(!this.manuallyPaused&&!this.game.isPlaying)return;
     this.manuallyPaused=!this.manuallyPaused;
     this.closeSettings();this.syncPause();
   });
   this.endGameButton.addEventListener('click',()=>{
     this.manuallyPaused=false;
     this.game.restart();
     this.closeSettings();this.syncPause();this.refreshHud();
   });
   document.addEventListener('pointerdown',ev=>{
     const target=ev.target as Node;
     if(!this.settings.hidden&&!this.settings.contains(target)&&!this.settingsButton.contains(target)){
       this.closeSettings();
     }
   });
   window.addEventListener('keydown',ev=>{
     if(ev.key==='Escape'&&!this.settings.hidden){this.closeSettings();ev.preventDefault()}
   });
   window.addEventListener('resize',()=>this.viewport.placeSettings());
   this.durationSelect.addEventListener('change',()=>this.game.setDuration(Number(this.durationSelect.value)));
   this.themeSelect.addEventListener('change',()=>{
     this.game.setTheme(this.themeSelect.value as PaletteName);
     this.backgroundInput.value=this.game.backgroundColor;
   });
   this.backgroundInput.addEventListener('input',()=>this.game.setBackground(this.backgroundInput.value));
   this.resetBackground.addEventListener('click',()=>{
     this.game.clearBackground();this.backgroundInput.value=this.game.backgroundColor;
   });
   this.patchInput.addEventListener('input',()=>{
     this.game.setPatchColor(this.patchInput.value);this.themeSelect.value=this.game.theme;
   });
   this.densityInput.addEventListener('input',()=>{
     this.game.setDensity(Number(this.densityInput.value));
     this.densityValue.textContent=String(this.game.densityRows);
     this.scheduleLayout();
   });
   this.speedInput.addEventListener('input',()=>{
     this.game.setVisualSpeed(Number(this.speedInput.value));
     this.speedValue.textContent=this.game.visualSpeed.toFixed(2)+'倍';
   });
   this.syncControls();
 }

 syncControls():void {
   this.durationSelect.value=String(this.game.initialSeconds);
   this.themeSelect.value=this.game.theme;
   this.backgroundInput.value=this.game.backgroundColor;
   this.patchInput.value=this.game.patchOverride;
   this.densityInput.value=String(this.game.densityRows);
   this.speedInput.value=String(this.game.visualSpeed);
   this.densityValue.textContent=String(this.game.densityRows);
   this.speedValue.textContent=this.game.visualSpeed.toFixed(2)+'倍';
 }

 refreshPauseControls():void {
   this.pauseIndicator.hidden=!this.manuallyPaused;
   this.pauseButton.textContent=this.manuallyPaused?'再開':'一時停止';
   this.pauseButton.disabled=!this.manuallyPaused&&!this.game.isPlaying;
   this.pauseButton.setAttribute('aria-pressed',String(this.manuallyPaused));
 }

 private syncPause():void {
   // パネル表示中の自動停止と、明示された手動停止は別状態として保持する。
   this.game.paused=this.manuallyPaused||!this.settings.hidden;
   this.refreshHud();
 }

 private openSettings():void {
   if(!this.settings.hidden)return;
   this.syncControls();this.cancelPointer();
   this.settings.hidden=false;
   this.settingsButton.setAttribute('aria-expanded','true');
   this.syncPause();this.viewport.placeSettings();
   this.closeSettingsButton.focus({preventScroll:true});
 }

 private closeSettings():void {
   if(this.settings.hidden)return;
   const focusWasInside=this.settings.contains(document.activeElement);
   this.settings.hidden=true;
   this.settingsButton.setAttribute('aria-expanded','false');
   this.syncPause();
   if(focusWasInside)this.canvas.focus({preventScroll:true});
 }

 toggleSettings():void {
   if(this.settings.hidden)this.openSettings();
   else this.closeSettings();
 }
}

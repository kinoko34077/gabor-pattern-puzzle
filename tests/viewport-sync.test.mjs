import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8');
const viewport=readFileSync(new URL('../src/viewport.ts',import.meta.url),'utf8');
const game=readFileSync(new URL('../src/game.ts',import.meta.url),'utf8');

test('REQ-VIEWPORT-001: 四辺のsafe-areaを画面全体に一度だけ適用する',()=>{
 assert.match(html,/width:var\(--app-width,100%\);height:var\(--app-height,100dvh\)/);
 for(const edge of ['top','right','bottom','left']){
   assert.ok(html.includes('env(safe-area-inset-'+edge+')'),'missing '+edge);
 }
 const portrait=html.slice(html.indexOf('@media (orientation:portrait)'));
 assert.doesNotMatch(portrait,/padding-bottom:env\(safe-area-inset-bottom\)/);
 assert.match(html,/max-height:calc\(var\(--app-height,100dvh\) - env\(safe-area-inset-top\) - env\(safe-area-inset-bottom\) - 16px\)/);
});

test('REQ-VIEWPORT-002: 画面回転中は実際の描画領域とCanvas描画座標を同期する',()=>{
 assert.match(main,/new ViewportController\(game,renderer,stage,settings,settingsButton\)/);
 assert.match(viewport,/const rect=this\.stage\.getBoundingClientRect\(\)/);
 assert.match(viewport,/const settled=this\.game\.resizeViewport\(w,h\)/);
 assert.match(viewport,/this\.renderer\.resize\(this\.game\.width,this\.game\.height,window\.devicePixelRatio\|\|1\)/);
 assert.match(viewport,/this\.needsLayout=!settled/);
 assert.match(viewport,/if\(this\.needsLayout\)this\.updateLayout\(\)/);
 assert.match(game,/if\(this\.busy\)\{/);
 assert.match(game,/this\.width=w;this\.height=h;this\.viewportSized=true/);
 assert.match(game,/this\.tile=Math\.min\(layout\.tile,activeWidth\/this\.cols,h\/this\.rows\)/);
});

test('REQ-VIEWPORT-003: visualViewportの変化と設定パネルを同一座標へ再配置する',()=>{
 assert.match(viewport,/syncViewportSize\(\):void/);
 assert.match(viewport,/window\.visualViewport\?\.addEventListener\('resize',\(\)=>this\.syncViewportSize\(\)\)/);
 assert.match(viewport,/window\.addEventListener\('orientationchange',\(\)=>this\.syncViewportSize\(\)\)/);
 assert.match(viewport,/Math\.abs\(visual\.scale-1\)<0\.015/);
 assert.match(viewport,/const bodyRect=document\.body\.getBoundingClientRect\(\)/);
 assert.match(viewport,/const inset=\(v:string\)=>Number\.parseFloat\(v\)\|\|0/);
 assert.match(viewport,/this\.settings\.style\.left=clamp\(left,leftMin,leftMax\)/);
 assert.match(viewport,/this\.settings\.style\.top=clamp\(top,topMin,topMax\)/);
 assert.match(viewport,/this\.needsLayout=!settled;\s*this\.placeSettings\(\)/);
});

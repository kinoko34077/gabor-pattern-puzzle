import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8');
const render=readFileSync(new URL('../src/render.ts',import.meta.url),'utf8');

test('REQ-UI-TOAST: 配色通知は盤面端の控えめな表示にする',()=>{
 assert.match(html,/#theme-toast\{position:absolute;top:10px;left:10px;/);
 assert.doesNotMatch(html,/#theme-toast\{[^}]*top:49%/);
 assert.doesNotMatch(html,/#theme-toast\{[^}]*top:50%/);
 assert.match(main,/themeToast\.textContent='配色：'/);
});
test('REQ-UI-POPOVER: 設定は非モーダルで背景ぼかしなし、ボタン起点で配置する',()=>{
 assert.match(html,/<aside id="settings" class="settings-popover" role="region"[^>]*hidden>/);
 assert.match(html,/id="settings-button"[^>]*aria-controls="settings"[^>]*aria-expanded="false"/);
 assert.doesNotMatch(html,/<dialog|::backdrop|backdrop-filter\s*:/);
 assert.match(main,/settings\.hidden=false/);
 assert.match(main,/settingsButton\.getBoundingClientRect\(\)/);
 assert.match(main,/settings\.style\.left=/);
 assert.match(main,/settings\.style\.top=/);
 assert.doesNotMatch(main,/showModal\(\)/);
});
test('REQ-UI-SESSION: 設定に一時停止・再開と待機復帰を備える',()=>{
 assert.match(html,/id="pause-button"/);
 assert.match(html,/id="end-game-button"/);
 assert.match(main,/game\.paused=manuallyPaused\|\|!settings\.hidden/);
 assert.match(main,/pauseButton\.addEventListener\('click'/);
 assert.match(main,/endGameButton\.addEventListener\('click'/);
 assert.match(main,/game\.restart\(\)/);
});
test('REQ-UI-TOUCH: ダブルタップ誤拡大を抑えピンチズームを禁止しない',()=>{
 assert.match(html,/html,body\{[^}]*touch-action:manipulation/);
 assert.match(html,/\.tool\{[^}]*touch-action:manipulation/);
 assert.match(html,/#game\{[^}]*touch-action:none/);
 assert.doesNotMatch(html,/user-scalable=no|maximum-scale=1|minimum-scale=1/);
});
test('REQ-VISUAL-BLUR: 鮮明画像の常時100%上描きをなくし、待機中からぼかしが変わる',()=>{
 assert.match(render,/sx\.filter='blur\(8px\)'/);
 assert.match(render,/game\.visualNow\/1250/);
 const a=render.indexOf('ctx.drawImage(tex.soft,');
 const b=render.indexOf('ctx.drawImage(tex.base,');
 assert.ok(a>=0&&b>a,'ぼかし画像を先に描き、鮮明画像の寄与率を変える');
 assert.match(render,/ctx\.globalAlpha=alpha\*\(1-blur\)/);
});

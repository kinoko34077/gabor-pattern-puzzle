import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,extname,join,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn,spawnSync} from 'node:child_process';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const mime={'.js':'application/javascript','.html':'text/html; charset=utf-8',
  '.png':'image/png','.webmanifest':'application/manifest+json','.json':'application/json'};
const chrome=process.env.CHROME_BIN ||
  ['google-chrome','google-chrome-stable','chromium','chromium-browser']
    .find(name=>spawnSync('which',[name],{stdio:'ignore'}).status===0);
if(!chrome)throw new Error('Chrome/Chromiumが見つかりません。CHROME_BINを指定してください');

// 実装側のエントリーポイントを実ブラウザから操作する。専用テストDOMを作らない。
function smoke(){
 const root=document.documentElement;
 let attempts=0;
 const check=(yes,label)=>{if(!yes)throw new Error(label)};
 const el=id=>document.getElementById(id);
 const attempt=()=>{
   if(!window.__gaborPuzzleDev){
     if(++attempts<100){setTimeout(attempt,30);return}
     root.dataset.smoke='FAIL:entrypoint';
     return;
   }
   try{
     const g=window.__gaborPuzzleDev.game;
     const stage=el('stage'),toolbar=el('toolbar'),canvas=el('game');
     const a=stage.getBoundingClientRect(),b=toolbar.getBoundingClientRect();
     check(a.width>0&&a.height>0,'canvas empty');
     for(const r of [a,b,canvas.getBoundingClientRect()]){
       check(r.left>=-1&&r.top>=-1&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1,'viewport overflow');
     }
     check(Math.abs(g.width-a.width)<=1&&Math.abs(g.height-a.height)<=1,'draw size drift');
     check(matchMedia('(orientation:portrait)').matches ? b.top>=a.bottom-1 : b.left>=a.right-1,'toolbar side');
     check(el('settings').hidden,'settings initially closed');
     el('settings-button').click();
     check(!el('settings').hidden&&g.paused,'settings pauses');
     const pop=el('settings').getBoundingClientRect();
     check(pop.left>=-1&&pop.top>=-1&&pop.right<=innerWidth+1&&pop.bottom<=innerHeight+1,'popover bounds');
     const input=el('background');
     input.value='#123456';input.dispatchEvent(new Event('input',{bubbles:true}));
     check(g.backgroundColor==='#123456','color preview');
     el('close-settings').click();
     check(el('settings').hidden&&!g.paused,'closing restores game');
     check(document.activeElement===canvas,'keyboard focus');
     const move=g.findPossibleSwap();check(!!move,'missing move');
     check(g.swap(...move),'game starts');
     el('settings-button').click();el('pause-button').click();
     check(g.paused&&el('settings').hidden,'manual pause');
     el('settings-button').click();
     check(el('pause-button').textContent==='再開','resume label');
     el('pause-button').click();
     check(!g.paused,'resume');
     el('settings-button').click();el('end-game-button').click();
     check(g.phase==='ready'&&g.score===0&&g.startedAt===null,'return to ready');
     root.dataset.smoke='PASS';
     root.dataset.smokeCount='14';
   }catch(error){
     root.dataset.smoke='FAIL:'+String(error?.message||error);
   }
 };
 attempt();
}
const smokeScript='('+smoke.toString()+')()';

const server=createServer(async(req,res)=>{
 try{
   const path=new URL(req.url||'/', 'http://127.0.0.1').pathname;
   const target=path==='/'?'index.html':decodeURIComponent(path.slice(1));
   const absolute=resolve(root,target);
   if(absolute!==root&&!absolute.startsWith(root+sep)){res.writeHead(403).end();return}
   const info=await stat(absolute);
   if(!info.isFile()){res.writeHead(404).end();return}
   let contents=await readFile(absolute);
   if(target==='index.html'||target==='standalone.html'){
     const source=contents.toString('utf8');
     if(!source.includes('</body>'))throw Error('HTML bodyがありません');
     contents=Buffer.from(source.replace('</body>', '<script>'+smokeScript+'</script></body>'));
   }
   res.writeHead(200,{'Content-Type':mime[extname(absolute)]||'application/octet-stream','Cache-Control':'no-store'});
   res.end(contents);
 }catch(err){res.writeHead(404).end(String(err))}
});
await new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok)});
const port=server.address().port;

async function runChrome(page,width,height){
 const profile=mkdtempSync(join(tmpdir(),'gabor-smoke-'));
 const url='http://127.0.0.1:'+port+'/'+page;
 const args=['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
   '--disable-extensions','--no-first-run','--disable-background-networking',
   '--disable-features=Translate','--force-device-scale-factor=1',
   '--window-size='+width+','+height,'--virtual-time-budget=5000','--dump-dom',
   '--user-data-dir='+profile,url];
 try{
   const result=await new Promise((finish,reject)=>{
     const child=spawn(chrome,args,{stdio:['ignore','pipe','pipe']});
     let stdout='',stderr='';
     const timeout=setTimeout(()=>{child.kill('SIGKILL');reject(Error('Chrome timeout: '+page))},30000);
     child.stdout.on('data',buf=>{stdout+=buf.toString()});
     child.stderr.on('data',buf=>{stderr+=buf.toString()});
     child.once('error',err=>{clearTimeout(timeout);reject(err)});
     child.once('close',code=>{clearTimeout(timeout);finish({code,stdout,stderr})});
   });
   const match=result.stdout.match(/data-smoke="([^"]+)"/);
   if(result.code!==0||match?.[1]!=='PASS'){
     throw Error(page+' '+width+'x'+height+': '+JSON.stringify({code:result.code,marker:match?.[1],stderr:result.stderr.slice(-1800),stdoutTail:result.stdout.slice(-600)}));
   }
   console.log('Chrome smoke PASS: '+page+' '+width+'x'+height);
 }finally{
   rmSync(profile,{recursive:true,force:true});
 }
}

try{
 for(const page of ['index.html','standalone.html']){
   for(const [width,height] of [[1024,768],[640,900]]){
     await runChrome(page,width,height);
   }
 }
}finally{
 await new Promise(ok=>server.close(ok));
}

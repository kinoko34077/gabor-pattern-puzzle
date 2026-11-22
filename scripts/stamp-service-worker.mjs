import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const CACHE_MARKER = "const CACHE = 'gabor-pattern-puzzle-v2';";
export function stampServiceWorker(source,commit){
  if(!/^[a-f0-9]{40}$/.test(commit))throw new Error('40桁のGitコミットSHAが必要です');
  if(!source.includes(CACHE_MARKER))throw new Error('Service Workerのキャッシュ版の置換位置が見つかりません');
  return source.replace(CACHE_MARKER, `const CACHE = 'gabor-pattern-puzzle-${commit}';`);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const path=process.argv[2],commit=process.argv[3];
  if(!path||!commit)throw new Error('使用方法: node scripts/stamp-service-worker.mjs <ファイル> <SHA>');
  writeFileSync(path,stampServiceWorker(readFileSync(path,'utf8'),commit),'utf8');
}

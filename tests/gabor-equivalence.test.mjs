import test from 'node:test';
import assert from 'node:assert/strict';
import {generatePatch,samplePatch} from '../dist/gabor.js';

globalThis.ImageData=class ImageData{
  constructor(width,height){this.width=width;this.height=height;this.data=new Uint8ClampedArray(width*height*4)}
};
test('生成画像21種類の全画素が数式基準と一致する',()=>{
  const size=64;
  for(const family of ['normal','sharp','binary'])for(let kind=1;kind<=7;kind++){
    const {data}=generatePatch(kind,family,size);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const u=(x+.5)/size*100-50,v=(y+.5)/size*100-50;
      const [l,a]=samplePatch(kind,family,u,v);
      const at=(y*size+x)*4;
      const expected=Math.round(l),expectedA=Math.round(a);
      assert.equal(data[at],expected,`${family}/${kind} 明度 ${x}:${y}`);
      assert.equal(data[at+1],expected);
      assert.equal(data[at+2],expected);
      assert.equal(data[at+3],expectedA,`${family}/${kind} 外周 ${x}:${y}`);
    }
  }
});

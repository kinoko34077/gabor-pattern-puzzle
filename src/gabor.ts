/**
 * Procedurally generated Gabor textures.
 * All images are computed from mathematical parameters.
 */
export type PatchFamily = 'normal' | 'sharp' | 'binary';
export interface PatchSpec { frequency: number; bias: number; cos: number; sin: number; }

/** Wave frequencies in cycles per 100 logical px, expressed per virtual pixel. */
const NORMAL: readonly PatchSpec[] = [
  {frequency:0.039974480,bias:127.526,cos:127.967,sin:2.017},
  {frequency:0.030988075,bias:127.441,cos:128.309,sin:1.470},
  {frequency:0.034981318,bias:127.483,cos:-128.053,sin:-1.768},
  {frequency:0.025990298,bias:127.489,cos:-128.251,sin:-1.182},
  {frequency:0.028991674,bias:127.439,cos:1.421,sin:-128.150},
  {frequency:0.022482867,bias:127.481,cos:1.175,sin:-128.237},
  {frequency:0.044972265,bias:127.488,cos:2.155,sin:-127.785},
];
const SHARP: readonly PatchSpec[] = [
  {frequency:0.069979722,bias:127.497,cos:127.031,sin:3.428},
  {frequency:0.059969692,bias:127.482,cos:-127.413,sin:-2.975},
  {frequency:0.049985402,bias:127.478,cos:2.639,sin:-127.738},
  NORMAL[0],
  NORMAL[2],
  {frequency:0.024984550,bias:127.547,cos:1.399,sin:-128.415},
  {frequency:0.020000407,bias:127.539,cos:128.216,sin:1.061},
];
/** Black/white patches use a high-contrast stripe family with a soft circular border. */
const BINARY: readonly PatchSpec[] = [
  {frequency:0.06998421,bias:126.71881,cos:-435.77173,sin:-11.63746},
  {frequency:0.05000000,bias:127.50000,cos:-623.26419,sin:0.00000},
  {frequency:0.03500452,bias:126.26330,cos:-873.38401,sin:-13.01382},
  {frequency:0.02500000,bias:127.50000,cos:-1242.68575,sin:0.00000},
  {frequency:0.01508567,bias:156.24161,cos:1869.07265,sin:13.00030},
  {frequency:0.00863631,bias:167.09637,cos:-39.61094,sin:3594.01280},
  {frequency:0.01000000,bias:0,cos:0,sin:0},
];
export const PATCH_FAMILIES = {normal:NORMAL, sharp:SHARP, binary:BINARY} as const;
export const EDGE_FIT = {sigmaX:15.529173402504066,sigmaY:15.52915956748004,
  exponent:2.009377905312548,offset:-0.8199866308619226} as const;
const clamp=(n:number,min:number,max:number)=>Math.min(max,Math.max(min,n));

/** Pure model so it can be tested without any DOM APIs. Returned channels are straight RGBA. */
export function samplePatch(type: number,family:PatchFamily,u:number,v:number):[number,number] {
  const spec=PATCH_FAMILIES[family][clamp(type|0,1,7)-1];
  // u/v are coordinates in logical pattern pixels; centre is (0,0).
  const wave=2*Math.PI*spec.frequency*u;
  const light=clamp(spec.bias+spec.cos*Math.cos(wave)+spec.sin*Math.sin(wave),0,255);
  if(family==='binary') {
    // Independent numerical approximation of the high-contrast circle.
    // Its 100px mask has a radius ~45px, with a ~0.24px antialiased transition.
    const r=Math.hypot(u-0.06358432458825,v-0.06355420214318);
    const alpha=255/(1+Math.exp(Math.max(-50,Math.min(50,(r-44.991946656886405)/0.24096192115137702))));
    return [light,alpha];
  }
  const exponent=EDGE_FIT.exponent;
  const alpha=255*Math.exp(-0.5*(
    (Math.abs(u)/EDGE_FIT.sigmaX)**exponent+ (Math.abs(v)/EDGE_FIT.sigmaY)**exponent
  ))+EDGE_FIT.offset;
  return [light,clamp(alpha,0,255)];
}

export function generatePatch(type:number,family:PatchFamily,size=256):ImageData {
  const output=new ImageData(size,size);
  const bytes=output.data;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=(x+0.5)/size*100-50,v=(y+0.5)/size*100-50;
    const [l,a]=samplePatch(type,family,u,v);
    const off=(y*size+x)*4;
    bytes[off]=bytes[off+1]=bytes[off+2]=Math.round(l);
    bytes[off+3]=Math.round(a);
  }
  return output;
}

export function createPatchTexture(type:number,family:PatchFamily,size=256):HTMLCanvasElement {
  const element=document.createElement('canvas');
  element.width=element.height=size;
  const ctx=element.getContext('2d',{willReadFrequently:false});
  if(!ctx)throw new Error('2D canvas unavailable');
  ctx.putImageData(generatePatch(type,family,size),0,0);
  return element;
}

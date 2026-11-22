/** カテゴリ色分けと色相調和を使用した配色プリセット。 */
export type PaletteName='classic'|'set2'|'sunset'|'night'|'custom';
export const PALETTE_OPTIONS:ReadonlyArray<{id:PaletteName;label:string}>= [
 {id:'classic',label:'従来の単色'}, {id:'set2',label:'七彩・ソフト'},
 {id:'sunset',label:'夕映え'}, {id:'night',label:'夜光'},
 {id:'custom',label:'好みの単色'}
];
export const PALETTES:Record<Exclude<PaletteName,'custom'>,{background:string;colors:readonly string[]}>={
 classic:{background:'#808080',colors:['#ffffff']},
 // 7種類のカテゴリを識別するColorBrewer Set2の色相構成。
 set2:{background:'#f1f3f6',colors:['#66c2a5','#fc8d62','#8da0cb','#e78ac3','#a6d854','#ffd92f','#e5c494']},
 // 補色・類似色のバランスを使い、全種類を独立した色相で識別する。
 sunset:{background:'#201f33',colors:['#fa8776','#ffb65d','#f2dd7e','#81d0ac','#71b7e0','#bd99ea','#fc90bd']},
 night:{background:'#101a29',colors:['#69d0c7','#8cafff','#ed8ed2','#fbb27e','#d9e579','#82dcb3','#d4a0fc']}
};
export interface Rgba {r:number;g:number;b:number;a:number}
export function isHexColor(value:unknown):value is string {
 return typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value);
}
export function toRgb(hex:string):Rgba {
 return {r:parseInt(hex.slice(1,3),16),g:parseInt(hex.slice(3,5),16),b:parseInt(hex.slice(5,7),16),a:255};
}
export function paletteColor(theme:PaletteName,kind:number,shift:number,custom:string):Rgba {
 if(theme==='custom')return toRgb(custom);
 const list=PALETTES[theme].colors;
 return toRgb(list[((kind-1+shift)%list.length+list.length)%list.length]);
}

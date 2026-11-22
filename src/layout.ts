/** 画面内のパッチの物理的な大きさと個数を同時に適応させる。 */
export interface BoardLayout { tile:number;rows:number;cols:number;originX:number;originY:number; }
export function fitBoard(width:number,height:number,density=6,stereo=false):BoardLayout {
  const w=Math.max(160,width),h=Math.max(160,height);
  const area=(w*h)/(880*540);
  // 面積に対する0.35乗を使用し、大きな画面ではパッチ自体も拡大する。
  const wanted=90*Math.pow(area,0.35)*6/Math.max(4,Math.min(10,density));
  const activeWidth=stereo?w/2:w;
  const tile=Math.max(28,Math.min(300,wanted,activeWidth/(stereo?3:4),h/4));
  const cols=Math.max(3,Math.ceil(activeWidth/tile)),rows=Math.max(4,Math.ceil(h/tile));
  return {tile,rows,cols,originX:(activeWidth-cols*tile)/2,originY:(h-rows*tile)/2};
}

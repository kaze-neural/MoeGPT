import Phaser from 'phaser';
import type {State} from './model';
/** Original-art cutout rig. Each part has its own pivot and transform. */
export class ChatGPTRig{
 readonly key='chatgpt-rig';private texture:Phaser.Textures.CanvasTexture;private parts:Record<string,HTMLCanvasElement>={};private last=-100;private w=615;private h=693;
 constructor(scene:Phaser.Scene){
  const source=scene.textures.get('chatgpt').getSourceImage() as HTMLImageElement;this.w=source.width;this.h=source.height;
  const W=this.w,H=this.h,scale=W/615;
  const polygon=(ctx:CanvasRenderingContext2D,points:number[][])=>{ctx.moveTo(points[0][0]*scale,points[0][1]*scale);for(const p of points.slice(1))ctx.lineTo(p[0]*scale,p[1]*scale);ctx.closePath()};
  const left=[[221,624],[282,632],[296,693],[211,693]],right=[[304,650],[375,646],[386,693],[297,693]];
  for(const name of ['head','body','left','right']){
   const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;const ctx=canvas.getContext('2d')!;
   ctx.beginPath();
   if(name==='head')ctx.rect(0,0,W,374*scale);
   else if(name==='body'){ctx.rect(0,360*scale,W,H-360*scale);polygon(ctx,left);polygon(ctx,right)}
   else polygon(ctx,name==='left'?left:right);
   ctx.clip('evenodd');ctx.drawImage(source,0,0);this.parts[name]=canvas;
  }
  this.texture=scene.textures.createCanvas(this.key,W+40*scale,H+40*scale)!;this.draw(0,0,0,true,'IDLE');
  scene.events.once('shutdown',()=>{scene.textures.remove(this.key);this.parts={}});
 }
 draw(time:number,stride:number,blend:number,animate:boolean,state:State){
  if(time-this.last<1000/30)return;this.last=time;
  const ctx=this.texture.context,s=this.w/615,pad=20*s;ctx.clearRect(0,0,this.texture.width,this.texture.height);ctx.save();ctx.translate(pad,pad);
  const gait=animate?Math.sin(stride):0,walk=blend>.03?blend:0,idle=animate?(1-walk):0;
  const breathe=Math.sin(time/1300)*idle;
  const shift=gait*2.8*walk,bob=-Math.abs(gait)*5*walk;
  const part=(name:string,px:number,py:number,dx:number,dy:number,angle:number,sx=1,sy=1)=>{ctx.save();ctx.translate((px+dx)*s,(py+dy)*s);ctx.rotate(angle*Math.PI/180);ctx.scale(sx,sy);ctx.drawImage(this.parts[name],-px*s,-py*s);ctx.restore()};
  // Feet swing in opposite phases; the skirt covers the leg pivots.
  part('left',257,630,-gait*9*walk,-Math.max(0,gait)*16*walk,-gait*9*walk);
  part('right',337,650,gait*9*walk,-Math.max(0,-gait)*16*walk,gait*9*walk);
  part('body',306,382,shift,bob+breathe*.8,-gait*.9*walk,1,1+breathe*.003);
  const idleCycle=(time%11000)/11000;const look=idleCycle>.32&&idleCycle<.62?Math.sin((idleCycle-.32)/.30*Math.PI):0;
  const headAngle=idle*look*2.6-gait*.65*walk;
  ctx.save();ctx.translate((307+shift)*s,(370+bob+breathe*1.5)*s);ctx.rotate(headAngle*Math.PI/180);ctx.drawImage(this.parts.head,-307*s,-370*s);
  // Short blinks, with occasional double blink, follow the head transform.
  const blinkTime=time%5100,blink=animate&&(blinkTime>4460&&blinkTime<4610||blinkTime>4790&&blinkTime<4870);
  if(blink&&state!=='DRAG'){
   for(const [x,y] of [[241,307],[354,305]]){ctx.fillStyle='#fbf0ec';ctx.beginPath();ctx.ellipse((x-307)*s,(y-370)*s,25*s,30*s,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#574555';ctx.lineWidth=3*s;ctx.lineCap='round';ctx.beginPath();ctx.moveTo((x-330)*s,(y-367)*s);ctx.quadraticCurveTo((x-307)*s,(y-355)*s,(x-284)*s,(y-367)*s);ctx.stroke()}
  }
  ctx.restore();ctx.restore();this.texture.refresh();
 }
}

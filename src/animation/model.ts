export type State='IDLE'|'WALK'|'DRAG'|'TALK'|'INTERACT'|'ACTION';
export const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(Math.max(a,b),n));
export function step(x:number,y:number,tx:number,ty:number,speed:number,dt:number){const d=Math.hypot(tx-x,ty-y);const n=Math.min(d,speed*Math.max(0,Math.min(dt,.05)));return d<.01?{x:tx,y:ty,done:true}:{x:x+(tx-x)/d*n,y:y+(ty-y)/d*n,done:d<=n+.1}}
export const canDoubleTap=(last:number,now:number,moved:boolean)=>!moved&&last>0&&now-last<330;


export type Body={x:number;y:number;halfWidth:number;height:number};
/** Small center collision rectangles; artwork may overlap freely. */
export function separate(bodies:Body[],width:number,height:number,anchor=-1){
 const constrain=(b:Body)=>{b.x=clamp(b.x,b.halfWidth+8,width-b.halfWidth-8);b.y=clamp(b.y,b.height+72,height-18)};
 bodies.forEach(constrain);
 for(let pass=0;pass<80;pass++){
  let changed=false;
  for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++){
   const a=bodies[i],b=bodies[j];const dx=b.x-a.x,dy=(b.y-b.height/2)-(a.y-a.height/2);
   const px=a.halfWidth+b.halfWidth+.5-Math.abs(dx),py=(a.height+b.height)/2+.5-Math.abs(dy);
   if(px<=.01||py<=.01)continue;
   changed=true;const wa=i===anchor?0:j===anchor?1:.5,wb=1-wa;
   // Prefer the least displacement, but don't push a neighbor into a wall.
   const sx=dx>=0?1:-1,sy=dy>=0?1:-1;
   const axisX=px<py;
   if(axisX){a.x-=sx*(px+.1)*wa;b.x+=sx*(px+.1)*wb}else{a.y-=sy*(py+.1)*wa;b.y+=sy*(py+.1)*wb}
   constrain(a);constrain(b);
   // If the boundary blocked the push, move the unanchored body to the other side.
   if(anchor===i||anchor===j){const fixed=bodies[anchor],other=anchor===i?b:a;
    const ox=Math.abs(other.x-fixed.x),oy=Math.abs((other.y-other.height/2)-(fixed.y-fixed.height/2));
    if(ox<other.halfWidth+fixed.halfWidth+.4&&oy<(other.height+fixed.height)/2+.4){
     const candidates=[{x:fixed.x+fixed.halfWidth+other.halfWidth+1,y:other.y},{x:fixed.x-fixed.halfWidth-other.halfWidth-1,y:other.y},{x:other.x,y:fixed.y+other.height+1},{x:other.x,y:fixed.y-fixed.height-1}];
     const valid=candidates.filter(p=>p.x>=other.halfWidth+8&&p.x<=width-other.halfWidth-8&&p.y>=other.height+72&&p.y<=height-18).sort((p,q)=>Math.hypot(p.x-other.x,p.y-other.y)-Math.hypot(q.x-other.x,q.y-other.y));
     if(valid.length){other.x=valid[0].x;other.y=valid[0].y}
    }
   }
  }
  if(!changed)break;
 }
 // Dense stacks and corners can leave the iterative solver without room on its chosen axis.
 const overlaps=(a:Body,b:Body)=>Math.abs(a.x-b.x)<a.halfWidth+b.halfWidth+.4&&Math.abs((a.y-a.height/2)-(b.y-b.height/2))<(a.height+b.height)/2+.4;
 if(bodies.some((a,i)=>bodies.some((b,j)=>j>i&&overlaps(a,b)))){
  const placed:Body[]=[];const order=bodies.map((_,i)=>i).sort((a,b)=>(a===anchor?-1:b===anchor?1:0));
  for(const i of order){const b=bodies[i];if(placed.some(a=>overlaps(a,b))){
   const xs=[b.x,b.halfWidth+8,width-b.halfWidth-8],ys=[b.y,b.height+72,height-18];
   for(const a of placed){xs.push(a.x-a.halfWidth-b.halfWidth-1,a.x+a.halfWidth+b.halfWidth+1);ys.push(a.y-a.height-1,a.y+b.height+1)}
   const candidates=xs.flatMap(x=>ys.map(y=>({x,y,halfWidth:b.halfWidth,height:b.height}))).filter(c=>c.x>=b.halfWidth+8&&c.x<=width-b.halfWidth-8&&c.y>=b.height+72&&c.y<=height-18&&!placed.some(a=>overlaps(a,c))).sort((a,c)=>Math.hypot(a.x-b.x,a.y-b.y)-Math.hypot(c.x-b.x,c.y-b.y));
   if(candidates.length){b.x=candidates[0].x;b.y=candidates[0].y}
  }placed.push(b)}
 }
 return bodies;
}

/** Eight drawn poses; one loop covers about 41px of travel at normal speed. */
export const walkFrame=(stride:number)=>((Math.floor(stride*8/Math.PI)%8)+8)%8;

export function actionFrame(elapsed:number,durations:readonly number[]):number|undefined {
 if(elapsed<0)return;
 for(let i=0;i<durations.length;i++){
  elapsed-=durations[i];
  if(elapsed<0)return i;
 }
}

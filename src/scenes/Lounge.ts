import actionData from '../data/actions.json';
import Phaser from 'phaser';
import {clamp,separate,canDoubleTap,walkFrame,actionFrame,type State} from '../animation/model';
type Action={folder:string;durations:number[]};
const actions:Record<string,Action[]>=actionData;
const actionKey=(action:Action,index:number)=>action.folder+'-action-'+index;
type Girl={id:string;sprite:Phaser.GameObjects.Image;shadow:Phaser.GameObjects.Ellipse;x:number;y:number;tx:number;ty:number;state:State;until:number;last:number;startX:number;startY:number;moved:boolean;offsetX:number;offsetY:number;phase:number;vx?:number;vy?:number;stride?:number;walkBlend?:number;actionStarted?:number;action?:Action;actionIndex?:number;nextActionAt?:number;walkFacing?:boolean;lastWalkAt?:number};
export class Lounge extends Phaser.Scene{
 girls:Girl[]=[];frozen=false;special=true;soundEnabled=false; reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;held?:Girl; convo?:{a:Girl;b:Girl;turns:any[];index:number;next:number;special:boolean};cooldowns=new Map<string,number>();nextSolo=0;activeBubble?:{girl:Girl;el:HTMLElement;expires:number};size=170;gameClock=0;open:(id:string)=>void;content:any;lang:()=>string;preview:boolean;audio?:AudioContext;
 constructor(data:any,lang:()=>string,preview:boolean,open:(id:string)=>void){super('lounge');this.content=data;this.lang=lang;this.preview=preview;this.open=open}
 preload(){for(const c of this.content.characters){this.load.image(c.id,`${import.meta.env.BASE_URL}art/characters/${c.id}.png`);if(c.states.includes('IDLE'))this.load.image(c.id+'-blink',`${import.meta.env.BASE_URL}art/animations/blink/${c.id}.png`);if(c.states.includes('ACTION'))for(const action of actions[c.id]??[]){
  action.durations.forEach((_,i)=>this.load.image(actionKey(action,i),`${import.meta.env.BASE_URL}art/animations/actions/${action.folder}/frame-${i+1}.png`));
 }if(c.states.includes('WALK'))for(let i=0;i<8;i++)this.load.image(c.id+'-walk-'+i,`${import.meta.env.BASE_URL}art/animations/${c.id}-walk-drawn-v1/frame-${String(i+1).padStart(2,'0')}.png`)}}
 create(){for(let i=0;i<8;i++){const key='chatgpt-walk-'+i;if(this.textures.exists(key))this.textures.get(key).add('pose',0,57,97,302,347)}this.layout();this.content.characters.forEach((c:any,i:number)=>{const w=this.scale.width,h=this.scale.height;const x=w*(i+1)/(this.content.characters.length+1),y=h*(.6+(i%2)*.14);const shadow=this.add.ellipse(x,y,this.size*.55,14,0x9783ba,.18);const sprite=this.add.image(x,y,c.id).setOrigin(.5,1);sprite.setDisplaySize(this.size*sprite.width/sprite.height,this.size);const g:Girl={id:c.id,sprite,shadow,x,y,tx:x,ty:y,state:'IDLE',until:1000+i*700,last:0,startX:0,startY:0,moved:false,offsetX:0,offsetY:0,phase:i*2};this.girls.push(g);});
 const release=()=>{const g=this.held;if(!g)return;this.held=undefined;g.state='IDLE';g.until=this.gameClock+1800;if(!g.moved){const n=performance.now();if(canDoubleTap(g.last,n,false)){g.last=0;this.open(g.id)}else{g.last=n;if(this.startAction(g)||this.showProfileHint(g))return;const line=this.content.lines.find((l:any)=>l.character===g.id);if(line)this.say(g,line.text[this.lang()])}}else{g.last=0;if(this.startFriendEncounter(g))return;const line=this.content.lines.filter((l:any)=>l.character===g.id)[4];if(line)this.say(g,line.text[this.lang()])}};
 this.bindDrag(release);
 this.scale.on('resize',()=>{this.layout();for(const g of this.girls){g.sprite.setDisplaySize(this.size*g.sprite.width/g.sprite.height,this.size);this.bound(g);g.tx=g.x;g.ty=g.y;g.state='IDLE'}});this.resolveSpacing();this.nextSolo=4000;
 }
 private bindDrag(release:()=>void){
  const canvas=this.game.canvas;
  let pointerId:number|undefined;
  const position=(event:PointerEvent)=>{
   const rect=canvas.getBoundingClientRect();
   return {
    x:(event.clientX-rect.left)*this.scale.width/rect.width,
    y:(event.clientY-rect.top)*this.scale.height/rect.height
   };
  };
  const down=(event:PointerEvent)=>{
   if(this.frozen||pointerId!==undefined||event.button!==0)return;
   const {x,y}=position(event);
   const padding=event.pointerType==='touch'?8:0;
   const g=this.girls.filter(({sprite})=>{
    const box=sprite.getBounds();
    return x>=box.left-padding&&x<=box.right+padding&&y>=box.top-padding&&y<=box.bottom+padding;
   }).sort((a,b)=>b.sprite.depth-a.sprite.depth)[0];
   if(!g)return;
   event.preventDefault();
   canvas.setPointerCapture(event.pointerId);
   pointerId=event.pointerId;
   this.cancel();
   g.startX=x;g.startY=y;g.offsetX=g.x-x;g.offsetY=g.y-y;
   g.moved=false;g.vx=g.vy=0;this.held=g;g.state='DRAG';
  };
  const move=(event:PointerEvent)=>{
   const g=this.held;
   if(!g||event.pointerId!==pointerId)return;
   const {x,y}=position(event);
   if(Math.hypot(x-g.startX,y-g.startY)>7)g.moved=true;
   if(!g.moved)return;
   g.x=x+g.offsetX;g.y=y+g.offsetY;
   this.bound(g);this.resolveSpacing();
  };
  const finish=(event:PointerEvent)=>{
   if(event.pointerId!==pointerId)return;
   pointerId=undefined;
   if(event.type==='pointerup'){
    release();
   }else if(this.held){
    this.held.state='IDLE';
    this.held.last=0;
    this.held.until=this.gameClock+500;
    this.held=undefined;
   }
  };
  const listeners={pointerdown:down,pointermove:move,pointerup:finish,pointercancel:finish,lostpointercapture:finish};
  for(const [name,callback] of Object.entries(listeners))canvas.addEventListener(name as keyof typeof listeners,callback);
  this.events.once('shutdown',()=>{
   for(const [name,callback] of Object.entries(listeners))canvas.removeEventListener(name as keyof typeof listeners,callback);
  });
 }
 layout(){this.size=Math.min(190,Math.max(76,this.scale.width/5.2),this.scale.height*.26)}
 resolveSpacing(){const offset=this.size/2-7.5;const bodies=this.girls.map(g=>({x:g.x,y:g.y-offset,halfWidth:5,height:15}));separate(bodies,this.scale.width,this.scale.height,this.held?this.girls.indexOf(this.held):-1);this.girls.forEach((g,i)=>{const b=bodies[i],y=b.y+offset;if(Math.hypot(g.x-b.x,g.y-y)>.5&&g!==this.held){g.tx=b.x;g.ty=y;g.state='IDLE';g.until=this.gameClock+500;g.vx=g.vy=0}g.x=b.x;g.y=y;this.bound(g)})}

 allowed(g:Girl,s:State){return this.preview||this.content.characters.find((c:any)=>c.id===g.id)?.states.includes(s)}
 bound(g:Girl){const half=g.sprite.displayWidth/2+6;g.x=clamp(g.x,half,this.scale.width-half);g.y=clamp(g.y,this.size+65,this.scale.height-20)}
 showProfileHint(g:Girl){
  const key='moegpt-profile-hint';
  if(localStorage.getItem(key))return false;
  localStorage.setItem(key,'1');
  const language=this.lang();
  this.say(g,language==='zh-CN'?'双击我，打开角色资料和表情包。':language==='ja-JP'?'ダブルタップでプロフィールとスタンプを見られます。':'Double-click or double-tap me for my profile and stickers.');
  return true;
 }
 startFriendEncounter(g:Girl){
  const partner=g.id==='claude'?'deepseek':g.id==='deepseek'?'claude':null;
  if(!partner)return false;
  const other=this.girls.find(candidate=>candidate.id===partner);
  if(!other||Math.hypot(g.x-other.x,g.y-other.y)>110)return false;
  if(![g,other].every(girl=>girl.state!=='ACTION'&&this.allowed(girl,'INTERACT')))return false;
  const ordered=this.content.pairs.filter((pair:any)=>pair.characters.includes(g.id)&&pair.characters.includes(other.id));
  const choices=ordered.filter((pair:any)=>pair.special===this.special);
  const replies=choices.length?choices:ordered.filter((pair:any)=>!pair.special);
  if(!replies.length)return false;
  const pair=replies[this.friendTurn++%replies.length];
  this.beginEncounter(g,other,pair,550);
  this.cooldowns.set('claude:deepseek',this.gameClock+this.content.config.pairCooldown);
  return true;
 }
 private startAction(g:Girl){
  if(!this.allowed(g,'ACTION'))return false;
  const available=(actions[g.id]??[]).filter(action=>this.textures?.exists(actionKey(action,0)));
  if(!available.length)return false;
  const index=g.actionIndex??0;
  g.action=available[index%available.length];
  g.actionIndex=index+1;
  g.state='ACTION';
  g.actionStarted=this.gameClock;
  g.vx=g.vy=0;
  g.nextActionAt=this.gameClock+25000+Math.random()*15000;
  return true;
 }
 private friendTurn=0;
 private beginEncounter(a:Girl,b:Girl,pair:any,delay=0){
  this.cancel();
  for(const girl of [a,b]){
   girl.state='INTERACT';
   girl.vx=girl.vy=0;
  }
  this.convo={a,b,turns:pair.turns,index:0,next:this.gameClock+delay,special:pair.special};
 }
 cancel(){if(this.convo){for(const g of [this.convo.a,this.convo.b]){g.state='IDLE';g.until=this.gameClock+2200}this.convo=undefined}if(this.activeBubble?.girl.state==='TALK'){this.activeBubble.girl.state='IDLE';this.activeBubble.girl.until=this.gameClock+1800}this.activeBubble?.el.remove();this.activeBubble=undefined}
 say(g:Girl,text:string,heart=false){if(this.activeBubble?.girl.state==='TALK')this.activeBubble.girl.state='IDLE';this.activeBubble?.el.remove();if(g.state!=='INTERACT'&&g.state!=='DRAG')g.state='TALK';const el=document.createElement('div');el.className='bubble'+(heart?' heart':'');el.textContent=(heart?'♡ ':'')+text;document.querySelector('#bubbles')?.append(el);this.activeBubble={girl:g,el,expires:this.gameClock+3400};if(this.soundEnabled){this.audio??=new AudioContext();const o=this.audio.createOscillator(),v=this.audio.createGain();v.gain.setValueAtTime(.025,this.audio.currentTime);v.gain.exponentialRampToValueAtTime(.001,this.audio.currentTime+.12);o.frequency.value=600+Math.random()*250;o.connect(v);v.connect(this.audio.destination);o.start();o.stop(this.audio.currentTime+.12)}}
 update(_t:number,delta:number){if(this.frozen||document.hidden)return;const dt=Math.min(delta/1000,.05);this.gameClock+=dt*1000;const t=this.gameClock;
 for(const g of this.girls){
  if(g.state==='ACTION'&&actionFrame(t-(g.actionStarted??t),g.action?.durations??[])===undefined){
   g.state='IDLE';
   g.until=t+1200;
  }
  const nextActionAt=g.nextActionAt??(5000+g.phase*1500);
  if(t>=nextActionAt&&g.state==='IDLE'&&!this.held)this.startAction(g);
  if(g.state==='IDLE'&&t>g.until&&this.allowed(g,'WALK')){
   const angle=Math.random()*Math.PI*2,dist=90+Math.random()*200;
   g.tx=clamp(g.x+Math.cos(angle)*dist,g.sprite.displayWidth/2+14,this.scale.width-g.sprite.displayWidth/2-14);
   g.ty=clamp(g.y+Math.sin(angle)*dist*.55,this.size+84,this.scale.height-28);g.state='WALK';
  }
  const dx=g.tx-g.x,dy=g.ty-g.y,d=Math.hypot(dx,dy),walking=g.state==='WALK'&&d>3;
  const speed=walking?Math.min(43+g.phase,Math.sqrt(d*95)):0;
  const ease=1-Math.exp(-dt*8);
  g.vx=(g.vx||0)+((walking?dx/d*speed:0)-(g.vx||0))*ease;
  g.vy=(g.vy||0)+((walking?dy/d*speed:0)-(g.vy||0))*ease;
  if(g.state!=='DRAG'&&g.state!=='INTERACT') {g.x+=g.vx*dt;g.y+=g.vy*dt}
  if(g.state==='WALK'&&d<=3){g.state='IDLE';g.until=t+1600+Math.random()*3200}
  g.stride=(g.stride||0)+Math.hypot(g.vx,g.vy)*dt/13;
  g.walkBlend=(g.walkBlend||0)+((walking?1:0)-(g.walkBlend||0))*ease;
  this.bound(g);
 }
 this.resolveSpacing();
 for(const g of this.girls){
  const animate=this.allowed(g,g.state)&&!this.reduced,blend=g.walkBlend||0,stride=g.stride||0;
  // Travel-driven gait: a step slows and stops with the character rather than looping while stationary.
  const bob=animate?Math.abs(Math.sin(stride))*3.2*blend+Math.sin(t/1100+g.phase)*.7*(1-blend):0;
  const lean=animate?Math.sin(stride)*1.3*blend+(g.vx||0)*.018:0;
  const walkKey = `${g.id}-walk-${walkFrame(stride)}`;
  const drawnWalk = animate && g.state === 'WALK' && blend > .08 && this.textures?.exists(walkKey);
  if(drawnWalk)g.lastWalkAt=t;
  const settlePose=animate&&g.state==='IDLE'&&g.lastWalkAt!==undefined&&t-g.lastWalkAt<160&&this.textures?.exists(`${g.id}-walk-1`);
  const blinkKey=g.id+'-blink';
  const blinkPhase=(t+g.phase*970)%(3800+g.phase*190);
  const blinking=animate&&g.state==='IDLE'&&blinkPhase>=350&&blinkPhase<485&&this.textures?.exists(blinkKey);
  const acting=g.state==='ACTION';
  const frame=acting?actionFrame(t-(g.actionStarted??t),g.action?.durations??[]):undefined;
  const key = frame!==undefined&&g.action ? actionKey(g.action,this.reduced?0:frame) : drawnWalk ? walkKey : settlePose ? `${g.id}-walk-1` : blinking ? blinkKey : g.id;
  if (g.sprite.texture && g.sprite.texture.key !== key) {
   g.sprite.setTexture(key, (drawnWalk || settlePose) && g.id === 'chatgpt' ? 'pose' : undefined);
   g.sprite.setDisplaySize(this.size * g.sprite.width / g.sprite.height, this.size);
  }
  if(drawnWalk&&Math.abs(g.vx||0)>2)g.walkFacing=(g.vx||0)<0;
  g.sprite.setFlipX((drawnWalk||settlePose)&&!!g.walkFacing);
  const fallbackMotion = !acting && !drawnWalk && !settlePose;
  const held = g === this.held;
  g.sprite.setPosition(g.x, g.y - (fallbackMotion ? bob : 0) - (held ? 8 : 0));
  const partner=this.convo&&g.state==='INTERACT'?(this.convo.a===g?this.convo.b:this.convo.a):null;
  const glance=partner&&animate?clamp((partner.x-g.x)*.07,-7,7):0;
  g.sprite.setAngle(held ? Math.sin(t / 220) * 2 : partner ? glance : fallbackMotion ? lean : 0);
  g.sprite.setDepth(g===this.held?9999:g.y);g.shadow.setPosition(g.x,g.y-3).setDepth(g.y-1);g.shadow.setAlpha(g.state==='DRAG'?.08:.18);
 }

 if(this.convo&&t>=this.convo.next){const c=this.convo,turn=c.turns[c.index++];if(turn){const g=turn.character===c.a.id?c.a:c.b;this.say(g,turn.text[this.lang()],c.special);c.next=t+3600}else this.cancel()}
 if(!this.convo&&!this.held&&!this.activeBubble){outer:for(let i=0;i<this.girls.length;i++)for(let j=i+1;j<this.girls.length;j++){const a=this.girls[i],b=this.girls[j],key=[a.id,b.id].sort().join(':');if(a.state==='ACTION'||b.state==='ACTION'||t<(this.cooldowns.get(key)||0)||Math.hypot(a.x-b.x,a.y-b.y)>this.content.config.encounterDistance||!this.allowed(a,'INTERACT')||!this.allowed(b,'INTERACT'))continue;this.cooldowns.set(key,t+this.content.config.pairCooldown);if(Math.random()>.6)continue;const pool=this.content.pairs.filter((p:any)=>p.characters.includes(a.id)&&p.characters.includes(b.id)&&(!p.special||this.special));const special=pool.filter((p:any)=>p.special);const ordinary=pool.filter((p:any)=>!p.special);const selected=special.length&&Math.random()<.3?special:ordinary;if(!selected.length)continue;const p=selected[Math.floor(Math.random()*selected.length)];this.beginEncounter(a,b,p);break outer}}
 if(t>this.nextSolo&&!this.convo&&!this.held&&!this.activeBubble){this.nextSolo=t+6500+Math.random()*7000;const g=Phaser.Utils.Array.GetRandom(this.girls) as Girl|undefined;if(g&&g.state!=='ACTION'&&this.allowed(g,'TALK')){const ls=this.content.lines.filter((l:any)=>l.character===g.id);if(ls.length)this.say(g,ls[Math.floor(Math.random()*ls.length)].text[this.lang()])}}
 const b=this.activeBubble;if(b){if(t>b.expires){b.el.remove();if(b.girl.state==='TALK'){b.girl.state='IDLE';b.girl.until=t+1200}this.activeBubble=undefined}else{b.el.style.left=clamp(b.girl.x,100,this.scale.width-100)+'px';b.el.style.top=Math.max(4,b.girl.y-this.size-65)+'px'}}
 }
}

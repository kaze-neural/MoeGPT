import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import ts from 'typescript';
const load=n=>JSON.parse(fs.readFileSync(`src/data/${n}.json`,'utf8'));
const transpile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const model=transpile(fs.readFileSync('src/animation/model.ts','utf8'));
const {step,clamp,separate,canDoubleTap,walkFrame}=await import('data:text/javascript;base64,'+Buffer.from(model).toString('base64'));
test('movement is frame independent at 30 / 60 / 120fps',()=>{for(const fps of [30,60,120]){let p={x:0,y:0};for(let n=0;n<fps;n++)p=step(p.x,p.y,1000,0,50,1/fps);assert.ok(Math.abs(p.x-50)<.001)}});
test('movement never overshoots; suspension delta capped',()=>{assert.deepEqual(step(0,0,1,0,100,.04),{x:1,y:0,done:true});assert.equal(step(0,0,1000,0,100,10).x,5);assert.equal(step(1,1,1,1,100,.01).done,true)});
test('boundaries and drag-doubletap arbitration',()=>{assert.equal(clamp(-100,50,300),50);assert.equal(clamp(900,50,300),300);assert.equal(canDoubleTap(1000,1200,true),false);assert.equal(canDoubleTap(1000,1200,false),true);assert.equal(canDoubleTap(1000,1500,false),false)});
const chars=load('characters'),dialogues=load('dialogues'),review=load('review');
test('five runtime character images and twenty sticker files',()=>{assert.equal(chars.length,5);for(const c of chars){assert.ok(fs.statSync(`assets/characters/${c.id}.png`).size>1000);for(let k=0;k<4;k++)assert.ok(fs.statSync(`assets/stickers/${c.id}-${k}.png`).size>1000)}});
test('75 solo lines, 20 ordinary pairs, 3 special pairs, complete translations',()=>{for(const c of chars)assert.equal(dialogues.lines.filter(l=>l.character===c.id).length,15);assert.equal(dialogues.pairs.filter(p=>!p.special).length,20);assert.equal(dialogues.pairs.filter(p=>p.special).length,3);for(const x of [...dialogues.lines,...dialogues.pairs.flatMap(p=>p.turns)])for(const l of ['zh-CN','en-US','ja-JP'])assert.ok(x.text[l].length>0);for(const x of [...dialogues.lines,...dialogues.pairs])assert.ok(review[x.id])});
test('all UI translations have matching keys',()=>{const read=l=>JSON.parse(fs.readFileSync(`src/locales/${l}.json`,'utf8'));assert.deepEqual(Object.keys(read('en-US')).sort(),Object.keys(read('zh-CN')).sort());assert.deepEqual(Object.keys(read('ja-JP')).sort(),Object.keys(read('zh-CN')).sort())});
// Execute the real scene's state transitions with renderer and DOM doubles.
const sceneSource=transpile(fs.readFileSync('src/scenes/Lounge.ts','utf8')).replace(/import actionData from .*?;/,()=>`const actionData=${JSON.stringify(load('actions'))};`).replace(/import Phaser from 'phaser';/,`const Phaser={Scene:class{},Utils:{Array:{GetRandom:a=>a[0]}}};`).replace(/import .* from '..\/animation\/model';/,model.replace(/export /g,''));
globalThis.matchMedia=()=>({matches:false});globalThis.document={hidden:false,createElement:()=>({style:{},remove(){this.removed=true}}),querySelector:()=>({append(){}})};
const {Lounge}=await import('data:text/javascript;base64,'+Buffer.from(sceneSource).toString('base64'));
const chain=()=>{const obj={displayWidth:80};for(const n of ['setPosition','setAngle','setDepth','setAlpha','setFlipX'])obj[n]=()=>obj;return obj};
function make(){const s=new Lounge({characters:chars.map(c=>({...c,states:['IDLE','WALK','TALK','DRAG','INTERACT']})),lines:dialogues.lines,pairs:dialogues.pairs,config:load('config')},()=> 'zh-CN',true,()=>{});s.scale={width:600,height:400};s.size=100;s.nextSolo=1e9;s.girls=['deepseek','claude'].map((id,i)=>({id,sprite:chain(),shadow:chain(),x:200+i*50,y:300,tx:200+i*50,ty:300,state:'IDLE',until:1e9,phase:i}));return s}
test('scene boundary clamping, frozen and hidden pause',()=>{const s=make(),g=s.girls[0];g.x=-100;g.y=900;s.bound(g);assert.equal(g.x,46);assert.equal(g.y,380);s.frozen=true;s.update(0,1000);assert.equal(s.gameClock,0);s.frozen=false;document.hidden=true;s.update(0,1000);assert.equal(s.gameClock,0);document.hidden=false});
test('encounter runs sequentially, caps bubbles, returns to idle and honors cooldown',()=>{const s=make();const random=Math.random;Math.random=()=>0;try{s.update(0,16);assert.ok(s.convo);assert.equal(s.girls[0].state,'INTERACT');s.update(0,16);assert.equal(s.convo.index,1);const first=s.activeBubble.el;for(let n=0;n<75;n++)s.update(0,50);assert.ok(first.removed);assert.equal(s.convo.index,2);for(let n=0;n<300&&s.convo;n++)s.update(0,50);assert.equal(s.convo,undefined);assert.ok(s.girls.every(g=>g.state==='IDLE'));for(let n=0;n<60;n++)s.update(0,50);assert.ok(s.girls.every(g=>g.state!=='INTERACT'));assert.ok([...s.cooldowns.values()][0]>s.gameClock)}finally{Math.random=random}});
test('special toggle excludes special exchanges; cancel resumes participants',()=>{const s=make();s.special=false;const random=Math.random;Math.random=()=>0;try{s.update(0,16);assert.equal(s.convo.special,false);s.cancel();assert.ok(s.girls.every(g=>g.state==='IDLE'));assert.equal(s.activeBubble,undefined)}finally{Math.random=random}});
test('all default content remains draft pending user review',()=>{assert.ok(Object.values(review).every(x=>['draft','approved','hidden'].includes(x.status)))});

function noOverlap(bs){for(let i=0;i<bs.length;i++)for(let j=i+1;j<bs.length;j++){const a=bs[i],b=bs[j];assert.ok(Math.abs(a.x-b.x)>=a.halfWidth+b.halfWidth+.3||Math.abs((a.y-a.height/2)-(b.y-b.height/2))>=(a.height+b.height)/2+.3,`overlap ${i},${j}`)}}
test('five small center colliders separate on mobile and desktop',()=>{for(const [w,h,size] of [[390,700,85],[1280,720,190],[320,480,76]]){const bs=Array.from({length:5},()=>({x:w/2,y:h*.6,halfWidth:5,height:15}));separate(bs,w,h);noOverlap(bs);for(const b of bs){assert.ok(b.x>=b.halfWidth+8&&b.x<=w-b.halfWidth-8);assert.ok(b.y<=h-18)}}});
test('drag anchor stays under pointer and pushes neighbors out at screen edges',()=>{for(const x of [60,195,330]){const bs=Array.from({length:5},(_,i)=>({x:i===0?x:195,y:350,halfWidth:5,height:15}));const anchored=bs[0].x;separate(bs,390,700,0);assert.equal(bs[0].x,anchored);noOverlap(bs)}});

test('artwork may overlap until the 10 by 15 pixel center boxes touch',()=>{const bs=[{x:100,y:200,halfWidth:5,height:15},{x:125,y:200,halfWidth:5,height:15}];separate(bs,390,700);assert.equal(bs[0].x,100);assert.equal(bs[1].x,125);bs[1].x=104;separate(bs,390,700,0);assert.equal(bs[0].x,100);assert.ok(Math.abs(bs[1].x-bs[0].x)>=10||Math.abs(bs[1].y-bs[0].y)>=15)});

test('drawn walk uses all eight poses and loops with traveled distance',()=>{assert.deepEqual(Array.from({length:8},(_,i)=>walkFrame(i*Math.PI/8+.0001)),[0,1,2,3,4,5,6,7]);assert.equal(walkFrame(Math.PI),0);for(let i=1;i<=8;i++)assert.ok(fs.statSync(`assets/animations/chatgpt-walk-drawn-v1/frame-${String(i).padStart(2,'0')}.png`).size>1000)});

test('dropping Claude near DeepSeek pauses both before a replayable exchange', () => {
 const scene = make();
 const [deepseek, claude] = scene.girls;
 assert.equal(scene.startFriendEncounter(claude), true);
 const first = scene.convo.turns;
 assert.equal(scene.convo.next, 550);
 assert.ok(scene.girls.every(girl => girl.state === 'INTERACT'));
 scene.update(0, 50);
 assert.equal(scene.activeBubble, undefined);
 assert.equal(scene.startFriendEncounter(claude), true);
 assert.notEqual(scene.convo.turns, first);
 scene.special = false;
 assert.equal(scene.startFriendEncounter(claude), true);
 assert.equal(scene.convo.special, false);
 claude.x = deepseek.x + 111;
 assert.equal(scene.startFriendEncounter(claude), false);
});

test('touch drag follows scaled canvas coordinates and cancellation clears the hold', () => {
 const scene = make();
 const listeners = {};
 const captured = [];
 scene.game = { canvas: {
  getBoundingClientRect: () => ({left:40, top:20, width:300, height:200}),
  addEventListener: (name, callback) => { listeners[name] = callback; },
  setPointerCapture: id => captured.push(id),
 }};
 scene.events = { once() {} };
 for (const girl of scene.girls) girl.sprite.getBounds = () => ({
  left:girl.x-40, right:girl.x+40, top:girl.y-100, bottom:girl.y,
 });
 let releases = 0;
 scene.bindDrag(() => { releases++; scene.held = undefined; });
 const event = (type, x, y, pointerId=7) => ({
  type, clientX:40+x/2, clientY:20+y/2, pointerId, pointerType:'touch', button:0, preventDefault(){},
 });
 const girl = scene.girls[0];
 listeners.pointerdown(event('pointerdown',200,250));
 assert.equal(scene.held,girl);
 assert.deepEqual(captured,[7]);
 listeners.pointermove(event('pointermove',150,210,8));
 assert.equal(girl.x,200);
 listeners.pointermove(event('pointermove',150,210));
 assert.equal(girl.x,150);
 assert.equal(girl.y,260);
 assert.equal(girl.moved,true);
 listeners.pointercancel(event('pointercancel',150,210));
 assert.equal(scene.held,undefined);
 assert.equal(girl.state,'IDLE');
 assert.equal(releases,0);
 listeners.pointerdown(event('pointerdown',150,210));
 listeners.pointerup(event('pointerup',150,210));
 assert.equal(releases,1);
});

test('each character has a distinct closed-eye PNG registered to its idle canvas', () => {
 for (const {id} of chars) {
  const open = fs.readFileSync(`assets/characters/${id}.png`);
  const closed = fs.readFileSync(`assets/animations/blink/${id}.png`);
  assert.equal(closed.subarray(12, 16).toString(), 'IHDR');
  assert.deepEqual(closed.subarray(16, 24), open.subarray(16, 24), id);
  assert.notDeepEqual(closed, open, id);
 }
});

test('all five characters automatically play their full action and return to idle', () => {
 for (const character of chars) {
  const scene = make();
  const girl = scene.girls[0];
  girl.id = character.id;
  girl.phase = chars.indexOf(character)*2;
  girl.sprite.texture = {key:girl.id};
  girl.sprite.setTexture = key => { girl.sprite.texture.key = key; };
  girl.sprite.setDisplaySize = () => {};
  scene.girls = [girl];
  scene.textures = {exists:key => key.startsWith(girl.id+'-action-')};
  const poses = new Set();
  for(let n=0;n<450;n++) {
   scene.update(0,50);
   const key=girl.sprite.texture.key;
   if(key.startsWith(girl.id+'-action-'))poses.add(key);
   else if(poses.size>0)break;
  }
  assert.deepEqual([...poses],Array.from({length:8},(_,i)=>girl.id+'-action-'+i),girl.id);
  assert.equal(girl.state,'IDLE',girl.id);
  assert.equal(girl.sprite.texture.key,girl.id);
 }
});

test('Grok cycles through laugh and axe actions without replacing either',()=>{
 const scene=make(),girl=scene.girls[0];
 girl.id='grok';
 scene.textures={exists:()=>true};
 const expected=['grok','grok-axe','grok'];
 for(const folder of expected){
  assert.equal(scene.startAction(girl),true);
  assert.equal(girl.action.folder,folder);
  for(let i=1;i<=girl.action.durations.length;i++){
   assert.ok(fs.existsSync(`assets/animations/actions/${folder}/frame-${i}.png`));
  }
 }
 assert.equal(load('actions').grok[1].durations.length,11);
});

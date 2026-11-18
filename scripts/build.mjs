import {build} from 'vite';
import fs from 'node:fs';
const read=n=>JSON.parse(fs.readFileSync(`src/data/${n}.json`,'utf8'));
const actions=read('actions');
const review=read('review');const ok=id=>review[id]?.status==='approved';
await build();
for(const c of read('characters')){
 if(!ok(`character-${c.id}`))continue;
 const copy=(from,to)=>{fs.mkdirSync('dist/art/'+to.substring(0,to.lastIndexOf('/')),{recursive:true});fs.copyFileSync('assets/'+from,'dist/art/'+to)};
 copy(`characters/${c.id}.png`,`characters/${c.id}.png`);
 if(ok(`animation-${c.id}-IDLE`))copy(`animations/blink/${c.id}.png`,`animations/blink/${c.id}.png`);
 if(ok(`animation-${c.id}-WALK`))for(let i=1;i<=8;i++){const name=`animations/${c.id}-walk-drawn-v1/frame-${String(i).padStart(2,'0')}.png`;copy(name,name)}
 if(ok(`animation-${c.id}-ACTION`))for(const action of actions[c.id]??[]){
  for(let i=1;i<=action.durations.length;i++){
   const name=`animations/actions/${action.folder}/frame-${i}.png`;
   copy(name,name);
  }
 }
 if(ok(`profile-${c.id}`))for(let k=0;k<4;k++)if(ok(`sticker-${c.id}-${k}`))copy(`stickers/${c.id}-${k}.png`,`stickers/${c.id}-${k}.png`);
}
console.log('Production sanitized: approved content only; no admin, references or draft assets.');

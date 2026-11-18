import Phaser from 'phaser';
import data from 'virtual:content';
import zh from './locales/zh-CN.json';import en from './locales/en-US.json';import ja from './locales/ja-JP.json';
import {Lounge} from './scenes/Lounge';import './styles/main.css';
type Lang='zh-CN'|'en-US'|'ja-JP';const locales={ 'zh-CN':zh,'en-US':en,'ja-JP':ja};let lang=(localStorage.getItem('moe-lang')||(navigator.language.startsWith('ja')?'ja-JP':navigator.language.startsWith('en')?'en-US':'zh-CN')) as Lang;if(!(lang in locales))lang='zh-CN';const t=(k:keyof typeof zh)=>locales[lang][k];
const dev=import.meta.env.DEV;const draft=dev&&new URLSearchParams(location.search).get('draft')==='1';let paused=false,sound=localStorage.getItem('moe-sound')==='true';
const app=document.querySelector<HTMLDivElement>('#app')!;app.innerHTML=`<header><nav>
<select id="language"><option value="zh-CN">简体中文</option><option value="ja-JP">日本語</option><option value="en-US">English</option></select>
<button id="sound"></button><button id="pause"></button><button id="help">?</button>
</nav></header><main><section class="room">
<div class="window w1"></div><div class="window w2"></div>
<div class="orbit o1"></div><div class="orbit o2"></div><div class="floor"></div>
<div class="plants">✦</div><div class="spark s1">✧</div><div class="spark s2">✧</div><div class="spark s3">·</div>
<div id="stage"></div><div id="bubbles"></div><div id="empty"></div>
</section></main><div id="overlay" hidden></div>`;
const $=(id:string)=>document.getElementById(id)!;
const shown=()=>draft?data.characters:data.characters.filter((c:any)=>data.review['character-'+c.id]?.status==='approved'||!dev);
const filtered={...data,characters:shown(),lines:draft?data.lines:data.lines.filter((x:any)=>!dev||data.review[x.id]?.status==='approved'),pairs:draft?data.pairs:data.pairs.filter((x:any)=>!dev||data.review[x.id]?.status==='approved')};
if(!draft&&dev)filtered.characters=filtered.characters.map((c:any)=>({...c,profile:data.review['profile-'+c.id]?.status==='approved',stickers:c.stickers.filter((k:number)=>data.review[`sticker-${c.id}-${k}`]?.status==='approved'),states:c.states.filter((s:string)=>data.review[`animation-${c.id}-${s}`]?.status==='approved')}));
const scene=new Lounge(filtered,()=>lang,draft,openProfile);scene.soundEnabled=sound;scene.special=data.config.specialEnabled;
const game=new Phaser.Game({type:Phaser.CANVAS,parent:'stage',transparent:true,scale:{mode:Phaser.Scale.RESIZE,width:$('stage').clientWidth,height:$('stage').clientHeight},scene,render:{antialias:true},audio:{noAudio:true},fps:{target:(matchMedia('(prefers-reduced-motion: reduce)').matches||navigator.hardwareConcurrency<=4)?30:60,forceSetTimeOut:false}});
const observer=new ResizeObserver(()=>{const el=document.getElementById('stage');if(el&&el.clientWidth&&el.clientHeight)game.scale.resize(el.clientWidth,el.clientHeight)});observer.observe($('stage'));
function text(){document.documentElement.lang=lang;$('pause').textContent=paused?'▶':'Ⅱ';$('pause').title=t(paused?'resume':'pause');$('pause').setAttribute('aria-label',t(paused?'resume':'pause'));$('sound').textContent=sound?'♪':'♩';$('sound').title=t('sound');$('sound').setAttribute('aria-label',t('sound'));$('sound').setAttribute('aria-pressed',String(sound));$('pause').setAttribute('aria-pressed',String(paused));$('help').setAttribute('aria-label',t('help'));$('language').setAttribute('aria-label',t('locale'));($('language') as HTMLSelectElement).value=lang;$('empty').textContent=shown().length?'':t('empty');}
function modal(html:string){scene.frozen=true;$('overlay').hidden=false;$('overlay').innerHTML=`<article class="modal" role="dialog" aria-modal="true"><button class="close" id="close">${t('close')} ×</button>${html}</article>`;$('close').onclick=close;$('close').focus()}
function close(){history.replaceState(null,'',location.pathname+location.search);$('overlay').hidden=true;$('overlay').replaceChildren();scene.frozen=paused}
function stickerLabel(index:number){
 const labels={
  'zh-CN':['开心','生气','悲伤','鄙视'],
  'ja-JP':['喜び','怒り','悲しみ','軽蔑'],
  'en-US':['Happy','Angry','Sad','Contempt']
 };
 return labels[lang][index] ?? '';
}
function openProfile(id:string){const c=filtered.characters.find((c:any)=>c.id===id);if(!c)return;location.hash='girl/'+id;if(!c.profile&&!draft){modal(`<h2>${c.name}</h2><p>${t('empty')}</p>`);return}modal(`<div class="profile-hero"><img src="${import.meta.env.BASE_URL}art/characters/${id}.png?v=${import.meta.env.VITE_ART_VERSION}" alt="${c.name}"><div><div class="eyebrow">${t('bio')}</div><h2>${c.name}</h2><p>${c.ja} · ${lang==='en-US'?'AI Girl':'AI少女'}</p><span class="tag">${t('fan')}</span></div></div><div class="profile-grid"><section><h3>${t('facts')}</h3><p>${c.company}</p><p>${c.facts[lang]}</p><a href="${c.source}" target="_blank" rel="noopener">${new URL(c.source).hostname} ↗</a><small>2026-11-17</small></section><section><h3>${t('fan')}</h3><p>${c.fan[lang]}</p><blockquote>${filtered.lines.find((l:any)=>l.character===id)?.text[lang]||''}</blockquote></section></div><h3>${t('stickers')}</h3><div class="stickers">${c.stickers.map((k:number)=>`<div><button class="sticker" data-k="${k}"><img loading="lazy" src="${import.meta.env.BASE_URL}art/stickers/${id}-${k}.png?v=${import.meta.env.VITE_ART_VERSION}" alt="${stickerLabel(k)}"></button><span class="sticker-label">${stickerLabel(k)}</span><a download="${id}-${k}.png" href="${import.meta.env.BASE_URL}art/stickers/${id}-${k}.png?v=${import.meta.env.VITE_ART_VERSION}">${t('download')} ↓</a></div>`).join('')||t('empty')}</div><button id="back">← ${t('back')}</button>`);$('back').onclick=close;document.querySelectorAll<HTMLButtonElement>('.sticker').forEach(b=>b.onclick=()=>{const dialog=document.createElement('dialog');dialog.className='image-dialog';dialog.innerHTML=`<img src="${import.meta.env.BASE_URL}art/stickers/${id}-${b.dataset.k}.png?v=${import.meta.env.VITE_ART_VERSION}" alt="${c.name}"><button>${t('close')}</button>`;document.body.append(dialog);dialog.querySelector('button')!.onclick=()=>dialog.close();dialog.onclose=()=>dialog.remove();dialog.showModal()})}
$('language').onchange=()=>{lang=($('language') as HTMLSelectElement).value as Lang;localStorage.setItem('moe-lang',lang);scene.cancel();text();if(location.hash.startsWith('#girl/'))openProfile(location.hash.slice(6))};
$('pause').onclick=()=>{paused=!paused;scene.frozen=paused||!$('overlay').hidden;text()};$('sound').onclick=()=>{sound=!sound;scene.soundEnabled=sound;localStorage.setItem('moe-sound',String(sound));text()};$('help').onclick=()=>modal(`<h2>${t('first')}</h2><p>${t('helpText')}</p><small>${t('disclaimer')}</small>`);
window.addEventListener('keydown',e=>{if(e.key==='Escape')close();if(e.code==='Space'&&e.target===document.body){e.preventDefault();$('pause').click()}if(e.key==='Tab'&&!$('overlay').hidden){const f=Array.from($('overlay').querySelectorAll<HTMLElement>('button,a,select'));const a=f[0],b=f[f.length-1];if(e.shiftKey&&document.activeElement===a){e.preventDefault();b.focus()}else if(!e.shiftKey&&document.activeElement===b){e.preventDefault();a.focus()}}});window.addEventListener('hashchange',()=>{if(location.hash.startsWith('#girl/'))openProfile(location.hash.slice(6));else close()});window.addEventListener('pagehide',()=>{observer.disconnect();game.destroy(true)});text();
if(location.hash.startsWith('#girl/'))openProfile(location.hash.slice(6));

/* Interface panel (full UI customisation) + performance tweaks.
   Loaded after the engine, so it shares its globals (S, cur, tgt, draw, DRAGT, …). */
(()=>{
'use strict';
const KEY='mapquiz.exp.ui.v1',$=id=>document.getElementById(id),root=document.documentElement,B=document.body;
const FONTS={mono:'ui-monospace,"Cascadia Mono",Consolas,Menlo,monospace',sans:'"Segoe UI",system-ui,Arial,sans-serif',cond:'Bahnschrift,"Arial Narrow",system-ui,sans-serif',serif:'Georgia,"Times New Roman",serif'};
const VAR={sea:'--sea',land:'--land',landHi:'--land-hi',line:'--line',accent:'--gold',ok:'--ok',bad:'--bad',panel:'--panel',edge:'--edge',ink:'--ink',mute:'--mute'};
const CYBER={sea:'#06080b',land:'#161c24',landHi:'#27323f',line:'#06080b',accent:'#00e0ff',ok:'#19e68c',bad:'#ff3b4e',panel:'#0b0f14',edge:'#1d2631',ink:'#e6edf3',mute:'#6b7a8a',font:'mono',r:0,bw:1};
const PRESETS={cyber:CYBER,
 stealth:{...CYBER,sea:'#0a0a0a',land:'#1c1c1c',landHi:'#333',line:'#0a0a0a',accent:'#e8e8e8',ok:'#9be58f',bad:'#e5655f',panel:'#0f0f0f',edge:'#222',ink:'#d8d8d8',mute:'#767676'},
 amber:{...CYBER,sea:'#0b0800',land:'#1d1600',landHi:'#3a2c00',line:'#0b0800',accent:'#ffb000',ok:'#7dff5a',bad:'#ff4d2e',panel:'#100c00',edge:'#2a2000',ink:'#ffd27a',mute:'#8a6a1f'},
 light:{...CYBER,sea:'#eef1f4',land:'#cdd5de',landHi:'#b3bfcc',line:'#eef1f4',accent:'#0057ff',ok:'#12a05c',bad:'#d92c3f',panel:'#ffffff',edge:'#cfd6de',ink:'#0d1117',mute:'#69758a'}};
const DEF={...CYBER,ui:1,tn:22,tf:30,hudop:1,cw:.6,dot:1,showDots:true,shape:'auto',fastpan:false,still:false,fps:false,
 drag:8,showTimer:true,tmSize:20,tmTenths:false,tmPos:'score',hideScore:false,hideProg:false,hideAtt:false,hideZoom:false,hideMenu:false,hideRestart:false,taskPos:'top',zoomPos:'left',css:''};
let U={...DEF};try{Object.assign(U,JSON.parse(localStorage.getItem(KEY)||'{}'))}catch(e){}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(U))}catch(e){}};

/* ---- performance: micro-state dot radius is ONE css variable per frame (engine wrote r on every dot every frame) ---- */
const gw=$('w'),gd=$('dots');
window.draw=function(){gw.setAttribute('transform','translate('+cur.x+' '+cur.y+') scale('+cur.k+')');gd.style.setProperty('--dr',(5*U.dot/cur.k)+'px')};
let mvT=0;const mv=()=>{if(!U.fastpan)return;B.classList.add('mv');clearTimeout(mvT);mvT=setTimeout(()=>B.classList.remove('mv'),180)};
$('map').addEventListener('wheel',mv,{passive:true});$('map').addEventListener('mousemove',e=>{if(e.buttons)mv()});
let fpsOn=false,fe=null;
function fpsToggle(){
 if(U.fps&&!fpsOn){fpsOn=true;fe=fe||Object.assign(document.createElement('div'),{id:'fps'});B.appendChild(fe);let n=0,t0=performance.now();
  (function f(t){if(!fpsOn)return;n++;if(t-t0>=500){fe.textContent=Math.round(n*1000/(t-t0))+' FPS';n=0;t0=t}requestAnimationFrame(f)})(t0)}
 else if(!U.fps&&fpsOn){fpsOn=false;if(fe)fe.remove()}}

/* ---- on-screen timer: same clock as the final stats (starts at the first click, pauses excluded) ---- */
const tm=Object.assign(document.createElement('div'),{id:'tmr'});B.appendChild(tm);
setInterval(()=>{if(!U.showTimer)return;if(!G){tm.textContent='';return}
 let v=G.t0===undefined?(G.fin?G.t:gt()):G.t0===null?0:(G.fin?G.t:gt())-G.t0;v=Math.max(0,v);
 const s=Math.floor(v/1000),f=Math.floor(v%1000/100);tm.textContent=Math.floor(s/60)+':'+String(s%60).padStart(2,'0')+(U.tmTenths?'.'+f:'')},100);
/* ---- apply settings ---- */
const ucss=document.head.appendChild(Object.assign(document.createElement('style'),{id:'ucss'}));
function apply(){
 const st=root.style;for(const k in VAR)st.setProperty(VAR[k],U[k]);
 st.setProperty('--font',FONTS[U.font]||FONTS.mono);
 [['--ui',U.ui],['--tn',U.tn+'px'],['--tf',U.tf+'px'],['--r',U.r+'px'],['--bw',U.bw+'px'],['--hudop',U.hudop],['--cw',U.cw]].forEach(([k,v])=>st.setProperty(k,v));
 const T=(c,on)=>B.classList.toggle(c,!!on);
 T('hide-score',U.hideScore);T('hide-prog',U.hideProg);T('hide-att',U.hideAtt);T('hide-zoom',U.hideZoom);T('hide-menu',U.hideMenu);T('hide-restart',U.hideRestart);
 T('task-bottom',U.taskPos==='bottom');T('zoom-right',U.zoomPos==='right');T('nodots',!U.showDots);T('still',U.still);T('fastpan',U.fastpan);
 DRAGT=U.drag;st.setProperty('--tms',U.tmSize+'px');B.dataset.tmpos=U.tmPos;T('tm-hide',!U.showTimer);T('shape-crisp',U.shape==='crisp');T('shape-speed',U.shape==='speed');
 ucss.textContent=U.css||'';fpsToggle();window.draw()}

/* ---- the panel: schema -> controls. Labels are "EN|RU". Types: c colour, r range, s select, k checkbox, t custom css ---- */
const SC=[['Theme|Тема',[['c','sea','Background|Фон'],['c','land','Land|Суша'],['c','landHi','Land hover|Суша при наведении'],['c','line','Borders|Границы'],['c','accent','Accent|Акцент'],['c','ok','Correct|Верно'],['c','bad','Wrong|Ошибка'],['c','panel','Panels|Панели'],['c','edge','Panel border|Рамки'],['c','ink','Text|Текст'],['c','mute','Muted text|Второстепенный текст']]],
 ['Type & shape|Шрифт и форма',[['s','font','Font|Шрифт',{mono:'Mono',sans:'Sans',cond:'Condensed',serif:'Serif'}],['r','ui','UI scale|Масштаб интерфейса',.7,1.6,.05],['r','tn','Task name size|Размер названия',12,56,1],['r','tf','Task flag size|Размер флага',14,72,1],['r','r','Corner radius|Скругление',0,20,1],['r','bw','Border width|Толщина рамок',0,4,1]]],
 ['Map|Карта',[['r','cw','Country borders|Границы стран',0,2.5,.1],['r','dot','Micro-state dots|Точки микрогосударств',.4,3,.1],['k','showDots','Show dots|Показывать точки'],['r','drag','Click tolerance (px)|Допуск клика (px)',2,24,1],['s','shape','Rendering|Отрисовка',{auto:'Auto',crisp:'Crisp edges',speed:'Speed'}]]],
 ['Timer|Таймер',[['k','showTimer','Show timer|Показывать таймер'],['s','tmPos','Position|Позиция',{score:'Under score',task:'Under task',menu:'Under menu'}],['r','tmSize','Size|Размер',10,56,1],['k','tmTenths','Tenths|Десятые доли']]],
 ['HUD|Интерфейс',[['r','hudop','HUD opacity|Прозрачность HUD',.2,1,.05],['s','taskPos','Task position|Позиция задания',{top:'Top',bottom:'Bottom'}],['s','zoomPos','Zoom buttons|Кнопки зума',{left:'Left',right:'Right'}],['k','hideScore','Hide score|Скрыть счёт'],['k','hideProg','Hide progress|Скрыть прогресс'],['k','hideAtt','Hide attempts|Скрыть попытки'],['k','hideZoom','Hide zoom buttons|Скрыть кнопки зума'],['k','hideMenu','Hide menu button|Скрыть кнопку меню'],['k','hideRestart','Hide restart button|Скрыть кнопку перезапуска']]],
 ['Performance|Производительность',[['k','fastpan','Hide borders while moving|Скрывать границы при движении'],['k','still','Reduce motion|Меньше анимаций'],['k','fps','FPS counter|Счётчик FPS']]],
 ['Custom CSS|Свой CSS',[['t']]]];
const L=s=>{const p=s.split('|');return S.lang==='ru'&&p[1]?p[1]:p[0]};
const set=(k,v)=>{U[k]=v;save();apply()};
function ctl([type,key,label,a,b,c]){
 if(type==='t'){const ta=document.createElement('textarea');ta.value=U.css;ta.spellcheck=false;ta.placeholder='#score b{color:red}';ta.oninput=()=>set('css',ta.value);return ta}
 const row=document.createElement('label'),sp=document.createElement('span');sp.textContent=L(label);row.appendChild(sp);
 const mk=(tag,props)=>Object.assign(document.createElement(tag),props);let el;
 if(type==='c'){el=mk('input',{type:'color',value:U[key]});el.oninput=()=>set(key,el.value);row.appendChild(el)}
 else if(type==='r'){el=mk('input',{type:'range',min:a,max:b,step:c,value:U[key]});const v=mk('b',{className:'v',textContent:U[key]});el.oninput=()=>{v.textContent=el.value;set(key,+el.value)};row.append(el,v)}
 else if(type==='s'){el=mk('select');for(const o in a)el.appendChild(mk('option',{value:o,textContent:a[o],selected:U[key]===o}));el.onchange=()=>set(key,el.value);row.appendChild(el)}
 else{el=mk('input',{type:'checkbox',checked:!!U[key]});el.onchange=()=>set(key,el.checked);row.appendChild(el)}
 return row}
function build(){
 const body=$('uiBody');body.innerHTML='';
 SC.forEach(([title,items])=>{const sec=document.createElement('section');sec.className='sec';sec.innerHTML='<h2></h2>';sec.firstChild.textContent=L(title);items.forEach(i=>sec.appendChild(ctl(i)));body.appendChild(sec)});
 $('uiTitle').textContent=L('INTERFACE|ИНТЕРФЕЙС');$('uiReset').textContent=L('Reset|Сброс');$('uiExp').textContent=L('Export|Экспорт');$('uiImp').textContent=L('Import|Импорт');$('uib').textContent=L('UI|UI');
 const ps=$('uiPre');ps.innerHTML='';[['','Preset…|Пресет…'],['cyber','Cyber'],['stealth','Stealth'],['amber','Amber'],['light','Light']].forEach(([v,n])=>ps.appendChild(Object.assign(document.createElement('option'),{value:v,textContent:v?n:L(n)})))}
const panel=document.createElement('aside');panel.id='ui';
panel.innerHTML='<div class="hd"><b id="uiTitle"></b><button id="uiX">✕</button></div><div class="bt"><select id="uiPre"></select><button id="uiReset"></button><button id="uiExp"></button><button id="uiImp"></button></div><textarea id="uiJson" hidden></textarea><div id="uiBody"></div>';
B.appendChild(panel);
const btn=Object.assign(document.createElement('button'),{id:'uib',title:'F2'});B.appendChild(btn);
const open=on=>{if(on)build();panel.classList.toggle('open',on)};
btn.onclick=()=>open(!panel.classList.contains('open'));$('uiX').onclick=()=>open(false);
$('uiPre').onchange=e=>{const p=PRESETS[e.target.value];if(p){Object.assign(U,p);save();apply();build()}};
$('uiReset').onclick=()=>{U={...DEF};save();apply();build()};
$('uiExp').onclick=()=>{const j=$('uiJson');j.hidden=false;j.value=JSON.stringify(U,null,1);j.select()};
$('uiImp').onclick=()=>{const j=$('uiJson');if(j.hidden){j.hidden=false;j.value='';j.placeholder='{ … }';return}try{Object.assign(U,JSON.parse(j.value));save();apply();build()}catch(e){j.value='JSON error: '+e.message}};
addEventListener('keydown',e=>{if(e.key==='F2'){e.preventDefault();btn.click()}
 else if(e.key==='Escape'&&panel.classList.contains('open')){e.stopImmediatePropagation();open(false)}},true);
build();apply();
})();

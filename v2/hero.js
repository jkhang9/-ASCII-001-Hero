(()=>{'use strict';
const hero=document.querySelector('.hero'),canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d'),nameEl=document.querySelector('h1'),meta=document.querySelector('.metadata');
const motion=matchMedia('(prefers-reduced-motion: reduce)');let reduced=motion.matches;
const glyphs={J:['00111','00010','00010','00010','10010','10010','01100'],A:['01110','10001','10001','11111','10001','10001','10001'],N:['10001','11001','11001','10101','10011','10011','10001'],I:['11111','00100','00100','00100','00100','00100','11111'],C:['01111','10000','10000','10000','10000','10000','01111'],E:['11111','10000','10000','11110','10000','10000','11111'],K:['10001','10010','10100','11000','10100','10010','10001'],H:['10001','10001','10001','11111','10001','10001','10001'],G:['01110','10001','10000','10111','10001','10001','01110']};
const variants={A:['Δ','4','@'],N:['И','#'],I:['!','|'],E:['€','3'],J:['J',']'],C:['C','('],K:['K','<'],H:['H','#'],G:['G','6']};
const palette=['#00a8c6','#168de2','#6262e5','#995de2','#cd58c7','#ed479a','#f16872','#ed8737','#c6aa16','#89b72e','#35b879','#19b3a3'];const chars=['.',':','+','*','#','%','@'];
// Mid-density paint shows the direction the bristles travelled.
const strokes=['-','\\','|','/'];
function glyph(c){
 const level=Math.min(6,Math.floor(c.e*8));
 if(level===2||level===3){const a=(Math.atan2(c.uy,c.ux)+Math.PI)%Math.PI;return strokes[Math.round(a/(Math.PI/4))%4]}
 return chars[level];
}
let w=0,h=0,cells=[],eggs=[],bursts=[],raf=0,last=0,until=0,nameBox,metaBox,profileBox,letters=[],chosen=-1,person=-1;
const artPool=[["><(((\u00b0>"], [" /\\_/\\", "( o.o )", " > ^ <"], [" ( (", "  ) )", " c[_]"], ["(\\ /)", "( . .)", "c(\")(\")"], ["  .-.", " (o o)", " | O |", " /___\\"], ["  _", " (_)", "\\ | /", " \\|/", "  |"], [" .--.", "/ .. \\", "|____|", "  ||"], ["  /\\", " /  \\", " | o|", " /__\\", "  vv"], ["  /\\", " /__\\", "| [] |", "|_ _|"], [" /\\_/\\", "( -.- )", " (___)"], ["  _", " ( )", "--|--", " / \\"], ["  .", " /|\\", "/_|_\\", " ~~~"], ["oh hi"], ["psst..."], ["peek!"]];
// A fresh layout seed per landing; artwork and placements stay fixed during the visit.
const landingSeed=Math.random()*1000000;
const pointer={x:-999,y:-999,active:false,moved:0};let down=null;
// The brush tip trails the pointer slightly, so quick flicks bend into curves instead of corners.
const brush={x:0,y:0,down:false,w:0,len:0,hue:0,id:0};let cols=0,rows=0,space=18;
const hash=n=>{const a=Math.sin(n*127.1+311.7)*43758.5453;return a-Math.floor(a)};
function wake(){until=performance.now()+1000;if(!raf)raf=requestAnimationFrame(frame)}
function resize(){w=hero.clientWidth;h=hero.clientHeight;const d=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(w*d);canvas.height=Math.round(h*d);ctx.setTransform(d,0,0,d,0,0);nameBox=nameEl.getBoundingClientRect();metaBox=meta.getBoundingClientRect();profileBox=document.querySelector('.identity').getBoundingClientRect();cells=[];space=w<600?16:18;cols=Math.ceil((w-space/2)/space);rows=Math.ceil((h-space/2)/space);for(let y=space/2;y<h;y+=space)for(let x=space/2;x<w;x+=space){const id=cells.length;cells.push({x,y,e:0,dx:0,dy:0,ux:1,uy:0,hue:0,seed:hash(id),decay:1500+hash(id+17)*1900})}brush.down=false;const step=nameBox.width/64.54;letters=[...'JANICE KHANG'].map((ch,i)=>({ch,x:nameBox.x+step*.27+i*step*6,y:nameBox.y+(nameBox.height-step*7)/2,s:step,e:0,entered:0}));eggs=layoutDiscoveries();for(const egg of eggs)placeDiscovery(egg);
chosen=-1;wake()}

// The padded identity box is the single source for equal clear space on every side.
function isText(x,y){return x>profileBox.left&&x<profileBox.right&&y>profileBox.top&&y<profileBox.bottom}
function layoutDiscoveries(){
 const space=w<600?16:18,placed=[];
 const ordered=artPool.map((lines,art)=>({art,cols:Math.max(...lines.map(l=>[...l].length)),rows:lines.length})).sort((a,b)=>b.cols*b.rows-a.cols*a.rows);
 for(const item of ordered){
  const columns=Math.floor(w/space),rows=Math.floor((h-72)/space);
  let found=null;
  for(let attempt=0;attempt<900;attempt++){
   const col=Math.floor(hash(landingSeed+item.art*107+attempt*13)*Math.max(1,columns-item.cols));
   const row=1+Math.floor(hash(landingSeed+item.art*239+attempt*31)*Math.max(1,rows-item.rows-1));
   const left=col*space,top=row*space,right=left+item.cols*space,bottom=top+item.rows*space;
   if(right>w||bottom>h-72)continue;
   if(right>profileBox.left-8&&left<profileBox.right+8&&bottom>profileBox.top-8&&top<profileBox.bottom+8)continue;
   const gap=attempt<600?space:space*.4;
   if(placed.some(e=>right+gap>e.left&&left-gap<e.right&&bottom+gap>e.top&&top-gap<e.bottom))continue;
   found={...item,left,top,right,bottom,x:(left+right)/2,y:(top+bottom)/2,alpha:0,index:placed.length};break;
  }
  if(found)placed.push(found);
 }
 return placed;
}
function placeDiscovery(egg){
 const space=w<600?16:18;
 for(const c of cells)if(c.egg===egg.index){delete c.egg;delete c.discovery}
 const lines=artPool[egg.art],cols=Math.max(...lines.map(line=>[...line].length));
 const startX=egg.left+space/2,startY=egg.top+space/2;
 const byPosition=new Map(cells.map(c=>[`${c.x},${c.y}`,c]));
 lines.forEach((line,row)=>[...line].forEach((character,col)=>{
  const c=byPosition.get(`${startX+col*space},${startY+row*space}`);
  if(c&&!isText(c.x,c.y)){c.egg=egg.index;c.discovery=character}
 }));
}
const colors=palette.map(hex=>hex.slice(1).match(/../g).map(v=>parseInt(v,16)));
// Irregular color pools blend with proximity, rather than fixed stripes.
function ink(x,y,energy,hue){
 if(energy<=.001)return 'rgb(211,210,203)';
 const seed=hash(x*3.7+y*.91);
 const phase=hue===undefined?(Math.sin(x*.017+y*.009)*2.1+Math.cos(y*.023-x*.007)*1.6+energy*3.2+seed*.65+12)%12:((hue+seed*.5+energy*.8)%12+12)%12;
 const first=Math.floor(phase),mix=phase-first;
 const rgb=colors[first].map((v,i)=>v+(colors[(first+1)%12][i]-v)*mix);
 const amount=Math.min(1,Math.pow(energy,.72)*(1.12+seed*.24)),base=[211,210,203];
 return `rgb(${rgb.map((v,i)=>Math.round(base[i]+(v-base[i])*amount)).join(',')})`;
}
function tilt(age,seed,strength){
 if(reduced||age<0||age>650)return 0;
 return Math.sin(age/85)*Math.exp(-age/190)*(seed>.5?1:-1)*.42*strength;
}
// A click claims existing cells. There is no second particle rendering pass.
function clickAt(x,y,now){
 for(let i=bursts.length-1;i>=0;i--){const b=bursts[i];if(now-b.t<900&&Math.hypot(x-b.x,y-b.y)<49)return b}
 return null;
}
function clickGlyph(b,x,y,now,center=false){
 const age=now-b.t,distance=Math.hypot(x-b.x,y-b.y);
 if(center)return age<75?'*':age<250?'✦':age<520?(Math.floor((age-250)/85)%2?'✦':'✧'):age<650?'*':age<760?'+':age<830?':':'.';
 const arrival=65+distance*2.8;
 if(age<arrival)return '.';
 const ring=distance<22?0:distance<37?1:2;
 if(age<520){
  if(ring===2)return age-arrival<125?'˚':'.';
  if(ring===1)return age-arrival<145?'+':':';
  return age-arrival<155?'*':'+';
 }
 const decay=['*','+',':','.','·'];
 return decay[Math.min(4,ring+Math.floor((age-520)/76))];
}
function poke(x,y){
 if(isText(x,y)&&!(x>=nameBox.x&&x<=nameBox.right&&y>=nameBox.y&&y<=nameBox.bottom))return;
 let nearest=null,dist=Infinity;
 for(const c of cells){if(isText(c.x,c.y))continue;const d=Math.hypot(x-c.x,y-c.y);if(d<dist){nearest=c;dist=d}}
 for(const l of letters){if(l.ch===' ')continue;const px=l.x+l.s*2,py=l.y+l.s*3.4,d=Math.hypot(x-px,y-py);if(d<dist){nearest={x:px,y:py};dist=d}}
 if(nearest){bursts.push({x:nearest.x,y:nearest.y,t:performance.now()});wake()}
}
// One dab of the brush: a soft flat core, streaked by bristle lanes that run along the stroke.
function dab(x,y,r,ux,uy,now){
 const c0=Math.max(0,Math.floor((x-r)/space)),c1=Math.min(cols-1,Math.floor((x+r)/space));
 const r0=Math.max(0,Math.floor((y-r)/space)),r1=Math.min(rows-1,Math.floor((y+r)/space));
 // Ink runs dry over a long stroke, so the bristle gaps open up towards its tail.
 const load=Math.max(.5,1-brush.len/2600);
 for(let row=r0;row<=r1;row++)for(let col=c0;col<=c1;col++){
  const c=cells[row*cols+col];if(!c||isText(c.x,c.y))continue;
  const dx=c.x-x,dy=c.y-y,edge=r*(.8+c.seed*.32),d=Math.hypot(dx,dy);if(d>edge)continue;
  const lane=Math.round((dx*-uy+dy*ux)/6),bristle=hash(lane*12.9898+brush.id*78.233);
  if(bristle>load+.35)continue;
  const v=(1-Math.pow(d/edge,3))*(.68+.32*bristle)*load;
  if(v<=c.e)continue;
  if(c.e<.065&&v>=.065)c.entered=now;
  c.e+=(v-c.e)*.7;c.ux=ux;c.uy=uy;c.hue=brush.hue+brush.len/120;
 }
}
function stroke(dt,now){
 if(!pointer.active){brush.down=false;return false}
 if(!brush.down){Object.assign(brush,{x:pointer.x,y:pointer.y,down:true,w:0,len:0,hue:Math.random()*12,id:brush.id+1})}
 const px=brush.x,py=brush.y,follow=Math.min(1,dt/38);
 brush.x+=(pointer.x-brush.x)*follow;brush.y+=(pointer.y-brush.y)*follow;
 const sx=brush.x-px,sy=brush.y-py,seg=Math.hypot(sx,sy);
 // Resting lifts the brush; the next movement tapers in as a new stroke.
 if(seg<.25){if(now-pointer.moved>140)brush.down=false;return Math.hypot(pointer.x-brush.x,pointer.y-brush.y)>.5}
 // Slow strokes press wide, fast strokes thin out. Holding the button presses harder.
 const max=(w<600?30:42)*(down?1.3:1),speed=seg/Math.max(dt,1);
 const target=max*Math.max(.45,Math.min(1,1.1-speed*.16));
 const w0=brush.w*Math.min(1,brush.len/70);
 brush.w+=(target-brush.w)*Math.min(1,dt/110);
 const ux=sx/seg,uy=sy/seg,steps=Math.max(1,Math.ceil(seg/4));
 for(let i=1;i<=steps;i++){
  const t=i/steps;brush.len+=seg/steps;
  const r=w0+(brush.w*Math.min(1,brush.len/70)-w0)*t;
  if(r>space*.35)dab(px+sx*t,py+sy*t,r,ux,uy,now);
 }
 return true;
}
function frame(now){raf=0;const dt=Math.min(now-(last||now-16),40);last=now;ctx.clearRect(0,0,w,h);ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='11px "Commit Mono",ui-monospace,monospace';let unsettled=stroke(dt,now);
bursts=bursts.filter(b=>now-b.t<900);
let hit=pointer.active&&!clickAt(pointer.x,pointer.y,now)?eggs.findIndex(e=>Math.hypot(pointer.x-e.x,pointer.y-e.y)<32):-1;
if(chosen<0&&hit>=0)chosen=hit;
for(const e of eggs){e.poked=bursts.some(b=>Math.hypot(e.x-b.x,e.y-b.y)<75);if(e.poked)e.alpha=0}
for(let i=0;i<eggs.length;i++){let e=eggs[i];const target=chosen===i&&hit===i&&!e.poked?1:0;e.alpha+=(target-e.alpha)*Math.min(1,dt/(reduced?65:150));if(target===0&&e.alpha<.006){e.alpha=0;if(chosen===i)chosen=-1}if(Math.abs(e.alpha-target)>.006)unsettled=true}
bursts=bursts.filter(b=>now-b.t<900);
if(pointer.active){let best=-1,dist=27;for(let i=0;i<cells.length;i++){const c=cells[i];if(c.seed>.0017||isText(c.x,c.y))continue;let d=Math.hypot(c.x-pointer.x,c.y-pointer.y);if(d<dist){dist=d;best=i}}person=chosen<0?best:-1}else person=-1;
for(let i=0;i<cells.length;i++){
 const c=cells[i];if(isText(c.x,c.y))continue;
 // Paint dries unevenly: thin edges go first, so the stroke's tail narrows and frays before it fades.
 if(c.e>0){c.e=Math.max(0,c.e-dt/c.decay*(1.3-c.e));unsettled=true}
 let char=c.e>.025?glyph(c):null;
 let color=ink(c.x,c.y,c.e,c.hue),alpha=1;
 if(i===person&&c.e>.4)char=c.seed<.0011?'?':'*';
 const click=clickAt(c.x,c.y,now);
 if(click){
  char=clickGlyph(click,c.x,c.y,now,c.x===click.x&&c.y===click.y);
  color=ink(c.x,c.y,Math.min(.85,(900-(now-click.t))/380)*(1-Math.hypot(c.x-click.x,c.y-click.y)/78));
 }else{
  const egg=c.egg===undefined?null:eggs[c.egg];
  if(egg&&egg.alpha>.006){
   if(c.discovery===' '){char=null;color=ink(c.x,c.y,0)}
   else{
    // A glyph decodes and dissolves within its own dot's position.
    const resolved=egg.alpha>.72+c.seed*.14;
    char=resolved?c.discovery:['.',':','+','*'][Math.min(3,Math.floor(egg.alpha*4))];
    color=ink(c.x,c.y,egg.alpha);
   }
  }
 }
 ctx.globalAlpha=alpha;ctx.fillStyle=color;
 // Rotate around each cell's anchor. Clicks and discoveries retain their slots.
 const discovery=c.egg!==undefined&&eggs[c.egg].alpha>.006;
 const age=now-(c.entered??-10000);
 const angle=click||discovery?0:tilt(age,c.seed,Math.min(1,c.e*3));
 const force=reduced||click||discovery?0:Math.sin(c.e*Math.PI)*3;
 const tx=c.ux*force,ty=c.uy*force;
 c.dx+=(tx-c.dx)*Math.min(1,dt/55);c.dy+=(ty-c.dy)*Math.min(1,dt/55);
 if(Math.abs(c.dx-tx)+Math.abs(c.dy-ty)>.02||(!reduced&&age<650&&c.e>.025))unsettled=true;
 if(char){
  ctx.save();ctx.translate(c.x+(click||discovery?0:c.dx),c.y+(click||discovery?0:c.dy));ctx.rotate(angle);
  if(click){
   const center=c.x===click.x&&c.y===click.y,age=now-click.t,distance=Math.hypot(c.x-click.x,c.y-click.y);
   const baseSize=center?18:distance<22?12:distance<37?10:9;
   const settling=Math.max(0,Math.min(1,(age-520)/380));
   ctx.font=`400 ${baseSize-(baseSize-9)*settling}px "Commit Mono",ui-monospace,monospace`;
   if(!reduced&&center){const scale=age<75?.9:1+Math.sin(Math.min(1,(age-75)/180)*Math.PI)*.08;ctx.scale(scale,scale)}
  }
  ctx.fillText(char,0,0);ctx.restore();
 }else{ctx.beginPath();ctx.arc(c.x+c.dx,c.y+c.dy,.72,0,Math.PI*2);ctx.fill()}
 ctx.globalAlpha=1;
}
for(let l of letters){if(l.ch===' ')continue;const d=pointer.active?Math.hypot(pointer.x-(l.x+l.s*2.5),pointer.y-(l.y+l.s*3.5)):999;const target=Math.max(0,1-d/43);if(target>.1&&l.e<=.1)l.entered=now;l.e=target>l.e?target:Math.max(target,l.e-dt/450);if(l.e>target+.003)unsettled=true;const click=clickAt(l.x+l.s*2,l.y+l.s*3.4,now);const scramble=!click&&!reduced&&l.e>.28&&now-l.entered<360;ctx.save();const pivotX=l.x+l.s*2,pivotY=l.y+l.s*3.4;ctx.translate(pivotX,pivotY);ctx.rotate(click?0:tilt(now-l.entered,hash(l.x),Math.min(1,l.e*2))*.6);ctx.translate(-pivotX,-pivotY);ctx.fillStyle=`rgb(${Math.round(155-l.e*90)},${Math.round(156-l.e*90)},${Math.round(150-l.e*86)})`;if(click){ctx.fillStyle=ink(l.x,l.y,.8);ctx.font='18px "Commit Mono",ui-monospace,monospace';ctx.fillText(clickGlyph(click,l.x+l.s*2,l.y+l.s*3.4,now,Math.hypot(click.x-(l.x+l.s*2),click.y-(l.y+l.s*3.4))<1),l.x+l.s*2,l.y+l.s*3.4);ctx.font='11px "Commit Mono",ui-monospace,monospace'}else if(scramble){ctx.fillStyle=ink(l.x,l.y,1);ctx.font=`${l.s*8}px "Commit Mono",ui-monospace,monospace`;const v=variants[l.ch]||[l.ch];ctx.fillText(v[Math.floor((now-l.entered)/65)%v.length],l.x+l.s*2,l.y+l.s*3.4);ctx.font='11px "Commit Mono",ui-monospace,monospace';unsettled=true}else{const bitmap=glyphs[l.ch];for(let row=0;row<7;row++)for(let col=0;col<5;col++)if(bitmap[row][col]==='1'){ctx.beginPath();ctx.arc(l.x+col*l.s,l.y+row*l.s,l.s*.27,0,Math.PI*2);ctx.fill()}}ctx.restore()}
if(bursts.length||unsettled||now<until)raf=requestAnimationFrame(frame);else last=0;
}
function move(e){pointer.x=e.clientX;pointer.y=e.clientY;pointer.active=true;pointer.moved=performance.now();if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>9)down.drag=true;wake()}
hero.addEventListener('pointermove',move);hero.addEventListener('pointerdown',e=>{if(e.button!==0)return;move(e);down={x:e.clientX,y:e.clientY,drag:false};hero.setPointerCapture(e.pointerId)});
hero.addEventListener('pointerup',e=>{if(down&&!down.drag){poke(e.clientX,e.clientY)}down=null;if(e.pointerType!=='mouse'){pointer.active=false;wake()}});
function leave(){pointer.active=false;down=null;wake()}hero.addEventListener('pointerleave',e=>{if(!down)leave()});hero.addEventListener('pointercancel',leave);window.addEventListener('blur',leave);
hero.addEventListener('keydown',e=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();poke(w/2,h*.6)}});
motion.addEventListener('change',e=>{reduced=e.matches;wake()});window.addEventListener('resize',resize);document.fonts.ready.then(resize);document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;last=0;pointer.active=false}else wake()});resize();
})();

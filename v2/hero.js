(()=>{'use strict';
const hero=document.querySelector('.hero'),canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d');
const motion=matchMedia('(prefers-reduced-motion: reduce)');let reduced=motion.matches;
const palette=['#00a8c6','#168de2','#6262e5','#995de2','#cd58c7','#ed479a','#f16872','#ed8737','#c6aa16','#89b72e','#35b879','#19b3a3'];const chars=['.',':','+','*','#','%','@'];
let w=0,h=0,cells=[],bursts=[],raf=0,last=0,until=0;
const FONT='"Commit Mono",ui-monospace,monospace';
const pointer={x:-999,y:-999,active:false,moved:0};let down=null;
// The brush tip trails the pointer slightly, so quick flicks bend into curves instead of corners.
const brush={x:0,y:0,down:false,w:0,v:0,len:0,id:0};let cols=0,rows=0,space=18;
const hash=n=>{const a=Math.sin(n*127.1+311.7)*43758.5453;return a-Math.floor(a)};
function wake(){until=performance.now()+1000;if(!raf)raf=requestAnimationFrame(frame)}
function resize(){w=hero.clientWidth;h=hero.clientHeight;const d=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(w*d);canvas.height=Math.round(h*d);ctx.setTransform(d,0,0,d,0,0);cells=[];space=w<600?16:18;cols=Math.ceil((w-space/2)/space);rows=Math.ceil((h-space/2)/space);for(let y=space/2;y<h;y+=space)for(let x=space/2;x<w;x+=space){const id=cells.length;cells.push({x,y,e:0,dx:0,dy:0,ux:1,uy:0,wet:0,rim:1,seed:hash(id),decay:900+hash(id+17)*1100})}brush.down=false;wake()}

const colors=palette.map(hex=>hex.slice(1).match(/../g).map(v=>parseInt(v,16)));
// Irregular color pools blend with proximity, rather than fixed stripes.
function ink(x,y,energy){
 if(energy<=.001)return 'rgb(211,210,203)';
 const seed=hash(x*3.7+y*.91);
 const phase=(Math.sin(x*.017+y*.009)*2.1+Math.cos(y*.023-x*.007)*1.6+energy*3.2+seed*.65+12)%12;
 const first=Math.floor(phase),mix=phase-first;
 const rgb=colors[first].map((v,i)=>v+(colors[(first+1)%12][i]-v)*mix);
 const amount=Math.min(1,Math.pow(energy,.72)*(1.12+seed*.24)),base=[211,210,203];
 return `rgb(${rgb.map((v,i)=>Math.round(base[i]+(v-base[i])*amount)).join(',')})`;
}
// Brush paint is shaded by where the cell sits in the stroke: a slightly deeper core,
// and an outer rim lifted towards the paper as a pale tint of the same color.
const paper=[248,247,243];
function paint(c){
 const seed=hash(c.x*3.7+c.y*.91);
 const phase=(Math.sin(c.x*.017+c.y*.009)*2.1+Math.cos(c.y*.023-c.x*.007)*1.6+c.e*3.2+seed*.65+12)%12;
 const first=Math.floor(phase),mix=phase-first;
 const deep=1-Math.pow(1-c.rim,1.5)*.22,lift=Math.min(.84,Math.pow(c.rim,1.25)*.8+(1-Math.min(1,c.e*1.6))*.3);
 return `rgb(${colors[first].map((v,i)=>{const hue=(v+(colors[(first+1)%12][i]-v)*mix)*deep;return Math.round(hue+(paper[i]-hue)*lift)}).join(',')})`;
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
 if(center)return age<75?'*':age<250?'×':age<520?(Math.floor((age-250)/85)%2?'×':'+'):age<650?'*':age<760?'+':age<830?':':'.';
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
 let nearest=null,dist=Infinity;
 for(const c of cells){const d=Math.hypot(x-c.x,y-c.y);if(d<dist){nearest=c;dist=d}}
 if(nearest){bursts.push({x:nearest.x,y:nearest.y,t:performance.now()});wake()}
}
// One dab of the brush: a soft core with faint bristle streaks. It only sets how wet each
// cell should be; the cell eases towards that level itself, so the paint flows in.
function dab(x,y,r,ux,uy){
 const c0=Math.max(0,Math.floor((x-r)/space)),c1=Math.min(cols-1,Math.floor((x+r)/space));
 const r0=Math.max(0,Math.floor((y-r)/space)),r1=Math.min(rows-1,Math.floor((y+r)/space));
 for(let row=r0;row<=r1;row++)for(let col=c0;col<=c1;col++){
  const c=cells[row*cols+col];if(!c)continue;
  const dx=c.x-x,dy=c.y-y,edge=r*(.82+c.seed*.3),d=Math.hypot(dx,dy);if(d>edge)continue;
  const bristle=hash(Math.round((dx*-uy+dy*ux)/7)*12.9898+brush.id*78.233);
  const v=(1-Math.pow(d/edge,2.2))*(.8+.2*bristle);
  if(v<=c.wet)continue;
  c.wet=v;c.rim=d/edge;
  // Paint parts around the stroke and drifts the way the brush travelled.
  const nx=d?dx/d:0,ny=d?dy/d:0,px=nx*.8+ux*.6,py=ny*.8+uy*.6,m=Math.hypot(px,py)||1;
  c.ux=px/m;c.uy=py/m;
 }
}
function stroke(dt,now){
 if(!pointer.active){brush.down=false;return false}
 if(!brush.down){Object.assign(brush,{x:pointer.x,y:pointer.y,down:true,w:0,v:0,len:0,id:brush.id+1})}
 const px=brush.x,py=brush.y,follow=Math.min(1,dt/60);
 brush.x+=(pointer.x-brush.x)*follow;brush.y+=(pointer.y-brush.y)*follow;
 const sx=brush.x-px,sy=brush.y-py,seg=Math.hypot(sx,sy);
 // Thickness follows speed: a slow drag is a fine line, a fast sweep swells wide.
 brush.v+=(seg/Math.max(dt,1)-brush.v)*Math.min(1,dt/70);
 const min=w<600?10:13,max=w<600?44:64,k=Math.min(1,brush.v/2.4);
 const target=min+(max-min)*k*k*(3-2*k);
 const w0=brush.w;
 brush.w+=(target-brush.w)*Math.min(1,dt/90);
 // Resting lifts the brush; the next movement starts a fresh stroke.
 if(seg<.25){if(now-pointer.moved>140)brush.down=false;return brush.w>min+.5||Math.hypot(pointer.x-brush.x,pointer.y-brush.y)>.5}
 const ux=sx/seg,uy=sy/seg,steps=Math.max(1,Math.ceil(seg/4));
 for(let i=1;i<=steps;i++){const t=i/steps;dab(px+sx*t,py+sy*t,w0+(brush.w-w0)*t,ux,uy)}
 brush.len+=seg;
 return true;
}
function frame(now){raf=0;const dt=Math.min(now-(last||now-16),40);last=now;ctx.clearRect(0,0,w,h);ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='11px "Commit Mono",ui-monospace,monospace';let unsettled=stroke(dt,now);
bursts=bursts.filter(b=>now-b.t<900);
for(let i=0;i<cells.length;i++){
 const c=cells[i];
 // Wet paint flows in quickly, then dries unevenly so the tail feathers out.
 if(c.wet>0||c.e>0){
  if(c.wet>c.e){if(c.e<.065&&c.wet>=.065)c.entered=now;c.e+=(c.wet-c.e)*Math.min(1,dt/45)}else c.e=c.wet;
  c.wet=Math.max(0,c.wet-dt/c.decay);unsettled=true;
 }
 let char=c.e>.025?chars[Math.min(6,Math.floor(c.e*8))]:null;
 let color=c.e>.001?paint(c):ink(c.x,c.y,0),alpha=1;
 const click=clickAt(c.x,c.y,now);
 if(click){
  char=clickGlyph(click,c.x,c.y,now,c.x===click.x&&c.y===click.y);
  color=ink(c.x,c.y,Math.min(.85,(900-(now-click.t))/380)*(1-Math.hypot(c.x-click.x,c.y-click.y)/78));
 }
 ctx.globalAlpha=alpha;ctx.fillStyle=color;
 // Rotate around each cell's anchor. Clicks retain their slots.
 const age=now-(c.entered??-10000);
 const angle=click?0:tilt(age,c.seed,Math.min(1,c.e*3));
 const force=reduced||click?0:Math.sin(c.e*Math.PI)*3.2;
 const tx=c.ux*force,ty=c.uy*force;
 c.dx+=(tx-c.dx)*Math.min(1,dt/55);c.dy+=(ty-c.dy)*Math.min(1,dt/55);
 if(Math.abs(c.dx-tx)+Math.abs(c.dy-ty)>.02||(!reduced&&age<650&&c.e>.025))unsettled=true;
 if(char){
  ctx.save();ctx.translate(c.x+(click?0:c.dx),c.y+(click?0:c.dy));ctx.rotate(angle);
  if(click){
   const center=c.x===click.x&&c.y===click.y,age=now-click.t,distance=Math.hypot(c.x-click.x,c.y-click.y);
   const baseSize=center?13:11;
   const settling=Math.max(0,Math.min(1,(age-520)/380));
   ctx.font=`400 ${baseSize-(baseSize-11)*settling}px ${FONT}`;
   if(!reduced&&center){const scale=age<75?.9:1+Math.sin(Math.min(1,(age-75)/180)*Math.PI)*.05;ctx.scale(scale,scale)}
  }
  ctx.fillText(char,0,0);ctx.restore();
 }else{ctx.beginPath();ctx.arc(c.x+c.dx,c.y+c.dy,.72,0,Math.PI*2);ctx.fill()}
 ctx.globalAlpha=1;
}
if(bursts.length||unsettled||now<until)raf=requestAnimationFrame(frame);else last=0;
}
function move(e){pointer.x=e.clientX;pointer.y=e.clientY;pointer.active=true;pointer.moved=performance.now();if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>9)down.drag=true;wake()}
hero.addEventListener('pointermove',move);hero.addEventListener('pointerdown',e=>{if(e.button!==0)return;move(e);down={x:e.clientX,y:e.clientY,drag:false};hero.setPointerCapture(e.pointerId)});
hero.addEventListener('pointerup',e=>{if(down&&!down.drag){poke(e.clientX,e.clientY)}down=null;if(e.pointerType!=='mouse'){pointer.active=false;wake()}});
function leave(){pointer.active=false;down=null;wake()}hero.addEventListener('pointerleave',e=>{if(!down)leave()});hero.addEventListener('pointercancel',leave);window.addEventListener('blur',leave);
hero.addEventListener('keydown',e=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();poke(w/2,h*.6)}});
motion.addEventListener('change',e=>{reduced=e.matches;wake()});window.addEventListener('resize',resize);document.fonts.load(`400 11px ${FONT}`).then(wake,()=>{});document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;last=0;pointer.active=false}else wake()});resize();
})();

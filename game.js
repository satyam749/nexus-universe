(() => {
  "use strict";
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const $ = id => document.getElementById(id);
  const startOverlay = $("startOverlay"), endOverlay = $("endOverlay"), pauseShade = $("pauseShade"), hud = $("hud");
  const keys = new Set();
  const touch = {left:false,right:false,up:false,down:false};
  let width=0,height=0,dpr=1,raf=0,last=0,elapsed=0,score=0,lives=3,playing=false,paused=false,ended=false;
  let player,orbs=[],meteors=[],particles=[],stars=[],spawnOrb=0,spawnMeteor=0,best=Number(localStorage.getItem("nexusBest")||0),soundOn=false,audio=null;
  $("bestScore").textContent=String(best).padStart(4,"0");
  $("bestInline").textContent="सर्वश्रेष्ठ: "+best;
  const rand=(a,b)=>Math.random()*(b-a)+a;
  function resize(){
    const rect=canvas.getBoundingClientRect(); dpr=Math.min(window.devicePixelRatio||1,2);
    width=Math.max(1,rect.width);height=Math.max(1,rect.height);
    canvas.width=Math.floor(width*dpr);canvas.height=Math.floor(height*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    stars=Array.from({length:Math.floor(width*height/5000)},()=>({x:Math.random()*width,y:Math.random()*height,r:rand(.4,1.6),a:rand(.15,.8),p:rand(0,6.28)}));
    if(!player) resetPlayer(); else {player.x=Math.min(width-player.r,Math.max(player.r,player.x));player.y=Math.min(height-player.r,Math.max(player.r,player.y));}
    draw();
  }
  function resetPlayer(){player={x:width/2,y:height*.72,r:12,speed:235,inv:0};}
  function resetGame(){
    score=0;lives=3;elapsed=0;orbs=[];meteors=[];particles=[];spawnOrb=.2;spawnMeteor=1.2;paused=false;ended=false;playing=true;last=performance.now();resetPlayer();
    startOverlay.classList.add("hidden");endOverlay.classList.add("hidden");pauseShade.classList.add("hidden");hud.classList.remove("hidden");
    $("statusText").textContent="मिशन चल रहा है";updateHud();cancelAnimationFrame(raf);raf=requestAnimationFrame(loop);
  }
  function updateHud(){$("scoreValue").textContent=String(score).padStart(4,"0");$("livesValue").textContent="♥ ".repeat(Math.max(0,lives)).trim()||"—";}
  function playTone(freq=520,duration=.07,type="sine"){
    if(!soundOn)return;try{audio=audio||new (window.AudioContext||window.webkitAudioContext)();const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(.06,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+duration);}catch(_){}
  }
  function burst(x,y,color,count=12){for(let i=0;i<count;i++)particles.push({x,y,vx:rand(-100,100),vy:rand(-100,100),life:rand(.25,.65),max:.65,r:rand(1,3),color});}
  function spawnOrbNow(){orbs.push({x:rand(25,width-25),y:-15,r:rand(7,10),speed:rand(60,105)+elapsed*1.3,phase:rand(0,6.28)});}
  function spawnMeteorNow(){const r=rand(10,17);meteors.push({x:rand(r,width-r),y:-r,r,vx:rand(-35,35),speed:rand(100,155)+elapsed*2.1,rot:rand(0,6.28),spin:rand(-2,2)});}
  function move(dt){
    elapsed+=dt;player.inv=Math.max(0,player.inv-dt);
    let dx=0,dy=0;if(keys.has("ArrowLeft")||keys.has("a")||touch.left)dx--;if(keys.has("ArrowRight")||keys.has("d")||touch.right)dx++;if(keys.has("ArrowUp")||keys.has("w")||touch.up)dy--;if(keys.has("ArrowDown")||keys.has("s")||touch.down)dy++;
    if(dx&&dy){dx*=.707;dy*=.707;}player.x=Math.max(player.r,Math.min(width-player.r,player.x+dx*player.speed*dt));player.y=Math.max(player.r,Math.min(height-player.r,player.y+dy*player.speed*dt));
    spawnOrb-=dt;spawnMeteor-=dt;if(spawnOrb<=0){spawnOrbNow();spawnOrb=Math.max(.45,1.05-elapsed*.003);}if(spawnMeteor<=0){spawnMeteorNow();spawnMeteor=Math.max(.42,1.55-elapsed*.004);}
    for(let i=orbs.length-1;i>=0;i--){const o=orbs[i];o.y+=o.speed*dt;o.phase+=dt*4;if(Math.hypot(o.x-player.x,o.y-player.y)<o.r+player.r){score+=10;burst(o.x,o.y,"#69edff",10);orbs.splice(i,1);playTone(740,.08);updateHud();continue;}if(o.y>height+20)orbs.splice(i,1);}
    for(let i=meteors.length-1;i>=0;i--){const m=meteors[i];m.x+=m.vx*dt;m.y+=m.speed*dt;m.rot+=m.spin*dt;if(m.x<m.r||m.x>width-m.r)m.vx*=-1;if(Math.hypot(m.x-player.x,m.y-player.y)<m.r+player.r*.72&&player.inv<=0){lives--;player.inv=1.15;burst(player.x,player.y,"#ff647f",20);playTone(150,.18,"sawtooth");updateHud();meteors.splice(i,1);if(lives<=0){finish();return; }continue;}if(m.y>height+30)meteors.splice(i,1);}
    for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;if(p.life<=0)particles.splice(i,1);}
  }
  function background(){
    const g=ctx.createLinearGradient(0,0,width,height);g.addColorStop(0,"#080d20");g.addColorStop(.55,"#080b19");g.addColorStop(1,"#100d28");ctx.fillStyle=g;ctx.fillRect(0,0,width,height);
    const glow=ctx.createRadialGradient(width*.52,height*.48,5,width*.52,height*.48,Math.max(width,height)*.65);glow.addColorStop(0,"#263b7025");glow.addColorStop(1,"#05071300");ctx.fillStyle=glow;ctx.fillRect(0,0,width,height);
    ctx.save();for(const s of stars){ctx.globalAlpha=s.a*(.65+.35*Math.sin(elapsed*1.5+s.p));ctx.fillStyle="#bdeaff";ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill();}ctx.restore();
    ctx.save();ctx.strokeStyle="#778cff12";ctx.lineWidth=1;const gap=42,offset=(elapsed*10)%gap;for(let x=0;x<width;x+=gap){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,height);ctx.stroke();}for(let y=-gap;y<height;y+=gap){ctx.beginPath();ctx.moveTo(0,y+offset);ctx.lineTo(width,y+offset);ctx.stroke();}ctx.restore();
  }
  function drawPlayer(){
    if(!player)return;ctx.save();ctx.translate(player.x,player.y);ctx.rotate(-Math.PI/2);
    if(player.inv>0&&Math.floor(player.inv*12)%2===0){ctx.restore();return;}
    ctx.shadowBlur=22;ctx.shadowColor="#5cecff";ctx.fillStyle="#70edff";ctx.beginPath();ctx.moveTo(16,0);ctx.lineTo(-10,-10);ctx.lineTo(-5,0);ctx.lineTo(-10,10);ctx.closePath();ctx.fill();
    ctx.shadowBlur=8;ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(1,0,3,0,Math.PI*2);ctx.fill();
    ctx.shadowBlur=14;ctx.fillStyle="#a78bff";ctx.beginPath();ctx.moveTo(-7,-4);ctx.lineTo(-rand(12,24),0);ctx.lineTo(-7,4);ctx.closePath();ctx.fill();ctx.restore();
  }
  function draw(){
    background();
    for(const o of orbs){const glow=ctx.createRadialGradient(o.x,o.y,1,o.x,o.y,o.r*2.8);glow.addColorStop(0,"#d7ffff");glow.addColorStop(.25,"#68eaff");glow.addColorStop(1,"#43aaff00");ctx.fillStyle=glow;ctx.beginPath();ctx.arc(o.x,o.y,o.r*2.8,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#8df4ff";ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(o.x,o.y,o.r+Math.sin(o.phase)*1.5,0,Math.PI*2);ctx.stroke();ctx.fillStyle="#e9ffff";ctx.beginPath();ctx.arc(o.x,o.y,2.4,0,Math.PI*2);ctx.fill();}
    for(const m of meteors){ctx.save();ctx.translate(m.x,m.y);ctx.rotate(m.rot);ctx.shadowBlur=18;ctx.shadowColor="#ff456b";ctx.fillStyle="#fa5f7b";ctx.beginPath();for(let j=0;j<9;j++){const a=j*Math.PI*2/9,rr=m.r*(j%2?.78:1);j?ctx.lineTo(Math.cos(a)*rr,Math.sin(a)*rr):ctx.moveTo(Math.cos(a)*rr,Math.sin(a)*rr);}ctx.closePath();ctx.fill();ctx.shadowBlur=0;ctx.fillStyle="#ffb0bb";ctx.beginPath();ctx.arc(-m.r*.2,-m.r*.15,m.r*.23,0,Math.PI*2);ctx.fill();ctx.restore();}
    for(const p of particles){ctx.globalAlpha=Math.max(0,p.life/p.max);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;drawPlayer();
    if(!playing&&!ended){ctx.save();ctx.globalAlpha=.3;ctx.fillStyle="#5f7fff";ctx.font="11px Inter, sans-serif";ctx.fillText("N E X U S   /   S E C T O R  0 1",20,height-20);ctx.restore();}
  }
  function loop(now){if(!playing||paused)return;const dt=Math.min(.035,(now-last)/1000||0);last=now;move(dt);draw();if(playing)raf=requestAnimationFrame(loop);}
  function finish(){playing=false;ended=true;cancelAnimationFrame(raf);hud.classList.add("hidden");$("statusText").textContent="मिशन समाप्त";$("endTitle").textContent=score>=best&&score>0?"नया रिकॉर्ड!":"अच्छा खेला!";$("endMessage").textContent="तुम्हारा स्कोर "+score+" है। "+(score>=best?"तुमने अपना सर्वश्रेष्ठ प्रदर्शन किया।":"फिर कोशिश करो और रिकॉर्ड तोड़ो।");if(score>best){best=score;localStorage.setItem("nexusBest",String(best));$("bestScore").textContent=String(best).padStart(4,"0");$("bestInline").textContent="सर्वश्रेष्ठ: "+best;}endOverlay.classList.remove("hidden");draw();}
  function pause(){if(!playing)return;paused=!paused;if(paused){cancelAnimationFrame(raf);pauseShade.classList.remove("hidden");$("statusText").textContent="मिशन रुका है";}else{pauseShade.classList.add("hidden");$("statusText").textContent="मिशन चल रहा है";last=performance.now();raf=requestAnimationFrame(loop);}}
  window.addEventListener("keydown",e=>{const k=e.key.toLowerCase();if(["arrowleft","arrowright","arrowup","arrowdown"," "].includes(k))e.preventDefault();keys.add(k);if(k==="escape"||k==="p")pause();if(k===" "&&!playing&&!ended)resetGame();});
  window.addEventListener("keyup",e=>keys.delete(e.key.toLowerCase()));window.addEventListener("blur",()=>{keys.clear();if(playing&&!paused)pause();});
  $("startBtn").addEventListener("click",resetGame);$("restartBtn").addEventListener("click",resetGame);$("pauseBtn").addEventListener("click",pause);$("resumeBtn").addEventListener("click",pause);
  document.querySelectorAll("[data-dir]").forEach(btn=>{const dir=btn.dataset.dir;const down=e=>{e.preventDefault();touch[dir]=true;};const up=e=>{e.preventDefault();touch[dir]=false;};btn.addEventListener("pointerdown",down);btn.addEventListener("pointerup",up);btn.addEventListener("pointercancel",up);btn.addEventListener("pointerleave",up);});
  $("soundBtn").addEventListener("click",()=>{soundOn=!soundOn;$("soundBtn").innerHTML=(soundOn?"♫":"♩")+" <span>"+(soundOn?"ध्वनि चालू":"ध्वनि बंद")+"</span>";playTone(600,.06);});
  window.addEventListener("resize",resize);resize();
})();
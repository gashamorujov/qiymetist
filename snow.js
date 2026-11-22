/* ❄ Realistik qar mühərriki — IST Trust Zone
   Üç rejim (window.IstSnow.setMode):
     'winter' – yer qar örtüyü (#ff-canvas varsa) + yağan qar + maus/barmaq qarı sürüşdürür
     'snow'   – YALNIZ yağan qar. Arxa planda qar örtüyü yoxdur, maus/barmaq təsiri yoxdur
     'normal' – heç nə çəkilmir
   Rejimi theme.js Firebase-dən oxuyub bura ötürür (hamı üçün real vaxtda dəyişir). */
(function(){
  if(window.__snowInit) return; window.__snowInit = true;

  var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var host = document.getElementById('ff-canvas');
  var GROUND = false;            /* yalnız 'winter' rejimində və #ff-canvas varsa */
  var MODE = 'off';
  var POINTER = false;           /* maus/barmaq təsiri yalnız 'winter' rejimində */

  function rnd(a,b){ return a+Math.random()*(b-a); }
  function clamp(v,a,b){ return v<a?a:(v>b?b:v); }
  function smooth(e0,e1,x){ var t=clamp((x-e0)/(e1-e0),0,1); return t*t*(3-2*t); }

  var W=0,H=0,dpr=1,T=0,last=0,raf=0;
  var px=0,py=0,lpx=0,lpy=0,hasP=false,moved=false;       /* maus */
  var mvx=0,mvy=0,mspeed=0,fpx=0,fpy=0;                     /* maus sürəti (hamarlanmış) */

  /* ===================== YER QARI ===================== */
  var CELL=3, TS=16;
  var gw=0,gh=0,tw=0,th=0;
  var D,S,N,Nz,act,nact,oc,octx,img,d32,gc,gctx,gW=0,gH=0;
  var sdirty=false, ringW=new Float32Array(16384);
  var MAXP=1800, np=0;
  var pX=new Float32Array(MAXP),pY=new Float32Array(MAXP),pZ=new Float32Array(MAXP),
      pVX=new Float32Array(MAXP),pVY=new Float32Array(MAXP),pVZ=new Float32Array(MAXP),pS=new Float32Array(MAXP);
  var anyActive=false, needDraw=true;

  /* parlaq işıq: yuxarı-solda */
  var LX=-0.52, LY=-0.62, LZ=0.59, KK=3.4, NB=0.055;

  function valueNoise(w,h,scale,seed){
    var cw=Math.ceil(w/scale)+3, ch=Math.ceil(h/scale)+3, lat=new Float32Array(cw*ch), s=seed|0, i;
    for(i=0;i<lat.length;i++){ s=(Math.imul(s,1664525)+1013904223)|0; lat[i]=((s>>>8)&0xffff)/32768-1; }
    var out=new Float32Array(w*h);
    for(var y=0;y<h;y++){
      var fy=y/scale, iy=fy|0, ty=fy-iy; ty=ty*ty*(3-2*ty);
      for(var x=0;x<w;x++){
        var fx=x/scale, ix=fx|0, tx=fx-ix; tx=tx*tx*(3-2*tx);
        var a=lat[iy*cw+ix], b=lat[iy*cw+ix+1], c=lat[(iy+1)*cw+ix], d=lat[(iy+1)*cw+ix+1];
        out[y*w+x]=(a+(b-a)*tx)*(1-ty)+(c+(d-c)*tx)*ty;
      }
    }
    return out;
  }

  function hf(j){ var v=D[j]; return v+NB*N[j]*(v<1?v:1); }

  function renderRegion(x0,y0,x1,y1){
    x0=Math.max(0,x0); y0=Math.max(0,y0); x1=Math.min(gw-1,x1); y1=Math.min(gh-1,y1);
    for(var y=y0;y<=y1;y++){
      var ym=y>0?y-1:y, yp=y<gh-1?y+1:y, ym2=y>1?y-2:y, yp2=y<gh-2?y+2:y;
      var ty=y/gh;
      var gr=14+15*ty, gg=32+29*ty, gb=55+40*ty;
      for(var x=x0;x<=x1;x++){
        var i=y*gw+x, d=D[i];
        var xm=x>0?x-1:x, xp=x<gw-1?x+1:x, xm2=x>1?x-2:x, xp2=x<gw-2?x+2:x;
        var gx=(hf(y*gw+xp)-hf(y*gw+xm))*0.5, gy=(hf(yp*gw+x)-hf(ym*gw+x))*0.5;
        var dif=(LZ-KK*(gx*LX+gy*LY))/(1+0.5*KK*KK*(gx*gx+gy*gy));
        var t=0.8+(dif-LZ)*1.25-0.07*ty;
        if(t<0)t=0; else if(t>1.04)t=1.04;
        var hs=(Math.imul(i+1,2654435761)>>>0), rn=((hs>>>24)&255)/255;
        var grain=(rn-0.5)*7;
        var sr=168+84*t+grain, sg=192+62*t+grain, sb=224+31*t+grain*0.8;
        if(rn>0.9968){ sr+=26; sg+=26; sb+=22; }          /* parıltı */
        var ao=(D[y*gw+xp2]+D[y*gw+xm2]+D[yp2*gw+x]+D[ym2*gw+x])*0.25-d;
        ao=ao<0?0:(ao>1?1:ao);
        var k=1-0.5*ao, gn=(rn-0.5)*5;
        var cv=smooth(0.03,0.55,d), dim=0.62+0.38*cv, icv=1-cv;
        var r=(gr+gn)*k*icv+sr*dim*cv, g=(gg+gn)*k*icv+sg*dim*cv, b=(gb+gn)*k*icv+sb*dim*cv;
        r=r<0?0:(r>255?255:r); g=g<0?0:(g>255?255:g); b=b<0?0:(b>255?255:b);
        d32[i]=0xFF000000|((b|0)<<16)|((g|0)<<8)|(r|0);
      }
    }
  }

  function setupGround(){
    var cw=host.clientWidth||window.innerWidth, chh=host.clientHeight||window.innerHeight;
    dpr=Math.min(window.devicePixelRatio||1,2);
    if(!gc){
      gc=document.createElement('canvas'); host.appendChild(gc); gctx=gc.getContext('2d');
      oc=document.createElement('canvas'); octx=oc.getContext('2d');
    }
    gW=cw; gH=chh;
    gc.width=Math.round(cw*dpr); gc.height=Math.round(chh*dpr);
    gw=Math.ceil(cw/CELL)+1; gh=Math.ceil(chh/CELL)+1;
    tw=Math.ceil(gw/TS); th=Math.ceil(gh/TS);
    oc.width=gw; oc.height=gh;
    img=octx.createImageData(gw,gh); d32=new Uint32Array(img.data.buffer);
    D=new Float32Array(gw*gh); D.fill(1); S=new Float32Array(gw*gh);
    var n1=valueNoise(gw,gh,40,11), n2=valueNoise(gw,gh,14,23), n3=valueNoise(gw,gh,5,37);
    N=new Float32Array(gw*gh); Nz=new Float32Array(gw*gh);
    var s=987654321;
    for(var i=0;i<N.length;i++){
      N[i]=0.55*n1[i]+0.3*n2[i]+0.15*n3[i];
      s^=s<<13; s^=s>>>17; s^=s<<5; Nz[i]=((s>>>0)%1000)/1000;
    }
    act=new Uint8Array(tw*th); nact=new Uint8Array(tw*th);
    np=0; anyActive=false;
    renderRegion(0,0,gw-1,gh-1);
    octx.putImageData(img,0,0);
    needDraw=true;
  }

  function markTiles(x0,y0,x1,y1){
    var a=Math.max(0,(x0/TS)|0), b=Math.max(0,(y0/TS)|0), c=Math.min(tw-1,(x1/TS)|0), d=Math.min(th-1,(y1/TS)|0);
    for(var ty=b;ty<=d;ty++) for(var tx=a;tx<=c;tx++) act[ty*tw+tx]=1;
    anyActive=true;
  }

  /* maus qarı sürür: mərkəzdən qar götürür, halqa şəklində yığır */
  function dig(cx,cy,R,strength,dirx,diry){
    var Ro=Math.ceil(R*1.85), x0=Math.max(1,Math.floor(cx-Ro)), x1=Math.min(gw-2,Math.ceil(cx+Ro)),
        y0=Math.max(1,Math.floor(cy-Ro)), y1=Math.min(gh-2,Math.ceil(cy+Ro));
    if(x1<x0||y1<y0) return 0;
    var stride=x1-x0+1, R2=R*R, removed=0, sumW=0, x,y,dx,dy,r2,r,w,i,idx;
    if(stride*(y1-y0+1)>ringW.length) return 0;
    var rin=R*0.72, rspan=R*1.05;
    for(y=y0;y<=y1;y++){
      dy=y+0.5-cy;
      for(x=x0;x<=x1;x++){
        dx=x+0.5-cx; r2=dx*dx+dy*dy; i=y*gw+x; idx=(y-y0)*stride+(x-x0);
        ringW[idx]=0;
        if(r2<R2){
          r=Math.sqrt(r2)/R; w=1-smooth(0.3,1,r);
          var take=D[i]*w*strength; D[i]-=take; removed+=take;
        }else{
          r=Math.sqrt(r2);
          if(r>rin && r<rin+rspan){
            var u=(r-rin)/rspan, dot=(dx*dirx+dy*diry)/(r||1);
            var rw=Math.sin(Math.PI*u)*(1+0.85*dot); if(rw<0.04) rw=0.04;
            ringW[idx]=rw; sumW+=rw;
          }
        }
      }
    }
    if(sumW>0 && removed>0){
      var amt=removed*0.72/sumW;
      for(y=y0;y<=y1;y++) for(x=x0;x<=x1;x++){
        w=ringW[(y-y0)*stride+(x-x0)]; if(w>0) D[y*gw+x]+=amt*w;
      }
    }
    markTiles(x0-2,y0-2,x1+2,y1+2);
    return removed;
  }

  function deposit(cx,cy,amt){
    var x=Math.floor(cx), y=Math.floor(cy);
    if(x<1||y<1||x>gw-2||y>gh-2) return;
    var i=y*gw+x;
    D[i]+=amt; D[i-1]+=amt*0.5; D[i+1]+=amt*0.5; D[i-gw]+=amt*0.5; D[i+gw]+=amt*0.5;
    markTiles(x-2,y-2,x+2,y+2);
  }

  /* Qarın səpilməsi: hərəkət istiqamətinə yayılan az sayda dənə, parabolik trayektoriya ilə düşür */
  function spawn(cx,cy,Rpx,dirx,diry,speed){
    if(np>=MAXP) return;
    var fan=rnd(-0.55,0.55), ca=Math.cos(fan), sa=Math.sin(fan);
    var ux=dirx*ca-diry*sa, uy=dirx*sa+diry*ca;
    var v=Math.min(speed,2000)*rnd(0.035,0.09)+rnd(10,40);
    var a=rnd(0,6.2832), rr=Math.sqrt(Math.random())*Rpx*0.35;
    pX[np]=cx+Math.cos(a)*rr; pY[np]=cy+Math.sin(a)*rr; pZ[np]=rnd(0,3);
    pVX[np]=ux*v+rnd(-10,10); pVY[np]=uy*v+rnd(-10,10);
    pVZ[np]=rnd(80,200)*(0.6+Math.min(speed,1500)/2500); pS[np]=rnd(0.9,2.2); np++;
  }

  function processPointer(dt){
    if(!moved) return; moved=false;
    var dx=px-lpx, dy=py-lpy, L=Math.sqrt(dx*dx+dy*dy);
    if(L<0.6) return;
    var sx=lpx, sy=lpy; lpx=px; lpy=py;
    if(L>500) return;                                      /* sıçrayış – kazma */
    var speed=L/Math.max(dt,0.008), sc=Math.min(speed,2500);
    var Rpx=26+sc*0.010, Rc=Rpx/CELL, step=Math.max(2,Rpx*0.3), n=Math.ceil(L/step), dirx=dx/L, diry=dy/L;
    for(var k=1;k<=n;k++){
      var cx=sx+dx*k/n, cy=sy+dy*k/n;
      var rem=dig(cx/CELL,cy/CELL,Rc,0.96,dirx,diry);
      var ns=speed<120&&Math.random()<0.7?0:Math.min(3,Math.round(rem*0.03));
      for(var q=0;q<ns;q++) spawn(cx,cy,Rpx,dirx,diry,speed);
    }
  }

  function updateGround(dt){
    processPointer(dt);
    /* hissəciklər */
    var damp=Math.exp(-1.8*dt);
    for(var i=0;i<np;i++){
      pVX[i]*=damp; pVY[i]*=damp; pVZ[i]-=620*dt;
      pX[i]+=pVX[i]*dt; pY[i]+=pVY[i]*dt; pZ[i]+=pVZ[i]*dt;
      if(pZ[i]<=0){
        deposit(pX[i]/CELL,pY[i]/CELL,0.16);
        np--; pX[i]=pX[np]; pY[i]=pY[np]; pZ[i]=pZ[np]; pVX[i]=pVX[np]; pVY[i]=pVY[np]; pVZ[i]=pVZ[np]; pS[i]=pS[np]; i--;
      }
    }
    if(!anyActive) return;
    /* qar yağır: çuxurlar dolur, yığınlar hamarlanır */
    S.set(D);
    nact.fill(0);
    var minx=1e9,miny=1e9,maxx=-1,maxy=-1, diff=Math.min(0.25,2.8*dt), fill=0.13*dt, relax=Math.min(1,0.9*dt);
    for(var ty=0;ty<th;ty++) for(var tx=0;tx<tw;tx++){
      if(!act[ty*tw+tx]) continue;
      var x0=Math.max(1,tx*TS), x1=Math.min(gw-2,tx*TS+TS-1), y0=Math.max(1,ty*TS), y1=Math.min(gh-2,ty*TS+TS-1), uns=false;
      for(var y=y0;y<=y1;y++){
        for(var x=x0;x<=x1;x++){
          var j=y*gw+x, s=S[j], d=s+((S[j-1]+S[j+1]+S[j-gw]+S[j+gw])*0.25-s)*diff;
          if(d<1){ d+=fill*(0.5+Nz[j]); if(d>1) d=1; }
          else if(d>1){ d-=(d-1)*relax; }
          if(d>0.9965 && d<1.0035) d=1; else uns=true;
          D[j]=d;
        }
      }
      if(x0<minx)minx=x0; if(y0<miny)miny=y0; if(x1>maxx)maxx=x1; if(y1>maxy)maxy=y1;
      if(uns){
        nact[ty*tw+tx]=1;
        if(tx>0)nact[ty*tw+tx-1]=1; if(tx<tw-1)nact[ty*tw+tx+1]=1;
        if(ty>0)nact[(ty-1)*tw+tx]=1; if(ty<th-1)nact[(ty+1)*tw+tx]=1;
      }
    }
    if(maxx>=minx){
      renderRegion(minx-2,miny-2,maxx+2,maxy+2);
      var rx=Math.max(0,minx-2), ry=Math.max(0,miny-2);
      octx.putImageData(img,0,0,rx,ry,Math.min(gw,maxx+3)-rx,Math.min(gh,maxy+3)-ry);
      needDraw=true;
    }
    var t=act; act=nact; nact=t;
    anyActive=false; for(var q=0;q<act.length;q++){ if(act[q]){ anyActive=true; break; } }
  }

  function drawGround(){
    if(!needDraw) return;
    gctx.setTransform(dpr,0,0,dpr,0,0);
    gctx.imageSmoothingEnabled=true; gctx.imageSmoothingQuality='high';
    gctx.drawImage(oc,0,0,gw*CELL,gh*CELL);
    needDraw=false;
  }

  /* Uçan qar hissəcikləri ön qatda çəkilir: kontentin (cədvəl, panel) üstündə görünür */
  function drawParticles(){
    if(np===0) return;
    var TAU=6.2832, i, r, yy;
    fctx.globalAlpha=1;
    fctx.fillStyle='rgba(12,28,50,0.22)'; fctx.beginPath();
    for(i=0;i<np;i++){ r=pS[i]*0.55; fctx.moveTo(pX[i]+r,pY[i]); fctx.ellipse(pX[i],pY[i],r,r*0.55,0,0,TAU); }
    fctx.fill();
    fctx.fillStyle='rgba(125,158,206,0.55)'; fctx.beginPath();
    for(i=0;i<np;i++){ r=pS[i]*0.5+0.9; yy=pY[i]-pZ[i]; fctx.moveTo(pX[i]+r,yy); fctx.arc(pX[i],yy,r,0,TAU); }
    fctx.fill();
    fctx.fillStyle='rgba(255,255,255,1)'; fctx.beginPath();
    for(i=0;i<np;i++){ r=pS[i]*0.5+0.2; yy=pY[i]-pZ[i]; fctx.moveTo(pX[i]+r,yy); fctx.arc(pX[i],yy,r,0,TAU); }
    fctx.fill();
  }

  /* ===================== YAĞAN QAR ===================== */
  var fc=document.createElement('canvas'), fctx=fc.getContext('2d');
  fc.id='snowCanvas'; fc.setAttribute('aria-hidden','true');
  fc.style.cssText='position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:8000;display:none;opacity:0;transition:opacity .7s ease';
  document.body.appendChild(fc);
  var flakes=[], bursts=[], fdpr=1;

  function mkSprite(size,fn){ var c=document.createElement('canvas'); c.width=c.height=size; fn(c.getContext('2d'),size); return c; }
  var spSharp=mkSprite(48,function(g,s){
    var h=s/2, gr=g.createRadialGradient(h,h,0,h,h,h);
    gr.addColorStop(0,'rgba(255,255,255,1)'); gr.addColorStop(.38,'rgba(255,255,255,.97)');
    gr.addColorStop(.52,'rgba(240,246,255,.72)'); gr.addColorStop(.63,'rgba(150,182,225,.30)'); gr.addColorStop(1,'rgba(150,182,225,0)');
    g.fillStyle=gr; g.fillRect(0,0,s,s);
  });
  var spBokeh=mkSprite(96,function(g,s){
    var h=s/2, gr=g.createRadialGradient(h,h,0,h,h,h);
    gr.addColorStop(0,'rgba(255,255,255,.80)'); gr.addColorStop(.62,'rgba(255,255,255,.72)');
    gr.addColorStop(.86,'rgba(205,224,247,.50)'); gr.addColorStop(1,'rgba(190,210,240,0)');
    g.fillStyle=gr; g.fillRect(0,0,s,s);
  });
  var spCrystal=mkSprite(128,function(g,s){
    var h=s/2; g.translate(h,h); g.lineCap='round';
    function arms(col,lw,len){
      g.strokeStyle=col; g.lineWidth=lw;
      for(var a=0;a<6;a++){
        g.save(); g.rotate(a*Math.PI/3); g.beginPath(); g.moveTo(0,0); g.lineTo(0,-len);
        g.moveTo(0,-len*0.45); g.lineTo(len*0.26,-len*0.72); g.moveTo(0,-len*0.45); g.lineTo(-len*0.26,-len*0.72);
        g.moveTo(0,-len*0.72); g.lineTo(len*0.15,-len*0.9); g.moveTo(0,-len*0.72); g.lineTo(-len*0.15,-len*0.9);
        g.stroke(); g.restore();
      }
    }
    arms('rgba(130,168,222,.55)',9,54); arms('rgba(255,255,255,1)',4.4,54);
    g.fillStyle='#fff'; g.beginPath(); g.arc(0,0,7,0,6.2832); g.fill();
  });

  function makeFlake(init){
    var u=Math.random(), f={L:0,r:0,vy:0,a:0,amp:0,wf:0};
    if(u<.42){ f.L=0; f.r=rnd(.8,1.6); f.vy=rnd(22,40); f.a=rnd(.55,.85); f.amp=rnd(5,12); f.wf=.3; }
    else if(u<.82){ f.L=1; f.r=rnd(1.7,3.1); f.vy=rnd(44,72); f.a=rnd(.82,.97); f.amp=rnd(9,20); f.wf=.55; }
    else if(u<.89){ f.L=2; f.r=rnd(3.6,5.4); f.vy=rnd(40,62); f.a=rnd(.8,.95); f.amp=rnd(16,30); f.wf=.8; }
    else { f.L=3; f.r=rnd(4.5,9); f.vy=rnd(95,150); f.a=rnd(.22,.45); f.amp=rnd(20,40); f.wf=1.2; }
    f.x=rnd(0,W); f.y=init?rnd(-H*0.05,H):rnd(-30,-6);
    f.ph=rnd(0,6.28); f.sp=rnd(.5,1.5); f.rot=rnd(0,6.28); f.rs=rnd(-.9,.9); f.ex=0; f.ey=0;
    return f;
  }

  function wind(y){
    var g=Math.sin(T*0.053); g=g>0?g*g*30:0;
    return (12*Math.sin(T*0.11)+8*Math.sin(T*0.27+2)+g)*(0.75+0.25*Math.sin(y*0.0035+T*0.35));
  }

  function resizeFlakes(){
    fdpr=Math.min(window.devicePixelRatio||1,2);
    W=window.innerWidth; H=window.innerHeight;
    fc.width=Math.round(W*fdpr); fc.height=Math.round(H*fdpr);
    fctx.setTransform(fdpr,0,0,fdpr,0,0);
    var n=Math.max(45,Math.min(260,Math.round(W*H/7500)));
    while(flakes.length<n) flakes.push(makeFlake(true));
    if(flakes.length>n) flakes.length=n;
  }

  function drawFlake(f){
    fctx.globalAlpha=f.a;
    if(f.L===2){
      fctx.save(); fctx.translate(f.x,f.y); fctx.rotate(f.rot);
      var s=f.r*2.4; fctx.drawImage(spCrystal,-s,-s,s*2,s*2); fctx.restore();
    }else if(f.L===3){ var b=f.r*1.0; fctx.drawImage(spBokeh,f.x-b,f.y-b,b*2,b*2); }
    else{ var q=f.r*1.7; fctx.drawImage(spSharp,f.x-q,f.y-q,q*2,q*2); }
  }

  function frame(ts){
    raf=requestAnimationFrame(frame);
    var dt=Math.min(0.05,(ts-last)/1000||0.016); last=ts; T+=dt;

    /* maus sürəti */
    if(hasP){
      var ivx=(px-fpx)/Math.max(dt,0.008), ivy=(py-fpy)/Math.max(dt,0.008);
      mvx+=(ivx-mvx)*Math.min(1,dt*10); mvy+=(ivy-mvy)*Math.min(1,dt*10);
    }else{ mvx*=0.9; mvy*=0.9; }
    fpx=px; fpy=py; mspeed=Math.sqrt(mvx*mvx+mvy*mvy);

    if(GROUND){ updateGround(dt); drawGround(); }

    fctx.clearRect(0,0,W,H);
    var dk=Math.exp(-2.6*dt), push=hasP&&mspeed>90;
    for(var i=0;i<flakes.length;i++){
      var f=flakes[i];
      f.ph+=dt*f.sp; f.rot+=f.rs*dt*(f.L===2?0.6:0);
      if(push){
        var ddx=f.x-px, ddy=f.y-py, dd=ddx*ddx+ddy*ddy;
        if(dd<14400){
          var dist=Math.sqrt(dd)||1, k=(1-dist/120); k*=k*Math.min(mspeed,1600)*0.012;
          f.ex+=(ddx/dist*0.6+mvx/(mspeed||1)*0.4)*k*dt*60;
          f.ey+=(ddy/dist*0.6+mvy/(mspeed||1)*0.4)*k*dt*60;
        }
      }
      f.ex*=dk; f.ey*=dk;
      f.x+=(wind(f.y)*f.wf+Math.cos(f.ph)*f.amp*f.sp*0.9+f.ex)*dt;
      f.y+=(f.vy*(1+0.16*Math.sin(f.ph*1.7+1))+f.ey)*dt;
      if(f.y>H+20){ var nf=makeFlake(false); flakes[i]=f=nf; }
      if(f.x>W+14) f.x=-14; else if(f.x<-14) f.x=W+14;
      drawFlake(f);
    }
    drawParticles();
    for(var j=bursts.length-1;j>=0;j--){
      var b=bursts[j]; b.life-=dt;
      if(b.life<=0){ bursts.splice(j,1); continue; }
      b.vx*=(1-dt*1.4); b.vy+=dt*70; b.x+=b.vx*dt; b.y+=b.vy*dt;
      b.a=Math.min(.9,b.life/.7); b.L=1; drawFlake(b);
    }
    fctx.globalAlpha=1;
  }

  function start(){ if(!raf){ last=performance.now(); raf=requestAnimationFrame(frame); } }
  function stop(){ if(raf){ cancelAnimationFrame(raf); raf=0; } }

  /* klikdə qar “tüstüsü” */
  window.__snowBurst=function(x,y,n){
    if(MODE!=='winter') return;
    if(x==null){ x=W/2; y=H*.7; }
    if(GROUND && !reduced){
      var cx=x/CELL, cy=y/CELL, rem=dig(cx,cy,34/CELL,0.9,0,-1), c=Math.min(26,Math.round(rem*0.08)+8);
      for(var q=0;q<c;q++) spawn(x,y,30,0,-1,500);
    }else{
      n=n||14;
      for(var i=0;i<n && bursts.length<90;i++){
        var a=rnd(-Math.PI*.95,-Math.PI*.05), sp=rnd(60,200);
        bursts.push({x:x,y:y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,r:rnd(1.2,3.2),life:rnd(1.1,2),a:.9,L:1,rot:0});
      }
    }
  };

  function onMove(e){
    if(!POINTER) return;
    px=e.clientX; py=e.clientY;
    if(!hasP){ hasP=true; lpx=px; lpy=py; fpx=px; fpy=py; }
    moved=true;
  }
  window.addEventListener('pointermove',onMove,{passive:true});
  window.addEventListener('pointerdown',function(e){
    if(!POINTER) return; onMove(e); lpx=px; lpy=py; if(window.__snowBurst) window.__snowBurst(e.clientX,e.clientY,6);
  },{passive:true});
  /* Toxunma: brauzer sürüşdürməyə başlayanda pointercancel gəlir, buna görə barmağı touchmove ilə izləyirik */
  function setPointer(x,y){
    if(!POINTER) return;
    px=x; py=y;
    if(!hasP){ hasP=true; lpx=px; lpy=py; fpx=px; fpy=py; }
    moved=true;
  }
  window.addEventListener('touchstart',function(e){ var t=e.touches[0]; if(t) setPointer(t.clientX,t.clientY); },{passive:true});
  window.addEventListener('touchmove',function(e){ var t=e.touches[0]; if(t) setPointer(t.clientX,t.clientY); },{passive:true});
  window.addEventListener('touchend',function(e){ if(!e.touches||e.touches.length===0) hasP=false; },{passive:true});
  window.addEventListener('touchcancel',function(){ hasP=false; },{passive:true});
  document.documentElement.addEventListener('mouseleave',function(){ hasP=false; },{passive:true});
  document.addEventListener('visibilitychange',function(){ if(document.hidden) stop(); else if(MODE==='winter'||MODE==='snow') start(); });

  var rzT=0;
  window.addEventListener('resize',function(){
    resizeFlakes();
    clearTimeout(rzT);
    rzT=setTimeout(function(){ if(GROUND) setupGround(); else if(gc) gc._stale=true; },120);
  });

  resizeFlakes();

  var offT=0;
  function setMode(m){
    if(m!=='winter' && m!=='snow') m='normal';
    if(m===MODE) return;
    MODE=m;
    clearTimeout(offT);

    if(m==='normal'){
      POINTER=false; hasP=false; moved=false; GROUND=false;
      bursts.length=0;
      fc.style.opacity='0';
      if(host){ host.style.transition='opacity .7s ease'; host.style.opacity='0'; }
      offT=setTimeout(function(){
        if(MODE!=='normal') return;
        stop(); fc.style.display='none'; fctx.clearRect(0,0,W,H);
        if(host) host.style.display='none';
      },720);
      return;
    }

    POINTER=(m==='winter'); GROUND=(m==='winter' && !!host);
    if(!POINTER){ hasP=false; moved=false; }

    if(host){
      if(GROUND){
        host.style.display='';
        if(!gc || gc._stale){ setupGround(); if(gc) gc._stale=false; }
        needDraw=true;
        host.style.transition='opacity .7s ease';
        void host.offsetWidth; host.style.opacity='1';
      }else{
        host.style.opacity='0';
        offT=setTimeout(function(){ if(!GROUND) host.style.display='none'; },720);
      }
    }
    if(reduced){ fc.style.display='none'; return; }
    fc.style.display='';
    void fc.offsetWidth; fc.style.opacity='1';
    resizeFlakes();
    start();
  }

  window.IstSnow={ setMode:setMode, get mode(){ return MODE; } };
})();

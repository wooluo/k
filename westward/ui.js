/* ui.js — 场景 canvas 渲染 + DOM UI 桥接 + 主循环 */
(function(){
const $=id=>document.getElementById(id);
const CV=$('game'),CX=CV.getContext('2d');
const VW=30;let VH=20;
CX.imageSmoothingEnabled=false;

/* ---------- 缩放适配（VH 按屏比动态，长屏无黑边） ---------- */
function fit(){
  const w=innerWidth,h=innerHeight;
  VH=Math.max(16,Math.min(72,Math.round(VW*h/w)));
  CV.width=VW*16;CV.height=VH*16;
  CX.imageSmoothingEnabled=false;
  const wr=$('wrap');wr.style.width=w+'px';wr.style.height=h+'px';
  CV.style.width=w+'px';CV.style.height=h+'px';
  for(const id of['tcv','bscene']){const c=$(id);if(c){c.width=w;c.height=h;}}
}
addEventListener('resize',fit);fit();

/* ---------- 水墨画布（标题/战斗共用画师） ---------- */
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}}
const TITLE_STARS=(()=>{const r=mulberry(7),a=[];for(let i=0;i<70;i++)a.push({x:r(),y:r()*0.62,s:r()<0.2?2:1,p:r()*6.28,v:0.5+r()});return a;})();
const INK_PETALS=(()=>{const r=mulberry(21),a=[];for(let i=0;i<16;i++)a.push({x:r(),y:r(),v:0.3+r()*0.5,s:3+r()*4,p:r()*6.28});return a;})();
let monkeySil=null;
function inkSil(cv){const c=document.createElement('canvas');c.width=cv.width;c.height=cv.height;const x=c.getContext('2d');x.drawImage(cv,0,0);x.globalCompositeOperation='source-in';x.fillStyle='rgba(7,10,20,.93)';x.fillRect(0,0,c.width,c.height);return c;}
function inkRidge(cx,W,H,base,amp,seed,col){ /* 水墨山脊填充，返回控制点供放剪影 */
  const r=mulberry(seed),n=9,pts=[];
  for(let i=0;i<=n;i++)pts.push(base+(r()-0.5)*amp*2);
  cx.beginPath();cx.moveTo(-30,H+30);
  for(let i=0;i<n;i++){
    const x=i*W/n,y=pts[i],nx=(i+1)*W/n,ny=pts[i+1];
    for(let s=0;s<=6;s++){const u=s/6,mu=(1-Math.cos(u*Math.PI))/2;cx.lineTo(x+(nx-x)*u,y+(ny-y)*mu);}
  }
  cx.lineTo(W+30,H+30);cx.closePath();cx.fillStyle=col;cx.fill();
  return pts;
}
function paintInk(cx,W,H,t,pal,title){
  if(!W||!H)return;
  const g=cx.createLinearGradient(0,0,0,H);g.addColorStop(0,pal.sky[0]);g.addColorStop(1,pal.sky[1]);
  cx.fillStyle=g;cx.fillRect(0,0,W,H);
  if(title){cx.fillStyle=pal.moon;
    TITLE_STARS.forEach(s=>{cx.globalAlpha=0.2+0.6*Math.abs(Math.sin(t*s.v+s.p));cx.fillRect(s.x*W,s.y*H,s.s,s.s);});
    cx.globalAlpha=1;}
  /* 月 + 光晕 */
  const mx=title?W*0.7:W*0.5,my=H*(title?0.21:0.15),mr=Math.min(W,H)*(title?0.13:0.10);
  const halo=cx.createRadialGradient(mx,my,mr*0.4,mx,my,mr*2.6);
  halo.addColorStop(0,'rgba(255,246,220,.26)');halo.addColorStop(1,'rgba(255,246,220,0)');
  cx.fillStyle=halo;cx.fillRect(mx-mr*2.7,my-mr*2.7,mr*5.4,mr*5.4);
  cx.fillStyle=pal.moon;cx.beginPath();cx.arc(mx,my,mr,0,7);cx.fill();
  cx.fillStyle='rgba(0,0,0,.07)';
  cx.beginPath();cx.arc(mx-mr*0.3,my-mr*0.15,mr*0.24,0,7);cx.fill();
  cx.beginPath();cx.arc(mx+mr*0.28,my+mr*0.32,mr*0.16,0,7);cx.fill();
  /* 流云 */
  cx.fillStyle=pal.mist;
  for(let i=0;i<3;i++){
    const cy2=H*(0.30+i*0.14),cw=W*(0.5+i*0.2);
    const cxp=((t*(7+i*4)+i*W*0.45)%(W+cw))-cw*0.6;
    for(let k=0;k<4;k++){cx.beginPath();cx.ellipse(cxp+k*cw*0.22,cy2+((k%2)*7),cw*0.2,9+((k%2)*6),0,0,7);cx.fill();}
  }
  /* 三层水墨远山（远→近 渐深） */
  inkRidge(cx,W,H,H*0.50,H*0.10,31,pal.far);
  const pts2=inkRidge(cx,W,H,H*0.63,H*0.11,77,pal.mid);
  inkRidge(cx,W,H,H*0.78,H*0.12,123,pal.near);
  /* 山巅猴影（仅标题） */
  if(title){
    if(!monkeySil&&typeof SPRITES!=='undefined'&&SPRITES.wukong)monkeySil=inkSil(SPRITES.wukong.down[0]);
    if(monkeySil){
      let bi=0;pts2.forEach((y,i)=>{if(y<pts2[bi])bi=i;});
      const px=bi*W/9,py=pts2[bi]+2,sc=Math.max(3,Math.round(W/180));
      cx.drawImage(monkeySil,px-8*sc,py-16*sc+2,16*sc,16*sc);
    }
  }
  /* 落瓣（仅标题） */
  if(title){
    INK_PETALS.forEach(p=>{
      const y=((p.y+t*p.v*0.045)%1.15-0.07)*H;
      const x=(p.x+Math.sin(t*0.7+p.p)*0.035)*W,rot=t*0.9+p.p;
      cx.save();cx.translate(x,y);cx.rotate(rot);
      cx.fillStyle='rgba(236,178,150,.55)';
      cx.beginPath();cx.ellipse(0,0,p.s,p.s*0.55,0,0,7);cx.fill();cx.restore();
    });
  }
  /* 地雾 + 底部压暗（保 UI 可读） */
  const fog=cx.createLinearGradient(0,H*0.66,0,H);
  fog.addColorStop(0,'rgba(200,215,235,0)');fog.addColorStop(1,pal.fogB);
  cx.fillStyle=fog;cx.fillRect(0,H*0.66,W,H*0.34);
  const vig=cx.createLinearGradient(0,H*0.6,0,H);
  vig.addColorStop(0,'rgba(0,0,0,0)');vig.addColorStop(1,'rgba(0,0,0,.5)');
  cx.fillStyle=vig;cx.fillRect(0,H*0.6,W,H*0.4);
}
/* 战斗场景按地图主题选调色板 */
const PAL_DEF={sky:['#0b1226','#1e3252'],far:'#24405e',mid:'#16283e',near:'#0d1a2c',mist:'rgba(170,210,235,.09)',moon:'#f2e8cc',fogB:'rgba(150,180,210,.10)'};
const BPALS=[
  [['龙宫','东海','之滨'],{sky:['#07293b','#0e4c62'],far:'#1a5c6e',mid:'#104250',near:'#092c38',mist:'rgba(150,225,235,.11)',moon:'#d8f0f2',fogB:'rgba(120,200,215,.10)'}],
  [['地府','阎罗','幽冥'],{sky:['#130b1f','#2a1438'],far:'#3c2252',mid:'#2a1638',near:'#180b26',mist:'rgba(190,160,230,.09)',moon:'#e0d0f4',fogB:'rgba(150,120,190,.10)'}],
  [['天宫','南天','兜率','瑶池','御马'],{sky:['#2b2342','#584a72'],far:'#70588c',mid:'#503e6a',near:'#372a50',mist:'rgba(255,232,170,.13)',moon:'#ffedb8',fogB:'rgba(230,205,160,.10)'}],
  [['洞'],{sky:['#0c141e','#243244'],far:'#2e4050',mid:'#1e2c3a',near:'#141e2a',mist:'rgba(160,190,215,.08)',moon:'#cdd8e0',fogB:'rgba(140,170,195,.09)'}],
  [['方寸','三星'],{sky:['#0a1a16','#1c342c'],far:'#265044',mid:'#183830',near:'#0e241e',mist:'rgba(170,225,200,.09)',moon:'#e2f0dc',fogB:'rgba(150,200,180,.10)'}],
];
function battlePal(){
  const nm=(Eng.map&&Eng.map.name)||'';
  for(const[ks,p]of BPALS)if(ks.some(k=>nm.includes(k)))return p;
  return PAL_DEF;
}

/* ---------- 场景渲染 ---------- */
function camXY(){
  const m=Eng.map,p=Eng.player;
  let cx=p.x-(VW>>1),cy=p.y-(VH>>1);
  cx=Math.max(0,Math.min(m.w-VW,cx));cy=Math.max(0,Math.min(m.h-VH,cy));
  if(m.w<VW)cx=-((VW-m.w)>>1);if(m.h<VH)cy=-((VH-m.h)>>1);
  return[cx,cy];
}
let frame=0;
function drawScene(){
  const m=Eng.map;if(!m)return;
  const[cx,cy]=camXY(),p=Eng.player;
  CX.fillStyle='#0a0812';CX.fillRect(0,0,CV.width,CV.height);
  for(let ty=0;ty<VH;ty++)for(let tx=0;tx<VW;tx++){
    const mx=cx+tx,my=cy+ty;
    if(mx<0||my<0||mx>=m.w||my>=m.h)continue;
    const pat=tilePat(m.rows[my][mx],frame>>4);
    if(pat)CX.drawImage(pat,tx*16,ty*16);
  }
  /* 出口闪烁标记 */
  (m.exits||[]).forEach(e=>{
    const sx=(e.x-cx)*16,sy=(e.y-cy)*16;
    if(sx<-16||sy<-16||sx>CV.width||sy>CV.height)return;
    if(plotStage>=e.plot&&(frame>>3)%2===0){
      CX.fillStyle='rgba(244,196,48,.85)';
      CX.fillRect(sx+6,sy+2,4,3);CX.fillRect(sx+4,sy+6,8,3);CX.fillRect(sx+2,sy+10,12,3);
    }
  });
  /* 明雷 */
  Eng.foeSpots.forEach(f=>{
    const sx=(f.x-cx)*16,sy=(f.y-cy)*16;
    if(sx<-16||sy<-16||sx>CV.width||sy>CV.height)return;
    drawShadow(CX,sx+8,sy+14);
    CX.drawImage(foeCv(f.sp),sx,sy,16,16);
    CX.fillStyle='#ff5040';CX.fillRect(sx+11,sy+1,4,4);
  });
  /* NPC */
  (m.npcs||[]).forEach(n=>{
    const sx=(n.x-cx)*16,sy=(n.y-cy)*16;
    if(sx<-16||sy<-16||sx>CV.width||sy>CV.height)return;
    if(n.spr&&SPRITES[n.spr]){
      const fr=SPRITES[n.spr].down[frame>>4&1];
      drawShadow(CX,sx+8,sy+14);
      CX.drawImage(fr,sx,sy,16,16);
      if(n.foeart&&plotStage>=12){CX.fillStyle='#ff4030';CX.font='bold 10px sans-serif';CX.fillText('!',sx+6,sy-2);}
    }
  });
  /* 玩家 */
  if(p){
    const sx=(p.x-cx)*16,sy=(p.y-cy)*16;
    const sp=playerBuffs.insect>0?SPRITES.worm:SPRITES.wukong;
    const fr=sp[p.face][(p.walk>>3)&1];
    drawShadow(CX,sx+8,sy+14);
    CX.drawImage(fr,sx,sy-2,16,16);
  }
}

/* ---------- HUD ---------- */
const CHAPTERS=['石猴出世','美猴王','求道方寸','三星学艺','艺成归乡','除魔卫家','龙宫夺宝','勾销生死','太白招安','弼马温','怒上凌霄','醉饱蟠桃','盗丹风云','大闹天宫','五行山下'];
function hud(){
  $('hplv').textContent='Lv'+P.lv;
  $('hpbar').firstElementChild.style.width=Math.max(0,P.hp/P.hpmax*100)+'%';
  $('mpbar').firstElementChild.style.width=Math.max(0,P.mp/P.mpmax*100)+'%';
  $('goldv').textContent=P.gold;
  $('mapname').textContent=Eng.map?Eng.map.name:'';
}

/* ---------- toast ---------- */
const oldToast=toast;
toast=function(s){oldToast(s);};
function drawToast(){
  const t=$('toast');
  if(toastT>0){t.style.display='block';t.textContent=toastMsg;}
  else t.style.display='none';
}

/* ---------- 对话框 ---------- */
function dlgName(branch){
  const t=branch.text[0]||'';
  const i=t.indexOf('：');
  if(i>0&&i<10)return t.slice(0,i);
  return Eng.map?Eng.map.name:'';
}
function drawDlg(){
  const b=Game.dlgBranch,box=$('dlgbox');
  if(Game.mode!=='dialog'||!b){box.style.display='none';return;}
  box.style.display='block';
  $('dlgname').textContent=dlgName(b);
  $('dlgtext').textContent=b.text[Game.dlgIdx]||'';
  $('dlgnext').style.visibility=Game.dlgIdx<b.text.length-1?'visible':'visible';
}

/* ---------- 战斗 ---------- */
function drawBattle(){
  const box=$('battle');
  if(!Battle.active){box.style.display='none';return;}
  box.style.display='block';
  /* 水墨场景背景（按地图主题） */
  const bs=$('bscene');
  if(bs&&bs.width)paintInk(bs.getContext('2d'),bs.width,bs.height,frame/30,battlePal(),false);
  /* 敌人立绘 */
  const fc=$('bfoecv'),fx=fc.getContext('2d');
  fx.clearRect(0,0,128,128);
  const art=foeCv(Battle.foe.art||Battle.foe.id);
  const wob=Math.sin(frame/9)*(Battle.anim>0?6:2);
  fx.drawImage(art,0,wob);
  if(Battle.anim>0)Battle.anim--;
  $('bfoename').textContent=Battle.foe.name+(Battle.isBoss?' 【BOSS】':'');
  $('bfoehp').firstElementChild.style.width=Math.max(0,Battle.foeHP/Battle.foeMax*100)+'%';
  $('blog').innerHTML=Battle.log.slice(-3).map(s=>'· '+s).join('<br>');
  $('bstat').textContent='悟空 Lv'+P.lv+'  HP '+P.hp+'/'+P.hpmax+'  MP '+P.mp+'/'+P.mpmax+'  攻'+(P.atk+eqatk())+' 防'+(P.def+eqdef());
  /* 指令按钮 */
  const bm=$('bmenu');
  if(!bm.dataset.bind){
    bm.dataset.bind=1;
    bm.innerHTML='';
    ['攻击','技能','道具','逃跑'].forEach((s,i)=>{
      const d=document.createElement('div');d.textContent=s;
      d.addEventListener('pointerdown',e=>{e.stopPropagation();Battle.sel=i;uiBattleAct(i);});
      bm.appendChild(d);
    });
  }
  [...bm.children].forEach((d,i)=>d.classList.toggle('dim',Battle.menu!=='main'&&false));
  if(Battle.pendingSkill){/* submenu 面板承担 */}
}
function uiBattleAct(i){
  if(Battle.turnLock)return;
  if(i===0)Battle.act('fight');
  else if(i===1)openSkillMenu();
  else if(i===2)openItemMenuBattle();
  else{window.AUD&&AUD.sfx.flee();Battle.act('flee');}
}
function openSkillMenu(){
  const sk=Battle.skills();
  openSub('技能',(sk.length?sk:null)||[],s=>s.name+' MP'+s.mp,s=>{
    Game.mode='battle';closeSub();Battle.act('skill',s);
  });
}
function openItemMenuBattle(){
  const its=Object.keys(P.items).filter(i=>P.items[i]>0).map(i=>({id:i,...ITEMS[i]}));
  openSub('道具',its.length?its:null,it=>it.name+'×'+P.items[it.id],it=>{
    Game.mode='battle';closeSub();Battle.act('item',it.id);
  });
}

/* ---------- 子面板（技能/道具/装备/商店/筋斗云） ---------- */
function openSub(title,list,labelFn,cb){
  Game.mode='submenu';
  $('subh').textContent=title;
  const sl=$('sublist');sl.innerHTML='';
  if(!list||!list.length){
    const d=document.createElement('div');d.className='menu-item';d.textContent='（空）';
    d.addEventListener('pointerdown',closeSub);sl.appendChild(d);
  }else list.forEach(item=>{
    const d=document.createElement('div');d.className='menu-item';
    d.textContent=labelFn(item);
    d.addEventListener('pointerdown',e=>{e.stopPropagation();cb(item);});
    sl.appendChild(d);
  });
  $('submenu').style.display='block';
}
function closeSub(){$('submenu').style.display='none';}

/* ---------- 系统菜单 ---------- */
function openMenu(){
  Game.mode='menu';
  const sl=$('syslist');sl.innerHTML='';
  [['状态',showStatus],['物品',useItemList],['装备',gearList],['图鉴',dexList],['成就',achList],['修炼',skillTrain],['筋斗云',cloudList],['音乐',toggleMute],['存档',()=>{Game.save();toast('已存档');}],['关闭',closeMenu]]
  .forEach(([s,fn])=>{
    const d=document.createElement('div');d.className='menu-item';d.textContent=s;
    d.addEventListener('pointerdown',e=>{e.stopPropagation();fn();});
    sl.appendChild(d);
  });
  $('sysmenu').style.display='block';
}
function closeMenu(){$('sysmenu').style.display='none';}
function showStatus(){
  const kills=(P.stats&&P.stats.kills)||{};
  const lit=Object.keys(kills).filter(k=>kills[k]>0).length;
  openSub('状态',[{k:1}],
    ()=>`Lv${P.lv}  攻${P.atk+eqatk()}  防${P.def+eqdef()}
HP ${P.hp}/${P.hpmax}   MP ${P.mp}/${P.mpmax}
经验 ${P.exp}/${expNext(P.lv)}   文钱 ${P.gold}
武器 ${P.weapon?GEARS[P.weapon].name:'赤手空拳'}
防具 ${P.armor?GEARS[P.armor].name:'布衣'}
成就 ${Object.keys(P.ach||{}).length}/${ACHV.length}   技能点 ${P.skPts||0}
万妖塔纪录 ${P.stats&&P.stats.maxFloor||0} 层   图鉴 ${lit}/${Object.keys(FOES).length}`,
    closeSub);
}
function useItemList(){
  const its=Object.keys(P.items).filter(i=>P.items[i]>0).map(i=>({id:i,...ITEMS[i]}));
  openSub('物品（点选服用）',its.length?its:null,
    it=>it.name+'×'+P.items[it.id]+'  '+it.desc,
    it=>{useItemMenu(it.id);useItemList();});
}
function gearList(){
  const all=Object.keys(GEARS).map(id=>Object.assign({id},GEARS[id]));
  openSub('装备（点选穿卸）',all,g=>{
    const worn=P.weapon===g.id||P.armor===g.id;
    const cnt=(P.gearBag&&P.gearBag[g.id])||0;
    return (worn?'[已装] ':cnt>0?'[袋×'+cnt+'] ':'[未得] ')+g.name+'  '+(g.type==='weapon'?'攻+'+g.atk:'防+'+g.def);
  },g=>{
    const slot=g.type==='weapon'?'weapon':'armor';
    if(P[slot]===g.id){ /* 卸下 */
      P[slot]=null;P.gearBag[g.id]=(P.gearBag[g.id]||0)+1;
      window.AUD&&AUD.sfx.item();toast('卸下 '+g.name);
    }else if((P.gearBag[g.id]||0)>0){ /* 穿上，旧的回袋 */
      const old=P[slot];
      P[slot]=g.id;P.gearBag[g.id]--;
      if(P.gearBag[g.id]<=0)delete P.gearBag[g.id];
      if(old){P.gearBag[old]=(P.gearBag[old]||0)+1;}
      window.AUD&&AUD.sfx.confirm();toast('装备 '+g.name);
    }else{toast(g.name+'：尚未获得（闯万妖塔/击败妖王可掉落）');return;}
    Game.save();gearList();
  });
}
function dexList(){
  const kills=(P.stats&&P.stats.kills)||{};
  const arr=Object.keys(FOES).map(id=>Object.assign({id},FOES[id]));
  const lit=arr.filter(f=>(kills[f.id]||0)>0).length;
  openSub('妖怪图鉴 '+lit+'/'+arr.length,arr,
    f=>(kills[f.id]||0)>0?f.name+'　击杀×'+kills[f.id]:'？？？',
    ()=>{});
}
function achList(){
  const got=Object.keys(P.ach||{}).length;
  openSub('成就 '+got+'/'+ACHV.length,ACHV,
    a=>((P.ach&&P.ach[a.id])?'★ ':'☆ ')+a.name+'　'+a.desc,
    ()=>{});
}
function skillTrain(){
  const arr=Object.keys(SKILLS).map(k=>Object.assign({id:k},SKILLS[k])).filter(s=>P.lv>=s.lv);
  if(!arr.length){toast('尚无技能（随剧情习得）');return;}
  openSub('技能修炼·剩余点 '+P.skPts,arr,
    s=>{const u=(P.skLv[s.id]||1);
      return s.name+' Lv'+u+(u>=9?'·圆满':'→'+(u+1))+'  '+(s.mult>0?'威力×'+(s.mult*(1+0.12*(u-1))).toFixed(2):'效果强化');},
    s=>{
      const u=(P.skLv[s.id]||1);
      if(u>=9){toast(s.name+' 已修炼圆满');return;}
      if((P.skPts||0)<=0){toast('技能点不足（升级获得）');return;}
      P.skPts--;P.skLv[s.id]=u+1;
      window.AUD&&AUD.sfx.levelup();
      toast(s.name+' 修炼至 Lv'+(u+1));
      Game.save();skillTrain();
    });
}
function toggleMute(){
  if(!window.AUD)return;
  const m=AUD.toggle();
  toast(m?'🔇 音乐音效：关':'🔊 音乐音效：开');
}
/* ---------- JUICE：飘字/屏震/震动/胜负横幅 ---------- */
const JUICE=(function(){
  let fx=null;
  function ensure(){
    if(!fx){fx=document.createElement('div');fx.id='fx';
      const w=document.getElementById('wrap');if(w)w.appendChild(fx);}
    return fx;
  }
  function pop(x,y,text,cls,dur){
    const d=document.createElement('div');
    d.className='fx-pop '+(cls||'');d.textContent=text;
    d.style.left=x+'px';d.style.top=y+'px';
    ensure().appendChild(d);
    setTimeout(()=>d.remove(),dur||900);
  }
  function buzz(p){try{navigator.vibrate&&navigator.vibrate(p);}catch(e){}}
  function shake(){
    const w=document.getElementById('wrap');if(!w)return;
    w.classList.remove('fx-shake');void w.offsetWidth;w.classList.add('fx-shake');
    setTimeout(()=>w.classList.remove('fx-shake'),320);
  }
  const CX=()=>Math.round(innerWidth/2)-40;
  return {
    dmg(d,isCrit){pop(CX(),Math.round(innerHeight*0.26),'-'+d,isCrit?'fx-crit':'fx-dmg');shake();window.AUD&&AUD.sfx[isCrit?'crit':'hit']();buzz(isCrit?35:15);},
    hurt(d){pop(CX(),Math.round(innerHeight*0.60),'-'+d,'fx-hurt');window.AUD&&AUD.sfx.hurt();buzz(45);},
    win(){pop(CX(),Math.round(innerHeight*0.36),'胜','fx-banner',1300);window.AUD&&AUD.sfx.victory();buzz([50,30,60]);},
    lose(){pop(CX(),Math.round(innerHeight*0.36),'败','fx-banner fx-lose',1300);window.AUD&&AUD.sfx.defeat();buzz(120);},
  };
})();
window.JUICE=JUICE;
function cloudList(){
  if(plotStage<4){toast('还不会筋斗云');return;}
  const arr=[...Eng.visited].map(id=>({id,name:MAPS[id].name}));
  openSub('筋斗云·传送',arr,a=>'→ '+a.name,a=>{
    closeSub();closeMenu();Game.mode='field';Eng.start(a.id);toast('筋斗云起——'+a.name);
  });
}

/* ---------- 商店 ---------- */
function openShop(){
  const goods=Game.shopGoods();
  openSub('傲来商铺',goods,g=>{
    const owned=g.type==='weapon'||g.type==='armor'?(GEARS[g.id]?'':''):'';
    return g.name+'  '+g.price+'文  '+g.desc;
  },g=>{Game.shopBuy2(g.id);openShop();});
}

/* ---------- 输入 ---------- */
let holdT=null;
function bindPad(){
  const dirs={dU:'up',dD:'down',dL:'left',dR:'right'};
  Object.keys(dirs).forEach(id=>{
    const el=$(id);
    const step=()=>{if(Game.mode==='field'&&!Battle.active)Eng.move(dirs[id]);};
    el.addEventListener('pointerdown',e=>{e.stopPropagation();e.preventDefault();step();holdT=setInterval(step,150);});
    ['pointerup','pointerleave','pointercancel'].forEach(ev=>el.addEventListener(ev,()=>{clearInterval(holdT);}));
  });
  $('btnA').addEventListener('pointerdown',e=>{e.stopPropagation();actA();});
  $('btnB').addEventListener('pointerdown',e=>{e.stopPropagation();actB();});
  /* 对话：点屏推进 */
  const db=$('dlgbox');
  if(db)db.addEventListener('pointerdown',e=>{e.stopPropagation();if(Game.mode==='dialog')dlgAdvance();});
  /* 音频：首次手势解锁 AudioContext */
  document.addEventListener('pointerdown',()=>{if(window.AUD){AUD.init();AUD.resume();}},{once:true});
}
function actA(){ /* 确认 */
  if(Game.mode==='title')return;
  if(Battle.active)return;
  if(Game.mode==='dialog')dlgAdvance();
  else if(Game.mode==='field')Eng.talk();
}
function actB(){ /* 菜单/取消 */
  if(Game.mode==='title')return;
  if(Battle.active)return;
  if(Game.mode==='dialog')dlgAdvance();
  else if(Game.mode==='submenu'){closeSub();Game.mode='field';}
  else if(Game.mode==='menu'){closeMenu();Game.mode='field';}
  else if(Game.mode==='field')openMenu();
}

/* ---------- 键盘（桌面） ---------- */
addEventListener('keydown',e=>{
  const k=e.key;
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(k))e.preventDefault();
  if(Game.mode==='title')return;
  if(Battle.active){
    const B=Battle;
    if(B.turnLock)return;
    if(B.menu==='main'){
      if(k==='ArrowUp'&&B.sel>0)B.sel--;
      if(k==='ArrowDown'&&B.sel<3)B.sel++;
      if(k===' '||k==='Enter')uiBattleAct(B.sel);
    }
    return;
  }
  const dir={ArrowUp:'up',w:'up',ArrowDown:'down',s:'down',ArrowLeft:'left',a:'left',ArrowRight:'right',d:'right'}[k];
  if(Game.mode==='dialog'){
    if(k===' '||k==='Enter'||k==='e')dlgAdvance();
    return;
  }
  if(Game.mode==='submenu'||Game.mode==='menu'){
    if(k==='Escape'||k==='q'||k==='m'||k==='M'){closeSub();closeMenu();Game.mode='field';}
    return;
  }
  if(Game.mode==='field'){
    if(dir)Eng.move(dir);
    else if(k===' '||k==='Enter'||k==='e')Eng.talk();
    else if(k==='m'||k==='M')openMenu();
    else if(k==='k'||k==='K')cloudList();
    else if(k==='l'||k==='L'){
      if(plotStage>=4){
        playerBuffs.insect=playerBuffs.insect>0?0:400;
        toast(playerBuffs.insect>0?'七十二变·小虫（敌不追，L还原）':'变回原形');
      }else toast('还不会七十二变');
    }
  }
});

/* ---------- 标题 ---------- */
function bindTitle(){
  $('tnew').addEventListener('pointerdown',()=>{
    Game.newGame();$('title').style.display='none';$('hud').style.display='flex';$('pad').style.display='block';
    fade(1);
  });
  $('tcont').addEventListener('pointerdown',()=>{
    if(Game.load()){$('title').style.display='none';$('hud').style.display='flex';$('pad').style.display='block';fade(1);}
  });
  try{if(localStorage.getItem(SKEY))$('tcont').style.display='block';}catch(e){}
}
function fade(out){const f=$('fade');f.style.opacity=out?'0':'1';}

/* ---------- 主循环 ---------- */
function loop(){
  frame++;
  if(Game.mode==='title'){const tc=$('tcv');if(tc&&tc.width)paintInk(tc.getContext('2d'),tc.width,tc.height,frame/30,PAL_DEF,true);}
  if(Eng.map){
    if(Game.mode==='field'&&!Battle.active&&frame%24===0)Eng.updateFoes();
    drawScene();
  }
  /* BGM 三态自动切换（标题/野外/战斗） */
  if(window.AUD){
    const want=Game.mode==='title'?'title':(Battle.active?'battle':'field');
    if(AUD.mode!==want)AUD.bgm(want);
  }
  hud();drawToast();drawDlg();drawBattle();
  if(toastT>0)toastT--;
  requestAnimationFrame(loop);
}

/* ---------- 对接 game.js 的剧情钩子 ---------- */
const _doAction=Game.doAction.bind(Game);
Game.doAction=function(a){
  if(a==='shop'){openShop();_doAction(a);return;}
  _doAction(a);
};
Game.shopBuy2=function(id){
  const g=Game.shopGoods().find(x=>x.id===id);
  if(!g)return;
  if(P.gold<g.price){toast('文钱不够！');return;}
  if(ITEMS[id]){P.gold-=g.price;P.items[id]=(P.items[id]||0)+1;toast('买了'+g.name);}
  else{
    if(g.type==='weapon'){
      if(P.weapon&&GEARS[P.weapon].atk>=g.atk){toast('已有更好的武器');return;}
      P.gold-=g.price;P.weapon=id;
    }else{
      if(P.armor&&GEARS[P.armor].def>=g.def){toast('已有更好的防具');return;}
      P.gold-=g.price;P.armor=id;
    }
    toast('装备 '+g.name);
  }
  Game.save();
};

bindPad();bindTitle();
setTimeout(()=>fade(1),400); /* 开机揭幕：黑→水墨标题 */
loop();
window.UI={openMenu,closeMenu,openSub,closeSub,openShop,cloudList,fade};
})();

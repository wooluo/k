/* ui.js — 场景 canvas 渲染 + DOM UI 桥接 + 主循环 */
(function(){
const $=id=>document.getElementById(id);
const CV=$('game'),CX=CV.getContext('2d');
const VW=30,VH=20;
CX.imageSmoothingEnabled=false;

/* ---------- 缩放适配 ---------- */
function fit(){
  const w=innerWidth,h=innerHeight,r=480/320;
  let cw=w,ch=w/r;if(ch>h){ch=h;cw=h*r;}
  const wr=$('wrap');wr.style.width=cw+'px';wr.style.height=ch+'px';
  CV.style.width=cw+'px';CV.style.height=ch+'px';
}
addEventListener('resize',fit);fit();

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
  CX.fillStyle='#0a0812';CX.fillRect(0,0,480,320);
  for(let ty=0;ty<VH;ty++)for(let tx=0;tx<VW;tx++){
    const mx=cx+tx,my=cy+ty;
    if(mx<0||my<0||mx>=m.w||my>=m.h)continue;
    const pat=tilePat(m.rows[my][mx],frame>>4);
    if(pat)CX.drawImage(pat,tx*16,ty*16);
  }
  /* 出口闪烁标记 */
  (m.exits||[]).forEach(e=>{
    const sx=(e.x-cx)*16,sy=(e.y-cy)*16;
    if(sx<-16||sy<-16||sx>480||sy>320)return;
    if(plotStage>=e.plot&&(frame>>3)%2===0){
      CX.fillStyle='rgba(244,196,48,.85)';
      CX.fillRect(sx+6,sy+2,4,3);CX.fillRect(sx+4,sy+6,8,3);CX.fillRect(sx+2,sy+10,12,3);
    }
  });
  /* 明雷 */
  Eng.foeSpots.forEach(f=>{
    const sx=(f.x-cx)*16,sy=(f.y-cy)*16;
    if(sx<-16||sy<-16||sx>480||sy>320)return;
    drawShadow(CX,sx+8,sy+14);
    CX.drawImage(foeCv(f.sp),sx,sy,16,16);
    CX.fillStyle='#ff5040';CX.fillRect(sx+11,sy+1,4,4);
  });
  /* NPC */
  (m.npcs||[]).forEach(n=>{
    const sx=(n.x-cx)*16,sy=(n.y-cy)*16;
    if(sx<-16||sy<-16||sx>480||sy>320)return;
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
  else Battle.act('flee');
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
  [['状态',showStatus],['物品',useItemList],['装备',gearList],['筋斗云',cloudList],['存档',()=>{Game.save();toast('已存档');}],['关闭',closeMenu]]
  .forEach(([s,fn])=>{
    const d=document.createElement('div');d.className='menu-item';d.textContent=s;
    d.addEventListener('pointerdown',e=>{e.stopPropagation();fn();});
    sl.appendChild(d);
  });
  $('sysmenu').style.display='block';
}
function closeMenu(){$('sysmenu').style.display='none';}
function showStatus(){
  openSub('状态',[{k:1}],
    ()=>`Lv${P.lv}  攻${P.atk+eqatk()}  防${P.def+eqdef()}
HP ${P.hp}/${P.hpmax}   MP ${P.mp}/${P.mpmax}
经验 ${P.exp}/${expNext(P.lv)}   文钱 ${P.gold}
武器 ${P.weapon?GEARS[P.weapon].name:'赤手空拳'}
防具 ${P.armor?GEARS[P.armor].name:'布衣'}`,
    closeSub);
}
function useItemList(){
  const its=Object.keys(P.items).filter(i=>P.items[i]>0).map(i=>({id:i,...ITEMS[i]}));
  openSub('物品（点选服用）',its.length?its:null,
    it=>it.name+'×'+P.items[it.id]+'  '+it.desc,
    it=>{useItemMenu(it.id);useItemList();});
}
function gearList(){
  const gs=Object.values(GEARS).filter(g=>g.price>0);
  openSub('装备库（背包内可换装）',[{k:1}],
    ()=>'武器：'+(P.weapon?GEARS[P.weapon].name:'无')+'   防具：'+(P.armor?GEARS[P.armor].name:'无'),
    closeSub);
}
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
  if(Eng.map){
    if(Game.mode==='field'&&!Battle.active&&frame%24===0)Eng.updateFoes();
    drawScene();
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

bindPad();bindTitle();loop();
window.UI={openMenu,closeMenu,openSub,closeSub,openShop,cloudList,fade};
})();

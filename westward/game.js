/* 主逻辑：状态·剧情机·存档（输入与渲染由 ui.js 承担） */
const SKEY='westward_save_v1';
const P={lv:1,hp:70,mp:25,hpmax:70,mpmax:25,atk:13,def:6,
  exp:0,gold:30,items:{herb:3,peach:1},weapon:null,armor:null};
const playerBuffs={insect:0};
let plotStage=0,fought={},toastMsg='',toastT=0;

function freshP(){
  const s=statsAt(1);
  Object.assign(P,{lv:1,hp:s.hp,mp:s.mp,hpmax:s.hp,mpmax:s.mp,atk:s.atk,def:s.def,
    exp:0,gold:30,items:{herb:3,peach:1},weapon:null,armor:null});
  plotStage=0;fought={};playerBuffs.insect=0;
}
const eqatk=()=>P.weapon?(GEARS[P.weapon].atk||0):0;
const eqdef=()=>P.armor?(GEARS[P.armor].def||0):0;

const Game={
  mode:'title',dlgBranch:null,dlgIdx:0,dlgNpc:null,

  newGame(){freshP();this.mode='field';Eng.start('huaguo');toast('花果山·走到瀑布口闯入！（方向键移动）');},
  load(){
    try{
      const d=JSON.parse(localStorage.getItem(SKEY));
      if(!d||!d.P)return false;
      freshP();
      Object.assign(P,d.P);plotStage=d.plot||0;fought=d.fought||{};
      Eng.visited=new Set(d.visited||['huaguo']);
      Eng.start(d.map||'huaguo',d.px,d.py);
      this.mode='field';
      return true;
    }catch(e){return false;}
  },
  save(){
    try{
      localStorage.setItem(SKEY,JSON.stringify({
        P,plot:plotStage,fought,visited:[...Eng.visited],map:Eng.mapId,
        px:Eng.player.x,py:Eng.player.y}));
    }catch(e){}
  },
  levelUp(){
    while(P.exp>=expNext(P.lv)){
      P.exp-=expNext(P.lv);P.lv++;
      const s=statsAt(P.lv);
      P.hpmax=s.hp;P.mpmax=s.mp;P.atk=s.atk;P.def=s.def;
      P.hp=P.hpmax;P.mp=P.mpmax;
      toast('升级！Lv.'+P.lv+' 气血法力全满');
    }
  },
  plotTo(n){if(plotStage<n){plotStage=n;this.save();}},

  doAction(a){
    if(a==='learn1'){this.plotTo(3);toast('拜入须菩提祖师门下！');}
    else if(a==='learn2'){this.plotTo(4);toast('悟得长生妙道、七十二变与筋斗云！');}
    else if(a==='leave'){this.plotTo(4);toast('艺成归乡！长老说后山闹妖怪…');}
    else if(a==='golearn'){this.plotTo(2);toast('长老指路：往西去寻仙访道！');}
    else if(a==='summon'){this.plotTo(8);toast('随太白金星驾云上天——南天门开了！');}
    else if(a==='getstaff'){
      P.weapon='jingu';
      const s=statsAt(P.lv);P.atk=Math.max(P.atk,s.atk);
      this.plotTo(6);P.hp=P.hpmax;
      toast('得定海神针·金箍棒！如意随心，攻+45');
    }
    else if(a==='book'){
      this.plotTo(7);P.hpmax+=50;P.hp=P.hpmax;
      toast('勾掉猴属生死簿！气血上限+50！太白金星已到花果山');
    }
    else if(a==='ragequit'){this.plotTo(9);toast('一怒反下天庭！去凌霄宝殿讨说法');}
    else if(a==='banquet'){this.plotTo(10);toast('受封齐天大圣，掌管蟠桃园（西侧瑶池）');}
    else if(a==='eattao'){
      P.hp=P.hpmax;P.mpmax+=15;P.mp=P.mpmax;this.plotTo(11);
      toast('蟠桃吃到撑！法力上限+15');
    }
    else if(a==='eatdan'){
      const s=statsAt(P.lv);
      P.hpmax=s.hp+40;P.mpmax=s.mp+40;P.atk+=6;P.def+=4;
      P.hp=P.hpmax;P.mp=P.mpmax;this.plotTo(12);
      toast('九转金丹炼成金刚不坏之躯！全属性大涨！');
    }
    else if(a==='captured'){
      this.plotTo(13);
      toast('二郎神合围，天王暗算——被擒！');
      setTimeout(()=>toast('投入八卦炉，炼了七七四十九日……'),1400);
      setTimeout(()=>toast('炼出火眼金睛！蹬倒丹炉，打上凌霄！'),2900);
      setTimeout(()=>toast('如来佛祖翻掌一扑——'),4400);
      setTimeout(()=>{Eng.start('wuzhi');toast('五行山下·五百年');this.save();},5800);
    }
    else if(a==='ending'){
      this.plotTo(14);
      toast('——西游记·大闹天宫篇 完——');
      setTimeout(()=>toast('出山小路已开，可回花果山自由游历'),2200);
    }
    else if(a==='hint_backhill'){toast('后山秘径入口在花果山北侧');}
    else if(a==='shop'){/* ui.js openShop */}
    this.save();
  },

  onBossWin(npc){
    const k=npc.dlg||'wild';
    if(k==='wild'){P.gold+=200;this.save();return;}
    if(fought[k])return;
    fought[k]=1;
    if(k==='mowang_talk'){this.plotTo(5);toast('除去混世魔王！猴孙获救！长老说…');}
    else if(k==='dragonking')toast('夜叉败退！龙王有请——再对话领神兵');
    else if(k==='yanwang')toast('阎王服软！再对话勾生死簿');
    else if(k==='jadeemp')this.doAction('captured');
    this.save();
  },

  exitBattle(win){
    this.mode='field';Battle.active=false;
    if(!win){
      toast('眼前一黑……');
      setTimeout(()=>{
        P.hp=Math.max(1,P.hpmax>>1);
        const back={shuilian:'huaguo',backhill:'huaguo',fangcun:'huaguo',sanxing:'fangcun',
          coast:'aolai',palace:'coast',hell:'coast',hellhall:'hell',
          doulv:'tianing',bimawen:'tianing',yaochi:'tianing'}[Eng.mapId]||'huaguo';
        Eng.start(back);
        toast('死里逃生，回到'+(MAPS[back].name||back));
      },900);
    }
    this.save();
  },

  shopGoods(){return SHOP.map(id=>{
    const it=ITEMS[id]||GEARS[id]||{name:id,price:0};
    return {id,...it};
  });}
};
window.Game=Game;window.P=P;

function toast(s){toastMsg=s;toastT=150;}

function dlgAdvance(){
  const b=Game.dlgBranch;
  if(!b){Game.mode='field';return;}
  if(Game.dlgIdx<b.text.length-1){Game.dlgIdx++;return;}
  Game.mode='field';const br=b;Game.dlgBranch=null;
  if(br.act)Game.doAction(br.act);
  if(br.foe){
    const npc=Game.dlgNpc||{};
    setTimeout(()=>Battle.start(br.foe,true,npc),60);
  }
}

function useItemMenu(id){
  const it=ITEMS[id];
  if(!it||!(P.items[id]>0)){toast('没有'+(it?it.name:id));return;}
  if(it.type==='hp'){P.hp=Math.min(P.hpmax,P.hp+it.val);P.items[id]--;}
  else if(it.type==='mp'){P.mp=Math.min(P.mpmax,P.mp+it.val);P.items[id]--;}
  else if(it.type==='fullhp'){P.hp=P.hpmax;P.items[id]--;}
  else if(it.type==='full'){P.hp=P.hpmax;P.mp=P.mpmax;P.items[id]--;}
  else{toast('现在用不了');return;}
  toast(it.name+' 服下');
}

/* systems.js — 妖怪图鉴 · 成就 · 技能修炼 · 万妖塔（耐玩性系统层） */
'use strict';

/* ---------- 成就 ---------- */
const ACHV=[
  {id:'first', name:'初试身手', desc:'赢得第一场战斗',       chk:s=>s.wins>=1},
  {id:'wolf10',name:'驱狼卫山', desc:'击败野狼×10',          chk:s=>(s.kills.wolf||0)>=10},
  {id:'lv5',   name:'猴王威名', desc:'修为升至 Lv5',          chk:()=>P.lv>=5},
  {id:'lv10',  name:'神通初成', desc:'修为升至 Lv10',         chk:()=>P.lv>=10},
  {id:'lv15',  name:'齐天大圣', desc:'修为升至 Lv15',         chk:()=>P.lv>=15},
  {id:'boss1', name:'除魔卫道', desc:'击败一位妖王',          chk:s=>s.bossKills>=1},
  {id:'boss3', name:'降魔无量', desc:'击败三位妖王',          chk:s=>s.bossKills>=3},
  {id:'all13', name:'妖怪收藏家',desc:'图鉴点亮全部13种妖怪', chk:s=>Object.keys(s.kills).filter(k=>s.kills[k]>0).length>=13},
  {id:'staff', name:'神兵在手', desc:'获得定海神针·金箍棒',   chk:()=>P.weapon==='jingu'},
  {id:'rich',  name:'家财万贯', desc:'持有 3000 文钱',        chk:()=>P.gold>=3000},
  {id:'spent', name:'散财童子', desc:'累计消费 2000 文',      chk:s=>s.spent>=2000},
  {id:'dead',  name:'死里逃生', desc:'战败一次（也是修行）',  chk:s=>s.deaths>=1},
  {id:'tw5',   name:'妖塔初探', desc:'万妖塔登至第5层',       chk:s=>s.maxFloor>=5},
  {id:'tw10',  name:'百尺竿头', desc:'万妖塔登至第10层',      chk:s=>s.maxFloor>=10},
  {id:'tw20',  name:'塔顶风光', desc:'万妖塔登至第20层',      chk:s=>s.maxFloor>=20},
];
const Sys={
  onWin(foeId,isBoss,foe){
    const st=P.stats||(P.stats=this.defStats());
    st.wins++;
    if(isBoss||(foe&&foe.boss))st.bossKills++;
    if(foeId)st.kills[foeId]=(st.kills[foeId]||0)+1;
    this.check();
  },
  onLose(){
    const st=P.stats||(P.stats=this.defStats());
    st.deaths++;this.check();
  },
  defStats(){return {wins:0,bossKills:0,deaths:0,spent:0,maxFloor:0,kills:{}};},
  check(){
    let n=0;
    (ACHV||[]).forEach(a=>{
      if(P.ach&&P.ach[a.id])return;
      let ok=false;
      try{ok=a.chk(P.stats||this.defStats());}catch(e){}
      if(ok){
        P.ach[a.id]=1;
        const delay=700+n*1600;
        setTimeout(()=>{toast('🏆成就·'+a.name);window.AUD&&AUD.sfx.achieve();},delay);
        n++;
      }
    });
    if(n)Game.save();
  }
};

/* ---------- 万妖塔（无尽爬塔） ---------- */
const Tower={
  floor:0,climbing:false,
  pool:['wolf','shanxiao','shrimp','crab','niutou','mamian','jiaomo','tianbing','mowang','yecha','wuchang','yanwang'],
  enter(){
    if(Battle.active)return;
    this.floor=0;this.climbing=true;
    window.AUD&&AUD.sfx.tower();
    this.next();
  },
  next(){
    this.floor++;
    const idx=Math.min(this.pool.length-1,((this.floor-1)*0.7+Math.random()*3)|0);
    const base=this.pool[idx],f=FOES[base];
    const sc=1+(this.floor-1)*0.32;
    const boss=this.floor%5===0;
    const foe={
      baseId:base,name:f.name+(boss?'·狂化':''),art:f.art,
      hp:Math.round(f.hp*sc*(boss?1.6:1)),
      atk:Math.round(f.atk*(1+(this.floor-1)*0.16)),
      def:f.def+Math.floor(this.floor*0.8),
      exp:Math.round(f.exp*(0.6+this.floor*0.15)),
      gold:Math.round(30+this.floor*35),
      skills:f.skills,boss,tower:true,
      drop:this.floor%3===0?{id:'peach',chance:1}:null
    };
    Battle.start(foe,boss,null);
  },
  stop(msg){
    const best=P.stats?P.stats.maxFloor||0:0;
    this.climbing=false;
    toast('【万妖塔】'+msg+'·本次最高第'+this.floor+'层（纪录'+best+'层）');
  }
};
window.Sys=Sys;window.Tower=Tower;

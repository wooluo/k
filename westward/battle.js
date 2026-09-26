/* 回合制战斗：指令菜单 + data.js 技能表 + 道具 + 必杀全屏演出 */
const Battle={
  active:false,foe:null,foeHP:0,foeMax:0,foeLv:1,menu:'main',sel:0,
  log:[],anim:0,bigshot:0,isBoss:false,bossNpc:null,endCB:null,shakeT:0,
  foeStun:0,foeDefD:0,myDefU:0,pendingSkill:null,turnLock:false,

  start(foeId,isBoss,npc,cb){
    const f=typeof foeId==='string'?(FOES[foeId]||FOES.wolf):foeId;
    this.foeId=typeof foeId==='string'?foeId:(foeId&&foeId.baseId)||'';
    this.foe=f;this.foeMax=f.hp;this.foeHP=f.hp;
    this.isBoss=!!(isBoss||f.boss);this.bossNpc=npc||null;this.endCB=cb||null;
    this.menu='main';this.sel=0;this.log=['遭遇 '+f.name+'！'];this.anim=0;
    this.foeStun=0;this.foeDefD=0;this.myDefU=0;this.pendingSkill=null;this.turnLock=false;this._won=false;
    this.active=true;Game.mode='battle';
    if(playerBuffs.insect>0)playerBuffs.insect=0;
  },
  push(s){this.log.push(s);if(this.log.length>8)this.log.shift();},
  skills(){return Object.keys(SKILLS).map(k=>Object.assign({id:k},SKILLS[k]))
    .filter(s=>P.lv>=s.lv)
    .map(s=>{const u=(P.skLv&&P.skLv[s.id])||1;
      return Object.assign(s,{mult:s.mult>0?+(s.mult*(1+0.12*(u-1))).toFixed(2):0,sk:u});});},
  skMult(id){const u=(P.skLv&&P.skLv[id])||1;return 1+0.12*(u-1);},
  myAtk(){return P.atk+(P.eqatk||0);},
  myDef(){return (P.def+(P.eqdef||0))*(this.myDefU>0?1.5:1);},

  act(type,arg){
    if(this.turnLock)return;
    if(type==='fight'){this.push('挥棒直击！');this.hitFoe(this.myAtk()*this.skMult('punch'),false);this.enemyTurn();}
    else if(type==='skill'){
      const s=arg;
      if(P.mp<s.mp){this.push('法力不足！');return;}
      P.mp-=s.mp;
      if(s.id==='punch'){this.push('棒击！');this.hitFoe(this.myAtk()*this.skMult('punch'),false);}
      else if(s.type==='atk'){
        if(s.id==='cloud'&&P.lv>=13&&Math.random()<0.35&&!this.foe.boss){
          this.bigshot=90;this.push('★筋斗突击撞散敌阵！');
          this.hitFoe(this.myAtk()*s.mult*1.5,false);
        }else{
          this.push(s.name+'！');this.hitFoe(this.myAtk()*s.mult,s.id==='clone');
        }
      }
      else if(s.type==='stun'){this.foeStun=2;this.push(s.name+'！'+this.foe.name+'定在原地！');}
      else if(s.type==='defdown'){this.foeDefD=3;this.push(s.name+'！看破弱点！');}
      else if(s.type==='defup'){this.myDefU=3;this.push(s.name+'！铜头铁臂！');}
      this.enemyTurn();
    }
    else if(type==='item'){
      const r=useItemB(arg);
      if(r)this.enemyTurn();else this.push('没有可用的道具');
    }
    else if(type==='flee'){
      if(this.isBoss){this.push('BOSS战无法逃跑！');return;}
      if(Math.random()<0.7){this.push('一个筋斗跑掉了！');this.finish(false,true);}
      else{this.push('没跑掉！');this.enemyTurn();}
    }
  },
  hitFoe(dmg,isCrit){
    const fd=this.foe.def*(this.foeDefD>0?0.6:1);
    let d=Math.max(3,Math.round((dmg-fd)*(0.85+Math.random()*0.3)));
    if(isCrit)d=Math.round(d*1.15);
    this.foeHP-=d;this.anim=14;this.shakeT=8;
    window.JUICE&&JUICE.dmg(d,isCrit);
    this.push(this.foe.name+'受到'+d+'伤害！'+(isCrit?'（分身齐击）':''));
    if(this.foeDefD>0)this.foeDefD--;
    if(this.foeHP<=0)this.win();
  },
  enemyTurn(){
    if(!this.active)return;
    this.turnLock=true;
    setTimeout(()=>{
      if(!this.active){this.turnLock=false;return;}
      if(this.myDefU>0)this.myDefU--;
      if(this.foeStun>0){this.foeStun--;this.push(this.foe.name+'动弹不得！');}
      else{
        const base=this.foe.atk*(this.isBoss?1:0.9);
        let d=Math.max(1,Math.round((base-this.myDef())*(0.85+Math.random()*0.3)));
        P.hp-=d;
        window.JUICE&&JUICE.hurt(d);
        this.push(this.foe.name+'反击！你受到'+d+'伤害！');
        if(P.hp<=0){this.lose();this.turnLock=false;return;}
      }
      this.turnLock=false;
    },420);
  },
  win(){
    if(this._won)return;this._won=true;
    this.turnLock=true;
    window.JUICE&&JUICE.win();
    this.push('战胜 '+this.foe.name+'！');
    P.exp+=this.foe.exp;P.gold+=this.foe.gold;
    /* 战利品掉落 */
    const dr=this.foe.drop;
    if(dr&&Math.random()<dr.chance){
      if(GEARS[dr.id]){P.gearBag[dr.id]=(P.gearBag[dr.id]||0)+1;this.push('★掉落【'+GEARS[dr.id].name+'】！');}
      else if(ITEMS[dr.id]){P.items[dr.id]=(P.items[dr.id]||0)+1;this.push('掉落'+ITEMS[dr.id].name+'！');}
    }
    window.Sys&&Sys.onWin(this.foeId,this.isBoss,this.foe);
    /* 万妖塔：不停留，下一层 */
    if(this.foe.tower&&window.Tower&&Tower.climbing){
      const st=P.stats;
      st.maxFloor=Math.max(st.maxFloor||0,Tower.floor);
      this.push('【万妖塔】第'+Tower.floor+'层通过！');
      if(Tower.floor%5===0){P.items.bantao=(P.items.bantao||0)+1;this.push('登塔奖励·蟠桃一枚！');}
      Game.levelUp();Sys.check();Game.save();
      setTimeout(()=>{
        if(Tower.climbing)Tower.next();
        else{this.active=false;Game.exitBattle(true);}
      },1500);
      return;
    }
    this.active=false;
    Game.levelUp();
    if(this.isBoss&&this.bossNpc)Game.onBossWin(this.bossNpc);
    else if(this.isBoss)Game.onBossWin({dlg:'wild'});
    Game.exitBattle(true);
  },
  lose(){
    this.active=false;
    window.Sys&&Sys.onLose();
    window.JUICE&&JUICE.lose();
    Game.exitBattle(false);
  },
  finish(){this.active=false;Game.exitBattle(true);}
};
window.Battle=Battle;

/* 战斗内道具（ITEMS 表） */
function useItemB(id){
  const it=ITEMS[id];
  if(!it||!(P.items[id]>0))return false;
  if(it.type==='hp'){P.hp=Math.min(P.hpmax,P.hp+it.val);Battle.push('服下'+it.name+'，气血+'+it.val);}
  else if(it.type==='mp'){P.mp=Math.min(P.mpmax,P.mp+it.val);Battle.push('服下'+it.name+'，法力+'+it.val);}
  else if(it.type==='fullhp'){P.hp=P.hpmax;P.mp=Math.max(P.mp,P.mpmax/2|0);Battle.push('蟠桃下肚！气血全满！');}
  else if(it.type==='full'){P.hp=P.hpmax;P.mp=P.mpmax;Battle.push('金丹入腹，周身通泰！');}
  else return false;
  P.items[id]--;return true;
}

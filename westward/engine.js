/* 探索引擎：移动·明雷·切图·对话触发·地图技能（WALKABLE 复用 maps.js 定义） */
const TK=16;
const Eng={
  map:null,mapId:'',player:null,foeSpots:[],visited:new Set(),tick:0,

  start(id,px,py){
    const m=MAPS[id];if(!m)return;
    this.map=m;this.mapId=id;this.visited.add(id);
    this.player={x:px!=null?px:(m.start?m.start.x:1),y:py!=null?py:(m.start?m.start.y:1),
      face:'down',walk:0};
    this.spawnFoes();
    /* 剧情切图钩子 */
    if(id==='shuilian'&&plotStage===0){
      plotStage=1;toast('穿越水帘！众猴拜你为「美猴王」！');
      Game.save();
    }
  },
  tile(x,y){
    const m=this.map;
    if(!m||y<0||y>=m.h||x<0||x>=m.w)return '#';
    return m.rows[y][x];
  },
  walkable(x,y){
    const t=this.tile(x,y);
    if(!WALKABLE.has(t))return false;
    if((this.map.npcs||[]).some(n=>n.x===x&&n.y===y))return false;
    return true;
  },
  move(dir){
    const p=this.player;
    p.face=dir;
    const d={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]}[dir];
    const nx=p.x+d[0],ny=p.y+d[1];
    p.walk++;
    /* 出口优先 */
    const ex=(this.map.exits||[]).find(e=>e.x===nx&&e.y===ny);
    if(ex){
      if(plotStage>=ex.plot){this.start(ex.to,ex.tx,ex.ty);Game.save();toast(ex.label||ex.to);}
      else toast('此路还不通（剧情未到）');
      return;
    }
    if(!this.walkable(nx,ny))return;
    p.x=nx;p.y=ny;
    /* 暗雷遇敌 */
    if(this.map.encounter&&Math.random()<this.map.encounter.rate&&!playerBuffs.insect){
      const mobs=this.map.encounter.mobs;
      const id=mobs[Math.random()*mobs.length|0];
      if(playerBuffs.insect<=0)Battle.start(id,false);
    }
  },
  npcAt(x,y){return (this.map.npcs||[]).find(n=>n.x===x&&n.y===y);},

  talk(){
    const p=this.player;
    const d={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]}[p.face];
    const n=this.npcAt(p.x+d[0],p.y+d[1])||this.npcAt(p.x,p.y);
    if(!n){toast('……');return;}
    /* 天兵：大闹天宫阶段直接开战 */
    if(n.foeart&&plotStage>=12&&!fought['sold_'+n.x+'_'+n.y]){
      fought['sold_'+n.x+'_'+n.y]=1;
      Battle.start(n.foeart,false,n);
      return;
    }
    const arr=DLG[n.dlg];
    let best=null;
    if(arr)for(const b of arr)if(plotStage>=b.plot)best=b;
    if(!best){toast('……');return;}
    Game.mode='dialog';Game.dlgKey=n.dlg;Game.dlgIdx=0;Game.dlgBranch=best;Game.dlgNpc=n;
  },

  /* ---------- 明雷 ---------- */
  spawnFoes(){
    this.foeSpots=[];
    const enc=this.map.encounter;
    if(!enc)return;
    const n=2+(Math.random()*3|0);
    let tries=0;
    while(this.foeSpots.length<n&&tries++<80){
      const x=Math.random()*this.map.w|0,y=Math.random()*this.map.h|0;
      if(Math.abs(x-this.player.x)<6&&Math.abs(y-this.player.y)<6)continue;
      if(!this.walkable(x,y))continue;
      const sp=enc.mobs[Math.random()*enc.mobs.length|0];
      this.foeSpots.push({x,y,sp,dx:0,dy:0});
    }
  },
  updateFoes(){
    const p=this.player;
    this.foeSpots.forEach(f=>{
      const dist=Math.abs(f.x-p.x)+Math.abs(f.y-p.y);
      if(playerBuffs.insect>0)return; /* 变身状态不追 */
      if(dist>9||dist<=0)return;
      /* 追踪：沿可走方向靠近 */
      const opts=[];
      if(f.x<p.x)opts.push([1,0]);if(f.x>p.x)opts.push([-1,0]);
      if(f.y<p.y)opts.push([0,1]);if(f.y>p.y)opts.push([0,-1]);
      if(opts.length){
        const d=opts[Math.random()*opts.length|0];
        const nx=f.x+d[0],ny=f.y+d[1];
        if(nx===p.x&&ny===p.y){ /* 接触触发战斗 */
          this.foeSpots=this.foeSpots.filter(o=>o!==f);
          Battle.start(f.sp,false);
          return;
        }
        if(this.walkable(nx,ny)&&!(this.map.npcs||[]).some(nn=>nn.x===nx&&nn.y===ny)){
          f.x=nx;f.y=ny;
        }
      }
    });
  }
};
window.Eng=Eng;

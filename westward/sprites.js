/* sprites.js — 像素精灵系统：调色板 + 人形生成器 + 敌人手绘 + tile 绘制 */
'use strict';
const PAL={
 '.':null,'k':'#101018','w':'#ffffff','W':'#e8e8e0','y':'#f4c430','Y':'#ffe680','o':'#a06a10',
 'f':'#ffd9a8','F':'#e0a878','r':'#d43d2a','R':'#8f2418','b':'#3a6ea5','B':'#1f4a7d',
 'g':'#4a8f3c','G':'#2c6428','p':'#f090c0','c':'#58c8d8','C':'#2a88a0','d':'#4a4a52',
 'D':'#26262e','e':'#7a5a30','s':'#c0c0c8','v':'#8a2be2','m':'#ff8c00','n':'#2a1a0e',
 't':'#d4b483','z':'#804020','l':'#68c060','L':'#185818','h':'#f5f0e0','q':'#403048'
};
function mkcv(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function px(ctx,x,y,col){ctx.fillStyle=col;ctx.fillRect(x,y,1,1);}
function pxr(ctx,x,y,w,h,col){ctx.fillStyle=col;ctx.fillRect(x,y,w,h);}
function fromRows(rows,scale){ // 字符画→canvas
  const h=rows.length,w=rows[0].length,c=mkcv(w*scale,h*scale),x=c.getContext('2d');
  for(let j=0;j<h;j++)for(let i=0;i<w;i++){const col=PAL[rows[j][i]];if(col){pxr(x,i*scale,j*scale,scale,scale,col);}}
  return c;
}
/* ============ 人形生成器（16×16，4方向×2帧） ============ */
function humanoid(o){
  // o: hair,hair2(暗部),skin,cloth,cloth2,band(额饰色),beard,ears,tail
  const F={};
  ['down','up','left','right'].forEach(dir=>{
    F[dir]=[0,1].map(fr=>{
      const cv=mkcv(16,16),x=cv.getContext('2d');
      const H=o.hair,H2=o.hair2||o.hair,S=o.skin,C=o.cloth,C2=o.cloth2||o.cloth;
      const bob=fr===1?1:0;
      // 耳（猴耳）
      if(o.ears){pxr(x,2,4+bob,2,2,H);pxr(x,12,4+bob,2,2,H);px(x,3,5+bob,H2);px(x,12,5+bob,H2);}
      // 头 y1..7
      pxr(x,4,1+bob,8,7,H);           // 毛顶
      pxr(x,3,2+bob,10,5,H);           // 侧毛
      pxr(x,4,6+bob,8,2,H2);           // 毛下沿
      if(dir==='down'||dir==='left'||dir==='right'){
        const fx = dir==='down'?5:6, fw = dir==='down'?6:4; // 脸区
        pxr(x,fx,4+bob,fw,3,S);
        if(dir==='down'){px(x,6,5+bob,'#101018');px(x,9,5+bob,'#101018');}
        else if(dir==='left'){px(x,5,5+bob,'#101018');pxr(x,3,4+bob,2,3,S);}
        else {px(x,10,5+bob,'#101018');pxr(x,11,4+bob,2,3,S);}
        pxr(x,6,7+bob,4,1,'#c89060'); // 嘴
        if(o.beard){pxr(x,5,6+bob,6,4,o.beard);pxr(x,4,7+bob,8,2,o.beard);px(x,7,5+bob,'#101018');px(x,8,5+bob,'#101018');}
      } else { // up 后脑勺全毛
        pxr(x,4,4+bob,8,4,H2);
      }
      if(o.band){pxr(x,3,3+bob,10,1,o.band);px(x,3,3+bob,o.band);px(x,12,3+bob,o.band);} // 金箍
      // 身 y8..12
      pxr(x,4,8+bob,8,5,C);
      pxr(x,4,12+bob,8,1,C2);
      pxr(x,5,9+bob,1,3,C2);pxr(x,10,9+bob,1,3,C2); // 衣纹
      // 手臂
      px(x,3,9+bob,S);px(x,12,9+bob,S);px(x,3,10+bob,S);px(x,12,10+bob,S);
      // 腿 y13..15
      if(fr===0){pxr(x,5,13,2,3,'#302838');pxr(x,9,13,2,3,'#302838');}
      else {pxr(x,5,13,2,2,'#302838');pxr(x,6,14,1,1,'#302838');pxr(x,9,14,2,2,'#302838');px(x,10,13,1,1,'#302838');}
      // 猴尾
      if(o.tail){
        if(dir==='left'){px(x,13,10+bob,H);px(x,14,9+bob,H);px(x,14,8+bob,H2);}
        else if(dir==='right'){px(x,2,10+bob,H);px(x,1,9+bob,H);px(x,1,8+bob,H2);}
        else {px(x,15,11+bob,H);px(x,15,10+bob,H2);}
      }
      return cv;
    });
  });
  return F;
}
/* ============ 角色定义 ============ */
const SPRITES={};
SPRITES.wukong = humanoid({hair:'#f4c430',hair2:'#c89010',skin:'#ffd9a8',cloth:'#d43d2a',cloth2:'#8f2418',band:'#ffd040',ears:true,tail:true});
SPRITES.elder  = humanoid({hair:'#e8e8e0',hair2:'#a8a8a0',skin:'#e0a878',cloth:'#5860a8',cloth2:'#384078',beard:'#ffffff',ears:true,tail:true});
SPRITES.monkey = humanoid({hair:'#a06a10',hair2:'#7a4e08',skin:'#ffd9a8',cloth:'#c88a3a',cloth2:'#9a6820',ears:true,tail:true});
SPRITES.smallmk= humanoid({hair:'#c8843a',hair2:'#9a6020',skin:'#ffd9a8',cloth:'#68a84a',cloth2:'#4a8030',ears:true,tail:true});
SPRITES.civil  = humanoid({hair:'#3a3430',hair2:'#262220',skin:'#ffd9a8',cloth:'#7a8aa8',cloth2:'#5a6890'});
SPRITES.civilf = humanoid({hair:'#5a3820',hair2:'#402818',skin:'#ffe0b8',cloth:'#d87898',cloth2:'#a85878'});
SPRITES.merch  = humanoid({hair:'#3a3430',hair2:'#262220',skin:'#ffd9a8',cloth:'#4a8f3c',cloth2:'#2c6428'});
SPRITES.guard  = humanoid({hair:'#8a8a92',hair2:'#5a5a64',skin:'#e0a878',cloth:'#8f2418',cloth2:'#5a1810'});
SPRITES.fisher = humanoid({hair:'#2a2a30',hair2:'#1a1a20',skin:'#e8b088',cloth:'#4888b8',cloth2:'#306898'});
SPRITES.turtle = humanoid({hair:'#4a8f3c',hair2:'#2c6428',skin:'#a8d8a0',cloth:'#3a6a30',cloth2:'#285020'});
SPRITES.dragonk= humanoid({hair:'#58c8d8',hair2:'#2a88a0',skin:'#d8f0f8',cloth:'#d4a020',cloth2:'#a07810',beard:'#e8f8ff',ears:true});
SPRITES.shrimp = humanoid({hair:'#e86848',hair2:'#b04028',skin:'#f8b8a0',cloth:'#c84830',cloth2:'#983020',ears:true});
SPRITES.crab   = humanoid({hair:'#c03028',hair2:'#8a2018',skin:'#e88878',cloth:'#a02820',cloth2:'#781812',ears:true});
SPRITIES_UNUSED:0;
SPRITES.oxhead = humanoid({hair:'#6a5a4a',hair2:'#4a3e32',skin:'#d8c0a8',cloth:'#3a3430',cloth2:'#26221e'});
SPRITES.horsef = humanoid({hair:'#c8c0b0',hair2:'#988878',skin:'#e8d8c0',cloth:'#3a3430',cloth2:'#26221e'});
SPRITES.wuchang= humanoid({hair:'#e8e8e0',hair2:'#b0b0a8',skin:'#f0f0e8',cloth:'#1a1a22',cloth2:'#0c0c12'});
SPRITES.voider = humanoid({hair:'#8a2be2',hair2:'#5a1a9a',skin:'#d8c0f0',cloth:'#3a1a5a',cloth2:'#281240'});
SPRITES.taibai = humanoid({hair:'#e8e8e0',hair2:'#b0b0a8',skin:'#ffe0b8',cloth:'#f0f0e8',cloth2:'#c0c0b0',beard:'#ffffff'});
SPRITES.moonbg = humanoid({hair:'#403850',hair2:'#302838',skin:'#e0c0d8',cloth:'#8a5aa8',cloth2:'#6a4088'});
SPRITES.puti    = humanoid({hair:'#e8f0e0',hair2:'#a8c0a0',skin:'#ffe0c0',cloth:'#3a6a58',cloth2:'#28483a',beard:'#f0f8e8'});
SPRITES.jadeemp = humanoid({hair:'#f0d060',hair2:'#c8a020',skin:'#ffe8c8',cloth:'#f4c430',cloth2:'#c89010',beard:'#ffe680'});
SPRITES.laojun  = humanoid({hair:'#f0f0e8',hair2:'#c0c0b0',skin:'#ffe0b8',cloth:'#c83a28',cloth2:'#8f2418',beard:'#ffffff'});
SPRITES.tianma  = humanoid({hair:'#f8f8f4',hair2:'#d0d0c8',skin:'#f0e8d8',cloth:'#f8f8f4',cloth2:'#d8d8cc',tail:true});
SPRITES.tianbingNPC = humanoid({hair:'#a8b8d8',hair2:'#7888a8',skin:'#ffd9a8',cloth:'#b8c8e8',cloth2:'#8898c0',band:'#f4c430'});
/* ============ 敌人战斗立绘（16×16 字符画 ×8 放大到128） ============ */
const FOE_ART={
wolf:[
"................","......kkkkk.....",".....kdddddK....","....kdddddddk...",
"....kdWkddddk...","....kdddddkdk...",".....kddddd.k...","..k..kddddk.....",
".kdk..kddk......",".kddkkkdkk......","..kdddddik......","...kddddk.......",
"....kddk........","...kdk.kdk......","..kdk...kdk.....","..kk.....kk....."
].map(s=>s.replace(/K/g,'k')),
shanxiao:[
"................","....kkkkkkkk....","...kvvvvvvvvk...","..kvvWkvvkWvvk..",
"..kvvvvvvvvvvk..","..kvvkvvvvkvvk..","..kvvvkkkkvvvk..","...kvvvvvvvvk...",
"....kvvvvvvk....","..kkvrrrrvkk....",".kvvrRrrRrvvk...",".kv.rrrrrr.vk...",
"....rRrrrrRr....","....rrr..rrr....","...kdk....kdk...","...kk......kk..."
],
mowang:[ // 混世魔王
"................","...kkkkkkkkkk...","..kvvvvvvvvvvk..",".kvvYkvvvvkYvvk.",
".kvvvvvvvvvvvvk.",".kvvmkvvvvmkvvk.",".kvvvkvvvvkvvvk.","..kvvkkkkkkvvk..",
".kvrrrrrrrrrrvk.","kvvrRrrrrrrRrvvk","kv.rrmmmmmmrr.vk","k..rrmrrrrmrr..k",
"...rrrrrrrrrr...","...rrrR..Rrrr...","..kddk....kddk..","..kdk......kdk.."
],
shrimp:[
"................","......kkkk......",".....kmmmmk.....","....kmWkmWmk....",
"....kmmmmmmk....","....kmkkkmmk....",".....kmmmmk.....","...kkkmmmmkkk...",
"..kmrmkmmmkmrmk.",".kmmrmmmmmmrmmk.",".km.mmrrrrmm.mk.","....mmrrrrmm....",
".....mmmmmm.....","....kmm..mmk....","...kdk....kdk...","................"
],
crab:[
"................",".kk..........kk.","kss..........ssk",".ks.kkkkkkkk.sk.",
"..kssssssssssk..","..ksWksskWssk...","..ksssssssssk...","...ksskkskssk...",
"..kssssssssssk..",".kssksssssskssk.","ksk.kssssssk.ksk","ks..kssssssk..sk",
".k.kssssssssk.k.","...kssk..kssk...","...kkk....kkk...","................"
],
yecha:[ // 巡海夜叉
"................","....kkkkkkkk....","...kCCCCCCCCk...","..kCCkCCCkCCCk..",
"..kCCCCCCCCCCk..","..kCCCkkkkCCCk..","...kCCCCCCCCk...","..kCCCCCCCCCCk..",
".kCCcCCCCCCcCCk.",".kC.cCCCCCCc.Ck.","....cCCCCCCc....","....CCCCCCCC....",
"...kCCC..CCCk...","...kCCk..kCCk...","..kdk......kdk..","................"
],
niutou:[
"................","..kk........kk..",".kzzk......kzzk.",".kzzkkkkkkkzzk..",
"..kzzzzzzzzzk...","..kzWkzzzkWzk...","..kzzzzzzzzzk...","..kzzknnnkzzk...",
"...kzzzzzzzk....","..kkzzzzzzzkk...",".kz.kzzzzzk.zk..","kzzkzDDDDzkzzk..",
"kz.kzzDDzzk.zk..","...kzzzzzzzk....","...kzzk.kzzk....","...kk....kk....."
],
mamian:[
"................",".....kkkkkk.....","....khhhhhk.....","...khhkhhkhhk...",
"...khhhhhhhhk...","k..khhhkhhhk..k.","kk.khhhhhhhhk.kk","khk.khhkkhhk.khk",
"khh..khhhhk..hhk",".k...khhhhk...k.","....khhhhhhk....","...khhDDDDhhk...",
"...khhhDDhhh....","....khhhhhhk....","....kdk..kdk....","................"
],
wuchang:[
"................",".....kkkkkk.....","....khhhhhhk....","...khhkhhkhhk...",
"...khhhhhhhhk...","...khhhkkhhhk...","....khhhhhhk....","...kkhhhhhhkk...",
"..khqqhhhhqqhk..",".khq.qhhhhq.hk..",".kh..hhhhhh..hk.",".k..khhhhhhk..k.",
"....khhhhhhk....","....khh..hhk....","...kdk....kdk...","................"
],
yanwang:[ // 阎罗王
"................",".....yyyyyy.....","....yYyyyyYy....","....kyyyyyyk....",
"...kyWkyykWky...","...kyyyyyyyyk...","...kyyykkyyyk...","....kyyyyyyk....",
"..kkrrrrrrrkk...",".kyrrRrrrRrryk..",".kyrrrrrrrrryk..",".ky.rrmmmmrr.yk.",
"..k.rrmrrmrr.k..","....rrrrrrrr....","....rrR..Rrr....","...kdk....kdk..."
],
jiaomow:[ // 蛟龙（龙宫BOSS备用）
"................","......kkkk......",".....kCCCCk.....","....kCkCCkCk....",
"....kCCCCCCk....","....kCCkkCCk....","kk...kCCCCk...kk","kCk..kCCCCk..kCk",
".kCkkCCCCCCkkCk.","..kCCCCCCCCCC...","...kCCk..kCCC...","...kCCk..kCCCk..",
"..kCCk....kCCk..",".kCCk......kCCk.",".kCk........kCk.","................"
],
tianbing:[
"................","......ssss......",".....skssks.....","....kssssssk....",
"....ksWksWsk....","....kssssssk....",".....skssks.....","....kssssssk....",
"...kskkkkkks....","..kskssssssks...",".ks.skkkkks.sk..",".k..kssssssk..k.",
"....kssssssk....","....kssk.kssk...","...kdk....kdk...","................"
]
};
/* K→k 清洗外的兜底：直接替换非法字符 */
Object.keys(FOE_ART).forEach(k=>{
  FOE_ART[k]=FOE_ART[k].map(r=>r.split('').map(ch=>PAL[ch]!==undefined?ch:'.').join(''));
});
const FOE_CV={}; // 名字→128px canvas 缓存
function foeCv(name){
  if(FOE_CV[name])return FOE_CV[name];
  const art=FOE_ART[name]||FOE_ART.wolf;
  FOE_CV[name]=fromRows(art,8);
  return FOE_CV[name];
}
/* ============ Tile 绘制（16×16，部分带2帧动画） ============ */
const TS=16;
const TILES={};
function tilePat(ch,frame){
  const key=ch+'_'+frame;
  if(TILES[key])return TILES[key];
  const cv=mkcv(TS,TS),x=cv.getContext('2d');
  const grass=(g1,g2)=>{pxr(x,0,0,16,16,g1);[[2,3],[6,8],[12,2],[9,13],[14,10],[4,12]].forEach(p=>px(x,p[0],p[1],g2));px(x,1,7,g2);px(x,11,6,g2);px(x,7,14,g2);};
  const sand=()=>{pxr(x,0,0,16,16,'#d8c090');[[3,4],[9,2],[13,9],[5,12],[11,13]].forEach(p=>px(x,p[0],p[1],'#c0a870'));px(x,7,7,'#c0a870');};
  const wallRock=(c1,c2,c3)=>{pxr(x,0,0,16,16,c1);pxr(x,0,0,16,1,c2);pxr(x,0,0,1,16,c2);pxr(x,0,15,16,1,c3);pxr(x,15,0,1,16,c3);pxr(x,3,5,5,1,c2);pxr(x,4,4,1,3,c2);pxr(x,9,9,4,1,c3);pxr(x,10,8,1,3,c3);pxr(x,11,3,3,1,c3);};
  const floor=(c1,c2)=>{pxr(x,0,0,16,16,c1);pxr(x,0,0,16,1,c2);pxr(x,0,0,1,16,c2);pxr(x,0,8,16,1,c2);pxr(x,8,0,1,16,c2);};
  switch(ch){
    case '.': grass('#3a7a34','#2c6428'); break;
    case ',': grass('#2a5c24','#1c4418'); pxr(x,3,4,1,4,'#4a8a3a');pxr(x,4,3,1,2,'#4a8a3a');pxr(x,11,8,1,5,'#4a8a3a');pxr(x,12,7,1,3,'#4a8a3a');pxr(x,7,12,1,3,'#4a8a3a'); break;
    case '"': grass('#3a7a34','#2c6428'); pxr(x,4,4,2,2,'#f090c0');px(x,4,4,'#fff');pxr(x,10,9,2,2,'#fff');px(x,11,9,'#f4c430');px(x,6,11,'#f090c0');px(x,12,3,'#fff'); break;
    case ':': pxr(x,0,0,16,16,'#a8865a');[[3,3],[10,5],[6,10],[12,12],[2,13]].forEach(p=>px(x,p[0],p[1],'#8a6a40'));px(x,8,2,'#8a6a40');px(x,4,8,'#c0a070');px(x,14,7,'#c0a070'); break;
    case 'T': grass('#3a7a34','#2c6428'); pxr(x,6,10,4,6,'#6a4a20');pxr(x,2,1,12,9,'#2c6428');pxr(x,3,0,10,3,'#1c4418');pxr(x,4,3,8,5,'#4a8f3c');px(x,5,2,'#4a8f3c');px(x,10,4,'#4a8f3c');pxr(x,1,4,2,4,'#2c6428');pxr(x,13,4,2,4,'#2c6428');px(x,7,6,'#185818');px(x,4,8,'#185818'); break;
    case 'P': grass('#3a7a34','#2c6428'); pxr(x,6,10,4,6,'#6a4a20');pxr(x,2,0,12,10,'#e87ab8');pxr(x,4,2,8,6,'#f0a0c8');px(x,4,1,'#f090c0');px(x,11,3,'#f090c0');px(x,6,4,'#fff');px(x,10,6,'#fff');px(x,3,6,'#d85898');px(x,9,8,'#d85898'); break;
    case '~': pxr(x,0,0,16,16,'#2858a8'); pxr(x,0,frame===0?4:8,16,1,'#4878c8');pxr(x,0,frame===0?11:6,16,1,'#4878c8');px(x,3,frame===0?2:9,'#78a8e8');px(x,12,frame===0?13:3,'#78a8e8'); break;
    case '=': pxr(x,0,0,16,16,'#88b8e0'); for(let i=0;i<4;i++)pxr(x,i*4+(frame===0?0:2),0,2,16,'#c8e8f8'); pxr(x,0,(frame===0?2:5),16,2,'#ffffff');pxr(x,0,(frame===0?12:9),16,2,'#e8f8ff'); break;
    case '#': wallRock('#6a6a72','#8a8a92','#4a4a52'); break;
    case 's': sand(); break;
    case 'o': sand(); pxr(x,3,6,10,7,'#8a8a92');pxr(x,4,5,8,1,'#a8a8b0');pxr(x,5,13,7,1,'#5a5a64');px(x,5,8,'#a8a8b0');px(x,10,10,'#5a5a64'); break;
    case 'B': pxr(x,0,0,16,16,'#8a6838'); for(let i=0;i<4;i++)pxr(x,i*4,0,1,16,'#6a4a20'); pxr(x,0,1,16,2,'#a88450');pxr(x,0,12,16,1,'#6a4a20'); break;
    case 'W': wallRock('#3a2a4a','#54406a','#281c34'); break;
    case '_': floor('#4a3a58','#3a2c46'); break;
    case 'f': wallRock('#3a2a4a','#54406a','#281c34'); pxr(x,7,4,2,6,'#6a4a20'); pxr(x,5,(frame===0?0:1),6,4,frame===0?'#ff8c00':'#ffd040'); px(x,6,frame===0?1:2,'#ffe680');px(x,9,frame===0?2:3,'#ff5a20'); break;
    case 't': floor('#4a3a58','#3a2c46'); pxr(x,2,3,12,9,'#7a5a30');pxr(x,3,4,10,7,'#a8824a');pxr(x,2,3,12,1,'#c09058');pxr(x,2,11,12,1,'#5a4020'); break;
    case 'S': floor('#4a3a58','#3a2c46'); pxr(x,4,1,8,13,'#c8a020');pxr(x,5,2,6,2,'#ffe680');pxr(x,3,1,1,13,'#8a6a10');pxr(x,12,1,1,13,'#8a6a10');pxr(x,5,5,6,3,'#d43d2a');pxr(x,6,6,4,1,'#ffe680'); break;
    case 'J': floor('#4a3a58','#3a2c46'); pxr(x,7,8,2,7,'#c89030');pxr(x,7,8,2,1,'#ffe680');pxr(x,4,(frame===0?2:4),8,6,frame===0?'rgba(255,230,130,.35)':'rgba(255,230,130,.18)');px(x,7,5,'#fff');px(x,8,6,'#ffe680'); break;
    case 'L': floor('#3a3040','#2c2434'); pxr(x,2,4,12,9,'#7a5a30');pxr(x,3,2,10,4,'#e8e0c8');pxr(x,3,2,10,1,'#fff');px(x,5,4,'#8a2020');px(x,8,4,'#8a2020');px(x,11,4,'#8a2020');pxr(x,3,5,10,1,'#b0a888'); break;
    case 'p': pxr(x,0,0,16,16,'#3050a0');pxr(x,0,0,8,8,'#3a60b8');pxr(x,8,8,8,8,'#3a60b8');px(x,3,3,'#f4c430');px(x,11,11,'#f4c430');pxr(x,0,7,16,1,'#244080');pxr(x,7,0,1,16,'#244080'); break;
    case 'w': pxr(x,0,0,16,16,'#d8d8e0');pxr(x,0,0,16,1,'#b8b8c8');pxr(x,0,0,1,16,'#b8b8c8');pxr(x,8,0,1,8,'#b8b8c8');pxr(x,0,8,8,1,'#b8b8c8'); break;
    case 'R': pxr(x,0,0,16,16,'#7a7a84');pxr(x,0,0,16,2,'#9a9aa4');pxr(x,0,5,16,1,'#4a4a54');pxr(x,0,11,16,1,'#4a4a54');pxr(x,5,0,1,5,'#4a4a54');pxr(x,11,5,1,6,'#4a4a54');pxr(x,3,11,1,5,'#4a4a54');pxr(x,9,11,1,5,'#4a4a54'); break;
    case 'h': pxr(x,0,0,16,16,'#8a3a28');for(let j=0;j<4;j++)pxr(x,0,j*4,16,1,'#6a2a1c');pxr(x,frame===0?3:4,0,1,16,'#a84c34');pxr(x,frame===0?11:12,0,1,16,'#a84c34'); break;
    case 'd': pxr(x,0,0,16,16,'#6a4a20');pxr(x,2,2,12,14,'#8a6838');pxr(x,2,2,12,2,'#a88450');px(x,11,9,'#f4c430');pxr(x,2,8,12,1,'#6a4a20'); break;
    case 'G': floor('#2c2434','#241c2c'); pxr(x,6,(frame===0?4:6),4,7,frame===0?'#58e858':'#38b838');px(x,7,(frame===0?3:5),'#a8ffa8');px(x,8,(frame===0?7:9),'#a8ffa8');px(x,6,(frame===0?9:11),'#2a882a'); break;
    case 'x': pxr(x,0,0,16,16,'#2c2434');pxr(x,7,2,2,12,'#4a3a2a');pxr(x,3,5,4,1,'#4a3a2a');pxr(x,4,4,1,3,'#4a3a2a');pxr(x,10,8,4,1,'#4a3a2a');pxr(x,13,6,1,3,'#4a3a2a');px(x,7,2,'#5a4a3a'); break;
    case 'c': floor('#3050a0','#244080'); pxr(x,5,3,2,10,'#f090c0');pxr(x,4,5,4,6,'#f0a0c8');pxr(x,9,2,2,9,'#a870e0');pxr(x,8,4,4,5,'#c890f0');px(x,6,3,'#fff');px(x,10,2,'#fff'); break;
    case 'q': floor('#3050a0','#244080'); pxr(x,3,8,10,5,'#c8c8d0');pxr(x,4,7,8,1,'#e8e8f0');px(x,7,5,'#fff');px(x,8,4,'#ffe680');px(x,7,3,'#fff');pxr(x,5,6,2,2,'#a8e8f0'); break;
    case 'n': grass('#3a7a34','#2c6428'); pxr(x,6,0,1,14,'#58a848');pxr(x,9,2,1,12,'#489840');pxr(x,3,3,4,1,'#68c060');pxr(x,4,2,1,3,'#68c060');pxr(x,10,5,4,1,'#68c060');pxr(x,12,3,1,4,'#68c060');pxr(x,2,9,4,1,'#68c060'); break;
    case '*': grass('#3a7a34','#2c6428'); pxr(x,3,3,10,10,'#8a8a92');pxr(x,4,2,8,12,'#a8a8b0');pxr(x,5,4,6,6,'#c8c8d0');px(x,6,5,'#e8e8f0');px(x,7,6,'#fff'); break;
    case '!': grass('#3a7a34','#2c6428'); pxr(x,7,0,2,16,'#c8c8d0');pxr(x,9,1,4,5,'#d43d2a');pxr(x,9,2,2,1,'#ffe680'); break;
    case 'm': grass('#3a7a34','#2c6428'); pxr(x,5,8,6,5,'#d43d2a');pxr(x,4,7,8,2,'#e85838');pxr(x,7,5,2,2,'#f0f0e8');px(x,7,6,'#101018');px(x,8,6,'#101018');pxr(x,6,13,1,2,'#f0f0e8');pxr(x,9,13,1,2,'#f0f0e8'); break;
    case 'e': grass('#3a7a34','#2c6428'); pxr(x,6,4,4,10,'#7a5a30');pxr(x,5,3,6,3,'#8a6a3a');px(x,7,2,'#68c060');px(x,8,1,'#68c060'); break;
    /* ---- 天庭/仙境扩展 tile ---- */
    case 'X': pxr(x,0,0,16,16,'#d8d8f0');pxr(x,0,0,16,1,'#eeeef8');pxr(x,0,0,1,16,'#eeeef8');pxr(x,8,0,1,8,'#c0c0e0');pxr(x,0,8,8,1,'#c0c0e0'); if(frame===1){px(x,3,3,'#fff');px(x,12,11,'#fff');} break; // 云砖
    case 'I': pxr(x,0,0,16,16,'#38b8c8');pxr(x,0,frame===0?3:6,16,1,'#90f0f8');pxr(x,0,frame===0?10:7,16,1,'#90f0f8');px(x,4,frame===0?2:9,'#e0ffff');px(x,11,frame===0?13:3,'#e0ffff');pxr(x,6,6,4,1,'#c0f8ff'); break; // 瑶池仙水(发光,可走)
    case 'O': pxr(x,0,0,16,16,'#e8e8f4'); pxr(x,6,10,4,6,'#7a5a30'); pxr(x,1,0,14,10,'#f090c0');pxr(x,3,1,10,7,'#f8b8d8'); px(x,3,2,'#ffd9a8');px(x,5,4,'#ffd9a8');px(x,9,3,'#ffd9a8');px(x,12,5,'#ffd9a8');px(x,4,7,'#d85898');px(x,11,8,'#d85898');pxr(x,2,9,12,1,'#d85898'); break; // 蟠桃仙树
    case 'A': pxr(x,0,0,16,16,'#6a5a9a'); pxr(x,3,1,10,14,'#5a4a88'); pxr(x,4,2,8,13,'#8a2be2'); pxr(x,6,4,4,11,'#2a1a4a'); pxr(x,7,3,3,3,'#ffe680');px(x,8,4,'#fff');px(x,7,5,'#ffd040'); // 斜月三星洞门(月牙)
      pxr(x,3,1,10,1,'#a890e0');pxr(x,3,1,1,14,'#a890e0');pxr(x,12,1,1,14,'#a890e0'); break;
    case 'N': pxr(x,0,0,16,16,'#d8d8f0'); pxr(x,1,2,2,14,'#c8a020');pxr(x,13,2,2,14,'#c8a020');pxr(x,1,2,14,2,'#e0b830'); pxr(x,0,1,16,2,'#8a6a10');pxr(x,0,4,16,2,'#a02020');pxr(x,2,5,12,1,'#ffe680');px(x,5,4,'#ffe680');px(x,10,4,'#ffe680'); pxr(x,7,4,2,12,'#c8a020'); break; // 南天门牌坊
    case 'E': pxr(x,0,0,16,16,'#d8d8f0'); pxr(x,1,1,14,14,'#f0c030');pxr(x,2,2,12,12,'#ffd960'); pxr(x,3,3,10,4,'#d43d2a');pxr(x,4,4,8,2,'#8f2418'); pxr(x,3,8,10,6,'#e8a820');pxr(x,5,9,6,4,'#c08810');px(x,7,10,'#ffe680');px(x,9,11,'#ffe680'); pxr(x,1,1,14,1,'#fff0a0');pxr(x,1,1,1,14,'#fff0a0'); break; // 凌霄宝殿金顶
    case 'U': pxr(x,0,0,16,16,'#d8d8f0'); pxr(x,4,6,8,8,'#8a6a3a');pxr(x,5,5,6,1,'#a8824a');pxr(x,3,8,10,5,'#a07838'); pxr(x,6,7,4,1,'#6a4a20');pxr(x,4,10,8,1,'#6a4a20'); pxr(x,4,3,8,3,frame===0?'#ff8c00':'#ffd040');pxr(x,6,frame===0?1:2,4,3,frame===0?'#ffd040':'#ff8c00');px(x,7,frame===0?0:1,'#fff0a0');px(x,9,3,'#fff0a0'); break; // 八卦丹炉(火焰动画)
    case 'M': pxr(x,0,0,16,16,'#d8d8f0'); pxr(x,2,4,12,3,'#8a6838');pxr(x,2,4,12,1,'#a88450'); pxr(x,2,7,1,7,'#6a4a20');pxr(x,7,7,1,7,'#6a4a20');pxr(x,12,7,1,7,'#6a4a20'); pxr(x,4,9,2,1,'#68c060');px(x,5,8,'#68c060');pxr(x,9,10,3,1,'#d8c060'); break; // 御马监马厩
    case 'V': pxr(x,0,0,16,16,'#a89070'); pxr(x,2,0,12,16,'#8a7050');pxr(x,3,0,2,16,'#a89068');pxr(x,8,0,2,16,'#c0a878');pxr(x,11,0,1,16,'#6a5840'); pxr(x,1,0,1,16,'#5a4830');pxr(x,14,0,1,16,'#5a4830');pxr(x,0,4,16,1,'#6a5840');pxr(x,0,11,16,1,'#6a5840'); break; // 五指山巨柱
    case 'K': pxr(x,0,0,16,16,'#d8d8f0'); pxr(x,7,8,2,8,'#6a5a30'); pxr(x,2,0,12,9,'#2c6428');pxr(x,4,1,8,6,'#4a8f3c');px(x,5,2,'#68c060');px(x,10,3,'#68c060');px(x,7,5,'#185818');px(x,3,7,'#185818');px(x,12,6,'#185818'); px(x,4,3,'#f4c430');px(x,11,2,'#f4c430'); break; // 仙桂树
    default: grass('#3a7a34','#2c6428');
  }
  TILES[key]=cv;return cv;
}
/* 阴影 */
function drawShadow(ctx,px_,py){
  ctx.fillStyle='rgba(0,0,0,.3)';
  ctx.beginPath();ctx.ellipse(px_+8,py+15,6,2.5,0,0,7);ctx.fill();
}

/* data.js — 敌人、技能、道具、装备、数值表 */
'use strict';
const FOES={
  wolf:    {name:'野狼',art:'wolf',hp:28,atk:11,def:3,exp:7,gold:6,skills:['咬'],drop:{id:'herb',chance:.15}},
  shanxiao:{name:'山魈',art:'shanxiao',hp:46,atk:15,def:5,exp:15,gold:12,skills:['抓挠'],drop:{id:'herb',chance:.2}},
  mowang:  {name:'混世魔王',art:'mowang',hp:220,atk:22,def:8,exp:130,gold:220,skills:['劈砍','黑风'],boss:true,drop:{id:'bantao',chance:1}},
  shrimp:  {name:'虾兵',art:'shrimp',hp:58,atk:17,def:7,exp:22,gold:18,skills:['刺击'],drop:{id:'pill',chance:.2}},
  crab:    {name:'蟹将',art:'crab',hp:95,atk:21,def:13,exp:40,gold:35,skills:['钳击','吐泡'],drop:{id:'peach',chance:.18}},
  yecha:   {name:'巡海夜叉',art:'yecha',hp:260,atk:27,def:12,exp:190,gold:320,skills:['叉击','水箭'],boss:true,drop:{id:'fork',chance:1}},
  niutou:  {name:'牛头',art:'niutou',hp:120,atk:26,def:12,exp:62,gold:0,skills:['撞角'],drop:{id:'herb',chance:.25}},
  mamian:  {name:'马面',art:'mamian',hp:120,atk:26,def:12,exp:62,gold:0,skills:['踢踏'],drop:{id:'herb',chance:.25}},
  wuchang: {name:'黑白无常',art:'wuchang',hp:380,atk:32,def:15,exp:320,gold:0,skills:['勾魂','锁链'],boss:true,drop:{id:'wurobe',chance:1}},
  yanwang: {name:'阎罗王',art:'yanwang',hp:680,atk:34,def:18,exp:520,gold:0,skills:['判笔','冥火'],boss:true,drop:{id:'judge',chance:1}},
  jiaomo:  {name:'蛟魔王',art:'jiaomow',hp:150,atk:24,def:10,exp:100,gold:150,skills:['缠绞','水柱'],boss:true,drop:{id:'peach',chance:.6}},
  tianbing:{name:'天兵',art:'tianbing',hp:100,atk:28,def:16,exp:80,gold:60,skills:['枪击'],drop:{id:'pill',chance:.15}},
  erlang:  {name:'二郎神杨戬',art:'erlang',hp:900,atk:40,def:22,exp:999,gold:0,skills:['三尖两刃','哮天犬','天眼'],boss:true,drop:{id:'sanjian',chance:1}}
};
const SKILLS={
  punch:  {name:'棒击',mp:0,mult:1.0,type:'atk',lv:1,desc:'挥棒痛击，不耗法力'},
  smash:  {name:'猛击',mp:5,mult:1.7,type:'atk',lv:2,desc:'蓄力重击 1.7倍伤害'},
  clone:  {name:'身外身法',mp:10,mult:2.3,type:'atk',lv:5,desc:'拔毫毛化分身 2.3倍伤害'},
  stun:   {name:'定身法',mp:8,mult:0,type:'stun',lv:7,desc:'掐诀定身，敌人2回合无法行动'},
  eye:    {name:'火眼金睛',mp:6,mult:0,type:'defdown',lv:9,desc:'看破弱点，敌防御-40%（3回合）'},
  guard:  {name:'铜头铁臂',mp:10,mult:0,type:'defup',lv:11,desc:'防御+50%（3回合）'},
  cloud:  {name:'筋斗突击',mp:18,mult:3.2,type:'atk',lv:13,desc:'驾筋斗云俯冲 3.2倍伤害'}
};
const ITEMS={
  peach:  {name:'仙桃',type:'hp',val:60,price:60,desc:'花果山特产，回复60气血'},
  bantao: {name:'蟠桃',type:'fullhp',val:0,price:300,desc:'王母同款（低配），气血全满法力半满'},
  pill:   {name:'龙宫丹',type:'mp',val:40,price:80,desc:'龙宫炼制，回复40法力'},
  golden: {name:'九转金丹',type:'full',val:0,price:800,desc:'太上老祖配方，气血法力全满'},
  herb:   {name:'金疮药',type:'hp',val:25,price:30,desc:'人间药铺货色，回复25气血'}
};
const GEARS={
  stick:  {name:'硬木棒',type:'weapon',atk:3,price:50,desc:'傲来国军械街出品'},
  sword:  {name:'青锋剑',type:'weapon',atk:9,price:420,desc:'削铁如泥的凡间利器'},
  jingu:  {name:'定海神针·金箍棒',type:'weapon',atk:45,price:0,desc:'重一万三千五百斤，随心意变化'},
  leather:{name:'皮甲',type:'armor',def:3,price:80,desc:'虎皮缝制，花果山时尚'},
  chain:  {name:'锁子甲',type:'armor',def:9,price:340,desc:'傲来国上将军同款'},
  fork:   {name:'夜叉三股叉',type:'weapon',atk:18,price:0,desc:'巡海夜叉的兵刃，寒光凛凛（掉落限定）'},
  judge:  {name:'判官笔',type:'weapon',atk:28,price:0,desc:'勾魂判官笔，一笔定生死（掉落限定）'},
  sanjian:{name:'三尖两刃刀',type:'weapon',atk:55,price:0,desc:'二郎真君神兵，天下无双（掉落限定）'},
  wurobe: {name:'无常袍',type:'armor',def:14,price:0,desc:'黑白无常的官袍，阴气森森（掉落限定）'}
};
const LVUP={ // 每级增量
  hp:14,mp:7,atk:3,def:2
};
function expNext(lv){return lv*lv*8;}
function statsAt(lv){
  return {hp:70+(lv-1)*LVUP.hp, mp:25+(lv-1)*LVUP.mp, atk:13+(lv-1)*LVUP.atk, def:6+(lv-1)*LVUP.def};
}
/* 商店库存 */
const SHOP=[ 'herb','peach','pill','stick','leather','sword','chain' ];

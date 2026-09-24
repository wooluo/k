/* ============================================================
 * BRICKFALL：破碎星域 — 全局配置
 * ============================================================ */
window.BF = window.BF || {};

BF.C = {
  W: 1000, H: 640,                 // 逻辑游戏区尺寸
  WALL: 10,                        // 左右墙厚（碰撞边界）
  LIVES: 3,
  PADDLE: {
    W: 112, H: 14,
    Y: 640 - 30,
    BIG: 1.6, SMALL: 0.7,
    KEY_SPEED: 700                 // 键盘移动速度 px/s
  },
  BALL: {
    R: 8, R_SMALL: 5,
    SPEED: 360,                    // 默认速度 px/s（=6/帧*60）
    MIN: 240, MAX: 840,            // 4 与 14 的帧单位换算
    GROW: 9, GROW_EVERY: 5,        // 每摧毁5块砖 +9 px/s
    MINVY: 150,                    // 最小垂直速度分量
    MAX_ANGLE: Math.PI / 3,        // 挡板反弹最大 ±60°
    SUBSTEP: 6                     // 每子步最大位移 px
  },
  BRICK: {
    TOP: 46, LEFT: 40, RIGHT: 40, H: 26, GAP: 3,
    EXPLODE_R: 1.65,               // 爆炸半径 = 单元宽 × 该系数
    FREEZE_R: 190, FREEZE_T: 3
  },
  COMBO_TIME: 5, FRENZY_T: 5, FRENZY_AT: 10,
  DROP_VY: 150,
  LASER_CD: 0.28, LASER_SPEED: 980,
  BOMB_R: 130,
  MAGNET_R: 150,
  EVENTS_EVERY: [26, 34]
};

/* ---------------- 砖块类型 ---------------- */
BF.BRICKS = {
  normal:       { hp: 1, score: 100,  color: '#2e86ff', glow: '#9cc8ff', label: '普通' },
  tough:        { hp: 2, score: 200,  color: '#8a5cff', glow: '#c8b0ff', label: '强化' },
  heavy:        { hp: 5, score: 500,  color: '#ff8c3a', glow: '#ffd0a0', label: '重型' },
  explosive:    { hp: 1, score: 150,  color: '#ff4757', glow: '#ffb3ba', label: '爆炸' },
  freeze:       { hp: 1, score: 150,  color: '#35e0e6', glow: '#b2fbff', label: '冰冻' },
  metal:        { hp: 3, score: 300,  color: '#9aa7b8', glow: '#e8eef5', label: '金属' },
  shield:       { hp: 2, score: 250,  color: '#ffd93a', glow: '#fff3b0', label: '护盾' },
  moving:       { hp: 2, score: 250,  color: '#4ae08a', glow: '#c0ffd9', label: '移动' },
  portal:       { hp: Infinity, score: 0,   color: '#d24dff', glow: '#f3c2ff', label: '传送' },
  indestruct:   { hp: Infinity, score: 0,   color: '#565f6e', glow: '#9aa3b0', label: '不可破坏' }
};
// 地图字符 → 类型
BF.CHAR_MAP = {
  '1': 'normal', '2': 'tough', '3': 'heavy', '4': 'explosive',
  '5': 'freeze', '6': 'metal', '7': 'portal', '8': 'portal',
  'M': 'moving', 'S': 'shield', '#': 'indestruct'
};
// 计入通关的砖块。金属砖不计入（普通球无法破坏，只有激光/炸弹/穿透能拿额外分），
// 否则道具随机掉落可能导致关卡无法通关。
BF.DESTROYABLE = { normal: 1, tough: 1, heavy: 1, explosive: 1, freeze: 1, shield: 1, moving: 1 };
// 普通球无法破坏的类型（需要激光/炸弹/穿透/火焰）
BF.NEEDS_SPECIAL = { metal: 1, indestruct: 1 };

/* ---------------- 道具 ---------------- */
BF.POWERUPS = {
  multi:    { label: 'M', name: '多球分裂', color: '#ff5d7a', good: true },
  big:      { label: 'B', name: '巨型挡板', color: '#ffd93a', good: true },
  small:    { label: 'S', name: '小型挡板', color: '#b85c5c', good: false },
  slow:     { label: 'C', name: '时间减缓', color: '#63d2ff', good: true },
  fast:     { label: 'F', name: '加速诅咒', color: '#ff7043', good: false },
  laser:    { label: 'L', name: '激光火炮', color: '#ff2d95', good: true },
  bomb:     { label: 'O', name: '聚变炸弹', color: '#ff9f1a', good: true },
  shield:   { label: 'D', name: '底部护盾', color: '#3ae374', good: true },
  pierce:   { label: 'P', name: '穿透之球', color: '#c56cf0', good: true },
  fire:     { label: 'W', name: '烈焰之球', color: '#ff6348', good: true },
  magnet:   { label: 'G', name: '磁力牵引', color: '#38ada9', good: true },
  life:     { label: '+', name: '额外生命', color: '#ff4d6d', good: true },
  x2:       { label: '×2', name: '双倍积分', color: '#f7b731', good: true },
  jackpot:  { label: '$', name: '即时奖励', color: '#f5cd79', good: true },
  sticky:   { label: 'U', name: '粘性挡板', color: '#7bed9f', good: true },
  tinyball: { label: 'o', name: '微型之球', color: '#70a1ff', good: true }
};
BF.DROP_TABLE = [
  ['multi', 9], ['big', 12], ['slow', 9], ['laser', 9], ['bomb', 9],
  ['shield', 9], ['pierce', 8], ['fire', 8], ['magnet', 7], ['x2', 6],
  ['jackpot', 5], ['sticky', 5], ['tinyball', 4], ['life', 3],
  ['small', 4], ['fast', 4]
];

/* ---------------- Combo 倍率 ---------------- */
BF.comboMult = function (c) {
  if (c >= 20) return 10;
  if (c >= 10) return 5;
  if (c >= 5) return 2.5;
  if (c >= 4) return 2;
  if (c >= 3) return 1.5;
  if (c >= 2) return 1.2;
  return 1;
};

/* ---------------- 成就 ---------------- */
BF.ACHIEVEMENTS = [
  { id: 'first_blood', name: 'FIRST BLOOD', desc: '摧毁第一块砖块' },
  { id: 'combo_master', name: 'COMBO MASTER', desc: '连击达到 ×10' },
  { id: 'demolition', name: 'DEMOLITION', desc: '一次连锁爆炸摧毁 10 块砖' },
  { id: 'survivor', name: 'SURVIVOR', desc: '无伤通关任意关卡' },
  { id: 'speed_demon', name: 'SPEED DEMON', desc: '球速达到最大值' },
  { id: 'boss_slayer', name: 'BOSS SLAYER', desc: '击败一个 Boss' },
  { id: 'perfect', name: 'PERFECT', desc: '任意关卡三星评价' },
  { id: 'chaos', name: 'CHAOS', desc: '同时存在 5 个球' },
  { id: 'unstoppable', name: 'UNSTOPPABLE', desc: '单次出球内连续 100 次挡板反弹' }
];

/* ---------------- 世界 ---------------- */
BF.WORLDS = [
  { id: 1, name: '第一章 · 新星废墟', from: 1, to: 11, hue: 210 },
  { id: 2, name: '第二章 · 霓虹都市', from: 12, to: 22, hue: 300 },
  { id: 3, name: '第三章 · 机械深渊', from: 23, to: 33, hue: 30, soon: true },
  { id: 4, name: '第四章 · 冰封星域', from: 34, to: 44, hue: 190, soon: true },
  { id: 5, name: '第五章 · 熔岩核心', from: 45, to: 55, hue: 15, soon: true },
  { id: 6, name: '第六章 · 虚空空间站', from: 56, to: 66, hue: 260, soon: true },
  { id: 7, name: '第七章 · 终焉之门', from: 67, to: 77, hue: 350, soon: true }
];

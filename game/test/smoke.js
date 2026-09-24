/* Headless 冒烟测试：模拟 DOM/Canvas 桩，跑真实游戏逻辑 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

/* ---------- 桩：2D 上下文 ---------- */
function makeCtx() {
  const gradient = { addColorStop() {} };
  return new Proxy({}, {
    get(t, prop) {
      if (prop === 'canvas') return { width: 1000, height: 640 };
      if (typeof prop === 'string') {
        if (!(prop in t)) t[prop] = (...a) => gradient; // 任何方法调用返回渐变桩
        return t[prop];
      }
      return undefined;
    },
    set(t, p, v) { t[p] = v; return true; }
  });
}
/* ---------- 桩：DOM ---------- */
function makeEl(tag) {
  const el = {
    tagName: (tag || 'div').toUpperCase(),
    style: {}, dataset: {},
    children: [], _cls: new Set(),
    classList: {
      add(c) { el._cls.add(c); }, remove(c) { el._cls.delete(c); },
      toggle(c, v) { v === undefined ? (el._cls.has(c) ? el._cls.delete(c) : el._cls.add(c)) : (v ? el._cls.add(c) : el._cls.delete(c)); },
      contains(c) { return el._cls.has(c); }
    },
    textContent: '', innerHTML: '', value: '', checked: false, disabled: false,
    offsetHeight: 40, clientWidth: 1000, width: 1000, height: 640,
    appendChild(c) { el.children.push(c); return c; },
    remove() {},
    addEventListener() {}, removeEventListener() {},
    querySelectorAll() { return []; }, getBoundingClientRect() { return { left: 0, top: 0, width: 1000, height: 640 }; },
    getContext() { return makeCtx(); },
    getContext2d() { return makeCtx(); }
  };
  return el;
}

const sandbox = {
  console, Math, JSON, isFinite, parseInt, parseFloat, setTimeout, clearTimeout, setInterval, clearInterval,
  performance: { now: () => Date.now() },
  innerWidth: 1280, innerHeight: 800,
  requestAnimationFrame: () => 0,
  document: {
    createElement: (t) => makeEl(t),
    getElementById: () => makeEl('div'),
    addEventListener() {},
    body: makeEl('body'),
    hidden: false
  },
  localStorage: undefined
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

/* ---------- 加载源码 ---------- */
const files = ['config.js', 'utils.js', 'audio.js', 'particles.js', 'save.js', 'levels.js', 'input.js', 'entities.js', 'game.js', 'ui.js'];
for (const f of files) {
  const code = fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8');
  vm.runInContext(code, sandbox, { filename: f });
}

const BF = sandbox.BF;
const g = BF;
let errors = 0;
function check(name, fn) {
  try {
    fn();
    console.log('✔ ' + name);
  } catch (e) {
    errors++;
    console.log('✘ ' + name + ' → ' + e.stack.split('\n').slice(0, 4).join(' | '));
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assert failed'); }

/* ---------- 组装 ---------- */
const canvas = makeEl('canvas');
canvas.parentElement = { clientWidth: 1000 };
const game = new BF.Game(canvas);
const calls = { shown: [], banners: [], toasts: [] };
const fakeUI = {
  show(id, d) { calls.shown.push([id, d]); },
  setHUDVisible() {},
  banner(t) { calls.banners.push(t); },
  toast(a, b) { calls.toasts.push([a, b]); },
  updateHUD() {}
};
const fakeAudio = new Proxy({ setFrenzy() {} }, { get: (t, p) => (p in t ? t[p] : (() => {})), set: () => true });
const fakeInput = { left: false, right: false };
game.attach(fakeAudio, new BF.Save(), fakeUI, fakeInput);

function tick(n) {
  for (let i = 0; i < n; i++) {
    game.update(1 / 60);
    if (i % 30 === 0) game.render();
  }
}
function saneBalls() {
  for (const b of game.balls) {
    assert(isFinite(b.x) && isFinite(b.y) && isFinite(b.vx) && isFinite(b.vy), '球数值 NaN: ' + JSON.stringify(b));
  }
}

/* ---------- 用例 ---------- */
check('resize 不崩溃且尺寸合法', () => {
  game.resize();
  const w = parseFloat(canvas.style.width);
  assert(isFinite(w) && w > 0, 'canvas 宽度非法: ' + canvas.style.width);
});

check('剧情通关流程 + 解锁 + 三星', () => {
  game.startStoryLevel(2);
  tick(5);
  assert(game.livesLost === 0 && game.lives === 3, '初始生命');
  for (const b of game.bricks.filter(x => x.alive)) game.damageBrick(b, 99, 'explosion');
  tick(80); // clearDelay 0.9s
  assert(game.state === 'clear', '应通关结算, 实际 ' + game.state);
  const shown = calls.shown.filter(c => c[0] === 'clear').pop();
  assert(shown && shown[1] && shown[1].extra && shown[1].extra.stars >= 1, '结算数据完整');
  assert(game.save.data.unlocked >= 3, '解锁下一关, 实际 ' + game.save.data.unlocked);
});

check('关卡1 运行60秒 + 发射', () => {
  game.startStoryLevel(1);
  assert(game.state === 'playing', '状态');
  tick(30);
  game._primaryAction(); // 发射
  tick(3600);
  saneBalls();
  assert(game.score > 0, '应有得分, 实际 ' + game.score);
  assert(game.bricksDestroyed > 0, '应有摧毁');
});

check('爆炸连锁关卡4', () => {
  game.startStoryLevel(4);
  tick(30); game._primaryAction(); tick(3600);
  saneBalls();
});

check('传送门关卡8', () => {
  game.startStoryLevel(8);
  assert(game.portals.length > 0, '应有传送门对');
  tick(30); game._primaryAction(); tick(3600);
  saneBalls();
});

check('移动砖关卡7 + 机关关卡10', () => {
  game.startStoryLevel(7);
  tick(30); game._primaryAction(); tick(2400);
  game.startStoryLevel(10);
  assert(game.rotors.length === 1, '旋转杆');
  tick(30); game._primaryAction(); tick(3600);
  saneBalls();
});

check('全部道具生效', () => {
  game.startStoryLevel(9);
  tick(10);
  for (const t of Object.keys(BF.POWERUPS)) {
    game.applyPower(t);
    tick(5);
  }
  saneBalls();
  assert(game.bombs <= 3, '炸弹上限');
  assert(game.lives >= 1, '生命');
});

check('炸弹引爆', () => {
  game.applyPower('bomb');
  game.detonateBomb();
  tick(30);
});

check('激光射击', () => {
  game.applyPower('laser');
  game._primaryAction();
  tick(10);
});

check('Boss1 击杀 → 结算', () => {
  game.startStoryLevel(11);
  tick(30); game._primaryAction(); tick(600);
  assert(game.boss && game.boss.hp > 0, 'boss 存在');
  // 模拟击杀
  while (game.boss && !game.boss.dying) game._damageBoss(10, 500, 200);
  tick(200); // 跑完死亡演出与结算
  assert(game.state === 'clear', '应结算, 实际 ' + game.state);
});

check('Boss2 碰撞', () => {
  game.startStoryLevel(22);
  tick(30); game._primaryAction(); tick(1200);
  assert(game.boss && game.boss.type === 2, 'boss2');
  // 手动把球放到核心旁测碰撞
  const b = game.balls[0];
  if (b) {
    b.stuck = false;
    b.x = game.boss.x + game.boss.r + 3; b.y = game.boss.y;
    b.vx = -100; b.vy = 50;
    const res = game.boss.collideBall(b);
    assert(res === 'core' || res === 'bar' || res === null, '碰撞返回');
  }
  saneBalls();
});

check('Boss Rush 两阶段', () => {
  game.startBossRush();
  tick(30); game._primaryAction(); tick(300);
  while (game.boss && !game.boss.dying) game._damageBoss(20, 500, 200);
  tick(200);
  assert(game.boss && game.boss.type === 2, '应进入 boss2');
  while (game.boss && !game.boss.dying) game._damageBoss(20, 500, 200);
  tick(200);
  assert(game.state === 'victory', 'rush 通关, 实际 ' + game.state);
});

check('无尽模式推进', () => {
  game.startEndless();
  tick(30); game._primaryAction(); tick(1300); // >2 次推进
  assert(game.endless.depth >= 1, '推进深度 ' + game.endless.depth);
  saneBalls();
});

check('限时模式结束结算', () => {
  game.startTimeAttack();
  tick(30); game._primaryAction(); tick(6500); // >90s
  assert(game.state === 'over', '应结束, 实际 ' + game.state);
});

check('挑战模式 + 变体', () => {
  game.startChallenge('c2'); // 极速
  tick(30); game._primaryAction(); tick(600);
  assert(game._effectiveSpeed() > BF.C.BALL.SPEED, '速度倍率');
  game.startChallenge('c4'); // 钢铁意志
  const b0 = game.bricks.find(b => b.alive);
  assert(b0 && b0.maxHp >= 2, '血量+1');
});

check('失败 → 重开', () => {
  game.startStoryLevel(1);
  tick(10); game._primaryAction();
  game.lives = 1;
  // 把球扔到底部
  for (const b of game.balls) { b.stuck = false; b.y = BF.C.H + 50; b.vy = 100; }
  tick(10);
  assert(game.state === 'over', '应失败, 实际 ' + game.state);
  game.restartLevel();
  assert(game.state === 'playing', '重开');
});

check('暂停 / 恢复 / 退出', () => {
  game.togglePause();
  assert(game.state === 'paused');
  game.togglePause();
  assert(game.state === 'playing');
  game.exitToMenu();
  assert(game.state === 'menu');
});

check('事件系统触发', () => {
  game.startStoryLevel(10);
  game.introT = 0;
  game.eventT = 0.01;
  tick(5);
  tick(600);
  saneBalls();
});

check('全部地图数据合法（行长一致/字符合法）', () => {
  const valid = new Set(['.', '1', '2', '3', '4', '5', '6', '7', '8', 'M', 'S', '#']);
  const allMaps = [
    ...BF.LEVELS.filter(l => l.map).map(l => l.map),
    ...BF.CLASSIC,
    ...BF.TIME_PATTERNS,
    ...BF.CHALLENGES.map(c => c.map)
  ];
  for (const map of allMaps) {
    const w = map[0].length;
    assert(w >= 8 && w <= 14, '列数异常: ' + w);
    for (const row of map) {
      assert(row.length === w, '行长不一致: [' + map.join(',') + ']');
      for (const ch of row) assert(valid.has(ch), '非法字符: ' + ch);
    }
    // 传送门必须成对
    for (const map2 of [map]) {
      const c7 = map2.join('').split('').filter(c => c === '7').length;
      const c8 = map2.join('').split('').filter(c => c === '8').length;
      assert(c7 % 2 === 0 && c8 % 2 === 0, '传送门不成对');
    }
  }
});

check('全部 22 关逐关模拟 4 秒', () => {
  for (const def of BF.LEVELS) {
    game.startStoryLevel(def.id);
    tick(30);
    game._primaryAction();
    tick(240);
    saneBalls();
    if (!def.boss) {
      const count = game.bricks.filter(b => b.alive && BF.DESTROYABLE[b.type]).length;
      assert(count > 0, '关卡 ' + def.id + ' 剩余砖块应 >0');
    }
  }
});

check('砖块密度统计', () => {
  const counts = BF.LEVELS.filter(l => l.map).map(l => {
    let n = 0;
    for (const row of l.map) for (const ch of row) {
      const t = BF.CHAR_MAP[ch];
      if (t && BF.DESTROYABLE[t]) n++;
    }
    return n;
  });
  const min = Math.min(...counts), max = Math.max(...counts), avg = Math.round(counts.reduce((a, b) => a + b) / counts.length);
  console.log('   每关可破坏砖块: 最少 %d / 最多 %d / 平均 %d', min, max, avg);
  assert(avg >= 55, '平均砖块密度应 ≥55, 实际 ' + avg);
});

console.log(errors === 0 ? '\n全部通过 ✅' : '\n存在失败 ❌ x' + errors);
process.exit(errors === 0 ? 0 : 1);

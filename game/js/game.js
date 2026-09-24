/* ============================================================
 * BRICKFALL — 游戏主逻辑
 * 状态机 / 物理 / 碰撞 / 道具 / Combo / Boss / 事件 / 渲染
 * ============================================================ */
(function () {
  'use strict';
  const C = BF.C, U = BF.U, BRICKS = BF.BRICKS, POWER = BF.POWERUPS;

  class Game {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.particles = new BF.Particles(700);
      this.audio = null;   // main.js 注入
      this.save = null;
      this.ui = null;
      this.input = null;

      this.state = 'menu';
      this.mode = null;

      // 运行时数据
      this.bricks = [];
      this.balls = [];
      this.drops = [];
      this.lasers = [];
      this.bullets = [];
      this.meteors = [];
      this.pendingBooms = [];
      this.portals = [];
      this.rotors = [];
      this.walls = [];
      this.holes = [];
      this.boss = null;

      this.buffs = {};
      this.pointerX = C.W / 2;
      this.time = 0;
      this.timescale = 1;
      this.paddle = null;
      this.shieldCharges = 0;
      this.frenzy = false;
      this.introT = 0;
      this.events = { gravityT: 0, blackoutT: 0, doubleT: 0, speedT: 0, meteorT: 0, meteorSpawn: 0 };
      this.totalBricks = 0;
      this.levelDef = null;

      // 背景
      this.stars = [];
      for (let i = 0; i < 130; i++) {
        this.stars.push({
          x: Math.random() * C.W, y: Math.random() * C.H,
          r: Math.random() * 1.6 + 0.4,
          tw: Math.random() * U.TAU,
          layer: Math.random() < 0.5 ? 0.3 : 0.7
        });
      }
      this.fx = document.createElement('canvas');
      this.fx.width = C.W; this.fx.height = C.H;
      this.fxctx = this.fx.getContext('2d');

      this._frameBound = (t) => this._frame(t);
      this._last = 0; this._acc = 0;
      this._scale = 1; this._dpr = 1;
      this._fps = 60; this._fpsA = 60;
    }

    attach(audio, save, ui, input) {
      this.audio = audio; this.save = save; this.ui = ui; this.input = input;
    }

    /* ================= 主循环 ================= */
    start() {
      this._last = performance.now();
      requestAnimationFrame(this._frameBound);
    }

    _frame(t) {
      let dt = (t - this._last) / 1000;
      this._last = t;
      if (!isFinite(dt) || dt < 0) dt = 0;
      dt = Math.min(dt, 0.05);
      this._fpsA = this._fpsA * 0.95 + (1 / Math.max(dt, 0.001)) * 0.05;

      if (this.state === 'playing') {
        this._acc += dt;
        let steps = 0;
        while (this._acc >= 1 / 60 && steps < 4) {
          this.update((1 / 60) * this.timescale, 1 / 60);
          this._acc -= 1 / 60;
          steps++;
        }
        if (steps >= 4) this._acc = 0;
      } else {
        this.time += dt * 0.4; // 菜单背景仍在缓慢流动
        this.particles.update(dt);
      }

      this.render();
      if (this.ui) this.ui.updateHUD(this);
      requestAnimationFrame(this._frameBound);
    }

    /* ================= 尺寸自适应 ================= */
    resize() {
      // 直接用窗口尺寸计算，避免依赖 canvas 自身宽度导致的单调收缩
      const availW = Math.max(280, window.innerWidth - 12);
      const hudEl = document.getElementById('hud');
      const hudH = (hudEl && !hudEl.classList.contains('hidden')) ? hudEl.offsetHeight : 0;
      const availH = Math.max(300, window.innerHeight - hudH - 28);
      const scale = Math.min(availW / C.W, availH / C.H);
      this._scale = scale;
      this._dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.style.width = Math.round(C.W * scale) + 'px';
      this.canvas.style.height = Math.round(C.H * scale) + 'px';
      this.canvas.width = Math.round(C.W * scale * this._dpr);
      this.canvas.height = Math.round(C.H * scale * this._dpr);
    }

    /* ================= 对局初始化 ================= */
    _resetRun() {
      this.bricks = []; this.balls = []; this.drops = []; this.lasers = [];
      this.bullets = []; this.meteors = []; this.pendingBooms = [];
      this.portals = []; this.rotors = []; this.walls = []; this.holes = [];
      this.boss = null;
      this.score = 0; this.combo = 0; this.comboT = 0;
      this.frenzy = false; this.frenzyT = 0;
      this.maxCombo = 0;
      this.bombs = 0; this.shieldCharges = 0;
      this.buffs = { big: 0, small: 0, slow: 0, fast: 0, laser: 0, magnet: 0, sticky: 0, pierce: 0, fire: 0, tinyball: 0, x2: 0 };
      this.livesLost = 0; this.bricksDestroyed = 0; this.totalBricks = 0;
      this.baseSpeed = C.BALL.SPEED; this.growthCounter = 0;
      this.paddleBounces = 0;
      this.laserCd = 0;
      this.timescale = 1; this.slowmoT = 0;
      this.respawnT = 0;
      this.paddle = { x: C.W / 2, y: C.PADDLE.Y, w: C.PADDLE.W, h: C.PADDLE.H, flashT: 0 };
      this.eventT = U.rand(C.EVENTS_EVERY[0], C.EVENTS_EVERY[1]);
      this.events = { gravityT: 0, blackoutT: 0, doubleT: 0, speedT: 0, meteorT: 0, meteorSpawn: 0 };
      this.particles.reset();
      this.levelTime = 0;
      this.introT = 1.6;
      this.clearDelay = 0;
      this.mutators = {};
      this.levelDef = null;
      this.levelSpeed = 1;
      this.dropChance = 0.16;
      this.countBricks = true;
    }

    startStoryLevel(id) {
      const def = BF.LEVELS.find(l => l.id === id);
      if (!def) return;
      this._resetRun();
      this.mode = 'story';
      this.currentLevel = id;
      this.lives = C.LIVES;
      this._applyLevel(def);
      this._beginPlay('LEVEL ' + id + ' — ' + def.name);
    }

    startChallenge(cid) {
      const def = BF.CHALLENGES.find(c => c.id === cid);
      if (!def) return;
      this._resetRun();
      this.mode = 'challenge';
      this.currentChallenge = cid;
      this.lives = def.mutators.oneLife ? 1 : C.LIVES;
      this.mutators = def.mutators || {};
      this._applyLevel({
        id: 0, name: def.name, map: def.map, speed: def.speed || 1,
        movingRange: def.movingRange || 44, par: 120, boss: 0, events: false
      });
      this._beginPlay('CHALLENGE — ' + def.name);
    }

    startClassic() {
      this._resetRun();
      this.mode = 'classic';
      this.classicIdx = 0;
      this.lives = C.LIVES;
      this.mutators = { noDrops: true };
      this._applyLevel({ id: 0, name: '经典 ' + (this.classicIdx + 1), map: BF.CLASSIC[0], speed: 0.95 + this.classicIdx * 0.05, par: 90 });
      this._beginPlay('CLASSIC — 经典 ' + (this.classicIdx + 1));
    }

    startEndless() {
      this._resetRun();
      this.mode = 'endless';
      this.lives = C.LIVES;
      this.mutators = {};
      this.endless = { depth: 0, pushT: 8, cols: 12 };
      this.dropChance = 0.22;
      this.levelSpeed = 1;
      this._endlessBuildInitial();
      this._beginPlay('ENDLESS — 无尽模式');
    }

    startTimeAttack() {
      this._resetRun();
      this.mode = 'time';
      this.lives = C.LIVES; // 时间模式不减生命
      this.mutators = {};
      this.timeAttack = { left: 90, cleared: 0, last: -1 };
      this.levelSpeed = 1.05;
      this._timeLoadPattern();
      this._beginPlay('TIME ATTACK — 限时 90 秒');
    }

    startBossRush() {
      this._resetRun();
      this.mode = 'rush';
      this.rushIdx = 0;
      this.lives = C.LIVES;
      this.mutators = {};
      this._applyLevel({ id: 0, name: '机械巨墙', boss: 1, speed: 1, par: 150 });
      this._beginPlay('BOSS RUSH — 机械巨墙');
    }

    startContinue() {
      const id = U.clamp(this.save.data.unlocked, 1, BF.LEVELS.length);
      this.startStoryLevel(id);
    }

    _applyLevel(def) {
      this.levelDef = def;
      this.levelSpeed = def.speed || 1;
      this.dropChance = def.drops !== undefined ? def.drops : 0.16;
      if (def.boss && !def.two) { def.two = 4200; def.three = 6800; }
      this._buildBricks(def.map || [], def.movingRange || 44);

      if (def.boss === 1) this.boss = new BF.Boss1();
      if (def.boss === 2) this.boss = new BF.Boss2();

      this.rotors = (def.rotors || []).map(r => ({
        cx: r.cx, cy: r.cy, len: r.len, th: r.th,
        speed: r.speed, angle: Math.random() * U.TAU, frozenT: 0
      }));
      this.walls = (def.walls || []).map(w => ({
        x0: w.x, y: w.y, w: w.w, h: w.h, spd: w.vx, range: w.range, x: w.x
      }));
      this.holes = (def.holes || []).map(h => ({ ...h }));

      // 挑战: 钢铁意志 +1 HP
      if (this.mutators.allTough) {
        for (const b of this.bricks) {
          if (b.alive && isFinite(b.hp)) { b.hp += 1; b.maxHp += 1; }
        }
      }
      this.totalBricks = this._countDestroyable();
    }

    _buildBricks(map, movingRange) {
      this.bricks = []; this.portals = [];
      this.grid = [];
      if (!map.length) return;
      const rows = map.length, cols = map[0].length;
      const cellW = (C.W - C.BRICK.LEFT - C.BRICK.RIGHT) / cols;
      const cellH = C.BRICK.H + C.BRICK.GAP;
      const portal7 = [], portal8 = [];

      for (let r = 0; r < rows; r++) {
        this.grid[r] = [];
        for (let c = 0; c < cols; c++) {
          const ch = map[r][c];
          const type = BF.CHAR_MAP[ch];
          if (!type) { this.grid[r][c] = null; continue; }
          const def = BRICKS[type];
          const x = C.BRICK.LEFT + c * cellW + 1.5;
          const y = C.BRICK.TOP + r * cellH;
          const brick = {
            type, row: r, col: c,
            x0: x, y0: y, x, y,
            w: cellW - 3, h: C.BRICK.H,
            hp: def.hp, maxHp: def.hp,
            alive: true, frozenT: 0, shieldHp: type === 'shield' ? 1 : 0,
            spawnT: r * 0.06 + c * 0.012,
            vx: 0, free: false
          };
          if (type === 'moving') {
            const roomL = x - C.BRICK.LEFT;
            const roomR = C.W - C.BRICK.RIGHT - (x + brick.w);
            const amp = Math.min(movingRange, roomL, roomR);
            brick.moveAmp = Math.max(amp, 0);
            brick.movePhase = Math.random() * U.TAU;
          }
          if (ch === '7') portal7.push(brick);
          if (ch === '8') portal8.push(brick);
          this.bricks.push(brick);
          this.grid[r][c] = brick;
        }
      }
      for (let i = 0; i + 1 < portal7.length; i += 2) this.portals.push({ a: portal7[i], b: portal7[i + 1] });
      for (let i = 0; i + 1 < portal8.length; i += 2) this.portals.push({ a: portal8[i], b: portal8[i + 1] });
    }

    _beginPlay(label) {
      this.state = 'playing';
      this.spawnBall();
      this.ui.show(null);
      this.ui.setHUDVisible(true);
      this.ui.banner(label);
      this.audio && this.audio.setFrenzy(false);
    }

    spawnBall() {
      const b = new BF.Ball();
      b.stuckOffset = 0;
      b.x = this.paddle.x; b.y = this.paddle.y - C.BALL.R - 2;
      this.balls.push(b);
    }

    /* ================= 无尽模式 ================= */
    _endlessWeights(depth) {
      return [
        ['normal', Math.max(3, 10 - depth * 0.6)],
        ['tough', 1.5 + depth * 0.4],
        ['shield', depth > 2 ? 0.8 : 0],
        ['explosive', depth > 1 ? 1.0 : 0.35],
        ['freeze', 0.5],
        ['metal', depth > 3 ? 0.9 : 0],
        ['heavy', depth > 5 ? 0.8 : 0],
        ['moving', depth > 2 ? 1.0 : 0]
      ];
    }

    _endlessRow(depth, row) {
      const cols = this.endless.cols;
      const cellW = (C.W - C.BRICK.LEFT - C.BRICK.RIGHT) / cols;
      const cellH = C.BRICK.H + C.BRICK.GAP;
      const y = C.BRICK.TOP + row * cellH;
      const allMoving = depth % 5 === 4;
      for (let c = 0; c < cols; c++) {
        if (Math.random() < 0.1) continue;
        let type = U.weighted(this._endlessWeights(depth));
        if (allMoving && type === 'normal') type = 'moving';
        const def = BRICKS[type];
        const x = C.BRICK.LEFT + c * cellW + 1.5;
        const brick = {
          type, row: -1, col: c,
          x0: x, y0: y, x, y,
          w: cellW - 3, h: C.BRICK.H,
          hp: def.hp, maxHp: def.hp,
          alive: true, frozenT: 0, shieldHp: type === 'shield' ? 1 : 0,
          spawnT: 0.2, flashT: 0, vx: 0, free: false
        };
        if (type === 'moving') {
          const roomL = x - C.BRICK.LEFT;
          const roomR = C.W - C.BRICK.RIGHT - (x + brick.w);
          brick.moveAmp = Math.min(40, roomL, roomR);
          brick.movePhase = Math.random() * U.TAU;
        }
        this.bricks.push(brick);
      }
    }

    _endlessBuildInitial() {
      for (let r = 0; r < 5; r++) this._endlessRow(r, r);
    }

    _endlessPush() {
      const cellH = C.BRICK.H + C.BRICK.GAP;
      this.endless.depth++;
      // 清理死砖，防止数组无限增长
      this.bricks = this.bricks.filter(b => b.alive);
      for (const b of this.bricks) {
        if (b.alive) { b.y = b.y0 = b.y0 + cellH; }
      }
      this._endlessRow(this.endless.depth, 0);
      this.endless.pushT = Math.max(4.5, 8 - this.endless.depth * 0.25);
      this.baseSpeed = Math.min(this.baseSpeed + 7, C.BALL.MAX);
      this.dropChance = Math.max(0.08, this.dropChance - 0.01);
      this.totalBricks = this._countDestroyable();
      this.particles.shake(4, 150);
      this.audio && this.audio.sfx('wall');
    }

    /* ================= 限时挑战 ================= */
    _timeLoadPattern() {
      let idx;
      do { idx = U.randi(0, BF.TIME_PATTERNS.length - 1); } while (idx === this.timeAttack.last);
      this.timeAttack.last = idx;
      this._buildBricks(BF.TIME_PATTERNS[idx], 40);
      this.totalBricks = this._countDestroyable();
      for (const b of this.bricks) {
        for (const ball of this.balls) this._resolveBallOverlaps(ball);
        break;
      }
    }

    /* ================= 帧更新 ================= */
    update(dt, raw) {
      if (raw === undefined) raw = dt;
      this.time += dt;
      if (this.introT > 0) this.introT -= dt;
      this.levelTime += dt;
      if (this.slowmoT > 0) {
        this.slowmoT -= raw; // 慢动作计时用真实时间，避免演出被拉长
        if (this.slowmoT <= 0) this.timescale = 1;
      }
      if (this.clearDelay > 0) {
        this.clearDelay -= raw;
        if (this.clearDelay <= 0) this._levelClearFinish();
        // 期间仍更新粒子等
        this._updateBricksAnim(dt);
        this.particles.update(dt);
        return;
      }

      this._updatePaddle(dt);
      this._updateBuffs(dt);
      this._updateBricksAnim(dt);
      this._updateBalls(dt);
      this._updateDrops(dt);
      this._updateLasers(dt);
      this._updateBullets(dt);
      this._updateMeteors(dt);
      this._updatePendingBooms(dt);
      this._updateBoss(dt, raw);
      this._updateMechanisms(dt);
      this._updateEvents(dt);
      this._updateCombo(dt);
      this._updateMode(dt);
      this.particles.update(dt);

      // 通关 / 失败检测
      this._checkClear();
      if (this.state !== 'playing') return;
    }

    _updatePaddle(dt) {
      const p = this.paddle;
      // buff 宽度
      let w = C.PADDLE.W;
      if (this.buffs.big > 0) w *= C.PADDLE.BIG;
      if (this.buffs.small > 0) w *= C.PADDLE.SMALL;
      p.w += (w - p.w) * Math.min(1, dt * 10);
      if (p.flashT > 0) p.flashT -= dt;

      if (this.input && (this.input.left || this.input.right)) {
        const dir = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
        p.x += dir * C.PADDLE.KEY_SPEED * dt;
      } else {
        p.x += (this.pointerX - p.x) * Math.min(1, dt * 22);
      }
      p.x = U.clamp(p.x, C.WALL + p.w / 2, C.W - C.WALL - p.w / 2);
    }

    _updateBuffs(dt) {
      const B = this.buffs;
      for (const k in B) if (B[k] > 0) B[k] = Math.max(0, B[k] - dt);
      if (this.laserCd > 0) this.laserCd -= dt;
      if (this.frenzy) {
        this.frenzyT -= dt;
        if (this.frenzyT <= 0) {
          this.frenzy = false;
          this.audio && this.audio.setFrenzy(false);
        }
      }
    }

    _updateBricksAnim(dt) {
      for (const b of this.bricks) {
        if (!b.alive) continue;
        if (b.flashT > 0) b.flashT -= dt;
        if (b.frozenT > 0) { b.frozenT -= dt; continue; }
        if (b.free && b.vx) { // Boss 生成的自由移动砖
          b.x += b.vx * dt;
          if (b.x < C.BRICK.LEFT) { b.x = C.BRICK.LEFT; b.vx *= -1; }
          if (b.x + b.w > C.W - C.BRICK.RIGHT) { b.x = C.W - C.BRICK.RIGHT - b.w; b.vx *= -1; }
        } else if (b.moveAmp) {
          b.x = b.x0 + Math.sin(this.time * 0.9 + b.movePhase) * b.moveAmp;
        }
      }
    }

    _effectiveSpeed() {
      let s = this.baseSpeed * this.levelSpeed;
      if (this.mutators.speedMult) s *= this.mutators.speedMult;
      if (this.buffs.slow > 0) s *= 0.55;
      if (this.buffs.fast > 0) s *= 1.4;
      if (this.events.speedT > 0) s *= 1.22;
      if (this.frenzy) s *= 1.3;
      s = U.clamp(s, C.BALL.MIN, C.BALL.MAX);
      if (s >= C.BALL.MAX - 0.5) this.ach('speed_demon');
      return s;
    }

    _updateBalls(dt) {
      if (this.respawnT > 0) {
        this.respawnT -= dt;
        if (this.respawnT <= 0) this.spawnBall();
      }
      const eff = this._effectiveSpeed();
      const ballR = this.buffs.tinyball > 0 ? C.BALL.R_SMALL : C.BALL.R;

      for (let i = this.balls.length - 1; i >= 0; i--) {
        const ball = this.balls[i];
        ball.r = ballR;
        if (ball.teleCd > 0) ball.teleCd -= dt;
        if (ball.noHit > 0) ball.noHit -= dt;

        // 拖尾
        ball.trail.push({ x: ball.x, y: ball.y });
        if (ball.trail.length > 10) ball.trail.shift();
        if (this.buffs.fire > 0 && !ball.stuck && Math.random() < 0.7) {
          this.particles.trail(ball.x, ball.y, Math.random() < 0.5 ? '#ff6348' : '#ffb03a', 3.2);
        } else if (!ball.stuck && Math.random() < 0.4) {
          this.particles.trail(ball.x, ball.y, this.frenzy ? '#ff5d7a' : '#63d2ff', 2);
        }

        if (ball.stuck) {
          ball.x = this.paddle.x + ball.stuckOffset;
          ball.y = this.paddle.y - ball.r - 2;
          ball.stuckT += dt;
          if (ball.stuckT > 1.4) this._launchBall(ball);
          continue;
        }

        // 归一化速度到有效值
        U.setSpeed(ball, eff, C.BALL.MINVY);
        // 数值防御
        if (!isFinite(ball.x) || !isFinite(ball.y) || !isFinite(ball.vx) || !isFinite(ball.vy)) {
          ball.x = this.paddle.x; ball.y = this.paddle.y - 20;
          ball.vx = 0; ball.vy = -eff;
        }

        // 事件引力
        if (this.events.gravityT > 0) ball.vy += 300 * dt;

        // 子步移动
        const dist = ball.speed * dt;
        const steps = Math.max(1, Math.ceil(dist / C.BALL.SUBSTEP));
        const sdt = dt / steps;
        for (let s = 0; s < steps; s++) {
          ball.x += ball.vx * sdt;
          ball.y += ball.vy * sdt;

          // 黑洞引力
          for (const h of this.holes) {
            const dx = h.x - ball.x, dy = h.y - ball.y;
            const d = Math.hypot(dx, dy);
            if (d < h.r && d > 1) {
              const pull = h.strength * (1 - d / h.r) * sdt;
              ball.vx += (dx / d) * pull;
              ball.vy += (dy / d) * pull;
              if (d < 24) { // 防止坠入中心
                const hit = { nx: -dx / d, ny: -dy / d, pen: 24 - d + ball.r };
                U.reflectAndPush(ball, hit);
              }
              if (Math.random() < 0.15) this.particles.trail(ball.x, ball.y, '#b14dff', 2);
            }
          }

          this._ballWalls(ball);
          this._ballPaddle(ball);
          this._ballPortals(ball);
          if (ball.noHit <= 0) this._ballBricks(ball);
          this._ballMechanisms(ball);
          this._ballBoss(ball);

          // 掉落
          if (ball.y - ball.r > C.H + 10) {
            ball.dead = true;
            break;
          }
          // 底部护盾
          if (ball.vy > 0 && ball.y + ball.r >= C.H - 7 && this.shieldCharges > 0) {
            this.shieldCharges--;
            ball.y = C.H - 7 - ball.r;
            ball.vy = -Math.abs(ball.vy);
            this.audio && this.audio.sfx('shield');
            this.particles.ring(ball.x, C.H - 6, '#3ae374', 18, 260, 3, 0.5);
            this.particles.addText(ball.x, C.H - 40, 'SHIELD!', '#3ae374', 16);
          }
        }

        if (ball.dead) {
          this.balls.splice(i, 1);
          if (this.balls.length === 0) this._loseLife();
        }
      }

      // 磁铁
      if (this.buffs.magnet > 0) {
        for (const ball of this.balls) {
          if (ball.stuck) continue;
          if (ball.y > this.paddle.y - C.MAGNET_R && ball.vy > 0) {
            const dx = this.paddle.x - ball.x;
            ball.vx += Math.sign(dx) * Math.min(Math.abs(dx) * 3, 260) * dt;
            U.setSpeed(ball, this._effectiveSpeed(), C.BALL.MINVY);
          }
        }
      }
    }

    _launchBall(ball) {
      const t = U.clamp(ball.stuckOffset / (this.paddle.w / 2), -1, 1);
      ball.launch(t * C.BALL.MAX_ANGLE * 0.8);
      this.audio && this.audio.sfx('paddle');
    }

    _ballWalls(ball) {
      if (ball.x - ball.r < C.WALL) { ball.x = C.WALL + ball.r; ball.vx = Math.abs(ball.vx); this.audio && this.audio.sfx('wall'); }
      if (ball.x + ball.r > C.W - C.WALL) { ball.x = C.W - C.WALL - ball.r; ball.vx = -Math.abs(ball.vx); this.audio && this.audio.sfx('wall'); }
      if (ball.y - ball.r < C.WALL) { ball.y = C.WALL + ball.r; ball.vy = Math.abs(ball.vy); this.audio && this.audio.sfx('wall'); }
    }

    _ballPaddle(ball) {
      const p = this.paddle;
      const hit = U.circleRect(ball.x, ball.y, ball.r, p.x - p.w / 2, p.y, p.w, p.h);
      if (!hit || ball.vy <= 0) return;

      this.paddleBounces++;
      if (this.paddleBounces >= 100) this.ach('unstoppable');
      this.audio && this.audio.sfx('paddle');
      this.particles.spark(ball.x, p.y, '#63d2ff', 6, 120);
      p.flashT = 0.15;

      if (this.buffs.sticky > 0) {
        ball.stuck = true;
        ball.stuckOffset = U.clamp(ball.x - p.x, -p.w / 2 + 6, p.w / 2 - 6);
        ball.stuckT = 0;
        ball.vx = 0; ball.vy = -1;
        return;
      }

      // 根据击中位置决定反弹角（±60°）
      const t = U.clamp((ball.x - p.x) / (p.w / 2), -1, 1);
      const angle = t * C.BALL.MAX_ANGLE;
      const spd = Math.max(ball.speed, C.BALL.MIN);
      ball.vx = Math.sin(angle) * spd;
      ball.vy = -Math.abs(Math.cos(angle) * spd);
      ball.y = p.y - ball.r - 0.5;
      U.enforceMinVy(ball, C.BALL.MINVY, spd);
    }

    _ballPortals(ball) {
      if (ball.teleCd > 0) return;
      for (const pair of this.portals) {
        for (const side of ['a', 'b']) {
          const from = pair[side];
          const to = side === 'a' ? pair.b : pair.a;
          if (ball.x > from.x && ball.x < from.x + from.w && ball.y > from.y && ball.y < from.y + from.h) {
            this.particles.ring(ball.x, ball.y, '#d24dff', 14, 200, 3, 0.5);
            ball.x = to.x + to.w / 2;
            ball.y = to.y + to.h / 2;
            ball.teleCd = 0.25;
            ball.noHit = 0.05;
            this.particles.ring(ball.x, ball.y, '#d24dff', 14, 200, 3, 0.5);
            this.audio && this.audio.sfx('teleport');
            this._resolveBallOverlaps(ball);
            return;
          }
        }
      }
    }

    _ballBricks(ball) {
      for (const b of this.bricks) {
        if (!b.alive) continue;
        if (b.type === 'portal') continue;
        const hit = U.circleRect(ball.x, ball.y, ball.r, b.x, b.y, b.w, b.h);
        if (!hit) continue;

        const piercing = this.buffs.pierce > 0 && b.type !== 'indestruct';
        if (!piercing) {
          U.reflectAndPush(ball, hit);
          U.enforceMinVy(ball, C.BALL.MINVY, ball.speed);
        }

        const dmg = this.buffs.fire > 0 ? 2 : 1;
        const src = piercing ? 'pierce' : 'ball';
        const damaged = this.damageBrick(b, dmg, src);
        if (piercing && damaged) ball.noHit = 0.03;
        if (this.buffs.fire > 0 && damaged) this._fireSplash(b);
        return; // 每子步只处理一块砖
      }
    }

    _fireSplash(brick) {
      let n = 0;
      for (const b of this.bricks) {
        if (b === brick || !b.alive || b.type === 'metal' || b.type === 'indestruct') continue;
        const dx = (b.x + b.w / 2) - (brick.x + brick.w / 2);
        const dy = (b.y + b.h / 2) - (brick.y + brick.h / 2);
        if (Math.hypot(dx, dy) < b.w * 1.25 && n < 4) {
          this.particles.trail(b.x + b.w / 2, b.y + b.h / 2, '#ff6348', 3);
          this.damageBrick(b, 1, 'fire');
          n++;
        }
      }
    }

    _ballMechanisms(ball) {
      // 移动墙
      for (const w of this.walls) {
        const hit = U.circleRect(ball.x, ball.y, ball.r, w.x, w.y, w.w, w.h);
        if (hit) {
          U.reflectAndPush(ball, hit);
          U.enforceMinVy(ball, C.BALL.MINVY, ball.speed);
          this.particles.spark(ball.x, ball.y, '#9aa7b8', 5, 100);
          this.audio && this.audio.sfx('wall');
        }
      }
      // 旋转杆
      for (const r of this.rotors) {
        const hit = BF.rotorCollide(ball, r.cx, r.cy, r.len, r.th, r.angle);
        if (hit) {
          U.reflectAndPush(ball, hit);
          ball.vx += r.speed * U.rand(-40, 40);
          this.particles.spark(ball.x, ball.y, '#d24dff', 6, 140);
          this.audio && this.audio.sfx('wall');
        }
      }
    }

    _ballBoss(ball) {
      if (!this.boss || this.boss.dying) return;
      if (this.boss.type === 1) {
        const r = this.boss.rect;
        const hit = U.circleRect(ball.x, ball.y, ball.r, r.x, r.y, r.w, r.h);
        if (hit) {
          U.reflectAndPush(ball, hit);
          U.enforceMinVy(ball, C.BALL.MINVY, ball.speed);
          this._damageBoss(1, ball.x, ball.y);
        }
      } else {
        const res = this.boss.collideBall(ball);
        if (res === 'core') this._damageBoss(1, ball.x, ball.y);
        else if (res === 'bar') { this.particles.spark(ball.x, ball.y, '#d24dff', 6, 140); this.audio && this.audio.sfx('metal'); }
      }
    }

    _resolveBallOverlaps(ball) {
      for (const b of this.bricks) {
        if (!b.alive || b.type === 'portal') continue;
        const hit = U.circleRect(ball.x, ball.y, ball.r, b.x, b.y, b.w, b.h);
        if (hit) {
          ball.x += hit.nx * (hit.pen + 0.5);
          ball.y += hit.ny * (hit.pen + 0.5);
        }
      }
      for (const w of this.walls) {
        const hit = U.circleRect(ball.x, ball.y, ball.r, w.x, w.y, w.w, w.h);
        if (hit) {
          ball.x += hit.nx * (hit.pen + 0.5);
          ball.y += hit.ny * (hit.pen + 0.5);
        }
      }
    }

    /* ================= 砖块伤害 ================= */
    damageBrick(brick, dmg, source, chainId) {
      if (!brick.alive) return false;

      if (brick.type === 'indestruct' || brick.type === 'portal') {
        if (source === 'ball') this.audio && this.audio.sfx('metal');
        return false;
      }
      if (brick.type === 'metal' && !(source === 'laser' || source === 'bomb' || source === 'pierce' || source === 'explosion')) {
        this.audio && this.audio.sfx('metal');
        this.particles.spark(brick.x + brick.w / 2, brick.y + brick.h / 2, '#e8eef5', 5, 130);
        return false;
      }

      // 护盾层
      if (brick.shieldHp > 0) {
        brick.shieldHp--;
        brick.flashT = 0.09;
        this.audio && this.audio.sfx('metal');
        this.particles.ring(brick.x + brick.w / 2, brick.y + brick.h / 2, '#ffd93a', 10, 160, 2.5, 0.4);
        return true; // 消耗护盾但不掉血
      }

      brick.hp -= dmg;
      brick.flashT = 0.09;
      const def = BRICKS[brick.type];
      const cx = brick.x + brick.w / 2, cy = brick.y + brick.h / 2;

      if (brick.hp > 0) {
        this.audio && this.audio.sfx('brickHit');
        this.particles.spark(cx, cy, def.glow, 4, 100);
        return true;
      }

      // ---- 摧毁 ----
      brick.alive = false;
      this.bricksDestroyed++;
      this.growthCounter++;
      if (this.growthCounter >= C.BALL.GROW_EVERY) {
        this.growthCounter = 0;
        this.baseSpeed = Math.min(this.baseSpeed + C.BALL.GROW, C.BALL.MAX);
      }

      this.audio && this.audio.sfx('brickBreak');
      this.particles.burst(cx, cy, def.color, 14, 220, 4, 0.6, 300);
      this.particles.burst(cx, cy, '#ffffff', 5, 120, 2.5, 0.4, 0);
      this.particles.shake(2.5, 90);

      this._onBrickDestroyed(brick, cx, cy, chainId);
      return true;
    }

    _onBrickDestroyed(brick, cx, cy, chainId) {
      const def = BRICKS[brick.type];
      this.ach('first_blood');
      this._comboUp(cx, cy);
      this._addScore(def.score, cx, cy);

      // 道具掉落
      if (!this.mutators.noDrops && Math.random() < this.dropChance) {
        this.drops.push(new BF.PowerDrop(cx, cy, U.weighted(BF.DROP_TABLE)));
      }

      // 爆炸连锁（继承来源链，保证连锁计数正确）
      if (brick.type === 'explosive') {
        if (chainId === undefined) chainId = (this._chainSeq = (this._chainSeq || 0) + 1);
        this.pendingBooms.push({
          x: cx, y: cy,
          r: brick.w * C.BRICK.EXPLODE_R,
          chainId,
          count: 1, t: 0.09
        });
      }
      // 冰冻领域
      if (brick.type === 'freeze') {
        this._freezeArea(cx, cy);
      }
    }

    _comboUp(x, y) {
      this.combo++;
      this.comboT = C.COMBO_TIME;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;
      this.save && this.save.bestCombo(this.maxCombo);
      if (this.combo === C.FRENZY_AT) this.ach('combo_master');
      if (this.combo >= 2) {
        this.audio && this.audio.sfx('combo');
        this.particles.addText(x, y - 22, 'COMBO ×' + this.combo, '#ffd93a', 14 + Math.min(this.combo, 12));
      }
      if (this.combo >= C.FRENZY_AT && !this.frenzy) {
        this.frenzy = true;
        this.frenzyT = C.FRENZY_T;
        this.audio && this.audio.sfx('frenzy');
        this.audio && this.audio.setFrenzy(true);
        this.particles.ring(x, y, '#ff5d7a', 30, 420, 4, 0.7);
        this.ui && this.ui.banner('FRENZY!! ×3 SCORE');
        this.particles.shake(6, 250);
      }
    }

    _addScore(base, x, y) {
      let mult = BF.comboMult(this.combo);
      if (this.frenzy) mult *= 3;
      if (this.buffs.x2 > 0) mult *= 2;
      if (this.events.doubleT > 0) mult *= 2;
      const pts = Math.round(base * mult);
      this.score += pts;
      if (x !== undefined) {
        this.particles.addText(x, y, '+' + pts, this.frenzy ? '#ff5d7a' : '#fff', 15);
      }
    }

    _freezeArea(x, y) {
      this.audio && this.audio.sfx('freeze');
      this.particles.ring(x, y, '#35e0e6', 26, 320, 3, 0.6);
      for (const b of this.bricks) {
        if (!b.alive) continue;
        const bx = b.x + b.w / 2, by = b.y + b.h / 2;
        if (Math.hypot(bx - x, by - y) < C.BRICK.FREEZE_R) {
          b.frozenT = C.BRICK.FREEZE_T;
          this.particles.trail(bx, by, '#b2fbff', 2);
        }
      }
      for (const bt of this.bullets) bt.frozenT = Math.max(bt.frozenT || 0, C.BRICK.FREEZE_T);
      for (const r of this.rotors) r.frozenT = C.BRICK.FREEZE_T;
      if (this.boss && this.boss.type === 1) this.boss.spawnT = Math.max(this.boss.spawnT, C.BRICK.FREEZE_T);
    }

    _updatePendingBooms(dt) {
      for (let i = this.pendingBooms.length - 1; i >= 0; i--) {
        const boom = this.pendingBooms[i];
        boom.t -= dt;
        if (boom.t <= 0) {
          this.pendingBooms.splice(i, 1);
          this._explode(boom.x, boom.y, boom.r, boom.chainId, boom.count);
        }
      }
    }

    _explode(x, y, r, chainId, count) {
      this.audio && this.audio.sfx('explosion');
      this.particles.burst(x, y, '#ff9f1a', 26, 340, 5, 0.7, 200);
      this.particles.burst(x, y, '#ff4757', 18, 220, 4, 0.5, 150);
      this.particles.ring(x, y, '#ffd93a', 22, 380, 3, 0.5);
      this.particles.shake(9, 220);

      let destroyed = 0;
      for (const b of this.bricks) {
        if (!b.alive || b.type === 'portal') continue;
        const bx = b.x + b.w / 2, by = b.y + b.h / 2;
        if (Math.hypot(bx - x, by - y) < r + b.w / 2) {
          const before = b.alive;
          this.damageBrick(b, 2, 'explosion', chainId);
          if (before && !b.alive) destroyed++;
        }
      }
      // 连锁统计
      const total = count + destroyed;
      if (total >= 10) this.ach('demolition');
      for (const boom of this.pendingBooms) {
        if (boom.chainId === chainId) boom.count = Math.max(boom.count, total);
      }
      // 炸弹清除范围内的敌方子弹
      for (const bt of this.bullets) {
        if (Math.hypot(bt.x - x, bt.y - y) < r) bt.dead = true;
      }
    }

    detonateBomb() {
      if (this.state !== 'playing' || this.bombs <= 0) return;
      this.bombs--;
      let target = this.balls.find(b => !b.stuck) || this.balls[0];
      const x = target ? target.x : this.paddle.x;
      const y = target ? Math.min(target.y, C.H - 120) : C.H - 200;
      this.audio && this.audio.sfx('bomb');
      this._explode(x, y, C.BOMB_R, (this._chainSeq = (this._chainSeq || 0) + 1), 0);
      this.particles.shake(16, 380);
    }

    /* ================= 掉落道具 ================= */
    _updateDrops(dt) {
      const p = this.paddle;
      for (let i = this.drops.length - 1; i >= 0; i--) {
        const d = this.drops[i];
        d.update(dt);
        if (!d.dead &&
          d.y + 13 > p.y && d.y - 13 < p.y + p.h + 8 &&
          d.x > p.x - p.w / 2 - 14 && d.x < p.x + p.w / 2 + 14) {
          d.dead = true;
          this.applyPower(d.type);
          this.particles.ring(d.x, d.y, POWER[d.type].color, 16, 240, 3, 0.5);
        }
        if (d.dead) this.drops.splice(i, 1);
      }
    }

    applyPower(type) {
      const def = POWER[type];
      if (!def) return;
      this.audio && this.audio.sfx('powerup');
      this.particles.addText(this.paddle.x, this.paddle.y - 30, def.name, def.color, 17);
      const B = this.buffs;

      switch (type) {
        case 'multi': {
          if (this.mutators.noMulti) { this.score += 300; break; }
          const cur = this.balls.filter(b => !b.stuck);
          const src = cur.length ? cur : this.balls;
          const add = [];
          for (const b of src) {
            for (const da of [-0.5, 0.5]) {
              if (this.balls.length + add.length >= 8) break;
              const nb = new BF.Ball();
              nb.stuck = false;
              nb.x = b.x; nb.y = b.y;
              const ang = Math.atan2(b.vx, -b.vy) + da;
              nb.vx = Math.sin(ang); nb.vy = -Math.cos(ang);
              if (b.stuck) { nb.x = this.paddle.x; nb.y = this.paddle.y - 20; }
              add.push(nb);
            }
          }
          this.balls.push(...add);
          if (this.balls.length >= 5) this.ach('chaos');
          break;
        }
        case 'big': B.big = 8; B.small = 0; break;
        case 'small': B.small = 8; B.big = 0; break;
        case 'slow': B.slow = 5; B.fast = 0; break;
        case 'fast': B.fast = 6; B.slow = 0; break;
        case 'laser': B.laser = 10; break;
        case 'bomb': this.bombs = Math.min(3, this.bombs + 1); break;
        case 'shield': this.shieldCharges = Math.min(3, this.shieldCharges + 1); break;
        case 'pierce': B.pierce = 6; break;
        case 'fire': B.fire = 8; break;
        case 'magnet': B.magnet = 8; break;
        case 'sticky': B.sticky = 8; break;
        case 'tinyball': B.tinyball = 8; break;
        case 'x2': B.x2 = 10; break;
        case 'life': this.lives = Math.min(5, this.lives + 1); break;
        case 'jackpot': this.score += 500; this.particles.addText(this.paddle.x, this.paddle.y - 55, '+500!', '#f5cd79', 20); break;
      }
    }

    /* ================= 激光 ================= */
    fireLaser() {
      if (this.buffs.laser <= 0 || this.laserCd > 0) return;
      this.laserCd = C.LASER_CD;
      const p = this.paddle;
      this.lasers.push({ x: p.x - p.w / 2 + 8, y: p.y - 6 });
      this.lasers.push({ x: p.x + p.w / 2 - 8, y: p.y - 6 });
      this.audio && this.audio.sfx('laser');
    }

    _updateLasers(dt) {
      for (let i = this.lasers.length - 1; i >= 0; i--) {
        const l = this.lasers[i];
        l.y -= C.LASER_SPEED * dt;
        if (l.y < -10) { this.lasers.splice(i, 1); continue; }

        let hitSomething = false;
        // 砖块
        for (const b of this.bricks) {
          if (!b.alive) continue;
          if (l.x >= b.x && l.x <= b.x + b.w && l.y >= b.y && l.y <= b.y + b.h) {
            this.damageBrick(b, 1, 'laser');
            this.particles.spark(l.x, l.y, '#ff2d95', 8, 160);
            hitSomething = true;
            break;
          }
        }
        // 移动墙
        if (!hitSomething) for (const w of this.walls) {
          if (l.x >= w.x && l.x <= w.x + w.w && l.y >= w.y && l.y <= w.y + w.h) {
            this.particles.spark(l.x, l.y, '#9aa7b8', 6, 120);
            hitSomething = true; break;
          }
        }
        // 旋转杆
        if (!hitSomething) for (const r of this.rotors) {
          const dx = l.x - r.cx, dy = l.y - r.cy;
          const ca = Math.cos(r.angle), sa = Math.sin(r.angle);
          const lx = dx * ca + dy * sa, ly = -dx * sa + dy * ca;
          if (Math.abs(lx) < r.len / 2 && Math.abs(ly) < r.th / 2 + 2) {
            this.particles.spark(l.x, l.y, '#d24dff', 6, 120);
            hitSomething = true; break;
          }
        }
        // Boss
        if (!hitSomething && this.boss && !this.boss.dying) {
          const res = this.boss.hitTestPoint(l.x, l.y);
          if (res) {
            if (res === 'core' || res === true || this.boss.type === 1) {
              this._damageBoss(1, l.x, l.y);
            } else {
              this.particles.spark(l.x, l.y, '#d24dff', 6, 120);
            }
            hitSomething = true;
          }
        }
        if (hitSomething) this.lasers.splice(i, 1);
      }
    }

    /* ================= Boss ================= */
    spawnBullet(x, y, aim, angleOff) {
      const spd = 250;
      let vx = U.rand(-30, 30), vy = spd;
      if (aim) {
        const dx = this.paddle.x - x, dy = this.paddle.y - y;
        const d = Math.hypot(dx, dy) || 1;
        const a = Math.atan2(dy, dx) + (angleOff || 0);
        vx = Math.cos(a) * spd * 0.9;
        vy = Math.abs(Math.sin(a) * spd);
      }
      this.bullets.push({ x, y, vx, vy, r: 7, frozenT: 0 });
      this.audio && this.audio.sfx('bullet');
    }

    spawnBossBricks(cx) {
      const alive = this.bricks.filter(b => b.alive).length;
      if (alive > 36) return;
      const def = BRICKS.normal;
      const w = 74;
      for (let i = 0; i < 4; i++) {
        this.bricks.push({
          type: 'normal', row: -1, col: -1,
          x0: 0, y0: 200, x: U.clamp(cx - 2 * w + i * w, C.BRICK.LEFT, C.W - C.BRICK.RIGHT - w), y: 200,
          w, h: C.BRICK.H, hp: def.hp, maxHp: def.hp,
          alive: true, frozenT: 0, shieldHp: 0, spawnT: 0,
          vx: U.rand(70, 110) * (Math.random() < 0.5 ? -1 : 1), free: true
        });
      }
    }

    _updateBoss(dt, raw) {
      if (!this.boss || this.boss.dying) {
        if (this.boss && this.boss.dying) {
          // 死亡演出（用真实时间，配合慢动作）
          this.boss.dieT -= (raw !== undefined ? raw : dt);
          if (Math.random() < 0.5) {
            const bx = this.boss.type === 1 ? this.boss.x + U.rand(-140, 140) : this.boss.x + U.rand(-40, 40);
            const by = this.boss.type === 1 ? this.boss.y + U.rand(-25, 25) : this.boss.y + U.rand(-40, 40);
            this.particles.burst(bx, by, '#ff9f1a', 16, 300, 4, 0.6, 150);
            this.particles.burst(bx, by, '#ff4757', 10, 200, 3, 0.5, 100);
          }
          this.particles.shake(8, 200);
        }
        return;
      }
      this.boss.update(dt, this);
    }

    _damageBoss(dmg, x, y) {
      if (!this.boss || this.boss.dying) return;
      const dead = this.boss.hit(dmg);
      this.audio && this.audio.sfx('bossHit');
      this.particles.burst(x, y, '#ffd93a', 10, 200, 3.5, 0.5, 100);
      this.particles.shake(3, 100);
      if (dead) this._bossDeath();
    }

    _bossDeath() {
      this.boss.dying = true;
      this.boss.dieT = 1.6;
      this.ach('boss_slayer');
      this.audio && this.audio.sfx('bossDeath');
      this.particles.shake(20, 500);
      this.timescale = 0.25; this.slowmoT = 1.0;
      this._addScore(10000);
      this.bullets.length = 0;
      // 清理 Boss 砖
      for (const b of this.bricks) {
        if (b.free && b.alive) {
          b.alive = false;
          this.particles.burst(b.x + b.w / 2, b.y + b.h / 2, '#ff9f1a', 8, 200, 3, 0.5, 100);
        }
      }
      if (this.mode === 'rush') {
        if (this.rushIdx === 0) {
          this.clearDelay = 2.2;
          this._pendingRushNext = true;
        } else {
          this.clearDelay = 2.2;
          this._pendingVictory = true;
        }
      } else {
        this.clearDelay = 2.2;
      }
    }

    /* ================= 敌方子弹 / 陨石 ================= */
    _updateBullets(dt) {
      for (let i = this.bullets.length - 1; i >= 0; i--) {
        const b = this.bullets[i];
        if (b.frozenT > 0) { b.frozenT -= dt; continue; }
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (Math.random() < 0.3) this.particles.trail(b.x, b.y, '#ff2d95', 2.2);

        if (b.y > C.H + 20 || b.x < -20 || b.x > C.W + 20) { this.bullets.splice(i, 1); continue; }

        // 护盾拦截
        if (b.y + b.r >= C.H - 7 && this.shieldCharges > 0) {
          this.shieldCharges--;
          this.particles.ring(b.x, C.H - 6, '#3ae374', 12, 200, 2.5, 0.4);
          this.audio && this.audio.sfx('shield');
          this.bullets.splice(i, 1);
          continue;
        }
        // 命中挡板 → 损失生命
        const p = this.paddle;
        const hit = U.circleRect(b.x, b.y, b.r, p.x - p.w / 2, p.y, p.w, p.h);
        if (hit) {
          this.bullets.splice(i, 1);
          this.particles.burst(b.x, b.y, '#ff2d95', 18, 260, 4, 0.6, 200);
          this._loseLife(true);
        }
      }
    }

    _updateMeteors(dt) {
      if (this.events.meteorT > 0) {
        this.events.meteorT -= dt;
        this.events.meteorSpawn -= dt;
        if (this.events.meteorSpawn <= 0) {
          this.events.meteorSpawn = 0.35;
          this.meteors.push({ x: U.rand(40, C.W - 40), y: -20, vy: 430, r: 9 });
        }
      }
      for (let i = this.meteors.length - 1; i >= 0; i--) {
        const m = this.meteors[i];
        m.y += m.vy * dt;
        this.particles.trail(m.x, m.y, '#ff8c3a', 3);
        if (Math.random() < 0.3) this.particles.trail(m.x + U.rand(-4, 4), m.y, '#ffd93a', 2);
        if (m.y > C.H + 20) { this.meteors.splice(i, 1); continue; }
        for (const b of this.bricks) {
          if (!b.alive) continue;
          if (m.x > b.x && m.x < b.x + b.w && m.y > b.y && m.y < b.y + b.h) {
            this.damageBrick(b, 3, 'explosion');
            this.particles.burst(m.x, m.y, '#ff8c3a', 14, 240, 4, 0.5, 150);
            this.meteors.splice(i, 1);
            break;
          }
        }
      }
    }

    /* ================= 机关 ================= */
    _updateMechanisms(dt) {
      for (const w of this.walls) {
        w.x = w.x0 + Math.sin(this.time * w.spd) * w.range;
      }
      for (const r of this.rotors) {
        if (r.frozenT > 0) { r.frozenT -= dt; continue; }
        r.angle += r.speed * dt;
      }
    }

    /* ================= 随机事件 ================= */
    _updateEvents(dt) {
      const E = this.events;
      if (E.gravityT > 0) E.gravityT -= dt;
      if (E.blackoutT > 0) E.blackoutT -= dt;
      if (E.doubleT > 0) E.doubleT -= dt;
      if (E.speedT > 0) E.speedT -= dt;

      const allowEvents = (this.mode === 'endless') || (this.levelDef && this.levelDef.events) || (this.mode === 'time');
      if (!allowEvents || this.introT > 0) return;

      this.eventT -= dt;
      if (this.eventT <= 0) {
        this.eventT = U.rand(C.EVENTS_EVERY[0], C.EVENTS_EVERY[1]);
        const pool = ['meteor', 'gravity', 'blackout', 'double', 'speed'];
        const ev = U.choice(pool);
        this.audio && this.audio.sfx('event');
        switch (ev) {
          case 'meteor':
            E.meteorT = 4; E.meteorSpawn = 0;
            this.ui.banner('☄ 陨石风暴');
            break;
          case 'gravity':
            E.gravityT = 8;
            this.ui.banner('🪐 引力异常');
            break;
          case 'blackout':
            E.blackoutT = 6;
            this.ui.banner('⚫ 黑暗降临');
            break;
          case 'double':
            E.doubleT = 10;
            this.ui.banner('✦ 双倍积分');
            break;
          case 'speed':
            E.speedT = 8;
            this.ui.banner('⚡ 能量加速');
            break;
        }
      }
    }

    /* ================= Combo 计时 ================= */
    _updateCombo(dt) {
      if (this.combo > 0) {
        this.comboT -= dt;
        if (this.comboT <= 0) this.combo = 0;
      }
    }

    /* ================= 模式逻辑 ================= */
    _updateMode(dt) {
      if (this.mode === 'endless') {
        this.endless.pushT -= dt;
        if (this.endless.pushT <= 0) this._endlessPush();
        // 砖块压线 → 失败
        for (const b of this.bricks) {
          if (b.alive && b.y + b.h > this.paddle.y - 10) {
            this._gameOver();
            return;
          }
        }
      } else if (this.mode === 'time') {
        this.timeAttack.left -= dt;
        if (this.timeAttack.left <= 0) {
          this.timeAttack.left = 0;
          this.save.setBest('timeBest', this.score);
          this._gameOver(true);
        }
      }
    }

    /* ================= 生命 / 失败 ================= */
    _loseLife(fromBullet) {
      this.combo = 0;
      if (this.frenzy) { this.frenzy = false; this.frenzyT = 0; this.audio && this.audio.setFrenzy(false); }
      this.paddleBounces = 0;
      this.particles.shake(fromBullet ? 8 : 5, 300);
      this.audio && this.audio.sfx('lifeLost');

      if (this.mode === 'time') {
        // 限时模式不扣命，快速重生
        this.respawnT = 0.7;
        return;
      }

      this.lives--;
      this.livesLost++;
      this.bullets.length = 0;
      this.particles.addText(C.W / 2, C.H / 2, this.lives > 0 ? 'BALL LOST' : 'GAME OVER', '#ff4d6d', 26);

      if (this.lives <= 0) {
        this._gameOver();
      } else {
        this.respawnT = 0.6;
      }
    }

    _gameOver(timeUp) {
      if (this.state !== 'playing') return;
      this.state = 'over';
      this.audio && this.audio.sfx('gameOver');
      this.audio && this.audio.setFrenzy(false);
      if (this.mode === 'endless') this.save.setBest('endlessBest', this.score);
      if (this.mode === 'classic') this.save.setBest('classicBest', this.score);
      if (this.mode === 'rush') this.save.setBest('rushBest', this.score);
      this.ui.show('over', this.getStats(timeUp));
    }

    /* ================= 通关 ================= */
    _countDestroyable() {
      let n = 0;
      for (const b of this.bricks) if (b.alive && BF.DESTROYABLE[b.type]) n++;
      return n;
    }

    _checkClear() {
      if (this.state !== 'playing' || this.clearDelay > 0) return;

      if (this.boss) {
        return; // Boss 关由 Boss 死亡流程处理
      }
      if (this._countDestroyable() === 0 && this.totalBricks > 0) {
        // Boss 生成的自由砖不算目标，但普通关清空即胜
        if (this.mode === 'time') {
          this.timeAttack.left = Math.min(this.timeAttack.left + 5, 120);
          this.timeAttack.cleared++;
          this._addScore(500);
          this.particles.ring(C.W / 2, C.H / 2, '#ffd93a', 30, 400, 4, 0.8);
          this.ui.banner('+5 秒!');
          this.audio && this.audio.sfx('levelClear');
          this._timeLoadPattern();
          for (const ball of this.balls) this._resolveBallOverlaps(ball);
          return;
        }
        if (this.mode === 'endless') return;
        this.clearDelay = 0.9;
        this.audio && this.audio.sfx('levelClear');
      }
    }

    _levelClearFinish() {
      this.state = 'clear';
      this.audio && this.audio.setFrenzy(false);

      if (this.mode === 'rush' && this._pendingRushNext) {
        // 进入第二个 Boss
        this._pendingRushNext = false;
        this.rushIdx = 1;
        const keepScore = this.score, keepLives = this.lives, keepBounces = this.paddleBounces;
        this._applyLevel({ id: 0, name: '霓虹核心', boss: 2, speed: 1.05, par: 180 });
        this.score = keepScore; this.lives = keepLives; this.paddleBounces = keepBounces;
        this.bricks.length = 0; this.drops.length = 0; this.lasers.length = 0;
        this.balls.length = 0;
        this.state = 'playing';
        this.spawnBall();
        this.ui.banner('BOSS RUSH — 霓虹核心');
        this.introT = 1.2;
        return;
      }
      if (this.mode === 'rush' && this._pendingVictory) {
        this._pendingVictory = false;
        this.save.setBest('rushBest', this.score);
        this.state = 'victory';
        this.ui.show('victory', this.getStats(false, 'BOSS RUSH 通关！'));
        return;
      }

      // 星级与奖励结算
      const def = this.levelDef || {};
      const remaining = this._countDestroyable();
      const total = this.totalBricks;
      const timeBonus = Math.max(0, Math.round(((def.par || 90) - this.levelTime) * 8));
      const noDeathBonus = this.livesLost === 0 ? 1000 : 0;
      const clearBonus = def.boss ? 1500 : (remaining === 0 && total > 0 ? 500 + total * 10 : 0);
      const bonus = timeBonus + noDeathBonus + clearBonus;
      this.score += bonus;

      let stars = 1;
      const two = def.two || Math.round(total * 150);
      const three = def.three || Math.round(total * 240);
      const finalScore = this.score;
      if (finalScore >= two) stars = 2;
      if (finalScore >= three && this.livesLost === 0) stars = 3;

      if (this.mode === 'story') {
        const id = this.currentLevel;
        this.save.setStars(id, stars);
        this.save.setHigh(id, finalScore);
        this.save.unlockLevel(Math.min(id + 1, BF.LEVELS.length));
        if (this.livesLost === 0) this.ach('survivor');
        if (stars === 3) this.ach('perfect');
        const isLast = id >= BF.LEVELS.length;
        this.ui.show(isLast ? 'victory' : 'clear', this.getStats(false, isLast ? '故事模式通关！' : null, { stars, bonus, timeBonus, noDeathBonus }));
        if (isLast) { this.save.data.storyDone = true; this.save.save(); }
      } else if (this.mode === 'challenge') {
        if (!this.save.data.challenges[this.currentChallenge]) {
          this.save.data.challenges[this.currentChallenge] = true;
          this.save.save();
        }
        this.ui.show('clear', this.getStats(false, '挑战完成！', { stars, bonus, timeBonus, noDeathBonus }));
      } else if (this.mode === 'classic') {
        this.classicIdx++;
        if (this.classicIdx >= BF.CLASSIC.length) {
          this.save.setBest('classicBest', this.score);
          this.state = 'victory';
          this.ui.show('victory', this.getStats(false, '经典模式通关！'));
        } else {
          const keep = { score: this.score, lives: this.lives, maxCombo: this.maxCombo, livesLost: this.livesLost, bricks: this.bricksDestroyed, baseSpeed: this.baseSpeed };
          this._applyLevel({ id: 0, name: '经典 ' + (this.classicIdx + 1), map: BF.CLASSIC[this.classicIdx], speed: 0.95 + this.classicIdx * 0.05, par: 90 });
          this.score = keep.score; this.lives = keep.lives; this.maxCombo = keep.maxCombo;
          this.livesLost = keep.livesLost; this.bricksDestroyed = keep.bricks; this.baseSpeed = keep.baseSpeed;
          this.balls.length = 0; this.drops.length = 0; this.lasers.length = 0;
          this.state = 'playing';
          this.spawnBall();
          this.introT = 1.2;
          this.ui.banner('CLASSIC — 经典 ' + (this.classicIdx + 1));
        }
      }
    }

    nextLevel() {
      if (this.mode === 'story') {
        this.startStoryLevel(Math.min(this.currentLevel + 1, BF.LEVELS.length));
      } else if (this.mode === 'classic') {
        this.state = 'playing';
      } else if (this.mode === 'challenge') {
        this.state = 'playing';
        this.startChallenge(this.currentChallenge);
      }
    }

    restartLevel() {
      if (this.mode === 'story') this.startStoryLevel(this.currentLevel);
      else if (this.mode === 'classic') this.startClassic();
      else if (this.mode === 'endless') this.startEndless();
      else if (this.mode === 'time') this.startTimeAttack();
      else if (this.mode === 'rush') this.startBossRush();
      else if (this.mode === 'challenge') this.startChallenge(this.currentChallenge);
    }

    /* ================= 暂停 / 菜单 ================= */
    togglePause() {
      if (this.state === 'playing') {
        this.state = 'paused';
        this.ui.show('pause');
        this.audio && this.audio.setFrenzy(false);
      } else if (this.state === 'paused') {
        this.state = 'playing';
        this.ui.show(null);
      }
    }

    exitToMenu() {
      this.state = 'menu';
      this.mode = null;
      this.audio && this.audio.setFrenzy(false);
      this.particles.reset();
      this.ui.setHUDVisible(false);
      this.ui.show('menu');
    }

    resume() { if (this.state === 'paused') this.togglePause(); }

    getStats(timeUp, title, extra) {
      return {
        mode: this.mode,
        level: this.mode === 'story' ? this.currentLevel : (this.levelDef ? this.levelDef.name : ''),
        score: this.score,
        maxCombo: this.maxCombo,
        bricks: this.bricksDestroyed,
        total: this.totalBricks,
        time: this.levelTime,
        timeUp: !!timeUp,
        title: title || null,
        extra: extra || null,
        best: this.save ? this.save.data : null
      };
    }

    ach(id) {
      if (!this.save) return;
      if (this.save.unlockAch(id)) {
        const def = BF.ACHIEVEMENTS.find(a => a.id === id);
        this.audio && this.audio.sfx('ach');
        this.ui && this.ui.toast('🏆 成就解锁', def ? def.name : id);
      }
    }

    /* ================= 输入回调 ================= */
    firstInteract() {
      this.audio && this.audio.init();
    }

    onPointerMove(x) { this.pointerX = x; }

    onPointerDown(x, y, btn) {
      if (this.state !== 'playing') return;
      if (btn === 2) { this.detonateBomb(); return; }
      this._primaryAction();
    }

    onPointerUp() {}

    _primaryAction() {
      let launched = false;
      for (const b of this.balls) {
        if (b.stuck) { this._launchBall(b); launched = true; }
      }
      if (!launched) this.fireLaser();
    }

    onKey(code, down) {
      if (!down) return;
      switch (code) {
        case 'Space': if (this.state === 'playing') this._primaryAction(); break;
        case 'KeyB': if (this.state === 'playing') this.detonateBomb(); break;
        case 'KeyP':
        case 'Escape':
          if (this.state === 'playing' || this.state === 'paused') this.togglePause();
          break;
      }
    }

    onHidden() {
      if (this.state === 'playing') this.togglePause();
    }

    /* ============================================================
     * 渲染
     * ============================================================ */
    render() {
      const ctx = this.ctx;
      const s = this._scale * this._dpr;
      ctx.setTransform(s, 0, 0, s, 0, 0);
      ctx.clearRect(0, 0, C.W, C.H);

      // 屏幕震动
      ctx.save();
      ctx.translate(this.particles.shakeX, this.particles.shakeY);

      this._renderBg(ctx);
      this._renderHoles(ctx);
      this._renderWalls(ctx);
      this._renderRotors(ctx);
      this._renderBricks(ctx);
      if (this.boss) this._renderBoss(ctx);
      this._renderMeteors(ctx);
      this._renderBullets(ctx);
      this._renderDrops(ctx);
      this._renderLasers(ctx);
      this._renderShieldLine(ctx);
      this._renderPaddle(ctx);
      this._renderBalls(ctx);
      this.particles.render(ctx);
      this._renderBlackout(ctx);
      this._renderOverlays(ctx);

      ctx.restore();
    }

    _renderBg(ctx) {
      // 深空底色
      const g = ctx.createLinearGradient(0, 0, 0, C.H);
      g.addColorStop(0, '#05070f');
      g.addColorStop(0.5, '#0a0e1f');
      g.addColorStop(1, '#0d0817');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, C.W, C.H);

      const par = (this.paddle ? (this.paddle.x - C.W / 2) : 0) * 0.02;

      // 星云
      const neb = [
        { x: 250 + Math.sin(this.time * 0.05) * 30, y: 160, r: 260, c: 'rgba(46,134,255,0.07)' },
        { x: 760 + Math.cos(this.time * 0.04) * 30, y: 380, r: 300, c: 'rgba(210,77,255,0.06)' },
        { x: 500, y: 600 + Math.sin(this.time * 0.03) * 20, r: 240, c: 'rgba(53,224,230,0.05)' }
      ];
      for (const n of neb) {
        const rg = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
        rg.addColorStop(0, n.c);
        rg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = rg;
        ctx.fillRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
      }

      // 网格
      ctx.strokeStyle = 'rgba(90,120,200,0.05)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= C.W; x += 50) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, C.H); ctx.stroke();
      }
      for (let y = 0; y <= C.H; y += 50) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(C.W, y); ctx.stroke();
      }

      // 星星
      for (const st of this.stars) {
        const tw = 0.5 + 0.5 * Math.sin(this.time * 1.5 + st.tw);
        ctx.globalAlpha = 0.25 + tw * 0.5 * st.layer;
        ctx.fillStyle = st.layer > 0.5 ? '#cfe2ff' : '#8ea8d8';
        ctx.beginPath();
        ctx.arc(st.x - par * st.layer, st.y, st.r, 0, U.TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    _renderBricks(ctx) {
      for (const b of this.bricks) {
        if (!b.alive) continue;
        const def = BRICKS[b.type];
        const t = this.time;

        // 出生动画
        let scale = 1;
        if (b.spawnT !== undefined) {
          const k = U.clamp((this.time - b.spawnT) / 0.25, 0, 1);
          scale = 0.5 + 0.5 * (1 - Math.pow(1 - k, 3));
          if (k < 1) {
            b.spawnAlpha = k;
          }
        }
        const alpha = b.spawnAlpha !== undefined && this.time < b.spawnT + 0.3 ? b.spawnAlpha : 1;

        ctx.save();
        ctx.globalAlpha = alpha;
        const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
        ctx.translate(cx, cy);
        ctx.scale(scale, scale);
        ctx.translate(-cx, -cy);

        // 主体
        let base = def.color;
        if (b.frozenT > 0) base = '#7fd8e8';
        const g = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
        g.addColorStop(0, this._lighten(base, 0.35));
        g.addColorStop(0.5, base);
        g.addColorStop(1, this._darken(base, 0.35));
        ctx.fillStyle = g;
        ctx.shadowColor = def.glow;
        ctx.shadowBlur = b.type === 'explosive' ? 12 + Math.sin(t * 6) * 6 : 7;
        BF.roundRect(ctx, b.x, b.y, b.w, b.h, 4);
        ctx.fill();
        ctx.shadowBlur = 0;

        // 受击白闪
        if (b.flashT > 0) {
          ctx.fillStyle = 'rgba(255,255,255,' + (U.clamp(b.flashT / 0.09, 0, 1) * 0.55) + ')';
          BF.roundRect(ctx, b.x, b.y, b.w, b.h, 4);
          ctx.fill();
        }

        // 类型装饰
        ctx.lineWidth = 1.5;
        if (b.type === 'metal' || b.type === 'indestruct') {
          ctx.strokeStyle = 'rgba(255,255,255,0.28)';
          for (let i = 1; i < 4; i++) {
            const lx = b.x + (b.w / 4) * i;
            ctx.beginPath(); ctx.moveTo(lx, b.y + 3); ctx.lineTo(lx - 4, b.y + b.h - 3); ctx.stroke();
          }
        } else if (b.type === 'explosive') {
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.beginPath();
          ctx.arc(cx, cy, 3.5 + Math.sin(t * 8) * 1.2, 0, U.TAU);
          ctx.fill();
        } else if (b.type === 'freeze') {
          ctx.strokeStyle = 'rgba(255,255,255,0.7)';
          for (let i = 0; i < 3; i++) {
            const a = t * 0.8 + i * 2.1;
            ctx.beginPath();
            ctx.arc(cx, cy, 5 + i * 3, a, a + 1.2);
            ctx.stroke();
          }
        } else if (b.type === 'portal') {
          ctx.strokeStyle = def.glow;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(cx, cy, Math.min(b.w, b.h) / 2 - 3, t * 2, t * 2 + 4.5);
          ctx.stroke();
          ctx.strokeStyle = 'rgba(255,255,255,0.5)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(cx, cy, Math.min(b.w, b.h) / 2 - 8, -t * 3, -t * 3 + 3.5);
          ctx.stroke();
        } else if (b.type === 'moving') {
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          const dir = Math.cos(this.time * 0.9 + b.movePhase) >= 0 ? 1 : -1;
          const ax = cx + dir * (b.w / 2 - 9);
          ctx.beginPath();
          ctx.moveTo(ax, cy - 4); ctx.lineTo(ax + dir * 6, cy); ctx.lineTo(ax, cy + 4);
          ctx.closePath(); ctx.fill();
        }

        // 受损裂纹
        if (isFinite(b.maxHp) && b.hp < b.maxHp) {
          ctx.strokeStyle = 'rgba(0,0,0,0.55)';
          ctx.lineWidth = 1.6;
          const dmg = 1 - b.hp / b.maxHp;
          ctx.beginPath();
          ctx.moveTo(b.x + b.w * 0.3, b.y + 2);
          ctx.lineTo(b.x + b.w * 0.45, b.y + b.h * (0.35 + dmg * 0.2));
          ctx.lineTo(b.x + b.w * 0.32, b.y + b.h - 2);
          if (dmg > 0.5) {
            ctx.moveTo(b.x + b.w * 0.65, b.y + 2);
            ctx.lineTo(b.x + b.w * 0.55, b.y + b.h * 0.6);
            ctx.lineTo(b.x + b.w * 0.7, b.y + b.h - 2);
          }
          ctx.stroke();
        }
        // 护盾层
        if (b.shieldHp > 0) {
          ctx.strokeStyle = 'rgba(255,217,58,0.9)';
          ctx.lineWidth = 2;
          ctx.shadowColor = '#ffd93a';
          ctx.shadowBlur = 8;
          BF.roundRect(ctx, b.x - 2, b.y - 2, b.w + 4, b.h + 4, 6);
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
        // 冰冻覆盖
        if (b.frozenT > 0) {
          ctx.fillStyle = 'rgba(178,251,255,0.3)';
          BF.roundRect(ctx, b.x, b.y, b.w, b.h, 4);
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.6)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(b.x + 4, b.y + b.h - 4);
          ctx.lineTo(b.x + b.w * 0.4, b.y + 4);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    _renderWalls(ctx) {
      for (const w of this.walls) {
        const g = ctx.createLinearGradient(w.x, w.y, w.x, w.y + w.h);
        g.addColorStop(0, '#6b7688');
        g.addColorStop(0.5, '#3c4454');
        g.addColorStop(1, '#252b38');
        ctx.fillStyle = g;
        ctx.shadowColor = '#9aa7b8';
        ctx.shadowBlur = 8;
        BF.roundRect(ctx, w.x, w.y, w.w, w.h, 4);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(w.x + 3, w.y + 3, w.w - 6, 2);
      }
    }

    _renderRotors(ctx) {
      for (const r of this.rotors) {
        ctx.save();
        ctx.translate(r.cx, r.cy);
        ctx.rotate(r.angle);
        const g = ctx.createLinearGradient(-r.len / 2, 0, r.len / 2, 0);
        g.addColorStop(0, 'rgba(210,77,255,0.1)');
        g.addColorStop(0.5, r.frozenT > 0 ? '#7fd8e8' : '#b14dff');
        g.addColorStop(1, 'rgba(210,77,255,0.1)');
        ctx.fillStyle = g;
        ctx.shadowColor = '#b14dff';
        ctx.shadowBlur = 12;
        BF.roundRect(ctx, -r.len / 2, -r.th / 2, r.len, r.th, 6);
        ctx.fill();
        // 中心轴
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(0, 0, 4, 0, U.TAU); ctx.fill();
        ctx.restore();
      }
    }

    _renderHoles(ctx) {
      for (const h of this.holes) {
        const t = this.time;
        const g = ctx.createRadialGradient(h.x, h.y, 4, h.x, h.y, h.r);
        g.addColorStop(0, 'rgba(0,0,0,0.9)');
        g.addColorStop(0.35, 'rgba(90,20,140,0.5)');
        g.addColorStop(0.7, 'rgba(177,77,255,0.12)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, U.TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(210,77,255,0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(h.x, h.y, 26 + Math.sin(t * 3) * 3, 10 + Math.sin(t * 2) * 2, t * 0.5, 0, U.TAU);
        ctx.stroke();
      }
    }

    _renderBoss(ctx) {
      if (this.boss.dying) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.boss.dieT / 1.6);
        this.boss.render(ctx, this);
        ctx.restore();
        return;
      }
      this.boss.render(ctx, this);
    }

    _renderBullets(ctx) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const b of this.bullets) {
        const col = b.frozenT > 0 ? '#7fd8e8' : '#ff2d95';
        ctx.fillStyle = col;
        ctx.shadowColor = col;
        ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, U.TAU); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.4, 0, U.TAU); ctx.fill();
      }
      ctx.restore();
    }

    _renderMeteors(ctx) {
      for (const m of this.meteors) {
        const g = ctx.createRadialGradient(m.x, m.y, 1, m.x, m.y, m.r + 6);
        g.addColorStop(0, '#fff');
        g.addColorStop(0.3, '#ffd93a');
        g.addColorStop(1, 'rgba(255,110,40,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(m.x, m.y, m.r + 6, 0, U.TAU); ctx.fill();
      }
    }

    _renderDrops(ctx) {
      for (const d of this.drops) {
        const def = POWER[d.type];
        if (!def) continue;
        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.rotate(Math.sin(d.rot) * 0.4);
        const s = 13;
        ctx.shadowColor = def.color;
        ctx.shadowBlur = 14;
        ctx.fillStyle = def.color;
        ctx.beginPath();
        ctx.moveTo(0, -s); ctx.lineTo(s, 0); ctx.lineTo(0, s); ctx.lineTo(-s, 0);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.beginPath();
        ctx.moveTo(0, -s + 5); ctx.lineTo(s - 5, 0); ctx.lineTo(0, s - 5); ctx.lineTo(-s + 5, 0);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px "Orbitron", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(def.label, 0, 0.5);
        ctx.restore();
      }
    }

    _renderLasers(ctx) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const l of this.lasers) {
        const g = ctx.createLinearGradient(l.x, l.y - 18, l.x, l.y + 4);
        g.addColorStop(0, 'rgba(255,45,149,0)');
        g.addColorStop(0.7, '#ff2d95');
        g.addColorStop(1, '#fff');
        ctx.fillStyle = g;
        ctx.fillRect(l.x - 2, l.y - 18, 4, 22);
        ctx.shadowColor = '#ff2d95';
        ctx.shadowBlur = 10;
        ctx.fillRect(l.x - 1, l.y - 14, 2, 16);
      }
      ctx.restore();
    }

    _renderShieldLine(ctx) {
      if (this.shieldCharges <= 0) return;
      const y = C.H - 6;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const alpha = 0.4 + 0.25 * Math.sin(this.time * 5);
      ctx.strokeStyle = 'rgba(58,227,116,' + alpha + ')';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#3ae374';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.moveTo(C.WALL, y);
      for (let x = C.WALL; x <= C.W - C.WALL; x += 40) {
        ctx.lineTo(x, y + Math.sin(this.time * 4 + x * 0.05) * 2);
      }
      ctx.stroke();
      // 剩余次数
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#3ae374';
      for (let i = 0; i < this.shieldCharges; i++) {
        ctx.beginPath();
        ctx.arc(C.W - 24 - i * 16, y - 12, 4, 0, U.TAU);
        ctx.fill();
      }
      ctx.restore();
    }

    _renderPaddle(ctx) {
      const p = this.paddle;
      if (!p) return;
      const x = p.x - p.w / 2, y = p.y;
      ctx.save();

      // 磁力场
      if (this.buffs.magnet > 0) {
        ctx.strokeStyle = 'rgba(56,173,169,' + (0.15 + 0.1 * Math.sin(this.time * 6)) + ')';
        ctx.lineWidth = 2;
        for (let i = 1; i <= 3; i++) {
          ctx.beginPath();
          ctx.arc(p.x, y + p.h / 2, 24 * i, Math.PI * 1.15, Math.PI * 1.85);
          ctx.stroke();
        }
      }

      const flash = p.flashT > 0;
      const g = ctx.createLinearGradient(x, y, x, y + p.h);
      if (this.buffs.sticky > 0) { g.addColorStop(0, '#b8ffd0'); g.addColorStop(0.5, '#7bed9f'); g.addColorStop(1, '#2e8b57'); }
      else if (flash) { g.addColorStop(0, '#fff'); g.addColorStop(1, '#63d2ff'); }
      else { g.addColorStop(0, '#aef'); g.addColorStop(0.5, '#4da6ff'); g.addColorStop(1, '#1a5fd0'); }
      ctx.fillStyle = g;
      ctx.shadowColor = this.buffs.sticky > 0 ? '#7bed9f' : '#4da6ff';
      ctx.shadowBlur = 16;
      BF.roundRect(ctx, x, y, p.w, p.h, 7);
      ctx.fill();
      ctx.shadowBlur = 0;

      // 能量核心
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      const coreW = Math.min(34, p.w * 0.24);
      BF.roundRect(ctx, p.x - coreW / 2, y + 3, coreW, p.h - 6, 3);
      ctx.fill();

      // 激光炮
      if (this.buffs.laser > 0) {
        ctx.fillStyle = '#ff2d95';
        ctx.shadowColor = '#ff2d95';
        ctx.shadowBlur = 8;
        BF.roundRect(ctx, x + 4, y - 7, 7, 8, 2); ctx.fill();
        BF.roundRect(ctx, x + p.w - 11, y - 7, 7, 8, 2); ctx.fill();
        ctx.shadowBlur = 0;
      }
      ctx.restore();
    }

    _renderBalls(ctx) {
      for (const ball of this.balls) {
        // 拖尾
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const fire = this.buffs.fire > 0;
        const col = fire ? '#ff6348' : this.buffs.pierce > 0 ? '#c56cf0' : this.frenzy ? '#ff5d7a' : '#63d2ff';
        for (let i = 0; i < ball.trail.length; i++) {
          const t = i / ball.trail.length;
          const pos = ball.trail[i];
          ctx.globalAlpha = t * 0.35;
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, ball.r * (0.3 + t * 0.6), 0, U.TAU);
          ctx.fill();
        }
        // 球体
        ctx.globalAlpha = 1;
        const g = ctx.createRadialGradient(ball.x - ball.r * 0.3, ball.y - ball.r * 0.3, 1, ball.x, ball.y, ball.r);
        g.addColorStop(0, '#fff');
        g.addColorStop(0.55, col);
        g.addColorStop(1, this.frenzy ? '#ff2d55' : '#1a6dd0');
        ctx.fillStyle = g;
        ctx.shadowColor = col;
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.r, 0, U.TAU);
        ctx.fill();
        ctx.restore();
      }
    }

    _renderBlackout(ctx) {
      if (this.events.blackoutT <= 0) return;
      const f = this.fxctx;
      f.clearRect(0, 0, C.W, C.H);
      f.fillStyle = 'rgba(0,0,10,0.82)';
      f.fillRect(0, 0, C.W, C.H);
      f.globalCompositeOperation = 'destination-out';
      const holes = [];
      for (const b of this.balls) holes.push({ x: b.x, y: b.y, r: 90 });
      holes.push({ x: this.paddle.x, y: this.paddle.y, r: 130 });
      for (const h of holes) {
        const g = f.createRadialGradient(h.x, h.y, 10, h.x, h.y, h.r);
        g.addColorStop(0, 'rgba(0,0,0,1)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        f.fillStyle = g;
        f.beginPath(); f.arc(h.x, h.y, h.r, 0, U.TAU); f.fill();
      }
      f.globalCompositeOperation = 'source-over';
      ctx.drawImage(this.fx, 0, 0);
    }

    _renderOverlays(ctx) {
      // 狂暴边缘
      if (this.frenzy) {
        const a = 0.22 + 0.1 * Math.sin(this.time * 10);
        const g = ctx.createRadialGradient(C.W / 2, C.H / 2, C.H * 0.35, C.W / 2, C.H / 2, C.H * 0.75);
        g.addColorStop(0, 'rgba(255,45,90,0)');
        g.addColorStop(1, 'rgba(255,45,90,' + a + ')');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, C.W, C.H);
      }
      // 关卡开场
      if (this.introT > 0 && this.state === 'playing') {
        const a = U.clamp(this.introT / 0.4, 0, 1) * U.clamp((1.6 - this.introT) / 0.3, 0, 1);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(0, C.H * 0.32, C.W, 120);
        ctx.textAlign = 'center';
        ctx.font = 'bold 40px "Orbitron", "PingFang SC", sans-serif';
        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#63d2ff';
        ctx.shadowBlur = 24;
        const name = this.levelDef ? this.levelDef.name : '';
        ctx.fillText(name, C.W / 2, C.H * 0.32 + 52);
        ctx.font = '16px "PingFang SC", sans-serif';
        ctx.shadowBlur = 8;
        ctx.fillStyle = '#9cc8ff';
        ctx.fillText('点击 / 空格 发射能量球', C.W / 2, C.H * 0.32 + 86);
        ctx.restore();
      }
    }

    /* 颜色工具 */
    _lighten(hex, k) { return this._mix(hex, '#ffffff', k); }
    _darken(hex, k) { return this._mix(hex, '#000000', k); }
    _mix(h1, h2, k) {
      try {
        const p = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
        const a = p(h1), b = p(h2);
        const r = Math.round(U.lerp(a[0], b[0], k));
        const g = Math.round(U.lerp(a[1], b[1], k));
        const bl = Math.round(U.lerp(a[2], b[2], k));
        return 'rgb(' + r + ',' + g + ',' + bl + ')';
      } catch (e) { return h1; }
    }
  }

  BF.Game = Game;
})();

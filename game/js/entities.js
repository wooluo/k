/* ============================================================
 * BRICKFALL — 实体：球 / 道具掉落 / Boss / 旋转杆碰撞
 * ============================================================ */
(function () {
  'use strict';
  const U = BF.U, C = BF.C;

  /* ---------------- 球 ---------------- */
  class Ball {
    constructor() {
      this.x = 0; this.y = 0;
      this.r = C.BALL.R;
      this.vx = 0; this.vy = -1;
      this.stuck = true;          // 粘在挡板上等待发射
      this.stuckOffset = 0;       // 相对挡板中心偏移
      this.stuckT = 0;
      this.teleCd = 0;            // 传送冷却
      this.noHit = 0;             // 传送后短暂免碰撞
      this.dead = false;
      this.trail = [];
    }

    launch(angle) {
      this.stuck = false;
      const a = angle !== undefined ? angle : U.rand(-0.35, 0.35);
      this.vx = Math.sin(a);
      this.vy = -Math.cos(a);
    }

    get speed() {
      return Math.hypot(this.vx, this.vy);
    }
  }

  /* ---------------- 道具掉落物 ---------------- */
  class PowerDrop {
    constructor(x, y, type) {
      this.x = x; this.y = y;
      this.type = type;
      this.vy = C.DROP_VY;
      this.rot = 0;
      this.dead = false;
    }
    update(dt) {
      this.y += this.vy * dt;
      this.rot += dt * 3;
      if (this.y > C.H + 30) this.dead = true;
    }
  }

  /* ---------------- 旋转杆碰撞（世界系旋转矩形） ---------------- */
  function rotorCollide(ball, cx, cy, len, th, ang) {
    const dx = ball.x - cx, dy = ball.y - cy;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    // 变换到杆局部坐标
    const lx = dx * ca + dy * sa;
    const ly = -dx * sa + dy * ca;
    const hw = len / 2, hh = th / 2;
    const qx = U.clamp(lx, -hw, hw);
    const qy = U.clamp(ly, -hh, hh);
    let ddx = lx - qx, ddy = ly - qy;
    const d2 = ddx * ddx + ddy * ddy;
    if (d2 > ball.r * ball.r) return null;

    let nlx, nly, pen;
    if (d2 > 1e-9) {
      const d = Math.sqrt(d2);
      nlx = ddx / d; nly = ddy / d; pen = ball.r - d;
    } else {
      // 球心在杆内：沿短轴推出
      nlx = 0; nly = ly >= 0 ? 1 : -1; pen = hh - Math.abs(ly) + ball.r;
    }
    // 法线转回世界坐标
    const nx = nlx * ca - nly * sa;
    const ny = nlx * sa + nly * ca;
    return { nx, ny, pen };
  }

  /* ============================================================
   * Boss 1 — 机械巨墙
   * 阶段1: 普通反弹移动
   * 阶段2 (≤70%): 周期生成移动砖块行
   * 阶段3 (≤40%): 发射能量弹
   * ============================================================ */
  class Boss1 {
    constructor() {
      this.type = 1;
      this.name = '机械巨墙';
      this.w = 300; this.h = 62;
      this.x = C.W / 2; this.y = 70;
      this.hp = this.maxHp = 100;
      this.dir = 1; this.vx = 90;
      this.t = 0;
      this.spawnT = 3;
      this.fireT = 2;
      this.flashT = 0;
      this.phase = 1;
      this.dying = false;
    }

    get rect() { return { x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h }; }

    update(dt, game) {
      this.t += dt;
      if (this.flashT > 0) this.flashT -= dt;

      const speedMul = this.phase === 1 ? 1 : this.phase === 2 ? 1.6 : 2.2;
      this.x += this.vx * speedMul * this.dir * dt;
      const lim = C.W - this.w / 2 - 30;
      if (this.x < this.w / 2 + 30) { this.x = this.w / 2 + 30; this.dir = 1; }
      if (this.x > lim) { this.x = lim; this.dir = -1; }

      // 阶段判定
      const pct = this.hp / this.maxHp;
      if (pct <= 0.4) this.phase = 3;
      else if (pct <= 0.7) this.phase = 2;

      if (this.phase >= 2) {
        this.spawnT -= dt;
        if (this.spawnT <= 0) {
          this.spawnT = 5.5;
          game.spawnBossBricks(this.x);
        }
      }
      if (this.phase >= 3) {
        this.fireT -= dt;
        if (this.fireT <= 0) {
          this.fireT = 1.7;
          const n = 1 + (Math.random() < 0.35 ? 1 : 0);
          for (let i = 0; i < n; i++) {
            const bx = this.x + U.rand(-this.w / 2 + 30, this.w / 2 - 30);
            game.spawnBullet(bx, this.y + this.h / 2, false);
          }
        }
      }
    }

    hit(dmg) {
      this.hp = Math.max(0, this.hp - dmg);
      this.flashT = 0.12;
      return this.hp <= 0;
    }

    hitTestPoint(x, y) {
      const r = this.rect;
      return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    }

    render(ctx, game) {
      const r = this.rect;
      const pct = this.hp / this.maxHp;
      ctx.save();

      // 主体装甲
      const grd = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
      grd.addColorStop(0, '#3a4358');
      grd.addColorStop(0.5, this.flashT > 0 ? '#ff6b7a' : '#4a5266');
      grd.addColorStop(1, '#232838');
      ctx.fillStyle = grd;
      ctx.shadowColor = '#ff2d55';
      ctx.shadowBlur = 18 + (1 - pct) * 20;
      roundRect(ctx, r.x, r.y, r.w, r.h, 8);
      ctx.fill();
      ctx.shadowBlur = 0;

      // 装甲缝
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.lineWidth = 2;
      for (let i = 1; i < 6; i++) {
        const px = r.x + (r.w / 6) * i;
        ctx.beginPath(); ctx.moveTo(px, r.y + 4); ctx.lineTo(px, r.y + r.h - 4); ctx.stroke();
      }
      // 铆钉
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      for (let i = 0; i <= 6; i++) {
        const px = r.x + (r.w / 6) * i;
        ctx.beginPath(); ctx.arc(px, r.y + 6, 2, 0, U.TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(px, r.y + r.h - 6, 2, 0, U.TAU); ctx.fill();
      }

      // 核心之眼
      const eyeX = r.x + r.w / 2;
      const eyeR = 16 + Math.sin(this.t * 3) * 2;
      const eyeCol = this.phase === 3 ? '#ff2d55' : this.phase === 2 ? '#ff9f1a' : '#35e0e6';
      ctx.fillStyle = eyeCol;
      ctx.shadowColor = eyeCol;
      ctx.shadowBlur = 22;
      ctx.beginPath(); ctx.arc(eyeX, r.y + r.h / 2, eyeR, 0, U.TAU); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(eyeX, r.y + r.h / 2, eyeR * 0.4, 0, U.TAU); ctx.fill();
      ctx.shadowBlur = 0;

      // 阶段炮口
      if (this.phase >= 3) {
        ctx.fillStyle = '#ff2d55';
        for (let i = 0; i < 5; i++) {
          const px = r.x + 34 + i * (r.w - 68) / 4;
          const pulse = 3 + Math.sin(this.t * 6 + i) * 1.5;
          ctx.beginPath(); ctx.arc(px, r.y + r.h - 4, pulse, 0, U.TAU); ctx.fill();
        }
      }
      ctx.restore();
    }
  }

  /* ============================================================
   * Boss 2 — 霓虹核心（旋转护盾 + 瞄准弹幕）
   * ============================================================ */
  class Boss2 {
    constructor() {
      this.type = 2;
      this.name = '霓虹核心';
      this.x = C.W / 2; this.y = 200;
      this.r = 54;
      this.hp = this.maxHp = 140;
      this.t = 0;
      this.barLen = 200; this.barTh = 12;
      this.barSpeeds = [1.3, -1.0, 0.8];
      this.baseX = C.W / 2;
      this.fireT = 3;
      this.flashT = 0;
      this.phase = 1;
      this.dying = false;
    }

    get pct() { return this.hp / this.maxHp; }

    update(dt, game) {
      this.t += dt;
      if (this.flashT > 0) this.flashT -= dt;

      const pct = this.pct;
      if (pct <= 0.33) this.phase = 3;
      else if (pct <= 0.66) this.phase = 2;

      const spd = this.phase === 3 ? 0.9 : this.phase === 2 ? 0.65 : 0.45;
      this.x = this.baseX + Math.sin(this.t * spd) * 260;

      if (this.phase >= 2) {
        this.fireT -= dt;
        if (this.fireT <= 0) {
          this.fireT = this.phase === 3 ? 1.8 : 2.4;
          if (this.phase === 3) {
            // 5 向扇形弹幕
            for (let i = -2; i <= 2; i++) {
              game.spawnBullet(this.x, this.y + this.r, true, i * 0.28);
            }
          } else {
            game.spawnBullet(this.x, this.y + this.r, true, 0);
          }
        }
      }
    }

    /* 球 vs Boss2（核心圆 + 旋转护盾杆）
     * 返回 'core' / 'bar' / null，碰撞与反弹在本方法内完成 */
    collideBall(ball) {
      // 核心
      const dx = ball.x - this.x, dy = ball.y - this.y;
      const d = Math.hypot(dx, dy);
      const rr = this.r + ball.r;
      if (d < rr) {
        const nx = d > 0.001 ? dx / d : 0, ny = d > 0.001 ? dy / d : -1;
        const hit = { nx, ny, pen: rr - d };
        U.reflectAndPush(ball, hit);
        return 'core';
      }
      // 护盾杆
      for (let i = 0; i < 3; i++) {
        const ang = this.t * this.barSpeeds[i] + (i * U.TAU) / 3;
        const hit = rotorCollide(ball, this.x, this.y, this.barLen, this.barTh, ang);
        if (hit) {
          U.reflectAndPush(ball, hit);
          // 杆的旋转给球一点切向扰动
          ball.vx += Math.cos(ang) * U.rand(-30, 30);
          return 'bar';
        }
      }
      return null;
    }

    hitTestPoint(x, y) {
      const d = Math.hypot(x - this.x, y - this.y);
      if (d < this.r) return 'core';
      for (let i = 0; i < 3; i++) {
        const ang = this.t * this.barSpeeds[i] + (i * U.TAU) / 3;
        const dx = x - this.x, dy = y - this.y;
        const ca = Math.cos(ang), sa = Math.sin(ang);
        const lx = dx * ca + dy * sa, ly = -dx * sa + dy * ca;
        if (Math.abs(lx) < this.barLen / 2 && Math.abs(ly) < this.barTh / 2 + 2) return 'bar';
      }
      return null;
    }

    hit(dmg) {
      this.hp = Math.max(0, this.hp - dmg);
      this.flashT = 0.12;
      return this.hp <= 0;
    }

    render(ctx, game) {
      const pct = this.pct;
      ctx.save();

      // 护盾杆
      for (let i = 0; i < 3; i++) {
        const ang = this.t * this.barSpeeds[i] + (i * U.TAU) / 3;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(ang);
        const grd = ctx.createLinearGradient(-this.barLen / 2, 0, this.barLen / 2, 0);
        grd.addColorStop(0, 'rgba(210,77,255,0.15)');
        grd.addColorStop(0.5, '#d24dff');
        grd.addColorStop(1, 'rgba(210,77,255,0.15)');
        ctx.fillStyle = grd;
        ctx.shadowColor = '#d24dff';
        ctx.shadowBlur = 14;
        roundRect(ctx, -this.barLen / 2, -this.barTh / 2, this.barLen, this.barTh, 6);
        ctx.fill();
        ctx.restore();
      }
      ctx.shadowBlur = 0;

      // 核心
      const pulse = 1 + Math.sin(this.t * 4) * 0.05;
      const col = this.flashT > 0 ? '#ffffff' : (this.phase === 3 ? '#ff2d95' : '#b14dff');
      const g = ctx.createRadialGradient(this.x, this.y, 4, this.x, this.y, this.r * pulse);
      g.addColorStop(0, '#fff');
      g.addColorStop(0.4, col);
      g.addColorStop(1, 'rgba(120,0,180,0.25)');
      ctx.fillStyle = g;
      ctx.shadowColor = col;
      ctx.shadowBlur = 30;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r * pulse, 0, U.TAU);
      ctx.fill();

      // 内环
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r * 0.62 * pulse, this.t, this.t + 4.4);
      ctx.stroke();

      // 受损裂纹
      if (pct < 0.66) {
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.x - 20, this.y - 10);
        ctx.lineTo(this.x - 5, this.y + 5);
        ctx.lineTo(this.x - 15, this.y + 20);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  /* 圆角矩形辅助 */
  function roundRect(ctx, x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  BF.Ball = Ball;
  BF.PowerDrop = PowerDrop;
  BF.Boss1 = Boss1;
  BF.Boss2 = Boss2;
  BF.rotorCollide = rotorCollide;
  BF.roundRect = roundRect;
})();

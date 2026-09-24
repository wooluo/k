/* ============================================================
 * BRICKFALL — 粒子系统（对象池）+ 屏幕震动 + 浮动文字
 * ============================================================ */
(function () {
  'use strict';
  const U = BF.U;

  class ParticleSystem {
    constructor(max) {
      this.max = max || 700;
      this.pool = new Array(this.max);
      for (let i = 0; i < this.max; i++) {
        this.pool[i] = { alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#fff', grav: 0, drag: 1, glow: true };
      }
      this.texts = [];
      this.shakeT = 0; this.shakeDur = 0; this.shakeAmp = 0;
      this.shakeX = 0; this.shakeY = 0;
      this.quality = 1; // 0.5 = 低配，粒子减半
    }

    _get() {
      for (let i = 0; i < this.max; i++) {
        const p = this.pool[i];
        if (!p.alive) return p;
      }
      return null;
    }

    burst(x, y, color, n, spd, size, life, grav) {
      n = Math.max(1, Math.round(n * this.quality));
      for (let i = 0; i < n; i++) {
        const p = this._get();
        if (!p) return;
        const a = Math.random() * U.TAU;
        const s = U.rand(spd * 0.25, spd);
        p.alive = true;
        p.x = x; p.y = y;
        p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s;
        p.maxLife = p.life = U.rand(life * 0.5, life);
        p.size = U.rand(size * 0.5, size);
        p.color = color;
        p.grav = grav || 0;
        p.drag = 0.985;
        p.glow = true;
      }
    }

    spark(x, y, color, n, spd) { this.burst(x, y, color, n, spd, 2.5, 0.4, 0); }

    ring(x, y, color, n, spd, size, life) {
      n = Math.max(1, Math.round(n * this.quality));
      for (let i = 0; i < n; i++) {
        const p = this._get();
        if (!p) return;
        const a = (i / n) * U.TAU;
        p.alive = true;
        p.x = x; p.y = y;
        p.vx = Math.cos(a) * spd; p.vy = Math.sin(a) * spd;
        p.maxLife = p.life = life;
        p.size = size; p.color = color; p.grav = 0; p.drag = 0.97; p.glow = true;
      }
    }

    trail(x, y, color, size) {
      const p = this._get();
      if (!p) return;
      p.alive = true;
      p.x = x + U.rand(-1.5, 1.5); p.y = y + U.rand(-1.5, 1.5);
      p.vx = U.rand(-12, 12); p.vy = U.rand(-4, 18);
      p.maxLife = p.life = U.rand(0.22, 0.4);
      p.size = size || U.rand(1.6, 3);
      p.color = color; p.grav = 0; p.drag = 0.94; p.glow = true;
    }

    addText(x, y, txt, color, size) {
      if (this.texts.length > 40) this.texts.shift();
      this.texts.push({ x, y, txt, color: color || '#fff', t: 0, dur: 0.9, size: size || 18 });
    }

    shake(amp, durMs) {
      if (amp >= this.shakeAmp || this.shakeT <= 0) {
        this.shakeAmp = Math.max(this.shakeAmp, amp);
        this.shakeDur = this.shakeT = Math.max(this.shakeT, durMs / 1000);
      }
    }

    update(dt) {
      // 粒子
      for (let i = 0; i < this.max; i++) {
        const p = this.pool[i];
        if (!p.alive) continue;
        p.life -= dt;
        if (p.life <= 0) { p.alive = false; continue; }
        p.vy += p.grav * dt;
        p.vx *= p.drag; p.vy *= p.drag;
        p.x += p.vx * dt; p.y += p.vy * dt;
      }
      // 文字
      for (let i = this.texts.length - 1; i >= 0; i--) {
        const t = this.texts[i];
        t.t += dt;
        t.y -= 46 * dt;
        if (t.t >= t.dur) this.texts.splice(i, 1);
      }
      // 震动
      if (this.shakeT > 0) {
        this.shakeT -= dt;
        const k = Math.max(this.shakeT / this.shakeDur, 0);
        this.shakeX = U.rand(-1, 1) * this.shakeAmp * k;
        this.shakeY = U.rand(-1, 1) * this.shakeAmp * k;
        if (this.shakeT <= 0) { this.shakeAmp = 0; this.shakeX = this.shakeY = 0; }
      } else { this.shakeX = this.shakeY = 0; }
    }

    render(ctx) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < this.max; i++) {
        const p = this.pool[i];
        if (!p.alive) continue;
        const a = U.clamp(p.life / p.maxLife, 0, 1);
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        const s = p.size * (0.5 + a * 0.5);
        ctx.beginPath();
        ctx.arc(p.x, p.y, s, 0, U.TAU);
        ctx.fill();
      }
      ctx.restore();
      ctx.globalAlpha = 1;

      // 浮动文字
      ctx.save();
      ctx.textAlign = 'center';
      for (const t of this.texts) {
        const k = t.t / t.dur;
        const a = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85;
        const pop = k < 0.2 ? 1 + (0.2 - k) * 2.5 : 1;
        ctx.globalAlpha = U.clamp(a, 0, 1);
        ctx.font = 'bold ' + Math.round(t.size * pop) + 'px "Orbitron", "PingFang SC", sans-serif';
        ctx.fillStyle = t.color;
        ctx.shadowColor = t.color;
        ctx.shadowBlur = 10;
        ctx.fillText(t.txt, t.x, t.y);
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    reset() {
      for (const p of this.pool) p.alive = false;
      this.texts.length = 0;
      this.shakeT = 0; this.shakeAmp = 0; this.shakeX = this.shakeY = 0;
    }
  }

  BF.Particles = ParticleSystem;
})();

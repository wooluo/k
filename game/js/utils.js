/* ============================================================
 * BRICKFALL — 工具函数
 * ============================================================ */
(function () {
  'use strict';

  const U = {
    TAU: Math.PI * 2,

    clamp(v, a, b) { return v < a ? a : (v > b ? b : v); },
    lerp(a, b, t) { return a + (b - a) * t; },
    rand(a, b) { return a + Math.random() * (b - a); },
    randi(a, b) { return Math.floor(a + Math.random() * (b - a + 1)); },
    choice(arr) { return arr[Math.floor(Math.random() * arr.length)]; },

    dist2(x1, y1, x2, y2) { const dx = x2 - x1, dy = y2 - y1; return dx * dx + dy * dy; },

    /* 加权随机：items = [[value, weight], ...] */
    weighted(items) {
      let total = 0;
      for (const it of items) total += it[1];
      let r = Math.random() * total;
      for (const it of items) { r -= it[1]; if (r <= 0) return it[0]; }
      return items[items.length - 1][0];
    },

    /* 圆 vs 矩形（最近点算法）
     * 返回 null 或 { nx, ny, pen, cx, cy }
     * pen = 需要推出的深度 */
    circleRect(bx, by, r, rx, ry, rw, rh) {
      const cx = U.clamp(bx, rx, rx + rw);
      const cy = U.clamp(by, ry, ry + rh);
      let dx = bx - cx, dy = by - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 > r * r) return null;

      if (d2 > 1e-9) {
        const d = Math.sqrt(d2);
        return { nx: dx / d, ny: dy / d, pen: r - d, cx, cy };
      }
      // 球心在矩形内部：沿最小穿透方向推出
      const left = bx - rx, right = rx + rw - bx;
      const top = by - ry, bottom = ry + rh - by;
      const m = Math.min(left, right, top, bottom);
      if (m === left) return { nx: -1, ny: 0, pen: left + r, cx, cy };
      if (m === right) return { nx: 1, ny: 0, pen: right + r, cx, cy };
      if (m === top) return { nx: 0, ny: -1, pen: top + r, cx, cy };
      return { nx: 0, ny: 1, pen: bottom + r, cx, cy };
    },

    /* 反射并推出：v' = v - 2(v·n)n */
    reflectAndPush(ball, hit) {
      const dot = ball.vx * hit.nx + ball.vy * hit.ny;
      if (dot < 0) {
        ball.vx -= 2 * dot * hit.nx;
        ball.vy -= 2 * dot * hit.ny;
      }
      ball.x += hit.nx * (hit.pen + 0.5);
      ball.y += hit.ny * (hit.pen + 0.5);
    },

    /* 按速度标量重设速度向量，并保证最小垂直分量 */
    setSpeed(ball, speed, minVy) {
      const mag = Math.hypot(ball.vx, ball.vy) || 1;
      ball.vx = ball.vx / mag * speed;
      ball.vy = ball.vy / mag * speed;
      U.enforceMinVy(ball, minVy, speed);
    },

    enforceMinVy(ball, minVy, speed) {
      if (Math.abs(ball.vy) < minVy) {
        const sign = ball.vy === 0 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(ball.vy);
        ball.vy = sign * minVy;
        const rest = Math.sqrt(Math.max(speed * speed - minVy * minVy, 0));
        ball.vx = Math.sign(ball.vx || 1) * rest;
      }
    },

    fmtTime(sec) {
      sec = Math.max(0, Math.floor(sec));
      const m = Math.floor(sec / 60), s = sec % 60;
      return m + ':' + (s < 10 ? '0' : '') + s;
    },

    fmtNum(n) { return Math.floor(n).toLocaleString('en-US'); },

    /* 防御：保证数值合法 */
    sanitize(v, def) { return (typeof v === 'number' && isFinite(v)) ? v : def; }
  };

  BF.U = U;
})();

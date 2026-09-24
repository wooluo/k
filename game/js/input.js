/* ============================================================
 * BRICKFALL — 输入管理器（Pointer Events + 键盘）
 * ============================================================ */
(function () {
  'use strict';
  const C = BF.C;

  class InputManager {
    constructor() {
      this.left = false;
      this.right = false;
      this.keys = {};
      this._lastPointerT = 0;
    }

    attach(canvas, game) {
      this.canvas = canvas;
      this.game = game;

      const toWorld = (e) => {
        const r = canvas.getBoundingClientRect();
        return {
          x: (e.clientX - r.left) / r.width * C.W,
          y: (e.clientY - r.top) / r.height * C.H
        };
      };

      canvas.addEventListener('pointermove', (e) => {
        e.preventDefault();
        const p = toWorld(e);
        game.onPointerMove(p.x, p.y);
      }, { passive: false });

      canvas.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        game.firstInteract();
        const p = toWorld(e);
        game.onPointerDown(p.x, p.y, e.button);
      }, { passive: false });

      canvas.addEventListener('pointerup', (e) => {
        const p = toWorld(e);
        game.onPointerUp(p.x, p.y);
      });

      canvas.addEventListener('contextmenu', (e) => e.preventDefault());

      canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
      canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

      window.addEventListener('keydown', (e) => {
        game.firstInteract();
        // 防止空格滚动页面
        if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyP'].includes(e.code)) {
          e.preventDefault();
        }
        if (e.repeat) return;
        this.keys[e.code] = true;
        this._syncDir();
        game.onKey(e.code, true);
      });

      window.addEventListener('keyup', (e) => {
        this.keys[e.code] = false;
        this._syncDir();
        game.onKey(e.code, false);
      });

      // 页面隐藏时自动暂停
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) game.onHidden();
      });

      window.addEventListener('blur', () => game.onHidden());
    }

    _syncDir() {
      this.left = !!(this.keys['ArrowLeft'] || this.keys['KeyA']);
      this.right = !!(this.keys['ArrowRight'] || this.keys['KeyD']);
    }
  }

  BF.Input = InputManager;
})();

/* ============================================================
 * BRICKFALL — UI 管理器（屏幕切换 / HUD / 菜单 / 结算）
 * ============================================================ */
(function () {
  'use strict';
  const U = BF.U;

  const SCREENS = ['menu', 'levels', 'settings', 'ach', 'challenge', 'pause', 'clear', 'over', 'victory'];

  class UI {
    constructor() {
      this.game = null;
      this._current = null;
      this._cache = {};
      this._settingsFrom = 'menu';
      this._bannerTimer = null;
      this._lastBuffKey = '';
    }

    $(id) { return document.getElementById(id); }

    attach(game) {
      this.game = game;
      this._bind();
      this.refreshMenuBest();
      this.setHUDVisible(false);
      this.show('menu');
    }

    /* ---------- 屏幕切换 ---------- */
    show(id, data) {
      for (const s of SCREENS) {
        const el = this.$('scr-' + s);
        if (el) el.classList.toggle('active', s === id);
      }
      this._current = id;
      if (id === 'levels') this.buildLevels();
      if (id === 'ach') this.buildAch();
      if (id === 'challenge') this.buildChallenges();
      if (id === 'menu') this.refreshMenuBest();
      if (id === 'clear') this._fillClear(data);
      if (id === 'over') this._fillOver(data);
      if (id === 'victory') this._fillVictory(data);
      if (id) this.game.audio && this.game.audio.sfx('ui');
    }

    /* ---------- 事件绑定（仅一次） ---------- */
    _bind() {
      const g = this.game;
      const click = (id, fn) => {
        const el = this.$(id);
        if (el) el.addEventListener('click', () => { g.firstInteract(); g.audio && g.audio.sfx('ui'); fn(); });
      };

      // 主菜单
      click('btn-continue', () => g.startContinue());
      click('btn-levels', () => this.show('levels'));
      click('btn-endless', () => g.startEndless());
      click('btn-time', () => g.startTimeAttack());
      click('btn-challenge', () => this.show('challenge'));
      click('btn-rush', () => g.startBossRush());
      click('btn-classic', () => g.startClassic());
      click('btn-ach', () => this.show('ach'));
      click('btn-settings', () => { this._settingsFrom = 'menu'; this.show('settings'); });

      // 返回
      click('btn-levels-back', () => this.show('menu'));
      click('btn-ach-back', () => this.show('menu'));
      click('btn-challenge-back', () => this.show('menu'));
      click('btn-settings-back', () => this.show(this._settingsFrom));

      // 暂停
      click('btn-resume', () => g.resume());
      click('btn-restart', () => g.restartLevel());
      click('btn-pause-settings', () => { this._settingsFrom = 'pause'; this.show('settings'); });
      click('btn-exit', () => g.exitToMenu());
      click('btn-pause', () => { if (g.state === 'playing' || g.state === 'paused') g.togglePause(); });

      // 结算 / 失败 / 胜利
      click('btn-next', () => g.nextLevel());
      click('btn-replay', () => g.restartLevel());
      click('btn-clear-menu', () => g.exitToMenu());
      click('btn-clear-levels', () => g.exitToMenu() || this.show('levels'));
      click('btn-retry', () => g.restartLevel());
      click('btn-over-menu', () => g.exitToMenu());
      click('btn-victory-menu', () => g.exitToMenu());

      // 炸弹按钮
      click('hud-bombs', () => g.detonateBomb());

      // 设置
      const music = this.$('set-music'), sfx = this.$('set-sfx'), parts = this.$('set-particles');
      if (music) {
        music.value = g.save.data.settings.music;
        music.addEventListener('input', () => {
          g.save.data.settings.music = parseFloat(music.value);
          g.save.save();
          g.audio && g.audio.setMusicVol(g.save.data.settings.music);
        });
      }
      if (sfx) {
        sfx.value = g.save.data.settings.sfx;
        sfx.addEventListener('input', () => {
          g.save.data.settings.sfx = parseFloat(sfx.value);
          g.save.save();
          g.audio && g.audio.setSfxVol(g.save.data.settings.sfx);
        });
      }
      if (parts) {
        parts.checked = !!g.save.data.settings.particles;
        parts.addEventListener('change', () => {
          g.save.data.settings.particles = parts.checked ? 1 : 0;
          g.save.save();
          g.particles.quality = parts.checked ? 1 : 0.5;
        });
      }
      click('btn-reset-save', () => {
        if (confirm('确定要清空所有进度吗？（不可恢复）')) {
          g.save.reset();
          this.refreshMenuBest();
          this.toast('进度已重置', '新的旅程开始了');
        }
      });
    }

    /* ---------- HUD ---------- */
    setHUDVisible(v) {
      const hud = this.$('hud');
      if (hud) hud.classList.toggle('hidden', !v);
    }

    updateHUD(game) {
      if (!game.paddle && game.state !== 'playing') return;
      const c = this._cache;

      const score = Math.floor(game.score || 0);
      if (c.score !== score) { c.score = score; this._text('hud-score', U.fmtNum(score)); }

      const lives = game.mode === 'time' ? '∞' : (game.lives || 0);
      const lv = '♥'.repeat(Math.max(0, typeof lives === 'number' ? lives : 3));
      if (c.lives !== lv) { c.lives = lv; this._text('hud-lives', lv || '—'); }

      const combo = game.combo || 0;
      if (c.combo !== combo) {
        c.combo = combo;
        const el = this.$('hud-combo');
        if (el) {
          el.classList.toggle('on', combo >= 2);
          this._text('hud-combo-val', '×' + BF.comboMult(combo));
          this._text('hud-combo-n', combo);
        }
      }
      // combo 倒计时条
      const cb = this.$('hud-combo-bar');
      if (cb && combo > 0) cb.style.width = Math.round((game.comboT / BF.C.COMBO_TIME) * 100) + '%';

      // 球速
      const spd = game.state === 'playing' ? Math.round(game._effectiveSpeed() / 6) : 0;
      if (c.spd !== spd) {
        c.spd = spd;
        const sb = this.$('hud-speed-bar');
        if (sb) sb.style.width = Math.round(U.clamp(spd / (BF.C.BALL.MAX / 6), 0, 1) * 100) + '%';
      }

      // Buff 图标
      const B = game.buffs || {};
      const active = [];
      const names = {
        big: ['巨型挡板', '#ffd93a'], small: ['小型挡板', '#b85c5c'],
        slow: ['时间减缓', '#63d2ff'], fast: ['加速诅咒', '#ff7043'],
        laser: ['激光 [空格]', '#ff2d95'], magnet: ['磁力', '#38ada9'],
        sticky: ['粘性', '#7bed9f'], pierce: ['穿透', '#c56cf0'],
        fire: ['烈焰', '#ff6348'], tinyball: ['微球', '#70a1ff'], x2: ['×2 积分', '#f7b731']
      };
      for (const k in names) if (B[k] > 0) active.push(k + ':' + Math.ceil(B[k]));
      const key = active.join(',');
      if (key !== this._lastBuffKey && this.$('hud-buffs')) {
        this._lastBuffKey = key;
        this.$('hud-buffs').innerHTML = active.map(a => {
          const [k, t] = a.split(':');
          return '<span class="buff" style="border-color:' + names[k][1] + ';color:' + names[k][1] + '">' + names[k][0] + ' ' + t + 's</span>';
        }).join('');
      }

      // 炸弹
      const bombs = game.bombs || 0;
      if (c.bombs !== bombs) {
        c.bombs = bombs;
        const el = this.$('hud-bombs');
        if (el) {
          el.classList.toggle('none', bombs <= 0);
          this._text('hud-bombs-n', bombs);
        }
      }

      // Boss 血条
      const bossEl = this.$('hud-boss');
      if (bossEl) {
        const b = game.boss;
        if (b) {
          bossEl.classList.add('on');
          this._text('hud-boss-name', b.name);
          const fill = this.$('hud-boss-fill');
          if (fill) fill.style.width = Math.max(0, (b.hp / b.maxHp) * 100) + '%';
        } else {
          bossEl.classList.remove('on');
        }
      }

      // 限时模式倒计时
      const timeEl = this.$('hud-time');
      if (timeEl) {
        if (game.mode === 'time' && game.timeAttack) {
          timeEl.classList.add('on');
          const t = Math.ceil(game.timeAttack.left);
          if (c.timeLeft !== t) { c.timeLeft = t; this._text('hud-time-n', t + 's'); timeEl.classList.toggle('urgent', t <= 10); }
        } else {
          timeEl.classList.remove('on');
        }
      }

      // 关卡名
      const lname = game.mode === 'story' ? ('LV.' + game.currentLevel) : (game.mode ? game.mode.toUpperCase() : '');
      if (c.lname !== lname) { c.lname = lname; this._text('hud-level', lname); }
    }

    _text(id, v) {
      const el = this.$(id);
      if (el && el.textContent !== v) el.textContent = v;
    }

    /* ---------- 横幅 / 提示 ---------- */
    banner(text) {
      const el = this.$('banner');
      if (!el) return;
      el.textContent = text;
      el.classList.remove('show');
      void el.offsetWidth; // 重置动画
      el.classList.add('show');
      if (this._bannerTimer) clearTimeout(this._bannerTimer);
      this._bannerTimer = setTimeout(() => el.classList.remove('show'), 1800);
    }

    toast(title, sub) {
      const box = this.$('toasts');
      if (!box) return;
      const el = document.createElement('div');
      el.className = 'toast';
      el.innerHTML = '<b>' + title + '</b>' + (sub ? '<span>' + sub + '</span>' : '');
      box.appendChild(el);
      setTimeout(() => el.classList.add('show'), 10);
      setTimeout(() => {
        el.classList.remove('show');
        setTimeout(() => el.remove(), 400);
      }, 2600);
    }

    /* ---------- 关卡选择 ---------- */
    buildLevels() {
      const grid = this.$('levels-grid');
      if (!grid) return;
      const save = this.game.save.data;
      let html = '';
      for (const w of BF.WORLDS) {
        if (w.soon) {
          html += '<div class="world soon"><h3>' + w.name + '</h3><p class="soon-note">—— 敬请期待 ——</p></div>';
          continue;
        }
        html += '<div class="world"><h3>' + w.name + '</h3><div class="nodes">';
        for (let id = w.from; id <= w.to; id++) {
          const def = BF.LEVELS.find(l => l.id === id);
          if (!def) continue;
          const locked = id > save.unlocked;
          const stars = save.stars[id] || 0;
          const starStr = '★'.repeat(stars) + '<i>' + '★'.repeat(3 - stars) + '</i>';
          const boss = def.boss ? ' boss' : '';
          html += '<button class="lv' + boss + (locked ? ' locked' : '') + '" data-id="' + id + '"' + (locked ? ' disabled' : '') + '>' +
            (locked ? '🔒' : (def.boss ? '☠' : id)) +
            '<span class="stars">' + (locked ? '' : starStr) + '</span>' +
            '<span class="lv-name">' + (locked ? '' : def.name.replace('BOSS · ', '')) + '</span>' +
            '</button>';
        }
        html += '</div></div>';
      }
      grid.innerHTML = html;
      grid.querySelectorAll('button.lv:not(.locked)').forEach(btn => {
        btn.addEventListener('click', () => {
          this.game.firstInteract();
          this.game.startStoryLevel(parseInt(btn.dataset.id, 10));
        });
      });
    }

    /* ---------- 成就 ---------- */
    buildAch() {
      const list = this.$('ach-list');
      if (!list) return;
      const data = this.game.save.data;
      let html = '<div class="ach-meta">最高连击 ×' + (data.bestCombo || 0) + '</div>';
      for (const a of BF.ACHIEVEMENTS) {
        const got = !!data.ach[a.id];
        html += '<div class="ach' + (got ? ' got' : '') + '">' +
          '<div class="ach-badge">' + (got ? '🏆' : '🔒') + '</div>' +
          '<div><b>' + a.name + '</b><span>' + a.desc + '</span></div></div>';
      }
      list.innerHTML = html;
    }

    /* ---------- 挑战 ---------- */
    buildChallenges() {
      const list = this.$('challenge-list');
      if (!list) return;
      const data = this.game.save.data;
      list.innerHTML = BF.CHALLENGES.map(c =>
        '<button class="ch' + (data.challenges[c.id] ? ' done' : '') + '" data-id="' + c.id + '">' +
        '<b>' + c.name + (data.challenges[c.id] ? ' ✓' : '') + '</b>' +
        '<span>' + c.desc + '</span></button>'
      ).join('');
      list.querySelectorAll('button.ch').forEach(btn => {
        btn.addEventListener('click', () => {
          this.game.firstInteract();
          this.game.startChallenge(btn.dataset.id);
        });
      });
    }

    /* ---------- 菜单最佳成绩 ---------- */
    refreshMenuBest() {
      const el = this.$('menu-best');
      if (!el || !this.game.save) return;
      const d = this.game.save.data;
      const achCount = Object.keys(d.ach || {}).length;
      const starCount = Object.values(d.stars || {}).reduce((a, b) => a + b, 0);
      el.innerHTML =
        '<span>⭐ ' + starCount + '</span>' +
        '<span>🏆 ' + achCount + '/' + BF.ACHIEVEMENTS.length + '</span>' +
        '<span>无尽 ' + U.fmtNum(d.endlessBest) + '</span>' +
        '<span>限时 ' + U.fmtNum(d.timeBest) + '</span>';
      const cont = this.$('btn-continue');
      if (cont) {
        cont.textContent = d.unlocked > 1 && !d.storyDone ? '继续冒险 · 第 ' + Math.min(d.unlocked, BF.LEVELS.length) + ' 关' : (d.storyDone ? '重新体验故事' : '开始游戏');
      }
    }

    /* ---------- 结算 / 失败 / 胜利 ---------- */
    _statRows(pairs) {
      return pairs.map(([k, v]) =>
        '<div class="row"><span>' + k + '</span><b>' + v + '</b></div>').join('');
    }

    _fillClear(d) {
      if (!d) return;
      this._text('clear-title', d.title || ('LEVEL ' + d.level + ' 通关'));
      const el = this.$('clear-stats');
      if (el) {
        el.innerHTML = this._statRows([
          ['得分', U.fmtNum(d.score)],
          ['最高连击', '×' + d.maxCombo],
          ['砖块', d.bricks + ' / ' + d.total],
          ['用时', U.fmtTime(d.time)],
          ['奖励', '+' + U.fmtNum(d.extra ? d.extra.bonus : 0)]
        ]) + (d.extra ? '<div class="bonus-detail">时间奖励 +' + U.fmtNum(d.extra.timeBonus) + ' · 无伤奖励 +' + U.fmtNum(d.extra.noDeathBonus) + '</div>' : '');
      }
      const starsEl = this.$('clear-stars');
      if (starsEl) {
        const n = d.extra ? d.extra.stars : 0;
        starsEl.innerHTML = [0, 1, 2].map(i =>
          '<span class="st' + (i < n ? ' on' : '') + '" style="animation-delay:' + (0.2 + i * 0.25) + 's">★</span>').join('');
      }
      const next = this.$('btn-next');
      if (next) {
        next.style.display = '';
        if (this.game.mode === 'challenge') {
          next.textContent = '返回挑战列表';
          next.onclick = () => { this.game.exitToMenu(); this.show('challenge'); };
        } else if (this.game.mode === 'story') {
          next.textContent = '下一关 ▶';
          next.onclick = null;
        } else {
          next.style.display = 'none';
        }
      }
    }

    _fillOver(d) {
      if (!d) return;
      const bestKey = { endless: 'endlessBest', time: 'timeBest', classic: 'classicBest', rush: 'rushBest' }[d.mode];
      const best = bestKey ? d.best[bestKey] : (d.best.high && d.best.high[d.level]);
      const el = this.$('over-stats');
      if (el) {
        el.innerHTML = this._statRows([
          [d.timeUp ? '时间到!' : 'GAME OVER', ''],
          ['最终得分', U.fmtNum(d.score)],
          ['最高连击', '×' + d.maxCombo],
          ['摧毁砖块', d.bricks],
          ['历史最佳', U.fmtNum(best || 0)]
        ]);
      }
    }

    _fillVictory(d) {
      if (!d) return;
      this._text('victory-title', d.title || 'VICTORY!');
      const el = this.$('victory-stats');
      if (el) {
        el.innerHTML = this._statRows([
          ['最终得分', U.fmtNum(d.score)],
          ['最高连击', '×' + d.maxCombo],
          ['摧毁砖块', d.bricks]
        ]);
      }
      // 庆祝粒子
      const g = this.game;
      let n = 0;
      const t = setInterval(() => {
        if (!g || g.state !== 'victory' || n++ > 30) { clearInterval(t); return; }
        g.particles.burst(U.rand(100, BF.C.W - 100), U.rand(80, BF.C.H / 2),
          U.choice(['#ffd93a', '#ff5d7a', '#63d2ff', '#4ae08a']), 22, 320, 4, 0.9, 200);
      }, 200);
    }
  }

  BF.UI = UI;
})();

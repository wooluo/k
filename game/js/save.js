/* ============================================================
 * BRICKFALL — 存档管理器（localStorage）
 * ============================================================ */
(function () {
  'use strict';

  const KEY = 'brickfall.save.v1';

  const DEFAULTS = {
    ver: 1,
    unlocked: 1,               // 故事模式已解锁到第几关
    stars: {},                 // { levelId: 0-3 }
    high: {},                  // { levelId: score }
    bestCombo: 0,
    ach: {},                   // { achId: true }
    endlessBest: 0,
    timeBest: 0,
    classicBest: 0,
    rushBest: 0,
    challenges: {},            // { challengeId: true }
    storyDone: false,
    settings: { music: 0.6, sfx: 0.8, particles: 1 }
  };

  class SaveManager {
    constructor() { this.data = this._load(); }

    _load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) {
          const d = JSON.parse(raw);
          return Object.assign({}, JSON.parse(JSON.stringify(DEFAULTS)), d, {
            settings: Object.assign({}, DEFAULTS.settings, d.settings || {})
          });
        }
      } catch (e) { /* 隐私模式等场景使用默认值 */ }
      return JSON.parse(JSON.stringify(DEFAULTS));
    }

    save() {
      try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) {}
    }

    unlockLevel(id) {
      if (id > this.data.unlocked) { this.data.unlocked = id; this.save(); }
    }

    setStars(id, s) {
      const cur = this.data.stars[id] || 0;
      if (s > cur) { this.data.stars[id] = s; this.save(); }
    }

    setHigh(id, score) {
      const cur = this.data.high[id] || 0;
      if (score > cur) { this.data.high[id] = score; this.save(); }
    }

    setBest(key, v) {
      if (v > (this.data[key] || 0)) { this.data[key] = v; this.save(); }
    }

    bestCombo(c) {
      if (c > this.data.bestCombo) { this.data.bestCombo = c; this.save(); }
    }

    /* 返回 true 表示是新解锁 */
    unlockAch(id) {
      if (!this.data.ach[id]) {
        this.data.ach[id] = true;
        this.save();
        return true;
      }
      return false;
    }

    reset() {
      const settings = this.data.settings;
      this.data = JSON.parse(JSON.stringify(DEFAULTS));
      this.data.settings = settings;
      this.save();
    }
  }

  BF.Save = SaveManager;
})();

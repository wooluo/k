/* ============================================================
 * BRICKFALL — 音频管理器（WebAudio 全合成，无外部文件）
 * 第一次用户交互后调用 init()
 * ============================================================ */
(function () {
  'use strict';

  class AudioManager {
    constructor() {
      this.ctx = null;
      this.musicVol = 0.6;
      this.sfxVol = 0.8;
      this.ready = false;
      this.frenzy = false;
      this._seqTimer = null;
      this._step = 0;
      this._nextNoteT = 0;
      this._bpm = 112;
    }

    init() {
      if (this.ready) return;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 1;
        this.master.connect(this.ctx.destination);

        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.value = this.sfxVol;
        this.sfxGain.connect(this.master);

        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.value = this.musicVol * 0.5;
        this.musicGain.connect(this.master);

        this.ready = true;
        this.startMusic();
      } catch (e) { /* 音频不可用时静默降级 */ }
    }

    resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

    setSfxVol(v) { this.sfxVol = v; if (this.sfxGain) this.sfxGain.gain.value = v; }
    setMusicVol(v) { this.musicVol = v; if (this.musicGain) this.musicGain.gain.value = v * 0.5; }
    setFrenzy(on) {
      this.frenzy = on;
      this._bpm = on ? 140 : 112;
    }

    /* ---------- 基础合成 ---------- */
    tone(freq, dur, type, vol, slideTo, when) {
      if (!this.ready || this.sfxVol <= 0) return;
      try {
        const t = when || this.ctx.currentTime;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = type || 'square';
        o.frequency.setValueAtTime(freq, t);
        if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t + dur);
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.connect(g); g.connect(this.sfxGain);
        o.start(t); o.stop(t + dur + 0.02);
      } catch (e) {}
    }

    noise(dur, vol, filterFreq, when) {
      if (!this.ready || this.sfxVol <= 0) return;
      try {
        const t = when || this.ctx.currentTime;
        const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = filterFreq || 2000;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        src.connect(f); f.connect(g); g.connect(this.sfxGain);
        src.start(t); src.stop(t + dur);
      } catch (e) {}
    }

    /* ---------- 具名音效 ---------- */
    sfx(name) {
      if (!this.ready) return;
      const A = 0.5; // 基准音量
      switch (name) {
        case 'paddle': this.tone(300, 0.07, 'square', A * 0.5, 480); break;
        case 'wall': this.tone(220, 0.05, 'square', A * 0.35); break;
        case 'brickHit': this.tone(500, 0.05, 'square', A * 0.4, 380); this.noise(0.04, 0.12, 3000); break;
        case 'brickBreak':
          this.noise(0.12, 0.3, 2600);
          this.tone(620, 0.09, 'triangle', A * 0.5, 240);
          break;
        case 'metal': this.tone(1200, 0.06, 'square', A * 0.3, 900); this.noise(0.05, 0.1, 6000); break;
        case 'combo': this.tone(700, 0.06, 'triangle', A * 0.4, 1100); break;
        case 'powerup':
          this.tone(520, 0.08, 'square', A * 0.4);
          this.tone(780, 0.09, 'square', A * 0.4, undefined, this.ctx.currentTime + 0.07);
          this.tone(1040, 0.12, 'square', A * 0.4, undefined, this.ctx.currentTime + 0.15);
          break;
        case 'laser': this.tone(1400, 0.12, 'sawtooth', A * 0.3, 300); break;
        case 'explosion': this.noise(0.35, 0.55, 900); this.tone(90, 0.3, 'sine', A * 0.7, 40); break;
        case 'bomb': this.noise(0.45, 0.6, 700); this.tone(70, 0.4, 'sine', A * 0.8, 30); break;
        case 'freeze': this.tone(1800, 0.25, 'sine', A * 0.35, 2600); this.noise(0.15, 0.1, 7000); break;
        case 'teleport': this.tone(400, 0.12, 'sine', A * 0.4, 1600); break;
        case 'bossHit': this.tone(160, 0.1, 'sawtooth', A * 0.5, 90); this.noise(0.08, 0.2, 1400); break;
        case 'bossDeath':
          this.noise(0.9, 0.7, 600);
          this.tone(220, 0.8, 'sawtooth', A * 0.6, 40);
          this.tone(110, 1.0, 'sine', A * 0.7, 30);
          break;
        case 'lifeLost': this.tone(420, 0.4, 'sawtooth', A * 0.5, 60); break;
        case 'gameOver':
          this.tone(300, 0.3, 'triangle', A * 0.5, 200);
          this.tone(200, 0.4, 'triangle', A * 0.5, 120, this.ctx.currentTime + 0.25);
          this.tone(100, 0.9, 'triangle', A * 0.6, 50, this.ctx.currentTime + 0.55);
          break;
        case 'levelClear':
          [523, 659, 784, 1047].forEach((f, i) =>
            this.tone(f, 0.22, 'square', A * 0.45, undefined, this.ctx.currentTime + i * 0.12));
          break;
        case 'frenzy':
          [440, 554, 659, 880].forEach((f, i) =>
            this.tone(f, 0.15, 'sawtooth', A * 0.4, undefined, this.ctx.currentTime + i * 0.06));
          break;
        case 'ach':
          [784, 988, 1319].forEach((f, i) =>
            this.tone(f, 0.18, 'triangle', A * 0.5, undefined, this.ctx.currentTime + i * 0.1));
          break;
        case 'ui': this.tone(660, 0.05, 'square', A * 0.3); break;
        case 'event': this.tone(300, 0.2, 'sawtooth', A * 0.4, 600); this.tone(600, 0.2, 'sawtooth', A * 0.3, 300, this.ctx.currentTime + 0.18); break;
        case 'shield': this.tone(880, 0.15, 'sine', A * 0.5, 440); break;
        case 'bullet': this.tone(260, 0.1, 'sawtooth', A * 0.25, 140); break;
      }
    }

    /* ---------- 背景音乐：16 步循环序列器 ---------- */
    startMusic() {
      if (!this.ready || this._seqTimer) return;
      this._nextNoteT = this.ctx.currentTime + 0.1;
      this._seqTimer = setInterval(() => this._scheduler(), 40);
    }

    stopMusic() {
      if (this._seqTimer) { clearInterval(this._seqTimer); this._seqTimer = null; }
    }

    _scheduler() {
      if (!this.ready) return;
      const stepDur = () => 60 / this._bpm / 4; // 16分音符
      while (this._nextNoteT < this.ctx.currentTime + 0.12) {
        this._playStep(this._step, this._nextNoteT, stepDur());
        this._step = (this._step + 1) % 16;
        this._nextNoteT += stepDur();
      }
    }

    _playStep(step, t, dur) {
      try {
        if (this.musicVol <= 0) return;
        const bass = [110, 0, 0, 110, 0, 130.8, 0, 0, 98, 0, 0, 98, 0, 130.8, 146.8, 0];
        const arp = [440, 523, 659, 523, 587, 523, 440, 392, 440, 523, 659, 784, 880, 784, 659, 523];
        const b = bass[step];
        if (b) {
          const o = this.ctx.createOscillator(), g = this.ctx.createGain();
          o.type = 'triangle';
          o.frequency.value = b;
          g.gain.setValueAtTime(0.22, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + dur * 3.2);
          o.connect(g); g.connect(this.musicGain);
          o.start(t); o.stop(t + dur * 3.4);
        }
        if (step % 2 === 0) {
          const f = this.frenzy ? arp[step] * 1 : arp[step];
          const o = this.ctx.createOscillator(), g = this.ctx.createGain();
          o.type = 'square';
          o.frequency.value = f * (this.frenzy && step % 4 === 2 ? 2 : 1);
          g.gain.setValueAtTime(0.06, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + dur * 1.8);
          o.connect(g); g.connect(this.musicGain);
          o.start(t); o.stop(t + dur * 2);
        }
        if (step % 4 === 2) { // hat
          const len = Math.floor(this.ctx.sampleRate * 0.03);
          const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
          const d = buf.getChannelData(0);
          for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
          const src = this.ctx.createBufferSource(); src.buffer = buf;
          const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000;
          const g = this.ctx.createGain();
          g.gain.setValueAtTime(0.08, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
          src.connect(f); f.connect(g); g.connect(this.musicGain);
          src.start(t); src.stop(t + 0.04);
        }
      } catch (e) {}
    }
  }

  BF.Audio = AudioManager;
})();

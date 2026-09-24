/* ============================================================
 * BRICKFALL — 引导入口
 * ============================================================ */
(function () {
  'use strict';

  window.addEventListener('load', () => {
    const canvas = document.getElementById('game');
    if (!canvas) return;

    const audio = new BF.Audio();
    const save = new BF.Save();
    const game = new BF.Game(canvas);
    const ui = new BF.UI();
    const input = new BF.Input();

    game.attach(audio, save, ui, input);
    ui.attach(game);
    input.attach(canvas, game);

    // 应用存档里的设置
    audio.setMusicVol(save.data.settings.music);
    audio.setSfxVol(save.data.settings.sfx);
    game.particles.quality = save.data.settings.particles ? 1 : 0.5;

    const onResize = () => game.resize();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    onResize();

    game.start();
    window.BF_GAME = game; // 调试用
  });
})();

# 宝石奇旅 · Gem Journey

HTML5 单文件消除类（Match-3）休闲游戏。**打开 [index.html](index.html) 即可游玩**——无需服务器、无需 Node、无需安装依赖，支持 PC / Mac / iPhone / Android / 平板。

> 在线试玩：打开仓库中本目录的 `index.html`，或下载后双击运行。

## 玩法

- 点击或滑动交换相邻宝石，三颗相同即消除；四连生成火箭、T/L 型生成炸弹、五连生成彩虹炸弹
- 特殊宝石可互相组合（彩虹+彩虹清全屏、火箭+火箭十字爆破、炸弹+炸弹 5×5……）
- 连锁消除触发 Combo，分数倍率暴涨；Combo ≥ 10 进入疯狂模式（分数 ×2）
- 键盘：`Esc` 暂停，`空格` 释放满能量的超级大招

## 内容

| 系统 | 说明 |
|---|---|
| 关卡 | 50 关 × 5 大区域（翡翠森林→天空神殿），每 10 关一个 Boss |
| 目标 | 分数 / 收集颜色 / 冰块 / 木箱 / 锁链 / 收集宝石 / 限时 / Boss 击破（8 种） |
| 障碍 | 冰块、双层冰块、木箱、石块、锁链、黑洞、毒液、传送门（8 种） |
| 机制 | 冰雪蔓延、火山喷发、雷电充能、宝石雨、限时关 |
| 道具 | 锤子、炸弹、火箭、彩虹球、魔法棒、重排、+步数、时间冻结、万能交换、闪电、超级炸弹（12 种） |
| Roguelite 强化 | 通关三选一：火焰核心 / 雷霆之力 / 彩虹祝福 / 宝石共鸣 / 火箭大师 / 时间魔法 |
| 商业系统 | 三星评价、生命（20 分钟回 1 点）、金币、XP 等级、每日签到、幸运转盘、每日任务、宝箱、22 个成就、排行榜、统计 |
| 音频 | Web Audio API 程序化 BGM（菜单/游戏/Boss 三套）与 20+ 音效，无外部音频文件 |
| 存档 | localStorage 本地保存全部进度 |

## 技术

- 单 HTML 文件（HTML+CSS+JS），Canvas 渲染宝石与粒子特效，60 FPS
- `assets/` 为场景美术（主菜单/区域/Boss/Logo/头像/胜败背景），宝石与 UI 为 Canvas 矢量绘制
- 模块化结构：GameManager / BoardManager / MatchManager / AnimationManager / ParticleSystem / AudioManager / LevelManager / PlayerManager / ItemManager / AchievementManager / SaveManager / UIManager
- 质量验证：Node 逻辑测试 2031 项断言 + Playwright 浏览器测试 33 项全部通过

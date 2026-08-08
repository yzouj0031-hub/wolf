/* Action CG resource map. Keep artwork paths out of game-flow logic. */
(() => {
  'use strict';

  const MAP = {
    werewolf:      { src:'werewolf-awakening-v1.webp',          titleZh:'狼人睁眼',     titleEn:'WOLVES AWAKEN' },
    wolfking:      { src:'wolf-king-death-bite-v1.webp',        titleZh:'狼王之咬',     titleEn:"WOLF KING'S BITE", position:'68% center' },
    wolfbeauty:    { src:'wolf-beauty-glamour-v1.webp',         titleZh:'狼美人魅惑',   titleEn:'FATAL CHARM', position:'72% center' },
    wolfbeautyDeath:{src:'wolf-beauty-broken-charm-v1.webp',    titleZh:'魅惑殉葬',     titleEn:'CHARM CLAIMED', position:'72% center' },
    seer:          { src:'seer-divination-v1.webp',             titleZh:'预言家查验',   titleEn:'DIVINATION', position:'68% center' },
    witch:         { src:'witch-potions-v1.webp',               titleZh:'女巫用药',     titleEn:'WITCHCRAFT' },
    witchSave:     { src:'witch-antidote-v1.webp',              titleZh:'生命赦免',     titleEn:'LIFE RESTORED', position:'70% center' },
    witchPoison:   { src:'witch-poison-v1.webp',                titleZh:'午夜毒杀',     titleEn:'MIDNIGHT POISON', position:'72% center' },
    hunter:        { src:'hunter-shot-v1.webp',                 titleZh:'猎人开枪',     titleEn:'FINAL SHOT' },
    guard:         { src:'guard-protection-v1.webp',            titleZh:'守卫守护',     titleEn:'NIGHT WATCH' },
    knight:        { src:'knight-oath-v1.webp',                 titleZh:'骑士决斗',     titleEn:"KNIGHT'S DUEL", position:'35% center' },
    magician:      { src:'magician-illusion-v1.webp',           titleZh:'魔术师换位',   titleEn:'GRAND ILLUSION', position:'68% center' },
    whitecat:      { src:'whitecat-delayed-death-v1.webp',      titleZh:'白猫缓死',     titleEn:'DEATH DEFERRED', position:'65% center' },
    fox:           { src:'fox-cub-charm-v1.webp',               titleZh:'子狐媚惑',     titleEn:'FOX CHARM', position:'30% center' },
    fool:          { src:'fool-survival-v1.webp',               titleZh:'愚者保命',     titleEn:"FOOL'S GAMBIT" },
    merchant:      { src:'miracle-merchant-gift-v1.webp',       titleZh:'奇迹赐予',     titleEn:'MIRACLE GIFT', position:'36% center' },
    youshang:      { src:'traveling-merchant-gift-v1.webp',     titleZh:'游商赠礼',     titleEn:"WANDERER'S GIFT", position:'30% center' },
    wolfconcubine: { src:'eclipse-consort-reflection-v1.webp',  titleZh:'蚀时反弹',     titleEn:'ECLIPSE REFLECTION', position:'72% center' },
    whitewolf:     { src:'white-wolf-king-awakening-v1.webp',   titleZh:'白狼王自爆',   titleEn:'WHITE WOLF DETONATION' },
    mechwolf:      { src:'mechanical-wolf-copy-v1.webp',        titleZh:'机械狼学习',   titleEn:'ABILITY COPIED', position:'40% center' },
    jester:        { src:'jester-exile-v1.webp',                titleZh:'小丑谢幕',     titleEn:"JESTER'S CURTAIN CALL" },
    cupid:         { src:'cupid-bond-v1.webp',                  titleZh:'爱神连结',     titleEn:"CUPID'S BOND" },
    serialkiller:  { src:'serial-killer-hunt-v1.webp',          titleZh:'暗夜猎杀',     titleEn:'MIDNIGHT HUNT', position:'30% center' },
    gravekeeper:   { src:'gravekeeper-revelation-v1.webp',      titleZh:'墓园启示',     titleEn:'GRAVE REVELATION', position:'35% center' },
    dreamwalker:   { src:'dreamwalker-protection-v1.webp',      titleZh:'入梦守护',     titleEn:'DREAM SANCTUARY', position:'60% center' },
    dreamwalkerNightmare:{src:'dreamwalker-nightmare-v1.webp',  titleZh:'噩梦沉沦',     titleEn:'SECOND NIGHTMARE', position:'62% center' },
    alchemist:     { src:'alchemist-mist-v1.webp',              titleZh:'未明之雾',     titleEn:'VEIL OF MIST', position:'38% center' },
    alchemistRescue:{src:'alchemist-serpent-v1.webp',           titleZh:'法老之蛇',     titleEn:"PHARAOH'S SERPENT", position:'65% center' },
    gargoyle:      { src:'gargoyle-scry-v1.webp',               titleZh:'石瞳窥视',     titleEn:'OBSIDIAN SIGHT', position:'58% center' },
    gargoyleAwaken:{ src:'gargoyle-awakening-v1.webp',          titleZh:'石像苏醒',     titleEn:'GARGOYLE AWAKENS', position:'55% center' },
    soulwarden:    { src:'soulwarden-sanctuary-v1.webp',        titleZh:'圣域净化',     titleEn:'SANCTUARY', position:'58% center' }
  };

  window.RoleActionCG = Object.freeze(MAP);
})();

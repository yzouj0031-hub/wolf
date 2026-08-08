/* Unified role sigils for the game UI. Role emoji remain data-only for legacy logs. */
(function () {
  'use strict';

  const GLYPHS = {
    werewolf: '<path d="M25 43c-7-3-11-10-10-18l7 5 3-13 7 9 7-9 3 13 7-5c1 8-3 15-10 18-4 2-10 2-14 0Z"/><path d="m24 35 5 3m11-3-5 3M28 45l4-4 4 4"/>',
    wolfking: '<path d="M25 43c-7-3-11-10-10-18l7 5 3-12 7 8 7-8 3 12 7-5c1 8-3 15-10 18-4 2-10 2-14 0Z"/><path d="m20 17 4-7 8 6 8-6 4 7-3 5H23Z"/>',
    wolfbeauty: '<path d="M32 49C19 39 14 32 17 24c3-7 12-8 15-1 3-7 12-6 15 1 3 8-2 15-15 25Z"/><path d="M32 42c-2-10 1-19 10-25m-3 3c5-1 8 1 9 5-5 1-8-1-9-5Zm-4 7c-5-1-8 1-9 5 5 1 8-1 9-5Z"/>',
    wolfconcubine: '<circle cx="32" cy="32" r="15"/><path d="M39 18a16 16 0 1 0 0 28 13 13 0 1 1 0-28Z"/><path d="m16 17 4 3m28-3-4 3M32 9v6"/>',
    whitewolf: '<path d="M25 44c-7-4-10-11-9-19l7 5 3-13 6 9 6-9 3 13 7-5c1 8-2 15-9 19-4 2-10 2-14 0Z"/><path d="M21 13 17 8m26 5 4-5M32 15V7M26 37h12"/>',
    mechwolf: '<path d="M23 43c-7-4-10-11-8-19l8 6 3-12 6 8 6-8 3 12 8-6c2 8-1 15-8 19-5 3-13 3-18 0Z"/><circle cx="32" cy="35" r="5"/><path d="M32 27v3m0 10v4m-8-9h3m10 0h3M10 32h5m34 0h5M32 10v6"/>',
    seer: '<path d="M9 32s9-14 23-14 23 14 23 14-9 14-23 14S9 32 9 32Z"/><circle cx="32" cy="32" r="8"/><circle cx="32" cy="32" r="2"/><path d="M32 9v5M12 16l4 4m36-4-4 4"/>',
    witch: '<path d="M24 12h16m-13 0v9L18 43c-2 5 1 8 6 8h16c5 0 8-3 6-8l-9-22v-9"/><path d="M22 38h20M26 31c3 2 9 2 12 0"/>',
    guard: '<path d="M32 9 50 16v13c0 12-7 21-18 26C21 50 14 41 14 29V16Z"/><path d="m23 32 6 6 13-15"/>',
    hunter: '<circle cx="32" cy="32" r="17"/><circle cx="32" cy="32" r="8"/><path d="M32 7v11m0 28v11M7 32h11m28 0h11"/>',
    knight: '<path d="m18 49 28-33 3 3-28 33Z"/><path d="m39 15 7-5 8 8-5 7M14 43l7 7m-9 3 5-5"/><path d="M18 18h14m-7-7v14"/>',
    magician: '<circle cx="32" cy="32" r="16"/><path d="M32 7v9m0 32v9M7 32h9m32 0h9M15 15l7 7m20 20 7 7m0-34-7 7M22 42l-7 7"/><path d="m32 24 2 6 6 2-6 2-2 6-2-6-6-2 6-2Z"/>',
    villager: '<path d="M13 50h38M18 50V29l14-12 14 12v21M25 50V37h14v13"/><path d="M11 29 32 11l21 18M22 25h20"/>',
    fool: '<path d="M16 23c5-10 12-12 16-4 4-8 11-6 16 4l-4 25H20Z"/><path d="M20 23 12 13l14 4M44 23l8-10-14 4M25 35c2 2 4 3 7 3s5-1 7-3"/><circle cx="12" cy="12" r="2"/><circle cx="52" cy="12" r="2"/>',
    jester: '<path d="M14 25c4-10 11-14 18-5 7-9 14-5 18 5l-5 24H19Z"/><path d="m18 23-7-10 15 4m20 6 7-10-15 4M25 34c4 4 10 4 14 0"/><path d="M25 42c4-2 10-2 14 0"/>',
    merchant: '<path d="M13 24h38l-3 27H16Z"/><path d="m17 24 5-12h20l5 12M24 34h16M32 27v14"/><circle cx="32" cy="46" r="2"/>',
    youshang: '<path d="M16 49V26l16-14 16 14v23Z"/><path d="M24 49V36h16v13M20 22h24"/><path d="m32 18 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z"/>',
    fox: '<path d="M17 19 27 9l5 13 5-13 10 10 5 16-8 15-12 5-12-5-8-15Z"/><path d="m23 34 6 2m12-2-6 2M27 45l5 3 5-3"/><path d="M46 10a10 10 0 1 0 7 17 12 12 0 1 1-7-17Z"/>',
    whitecat: '<path d="M18 26 20 11l11 10h2l11-10 2 15v14c0 8-6 14-14 14s-14-6-14-14Z"/><path d="m23 36 6 2m12-2-6 2M29 45h6m-19-5H8m48 0h-8"/>',
    cupid: '<path d="M32 50C18 39 13 31 17 23c4-7 12-7 15 0 3-7 11-7 15 0 4 8-1 16-15 27Z"/><path d="M11 49 52 10m-9 1 9-1-1 9M13 41l-2 8 8-1"/>',
    serialkiller: '<path d="m16 50 27-34 6 5-27 34Z"/><path d="m39 15 6-6 10 8-6 6M15 43l7 7"/><path d="M16 17h12M22 11v12"/>',
    gravekeeper: '<path d="M18 52h28M22 52V26l10-14 10 14v26"/><path d="M27 34h10M32 29v10M15 52h34"/>',
    dreamwalker: '<path d="M42 13a20 20 0 1 0 8 34A23 23 0 1 1 42 13Z"/><path d="m18 18 2 5 5 2-5 2-2 5-2-5-5-2 5-2Zm31 2 1 3 3 1-3 1-1 3-1-3-3-1 3-1Z"/>',
    alchemist: '<path d="M24 11h16m-13 0v10L17 46c-2 5 2 8 7 8h16c5 0 9-3 7-8L37 21V11"/><path d="M22 39h20m-15-8c4 3 7-3 11 0"/>',
    gargoyle: '<path d="M18 48 12 31l10 5 3-18 7 9 7-9 3 18 10-5-6 17-14 7Z"/><path d="m23 41 6 2m12-2-6 2M28 49h8"/>',
    soulwarden: '<circle cx="32" cy="32" r="19"/><path d="M32 12v40M20 23h24M24 43c3-9 13-9 16 0M18 17l5 4m23-4-5 4"/>',
    imitator: '<rect x="17" y="13" width="24" height="34" rx="3"/><path d="m29 22 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z"/><path d="M41 20h6v31H23v-4"/>',
    default: '<circle cx="32" cy="32" r="18"/><path d="M32 15v34M15 32h34M20 20l24 24m0-24L20 44"/>'
  };

  const ALIASES = { whitewolfking: 'whitewolf', subfox: 'fox' };

  function render(roleId, className) {
    const id = ALIASES[roleId] || roleId;
    const glyph = GLYPHS[id] || GLYPHS.default;
    return '<span class="role-sigil ' + (className || '') + '" aria-hidden="true">' +
      '<svg viewBox="0 0 64 64" focusable="false"><circle class="sigil-ring outer" cx="32" cy="32" r="29"/>' +
      '<circle class="sigil-ring inner" cx="32" cy="32" r="25"/><g class="sigil-glyph">' + glyph + '</g>' +
      '<path class="sigil-star" d="M32 1.5 33.4 5 37 6.4 33.4 7.8 32 11.3 30.6 7.8 27 6.4 30.6 5Z"/></svg></span>';
  }

  window.RoleSigils = Object.freeze({ render });
})();

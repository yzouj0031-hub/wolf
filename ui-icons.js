/* Shared monochrome UI icon system. Keeps controls consistent across browsers and APK WebViews. */
(() => {
  'use strict';

  const ICONS = Object.freeze({
    settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.1 2.1-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-3v-.2a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L6.6 17l.1-.1A1.7 1.7 0 0 0 7 15a1.7 1.7 0 0 0-1.6-1H5v-3h.4A1.7 1.7 0 0 0 7 10a1.7 1.7 0 0 0-.3-1.9L6.6 8l2.1-2.1.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6v-.2h3v.2a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 8l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v3H21a1.7 1.7 0 0 0-1.6 1Z"/>',
    play:'<path d="m8 5 11 7-11 7Z"/>',
    step:'<path d="m7 5 9 7-9 7Z"/><path d="M18 5v14"/>',
    cycle:'<path d="M20 7h-5V2"/><path d="M20 7a8 8 0 0 0-13.7-2.3L5 6"/><path d="M4 17h5v5"/><path d="M4 17a8 8 0 0 0 13.7 2.3L19 18"/>',
    ask:'<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/><path d="M9.6 9a2.5 2.5 0 1 1 3.8 2.1c-.9.6-1.4 1-1.4 2"/><path d="M12 16h.01"/>',
    replay:'<path d="M4 11a8 8 0 1 1 2.3 5.7"/><path d="M4 4v7h7"/><path d="m11 9 5 3-5 3Z"/>',
    trophy:'<path d="M8 4h8v4a4 4 0 0 1-8 0Z"/><path d="M8 6H5v1a4 4 0 0 0 4 4M16 6h3v1a4 4 0 0 1-4 4M12 12v5M9 21h6M10 17h4"/>',
    save:'<path d="M5 3h12l2 2v16H5Z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/>',
    load:'<path d="M3 7h7l2 2h9l-2 10H5Z"/><path d="M12 12v5M9.5 14.5 12 17l2.5-2.5"/>',
    export:'<path d="M14 3H6v18h12V7Z"/><path d="M14 3v4h4M9 13h6M9 17h6"/>',
    share:'<circle cx="18" cy="5" r="2"/><circle cx="6" cy="12" r="2"/><circle cx="18" cy="19" r="2"/><path d="m8 11 8-5M8 13l8 5"/>',
    library:'<path d="M4 4h5v16H4ZM10 4h5v16h-5ZM16 6h4v14h-4Z"/><path d="M6 8h1M12 8h1M18 10h1"/>',
    book:'<path d="M4 4h5a3 3 0 0 1 3 3v13a3 3 0 0 0-3-3H4ZM20 4h-5a3 3 0 0 0-3 3v13a3 3 0 0 1 3-3h5Z"/>',
    volume:'<path d="M5 10v4h4l5 4V6L9 10Z"/><path d="M17 9a4 4 0 0 1 0 6M19.5 6.5a8 8 0 0 1 0 11"/>',
    sliders:'<path d="M4 6h6M14 6h6M4 12h10M18 12h2M4 18h3M11 18h9"/><circle cx="12" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="9" cy="18" r="2"/>',
    reset:'<path d="M4 11a8 8 0 1 1 2.3 5.7"/><path d="M4 4v7h7"/><path d="M9 9l6 6M15 9l-6 6"/>',
    mask:'<path d="M4 7c5-3 11-3 16 0v6c0 5-4 8-8 8s-8-3-8-8Z"/><path d="M7 11c1.5-1 3-1 4 0M13 11c1.5-1 3-1 4 0M9 16c2 1 4 1 6 0"/>',
    moon:'<path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z"/>',
    gavel:'<path d="m14 4 6 6M12 6l6 6M13 5 6 6-7 7-6-6ZM3 21h10M8 15l-5 5"/>',
    skull:'<path d="M5 11a7 7 0 1 1 14 0c0 3-1 4-3 5v4H8v-4c-2-1-3-2-3-5Z"/><circle cx="9" cy="11" r="1"/><circle cx="15" cy="11" r="1"/><path d="M10 16v4M14 16v4"/>',
    message:'<path d="M4 5h16v11H9l-5 4Z"/><path d="M8 9h8M8 12h6"/>',
    sword:'<path d="m14 4 6-2-2 6L9 17l-2-2Z"/><path d="m6 14 4 4M4 20l4-4"/>',
    crown:'<path d="m4 8 4 4 4-7 4 7 4-4-2 11H6Z"/><path d="M6 19h12"/>',
    brain:'<path d="M9 5a3 3 0 0 0-5 2.2A3 3 0 0 0 5 13v2a3 3 0 0 0 4 2.8ZM15 5a3 3 0 0 1 5 2.2A3 3 0 0 1 19 13v2a3 3 0 0 1-4 2.8ZM12 4v16"/><path d="M7 9h2M15 9h2M7 15h2M15 15h2"/>',
    eyeoff:'<path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.5 5.3A10 10 0 0 1 12 5c5 0 9 7 9 7a15 15 0 0 1-2.1 2.8M6.2 6.2C4.2 7.6 3 10 3 12c0 0 4 7 9 7 1.4 0 2.8-.5 4-1.2"/>',
    search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/><path d="m8 10 1.5 1.5L13 8"/>',
    flame:'<path d="M12 22c4 0 7-3 7-7 0-5-4-7-3-12-4 2-7 6-7 10-1-1-2-3-2-4-2 2-3 4-3 7 0 3 3 6 8 6Z"/><path d="M10 18c0-2 2-3 2-5 2 1 3 3 2 5"/>',
    thought:'<path d="M5 15a4 4 0 0 1 1-7.9A6 6 0 0 1 17 8a3.5 3.5 0 0 1 0 7Z"/><circle cx="8" cy="19" r="1"/><circle cx="5" cy="22" r=".5"/>',
    dice:'<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1"/><circle cx="15" cy="9" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="9" cy="15" r="1"/><circle cx="15" cy="15" r="1"/>',
    wrench:'<path d="M14 7a5 5 0 0 0-6-5l3 3-3 3-3-3a5 5 0 0 0 6 6l8 8 2-2-8-8Z"/>',
    tag:'<path d="M3 4h8l10 10-7 7L4 11Z"/><circle cx="8" cy="8" r="1"/>',
    sparkles:'<path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2ZM18 14l.7 2.3L21 17l-2.3.7L18 20l-.7-2.3L15 17l2.3-.7Z"/>',
    network:'<circle cx="6" cy="12" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="18" cy="18" r="2"/><path d="m8 11 8-4M8 13l8 4"/>',
    compress:'<path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/><path d="m3 3 6 6M21 3l-6 6M3 21l6-6M21 21l-6-6"/>',
    mic:'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"/>'
  });

  const makeMask = markup => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${markup}</svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  };

  function apply(root=document) {
    root.querySelectorAll?.('[data-ui-icon]:not(.ui-iconized)').forEach(el => {
      const markup = ICONS[el.dataset.uiIcon];
      if (!markup) return;
      el.style.setProperty('--ui-icon', makeMask(markup));
      el.classList.add('ui-iconized');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => apply());
  else apply();
  new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
    if (node.nodeType !== 1) return;
    if (node.matches?.('[data-ui-icon]')) apply(node.parentElement || document);
    else apply(node);
  }))).observe(document.documentElement, {childList:true, subtree:true});
  window.applyUiIcons = apply;
})();

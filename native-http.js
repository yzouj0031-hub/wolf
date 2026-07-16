(function () {
  'use strict';

  const wrongSupabaseUrl = 'https://hnlsmcucmbicygzjmfut.supabase.co';
  const correctSupabaseUrl = 'https://hnlsmcucmbicygzjfmuf.supabase.co';
  if (window.supabase && typeof window.supabase.createClient === 'function') {
    const createClient = window.supabase.createClient.bind(window.supabase);
    window.supabase.createClient = function (url, key, options) {
      return createClient(url === wrongSupabaseUrl ? correctSupabaseUrl : url, key, options);
    };
  }

  const wireStreamingTts = () => {
    if (window.__wolfStreamingTtsWired || typeof streamSpeak !== 'function') return;
    const originalStreamSpeak = streamSpeak;
    streamSpeak = async function (player, label, result, isWolfChat, noUndo) {
      const output = await originalStreamSpeak.apply(this, arguments);
      try {
        const text = result && result.game;
        const failed = typeof isAISilentFailure === 'function' && isAISilentFailure(text);
        if (text && !isWolfChat && !failed && !(player && player.isPlayer) && typeof TTS !== 'undefined') {
          TTS.speak(player, text);
        }
      } catch (error) {
        console.warn('[朗读] AI发言自动朗读失败', error);
      }
      return output;
    };
    window.__wolfStreamingTtsWired = true;
    console.info('[朗读] AI流式发言已接入自动朗读。');
  };

  const loadTabletLayout = () => {
    if (document.getElementById('tablet-layout-css')) return;
    const link = document.createElement('link');
    link.id = 'tablet-layout-css';
    link.rel = 'stylesheet';
    link.href = './tablet.css?v=5';
    document.head.appendChild(link);
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadTabletLayout, { once: true });
    document.addEventListener('DOMContentLoaded', wireStreamingTts, { once: true });
  } else {
    loadTabletLayout();
    wireStreamingTts();
  }

  if (!window.Capacitor || !window.Capacitor.isNativePlatform || !window.Capacitor.isNativePlatform()) return;
  document.documentElement.classList.add('capacitor-native');

  const browserFetch = window.fetch.bind(window);
  const nativeHttp = window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorHttp;
  if (!nativeHttp || typeof nativeHttp.request !== 'function') return;

  const shouldUseBrowser = (url) => {
    const host = url.hostname.toLowerCase();
    return url.origin === location.origin ||
      host.endsWith('.supabase.co') ||
      host === 'api.github.com' ||
      host === 'github.com' ||
      host.endsWith('.githubusercontent.com') ||
      host === 'cdn.jsdelivr.net' ||
      host === 'fonts.googleapis.com' ||
      host === 'fonts.gstatic.com';
  };

  window.fetch = async function selectiveNativeFetch(input, init) {
    const options = init || {};
    const rawUrl = typeof input === 'string' || input instanceof URL ? String(input) : input.url;
    const url = new URL(rawUrl, location.href);

    if (shouldUseBrowser(url)) return browserFetch(input, options);

    const sourceHeaders = options.headers || (typeof input === 'object' && input.headers) || {};
    const headers = {};
    new Headers(sourceHeaders).forEach((value, key) => { headers[key] = value; });

    let data = options.body;
    const contentType = String(headers['content-type'] || headers['Content-Type'] || '').toLowerCase();
    if (typeof data === 'string' && contentType.includes('application/json')) {
      try { data = JSON.parse(data); } catch (_) {}
    }

    try {
      const result = await nativeHttp.request({
        url: url.href,
        method: String(options.method || (typeof input === 'object' && input.method) || 'GET').toUpperCase(),
        headers,
        data,
        responseType: 'text',
        connectTimeout: 30000,
        readTimeout: 180000
      });

      const body = typeof result.data === 'string' ? result.data : JSON.stringify(result.data == null ? '' : result.data);
      return new Response(body, {
        status: result.status || 200,
        headers: result.headers || {}
      });
    } catch (error) {
      console.error('[Native HTTP]', url.host, error);
      throw error;
    }
  };

  console.info('[Native HTTP] AI API direct mode enabled; Supabase remains on browser fetch.');
})();

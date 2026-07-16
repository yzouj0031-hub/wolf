import { readFileSync, writeFileSync } from 'node:fs';

const path = 'index.html';
let html = readFileSync(path, 'utf8');

const headMarker = '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">';
const pwaHead = `${headMarker}
<meta name="theme-color" content="#0a0a14">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="AI狼人杀">
<meta name="application-name" content="AI狼人杀">
<meta name="description" content="可安装到 Android 和 iPhone 的 AI 狼人杀游戏">
<link rel="manifest" href="./manifest.webmanifest">
<link rel="icon" type="image/png" sizes="192x192" href="./icons/icon-192.png">
<link rel="apple-touch-icon" sizes="180x180" href="./icons/apple-touch-icon.png">`;

if (!html.includes('rel="manifest" href="./manifest.webmanifest"')) {
  if (!html.includes(headMarker)) throw new Error('找不到 viewport 标记');
  html = html.replace(headMarker, pwaHead);
}

const registration = `
// 安装 PWA 并缓存应用外壳；外部 AI/API 请求不会进入离线缓存。
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => {
      console.warn('Service Worker 注册失败：', err);
    });
  });
}
`;

if (!html.includes("navigator.serviceWorker.register('./sw.js')")) {
  const endMarker = '\n</script>\n</body>\n</html>';
  const index = html.lastIndexOf(endMarker);
  if (index < 0) throw new Error('找不到页面结尾标记');
  html = `${html.slice(0, index)}${registration}${html.slice(index)}`;
}

writeFileSync(path, html);

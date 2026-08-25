import fs from 'node:fs';

const zh = fs.readFileSync('native-http.js', 'utf8');
const en = fs.readFileSync('en/native-http.js', 'utf8');
const cap = JSON.parse(fs.readFileSync('capacitor.config.json', 'utf8'));
const native = fs.readFileSync('native-http.js', 'utf8');

function expect(ok, message) {
  if (!ok) throw new Error(message);
}

for (const [name, source] of [['中文', zh], ['英文', en]]) {
  expect(source.includes('const isPrivateNetworkHost = (host)'), `${name}网络层缺少局域网地址识别`);
  expect(source.includes('/^192\\.168\\./'), `${name}页面未识别 192.168/16`);
  expect(source.includes('/^10\\./'), `${name}页面未识别 10/8`);
  expect(source.includes("location.protocol === 'https:' && url.protocol === 'http:'"), `${name}页面未拦截 HTTPS→HTTP 混合内容`);
  expect(source.includes('if (!isPrivateNetworkHost(url.hostname)) return publicProxyFetch(input, init);'), `${name}网络层仍会把私网请求送到公网代理`);
  expect(source.includes('return browserFetch(input, init);'), `${name}网络层未使用浏览器原始 fetch 直连私网`);
}

expect(cap.server?.cleartext === true, 'Capacitor 未允许 Android 局域网 HTTP 明文请求');
expect(cap.plugins?.CapacitorHttp?.enabled === true, 'CapacitorHttp 未启用');
expect(native.includes('nativeHttp.request({'), 'APK 未使用原生 HTTP 请求');

console.log('LAN API: private ranges bypass public proxy; APK native HTTP and cleartext mode enabled');

// 拉取模型列表：Claude 官方 /v1/models + x-api-key，Gemini 官方 /v1beta/models?key=，OpenAI 兼容 /models + Bearer。
// 以前一律按 OpenAI 发，Claude、Gemini 官方永远"未获取到模型列表"；失败时也要报出 HTTP 状态和原因。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {withOfflinePage} from './lib/offline-browser.mjs';

// 官方 Claude / Gemini 不能经网页代理或 APK 原生通道转发：中间层弄丢了 anthropic-version 请求头，
// 官方回 400 "anthropic-version: header is required"。两家官方都允许浏览器直连。
for (const f of ['index.html', 'en/index.html']) {
  const s = fs.readFileSync(f, 'utf8');
  const skip = s.slice(s.indexOf('function skipProxy(u)'), s.indexOf('var _fetch = window.fetch.bind(window);'));
  assert.ok(skip.includes("host === 'api.anthropic.com'") && skip.includes("host === 'generativelanguage.googleapis.com'"), `${f}: 官方 Claude/Gemini 仍经网页代理转发`);
}
for (const f of ['native-http.js', 'en/native-http.js']) {
  const s = fs.readFileSync(f, 'utf8');
  assert.ok(s.includes("host === 'api.anthropic.com' || host === 'generativelanguage.googleapis.com'"), `${f}: 没有识别官方 Claude/Gemini`);
  assert.ok(s.includes('try { return await webViewFetch(input, options); }'), `${f}: 官方 Claude/Gemini 仍走原生通道`);
  assert.ok(s.includes('falling back to native'), `${f}: 直连失败时没有退回原生通道`);
  assert.ok(s.includes('window.CapacitorWebFetch'), `${f}: 没有取用未被 Capacitor 接管的原版 fetch`);
}

await withOfflinePage(async (page, origin) => {
  for (const path of ['/index.html', '/en/index.html']) {
    const errors = [];
    page.removeAllListeners('pageerror'); page.on('pageerror', e => errors.push(e.message));
    await page.goto(origin + path); await page.waitForTimeout(1000);
    const r = await page.evaluate(async () => {
      const seen = [];
      const logs = () => [...document.querySelectorAll('#gl .le')].map(n => n.textContent).slice(-1)[0] || '';
      window.fetch = async (u, init) => {
        u = String(u); seen.push({u, h: Object.assign({}, (init && init.headers) || {})});
        if (u.includes('bad-key')) return new Response('{"error":{"message":"invalid x-api-key"}}', {status: 401});
        if (u.includes('anthropic')) return new Response(JSON.stringify({data:[{id:'claude-opus-4-5'},{id:'claude-sonnet-4-5'}]}), {status: 200});
        if (u.includes('generativelanguage')) return new Response(JSON.stringify({models:[
          {name:'models/gemini-2.5-pro', supportedGenerationMethods:['generateContent']},
          {name:'models/text-embedding-004', supportedGenerationMethods:['embedContent']}]}), {status: 200});
        return new Response(JSON.stringify({data:[{id:'gpt-4.1'}]}), {status: 200});
      };
      const out = {};
      const close = () => $('modelListOverlay').classList.remove('show');
      for (const [id, url] of [['anthropic','https://api.anthropic.com'], ['gemini','https://generativelanguage.googleapis.com'], ['openai','https://api.openai.com/v1']]) {
        seen.length = 0; _cachedModels = [];
        $('g-apitype').value = id; $('g-url').value = url; $('g-key').value = 'k1';
        await fetchModels(); close();
        out[id] = {req: seen[0], models: _cachedModels.slice()};
      }
      $('g-apitype').value = 'anthropic'; $('g-url').value = 'https://bad-key.example'; $('g-key').value = 'k1';
      await fetchModels();
      out.err = logs();
      out.prev = [resolveEndpointPreview('anthropic','https://api.anthropic.com/v1'), resolveEndpointPreview('anthropic','https://api.anthropic.com/v1/messages/'),
        resolveEndpointPreview('gemini','https://generativelanguage.googleapis.com/v1beta','gemini-2.5-pro')];
      return out;
    });
    assert.deepEqual(errors, [], `${path}: 页面报错`);
    assert.equal(r.anthropic.req.u, 'https://api.anthropic.com/v1/models?limit=1000', `${path}: Claude 官方地址不对`);
    assert.equal(r.anthropic.req.h['x-api-key'], 'k1', `${path}: Claude 官方没带 x-api-key`);
    assert.ok(r.anthropic.req.h['anthropic-version'], `${path}: Claude 官方没带 anthropic-version`);
    assert.deepEqual(r.anthropic.models, ['claude-opus-4-5', 'claude-sonnet-4-5'], `${path}: Claude 模型列表解析错`);
    assert.ok(r.gemini.req.u.startsWith('https://generativelanguage.googleapis.com/v1beta/models?') && r.gemini.req.u.includes('key=k1'), `${path}: Gemini 官方地址不对：${r.gemini.req.u}`);
    assert.deepEqual(r.gemini.models, ['gemini-2.5-pro'], `${path}: Gemini 应去掉 models/ 前缀并过滤掉不能对话的模型`);
    assert.equal(r.openai.req.u, 'https://api.openai.com/v1/models', `${path}: OpenAI 地址不对`);
    assert.equal(r.openai.req.h.Authorization, 'Bearer k1', `${path}: OpenAI 没带 Bearer`);
    assert.deepEqual(r.openai.models, ['gpt-4.1'], `${path}: OpenAI 模型列表解析错`);
    assert.deepEqual(r.prev, ['https://api.anthropic.com/v1/messages', 'https://api.anthropic.com/v1/messages',
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent'], `${path}: 地址带 /v1 时拼出了重复路径`);
    assert.match(r.err, /HTTP 401.*invalid x-api-key/, `${path}: 失败时没报出状态码和原因：${r.err}`);
  }
});
console.log('model list: Claude / Gemini official and OpenAI-compatible each use their own endpoint and auth; failures show the HTTP status and reason');

import fs from 'node:fs';

const html = fs.readFileSync('index.html', 'utf8');
const js = fs.readFileSync('undercover-ui.js', 'utf8');
const css = fs.readFileSync('undercover-ui.css', 'utf8');
const build = fs.readFileSync('scripts/build-www.mjs', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
const nativeHttp = fs.readFileSync('native-http.js', 'utf8');

function expect(ok, message) { if (!ok) throw new Error(message); }

expect(html.includes('icons/modes/undercover.jpg') || nativeHttp.includes('icons/modes/undercover.jpg'), '大厅未使用谁是卧底专属立绘');
expect(nativeHttp.includes('8席独立 API 配置'), '大厅仍在暗示谁是卧底复用狼人杀 API');
expect(html.includes('<script src="./undercover-ui.js"></script>') || nativeHttp.includes("script.src = './undercover-ui.js'"), '正式卧底界面脚本未加载');
expect(html.includes('<link rel="stylesheet" href="./undercover-ui.css">') || nativeHttp.includes("style.href = './undercover-ui.css'"), '正式卧底界面样式未加载');
expect(js.includes('configOf(i).name'), '卧底席位未同步狼人杀玩家名称');
expect(js.includes('configOf(id).avatar'), '卧底席位未同步狼人杀头像');
expect(js.includes('cfg.persona'), '卧底席位未同步狼人杀人格');
expect(js.includes("API_STORAGE = 'wg_undercover_api_v2'"), '卧底没有独立 API 存储');
expect(js.includes('window.AuxGameAPI'), '卧底没有复用多渠道 API 请求层');
expect(js.includes('uc-api-type') && js.includes('uc-api-url') && js.includes('uc-api-key') && js.includes('uc-api-model'), '卧底缺少自定义 API 表单');
expect(js.includes('data-test-seat') && js.includes('data-clear-seat'), '卧底缺少单席 API 测试或清除覆盖');
expect(js.includes('UC._ask = async function') && js.includes('kit.request(api,sys,user'), '卧底实际对局仍未切换到独立 API');
expect(!js.includes('const apiOf = id => { try { return getAPI(id)'), '卧底仍直接读取狼人杀 P1-P8 API');
expect(js.includes('openPCfg(id)'), '卧底席位不能打开内置玩家配置');
expect(js.includes("document.body.classList.add('uc-configuring')"), '玩家配置弹窗未进入卧底同步状态');
expect(js.includes('apiOf(pl.id).model'), '发言记录未显示玩家模型');
expect(css.includes('.uc-seat-avatar') && css.includes('.uc-msg-avatar'), '席位或发言区缺少头像视觉');
expect(build.includes("'undercover-ui.js'") && build.includes("'undercover-ui.css'"), 'APK 构建未包含卧底正式界面');
expect(sw.includes("CACHE_NAME = 'wolf-pwa-v40-undercover-custom-api'"), 'PWA 缓存版本未随卧底 API 界面升级');
expect(sw.includes("'./undercover-ui.js'") && sw.includes("'./undercover-ui.css'"), 'PWA 未缓存卧底界面资源');

console.log('undercover UI: premium layout, independent custom API, per-seat overrides and PWA cache passed');

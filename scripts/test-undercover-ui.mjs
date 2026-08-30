import fs from 'node:fs';

const html = fs.readFileSync('index.html', 'utf8');
const js = fs.readFileSync('undercover-ui.js', 'utf8');
const css = fs.readFileSync('undercover-ui.css', 'utf8');
const build = fs.readFileSync('scripts/build-www.mjs', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
const nativeHttp = fs.readFileSync('native-http.js', 'utf8');

function expect(ok, message) { if (!ok) throw new Error(message); }

expect(html.includes('icons/modes/undercover.jpg') || nativeHttp.includes('icons/modes/undercover.jpg'), '大厅未使用谁是卧底专属立绘');
expect(nativeHttp.includes('API／网页端 AI／真人混合') && nativeHttp.includes('API / Web AI / human mix'), '大厅没有标明谁是卧底支持混合控制');
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
expect(js.includes('if (!seat || this._running) return'), '对局运行中仍可误改玩家身份资料');
expect(js.includes('uc-seat-config') && css.includes('.uc-seat-config'), '席位中没有可见的玩家资料设置入口');
expect(js.includes("tx('玩家资料','Player')") && !js.includes('⚙'), '玩家资料入口仍使用 emoji 或错误暗示可修改共享 API');
expect(js.includes('data-seat-api') && js.includes('this._openApiPanel(Number(apiButton.dataset.seatApi))'), '卧底席位内没有直达该席 API 的入口');
expect(js.includes('id="uc-api-fetch-models"') && js.includes('data-fetch-seat') && js.includes('kit.listModels'), '卧底默认配置或单席配置不能拉取模型');
expect(js.includes('data-control-seat') && js.includes("option value=\"web\"") && js.includes("option value=\"human\""), '卧底缺少逐席 API／网页端 AI／真人控制');
expect(js.includes("if(control==='web')") && js.includes("if(control==='human')"), '卧底请求流程没有按席位控制方式路由');
expect(js.includes('uc-turn-overlay') && js.includes('真人席位交接') && js.includes('网页端 AI 接力'), '卧底缺少真人私密交接或网页端接力界面');
expect(js.includes("id=\"uc-human-cancel\"") && js.includes("真人回合已中断"), '卧底真人私密回合无法安全中断');
expect(js.includes('this._godView=!hasHumanSeats()'), '卧底真人入局时仍会向公共界面显示秘密词语');
expect(js.includes('item.open=true') && js.includes("scrollIntoView({block:'nearest'})"), '单席 API 入口没有自动展开对应席位');
expect(css.includes('body.uc-configuring #pcpop{z-index:1200'), '玩家资料配置层会被卧底全屏界面遮挡');
expect(js.includes("document.body.classList.add('uc-configuring')"), '玩家配置弹窗未进入卧底同步状态');
expect(js.includes("classList.add('uc-page-locked')") && js.includes("classList.remove('uc-page-locked')"), '打开或退出卧底界面时未正确锁定/恢复底层页面');
expect(css.includes('height:100dvh') && css.includes('overscroll-behavior:none') && css.includes('#uc-view{') && css.includes('touch-action:pan-y'), '移动端全屏、纵向滚动或穿透防护不完整');
expect(!css.includes('#uc-view{position:fixed;inset:0;width:100%;height:100vh;height:100dvh;z-index:960;display:none;overflow:hidden;overscroll-behavior:none;touch-action:none'), '卧底根层禁止全部触摸，平板列表将无法滚动');
expect(js.includes('apiOf(pl.id).model'), '发言记录未显示玩家模型');
expect(css.includes('.uc-seat-avatar') && css.includes('.uc-msg-avatar'), '席位或发言区缺少头像视觉');
expect(build.includes("'undercover-ui.js'") && build.includes("'undercover-ui.css'"), 'APK 构建未包含卧底正式界面');
const cacheVersion = Number(sw.match(/CACHE_NAME = 'wolf-pwa-v(\d+)-/)?.[1]);
expect(Number.isInteger(cacheVersion) && cacheVersion >= 43, 'PWA 缓存版本低于混合控制所需版本');
expect(sw.includes("'./undercover-ui.js'") && sw.includes("'./undercover-ui.css'"), 'PWA 未缓存卧底界面资源');

console.log('undercover UI: premium layout, independent custom API, per-seat overrides and PWA cache passed');

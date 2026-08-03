# 🐺 AI 狼人杀

一个由 AI 驱动的狼人杀游戏，支持 PWA 安装，并可通过 Capacitor 打包为 Android 应用。

## 项目特点

- AI 玩家参与发言、推理、投票与夜间行动
- 支持自定义角色和多种特殊技能
- 提供存档、复盘与观战体验
- 支持桌面端、移动端和 PWA 离线访问
- 支持简体中文 / English 界面切换、英文规则导出与英文 AI 行动指令
- 可构建为 Capacitor Android 应用
- 由 Google Antigravity (Gemini) / Claude / Codex 协助开发与优化

## 本地运行

这是一个以静态网页为主体的项目。克隆仓库后，可以用任意静态文件服务器打开：

```bash
git clone https://github.com/yzouj0031-hub/wolf.git
cd wolf
npx serve .
```

然后访问终端中显示的本地地址。直接双击 `index.html` 可能受到浏览器跨域和 Service Worker 策略限制，因此推荐使用静态文件服务器。

## 构建 Android Web 资源

需要安装 Node.js：

```bash
npm ci
npm run build:www
```

构建脚本会把应用运行所需的网页资源收集到 `www/`，供 Capacitor 使用。

首次创建 Android 工程时运行：

```bash
npx cap add android
npx cap sync android
```

已有 Android 工程时，只需在网页资源变化后重新执行：

```bash
npm run build:www
npx cap sync android
```

## 大厅模式卡插画

模式卡上的插画不是新画的素材，而是把 `icons/roles/` 里已有的角色立绘裁掉画框和名牌、
缩成小图后复用（`icons/modes/`）。原立绘每张约 1MB，11 张直接铺到主菜单要加载 8MB；
裁剪压缩后合计约 480KB。各张立绘明暗差别很大，脚本会实测平均亮度并归一化，
让 11 张卡看上去是一套的。

```bash
npm run art:roles    # 把角色立绘压到显示尺寸（就地覆盖，可重复运行）
npm run art:modes    # 改了映射或裁剪参数后重新生成模式卡图
```

角色立绘原始是 896×1200、每张约 1MB（21 张共 18MB），但界面上只用在角色图鉴那个
横向列表小条的背景里。`art:roles` 压到 600px 宽后合计 2.2MB——省下的 16MB 既瘦身了
安装包，也让热更新包（要装整个网页目录）从 20MB+ 降到约 4.9MB 才变得可用。

模式与借用立绘的对应关系写在 `scripts/make-mode-art.mjs` 顶部的 `MAP` 里。

插画只在 `onload` 成功后才会启用（给卡片加 `.has-art`）。图片**不在热更新包内**
（热更新包只含文本资源），所以老版本 APK 热更新到新页面时图会 404 ——
此时卡片自动保持原来的 emoji 样式，不会变成空卡；等用户装了新的安装包才会看到插画。

## 自动更新（仅 APK）

已安装的安卓 App 会自动跟上网页部分的更新，用户不需要重新下载安装包：

启动 8 秒后拉一次 `version.json`（约 1KB，最多 6 小时一次）→ 发现新构建号就后台下载
`bundle.zip` → 交给 `@capgo/capacitor-updater` 在原生层落地 → **切后台或重启后生效**。
对局进行中绝不切换版本（用插件的 `next()` 而不是 `set()`），避免存档格式撕裂。

网页 / PWA **不走这套**——刷新本来就是最新的，白下几 MB 没有意义。

推到 `main` 时 `hot-update.yml` 把更新包发到滚动标签 `web-latest`，`build-apk.yml`
同时出新的 APK，两者用同一个构建号（`git rev-list --count HEAD`）。

### ⚠️ 为什么不能用 Service Worker 做这件事

第一版是用 Service Worker + Cache Storage 掉包的，在浏览器里完全正常，**但在 APK 里
无效**：Capacitor 在原生层用 `WebViewAssetLoader` 拦截请求、直接把安装包里的文件递给
WebView，这一层排在 Service Worker 之前，SW 根本没机会应答导航请求。症状是「提示下载
成功，重启后版本号纹丝不动」。

所以 APK 里**根本不注册 Service Worker**（`index.html` 的注册处有 `isNativePlatform`
判断），而且 `hot-update.js` 启动时会主动注销旧版本遗留的 SW 并清空其缓存——否则插件
换包之后，旧缓存仍会应答 `i18n.js` 这类子资源，造成「新页面配旧脚本」。

### 其他设计约束

- **启动失败自动回滚**：插件要求每次启动调用 `notifyAppReady()`。主脚本完整跑完才会
  调到（`WolfHotUpdate.markBootOk()`），新包把 app 写崩时永远调不到，插件超时后自动
  退回安装包内置版本。
- **装了新 APK 后旧更新包自动退位**：由插件的 `resetWhenUpdate`（默认开）负责。
- **原生层变更走整包更新**：改了 Capacitor 插件、权限或图标时，把 `hot-update.js` 里的
  `NATIVE_ABI` 手动 +1；客户端发现新网页要求的 ABI 高于自己就不下载，改为提示去下载
  新安装包。

本地验证整条链路：

```bash
node scripts/stamp-build.mjs 999 "b999 (test)"      # 写入构建号
node scripts/make-hot-bundle.mjs 999 "b999 (test)"  # 产出 version.json + bundle.zip
node scripts/verify-hot-bundle.mjs                  # 复核包结构与校验和
npm run test:hot-update                             # 在 Node 里跑真实的更新器逻辑
```

> 仓库里的 `APP_BUILD` 必须保持 `0`（测试会检查这一点）。打完标记记得还原，
> 否则会把本地开发版当成线上版本。

> 测试覆盖的是**调用逻辑**。插件能不能在真机上换包只能装 APK 实测——上一版就是败在
> 这一点：逻辑全对，但那套机制在 APK 里根本没机会执行。**发布前务必先自己装一台验证。**

### ⚠️ 发布签名必须配置

目前 APK 走的是 debug 签名回退分支。Android Gradle Plugin 是在构建机上按需生成
debug keystore 的，而 CI 每次都是全新的干净 runner，**每次构建的签名密钥都不一样**，
覆盖安装会被系统拒绝（`INSTALL_FAILED_UPDATE_INCOMPATIBLE`），用户只能先卸载——
而卸载会清掉本机的全部存档、API key 和提示词库。

在仓库 Settings → Secrets 里配上这四个，`build-apk.yml` 会自动切到正式签名：

| Secret | 说明 |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | keystore 文件的 base64（`base64 -w0 release.jks`） |
| `ANDROID_KEYSTORE_PASSWORD` | keystore 密码 |
| `ANDROID_KEY_ALIAS` | 密钥别名 |
| `ANDROID_KEY_PASSWORD` | 密钥密码 |

生成方式（**密钥请自己生成、自己保管，丢了以后所有版本都升不上去**）：

```bash
keytool -genkeypair -v -keystore release.jks -keyalg RSA -keysize 2048 \
  -validity 10000 -alias wolf
```

## 项目结构

| 路径 | 用途 |
| --- | --- |
| `index.html` | 游戏主界面与核心逻辑 |
| `i18n.js` | 中英界面、角色与规则翻译及语言切换 |
| `hot-update.js` | APK/PWA 自动更新：检查、下载、校验、启动失败回滚 |
| `sw.js` | PWA 离线缓存 + 热更新包的启用闸门 |
| `manifest.webmanifest` | PWA 名称、主题与图标配置 |
| `native-http.js` | Web 与原生 HTTP 访问适配 |
| `scripts/` | PWA、存档及 Capacitor 构建脚本 |
| `docs/` | 角色技能等设计文档 |
| `icons/` | Web 与应用图标 |

## 开发说明

- 不要提交 API 密钥、访问令牌或个人存档。
- 修改 PWA 静态资源后，请同步更新 `sw.js` 中的缓存版本，避免客户端继续使用旧资源。
- 自创角色技能的设计与实现状态见 [`docs/custom-skills.md`](docs/custom-skills.md)。

## 致谢

感谢 Allen、小克 和 小柴 对项目的设计、开发与维护贡献。


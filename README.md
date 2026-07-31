# 🐺 AI 狼人杀

一个由 AI 驱动的狼人杀游戏，支持 PWA 安装，并可通过 Capacitor 打包为 Android 应用。

## 项目特点

- AI 玩家参与发言、推理、投票与夜间行动
- 支持自定义角色和多种特殊技能
- 提供存档、复盘与观战体验
- 支持桌面端、移动端和 PWA 离线访问
- 支持简体中文 / English 界面切换、英文规则导出与英文 AI 行动指令
- 可构建为 Capacitor Android 应用

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

## 项目结构

| 路径 | 用途 |
| --- | --- |
| `index.html` | 游戏主界面与核心逻辑 |
| `i18n.js` | 中英界面、角色与规则翻译及语言切换 |
| `sw.js` | PWA 离线缓存 |
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


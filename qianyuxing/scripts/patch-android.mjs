// 在 `npx cap add android` 之后改安卓外壳的主题：
//  · 画进刘海/挖孔那一侧（横屏时摄像头在左边，默认会留一条白边）
//  · 全屏，隐藏系统状态栏（游戏自己按安全区留了边距）
//  · 窗口底色改成深色，任何没盖住的地方都不会露白
import fs from 'node:fs';
const file = 'android/app/src/main/res/values/styles.xml';
let xml = fs.readFileSync(file, 'utf8');
if (!/xmlns:tools=/.test(xml)) xml = xml.replace('<resources', '<resources xmlns:tools="http://schemas.android.com/tools"');
const items = [
  '<item name="android:windowFullscreen">true</item>',
  '<item name="android:windowLayoutInDisplayCutoutMode" tools:targetApi="p">shortEdges</item>',
  '<item name="android:windowBackground">@android:color/black</item>',
  '<item name="android:statusBarColor">@android:color/black</item>',
  '<item name="android:navigationBarColor">@android:color/black</item>',
].join('\n        ');
let n = 0;
xml = xml.replace(/(<style name="AppTheme\.NoActionBar(?:Launch)?"[^>]*>)([\s\S]*?)(<\/style>)/g, (m, open, body, close) => {
  n++;
  const cleaned = body.replace(/\s*<item name="android:(windowFullscreen|windowLayoutInDisplayCutoutMode|windowBackground|statusBarColor|navigationBarColor)"[^<]*<\/item>/g, '');
  return `${open}${cleaned.trimEnd()}\n        ${items}\n    ${close}`;
});
if (n === 0) throw new Error('styles.xml 里没找到 AppTheme.NoActionBar，Capacitor 模板变了，请检查');
fs.writeFileSync(file, xml);
console.log(`已改 ${n} 个主题：全屏、画进刘海区、深色底`);
console.log(xml);

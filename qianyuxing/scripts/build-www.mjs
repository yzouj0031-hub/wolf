// 把游戏文件收进 www/，交给 Capacitor 打包。游戏本身是单文件，只多一个本地的 three.js。
import fs from 'node:fs';
fs.rmSync('www', { recursive: true, force: true });
fs.mkdirSync('www', { recursive: true });
for (const f of ['index.html', 'three.min.js']) fs.copyFileSync(f, 'www/' + f);
console.log('www/ 已就绪：', fs.readdirSync('www').join(', '));

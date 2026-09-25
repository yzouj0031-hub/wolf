// 读页面源码，并把它加载的中英文共用模块（js/ 目录）按 <script> 标签的原位置内联回去。
// 很多测试按"源码里有没有这段代码"做断言；代码从 index.html / en/index.html 搬到 js/ 以后，
// 用这个函数读，断言照旧成立，先后顺序也与浏览器实际加载顺序一致。
import fs from 'node:fs';
import path from 'node:path';

export function readPageSource(file) {
  const html = fs.readFileSync(file, 'utf8');
  const dir = path.dirname(path.resolve(file));
  return html.replace(/<script src="((?:\.\.?\/)?js\/[^"?]+)(?:\?[^"]*)?"><\/script>/g, (tag, src) => {
    const code = fs.readFileSync(path.resolve(dir, src), 'utf8');
    return `<script data-src="${src}">\n${code}\n</script>`;
  });
}

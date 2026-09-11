// 更新弹窗里的「这次改了什么」。
//
// 两件事值得单独钉住：
//   ① 这段文字来自网络上的 version.json（GitHub release 里的一个文件）。它不是可信输入，
//      所以只能 textContent 逐条塞。任何一天有人把它改成拼 innerHTML，就是在更新弹窗里
//      开了一个 XSS 入口——而这个弹窗恰好是全应用里用户最容易点「确定」的地方。
//   ② 清单是旧版本的客户端也会读的。字段缺失、是 null、是字符串而不是数组，都不能让
//      弹窗崩掉——弹窗崩了用户就永远更新不了，只能重装。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const FILES = ['hot-update.js', 'en/hot-update.js'];

// 够 renderNotes 用的最小 DOM
function fakeDom() {
  const mk = (tag) => ({
    tagName: tag, children: [], style: {}, hidden: false, _text: '',
    set textContent(v) { this._text = String(v); }, get textContent() { return this._text; },
    get firstChild() { return this.children[0] || null; },
    appendChild(c) { this.children.push(c); return c; },
    removeChild(c) { this.children = this.children.filter(x => x !== c); return c; },
    set cssText(v) {},
  });
  const ul = mk('ul');
  ul.style = { set cssText(v) {} };
  return { ul, document: { getElementById: (id) => (id === 'wolf-update-notes' ? ul : null), createElement: mk } };
}

function loadRenderNotes(src, file) {
  const a = src.indexOf('  const NOTES_SHOWN = 8;');
  const b = src.indexOf('  function renderDialog() {', a);
  assert.ok(a >= 0 && b > a, `${file}: renderNotes 未找到`);
  const dom = fakeDom();
  const ctx = { document: dom.document, targetMeta: null, EN: false, String, Array, Boolean };
  vm.createContext(ctx);
  vm.runInContext(`${src.slice(a, b)}; this.render = renderNotes;`, ctx, { filename: file });
  return { run: (notes, en = false) => { ctx.targetMeta = notes === undefined ? null : { notes }; ctx.EN = en; ctx.render(); return dom.ul; }, ul: dom.ul };
}

for (const file of FILES) {
  const src = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

  // ── 1. ★ 绝不能拼 innerHTML ────────────────────────────────────────────────
  assert.ok(src.includes('li.textContent = text;'), `${file}: 更新说明不是用 textContent 注入的`);
  assert.ok(!/wolf-update-notes[\s\S]{0,600}innerHTML/.test(src), `${file}: 更新说明附近出现了 innerHTML`);

  const { run } = loadRenderNotes(src, file);

  // ── 2. 正常渲染 ─────────────────────────────────────────────────────────────
  let ul = run(['改了 A', '修了 B', '删了 C']);
  assert.equal(ul.hidden, false, `${file}: 有说明时列表被藏起来了`);
  assert.deepEqual(ul.children.map(li => li.textContent), ['改了 A', '修了 B', '删了 C'], `${file}: 说明没有原样列出`);

  // 重复渲染不能叠加（弹窗每次 renderDialog 都会调一次）
  ul = run(['改了 A', '修了 B', '删了 C']);
  assert.equal(ul.children.length, 3, `${file}: 重复渲染导致条目累积`);

  // ── 3. 超过 8 条要折叠，而不是把弹窗撑成发布公告 ────────────────────────────
  ul = run(Array.from({ length: 12 }, (_, i) => `第${i + 1}条`));
  assert.equal(ul.children.length, 9, `${file}: 超长列表没有折叠`);
  assert.equal(ul.children[7].textContent, '第8条', `${file}: 折叠位置不对`);
  assert.match(ul.children[8].textContent, /另有 4 项改动/, `${file}: 折叠行的计数不对`);
  ul = run(Array.from({ length: 12 }, (_, i) => `n${i}`), true);
  assert.match(ul.children[8].textContent, /and 4 more changes/, `${file}: 折叠行没有英文`);

  // ── 4. ★ 清单畸形不能把弹窗弄崩——崩了用户就永远更不了，只能重装 ──────────────
  for (const bad of [undefined, null, [], 'not-an-array', 123, {}, [null, '', '   ', undefined]]) {
    let out;
    assert.doesNotThrow(() => { out = run(bad); }, `${file}: notes=${JSON.stringify(bad)} 让弹窗崩了`);
    assert.equal(out.hidden, true, `${file}: notes=${JSON.stringify(bad)} 时列表没有隐藏`);
    assert.equal(out.children.length, 0, `${file}: notes=${JSON.stringify(bad)} 时渲染出了空条目`);
  }
  // 混进空值时只丢空值，不丢正常条目
  ul = run([null, '真改动', '', '  ', '另一条']);
  assert.deepEqual(ul.children.map(li => li.textContent), ['真改动', '另一条'], `${file}: 空值过滤把正常条目也丢了`);

  // ── 5. 单条过长要截断，不能让一条提交信息占满整个弹窗 ────────────────────────
  ul = run(['长'.repeat(500)]);
  assert.equal(ul.children[0].textContent.length, 200, `${file}: 超长单条没有截断`);

  // ── 6. 恶意内容原样当文字，不解释成标签 ──────────────────────────────────────
  const evil = '<img src=x onerror=alert(1)>';
  ul = run([evil]);
  assert.equal(ul.children[0].textContent, evil, `${file}: 恶意内容没有被当成纯文本`);
}

// ── 7. 生成侧：清单里真的带上了 notes，且取不到时不会写坏 ──────────────────────
{
  const gen = fs.readFileSync(new URL('../scripts/make-hot-bundle.mjs', import.meta.url), 'utf8');
  assert.ok(/\n  notes\n\};/.test(gen), 'make-hot-bundle 没有把 notes 写进 version.json');
  assert.ok(gen.includes("process.env.HOT_NOTES_SINCE"), 'make-hot-bundle 没有支持指定起点');
  assert.ok(gen.includes("if (out === null) out = tryGit(['log', '--no-merges', '--pretty=%s', '-n', '10']);"),
    'make-hot-bundle 在算不出范围时没有退回最近若干条');
  assert.ok(gen.includes('.slice(0, 12);'), 'make-hot-bundle 没有限制条数');
  // git 不可用时必须返回空数组而不是抛异常——发布流程不能因为拿不到更新说明就整个失败
  assert.ok(gen.includes("} catch (e) { return null; }"), 'make-hot-bundle 没有吞掉 git 失败');

  const wf = fs.readFileSync(new URL('../.github/workflows/hot-update.yml', import.meta.url), 'utf8');
  assert.ok(wf.includes('HOT_NOTES_SINCE: ${{ github.event.before }}'), '发布流程没有把上次发布的位置传进去');
}

console.log('update notes: text-only injection, folding, malformed-manifest safety and manifest wiring passed');

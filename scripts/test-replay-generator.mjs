import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../replay-generator.js', import.meta.url), 'utf8');
let exportedBlob = null;
let downloadName = '';

class TestBlob {
  constructor(parts, options) {
    this.parts = parts;
    this.options = options;
    exportedBlob = this;
  }
}

const anchor = {
  href: '',
  download: '',
  click() { downloadName = this.download; }
};

const sandbox = {
  S: {
    players: [{id: 0, name: '测试玩家', role: {name: '预言家', emoji: 'seer', team: 'good'}, dead: false}],
    history: ['第1夜'],
    pureAI: false,
    knightChainMode: false,
    killEdgeMode: false
  },
  playerConfigs: [{}],
  localStorage: {getItem() { return null; }},
  window: {},
  document: {
    body: {appendChild() {}, removeChild() {}},
    createElement(tag) {
      assert.equal(tag, 'a');
      return anchor;
    }
  },
  URL: {
    createObjectURL() { return 'blob:test'; },
    revokeObjectURL() {}
  },
  Blob: TestBlob,
  alert(message) { throw new Error(`unexpected alert: ${message}`); },
  i18n(message) { return message; },
  console
};

vm.runInNewContext(`${source}\nthis.__exportReplayHTML = exportReplayHTML;`, sandbox, {filename: 'replay-generator.js'});
sandbox.__exportReplayHTML();

assert.ok(exportedBlob, 'replay export did not create a Blob');
assert.match(downloadName, /^Wolf_Replay_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.html$/);

const html = exportedBlob.parts.join('');
assert.match(html, /<!DOCTYPE html>/i);
assert.match(html, /const DATA = /);

const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(match => match[1]);
assert.ok(scripts.length > 0, 'generated replay has no inline script');
for (const script of scripts) new vm.Script(script, {filename: 'generated-replay.html'});

console.log('replay generator: source and generated HTML scripts parse successfully');

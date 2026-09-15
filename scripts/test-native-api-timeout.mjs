import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

for (const file of ['native-http.js', 'en/native-http.js']) {
  const source = fs.readFileSync(file, 'utf8');
  const start = source.indexOf('  window.fetch = async function selectiveNativeFetch');
  const end = source.indexOf("  console.info('[Native HTTP]", start);
  let seconds = '600', calls = 0, params, finish;
  const ctx = vm.createContext({
    window:{}, document:{getElementById:()=>({value:seconds})},
    location:{href:'https://localhost/'}, URL, Headers, Response, DOMException,
    console:{error(){}}, shouldUseBrowser:()=>false,
    nativeHttp:{request(p){calls++; params=p; return new Promise(resolve=>{finish=resolve;});}},
  });
  vm.runInContext(source.slice(start, end), ctx);
  for (const [value, expected] of [['600',600000], ['900',900000], ['',600000]]) {
    seconds=value;
    const result=ctx.window.fetch('https://example.com/v1/messages');
    assert.equal(params.readTimeout,expected,file);
    finish({status:200,data:'ok'});
    assert.equal(await (await result).text(),'ok');
  }
  const ctrl=new AbortController(); ctrl.abort();
  const before=calls;
  await assert.rejects(ctx.window.fetch('https://example.com/',{signal:ctrl.signal}),{name:'AbortError'});
  assert.equal(calls,before);
  const running=new AbortController();
  const result=ctx.window.fetch('https://example.com/',{signal:running.signal});
  running.abort();
  await assert.rejects(result,{name:'AbortError'});
  finish({status:200,data:'late reply must not publish'});
}
console.log('Native API timeout settings, cancellation and late-result isolation passed');

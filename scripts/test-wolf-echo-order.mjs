import assert from 'node:assert/strict';
import fs from 'node:fs';

function rotatedEcho(opening) {
  return opening.length === 2
    ? opening.slice()
    : (opening.length > 2
      ? opening.slice(1).concat(opening.slice(0, 1))
      : opening.slice());
}

assert.deepEqual(rotatedEcho([1, 2, 3]), [2, 3, 1], '1→2→3 must echo as 2→3→1');
assert.deepEqual(rotatedEcho([1, 2]), [1, 2], 'two wolves must keep their order to avoid 2 speaking twice in a row');
assert.deepEqual(rotatedEcho([4, 1, 7, 2]), [1, 7, 2, 4]);
assert.deepEqual(rotatedEcho([5]), [5]);
for (const opening of [[1, 2], [1, 2, 3], [1, 2, 3, 4]]) {
  const echo = rotatedEcho(opening);
  assert.notEqual(echo[0], opening.at(-1), `last opener must not speak first in echo: ${opening}`);
  assert.deepEqual([...echo].sort(), [...opening].sort(), 'rotation must preserve every wolf exactly once');
}

for (const file of ['index.html', 'en/index.html']) {
  const source = fs.readFileSync(file, 'utf8');
  assert.match(source, /openingOrder:\[\], echoOrder:\[\]/, `${file}: new run does not persist discussion order`);
  assert.match(source, /wolfRun\.openingOrder = openingOrderIds\.slice\(\)/, `${file}: opening order is not checkpointed`);
  assert.match(source, /openingOrderIds\.slice\(1\)\.concat\(openingOrderIds\.slice\(0, 1\)\)/, `${file}: echo order is not a cyclic rotation`);
  assert.match(source, /wolfRun\.echoOrder = echoOrderIds\.slice\(\)/, `${file}: echo order is not checkpointed`);
  assert.match(source, /【队友当前最新表态】/, `${file}: echo prompt hides earlier echo updates behind an opening-only label`);
  assert.doesNotMatch(source, /const phase2Order = shuffle\(ws\.slice\(\)\)/, `${file}: echo round still reshuffles independently`);
}

console.log('Wolf echo order: cyclic response order and resume persistence passed');

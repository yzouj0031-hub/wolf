import fs from 'node:fs';

const failures = [];
const expect = (ok, message) => { if (!ok) failures.push(message); };

for (const file of ['index.html', 'en/index.html']) {
  const src = fs.readFileSync(file, 'utf8');

  expect(
    src.includes('（我自己·优先发言并放弃归票）'),
    `${file}: sheriff self-start choice does not explain the tradeoff`
  );
  expect(
    !src.includes('（我自己·抢先定调）'),
    `${file}: obsolete ambiguous sheriff self-start label remains`
  );
  expect(
    /if \(startId === sheriffP\.id\) \{\s*sheriffSpeaksLast = false;\s*\} else \{\s*const seatChoice = await waitChoice/.test(src),
    `${file}: human sheriff can still choose last summary after choosing self as start`
  );
  expect(
    src.includes('const orderCandidates = candidates.concat([sheriffP]);'),
    `${file}: AI sheriff is missing from valid starting-player candidates`
  );
  expect(
    src.includes('extractTargetName(actionText, orderCandidates)'),
    `${file}: AI sheriff self-start cannot be parsed`
  );
  expect(
    src.includes('【硬约束】起点选你自己时，系统必定按“优先发言并放弃归票”执行'),
    `${file}: AI prompt does not state that self-start and last summary are exclusive`
  );
  expect(
    /sheriffSpeaksLast = startId === sheriffP\.id\s*\? false\s*: !\(/.test(src),
    `${file}: contradictory AI output is not normalized to self-start`
  );
  expect(
    src.includes("startId === sheriffP.id ? '警长优先发言（已放弃归票权）'"),
    `${file}: public order summary does not distinguish sheriff priority speech`
  );
}

if (failures.length) {
  console.error(failures.map(message => `FAIL ${message}`).join('\n'));
  process.exit(1);
}

console.log('sheriff order: self-start and last-summary choices are mutually exclusive');

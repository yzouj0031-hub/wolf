import fs from 'node:fs';

const failures=[];
const expect=(ok,msg)=>{if(!ok)failures.push(msg);};
const expectedGroups=[
  "['seer','fox']",
  "['witch','alchemist']",
  "['guard','dreamwalker']",
  "['merchant','youshang']"
];

for(const file of ['index.html','en/index.html']){
  const src=fs.readFileSync(file,'utf8');
  expect(src.includes('id="role-overlap-hints"'),`${file}: missing overlap hint panel`);
  expect(src.includes('const ROLE_OVERLAP_GROUPS'),`${file}: missing overlap metadata`);
  for(const group of expectedGroups) expect(src.includes(group),`${file}: missing overlap group ${group}`);
  expect(src.includes('function getRoleOverlapHints(counts)'),`${file}: missing overlap detector`);
  expect(src.includes('selected.length > 1'),`${file}: hint must require two selected roles in a group`);
  expect(/\$\('cgo'\)\.disabled\s*=\s*!ok;\s*renderRoleOverlapHints\(\);/.test(src),`${file}: selection changes do not refresh hints`);
  expect(src.includes('This is advisory and never blocks the game')||src.includes('这不是错误，也不会阻止开局'),`${file}: warning does not explain that it is advisory`);
}

if(failures.length){console.error(failures.map(x=>'FAIL '+x).join('\n'));process.exit(1);}
console.log('role overlap hints: bilingual advisory groups and live refresh passed');

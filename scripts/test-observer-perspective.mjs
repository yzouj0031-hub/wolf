import fs from 'node:fs';

const failures=[];
const expect=(ok,msg)=>{if(!ok)failures.push(msg);};

for(const file of ['index.html','en/index.html']){
  const src=fs.readFileSync(file,'utf8');
  expect(src.includes('id="observer-perspective-select"'),`${file}: missing perspective selector`);
  expect(src.includes("observerPerspective: prev ? (prev.observerPerspective || 'god') : 'god'"),`${file}: perspective state is not initialized`);
  expect(src.includes('function applyObserverPerspective('),`${file}: missing perspective renderer`);
  expect(src.includes('function observerPerspectiveCanSeeRole(p)'),`${file}: missing role-knowledge filter`);
  expect(src.includes("if (scope === 'pack')")||src.includes("if(scope === 'pack')"),`${file}: wolf-pack visibility is not handled`);
  expect(src.includes("markLogVisibility(entry, isWolfChat ? 'wolfchat' : 'speech'"),`${file}: speech and wolf chat lack visibility metadata`);
  expect(src.includes("Render.log('night-detail', '💭 ' + player.name + '的想法：' + result.thinking, {players:[player.id], actorId:player.id})"),`${file}: private thinking is not scoped to its AI`);
  expect(src.includes("{players:[actor.id], actorId:actor.id}"),`${file}: private night results are not scoped to their actor`);
  expect(src.includes("privateScope:'actor'"),`${file}: private action CG can leak across perspectives`);
  expect(src.includes("privateScope:'pack'"),`${file}: wolf awakening CG is not limited to wolves`);
  expect(src.includes('function nightStepLogVisibility(step)'),`${file}: legacy night logs lack step-level visibility`);
  expect(src.includes('_activeNightLogVisibility = nightStepLogVisibility(key)'),`${file}: night-step visibility is not activated`);
  expect(src.includes('observerPerspective:S.observerPerspective'),`${file}: save game does not persist the selected perspective`);
  expect(src.includes("S.observerPerspective = e.target.value || 'god'"),`${file}: selector does not apply perspective changes`);
  expect(src.includes("c.classList.add('perspective-role-hidden')"),`${file}: player cards still leak hidden roles`);
}

if(failures.length){console.error(failures.map(x=>'FAIL '+x).join('\n'));process.exit(1);}
console.log('observer perspective: UI, private logs, wolf chat, cards, CG and persistence passed');

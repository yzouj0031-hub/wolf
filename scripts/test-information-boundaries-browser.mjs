// Optional end-to-end prompt assembly checks. No model calls or external network.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser=await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  ? {executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{});
try {
  for (const file of ['index.html','en/index.html']) {
    const page=await browser.newPage();
    await page.route(/^https?:\/\//,r=>r.abort());
    await page.goto(pathToFileURL(path.resolve(file)).href);
    const out=await page.evaluate(()=>{
      const keys=['villager','seer','witch','fox','fox','gargoyle','gargoyle','werewolf','whitecat'];
      S.players=keys.map((k,id)=>({id,name:'Seat'+id,alive:true,role:ALL_ROLES[k],memory:[]}));
      if(S.players.some(p=>!p.role)) throw new Error('Fixture role missing');
      S.round=3;S.phase='day';S.sheriff=-1;
      S.history=[{name:'Seat0',text:'PUBLIC_ONLY',round:1,phase:'day'}];
      S.seerLog={1:{target:'SECRET_SEER',result:'狼人显示'}};
      S.witchPotions={save:true,poison:true};
      gameRecord.length=0;
      gameRecord.push(
        {type:'speech',name:'Seat0',game:'PUBLIC_ONLY',round:1,phase:'day'},
        {type:'night_action',role:'seer',casterId:1,round:1,target:'SECRET_SEER',result:'wolf'},
        {type:'night_action',role:'witch',casterId:2,round:1,poisoned:'SECRET_POISON'},
        {type:'night_action',role:'fox',casterId:3,round:1,target:'SECRET_FOX_A',targetId:5,result:'mute'},
        {type:'night_action',role:'fox',casterId:4,round:1,target:'SECRET_FOX_B',targetId:6,result:'mute'},
        {type:'night_action',role:'gargoyle',casterId:5,round:1,target:'SECRET_GARGOYLE_A',roleName:'女巫'},
        {type:'night_action',role:'gargoyle',casterId:6,round:1,target:'SECRET_GARGOYLE_B',roleName:'预言家'},
        {type:'night_action',role:'wolf',round:1,target:'SECRET_PACK'},
        {type:'speech',wolfChat:true,name:'Seat7',game:'SECRET_CHAT',round:1,phase:'night'}
      );
      const methods={api:p=>buildSystemPrompt(p),web:p=>buildWebPrompt(p),summary:p=>{
        _buildChatSummary(p,null,{}); return document.getElementById('etxt').value;
      }};
      const rows=[];
      for (const [name,fn] of Object.entries(methods)) {
        for (const id of [0,8,3,5]) {
          try {
            const s=String(fn(S.players[id]));
            const found=s.match(/SECRET_[A-Z_]+/g)||[];
            const allowed=id===3?['SECRET_FOX_A']:id===5?['SECRET_GARGOYLE_A']:[];
            rows.push({name,id,found:[...new Set(found)],ok:found.every(x=>allowed.includes(x)) &&
              (!allowed.length || found.includes(allowed[0]))});
          } catch(e) { rows.push({name,id,error:e.message,ok:false}); }
        }
        const oldId=S.players[7].id;
        S.players[7].id=0;
        try { fn(S.players[0]); rows.push({name,id:'duplicate',ok:false}); }
        catch(e) { rows.push({name,id:'duplicate',ok:/视角保护/.test(e.message)}); }
        finally { S.players[7].id=oldId; }
      }
      return rows;
    });
    console.log(file,JSON.stringify(out));
    assert.ok(out.every(x=>x.ok),'Actual prompt assembly leaked or lost authorized information');
    await page.close();
  }
} finally { await browser.close(); }

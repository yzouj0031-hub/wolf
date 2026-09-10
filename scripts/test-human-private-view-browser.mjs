import assert from 'node:assert/strict';
import {withOfflinePage} from './lib/offline-browser.mjs';

await withOfflinePage(async (page, origin) => {
  for (const file of ['index.html', 'en/index.html']) {
    await page.goto(origin + '/' + file);
    await page.waitForFunction(() => typeof humanViewLocked === 'function');
    const checks = await page.evaluate(async () => {
      const checks = [];
      const check = (name, ok) => checks.push({name, ok:!!ok});
      window.alert = () => {};
      S.players = ['villager','werewolf','witch','gargoyle','gargoyle','seer'].map((key,id) =>
        ({id,name:'Seat'+id,role:ALL_ROLES[key],alive:true,memory:[]}));
      Object.assign(S,{playerId:0,pureAI:false,directorMode:false,gameOver:false,
        round:2,phase:'day',sheriff:-1,history:[],observerPerspective:'player:2'});
      gameRecord.length = 0;
      gameRecord.push({type:'night_action',role:'witch',casterId:2,round:1,poisoned:'SECRET_POISON'});
      $('gl').innerHTML='';
      $('m-anon').checked=false; $('m-mc').checked=true;
      check('human mode forces own perspective and blocks MC', humanViewLocked() && isAnon() && !isMC() && observerPerspectivePlayer().id===0);
      check('own role visible, other role private',observerPerspectiveCanSeeRole(S.players[0]) && !observerPerspectiveCanSeeRole(S.players[2]));
      Render.log('night-result','SECRET_FOREIGN',{players:[2],actorId:2});
      Render.log('night-result','OWN_RESULT',{players:[0],actorId:0});
      Render.log('wolfchat','SECRET_PACK');
      check('foreign logs are not inserted',!$('gl').textContent.includes('SECRET') && $('gl').textContent.includes('OWN_RESULT'));
      const unknown=document.createElement('div'); unknown.dataset.visibility='players';
      check('unowned scope fails closed for seat zero',!logVisibleToPerspective(unknown,S.players[0]));
      const old=document.createElement('div'); old.className='le'; old.dataset.visibility='players'; old.dataset.visiblePlayers='2'; old.textContent='SECRET_RESTORED';
      $('gl').appendChild(old);
      const speech=document.createElement('div'); speech.className='le'; speech.dataset.actorId='2'; speech.innerHTML='<div class="log-thought">SECRET_THOUGHT</div><div>PUBLIC</div>';
      $('gl').appendChild(speech);
      applyObserverPerspective(false);
      check('restored secrets removed, public speech retained',!$('gl').textContent.includes('SECRET') && $('gl').textContent.includes('PUBLIC'));
      check('unsafe toggles disabled',$('m-anon').disabled && $('m-mc').disabled);
      _buildChatSummary(S.players[2],null,{});
      check('foreign summary request resolves to self',!$('etxt').value.includes('SECRET_POISON'));
      check('god report blocked',_buildGodViewReport()==='');
      let blocked=false;
      try { _openInputModal('SECRET_MANUAL','role',()=>{},S.players[2]); } catch { blocked=true; }
      check('foreign manual fallback blocked',blocked && !document.body.textContent.includes('SECRET_MANUAL'));
      blocked=false;
      try { _openWebPromptModal(S.players[2],()=> 'SECRET_WEB',()=>{}); } catch { blocked=true; }
      check('foreign web relay blocked',blocked && !document.body.textContent.includes('SECRET_WEB'));
      fakeStream=async (node,text)=>{node.textContent=text;};
      TTS.claimLive=()=>true;
      await streamSpeak(S.players[2],'test',{thinking:'SECRET_STREAM',game:'PUBLIC_STREAM',action:''},false,true);
      check('streaming shows speech but never AI thoughts',!$('gl').textContent.includes('SECRET_STREAM') && $('gl').textContent.includes('PUBLIC_STREAM'));
      await streamSpeak(S.players[1],'test',{thinking:'SECRET_WOLF_THOUGHT',game:'SECRET_WOLF_STREAM',action:''},true,true);
      check('streamed pack chat absent for human villager',!$('gl').textContent.includes('SECRET_WOLF'));
      check('AI private API context still belongs to that AI',buildSystemPrompt(S.players[2]).includes('SECRET_POISON'));
      S.players[0].alive=false;
      check('death does not unlock',humanViewLocked());
      S.players[0].alive=true;
      S.playerId=1;
      const pack=document.createElement('div');pack.dataset.visibility='pack';
      check('pack permission allowed',logVisibleToPerspective(pack,humanViewPlayer()));
      S.playerId=3;
      check('independent wolf does not see pack',!logVisibleToPerspective(pack,humanViewPlayer()));
      gameRecord.push({type:'night_action',role:'gargoyle',casterId:4,round:1,target:'Seat2',result:'exact'});
      check('same-role other caster is not knowledge',!observerPerspectiveCanSeeRole(S.players[2]));
      gameRecord.push({type:'night_action',role:'gargoyle',casterId:3,round:1,target:'Seat2',result:'exact',roleName:S.players[2].role.name});
      check('own exact check is visible',observerPerspectiveCanSeeRole(S.players[2]));
      S.gameOver=true;
      check('whole match end unlocks',!humanViewLocked());
      S.gameOver=false;S.pureAI=true;
      check('AI spectator mode preserved',!humanViewLocked() && observerPerspectivePlayer().id===2);
      return checks;
    });
    console.log(file,checks);
    assert.ok(checks.every(c=>c.ok),file+': human perspective boundary failure');
  }
});

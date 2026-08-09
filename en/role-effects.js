(()=>{
  'use strict';
  const V={
    werewolf:['爪','blade'],wolfking:['王','blade'],wolfbeauty:['花','love'],seer:['星','oracle'],
    witch:['药','potion'],hunter:['铳','blade'],guard:['盾','guardfx'],knight:['剑','blade'],
    magician:['幻','illusion'],whitecat:['魂','illusion'],fox:['狐','illusion'],fool:['戏','chaos'],
    merchant:['奇','oracle'],youshang:['商','guardfx'],wolfconcubine:['蚀','illusion'],villager:['民','guardfx'],
    whitewolf:['爆','blade'],mechwolf:['械','machine'],jester:['丑','chaos'],cupid:['爱','love'],
    serialkiller:['刃','blade'],gravekeeper:['墓','oracle'],dreamwalker:['梦','illusion'],
    alchemist:['炼','potion'],gargoyle:['瞳','blade'],soulwarden:['净','guardfx'],imitator:['仿','illusion']
  };

  function portraitUrl(role){
    if(role&&typeof role.portrait==='string'&&/^data:image\/(?:png|jpe?g|webp);base64,/i.test(role.portrait))return role.portrait;
    const base=/\/en\//.test(location.pathname)?'../icons/roles/':'icons/roles/';
    return base+encodeURIComponent(role.id)+'.jpg';
  }

  function apply(c,p,show){
    if(!c||!p||!p.role)return;
    const old=c.dataset.visibleRole||'';
    [...c.classList].filter(x=>x==='role-theme'||x.startsWith('role-')).forEach(x=>c.classList.remove(x));
    c.style.removeProperty('--role-portrait');
    if(!show){delete c.dataset.visibleRole;return;}
    const id=p.role.id,v=V[id]||['✦','oracle'];
    c.classList.add('role-theme','role-'+id,'role-'+v[1]);
    c.style.setProperty('--role-portrait','url("'+portraitUrl(p.role).replace(/"/g,'%22')+'")');
    c.dataset.visibleRole=id;
    if(old===id||c.querySelector('.role-reveal-fx'))return;
    const fx=document.createElement('div');fx.className='role-reveal-fx';
    const g=document.createElement('span');g.className='role-reveal-glyph';g.textContent=v[0];fx.appendChild(g);
    for(let i=0;i<7;i++){const s=document.createElement('i');s.className='role-reveal-spark';s.style.setProperty('--i',i);fx.appendChild(s);}
    c.appendChild(fx);setTimeout(()=>{if(fx.isConnected)fx.remove();},1250);
  }

  const base=Render.card.bind(Render);
  Render.card=function(p){
    base(p);
    const c=document.getElementById('p-'+p.id),hd=$('m-hdeath').checked,
      blind=!!(S&&S.gameOver&&S.blindReviewMode),sd=!p.alive&&p.revealed&&!hd,
      show=!blind&&(!isAnon()||p.isPlayer||canSee(p)||sd);
    apply(c,p,show);
  };
})();

const $=id=>document.getElementById(id);
export function createUI(onIdentity) {
  let pcs={},timer;
  const dialog=$('picker');
  const picker=()=>{if(!dialog.open)dialog.showModal();};
  $('identity').onclick=picker;
  $('help').onclick=()=>{const hidden=!$('instructions').hidden;$('instructions').hidden=hidden;$('help').setAttribute('aria-expanded',String(!hidden));};
  $('pcs').onchange=()=>{if(pcs[$('pcs').value])$('player-name').value=pcs[$('pcs').value].name;};
  dialog.querySelector('form').onsubmit=e=>{e.preventDefault();const name=$('player-name').value.trim();if(!name)return;const id=$('pcs').value;onIdentity({name,id:pcs[id]?.name===name?id:''});dialog.close();};
  return {
    picker,
    identity(p){$('player-name').value=p?.name||'';$('identity').textContent=p?.name||'Choose PC';},
    things(things,camp){
      pcs=Object.fromEntries(Object.entries(things).filter(([,t])=>t.type==='npc'&&t.traits?.pc&&t.campaign===camp));
      $('pcs').replaceChildren(new Option('Type a name below',''),...Object.entries(pcs).map(([id,t])=>new Option(t.name,id)));
    },
    status(text){$('status').textContent=text;},
    map(meta,f,locked){$('title').textContent=meta?.name||'GeezTabletop';$('floor').textContent=meta?`${meta.floorNames?.[f]||`Floor ${f}`} · ${locked?'Movement locked':'5 ft grid'}`:'Waiting for a map';},
    notice(text){$('notice').textContent=text;clearTimeout(timer);timer=setTimeout(()=>$('notice').textContent='',3500);},
    stairs(stair,callback){$('stairs').hidden=!stair;if(stair){$('stairs').textContent=stair.to>stair.from?'↑ Go up':'↓ Go down';$('stairs').onclick=callback;}},
    find(callback){$('find').onclick=callback;},
    handout(h){const card=document.createElement('article');card.className='handout';const close=document.createElement('button');close.textContent='×';close.setAttribute('aria-label','Dismiss handout');close.onclick=()=>card.remove();const title=document.createElement('h2');title.textContent=h.title||'Handout';const text=document.createElement('p');text.textContent=h.text||'';card.append(close,title,text);if(h.image&&safeImage(h.image)){const img=new Image();img.alt=h.title||'Handout';img.src=h.image;card.append(img);}$('handouts').append(card);}
  };
}
export function safeImage(url){try{return ['http:','https:'].includes(new URL(url,location.href).protocol)||/^data:image\/(png|jpeg|webp|gif);base64,/i.test(url);}catch{return false;}}

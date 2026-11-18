'use strict';

// Reservations are per physical controller. Match every exact slot before restoring
// by model, so two identical controllers keep their drivers when one reconnects.
const LocalSeatPads = (() => {
  const identity = p => ({index:p.index, id:p.id});
  function read() {
    try { return Array.from(navigator.getGamepads?.() || []).filter(p => p && p.connected !== false); }
    catch { return []; }
  }
  function match(slots, devices) {
    const pads = devices.filter(p => p && p.connected !== false);
    const used = new Set(), map = slots.map(() => null);
    function take(i, pad) {
      if (!pad) return;
      used.add(pad.index); map[i] = pad; slots[i] = identity(pad);
    }
    for (let i=0;i<slots.length;i++) {
      const slot=slots[i];
      if (slot && !slot.keyboard) take(i,pads.find(p => p.index === slot.index && p.id === slot.id && !used.has(p.index)));
    }
    for (let i=0;i<slots.length;i++) {
      const slot=slots[i];
      if (slot && !slot.keyboard && !map[i]) take(i,pads.find(p => p.id === slot.id && !used.has(p.index)));
    }
    const free = slots.map((slot,i)=>slot ? -1 : i).filter(i=>i>=0);
    if (free.length===slots.length && slots.length>1 && pads.length<slots.length) free.push(free.shift());
    for (const pad of pads) if (!used.has(pad.index) && free.length) take(free.shift(),pad);
    return map;
  }
  return {read, match, identity};
})();
window.AcornLocalPads = LocalSeatPads;

let localManual = [], localSetupStamp = '';
const seatColors = ['#ff655b','#55adff','#ffd064','#a7dc77'];
const seatKeys = ['WASD','Arrows','IJKL','Numpad'];
function initialPadSeats(count,pads) {
  const slots=Array.from({length:count},(_,i)=>localManual[i] ? {...localManual[i]} : null);
  LocalSeatPads.match(slots,pads);
  return slots;
}
function deviceName(pad) {
  if (/dual|playstation|054c|wireless controller/i.test(pad.id)) return 'PlayStation';
  if (/xbox|xinput|045e/i.test(pad.id)) return 'Xbox';
  return String(pad.id || 'Controller').split(' (')[0].slice(0,32);
}
function deviceLabel(slot,pad,i) {
  if (pad) return 'Pad '+(pad.index+1)+' · '+deviceName(pad);
  return slot && !slot.keyboard ? 'Reconnect '+deviceName(slot) : 'Keyboard · '+seatKeys[i];
}
function localDevicesMarkup(count,pads=LocalSeatPads.read()) {
  const slots=initialPadSeats(count,pads), mapped=LocalSeatPads.match(slots,pads);
  return '<div class="local-devices">'+slots.map((slot,i)=>{
    const device=mapped[i], explicit=localManual[i];
    const value=explicit ? (explicit.keyboard?'keys':'p'+(device?.index??explicit.index)) : 'auto';
    const options=[['auto','Auto · '+deviceLabel(slot,device,i)],['keys','Keyboard · '+seatKeys[i]],
      ...pads.map(p=>['p'+p.index,'Pad '+(p.index+1)+' · '+deviceName(p)])];
    if(explicit && !explicit.keyboard && !device)options.push([value,'Reconnect '+deviceName(explicit)]);
    return '<label style="--seat:'+seatColors[i]+'"><b>P'+(i+1)+'</b><select aria-label="Player '+(i+1)+' input" data-local-device="'+i+'" data-focus-id="local-device-'+i+'">'+
      options.map(([v,label])=>'<option value="'+v+'" '+(v===value?'selected':'')+'>'+safeName(label)+'</option>').join('')+'</select></label>';
  }).join('')+'</div>';
}
function changeLocalDevice(seat,value) {
  const pads=LocalSeatPads.read(), chosen=pads.find(p=>'p'+p.index===value);
  const old=localManual[seat];
  if(chosen) {
    const previous=initialPadSeats(Math.max(2,players),pads).findIndex(slot=>slot?.index===chosen.index && slot.id===chosen.id);
    if(previous>=0 && previous!==seat)localManual[previous]=old || null;
  }
  localManual[seat]=value==='keys'?{keyboard:true}:chosen ? LocalSeatPads.identity(chosen) : null;
  const panel=one('#localDevices');
  if(panel) { panel.innerHTML=localDevicesMarkup(Math.max(2,players),pads);panel.querySelector('[data-local-device="'+seat+'"]')?.focus(); }
}
document.addEventListener('change',event=>{
  const seat=event.target.dataset?.localDevice;
  if(seat!=null)changeLocalDevice(Number(seat),event.target.value);
});
function openLocalGrid(grid) {
  const pads=LocalSeatPads.read();
  grid.padSeats=initialPadSeats(grid.count,pads);
  grid.padMap=LocalSeatPads.match(grid.padSeats,pads);
  grid.ready=Array(grid.count).fill(false);
  grid.moves=[];
}
function localGridScreen() {
  const g=draftGrid, selected=g.seat, course=tracks[track];
  const portraits=drivers.map((racer,id)=>{
    const cursors=g.choices.slice(0,g.count).map((d,i)=>d===id?i:-1).filter(i=>i>=0);
    const locked=!driverAvailable(id);
    const bands=cursors.map((i,k)=>seatColors[i]+' '+(100*k/cursors.length)+'% '+(100*(k+1)/cursors.length)+'%').join(',');
    const frame=cursors.length===1?'linear-gradient('+seatColors[cursors[0]]+','+seatColors[cursors[0]]+')':'conic-gradient(from 180deg,'+bands+')';
    return '<button type="button" class="driver-card grid-pick local-pick" data-pick-driver="'+id+'" aria-label="'+safeName(racer.name)+(locked?' locked':'')+'" aria-pressed="'+cursors.includes(selected)+'" '+(cursors.length?'style="--cursor-ring:'+frame+'" ':'')+(locked?'disabled':'')+'>'+
      '<span class="driver-img"><img src="art/driver-'+id+'.webp" alt=""><span class="local-cursors">'+cursors.map(i=>
        '<b style="--seat:'+seatColors[i]+'" data-cursor="'+i+'" data-locked="'+g.ready[i]+'">P'+(i+1)+(g.ready[i]?' ✓':'')+'</b>').join('')+'</span></span>'+
      '<span class="driver-copy"><strong>'+racer.name+'</strong><small>'+(locked?lockProgress():racer.species)+'</small></span>'+
      '<span class="local-stripe">'+cursors.map(i=>'<i style="background:'+seatColors[i]+'"></i>').join('')+'</span></button>';
  }).join('');
  const seatsHtml=g.ready.map((ready,i)=>'<button type="button" class="local-seat" style="--seat:'+seatColors[i]+'" data-local-seat="'+i+'" aria-pressed="'+(i===selected)+'"><b>P'+(i+1)+'</b><span><strong>'+drivers[g.choices[i]].name+'</strong><small>'+safeName(deviceLabel(g.padSeats[i],g.padMap[i],i))+'</small></span><em>'+ (ready?'Ready ✓':'Picking')+'</em></button>').join('');
  const allReady=g.ready.every(Boolean);
  const hostPad=g.padMap[0], confirmPad=g.padMap[selected];
  const confirmName=pad=>/dual|playstation|054c|wireless controller/i.test(pad?.id)||settings.padStyle==='ps'?'Cross':'A';
  const action=allReady?'Start race':g.ready[selected]?'Change P'+(selected+1)+' driver':'Lock P'+(selected+1)+' driver';
  main.innerHTML='<section class="grid-select local-grid"><div class="select-top"><div><button class="select-back" data-action="selectBack">'+icon('left')+'Race setup</button><h1>Choose your drivers</h1></div><div class="entry-rules">'+raceRules('local')+'</div></div><div class="select-layout"><div class="select-roster" aria-label="Choose characters">'+portraits+'</div><aside class="grid-entry"><div class="entry-course" style="background-image:linear-gradient(0deg,#10180ef5,transparent),url(art/course-'+track+'.webp)"><span class="label">Split-screen · '+engineClass+' cc</span><h2>'+course.name+'</h2></div><div class="local-team">'+seatsHtml+'<p class="local-tip">'+(allReady?'P1 starts the race'+(hostPad?' with '+confirmName(hostPad):'')+'.':(confirmPad?'D-pad or stick to choose. '+confirmName(confirmPad)+' locks your driver.':'Select a player, choose a driver, then lock them in.'))+'</p><button class="action primary confirm-driver" data-action="confirmDriver">'+icon(allReady?'play':'check')+action+'</button></div></aside></div></section>';
}
function renderLocalGrid() {
  const active=document.activeElement;
  const id=active?.dataset?.pickDriver,seat=active?.dataset?.localSeat,action=active?.dataset?.action;
  localGridScreen();
  const focus=id!=null?'[data-pick-driver="'+id+'"]':seat!=null?'[data-local-seat="'+seat+'"]':action?'[data-action="'+action+'"]':null;
  if(focus)main.querySelector(focus)?.focus({preventScroll:true});
}
function localCursor(i,id) {
  const g=draftGrid;
  if(g.ready[i]||!driverAvailable(id)||!drivers[id])return;
  g.choices[i]=id;g.seat=i;renderLocalGrid();
}
function localConfirm(i,hostButton=false) {
  const g=draftGrid;
  if(g.ready.every(Boolean) && hostButton) {
    const chosen=g.choices.slice(0,g.count);
    seats=[...chosen,...seats.filter(id=>!chosen.includes(id))].slice(0,4);
    driver=seats[0]; updateDriver();startSelection();return;
  }
  const owner=g.ready.findIndex((ready,j)=>ready&&j!==i&&g.choices[j]===g.choices[i]);
  if(owner>=0){notice(drivers[g.choices[i]].name+' is ready with P'+(owner+1));return;}
  g.ready[i]=!g.ready[i];g.seat=i;
  if(g.ready[i]){const next=g.ready.indexOf(false);if(next>=0)g.seat=next;}
  renderLocalGrid();
}
function handleLocalPads(devices,previousPads,ts) {
  const pads=devices.filter(p=>p&&p.connected!==false);
  const signature=JSON.stringify(pads.map(p=>[p.index,p.id]));
  if(modal==='setup'&&mode==='local'&&!running) {
    if(localSetupStamp!==signature){
      localSetupStamp=signature;
      const panel=one('#localDevices'),focus=document.activeElement?.dataset?.localDevice;
      if(panel){panel.innerHTML=localDevicesMarkup(Math.max(2,players),pads);if(focus!=null)panel.querySelector('[data-local-device="'+focus+'"]')?.focus();}
    }
    return false;
  }
  if(running||modal||page!=='select'||mode!=='local'||!draftGrid?.ready)return false;
  const g=draftGrid;
  g.padMap=LocalSeatPads.match(g.padSeats,pads);
  if(signature!==g.devices){g.devices=signature;renderLocalGrid();}
  for(let i=0;i<g.count;i++) {
    const pad=g.padMap[i];if(!pad)continue;
    const prev=previousPads[pad.index]||[],held=j=>!!pad.buttons[j]?.pressed,press=j=>held(j)&&!prev[j];
    if(press(1)) {if(g.ready[i]){g.ready[i]=false;g.seat=i;renderLocalGrid();}else if(i===0){driverSelectBack();break;}continue;}
    if(press(0)||press(9)) {
      if(!g.ready[i]||(i===0&&g.ready.every(Boolean)))localConfirm(i,i===0);
      if(running)break;
      continue;
    }
    if(g.ready[i])continue;
    const x=held(15)||pad.axes[0]>.6?1:held(14)||pad.axes[0]<-.6?-1:0;
    const y=held(13)||pad.axes[1]>.6?1:held(12)||pad.axes[1]<-.6?-1:0;
    if(!x&&!y){g.moves[i]=null;continue;}
    const dir=x?String(x):'y'+y, last=g.moves[i];
    if(last?.dir===dir&&ts<last.next)continue;
    g.moves[i]={dir,next:ts+(last?.dir===dir?140:310)};
    const cards=Array.from(main.querySelectorAll('[data-pick-driver]')),card=cards[g.choices[i]];
    const bounds=card.getBoundingClientRect(),cx=bounds.x+bounds.width/2,cy=bounds.y+bounds.height/2;
    let target=null,cost=Infinity;
    for(const option of cards) {
      if(option===card||option.disabled)continue;
      const rect=option.getBoundingClientRect(),dx=rect.x+rect.width/2-cx,dy=rect.y+rect.height/2-cy,forward=x?dx*x:dy*y,side=x?dy:dx;
      if(forward<2)continue;
      const distance=forward+Math.abs(side)*5;
      if(distance<cost){cost=distance;target=option;}
    }
    if(target)localCursor(i,+target.dataset.pickDriver);
  }
  return true;
}
